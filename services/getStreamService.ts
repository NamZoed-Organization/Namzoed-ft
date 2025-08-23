import { StreamVideoClient, User } from "@stream-io/video-react-native-sdk";
import { GETSTREAM_CONFIG, StreamUser } from "../config/getstream";

class GetStreamService {
  private client: StreamVideoClient | null = null;
  private currentUser: User | null = null;

  // Initialize GetStream client
  async initialize(
    user: StreamUser,
    token: string
  ): Promise<StreamVideoClient> {
    try {
      this.currentUser = {
        id: user.id,
        name: user.name,
        image: user.image,
        custom: user.custom,
      };

      this.client = new StreamVideoClient({
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

  // Generate a user token (this should be done on your backend)
  generateUserToken(userId: string): string {
    // WARNING: This is for development only!
    // In production, tokens should be generated on your backend
    console.warn(
      "Generating user token on client side - this should be done on the backend in production!"
    );

    // For now, return a mock token
    // You'll need to implement proper token generation on your backend
    return `mock_token_${userId}_${Date.now()}`;
  }

  // Disconnect the client
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        this.client = null;
        this.currentUser = null;
      } catch (error) {
        console.error("Failed to disconnect GetStream client:", error);
      }
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
