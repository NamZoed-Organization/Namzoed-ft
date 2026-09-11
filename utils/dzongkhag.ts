/**
 * Nearest-dzongkhag lookup from coordinates.
 *
 * The same loop was written out in DzongkhagContext and DetectDzongkhag
 * (and was about to be a third time in the profile's location editor), so
 * it lives here once — including the two remaps, since Phuentsholing and
 * Gelephu are towns in the centres list rather than dzongkhags of their own.
 */

import { dzongkhagCenters } from "@/data/dzongkhag";

/** Great-circle distance in km. */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Name of the dzongkhag whose centre is closest to the given coordinates. */
export function nearestDzongkhag(lat: number, lon: number): string {
  let nearest = dzongkhagCenters[0];
  let minDist = Infinity;

  for (const dz of dzongkhagCenters) {
    const d = distanceKm(lat, lon, dz.lat, dz.lon);
    if (d < minDist) {
      minDist = d;
      nearest = dz;
    }
  }

  if (nearest.name === "Phuentsholing") return "Chhukha";
  if (nearest.name === "Gelephu") return "Sarpang";
  return nearest.name;
}
