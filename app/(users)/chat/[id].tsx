// app/(users)/chat/[id].tsx
import { useUser } from "@/contexts/UserContext";
import userData17123456 from "@/data/17123456";
import users from "@/data/UserData";
import { supabase } from "@/lib/supabase";
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
  // For demo purposes, always return the 17123456 data so chats show
  return userData17123456;
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
  const [messages, setMessages] = useState<any[]>([]);
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUserUUID, setCurrentUserUUID] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const isMongooseChat = typeof id === 'string' && id.startsWith('mongoose-');
  const mongooseName = isMongooseChat ? id.replace('mongoose-', '') : null;
  const chatPartnerId = Array.isArray(id) ? id[0] : id;

  // Fetch initial messages and subscribe to real-time updates
  useEffect(() => {
    const userPhone = currentUser?.phone_number || (currentUser as any)?.phone || (currentUser as any)?.phoneNumber || (currentUser as any)?.mobile;
    const userId = (currentUser as any)?.id || (currentUser as any)?.user_id || userPhone;
    
    console.log('=== FETCH MESSAGES DEBUG ===');
    console.log('currentUser:', currentUser);
    console.log('Available currentUser properties:', currentUser ? Object.keys(currentUser) : 'No currentUser');
    console.log('userPhone detected:', userPhone);
    console.log('userId detected:', userId);
    console.log('chatPartnerId:', chatPartnerId);
    
    if (!userId || !chatPartnerId) {
      console.log('Missing userId or chatPartnerId');
      return;
    }

    const fetchInitialMessages = async () => {
      try {
        // Try to get the user's UUID from profiles table first
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', userPhone)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          return;
        }

        const userUUID = profileData?.id;
        console.log('User UUID from profiles:', userUUID);
        setCurrentUserUUID(userUUID); // Store the UUID for message rendering

        if (!userUUID) {
          console.error('No UUID found for user phone:', userPhone);
          return;
        }

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userUUID},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${userUUID})`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
        } else {
          console.log('Messages fetched:', data?.length || 0);
          setMessages(data || []);
        }
      } catch (e) {
        console.error('An exception occurred:', e);
      }
    };

    fetchInitialMessages();

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        fetchInitialMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, chatPartnerId]);

  const chatPartnerName = useMemo(() => {
    if (!currentUser) {
      return 'Unknown';
    }

    if (isMongooseChat && mongooseName) {
      return `${mongooseName} (Mongoose)`;
    }

    const user = Object.values(users).find(u => 
      u.phone_number === chatPartnerId || 
      u.phone_number === (typeof chatPartnerId === 'string' ? chatPartnerId.replace('+975', '') : chatPartnerId)
    );
    return user?.username || chatPartnerId;
  }, [chatPartnerId, isMongooseChat, mongooseName, currentUser]);

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

  // Mark messages as read when new messages arrive
  useEffect(() => {
    const markAsRead = async () => {
      if (!currentUserUUID || !chatPartnerId) return;
      
      try {
        const { data, error } = await supabase.rpc('mark_messages_as_read', {
          sender_user_id: chatPartnerId,
          receiver_user_id: currentUserUUID
        });
        
        if (error) {
          console.error('Error marking messages as read:', error);
        }
      } catch (e) {
        console.error('An exception occurred:', e);
      }
    };

    markAsRead();
  }, [messages, currentUserUUID, chatPartnerId]);

  if (!currentUser) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-gray-500">Please login to view messages</Text>
      </View>
    );
  }

  const handleSendMessage = async () => {
    console.log('=== SEND MESSAGE DEBUG ===');
    console.log('messageText:', messageText?.trim());
    console.log('currentUser object:', currentUser);
    console.log('currentUser.phone_number:', currentUser?.phone_number);
    console.log('Available currentUser properties:', currentUser ? Object.keys(currentUser) : 'No currentUser');
    console.log('chatPartnerId:', chatPartnerId);
    
    // Try different possible phone number properties
    const userPhone = currentUser?.phone_number || (currentUser as any)?.phone || (currentUser as any)?.phoneNumber || (currentUser as any)?.mobile;
    console.log('Detected userPhone:', userPhone);
    
    if (!messageText.trim() || !userPhone || !chatPartnerId) {
      console.log('Missing required fields for sending message');
      console.log('messageText exists:', !!messageText.trim());
      console.log('userPhone exists:', !!userPhone);
      console.log('chatPartnerId exists:', !!chatPartnerId);
      return;
    }

    console.log('Attempting to send message...');
    try {
      // Get the user's UUID from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', userPhone)
        .single();

      if (profileError) {
        console.error('Error fetching user profile for sending:', profileError);
        return;
      }

      const userUUID = profileData?.id;
      console.log('Sender UUID from profiles:', userUUID);

      if (!userUUID) {
        console.error('No UUID found for sender phone:', userPhone);
        return;
      }

      const messageData = {
        sender_id: userUUID,
        receiver_id: chatPartnerId, // This should already be a UUID from the search
        content: messageText.trim(),
        is_read: false,
      };
      
      console.log('Message data:', messageData);
      
      const { data, error } = await supabase.from('messages').insert([messageData]);

      if (error) {
        console.error('Error sending message:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('Message sent successfully:', data);
        setMessageText("");
      }
    } catch (e) {
      console.error('An exception occurred:', e);
    }
  };

  const renderMessage = (message: any, index: number) => {
    const isCurrentUser = currentUserUUID && message.sender_id === currentUserUUID;
    
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
          {message.created_at ? new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          }) : new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

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
            onPress={() => {
              console.log('Send button pressed!');
              handleSendMessage();
            }}
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