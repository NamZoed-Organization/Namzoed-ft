// mongoose-chat/[chat].tsx
import { useUser } from "@/contexts/UserContext";
import mongooses from "@/data/mongoose";
import { Ionicons } from "@expo/vector-icons";
import {
    createAudioPlayer,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    type AudioPlayer,
    type AudioStatus,
} from 'expo-audio';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, Mic, Pause, Play, Send, Trash2 } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Keyboard,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MongooseMessage {
  sender: 'client' | 'mongoose';
  content: string;
  timestamp: Date;
  type?: 'text' | 'location' | 'voice';
  coordinates?: { latitude: number; longitude: number };
  voiceDuration?: number;
  voiceUri?: string;
}

// Voice message playback component
const VoiceMessagePlayer = ({
  duration,
  isCurrentUser,
  isPlaying,
  playbackPosition,
  onPlayPause
}: {
  duration: number;
  isCurrentUser: boolean;
  isPlaying: boolean;
  playbackPosition: number;
  onPlayPause: () => void;
}) => {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? playbackPosition / duration : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, minWidth: 180 }}>
      <TouchableOpacity
        onPress={onPlayPause}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
          backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
        }}
      >
        {isPlaying ? (
          <Pause size={14} color={isCurrentUser ? 'white' : '#111827'} strokeWidth={2} />
        ) : (
          <Play size={14} color={isCurrentUser ? 'white' : '#111827'} strokeWidth={2} />
        )}
      </TouchableOpacity>

      <View style={{ flex: 1, marginRight: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 22 }}>
          {Array.from({ length: 28 }).map((_, index) => {
            const segmentProgress = index / 28;
            const isActive = progress > segmentProgress;
            const height = 4 + (index % 5) * 2.5;
            return (
              <View
                key={index}
                style={{
                  width: 2,
                  height,
                  marginHorizontal: 1,
                  borderRadius: 1,
                  backgroundColor: isCurrentUser
                    ? (isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)')
                    : (isActive ? '#111827' : '#d1d5db'),
                }}
              />
            );
          })}
        </View>
      </View>

      <Text style={{
        fontSize: 11,
        color: isCurrentUser ? 'rgba(255,255,255,0.8)' : '#6b7280',
        fontWeight: '500',
        minWidth: 30,
        textAlign: 'right',
      }}>
        {isPlaying ? formatDuration(Math.floor(playbackPosition)) : formatDuration(duration)}
      </Text>
    </View>
  );
};

// Audio visualizer component
const AudioVisualizer = ({ duration, levels }: { duration: number; levels: number[] }) => {
  const formatDuration = (duration: number) => {
    const seconds = Math.floor(duration / 10);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f3f4f6',
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 10,
    }}>
      <View style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        marginRight: 8,
      }} />
      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600', marginRight: 10, minWidth: 32 }}>
        {formatDuration(duration)}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 24 }}>
        {levels.slice(-24).map((level, index) => (
          <View
            key={index}
            style={{
              width: 2,
              marginHorizontal: 1,
              borderRadius: 1,
              backgroundColor: '#374151',
              height: Math.max(3, level * 20),
              opacity: 0.4 + level * 0.6,
            }}
          />
        ))}
        {levels.length < 24 && Array.from({ length: 24 - levels.length }).map((_, index) => (
          <View
            key={`empty-${index}`}
            style={{ width: 2, marginHorizontal: 1, borderRadius: 1, backgroundColor: '#d1d5db', height: 3 }}
          />
        ))}
      </View>
    </View>
  );
};

// Typing indicator component
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    };
    animationRef.current = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ]);
    animationRef.current.start();
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []);

  return (
    <View style={{ marginBottom: 12, alignItems: 'flex-start' }}>
      <View style={{
        backgroundColor: '#f3f4f6',
        marginLeft: 42,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderBottomLeftRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: '#9ca3af',
              opacity: dot,
              transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
            }}
          />
        ))}
      </View>
    </View>
  );
};

