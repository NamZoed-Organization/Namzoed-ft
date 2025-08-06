// app/(users)/chat/[id].tsx
import { useUser } from "@/contexts/UserContext";
import userData17123456 from "@/data/17123456";
import mongooses from "@/data/mongoose";
import users from "@/data/UserData";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const getUserData = (phoneNumber: string) => {
  return phoneNumber === "17123456" ? userData17123456 : null;
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

export default function ChatScreen() {
  const { currentUser } = useUser();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [messageText, setMessageText] = useState("");
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [messageCounter, setMessageCounter] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);

  const isMongooseChat = typeof id === 'string' && id.startsWith('mongoose-');
  const mongooseName = isMongooseChat ? id.replace('mongoose-', '') : null;

  const { messages, chatPartnerName } = useMemo(() => {
    if (!currentUser) {
      return {
        messages: [],
        chatPartnerName: 'Unknown'
      };
    }

    if (isMongooseChat && mongooseName && currentUser.phone_number) {
      const mongooseData = mongooses[mongooseName as keyof typeof mongooses];
      const userPhone = `+975${currentUser.phone_number}`;
      return {
        messages: (mongooseData?.clientChats as any)?.[userPhone] || [],
        chatPartnerName: `${mongooseName} (Mongoose)`
      };
    }

    const userData = getUserData(currentUser.phone_number || "");
    const phoneNumber = `+975${id}`;
    const user = Object.values(users).find(u => u.phone_number === id);
    const messagesObj = userData?.messages as Record<string, any[]>;
    
    return {
      messages: messagesObj?.[phoneNumber] || [],
      chatPartnerName: user?.username || phoneNumber
    };
  }, [id, isMongooseChat, mongooseName, currentUser]);

  // Combine original messages with local messages
  const allMessages = useMemo(() => {
    return [...messages, ...localMessages];
  }, [messages, localMessages]);

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

  if (!currentUser) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-gray-500">Please login to view messages</Text>
      </View>
    );
  }

  const simulateReply = (counter: number) => {
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      const replyMessage = {
        sender: isMongooseChat ? 'mongoose' : `+975${id}`,
        content: counter.toString(),
        timestamp: new Date().toISOString()
      };
      
      setLocalMessages(prev => [...prev, replyMessage]);
    }, 5000); // 5 seconds delay
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      // Add user message immediately
      const userMessage = {
        sender: isMongooseChat ? 'client' : `+975${currentUser.phone_number || ""}`,
        content: messageText.trim(),
        timestamp: new Date().toISOString()
      };
      
      setLocalMessages(prev => [...prev, userMessage]);
      setMessageText("");
      
      // Simulate reply after 5 seconds with typing indicator
      simulateReply(messageCounter);
      setMessageCounter(prev => prev + 1);
    }
  };

  const renderMessage = (message: any, index: number) => {
    const isCurrentUser = isMongooseChat 
      ? message.sender === 'client'
      : message.sender === `+975${currentUser.phone_number || ""}`;
    
    return (
      <View key={index} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <View className={`max-w-[80%] px-4 py-2 rounded-2xl ${
          isCurrentUser ? 'bg-primary mr-2' : 'bg-gray-200 ml-2'
        }`}>
          <Text className={isCurrentUser ? 'text-white' : 'text-gray-800'}>
            {message.content}
          </Text>
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

  return (
    <View className="flex-1 bg-background">
      {/* Fixed Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View className="w-10 h-10 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {chatPartnerName.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View className="flex-1">
          <Text className="font-semibold text-gray-800 text-lg">
            {chatPartnerName}
          </Text>
          {isMongooseChat && (
            <Text className="text-sm text-gray-500">Delivery Person</Text>
          )}
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

      {/* Fixed Input Bar - Above Bottom Navigation */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-row items-center p-4 border-t border-gray-200 bg-white mb-20">
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
    </View>
  );
}