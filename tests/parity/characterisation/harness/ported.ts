/**
 * Plan steps whose port has landed. A characterisation suite runs for real
 * once its ticket is listed here; until then its cases are reported as todo
 * (pending) so CI stays green while the target is still a 501 scaffold.
 *
 * Run everything regardless with `PARITY_RUN_ALL=1 npm test` to see the
 * current red baseline.
 */
export const PORTED_TICKETS: ReadonlySet<string> = new Set<string>([
  'UNT3-16', // TestPropertyController → GET /properties, GET /properties/{id}/pictures
  'UNT3-17', // GeocodingServiceTest → POST /geocoding/addresses
  'UNT3-19', // Create_property flow baseline → POST/GET/PATCH/DELETE /properties, /brokers
]);

export const RUN_ALL = process.env.PARITY_RUN_ALL === '1';
