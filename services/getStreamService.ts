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
      user_id: identity.id,
      name: identity.name,
      username: identity.name,
      image: identity.image ?? null,
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
    if (!token) {
      throw new Error("Stream token response did not include a token.");
    }

    return token;
  }

  private buildUser(identity: StreamIdentity): User {
    return {
      id: identity.id,
      name: identity.name,
      image: identity.image ?? undefined,
      custom: identity.custom,
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
    }

    this.client = new StreamVideoClientClass({
      apiKey: GETSTREAM_CONFIG.apiKey,
      user: this.buildUser(identity),
      token,
    });

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
      console.warn("Unable to fetch livestream metadata", error);
    }
    return call;
  }
}

export const getStreamService = new GetStreamService();
export type { StreamIdentity };
export default getStreamService;
