// app/(users)/chat/[id].tsx
import { useUser } from "@/contexts/UserContext";
import users from "@/data/UserData";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// Enhanced function to get user data from multiple sources
const getUserData = async (identifier: string) => {
  try {
    // First, try to get from Supabase profiles table using multiple query approaches
    let profileData = null;
    let error = null;
    
    // Try direct ID match first (for UUID)
    const { data: idData, error: idError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', identifier)
      .maybeSingle(); // Use maybeSingle to avoid error when no match
    
    if (!idError && idData) {
      profileData = idData;
    } else {
      // Try phone number match (with and without +975)
      const cleanPhone = identifier.replace('+975', '');
      const { data: phoneData, error: phoneError } = await supabase
        .from('profiles')
        .select('*')
        .or(`phone.eq.${identifier},phone.eq.${cleanPhone}`)
        .maybeSingle();
      
      if (!phoneError && phoneData) {
        profileData = phoneData;
      }
    }
    
    if (profileData) {
      // Handle different possible column names from Supabase
      const username = profileData.name || 
                      profileData.username || 
                      profileData.full_name || 
                      profileData.display_name || 
                      `User ${profileData.phone}`;
      
      return {
        id: profileData.id,
        username: username,
        phone_number: profileData.phone,
        profileImg: profileData.avatar_url,
        full_name: profileData.full_name || profileData.name,
        name: profileData.name,
      };
    }
  } catch (e) {
    console.log('Supabase fetch failed, trying local data:', e);
  }
  
  // Fallback to local user data
  const cleanIdentifier = identifier.replace('+975', '');
  const user = Object.values(users).find(u => 
    u.phone_number === identifier || 
    u.phone_number === cleanIdentifier ||
    u.username === identifier ||
    u.username === cleanIdentifier
  );
  
  if (user) {
    return user;
  }
  
  // Return a basic user object instead of the demo data
  return {
    id: identifier,
    username: `User ${identifier}`,
    phone_number: identifier,
    profileImg: null,
  };
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
  const [chatPartnerData, setChatPartnerData] = useState<any>(null);
  const [isLoadingPartner, setIsLoadingPartner] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const isMongooseChat = typeof id === 'string' && id.startsWith('mongoose-');
  const mongooseName = isMongooseChat ? id.replace('mongoose-', '') : null;
  const chatPartnerId = Array.isArray(id) ? id[0] : id;

  // Load chat partner data
  useEffect(() => {
    const loadChatPartnerData = async () => {
      if (!chatPartnerId) return;
      
      setIsLoadingPartner(true);
      try {
        const partnerData = await getUserData(chatPartnerId as string);
        setChatPartnerData(partnerData);
      } catch (error) {
        console.error('Error loading chat partner data:', error);
        // Fallback to basic info
        setChatPartnerData({
          username: `User ${chatPartnerId}`,
          phone_number: chatPartnerId,
          id: chatPartnerId
        });
      } finally {
        setIsLoadingPartner(false);
      }
    };

    loadChatPartnerData();
  }, [chatPartnerId]);

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

    // Only fetch a limited number of recent messages for performance
    const MESSAGE_LIMIT = 200;

    const fetchInitialMessages = async () => {
      try {
        // Try to get the user's UUID from profiles table first. Cache it to avoid repeated fetches.
        if (!currentUserUUID) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', userPhone)
            .maybeSingle();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          } else {
            const userUUID = profileData?.id;
            console.log('User UUID from profiles:', userUUID);
            if (userUUID) setCurrentUserUUID(userUUID);
          }
        }

        const sender = currentUserUUID || userId;

        // Fetch only the most recent messages between the two users
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${sender},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${sender})`)
          .order('created_at', { ascending: true })
          .limit(MESSAGE_LIMIT);

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

    // Use incremental updates from realtime events instead of refetching all messages
    const channel = supabase
      .channel(`messages:${chatPartnerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        try {
          const newMessage = payload.new;

          // Only handle messages that involve this conversation
          if (!newMessage) return;

          const involvesUsers = (
            newMessage.sender_id === currentUserUUID || newMessage.receiver_id === currentUserUUID ||
            newMessage.sender_id === chatPartnerId || newMessage.receiver_id === chatPartnerId
          );

          if (!involvesUsers) return;

          // Append new message if not already present
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // Remove matching optimistic local message, if any. Best-effort match by content + created_at
          setLocalMessages(prev => {
            const hasExact = prev.some(m => m.id === newMessage.id);
            if (hasExact) return prev;

            const filtered = prev.filter(m => {
              if (!m.isOptimistic) return true;
              // If content and timestamp are same-ish, drop optimistic
              if (m.content === newMessage.content && Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 2000) {
                return false;
              }
              return true;
            });

            return filtered;
          });
        } catch (e) {
          console.error('Error processing realtime payload:', e);
        }
      })
      // Also listen for UPDATE so edits/read receipts can be applied incrementally
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new;
        if (!updated) return;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, chatPartnerId, currentUserUUID]);

  const chatPartnerName = useMemo(() => {
    if (isLoadingPartner) {
      return 'Loading...';
    }

    if (isMongooseChat && mongooseName) {
      return `${mongooseName} (Mongoose)`;
    }

    if (chatPartnerData) {
      // Prioritize actual names over phone numbers
      // Use the hierarchy: name -> username -> full_name -> display_name
      const name = chatPartnerData.name || 
                   chatPartnerData.username || 
                   chatPartnerData.full_name || 
                   chatPartnerData.display_name;
      
      // Only show phone number if no name is available or if it's a generic "User X" name
      if (name && name !== chatPartnerData.phone_number && !name.startsWith('User ')) {
        return name;
      }
      
      // If we only have phone number, try to format it nicely
      if (chatPartnerData.phone_number) {
        return `+975${chatPartnerData.phone_number}`;
      }
    }

    return 'Unknown User';
  }, [chatPartnerData, isMongooseChat, mongooseName, isLoadingPartner]);

  // Combine original messages with local messages
  const allMessages = useMemo(() => {
    // Merge and dedupe by id. Prefer server `messages` over `localMessages` when IDs collide.
    const map = new Map<string | number, any>();

    // Add server messages first
    for (const m of messages) {
      if (m && m.id != null) map.set(String(m.id), m);
    }

    // Add local messages only if id not present (optimistic temp ids preserved)
    for (const m of localMessages) {
      if (!m) continue;
      const key = String(m.id);
      if (!map.has(key)) map.set(key, m);
    }

    return Array.from(map.values());
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

  if (isLoadingPartner) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />
        
        {/* Loading Header */}
        <View className="flex-row items-center p-4 border-b border-gray-200 bg-white">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <View className="w-10 h-10 bg-gray-300 rounded-full items-center justify-center mr-3 animate-pulse">
            <Text className="text-gray-500 font-bold">...</Text>
          </View>
          
          <View className="flex-1">
            <View className="h-5 bg-gray-300 rounded animate-pulse mb-1" style={{width: '60%'}} />
            <View className="h-3 bg-gray-200 rounded animate-pulse" style={{width: '40%'}} />
          </View>
        </View>
        
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading chat...</Text>
        </View>
      </View>
    );
  }

  const handleSendMessage = async () => {
    console.log('=== SEND MESSAGE DEBUG ===');
    console.log('messageText:', messageText?.trim());
    console.log('currentUser object:', currentUser);
    console.log('chatPartnerData:', chatPartnerData);
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
    
    const messageContent = messageText.trim();
    
    // Create optimistic message for immediate UI update
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserUUID,
      receiver_id: chatPartnerId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      isOptimistic: true
    };

  // Add to local messages immediately for better UX
  setLocalMessages(prev => [...prev, optimisticMessage]);
  setMessageText("");

    try {
      // Reuse cached UUID when available to avoid extra DB roundtrip
      let senderUUID = currentUserUUID;

      if (!senderUUID) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', userPhone)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching user profile for sending:', profileError);
        } else {
          senderUUID = profileData?.id;
          if (senderUUID) setCurrentUserUUID(senderUUID);
        }
      }

      if (!senderUUID) {
        console.error('No UUID found for sender phone:', userPhone);
        // Remove optimistic message on error
        setLocalMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        return;
      }

      const messageData = {
        sender_id: senderUUID,
        receiver_id: chatPartnerId,
        content: messageContent,
        is_read: false,
      };

      console.log('Message data:', messageData);

      const { data, error } = await supabase.from('messages').insert([messageData]).select();

      if (error) {
        console.error('Error sending message:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        // Remove optimistic message on error
        setLocalMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      } else if (Array.isArray(data) && data[0]) {
        const serverMsg = data[0];
        console.log('Message sent successfully:', serverMsg);

        // Remove the optimistic message from localMessages (do not keep server message in both lists)
        setLocalMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));

        // Ensure the server message is present in the main messages list (dedupe)
        setMessages(prev => {
          if (prev.some(m => m.id === serverMsg.id)) return prev;
          return [...prev, serverMsg];
        });
      }
    } catch (e) {
      console.error('An exception occurred:', e);
      // Remove optimistic message on error
      setLocalMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    }
  };

  // Simulate typing indicator (you can extend this for real-time typing)
  const handleTextChange = (text: string) => {
    setMessageText(text);
    
    // Simple typing indicator simulation
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 2000);
    }
  };

  const renderMessage = (message: any, index: number) => {
    const isCurrentUser = currentUserUUID && message.sender_id === currentUserUUID;
    const isOptimistic = message.isOptimistic;
    const key = message.id != null ? String(message.id) : `idx-${index}`;

    return (
      <View key={key} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <View className={`max-w-[80%] px-4 py-2 rounded-2xl ${
          isCurrentUser ? 'bg-primary mr-2' : 'bg-gray-200 ml-2'
        } ${isOptimistic ? 'opacity-70' : ''}`}>
          <Text className={isCurrentUser ? 'text-white' : 'text-gray-800'}>
            {message.content}
          </Text>
          {isOptimistic && (
            <Text className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-200' : 'text-gray-500'}`}>
              Sending...
            </Text>
          )}
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
        
        {/* Profile Image or Avatar */}
        {chatPartnerData?.profileImg ? (
          <Image 
            source={chatPartnerData.profileImg} 
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <View className="w-10 h-10 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold">
              {chatPartnerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        <View className="flex-1">
          <Text className="font-semibold text-gray-800 text-lg">
            {chatPartnerName}
          </Text>
          
          {/* Online Status or Additional Info */}
          {isMongooseChat ? (
            <Text className="text-sm text-gray-500">Delivery Person</Text>
          ) : (
            <Text className="text-sm text-gray-500">
              {/* Show phone if we have a proper name, otherwise just show "User" */}
              {chatPartnerData?.name || chatPartnerData?.username || chatPartnerData?.full_name ? 
                (chatPartnerData.phone_number ? `+975${chatPartnerData.phone_number}` : 'User') : 
                'User'
              }
            </Text>
          )}
          
          {isTyping && (
            <Text className="text-sm text-green-500">typing...</Text>
          )}
        </View>
        
        {/* Optional: Add call or video call buttons */}
        <TouchableOpacity className="ml-2 p-2">
          <Ionicons name="call" size={20} color="#007AFF" />
        </TouchableOpacity>
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
            <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-4">
              <Text className="text-white font-bold text-xl">
                {chatPartnerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-gray-800 font-semibold text-lg mb-2">
              {chatPartnerName}
            </Text>
            <Text className="text-gray-500 text-center px-8">
              {/* Show a more natural message */}
              {chatPartnerName.startsWith('+975') || chatPartnerName === 'Unknown User' ?
                'No messages yet. Start the conversation!' :
                `No messages yet. Start the conversation with ${chatPartnerName}!`
              }
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
            onChangeText={handleTextChange}
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