export default function MongooseChatScreen() {
  const { currentUser } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams();
  const [messageText, setMessageText] = useState("");
  const [localMessages, setLocalMessages] = useState<MongooseMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [messageCounter, setMessageCounter] = useState(1);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'click' | 'hold' | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const audioPlayerSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const replyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Get mongoose name from route parameter
  const mongooseName = typeof name === 'string' ? name : '';

  // Get original messages and mongoose data
  const { originalMessages, chatPartnerName } = useMemo(() => {
    if (!mongooseName) {
      return { originalMessages: [], chatPartnerName: 'Unknown Mongoose' };
    }

    // Debug log to check the mongoose name
    console.log('Available mongooses:', Object.keys(mongooses));

    const mongooseData = mongooses[mongooseName as keyof typeof mongooses];
    // For demo, always use 17123456 phone number
    const demoPhone = '+97517123456';
    
    // Debug log to check if mongoose data exists
    if (mongooseData) {
      console.log('Client chats available:', Object.keys((mongooseData.clientChats as any) || {}));
    }
    
    const messages = (mongooseData?.clientChats as any)?.[demoPhone] || [];
    return {
      originalMessages: messages,
      chatPartnerName: mongooseData ? `${mongooseData.name} (Mongoose)` : `${mongooseName} (Mongoose)`
    };
  }, [mongooseName, currentUser?.phone_number]);

  // Combine original messages with local messages
  const allMessages = useMemo(() => {
    return [...originalMessages, ...localMessages];
  }, [originalMessages, localMessages]);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, keyboardWillShow);
    const hideListener = Keyboard.addListener(hideEvent, keyboardWillHide);

    return () => {
      showListener.remove();
      hideListener.remove();

      // Clean up reply timeout on unmount
      if (replyTimeoutRef.current) {
        clearTimeout(replyTimeoutRef.current);
        replyTimeoutRef.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [allMessages, isTyping]);

  // Also scroll when component mounts or messages change
  useEffect(() => {
    if (allMessages.length > 0) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [allMessages.length]);

  // Get current location and format for message
  const getCurrentLocation = async (): Promise<string | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to share your location.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      const locationText = `loc: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
      return locationText;
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please try again.');
      return null;
    }
  };

  // Handle location sharing - adds to text input
  const handleShareLocation = async () => {
    Alert.alert(
      'Share Location',
      'Do you want to share your current location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: async () => {
            const locationText = await getCurrentLocation();
            if (locationText) {
              setMessageText(locationText);
            }
          }
        }
      ]
    );
  };

  // Voice recording functions
  const startRecording = async (mode: 'click' | 'hold') => {
    try {
      // Prevent multiple recordings
      if (isRecording || recorder.isRecording) return;

      // Request audio permissions
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone permission to record voice messages.');
        return;
      }

      // Configure audio mode
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Create and start recording
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingMode(mode);
      setRecordingDuration(0);
      setAudioLevels([]);

      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
        // Simulate audio levels (random values between 0.1 and 1)
        setAudioLevels(prev => {
          const newLevels = [...prev, Math.random() * 0.9 + 0.1];
          return newLevels.slice(-50); // Keep last 50 levels
        });
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setRecordingMode(null);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recorder.isRecording) return;

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      const durationInSeconds = Math.max(
        1,
        Math.floor(recorder.getStatus().durationMillis / 1000)
      );

      await recorder.stop();
      const uri = recorder.uri;

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (uri) {
        const voiceMessage: MongooseMessage = {
          sender: 'client',
          content: `Voice message`,
          timestamp: new Date(),
          type: 'voice',
          voiceDuration: durationInSeconds,
          voiceUri: uri
        };

        setLocalMessages(prev => {
          const newMessages = [...prev, voiceMessage];
          return newMessages;
        });
        simulateReply();
      } else {
      }

      setIsRecording(false);
      setRecordingMode(null);
      setRecordingDuration(0);
      setAudioLevels([]);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setRecordingMode(null);
    }
  };

  const cancelRecording = async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {
      // Ignore audio mode reset errors while canceling.
    }

    setIsRecording(false);
    setRecordingMode(null);
    setRecordingDuration(0);
    setAudioLevels([]);
  };

  const sendVoiceMessage = async () => {
    if (isRecording && recordingMode === 'click') {
      await stopRecording();
    }
  };

  // Voice message playback functions
  const playVoiceMessage = async (messageIndex: number) => {
    const message = allMessages[messageIndex];
    if (!message || !message.voiceUri) {
      return;
    }

    if (playingMessageIndex === messageIndex) {
      // Pause current playback
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingMessageIndex(null);
      setPlaybackPosition(0);
    } else {
      // Stop any current playback
      if (audioPlayerSubscriptionRef.current) {
        audioPlayerSubscriptionRef.current.remove();
        audioPlayerSubscriptionRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }

      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });

        const player = createAudioPlayer({ uri: message.voiceUri }, { updateInterval: 200 });
        audioPlayerRef.current = player;
        setPlayingMessageIndex(messageIndex);
        setPlaybackPosition(0);

        audioPlayerSubscriptionRef.current = player.addListener(
          'playbackStatusUpdate',
          (status: AudioStatus) => {
            if (!status.isLoaded) return;

            setPlaybackPosition(status.currentTime);
            if (status.didJustFinish) {
              setPlayingMessageIndex(null);
              setPlaybackPosition(0);
              player.seekTo(0).catch(() => {
                // Ignore seek reset errors after playback completion.
              });
            }
          }
        );

        player.play();

      } catch (error) {
        console.error('Failed to play audio:', error);
        setPlayingMessageIndex(null);
        setPlaybackPosition(0);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      if (recorder.isRecording) {
        recorder.stop().catch(() => {
          // Ignore recorder cleanup errors on unmount.
        });
      }

      if (audioPlayerSubscriptionRef.current) {
        audioPlayerSubscriptionRef.current.remove();
        audioPlayerSubscriptionRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }
    };
  }, [recorder]);

  const simulateReply = () => {
    setIsTyping(true);

    // Clear previous timeout to prevent accumulation
    if (replyTimeoutRef.current) {
      clearTimeout(replyTimeoutRef.current);
    }

    replyTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      const replyMessage: MongooseMessage = {
        sender: 'mongoose',
        content: messageCounter.toString(),
        timestamp: new Date()
      };

      setLocalMessages(prev => [...prev, replyMessage]);
      setMessageCounter(prev => prev + 1);
      replyTimeoutRef.current = null;
    }, 5000); // 5 seconds delay
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      // Determine message type
      const isLocation = messageText.includes('loc:');
      let coordinates;
      
      if (isLocation) {
        const coordMatch = messageText.match(/loc: ([-\d.]+), ([-\d.]+)/);
        if (coordMatch) {
          coordinates = {
            latitude: parseFloat(coordMatch[1]),
            longitude: parseFloat(coordMatch[2])
          };
        }
      }

      // Add user message immediately
      const userMessage: MongooseMessage = {
        sender: 'client',
        content: messageText.trim(),
        timestamp: new Date(),
        type: isLocation ? 'location' : 'text',
        coordinates
      };
      
      setLocalMessages(prev => [...prev, userMessage]);
      setMessageText("");
      
      // Simulate reply after 5 seconds with typing indicator
      simulateReply();
    }
  };

  const renderMessage = (message: MongooseMessage, index: number) => {
    const isCurrentUser = message.sender === 'client';
    const nextMessage = allMessages[index + 1];
    const isLastInGroup = !nextMessage || nextMessage.sender !== message.sender;
    const prevMessage = allMessages[index - 1];
    const isFirstInGroup = !prevMessage || prevMessage.sender !== message.sender;

    const bubbleBorderRadius = isCurrentUser
      ? {
          borderTopLeftRadius: 18,
          borderTopRightRadius: isFirstInGroup ? 18 : 6,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: isLastInGroup ? 4 : 6,
        }
      : {
          borderTopLeftRadius: isFirstInGroup ? 18 : 6,
          borderTopRightRadius: 18,
          borderBottomLeftRadius: isLastInGroup ? 4 : 6,
          borderBottomRightRadius: 18,
        };

    return (
      <View key={index} style={{ marginBottom: isLastInGroup ? 10 : 2, alignItems: isCurrentUser ? 'flex-end' : 'flex-start' }}>
        <View style={{ flexDirection: isCurrentUser ? 'row-reverse' : 'row', alignItems: 'flex-end', maxWidth: '78%' }}>
          {/* Avatar — mongoose only, last in group */}
          {!isCurrentUser ? (
            isLastInGroup ? (
              <View style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 6,
                marginBottom: 2,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151' }}>
                  {mongooseName.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={{ width: 36 }} />
            )
          ) : null}

          {/* Bubble */}
          <View style={[
            {
              paddingHorizontal: message.type === 'voice' ? 12 : 14,
              paddingVertical: message.type === 'voice' ? 8 : 9,
              backgroundColor: isCurrentUser ? '#094569' : '#f3f4f6',
            },
            bubbleBorderRadius,
          ]}>
            {message.type === 'voice' ? (
              <VoiceMessagePlayer
                duration={message.voiceDuration || 0}
                isCurrentUser={isCurrentUser}
                isPlaying={playingMessageIndex === index}
                playbackPosition={playingMessageIndex === index ? playbackPosition : 0}
                onPlayPause={() => playVoiceMessage(index)}
              />
            ) : message.type === 'location' ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <MapPin size={14} color={isCurrentUser ? 'rgba(255,255,255,0.8)' : '#6b7280'} strokeWidth={1.5} style={{ marginTop: 1, marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isCurrentUser ? 'white' : '#111827', marginBottom: 2 }}>
                    Location
                  </Text>
                  <Text style={{ fontSize: 12, color: isCurrentUser ? 'rgba(255,255,255,0.75)' : '#6b7280', lineHeight: 16 }}>
                    {message.coordinates
                      ? `${message.coordinates.latitude.toFixed(5)}, ${message.coordinates.longitude.toFixed(5)}`
                      : message.content.replace('loc: ', '')}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: 15, color: isCurrentUser ? 'white' : '#111827', lineHeight: 20 }}>
                {message.content}
              </Text>
            )}
          </View>
        </View>

        {/* Timestamp — last in group only */}
        {isLastInGroup && (
          <Text style={{
            fontSize: 11,
            color: '#9ca3af',
            marginTop: 3,
            marginHorizontal: isCurrentUser ? 4 : 40,
          }}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    );
  };

  // Show login message if no current user
  if (!currentUser) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
        <Text style={{ color: '#9ca3af' }}>Please login to view messages</Text>
      </View>
    );
  }

  const inputBarBottom = keyboardHeight > 0
    ? keyboardHeight + (Platform.OS === 'android' ? 0 : 0)
    : insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>

      {/* Header */}
      <View style={{
        paddingTop: insets.top,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          height: 56,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 8, padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#e5e7eb',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151' }}>
              {mongooseName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
              {chatPartnerName}
            </Text>
            <Text style={{ fontSize: 12, color: isTyping ? '#16a34a' : '#9ca3af' }}>
              {isTyping ? 'typing...' : 'Delivery Person'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <View style={{ flex: 1, marginBottom: inputBarBottom + 58 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {allMessages.length > 0 ? (
            allMessages.map(renderMessage)
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>No messages yet. Start the conversation!</Text>
            </View>
          )}
          {isTyping && <TypingIndicator />}
        </ScrollView>
      </View>

      {/* Input bar */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: Math.max(inputBarBottom, 8),
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        minHeight: 58,
      }}>
        {/* Location / Cancel-recording button */}
        <TouchableOpacity
          onPress={isRecording ? cancelRecording : handleShareLocation}
          style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {isRecording ? (
            <Trash2 size={20} color="#ef4444" strokeWidth={1.75} />
          ) : (
            <MapPin size={20} color="#9ca3af" strokeWidth={1.75} />
          )}
        </TouchableOpacity>

        {/* Mic button */}
        {!isRecording && (
          <TouchableOpacity
            onPress={() => startRecording('click')}
            onLongPress={() => startRecording('hold')}
            onPressOut={() => { if (recordingMode === 'hold') stopRecording(); }}
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Mic size={20} color="#9ca3af" strokeWidth={1.75} />
          </TouchableOpacity>
        )}

        {/* Text input / audio visualizer */}
        {isRecording ? (
          <AudioVisualizer duration={recordingDuration} levels={audioLevels} />
        ) : (
          <View style={{
            flex: 1,
            minHeight: 38,
            maxHeight: 100,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 20,
            backgroundColor: '#f9fafb',
            paddingHorizontal: 14,
            paddingVertical: 8,
            justifyContent: 'center',
            marginRight: 8,
          }}>
            <TextInput
              style={{ fontSize: 15, color: '#111827', padding: 0, margin: 0 }}
              placeholder="Message..."
              placeholderTextColor="#9ca3af"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              textAlignVertical="center"
            />
          </View>
        )}

        {/* Send button */}
        <TouchableOpacity
          onPress={() => {
            if (isRecording && recordingMode === 'click') {
              sendVoiceMessage();
            } else if (messageText.trim()) {
              handleSendMessage();
            }
          }}
          disabled={!messageText.trim() && !(isRecording && recordingMode === 'click')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: (messageText.trim() || (isRecording && recordingMode === 'click')) ? '#094569' : '#e5e7eb',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} color="white" strokeWidth={2} style={{ marginLeft: 1 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
