// mongoose-chat/[chat].tsx
import { useUser } from "@/contexts/UserContext";
import mongooses from "@/data/mongoose";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from "expo-router";
import { Mic, Pause, Play, Trash2 } from "lucide-react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";

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
    <View className="flex-row items-center py-2 min-w-[200px]">
      <TouchableOpacity
        onPress={onPlayPause}
        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
          isCurrentUser ? 'bg-blue-600' : 'bg-gray-500'
        }`}
      >
        {isPlaying ? (
          <Pause size={16} color="white" />
        ) : (
          <Play size={16} color="white" />
        )}
      </TouchableOpacity>

      <View className="flex-1 mr-3">
        {/* Static waveform visualization */}
        <View className="flex-row items-center h-6">
          {Array.from({ length: 25 }).map((_, index) => {
            const segmentProgress = index / 25;
            const isActive = progress > segmentProgress;
            const height = 4 + (index % 4) * 2; // Static heights for consistent look

            return (
              <View
                key={index}
                className={`w-0.5 mx-0.5 rounded-full ${
                  isActive
                    ? (isCurrentUser ? 'bg-white' : 'bg-gray-700')
                    : (isCurrentUser ? 'bg-white bg-opacity-40' : 'bg-gray-400')
                }`}
                style={{ height }}
              />
            );
          })}
        </View>
      </View>

      {isPlaying && (
        <View className="ml-2 bg-gray-800 px-2 py-1 rounded-full">
          <Text className="text-xs text-white font-medium">
            {formatDuration(Math.floor(playbackPosition))}
          </Text>
        </View>
      )}
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
    <View className="flex-1 flex-row items-center bg-red-50 rounded-full px-4 py-2 mr-3">
      <Text className="text-red-600 font-medium mr-3">
        {formatDuration(duration)}
      </Text>
      <View className="flex-1 flex-row items-center justify-center h-8">
        {levels.slice(-20).map((level, index) => (
          <View
            key={index}
            className="bg-red-400 w-1 mx-0.5 rounded-full"
            style={{
              height: Math.max(4, level * 24),
              opacity: 0.3 + (level * 0.7)
            }}
          />
        ))}
        {levels.length < 20 && Array.from({ length: 20 - levels.length }).map((_, index) => (
          <View
            key={`empty-${index}`}
            className="bg-gray-300 w-1 mx-0.5 rounded-full h-1"
          />
        ))}
      </View>
      <View className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-3" />
    </View>
  );
};

// Typing indicator component
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      const animateDot = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        );
      };

      Animated.parallel([
        animateDot(dot1, 0),
        animateDot(dot2, 200),
        animateDot(dot3, 400),
      ]).start();
    };

    animate();
  }, []);

  return (
    <View className="mb-3 items-start">
      <View className="bg-gray-200 ml-2 px-4 py-3 rounded-2xl max-w-[80%]">
        <View className="flex-row items-center space-x-1">
          <Animated.View
            className="w-2 h-2 bg-gray-500 rounded-full"
            style={{
              opacity: dot1,
              transform: [
                {
                  scale: dot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            }}
          />
          <Animated.View
            className="w-2 h-2 bg-gray-500 rounded-full ml-1"
            style={{
              opacity: dot2,
              transform: [
                {
                  scale: dot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            }}
          />
          <Animated.View
            className="w-2 h-2 bg-gray-500 rounded-full ml-1"
            style={{
              opacity: dot3,
              transform: [
                {
                  scale: dot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            }}
          />
        </View>
      </View>
    </View>
  );
};

export default function MongooseChatScreen() {
  const { currentUser } = useUser();
  const router = useRouter();
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
  const recordingIntervalRef = useRef<number | null>(null);
  const playbackIntervalRef = useRef<number | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Get mongoose name from route parameter
  const mongooseName = typeof name === 'string' ? name : '';

  // Get original messages and mongoose data
  const { originalMessages, chatPartnerName } = useMemo(() => {
    if (!mongooseName) {
      return { originalMessages: [], chatPartnerName: 'Unknown Mongoose' };
    }

    // Debug log to check the mongoose name
    console.log('Looking for mongoose:', mongooseName);
    console.log('Available mongooses:', Object.keys(mongooses));

    const mongooseData = mongooses[mongooseName as keyof typeof mongooses];
    // For demo, always use 17123456 phone number
    const demoPhone = '+97517123456';
    
    // Debug log to check if mongoose data exists
    console.log('Mongoose data found:', !!mongooseData);
    console.log('Demo phone:', demoPhone);
    
    if (mongooseData) {
      console.log('Client chats available:', Object.keys((mongooseData.clientChats as any) || {}));
    }
    
    const messages = (mongooseData?.clientChats as any)?.[demoPhone] || [];
    console.log('Found messages:', messages.length, 'for mongoose', mongooseName);
    
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
      const locationText = `📍 Location: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
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
      if (isRecording) return;

      console.log(`Starting recording in ${mode} mode...`);

      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone permission to record voice messages.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
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

  const stopRecording = async (shouldSend: boolean = false) => {
    try {
      console.log('Stopping recording...', { shouldSend, recordingMode, isRecording });

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      if (recordingRef.current) {
        const result = await recordingRef.current.stopAndUnloadAsync();
        console.log('Recording stopped, result:', result);
        const uri = result?.uri;

        if (uri) {
          console.log('Got URI:', uri);
          const durationInSeconds = Math.max(1, Math.floor(recordingDuration / 10));
          const voiceMessage: MongooseMessage = {
            sender: 'client',
            content: `Voice message`,
            timestamp: new Date(),
            type: 'voice',
            voiceDuration: durationInSeconds,
            voiceUri: uri
          };

          console.log('Adding voice message:', voiceMessage);
          setLocalMessages(prev => {
            const newMessages = [...prev, voiceMessage];
            console.log('Updated messages:', newMessages);
            return newMessages;
          });
          simulateReply();
        } else {
          console.log('No URI in result:', result);
        }

        recordingRef.current = null;
      } else {
        console.log('No recording ref found');
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
    console.log('Cancelling recording...');

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }

    setIsRecording(false);
    setRecordingMode(null);
    setRecordingDuration(0);
    setAudioLevels([]);
  };

  const sendVoiceMessage = async () => {
    console.log('Send voice message called', { isRecording, recordingMode });
    if (isRecording && recordingMode === 'click') {
      await stopRecording(true);
    }
  };

  // Voice message playback functions
  const playVoiceMessage = async (messageIndex: number, duration: number) => {
    console.log('Voice message tapped:', { messageIndex, duration, currentlyPlaying: playingMessageIndex });

    const message = allMessages[messageIndex];
    if (!message || !message.voiceUri) {
      console.log('No voice URI found for message');
      return;
    }

    if (playingMessageIndex === messageIndex) {
      // Pause current playback
      console.log('Pausing playback');
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setPlayingMessageIndex(null);
      setPlaybackPosition(0);
    } else {
      // Stop any current playback
      console.log('Starting new playback');
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }

      try {
        // Load and play the audio
        const { sound } = await Audio.Sound.createAsync(
          { uri: message.voiceUri },
          { shouldPlay: true }
        );

        soundRef.current = sound;
        setPlayingMessageIndex(messageIndex);
        setPlaybackPosition(0);

        // Set up playback status listener
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              // Playback finished
              console.log('Playback finished');
              setPlayingMessageIndex(null);
              setPlaybackPosition(0);
              if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
              }
            } else if (status.positionMillis !== undefined && status.durationMillis !== undefined) {
              setPlaybackPosition(status.positionMillis / 1000); // Convert to seconds
            }
          }
        });

        console.log('Playing audio...');
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
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const simulateReply = () => {
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      const replyMessage: MongooseMessage = {
        sender: 'mongoose',
        content: messageCounter.toString(),
        timestamp: new Date()
      };
      
      setLocalMessages(prev => [...prev, replyMessage]);
      setMessageCounter(prev => prev + 1);
    }, 5000); // 5 seconds delay
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      // Determine message type
      const isLocation = messageText.includes('📍 Location:');
      let coordinates;
      
      if (isLocation) {
        // Extract coordinates from location message
        const coordMatch = messageText.match(/📍 Location: ([-\d.]+), ([-\d.]+)/);
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

    // Check if this is the last message in a consecutive group from the same sender
    const nextMessage = allMessages[index + 1];
    const isLastInGroup = !nextMessage || nextMessage.sender !== message.sender;

    return (
      <View key={index} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <View className={`flex-row ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} items-end max-w-[80%]`}>
          {/* Avatar - only show for mongoose (not user) */}
          {!isCurrentUser && isLastInGroup && (
            <View className="w-8 h-8 bg-blue-400 rounded-full items-center justify-center mr-2 mb-1">
              <Text className="text-white text-xs font-bold">
                {mongooseName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Message bubble */}
          <View className={`px-4 py-2 rounded-2xl ${
            isCurrentUser ? 'bg-blue-500' : 'bg-gray-300'
          } ${!isLastInGroup ? (isCurrentUser ? 'mr-10' : 'ml-10') : ''}`}>
            {message.type === 'voice' ? (
              <VoiceMessagePlayer
                duration={message.voiceDuration || 0}
                isCurrentUser={isCurrentUser}
                isPlaying={playingMessageIndex === index}
                playbackPosition={playingMessageIndex === index ? playbackPosition : 0}
                onPlayPause={() => playVoiceMessage(index, message.voiceDuration || 0)}
              />
            ) : message.type === 'location' ? (
              <View>
                <Text className={isCurrentUser ? 'text-white font-medium' : 'text-black font-medium'}>
                  📍 Location Shared
                </Text>
                <Text className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-700'}`}>
                  {message.coordinates ?
                    `${message.coordinates.latitude.toFixed(6)}, ${message.coordinates.longitude.toFixed(6)}`
                    : message.content.replace('📍 Location: ', '')}
                </Text>
              </View>
            ) : (
              <Text className={isCurrentUser ? 'text-white' : 'text-black'}>
                {message.content}
              </Text>
            )}
          </View>
        </View>

        {/* Timestamp */}
        <Text className={`text-xs text-gray-500 mt-1 ${isCurrentUser ? 'mr-2' : 'ml-2'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

  // Show login message if no current user
  if (!currentUser) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-gray-500">Please login to view messages</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

      {/* Fixed Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>

        <View className="w-10 h-10 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {mongooseName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <Text className="font-semibold text-gray-800 text-lg">
            {chatPartnerName}
          </Text>
          <Text className="text-sm text-gray-500">Delivery Person</Text>
          {isTyping && (
            <Text className="text-sm text-green-500">typing...</Text>
          )}
        </View>
      </View>

      {/* Scrollable Messages Area */}
      <View
        style={{
          flex: 1,
          marginBottom: keyboardHeight > 0 ? keyboardHeight + 70 : 80
        }}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 py-2"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 20
          }}
        >
        {allMessages.length > 0 ? (
          allMessages.map(renderMessage)
        ) : (
          <View className="flex-1 items-center justify-center min-h-[200px]">
            <Text className="text-gray-500 text-center">
              No messages yet. Start the conversation!
            </Text>
          </View>
        )}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}
      </ScrollView>
      </View>

      {/* Fixed Input Bar with Location Button - Above Bottom Navigation */}
      <View
        className="flex-row items-center justify-center px-4 py-3 border-t border-gray-200 bg-white"
        style={{
          marginBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 80,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: 60
        }}
      >
          {/* Location/Trash Button */}
          <TouchableOpacity
            onPress={isRecording ? cancelRecording : handleShareLocation}
            className="w-10 h-10 items-center justify-center mr-3"
          >
            {isRecording ? (
              <Trash2 size={24} color="#ef4444" />
            ) : (
              <Ionicons name="location" size={24} color="#3b82f6" />
            )}
          </TouchableOpacity>

          {/* Microphone Button - Click and Hold modes */}
          <TouchableOpacity
            onPress={() => {
              if (!isRecording) {
                startRecording('click');
              }
            }}
            onLongPress={() => {
              if (!isRecording) {
                startRecording('hold');
              }
            }}
            onPressOut={() => {
              if (recordingMode === 'hold') {
                stopRecording();
              }
            }}
            className="w-10 h-10 items-center justify-center mr-3"
            disabled={isRecording}
          >
            <Mic size={24} color="#22c55e" />
          </TouchableOpacity>

          {/* Text Input or Audio Visualizer */}
          {isRecording ? (
            <AudioVisualizer duration={recordingDuration} levels={audioLevels} />
          ) : (
            <TextInput
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 mr-3 min-h-[40px] max-h-[100px]"
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              textAlignVertical="center"
            />
          )}

          {/* Send Button */}
          <TouchableOpacity
            onPress={() => {
              if (isRecording && recordingMode === 'click') {
                console.log('Sending voice message via button');
                sendVoiceMessage();
              } else if (messageText.trim()) {
                console.log('Sending text message');
                handleSendMessage();
              }
            }}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              (messageText.trim() || (isRecording && recordingMode === 'click')) ? 'bg-blue-500' : 'bg-gray-300'
            }`}
            disabled={!messageText.trim() && !(isRecording && recordingMode === 'click')}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
    </View>
  );
}