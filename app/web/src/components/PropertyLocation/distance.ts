export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Haversine distance in miles (`d / 1.609344`), as `c/propertyLocation` computed it. */
export function distanceInMiles(from: Coordinates, to: Coordinates): number {
  const deg2rad = (deg: number) => (deg * Math.PI) / 180.0;
  const earthRadius = 6371; // Radius of the earth in km
  const dLat = deg2rad(to.latitude - from.latitude);
  const dLon = deg2rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(from.latitude)) *
      Math.cos(deg2rad(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (earthRadius * c) / 1.609344;
}
