// mongoose-chat/[chat].tsx
import { useUser } from "@/contexts/UserContext";
import mongooses from "@/data/mongoose";
import { Ionicons } from "@expo/vector-icons";
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

interface MongooseMessage {
  sender: 'client' | 'mongoose';
  content: string;
  timestamp: Date;
  type?: 'text' | 'location';
  coordinates?: { latitude: number; longitude: number };
}

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
  const scrollViewRef = useRef<ScrollView>(null);

  // Get mongoose name from route parameter
  const mongooseName = typeof name === 'string' ? name : '';

  // Get original messages and mongoose data
  const { originalMessages, chatPartnerName } = useMemo(() => {
    if (!mongooseName || !currentUser?.phone_number) {
      return { originalMessages: [], chatPartnerName: 'Unknown Mongoose' };
    }

    // Debug log to check the mongoose name
    console.log('Looking for mongoose:', mongooseName);
    console.log('Available mongooses:', Object.keys(mongooses));

    const mongooseData = mongooses[mongooseName as keyof typeof mongooses];
    const userPhone = `+975${currentUser.phone_number}`;
    
    // Debug log to check if mongoose data exists
    console.log('Mongoose data found:', !!mongooseData);
    console.log('User phone:', userPhone);
    
    if (mongooseData) {
      console.log('Client chats available:', Object.keys((mongooseData.clientChats as any) || {}));
    }
    
    return {
      originalMessages: (mongooseData?.clientChats as any)?.[userPhone] || [],
      chatPartnerName: mongooseData ? `${mongooseData.name} (Mongoose)` : `${mongooseName} (Mongoose)`
    };
  }, [mongooseName, currentUser?.phone_number]);

  // Combine original messages with local messages
  const allMessages = useMemo(() => {
    return [...originalMessages, ...localMessages];
  }, [originalMessages, localMessages]);

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
    
    return (
      <View key={index} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <View className={`max-w-[80%] px-4 py-2 rounded-2xl ${
          isCurrentUser ? 'bg-primary mr-2' : 'bg-gray-200 ml-2'
        }`}>
          {message.type === 'location' ? (
            <View>
              <Text className={isCurrentUser ? 'text-white font-medium' : 'text-gray-800 font-medium'}>
                📍 Location Shared
              </Text>
              <Text className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-600'}`}>
                {message.coordinates ? 
                  `${message.coordinates.latitude.toFixed(6)}, ${message.coordinates.longitude.toFixed(6)}` 
                  : message.content.replace('📍 Location: ', '')}
              </Text>
            </View>
          ) : (
            <Text className={isCurrentUser ? 'text-white' : 'text-gray-800'}>
              {message.content}
            </Text>
          )}
        </View>
        <Text className="text-xs text-gray-500 mt-1 mx-2">
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
    <SafeAreaView className="flex-1 bg-background">
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
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 px-4 py-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 10 }}
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

      {/* Fixed Input Bar with Location Button - Above Bottom Navigation */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-row items-center p-4 border-t border-gray-200 bg-white mb-20">
          <TouchableOpacity
            onPress={handleShareLocation}
            className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center mr-3"
          >
            <Ionicons name="location" size={20} color="white" />
          </TouchableOpacity>
          
          <TextInput
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 mr-3 min-h-[40px] max-h-[100px]"
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            textAlignVertical="center"
          />
          
          <TouchableOpacity
            onPress={handleSendMessage}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              messageText.trim() ? 'bg-primary' : 'bg-gray-300'
            }`}
            disabled={!messageText.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}