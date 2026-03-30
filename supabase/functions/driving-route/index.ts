// @ts-nocheck
/**
 * driving-route — Supabase Edge Function
 *
 * Proxies Google Directions API so the app gets road polylines on iOS. Client-side
 * fetch to maps.googleapis.com with an "iOS apps"–restricted key fails; the key must
 * be used from a server (or be unrestricted).
 *
 * Deploy: `supabase functions deploy driving-route`
 * Secrets (Dashboard → Edge Functions → Secrets or CLI):
 *   GOOGLE_MAPS_API_KEY — Directions-enabled key; API restriction: Directions API only;
 *   application restriction: None (or your server/proxy pattern).
 */
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type LatLng = { latitude: number; longitude: number };

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

function routeToCoordinates(route: {
  legs?: { steps?: { polyline?: { points?: string } }[] }[];
  overview_polyline?: { points?: string };
}): LatLng[] {
  const out: LatLng[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const enc = step.polyline?.points;
      if (!enc) continue;
      for (const p of decodePolyline(enc)) {
        const prev = out[out.length - 1];
        if (
          !prev ||
          prev.latitude !== p.latitude ||
          prev.longitude !== p.longitude
        ) {
          out.push(p);
        }
      }
    }
  }
  if (out.length > 1) return out;
  const overview = route.overview_polyline?.points;
  return overview ? decodePolyline(overview) : [];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const googleKey =
    Deno.env.get("GOOGLE_MAPS_API_KEY") ??
    Deno.env.get("GOOGLE_MAPS_SERVER_KEY") ??
    "";
  if (!googleKey) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_MAPS_API_KEY secret" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const body = await req.json();
    const o = body?.origin;
    const d = body?.destination;
    if (
      typeof o?.latitude !== "number" ||
      typeof o?.longitude !== "number" ||
      typeof d?.latitude !== "number" ||
      typeof d?.longitude !== "number"
    ) {
      return new Response(JSON.stringify({ error: "Invalid origin/destination" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = `${o.latitude},${o.longitude}`;
    const destination = `${d.latitude},${d.longitude}`;
    const params = new URLSearchParams({
      origin,
      destination,
      mode: "driving",
      key: googleKey,
    });
    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    const gRes = await fetch(url);
    const data = await gRes.json();

    if (data.status !== "OK" || !data.routes?.[0]) {
      return new Response(
        JSON.stringify({
          error: "Directions failed",
          status: data.status,
          message: data.error_message ?? null,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const coordinates = routeToCoordinates(data.routes[0]);
    if (coordinates.length < 2) {
      return new Response(
        JSON.stringify({ error: "Empty route geometry" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ coordinates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
