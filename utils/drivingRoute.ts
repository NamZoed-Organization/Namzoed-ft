import { supabase } from "@/lib/supabase";

export type LatLng = { latitude: number; longitude: number };

/**
 * Call Supabase Edge Function `driving-route` (server-side Google Directions).
 * Required on iOS when the Maps API key is restricted to iOS apps — those keys do not
 * authorize Directions REST calls from the device.
 */
async function fetchDrivingRouteViaSupabase(
  from: LatLng,
  to: LatLng,
): Promise<LatLng[] | null> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;

  try {
    const { data, error } = await supabase.functions.invoke<{
      coordinates?: LatLng[];
      error?: string;
    }>("driving-route", {
      body: {
        origin: { latitude: from.latitude, longitude: from.longitude },
        destination: { latitude: to.latitude, longitude: to.longitude },
      },
    });

    if (error || !data?.coordinates || data.coordinates.length < 2) return null;
    return data.coordinates;
  } catch {
    return null;
  }
}
/** Decode Google Encoded Polyline Algorithm Format */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function pushUniqueTail(out: LatLng[], p: LatLng) {
  const prev = out[out.length - 1];
  if (
    !prev ||
    prev.latitude !== p.latitude ||
    prev.longitude !== p.longitude
  ) {
    out.push(p);
  }
}

/** Full path along roads: each step has its own encoded polyline (more detail than overview). */
function latLngFromGoogleRoute(route: {
  legs?: {
    steps?: { polyline?: { points?: string } }[];
  }[];
  overview_polyline?: { points?: string };
}): LatLng[] {
  const out: LatLng[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const enc = step.polyline?.points;
      if (!enc) continue;
      for (const p of decodePolyline(enc)) {
        pushUniqueTail(out, p);
      }
    }
  }
  if (out.length > 1) return out;
  const overview = route.overview_polyline?.points;
  if (overview) return decodePolyline(overview);
  return [];
}

async function fetchGoogleDirectionsJson(
  params: URLSearchParams,
): Promise<unknown> {
  const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return res.json();
}

/**
 * Google Directions driving route. We avoid `departure_time` / `traffic_model` on the first
 * request — those can make the API return errors for some keys, regions, or products.
 * Traffic-aware request is attempted only if the simple request fails.
 */
async function fetchGoogleDrivingRoute(
  from: LatLng,
  to: LatLng,
  apiKey: string,
): Promise<LatLng[] | null> {
  const origin = `${from.latitude},${from.longitude}`;
  const destination = `${to.latitude},${to.longitude}`;

  const base = new URLSearchParams({
    origin,
    destination,
    mode: "driving",
    key: apiKey,
  });

  try {
    type GRoute = Parameters<typeof latLngFromGoogleRoute>[0];

    let data = (await fetchGoogleDirectionsJson(base)) as {
      status?: string;
      routes?: GRoute[];
      error_message?: string;
    };

    if (data.status !== "OK" || !data.routes?.[0]) {
      const withTraffic = new URLSearchParams(base);
      withTraffic.set(
        "departure_time",
        String(Math.floor(Date.now() / 1000)),
      );
      withTraffic.set("traffic_model", "best_guess");
      data = (await fetchGoogleDirectionsJson(withTraffic)) as typeof data;
    }

    if (data.status !== "OK" || !data.routes?.[0]) return null;

    const pts = latLngFromGoogleRoute(data.routes[0]);
    return pts.length > 1 ? pts : null;
  } catch {
    return null;
  }
}

const OSRM_BASES = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-car",
] as const;

async function fetchOSRMDrivingRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  const path = `/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;

  for (const base of OSRM_BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (
        data.code === "Ok" &&
        data.routes?.[0]?.geometry?.coordinates?.length > 0
      ) {
        return data.routes[0].geometry.coordinates.map(
          ([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon }),
        );
      }
    } catch {
      /* try next */
    }
  }
  return [from, to];
}

const mapsKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
  "";

/**
 * Road-following route (pickup → delivery).
 * 1) Supabase `driving-route` edge function (fixes iOS + restricted keys)
 * 2) Direct Google Directions with EXPO_PUBLIC key (often works on Android)
 * 3) OSRM public mirrors
 * 4) Straight segment between endpoints
 */
export async function fetchDrivingRoute(
  from: LatLng,
  to: LatLng,
): Promise<LatLng[]> {
  const proxied = await fetchDrivingRouteViaSupabase(from, to);
  if (proxied && proxied.length > 1) return proxied;

  if (mapsKey.trim()) {
    const googlePts = await fetchGoogleDrivingRoute(from, to, mapsKey.trim());
    if (googlePts && googlePts.length > 1) return googlePts;
  }
  const osrm = await fetchOSRMDrivingRoute(from, to);
  if (osrm.length > 1) return osrm;
  return [from, to];
}
