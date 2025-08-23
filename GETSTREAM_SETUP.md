# GetStream Integration Setup Guide

This guide explains how to set up and configure GetStream for professional live streaming in your Namzoed app.

## Prerequisites

1. **GetStream Account**: Sign up at [GetStream.io](https://getstream.io/video/)
2. **API Keys**: Get your API key and App ID from the GetStream dashboard
3. **Backend Server**: Set up token generation on your backend (recommended)

## Installation

The required packages have been installed:

```bash
npm install @stream-io/video-react-native-sdk
npm install @stream-io/react-native-webrtc react-native-incall-manager @react-native-community/netinfo
npx pod-install  # For iOS
```

## Configuration

### 1. Update GetStream Configuration

Edit `/config/getstream.ts` and replace the placeholder values:

```typescript
export const GETSTREAM_CONFIG = {
  apiKey: "YOUR_ACTUAL_API_KEY", // Get from GetStream dashboard
  appId: "YOUR_ACTUAL_APP_ID", // Get from GetStream dashboard
  environment: __DEV__ ? "development" : "production",
  // ... rest of config
};
```

### 2. Backend Token Generation (Recommended)

**Important**: In production, user tokens should be generated on your backend server for security.

Create an API endpoint on your backend:

```javascript
// Backend API example (Node.js/Express)
const { StreamChat } = require("stream-chat");

app.post("/api/stream/token", async (req, res) => {
  const { userId } = req.body;

  const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_SECRET_KEY
  );

  const token = serverClient.createToken(userId);

  res.json({ token });
});
```

Then update the service to call your backend:

```typescript
// In getStreamService.ts
async generateUserToken(userId: string): Promise<string> {
  const response = await fetch('/api/stream/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  const { token } = await response.json();
  return token;
}
```

### 3. User Context Integration

Integrate with your existing user authentication:

```typescript
// In your user context/auth service
const currentUser = {
  id: user.id, // Your user ID
  name: user.displayName, // User's display name
  image: user.profilePicture, // User's profile picture URL
};
```

## Features Implemented

### 🔴 Live Streaming

- **Professional Broadcasting**: HD video quality with GetStream's global CDN
- **Real-time Controls**: Audio/video toggle, camera flip
- **Live Indicators**: Visual feedback showing streaming status
- **Viewer Analytics**: Real-time participant count

### 👥 Audience Interaction

- **Multi-viewer Support**: Unlimited viewers per stream
- **Real-time Chat**: Built-in chat functionality (can be extended)
- **Join/Leave Handling**: Seamless viewer experience

### 📱 Mobile Optimized

- **Battery Efficient**: Optimized for mobile battery usage
- **Network Adaptive**: Automatic quality adjustment based on connection
- **Background Handling**: Proper app lifecycle management

## Usage

### Starting a Stream

1. Navigate to Live tab
2. Toggle "Use GetStream (Professional)" in settings
3. Grant camera/microphone permissions
4. Wait for initialization
5. Tap "Go Live" to start broadcasting

### Viewing Streams

1. Use the "View Streams" button to see active streams
2. Join any stream to watch
3. Interact through built-in features

## Advanced Configuration

### Stream Quality Settings

```typescript
// In getstream.ts
const STREAM_SETTINGS = {
  video: {
    resolution: "720p", // 480p, 720p, 1080p
    fps: 30, // 15, 30, 60
    bitrate: 2000, // kbps
  },
  audio: {
    sampleRate: 44100, // Hz
    bitrate: 128, // kbps
  },
};
```

### Custom Layouts

```typescript
// Custom video layout for multiple participants
const customLayout = {
  spotlight: {
    participants_bar_position: "bottom",
    enable_jumping: true,
  },
  grid: {
    max_participants_per_page: 9,
  },
};
```

## Security Considerations

### 1. Token Security

- ✅ Generate tokens on backend server
- ✅ Use short-lived tokens (1-24 hours)
- ✅ Validate user permissions before token generation
- ❌ Never hardcode API secrets in client code

### 2. Stream Access Control

```typescript
// Example: Restrict stream creation to verified users
const canCreateStream = (user) => {
  return user.isVerified && user.hasStreamingPermission;
};
```

### 3. Content Moderation

```typescript
// Example: Add content filtering
const streamSettings = {
  moderation: {
    automod: true,
    banned_words: ["inappropriate", "spam"],
  },
};
```

## Troubleshooting

### Common Issues

1. **"Failed to initialize GetStream"**

   - Check API key and App ID in config
   - Verify internet connection
   - Check GetStream dashboard for account status

2. **"Camera permission denied"**

   - Guide users to Settings > Privacy > Camera
   - Request permissions before initializing stream

3. **Poor stream quality**

   - Check network connection
   - Reduce video quality settings
   - Close other apps consuming bandwidth

4. **Audio issues**
   - Check microphone permissions
   - Verify audio settings in GetStream config
   - Test with different devices

### Debug Mode

Enable debug logging:

```typescript
// Add to your app initialization
if (__DEV__) {
  console.log("GetStream Debug Mode Enabled");
  // Add debug listeners
}
```

## Production Checklist

- [ ] Replace demo API keys with production keys
- [ ] Implement backend token generation
- [ ] Set up user authentication integration
- [ ] Configure stream moderation rules
- [ ] Test on physical devices
- [ ] Set up monitoring and analytics
- [ ] Configure CDN settings for your region
- [ ] Implement error tracking (Sentry, Bugsnag)
- [ ] Add stream recording if needed
- [ ] Set up push notifications for stream events

## Cost Optimization

### GetStream Pricing Considerations

- **Free Tier**: 10,000 monthly minutes
- **Pay-as-you-go**: $0.0017 per minute
- **Team Plan**: 100,000 monthly minutes included

### Optimization Tips

1. **Stream Duration**: Monitor and limit stream durations
2. **Quality Settings**: Use appropriate quality for content type
3. **Viewer Limits**: Set reasonable limits for concurrent viewers
4. **Recording**: Only record when necessary
5. **Analytics**: Monitor usage patterns for optimization

## Next Steps

1. **Enhanced Chat**: Implement advanced chat features
2. **Stream Recording**: Add stream recording and playback
3. **Analytics Dashboard**: Create detailed streaming analytics
4. **Monetization**: Add paid streaming and donations
5. **Multi-streaming**: Broadcast to multiple platforms
6. **Interactive Features**: Polls, Q&A, screen sharing

## Support

- **GetStream Docs**: [https://getstream.io/video/docs/](https://getstream.io/video/docs/)
- **React Native SDK**: [https://getstream.io/video/docs/react-native/](https://getstream.io/video/docs/react-native/)
- **Community**: [GetStream Community](https://community.getstream.io/)
- **Support**: [GetStream Support](https://getstream.io/support/)

## Example Integration

For a complete example of GetStream integration with user authentication, see the implemented components:

- `/app/(users)/getstream-live.tsx` - Main streaming component
- `/services/getStreamService.ts` - Service layer
- `/config/getstream.ts` - Configuration
- `/app/(users)/live.tsx` - Toggle between basic and GetStream modes

This integration provides a solid foundation for professional live streaming in your marketplace application.
