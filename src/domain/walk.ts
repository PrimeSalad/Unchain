/**
 * Walk-session math — pure TS, zero framework deps.
 *
 * The walk activity is open-ended (the user decides when to stop) and tracks
 * live metrics on-device only: elapsed time (wall clock), steps (pedometer)
 * and distance (GPS fixes folded through haversine). Nothing here talks to
 * the network; sensors are read by the presentation layer and fed in.
 */

/** A walk must last at least this long to count as today's activity. */
export const WALK_MIN_SECONDS = 60;

/** GPS fixes with worse horizontal accuracy than this are ignored (metres). */
export const GPS_MAX_ACCURACY_M = 40;

/** Per-fix distance sanity window (metres): below = jitter, above = teleport. */
export const GPS_MIN_STEP_M = 1;
export const GPS_MAX_STEP_M = 80;

/** Great-circle metres between two coordinates (haversine). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The distance a new GPS fix adds — 0 when the fix should be discarded. */
export function gpsDelta(
  last: { lat: number; lon: number } | null,
  next: { lat: number; lon: number; accuracy?: number | null },
): number {
  if (next.accuracy != null && next.accuracy > GPS_MAX_ACCURACY_M) return 0;
  if (!last) return 0;
  const d = haversineMeters(last.lat, last.lon, next.lat, next.lon);
  return d >= GPS_MIN_STEP_M && d <= GPS_MAX_STEP_M ? d : 0;
}

/** "850 m" under a kilometre, "1.24 km" beyond it. */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

/** Average pace as 12'30" per km — null until the walk is long enough to be
 *  meaningful (100 m), so garbage paces never show. */
export function formatPace(seconds: number, meters: number): string | null {
  if (meters < 100 || seconds <= 0) return null;
  const secPerKm = seconds / (meters / 1000);
  if (!Number.isFinite(secPerKm)) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
}
