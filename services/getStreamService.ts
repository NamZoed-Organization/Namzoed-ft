import type {
    Call,
    StreamVideoClient,
    User,
} from "@stream-io/video-react-native-sdk";

import { GETSTREAM_CONFIG } from "@/config/getstream";
import { supabase } from "@/lib/supabase";

type StreamSdkModule = typeof import("@stream-io/video-react-native-sdk");

type StreamIdentity = {
  id: string;
  name: string;
  image?: string | null;
  custom?: Record<string, unknown>;
};

/**
 * Strip JSON-unsafe control characters (U+0000 – U+001F) from a string.
 * These cause `SyntaxError: JSON Parse error` inside the Stream SDK.
 */
const stripControlChars = (value: string): string =>
  value.replace(/[\u0000-\u001F]/g, "");

const sanitizeString = (value: string | undefined | null): string | undefined => {
  if (value == null) return undefined;
  return stripControlChars(value);
};

const sanitizeRecord = (
  obj: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? stripControlChars(v) : v;
  }
  return out;
};

let cachedSdk: StreamSdkModule | null = null;

const loadStreamSdk = async (): Promise<StreamSdkModule> => {
  if (cachedSdk) {
    return cachedSdk;
  }

  try {
    cachedSdk = await import("@stream-io/video-react-native-sdk");
    return cachedSdk;
  } catch (error) {
    cachedSdk = null;
    const message =
      "GetStream native modules are unavailable. Install a development build to enable livestreaming.";
    const detailedError = new Error(message);
    (detailedError as Error & { cause?: unknown }).cause = error;
    throw detailedError;
  }
};

class GetStreamService {
  private client: StreamVideoClient | null = null;

  private currentUser: StreamIdentity | null = null;

  private async fetchToken(identity: StreamIdentity): Promise<string> {
    const payload = {
      user_id: stripControlChars(identity.id),
      name: stripControlChars(identity.name),
      username: stripControlChars(identity.name),
      image: identity.image ? stripControlChars(identity.image) : null,
    };

    const response = await supabase.functions.invoke<{
      token?: string;
      error?: string;
    }>("getstream-token", {
      body: payload,
    });

    if (response.error) {
      const { message, status } = response.error;
      const suffix = message ? `: ${message}` : "";
      const statusLabel = status ? ` (status ${status})` : "";
      throw new Error(`Failed to fetch Stream token${statusLabel}${suffix}`);
    }

    const token = response.data?.token;
    if (!token || typeof token !== "string") {
      throw new Error("Stream token response did not include a token.");
    }

    // Validate the token's payload is parseable (catches control-char corruption
    // before the Stream SDK tries and throws a cryptic JSON parse error).
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("not a valid JWT (expected 3 parts)");
      const decoded = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      JSON.parse(decoded); // will throw if control chars present
    } catch (parseErr) {
      throw new Error(
        `Stream token is malformed — the edge function returned a JWT whose payload cannot be parsed. ` +
        `Ensure GETSTREAM_SECRET is set correctly in Supabase and redeploy the getstream-token function. ` +
        `Details: ${parseErr}`
      );
    }

    return token;
  }

  private buildUser(identity: StreamIdentity): User {
    return {
      id: stripControlChars(identity.id),
      name: stripControlChars(identity.name),
      image: sanitizeString(identity.image ?? undefined),
      custom: sanitizeRecord(identity.custom),
    } as User;
  }

  async ensureClient(identity: StreamIdentity): Promise<StreamVideoClient> {
    if (this.client && this.currentUser?.id === identity.id) {
      return this.client;
    }

    const token = await this.fetchToken(identity);
    const { StreamVideoClient: StreamVideoClientClass } = await loadStreamSdk();

    if (this.client) {
      try {
        await this.client.disconnectUser();
      } catch {
        // ignore cleanup errors
      }
      this.client = null;
    }

    // v1.x requires creating the client first, then calling connectUser() explicitly.
    // Passing user + token to the constructor does NOT connect the user in v1.x.
    this.client = new StreamVideoClientClass({
      apiKey: GETSTREAM_CONFIG.apiKey,
    });

    await this.client.connectUser(this.buildUser(identity), token);

    this.currentUser = identity;
    return this.client;
  }

  getClient(): StreamVideoClient | null {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.disconnectUser();
    } catch (error) {
      console.error("Failed to disconnect GetStream client", error);
    } finally {
      this.client = null;
      this.currentUser = null;
    }
  }

  async createHostCall(
    identity: StreamIdentity,
    callId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<Call> {
    const client = await this.ensureClient(identity);
    const call = client.call("livestream", callId);

    await call.getOrCreate({
      data: {
        custom: metadata,
      },
    });

    await call.join({ create: true });
    return call;
  }

  async prepareViewerCall(
    identity: StreamIdentity,
    callId: string
  ): Promise<Call> {
    const client = await this.ensureClient(identity);
    const call = client.call("livestream", callId);
    try {
      await call.get();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This livestream is no longer available.";
      throw new Error(message);
    }
    return call;
  }
}

export const getStreamService = new GetStreamService();
export type { StreamIdentity };
export default getStreamService;
