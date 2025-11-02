// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { StreamClient } from "npm:@stream-io/node-sdk@0.7.0";

type TokenRequest = {
  user_id?: string;
  username?: string;
  name?: string;
  image?: string | null;
};

let API_KEY = Deno.env.get("GETSTREAM_API_KEY");
let API_SECRET = Deno.env.get("GETSTREAM_SECRET");

if (!API_KEY || !API_SECRET) {
  console.error("Missing GetStream credentials in Supabase environment.");
}

serve(async (req) => {
  // Lazily re-read environment variables so hot reloads pick up updates.
  if (!API_KEY || !API_SECRET) {
    API_KEY = Deno.env.get("GETSTREAM_API_KEY");
    API_SECRET = Deno.env.get("GETSTREAM_SECRET");
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!API_KEY || !API_SECRET) {
    return new Response(
      JSON.stringify({ error: "GetStream credentials are not configured." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      console.error("getstream-token: request body empty");
      return new Response(
        JSON.stringify({
          error: "Request body is empty; expected JSON payload.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let payload: TokenRequest;

    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(
        "getstream-token: invalid JSON payload",
        parseError,
        rawBody
      );
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload; must be valid JSON." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!payload?.user_id || typeof payload.user_id !== "string") {
      console.error(
        "getstream-token: missing or invalid user_id",
        JSON.stringify(payload)
      );
      return new Response(
        JSON.stringify({ error: "Missing user_id in request body." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const streamClient = new StreamClient(API_KEY, API_SECRET);

    const streamUser = {
      user_id: payload.user_id,
      name: payload.name ?? payload.username ?? payload.user_id,
      image: payload.image ?? undefined,
    };

    const token = streamClient.generateUserToken(streamUser);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to generate GetStream token", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate GetStream token." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
