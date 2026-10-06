import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { CoordinatesDto, GeocodingAddressDto } from './dto/geocoding.dto';
import { NominatimClient, NominatimPlace, NominatimSearchParams } from './nominatim.client';

const NO_MATCH: Readonly<CoordinatesDto> = Object.freeze({ lat: null, lon: null });

/**
 * Port of Apex `GeocodingService` (`@InvocableMethod geocodeAddresses`, Create_property flow).
 *
 * Same contract as the Apex method: one `Coordinates` per input address, in order; an address
 * with no non-blank field makes no callout and yields `{lat: null, lon: null}`; any upstream
 * failure is swallowed into the same null coordinates (the Apex code only reads 200 answers).
 * The callout itself lives in {@link NominatimClient} (timeout, retry, 1 req/s). Results are
 * cached in-process (Nominatim usage policy) for `GEOCODING_CACHE_TTL_SECONDS`.
 *
 * Also used internally by the properties module when a property is created or updated with an
 * address but without coordinates (`geocodeAddress`).
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, { value: CoordinatesDto; expiresAt: number }>();
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;

  constructor(
    private readonly client: NominatimClient,
    config: AppConfigService,
  ) {
    this.cacheTtlMs = config.get('GEOCODING_CACHE_TTL_SECONDS') * 1000;
    this.cacheMaxEntries = config.get('GEOCODING_CACHE_MAX_ENTRIES');
  }

  get baseUrl(): string {
    return this.client.baseUrl;
  }

  /** `GeocodingService.geocodeAddresses(List<GeocodingAddress>)` → `List<Coordinates>`. */
  async geocodeAddresses(addresses: GeocodingAddressDto[]): Promise<CoordinatesDto[]> {
    const computedCoordinates: CoordinatesDto[] = [];
    for (const address of addresses) {
      computedCoordinates.push(await this.geocodeAddress(address));
    }
    return computedCoordinates;
  }

  /** Single-address form for the properties module and `POST /geocode`. */
  async geocodeAddress(address: GeocodingAddressDto): Promise<CoordinatesDto> {
    const params = toSearchParams(address);
    // GeocodingService.cls line 29: `if (geocodingUrl != BASE_URL)` — nothing to look up.
    if (!params) return { ...NO_MATCH };

    const key = cacheKey(params);
    const cached = this.fromCache(key);
    if (cached) return { ...cached };

    try {
      const places = await this.client.search(params);
      const coords = firstCoordinates(places);
      this.toCache(key, coords);
      return { ...coords };
    } catch (error) {
      this.logger.warn(
        `Geocoding failed (${(error as Error).message}); returning null coordinates like the Apex callout did`,
      );
      return { ...NO_MATCH };
    }
  }

  /** Number of cached lookups (for tests and diagnostics). */
  get cacheSize(): number {
    return this.cache.size;
  }

  private fromCache(key: string): CoordinatesDto | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    // refresh recency (Map keeps insertion order → oldest entries evicted first)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  private toCache(key: string, value: CoordinatesDto): void {
    if (this.cacheTtlMs <= 0) return;
    if (this.cache.size >= this.cacheMaxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }
}

/** Apex `String.isNotBlank` on each field; returns null when every field is blank. */
export function toSearchParams(address: GeocodingAddressDto): NominatimSearchParams | null {
  const params: NominatimSearchParams = {};
  let any = false;
  for (const key of ['street', 'city', 'state', 'country', 'postalcode'] as const) {
    const value = address[key];
    if (typeof value === 'string' && value.trim() !== '') {
      params[key] = value.trim();
      any = true;
    }
  }
  return any ? params : null;
}

function cacheKey(params: NominatimSearchParams): string {
  return JSON.stringify([
    params.street?.toLowerCase() ?? '',
    params.city?.toLowerCase() ?? '',
    params.state?.toLowerCase() ?? '',
    params.country?.toLowerCase() ?? '',
    params.postalcode?.toLowerCase() ?? '',
  ]);
}

/**
 * `GeocodingService.cls` lines 40-44: `deserializedCoords[0]`. Nominatim serialises lat/lon as
 * strings; Apex's `Decimal` deserialisation accepted both, so does this. An empty result list
 * (no match) maps to null coordinates instead of the Apex index-out-of-bounds exception.
 */
export function firstCoordinates(places: NominatimPlace[]): CoordinatesDto {
  const first = places[0];
  if (!first) return { ...NO_MATCH };
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ...NO_MATCH };
  return { lat, lon };
}
