import type {
  StreamVideoClient,
  User,
} from "@stream-io/video-react-native-sdk";
import { GETSTREAM_CONFIG, StreamUser } from "../config/getstream";

type StreamSdkModule = typeof import("@stream-io/video-react-native-sdk");

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
    (detailedError as any).cause = error;
    throw detailedError;
  }
};

class GetStreamService {
  private client: StreamVideoClient | null = null;
  private currentUser: User | null = null;

  // Initialize GetStream client
  async initialize(
    user: StreamUser,
    token: string
  ): Promise<StreamVideoClient> {
    try {
      const { StreamVideoClient: StreamVideoClientClass } =
        await loadStreamSdk();
      this.currentUser = {
        id: user.id,
        name: user.name,
        image: user.image,
        custom: user.custom,
      };

      this.client = new StreamVideoClientClass({
        apiKey: GETSTREAM_CONFIG.apiKey,
        user: this.currentUser,
        token,
      });

      return this.client;
    } catch (error) {
      console.error("Failed to initialize GetStream:", error);
      throw error;
    }
  }

  // Create a livestream
  async createLivestream(callId: string, title: string): Promise<any> {
    if (!this.client) {
      throw new Error("GetStream client not initialized");
    }

    try {
      const call = this.client.call("livestream", callId);

      await call.getOrCreate({
        data: {
          custom: {
            title,
            description: "Live streaming with GetStream",
          },
        },
      });

      return call;
    } catch (error) {
      console.error("Failed to create livestream:", error);
      throw error;
    }
  }

  // Join an existing livestream as viewer
  async joinLivestream(callId: string): Promise<any> {
    if (!this.client) {
      throw new Error("GetStream client not initialized");
    }

    try {
      const call = this.client.call("livestream", callId);
      await call.join();
      return call;
    } catch (error) {
      console.error("Failed to join livestream:", error);
      throw error;
    }
  }

  // Start broadcasting (for streamers)
  async startBroadcasting(call: any): Promise<void> {
    try {
      await call.goLive();
    } catch (error) {
      console.error("Failed to start broadcasting:", error);
      throw error;
    }
  }

  // Stop broadcasting
  async stopBroadcasting(call: any): Promise<void> {
    try {
      await call.stopLive();
      await call.leave();
    } catch (error) {
      console.error("Failed to stop broadcasting:", error);
      throw error;
    }
  }

  // Leave a call/stream
  async leaveCall(call: any): Promise<void> {
    try {
      await call.leave();
    } catch (error) {
      console.error("Failed to leave call:", error);
      throw error;
    }
  }

  // Get active livestreams
  async getActiveLivestreams(): Promise<any[]> {
    if (!this.client) {
      throw new Error("GetStream client not initialized");
    }

    try {
      const response = await this.client.queryCalls({
        filter_conditions: {
          ongoing: true,
          type: "livestream",
        },
        sort: [{ field: "created_at", direction: -1 }],
        limit: 25,
      });

      return response.calls || [];
    } catch (error) {
      console.error("Failed to get active livestreams:", error);
      return [];
    }
  }

  // Disconnect the client
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      // Ensure we release native resources before dropping references.
      await this.client.disconnectUser();
    } catch (error) {
      console.error("Failed to disconnect GetStream client:", error);
    } finally {
      this.client = null;
      this.currentUser = null;
    }
  }

  // Get current client
  getClient(): StreamVideoClient | null {
    return this.client;
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }
}

// Export singleton instance
export const getStreamService = new GetStreamService();
export default getStreamService;
