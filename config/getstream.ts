// GetStream Configuration
export const GETSTREAM_CONFIG = {
  // You'll need to get these from your GetStream dashboard
  // Visit: https://getstream.io/video/
  apiKey: "8hw987thehq4", // Replace with your actual API key
  appId: "1416028", // Replace with your actual App ID

  // Environment settings
  environment: __DEV__ ? "development" : "production",

  // Default stream settings
  defaultStreamSettings: {
    audio: {
      mic_default_on: true,
      speaker_default_on: true,
      default_device: "speaker",
    },
    video: {
      camera_default_on: true,
      camera_facing: "front" as const,
    },
    recording: {
      mode: "disabled" as const,
    },
    screensharing: {
      enabled: false,
    },
  },

  // Call settings
  callSettings: {
    ring: true,
    video: true,
    audio: true,
    notify: true,
  },
};

// Stream user configuration
export interface StreamUser {
  id: string;
  name: string;
  image?: string;
  custom?: Record<string, any>;
}

// Stream call types
export const CALL_TYPES = {
  LIVESTREAM: "livestream",
  DEFAULT: "default",
} as const;

export type CallType = (typeof CALL_TYPES)[keyof typeof CALL_TYPES];
