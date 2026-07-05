const EARTH_RADIUS_METERS = 6371000;

export type LngLat = { lng: number; lat: number };

// straight-line ("as the crow flies") distance in meters — used only as a
// free, no-api-call heuristic for pruning/ranking/ordering candidates before
// the one real kakao navi call that actually matters
export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
