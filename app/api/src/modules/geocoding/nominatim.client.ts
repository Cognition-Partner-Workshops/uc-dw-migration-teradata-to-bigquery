import { Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

/** Query parameters of the Nominatim structured search (`GeocodingService.cls` lines 11-26). */
export interface NominatimSearchParams {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalcode?: string;
}

/** The subset of a Nominatim `/search?format=json` result this app reads (lat/lon arrive as strings). */
export interface NominatimPlace {
  lat: string | number;
  lon: string | number;
  display_name?: string;
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface NominatimClientOptions {
  baseUrl: string;
  userAgent: string;
  referer?: string;
  timeoutMs: number;
  maxRetries: number;
  minIntervalMs: number;
  /** Base of the exponential back-off between retries (doubles per attempt). */
  retryBackoffMs?: number;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/** Raised once every attempt against Nominatim failed; `status` is the last HTTP status when there was one. */
export class NominatimError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly attempts = 1,
  ) {
    super(message);
    this.name = 'NominatimError';
  }
}

const RETRIABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Typed HTTP client for the Nominatim search API — the Apex `Http`/`HttpRequest` callout plus
 * the `nominatim_openstreetmap` Remote Site Setting. Adds what Apex lacked and Nominatim's
 * usage policy asks for: an identifying User-Agent, a request timeout, bounded retries with
 * back-off (network errors, timeouts, 429 and 5xx only) and a process-wide limiter that spaces
 * requests at least `minIntervalMs` apart (1 req/s by default).
 */
export class NominatimClient {
  private readonly logger = new Logger(NominatimClient.name);
  private readonly options: Required<Omit<NominatimClientOptions, 'referer'>> & {
    referer?: string;
  };
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: NominatimClientOptions) {
    this.options = {
      retryBackoffMs: 500,
      fetch: defaultFetch,
      sleep: defaultSleep,
      ...options,
    };
  }

  /** Nest provider factory (see `GeocodingModule`): every knob comes from `GEOCODING_*` config. */
  static fromConfig(config: AppConfigService): NominatimClient {
    return new NominatimClient(NominatimClient.optionsFromConfig(config));
  }

  static optionsFromConfig(config: AppConfigService): NominatimClientOptions {
    return {
      baseUrl: config.get('GEOCODING_BASE_URL'),
      userAgent: config.get('GEOCODING_USER_AGENT'),
      referer: config.get('GEOCODING_REFERER'),
      timeoutMs: config.get('GEOCODING_TIMEOUT_MS'),
      maxRetries: config.get('GEOCODING_MAX_RETRIES'),
      minIntervalMs: config.get('GEOCODING_MIN_INTERVAL_MS'),
    };
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  /** `GeocodingService.cls` lines 11-26: base URL + one `&field=value` per non-blank field. */
  buildSearchUrl(params: NominatimSearchParams): string {
    const url = new URL(this.options.baseUrl);
    if (!url.searchParams.has('format')) url.searchParams.set('format', 'json');
    for (const key of ['street', 'city', 'state', 'country', 'postalcode'] as const) {
      const value = params[key];
      if (value !== undefined && value !== null && value.trim() !== '') {
        url.searchParams.set(key, value.trim());
      }
    }
    return url.toString();
  }

  /**
   * GET the structured search for `params`. Resolves to the parsed result list (possibly empty);
   * rejects with {@link NominatimError} when every attempt failed or the answer was not a 2xx.
   */
  async search(params: NominatimSearchParams): Promise<NominatimPlace[]> {
    const url = this.buildSearchUrl(params);
    const attempts = this.options.maxRetries + 1;
    let lastError: NominatimError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const outcome = await this.throttled(() => this.attempt(url));
      if (outcome.ok) return outcome.places;

      lastError = new NominatimError(outcome.message, outcome.status, attempt);
      if (!outcome.retriable || attempt === attempts) break;

      const backoff = outcome.retryAfterMs ?? this.options.retryBackoffMs * 2 ** (attempt - 1);
      this.logger.warn(
        `Nominatim ${redact(url)} failed (${outcome.message}) on attempt ${attempt}/${attempts}; retrying in ${backoff}ms`,
      );
      await this.options.sleep(backoff);
    }
    throw lastError ?? new NominatimError('Nominatim request failed');
  }

  private async attempt(url: string): Promise<AttemptOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'user-agent': this.options.userAgent,
      };
      if (this.options.referer) headers.referer = this.options.referer;

      const response = await this.options.fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          retriable: RETRIABLE_STATUSES.has(response.status),
          retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
          message: `HTTP ${response.status}`,
        };
      }

      const body: unknown = await response.json().catch(() => null);
      if (!Array.isArray(body)) {
        return { ok: false, status: response.status, retriable: false, message: 'unexpected body' };
      }
      return { ok: true, places: body as NominatimPlace[] };
    } catch (error) {
      const aborted = (error as Error)?.name === 'AbortError';
      return {
        ok: false,
        retriable: true,
        message: aborted
          ? `timed out after ${this.options.timeoutMs}ms`
          : ((error as Error)?.message ?? String(error)),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Serialises requests and keeps them at least `minIntervalMs` apart (Nominatim: 1 req/s). */
  private throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const wait = this.lastRequestAt + this.options.minIntervalMs - Date.now();
      if (wait > 0) await this.options.sleep(wait);
      this.lastRequestAt = Date.now();
      return fn();
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

type AttemptOutcome =
  | { ok: true; places: NominatimPlace[] }
  | { ok: false; status?: number; retriable: boolean; retryAfterMs?: number; message: string };

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.min(Math.max(at - Date.now(), 0), 30_000);
}

/** Addresses are personal data: log the endpoint, not the query. */
function redact(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}
