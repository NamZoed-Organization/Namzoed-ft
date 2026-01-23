// app/(users)/chat/[id].tsx
import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import ChatAudioRecorder from "@/components/chat/ChatAudioRecorder";
import ChatImagePicker from "@/components/chat/ChatImagePicker";
import { useUser } from "@/contexts/UserContext";
import users from "@/data/UserData";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Add this User type extension if not already present
type User = {
  id: string;
  username?: string;
  name?: string;
  full_name?: string;
  display_name?: string;
  phone?: string;
  phoneNumber?: string;
  mobile?: string;
  phone_number?: string; // <-- Add this line
  profileImg?: string | null;
};

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
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
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

    animationRef.current = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ]);

    animationRef.current.start();

    // CRITICAL: Stop animations on unmount to prevent memory leaks
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
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
  const [isAnimatingMongoose, setIsAnimatingMongoose] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bikeAnimationX = useRef(new Animated.Value(0)).current;

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
    
    if (!userPhone || !chatPartnerId) {
      console.log('⚠️ Missing user phone or chat partner ID');
      return;
    }

    let isSubscribed = true;
    const channelName = `chat_${chatPartnerId}_${Date.now()}`;

    const setupChatRealtime = async () => {
      try {
        // Get user UUID from profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', userPhone)
          .maybeSingle();

        if (profileError) {
          console.error('❌ Error fetching user profile:', profileError);
          return;
        }

        const userUUID = profileData?.id;
        if (!userUUID) {
          console.error('❌ No UUID found for user');
          return;
        }

        console.log('✅ User UUID:', userUUID.substring(0, 8));
        if (isSubscribed) setCurrentUserUUID(userUUID);

        // Fetch initial messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userUUID},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${userUUID})`)
          .order('created_at', { ascending: true })
          .limit(200);

        if (messagesError) {
          console.error('❌ Error fetching messages:', messagesError);
        } else if (isSubscribed) {
          console.log('✅ Fetched', messagesData?.length || 0, 'messages');
          setMessages(messagesData || []);
        }

        // Clean up previous channel
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        // Set up real-time subscription - listen to ALL messages and filter in callback
        channelRef.current = supabase
          .channel(channelName)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages'
          }, (payload) => {
            if (!isSubscribed) return;
            
            const message = payload.new as any;
            const oldMessage = payload.old as any;
            
            // Check if this message involves current conversation
            const isRelevant = message && (
              (message.sender_id === userUUID && message.receiver_id === chatPartnerId) ||
              (message.sender_id === chatPartnerId && message.receiver_id === userUUID)
            );

            if (!isRelevant && payload.eventType !== 'DELETE') return;

            if (payload.eventType === 'INSERT') {
              console.log('⚡ New message:', message.content?.substring(0, 30));

              // Add to messages if not duplicate
              setMessages(prev => {
                if (prev.some(m => m.id === message.id)) {
                  console.log('⚠️ Duplicate message ignored');
                  return prev;
                }
                return [...prev, message];
              });

              // Remove matching optimistic message
              setLocalMessages(prev => {
                const filtered = prev.filter(m => {
                  if (!m.isOptimistic) return true;
                  const isSameContent = m.content === message.content;
                  const timeDiff = Math.abs(
                    new Date(m.created_at).getTime() - new Date(message.created_at).getTime()
                  );
                  if (isSameContent && timeDiff < 5000) {
                    console.log('✅ Removed optimistic message');
                    return false;
                  }
                  return true;
                });
                return filtered;
              });
            } else if (payload.eventType === 'UPDATE') {
              console.log('🔄 Message updated:', message.id?.substring(0, 8));
              
              setMessages(prev => prev.map(m => 
                m.id === message.id ? { ...m, ...message } : m
              ));
              setLocalMessages(prev => prev.map(m => 
                m.id === message.id ? { ...m, ...message } : m
              ));
            } else if (payload.eventType === 'DELETE') {
              const deleteId = oldMessage?.id;
              if (deleteId) {
                console.log('🗑️ Message deleted:', deleteId?.substring(0, 8));
                
                setMessages(prev => prev.filter(m => m.id !== deleteId));
                setLocalMessages(prev => prev.filter(m => m.id !== deleteId));
              }
            }
          })
          .subscribe((status) => {
            console.log('📡 Chat subscription status:', status);
            
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time chat ACTIVE');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Chat subscription ERROR');
            }
          });

      } catch (error) {
        console.error('❌ Setup error:', error);
      }
    };

    setupChatRealtime();

    return () => {
      console.log('🔌 Cleaning up chat subscription:', channelName);
      isSubscribed = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [currentUser?.phone_number, chatPartnerId]);

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
    const messageContent = messageText.trim();
    
    if (!messageContent || !currentUserUUID || !chatPartnerId) {
      console.log('⚠️ Cannot send: missing content, userUUID, or partnerId');
      return;
    }

    // Create optimistic message for instant UI feedback
    const optimisticId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: currentUserUUID,
      receiver_id: chatPartnerId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      isOptimistic: true
    };

    // Add to local messages immediately
    setLocalMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: currentUserUUID,
          receiver_id: chatPartnerId,
          content: messageContent,
          is_read: false
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Send error:', error.message);
        // Remove optimistic message on error
        setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
        alert('Failed to send message. Please try again.');
      } else {
        console.log('✅ Message sent to DB:', data.id.substring(0, 8));
        
        // Fallback: If realtime doesn't pick it up within 2 seconds, add it manually
        setTimeout(() => {
          setMessages(prev => {
            // Only add if not already present (realtime didn't pick it up)
            if (prev.some(m => m.id === data.id)) {
              console.log('✅ Realtime already added message');
              return prev;
            }
            console.log('⚡ Fallback: manually adding sent message');
            return [...prev, data];
          });
          
          // Remove optimistic message
          setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Exception:', error);
      setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
      alert('Failed to send message. Please try again.');
    }
  };

  // Debounced typing indicator - prevents timeout accumulation
  const handleTextChange = (text: string) => {
    setMessageText(text);

    // Clear previous timeout to prevent accumulation
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Debounced typing indicator (500ms delay)
    if (text.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
      setIsTyping(false);
    }
  };
  const handleShareLocation = async () => {
    if (isSharingLocation || !currentUserUUID || !chatPartnerId) return;
    
    setIsSharingLocation(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        alert('Location permission is required to share your location');
        setIsSharingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const { latitude, longitude } = location.coords;
      const locationMessage = `📍 My Location: https://maps.google.com/?q=${latitude},${longitude}`;
      
      console.log('📍 Sharing location:', latitude.toFixed(4), longitude.toFixed(4));

      // Optimistic message
      const optimisticId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage = {
        id: optimisticId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        content: locationMessage,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true,
        isLocation: true
      };

      setLocalMessages(prev => [...prev, optimisticMessage]);

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: currentUserUUID,
          receiver_id: chatPartnerId,
          content: locationMessage,
          is_read: false
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Location send error:', error.message);
        setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
        alert('Failed to share location');
      } else {
        console.log('✅ Location sent to DB');
        
        // Fallback: add manually if realtime doesn't pick it up
        setTimeout(() => {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            console.log('⚡ Fallback: manually adding location');
            return [...prev, data];
          });
          setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Location error:', error);
      alert('Failed to get location. Please check your permissions.');
    } finally {
      setIsSharingLocation(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', selectedMessage.id);
      
      if (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message');
      } else {
        // Remove from local state
        setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
        setLocalMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
        console.log('Message deleted successfully');
      }
    } catch (e) {
      console.error('Exception deleting message:', e);
      alert('Failed to delete message');
    } finally {
      setShowMessageActions(false);
      setSelectedMessage(null);
    }
  };

  const handleEditMessage = () => {
    if (!selectedMessage) return;
    
    setIsEditMode(true);
    setEditingMessageId(selectedMessage.id);
    setMessageText(selectedMessage.content);
    setShowMessageActions(false);
    setSelectedMessage(null);
  };

  const handleUpdateMessage = async () => {
    if (!editingMessageId || !messageText.trim()) return;
    
    const updatedContent = messageText.trim();
    
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: updatedContent, updated_at: new Date().toISOString() })
        .eq('id', editingMessageId);
      
      if (error) {
        console.error('Error updating message:', error);
        alert('Failed to update message');
      } else {
        // Update local state
        setMessages(prev => prev.map(m => 
          m.id === editingMessageId ? { ...m, content: updatedContent, updated_at: new Date().toISOString() } : m
        ));
        setLocalMessages(prev => prev.map(m => 
          m.id === editingMessageId ? { ...m, content: updatedContent, updated_at: new Date().toISOString() } : m
        ));
        console.log('Message updated successfully');
      }
    } catch (e) {
      console.error('Exception updating message:', e);
      alert('Failed to update message');
    } finally {
      setIsEditMode(false);
      setEditingMessageId(null);
      setMessageText('');
    }
  };

  // Image picker handlers
  const handleOptimisticImage = (optimisticMsg: any) => {
    setLocalMessages(prev => [...prev, optimisticMsg]);
  };

  const handleImageUploadSuccess = (finalMsg: any, optimisticId: string) => {
    // Fallback: add manually if realtime doesn't pick it up
    setTimeout(() => {
      setMessages(prev => {
        if (prev.some(m => m.id === finalMsg.id)) {
          console.log('✅ Realtime already added image message');
          return prev;
        }
        console.log('⚡ Fallback: manually adding image message');
        return [...prev, finalMsg];
      });
      // Remove optimistic message
      setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
    }, 2000);
  };

  const handleImageUploadError = (optimisticId: string) => {
    setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
  };

  // Audio recorder handlers
  const handleOptimisticAudio = (optimisticMsg: any) => {
    setLocalMessages(prev => [...prev, optimisticMsg]);
  };

  const handleAudioUploadSuccess = (finalMsg: any, optimisticId: string) => {
    // Fallback: add manually if realtime doesn't pick it up
    setTimeout(() => {
      setMessages(prev => {
        if (prev.some(m => m.id === finalMsg.id)) {
          console.log('✅ Realtime already added audio message');
          return prev;
        }
        console.log('⚡ Fallback: manually adding audio message');
        return [...prev, finalMsg];
      });
      // Remove optimistic message
      setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
    }, 2000);
  };

  const handleAudioUploadError = (optimisticId: string) => {
    setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
  };

  const handleMongooseClick = () => {
    if (isAnimatingMongoose) return;
    
    console.log('Mongoose button clicked, starting animation...');
    setIsAnimatingMongoose(true);
    bikeAnimationX.setValue(0);

    // Animate the bike across the button
    Animated.timing(bikeAnimationX, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      // Navigate to messages screen with mongoose tab active
      console.log('Animation complete, navigating to messages with tab=1');
      router.push('/(users)/messages?tab=1');
      // Reset animation state after navigation
      setTimeout(() => {
        setIsAnimatingMongoose(false);
        bikeAnimationX.setValue(0);
      }, 300);
    });
  };
  const renderMessage = (message: any, index: number) => {
    const isCurrentUser = currentUserUUID && message.sender_id === currentUserUUID;
    const isOptimistic = message.isOptimistic;
    const key = message.id != null ? String(message.id) : `idx-${index}`;
    const messageType = message.message_type || 'text';
    const isLocation = message.content?.includes('📍 My Location:');
    const isImage = messageType === 'image' || message.image_url;
    const isAudio = messageType === 'audio' || message.audio_url;

    // Extract coordinates from location message
    let coordinates = null;
    if (isLocation) {
      const urlMatch = message.content.match(/https:\/\/maps\.google\.com\/\?q=([0-9.-]+),([0-9.-]+)/);
      if (urlMatch) {
        coordinates = {
          latitude: parseFloat(urlMatch[1]),
          longitude: parseFloat(urlMatch[2])
        };
      }
    }

    const handleLocationPress = () => {
      if (isLocation && coordinates) {
        setSelectedLocation(coordinates);
        setShowMapModal(true);
      }
    };

    const handleImagePress = () => {
      if (isImage && message.image_url) {
        setPreviewImageUrl(message.image_url);
        setShowImagePreview(true);
      }
    };

    // Render audio message
    if (isAudio) {
      return (
        <View key={key} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => {
              if (isCurrentUser && !isOptimistic) {
                setSelectedMessage(message);
                setShowMessageActions(true);
              }
            }}
            delayLongPress={500}
            className={`${isCurrentUser ? 'mr-2' : 'ml-2'}`}
          >
            <AudioMessagePlayer
              audioUrl={message.audio_url}
              duration={message.audio_duration}
              isCurrentUser={isCurrentUser}
              isOptimistic={isOptimistic}
            />
          </TouchableOpacity>
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
    }

    // Render image message
    if (isImage) {
      return (
        <View key={key} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleImagePress}
            onLongPress={() => {
              if (isCurrentUser && !isOptimistic) {
                setSelectedMessage(message);
                setShowMessageActions(true);
              }
            }}
            delayLongPress={500}
            className={`max-w-[70%] rounded-2xl overflow-hidden ${isCurrentUser ? 'mr-2' : 'ml-2'} ${isOptimistic ? 'opacity-70' : ''}`}
          >
            <Image
              source={{ uri: message.image_url }}
              style={{ width: 200, height: 200 }}
              resizeMode="cover"
            />
            {isOptimistic && (
              <View className="absolute inset-0 bg-black/30 items-center justify-center">
                <ActivityIndicator color="white" />
                <Text className="text-white text-xs mt-2">Uploading...</Text>
              </View>
            )}
          </TouchableOpacity>
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
    }

    // Render location message
    if (isLocation && coordinates) {
      return (
        <View key={key} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleLocationPress}
            onLongPress={() => {
              if (isCurrentUser && !isOptimistic) {
                setSelectedMessage(message);
                setShowMessageActions(true);
              }
            }}
            delayLongPress={500}
            className={`max-w-[80%] rounded-2xl overflow-hidden ${
              isCurrentUser ? 'mr-2' : 'ml-2'
            } ${isOptimistic ? 'opacity-70' : ''}`}
          >
            <MapView
              style={{ width: 250, height: 150 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Marker
                coordinate={coordinates}
                title="Shared Location"
              />
            </MapView>
            <View className={`px-3 py-2 ${isCurrentUser ? 'bg-primary' : 'bg-gray-200'}`}>
              <View className="flex-row items-center">
                <Ionicons 
                  name="location" 
                  size={14} 
                  color={isCurrentUser ? 'white' : '#007AFF'} 
                  style={{ marginRight: 4 }}
                />
                <Text className={`text-xs ${isCurrentUser ? 'text-white' : 'text-gray-700'}`}>
                  Tap to view full map
                </Text>
              </View>
            </View>
          </TouchableOpacity>
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
    }

    // Render text message
    return (
      <View key={key} className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <TouchableOpacity 
          activeOpacity={1}
          onLongPress={() => {
            if (isCurrentUser && !isOptimistic) {
              setSelectedMessage(message);
              setShowMessageActions(true);
            }
          }}
          delayLongPress={500}
          className={`max-w-[80%] px-4 py-2 rounded-2xl ${
            isCurrentUser ? 'bg-primary mr-2' : 'bg-gray-200 ml-2'
          } ${isOptimistic ? 'opacity-70' : ''}`}
        >
          <Text className={isCurrentUser ? 'text-white' : 'text-gray-800'}>
            {message.content}
          </Text>
          {isOptimistic && (
            <Text className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-200' : 'text-gray-500'}`}>
              Sending...
            </Text>
          )}
        </TouchableOpacity>
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
        <TouchableOpacity 
          className="ml-2 px-3 py-2 bg-blue-600 rounded-full overflow-hidden"
          onPress={handleMongooseClick}
          disabled={isAnimatingMongoose}
          style={{ position: 'relative', minWidth: 100 }}
        >
          {isAnimatingMongoose ? (
            <View className="flex-row items-center justify-center">
              <Animated.View
                style={{
                  transform: [
                    {
                      translateX: bikeAnimationX.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 30]
                      })
                    }
                  ]
                }}
              >
                <Ionicons name="bicycle" size={20} color="#edc06c" />
              </Animated.View>
            </View>
          ) : (
            <Text className="text-white font-semibold">Mongoose</Text>
          )}
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
          <ChatImagePicker
            currentUserUUID={currentUserUUID || ''}
            chatPartnerId={chatPartnerId as string}
            onOptimisticImage={handleOptimisticImage}
            onUploadSuccess={handleImageUploadSuccess}
            onUploadError={handleImageUploadError}
          />
          <ChatAudioRecorder
            currentUserUUID={currentUserUUID || ''}
            chatPartnerId={chatPartnerId as string}
            onOptimisticAudio={handleOptimisticAudio}
            onUploadSuccess={handleAudioUploadSuccess}
            onUploadError={handleAudioUploadError}
          />
          <TouchableOpacity
            onPress={handleShareLocation}
            disabled={isSharingLocation}
            className="mr-2 w-10 h-10 rounded-full items-center justify-center bg-blue-100"
          >
            {isSharingLocation ? (
              <Text className="text-xs text-blue-600">...</Text>
            ) : (
              <Ionicons name="location" size={22} color="#007AFF" />
            )}
          </TouchableOpacity>
          <TextInput
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 mr-3 min-h-[40px] max-h-[100px]"
            placeholder="Type a message..."
            value={messageText}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
            textAlignVertical="center"
          />
          {isEditMode && (
            <TouchableOpacity
              onPress={() => {
                setIsEditMode(false);
                setEditingMessageId(null);
                setMessageText('');
              }}
              className="mr-2 w-10 h-10 rounded-full items-center justify-center bg-gray-300"
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (isEditMode) {
                handleUpdateMessage();
              } else {
                console.log('Send button pressed!');
                handleSendMessage();
              }
            }}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              messageText.trim() ? (isEditMode ? 'bg-green-600' : 'bg-primary') : 'bg-gray-300'
            }`}
            disabled={!messageText.trim()}
          >
            <Ionicons name={isEditMode ? "checkmark" : "send"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Full-Screen Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View className="flex-1">
          {/* Header */}
          <View className="bg-white px-4 py-4 border-b border-gray-200" style={{ paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setShowMapModal(false)} className="p-2">
                <Ionicons name="close" size={28} color="#007AFF" />
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-gray-800">Location</Text>
              <TouchableOpacity 
                onPress={() => {
                  if (selectedLocation) {
                    const url = `https://maps.google.com/?q=${selectedLocation.latitude},${selectedLocation.longitude}`;
                    Linking.openURL(url);
                  }
                }}
                className="p-2"
              >
                <Ionicons name="navigate" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Map */}
          {selectedLocation && (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={selectedLocation}
                title="Shared Location"
                description="Tap navigate icon to open in Maps app"
              />
            </MapView>
          )}
        </View>
      </Modal>

      {/* Message Actions Modal */}
      <Modal
        visible={showMessageActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageActions(false)}
      >
        <TouchableOpacity 
          activeOpacity={1}
          onPress={() => setShowMessageActions(false)}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <View className="bg-white rounded-2xl w-64 overflow-hidden" style={{ elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }}>
            {selectedMessage?.message_type !== 'image' && selectedMessage?.message_type !== 'audio' && (
              <TouchableOpacity
                onPress={handleEditMessage}
                className="flex-row items-center px-6 py-4 border-b border-gray-200 active:bg-gray-50"
              >
                <Ionicons name="create-outline" size={22} color="#007AFF" />
                <Text className="ml-4 text-base text-gray-800 font-medium">Edit Message</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              onPress={handleDeleteMessage}
              className="flex-row items-center px-6 py-4 active:bg-gray-50"
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text className="ml-4 text-base text-red-600 font-medium">Delete Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setShowMessageActions(false)}
              className="flex-row items-center px-6 py-4 border-t border-gray-200 bg-gray-50 active:bg-gray-100"
            >
              <Ionicons name="close-circle-outline" size={22} color="#666" />
              <Text className="ml-4 text-base text-gray-600 font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={showImagePreview}
        animationType="fade"
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View className="flex-1 bg-black">
          {/* Header */}
          <View className="bg-black px-4 py-4 border-b border-gray-800" style={{ paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setShowImagePreview(false)} className="p-2">
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-white">Image</Text>
              <View className="w-10" />
            </View>
          </View>

          {/* Image */}
          <View className="flex-1 items-center justify-center">
            {previewImageUrl && (
              <Image
                source={{ uri: previewImageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}