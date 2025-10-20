// app/(tabs)/messages.tsx
import FollowRequests from "@/components/FollowRequests";
import MongooseMessages from "@/components/MongooseMessages";
import RequestMessages from "@/components/RequestMessages";
import { useUser } from "@/contexts/UserContext";
import userData17123456 from "@/data/17123456";
import mongooses from "@/data/mongoose";
import users from "@/data/UserData";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// Types
interface IMessage {
  sender: string;
  content: string;
  timestamp: Date;
}

interface IUserData {
  messages: { [phoneNumber: string]: IMessage[] };
  following: string[];
  followers: string[];
  requests: { sender: string; content: string; timestamp: Date }[];
  userProfile: {
    phoneNumber: string;
    followingCount: number;
    followersCount: number;
    requestsCount: number;
  };
}

// Get user data based on phone number
const getUserData = (phoneNumber: string): IUserData | null => {
  // Clean phone number - remove +975 prefix if exists
  const cleanPhone = phoneNumber?.replace('+975', '').replace(/\D/g, '');
  
  switch (cleanPhone) {
    case "17123456":
      return userData17123456;
    default:
      // For demo purposes, always return the 17123456 data so messages show
      return userData17123456;
  }
};

export default function MessageScreen() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");

  if (!currentUser) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />
        
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base font-regular text-gray-500 text-center">
            Please login to view messages
          </Text>
        </View>
      </View>
    );
  }

  const userData = getUserData(currentUser.phone_number || "");
  
  if (!userData) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />
        
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base font-regular text-gray-500 text-center">
            No user data found
          </Text>
        </View>
      </View>
    );
  }

  // Get follow requests (followers who user hasn't followed back)
  const followRequests = useMemo(() => {
    return userData.followers.filter(follower => 
      !userData.following.includes(follower)
    );
  }, [userData]);

  // Get all conversations (only show users who have messages)
  const conversationPartners = useMemo(() => {
    return Object.keys(userData.messages as Record<string, IMessage[]>);
  }, [userData.messages]);

  // Search users from Supabase profiles table
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // First, let's see what columns are available
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);

        if (error) {
          console.error('Error checking profiles structure:', error);
        } else {
          console.log('Available profiles columns:', data?.[0] ? Object.keys(data[0]) : 'No data');
        }

        // Try a simple search by name only for now
        const { data: searchData, error: searchError } = await supabase
          .from('profiles')
          .select('*')
          .ilike('name', `%${searchQuery}%`)
          .limit(10);

        if (searchError) {
          console.error('Error searching users:', searchError);
          setSearchResults([]);
        } else {
          console.log('Search results:', searchData);
          setSearchResults(searchData || []);
        }
      } catch (e) {
        console.error('Search error:', e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentUser?.phone_number]);

  // Fetch conversations from Supabase
  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    try {
      console.log('=== FETCHING CONVERSATIONS ===');
      console.log('Current user object:', JSON.stringify(currentUser));
      console.log('Current user properties:', currentUser ? Object.keys(currentUser) : 'null');
      
      // Try multiple possible phone number properties
      const userPhone = currentUser?.phone_number || 
                       (currentUser as any)?.phone || 
                       (currentUser as any)?.phoneNumber ||
                       (currentUser as any)?.mobile;
      
      console.log('Detected user phone:', userPhone);
      
      if (!userPhone) {
        console.log('❌ No phone number found for current user');
        setConversations([]);
        setDebugInfo('Please login with a valid phone number');
        setIsLoadingConversations(false);
        return;
      }
      
      // Get current user's profile to get their UUID
      console.log('🔍 Searching for profile with phone:', userPhone);
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .eq('phone', userPhone)
        .maybeSingle();

      if (profileError) {
        console.log('❌ Error finding profile:', profileError);
      }
      
      console.log('✅ Current user profile found:', currentUserProfile);

      if (!currentUserProfile) {
        console.log('❌ Current user not found in profiles table');
        console.log('💡 Make sure your phone number matches a profile in the database');
        setConversations([]);
        setDebugInfo(`User with phone ${userPhone} not found in database`);
        setIsLoadingConversations(false);
        return;
      }

      // Fetch all messages where current user is sender or receiver using UUID
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserProfile.id},receiver_id.eq.${currentUserProfile.id}`)
        .order('created_at', { ascending: false });

      console.log('Messages fetched:', messages?.length, 'error:', error?.message);

      if (error || !messages || messages.length === 0) {
        console.log('No messages found from database');
        setConversations([]);
        setDebugInfo('No conversations for this user');
        setIsLoadingConversations(false);
        return;
      }

      // Extract unique partner UUIDs
      console.log('Processing messages to extract partners...');
      const partnerMap = new Map();
      for (const message of messages) {
        const partnerId = message.sender_id === currentUserProfile.id
          ? message.receiver_id
          : message.sender_id;
        
        console.log(`Message: sender=${message.sender_id?.substring(0,8)}, receiver=${message.receiver_id?.substring(0,8)}, partnerId=${partnerId?.substring(0,8)}`);
        
        if (!partnerMap.has(partnerId) || new Date(message.created_at) > new Date(partnerMap.get(partnerId).created_at)) {
          partnerMap.set(partnerId, message);
        }
      }

      const partnerIds = Array.from(partnerMap.keys());
      console.log('Unique partner IDs found:', partnerIds.length);
      console.log('Partner IDs:', partnerIds.map(id => id?.substring(0, 8)));
      
      let profiles: any[] = [];
      
      if (partnerIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, phone')
          .in('id', partnerIds);
        
        console.log('Profiles fetched:', profileData?.length, 'error:', profileError?.message);
        if (profileData) {
          console.log('Profile names:', profileData.map(p => p.name));
        }
        
        profiles = profileData || [];
      }

      const supabaseConversations = partnerIds
        .map(pid => {
          const lastMessage = partnerMap.get(pid);
          const partnerProfile = profiles.find(p => p.id === pid);
          console.log(`Building conversation for ${partnerProfile?.name || 'Unknown'} (${pid?.substring(0,8)})`);
          return {
            partnerId: pid,
            partnerProfile,
            lastMessage,
            created_at: lastMessage.created_at
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Final conversations built:', supabaseConversations.length);
      console.log('Conversation partners:', supabaseConversations.map(c => c.partnerProfile?.name || c.partnerId?.substring(0,8)));
      
      setConversations(supabaseConversations);
      setDebugInfo(`${supabaseConversations.length} chat partners`);
      console.log('State updated with conversations');
    } catch (e) {
      console.error('Error fetching conversations:', e);
      setDebugInfo(`Error: ${(e as any).message}`);
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    // Fetch conversations from Supabase (prioritize database over local data)
    console.log('useEffect triggered, fetching conversations...');
    fetchConversations();
  }, [currentUser?.phone_number]);

  // Subscribe to real-time updates for new messages
  useEffect(() => {
    const userPhone = currentUser?.phone_number || 
                     (currentUser as any)?.phone || 
                     (currentUser as any)?.phoneNumber ||
                     (currentUser as any)?.mobile;
    
    if (!userPhone) {
      console.log('⚠️ Cannot setup real-time: no phone number');
      return;
    }

    const setupRealtimeSubscription = async () => {
      // Get user's UUID for real-time filtering
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', userPhone)
        .maybeSingle();

      const userUUID = profile?.id;

      if (!userUUID) {
        console.log('⚠️ Cannot setup real-time: user UUID not found');
        return;
      }

      console.log('🔔 Setting up real-time subscription for user:', userUUID.substring(0, 8));

      const channel = supabase
        .channel('conversations')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `or(sender_id.eq.${userUUID},receiver_id.eq.${userUUID})`
        }, (payload) => {
          console.log('📨 New message received, refreshing conversations');
          fetchConversations();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, [currentUser]);

  // Get mongoose chats for current user
  const mongooseChats = useMemo(() => {
    const chats: { mongooseName: string; messages: any[] }[] = [];
    Object.entries(mongooses).forEach(([mongooseName, mongooseData]) => {
      const currentUserPhone = `+975${currentUser.phone_number}`;
      if ((mongooseData.clientChats as any)[currentUserPhone]) {
        chats.push({
          mongooseName,
          messages: (mongooseData.clientChats as any)[currentUserPhone]
        });
      }
    });
    return chats;
  }, [currentUser.phone_number]);

  const getUserByPhone = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace('+975', '');
    return Object.values(users).find(u => u.phone_number === cleanPhone);
  };

  const handleFollowBack = (phoneNumber: string) => {
    console.log('Following back:', phoneNumber);
    // Here you would update the backend and local state
  };

  const handleReject = (phoneNumber: string) => {
    console.log('Rejecting request:', phoneNumber);
    // Here you would remove from followers or block
  };

  const renderMessageItem = ({ item: phoneNumber }: { item: string }) => {
    const user = getUserByPhone(phoneNumber);
    const messagesObj = userData.messages as Record<string, IMessage[]>;
    const conversation = messagesObj[phoneNumber];
    const lastMessage = conversation?.[conversation.length - 1];
    
    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() => router.push(`/(users)/chat/${phoneNumber.replace('+975', '')}`)}
      >
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {user?.username.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {user?.username || phoneNumber}
          </Text>
          <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
            {lastMessage?.content || 'No messages yet'}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">
          {lastMessage?.timestamp ? 
            new Date(lastMessage.timestamp).toLocaleDateString() : ''
          }
        </Text>
      </TouchableOpacity>
    );
  };

  const handleDeleteConversation = async (partnerId: string, partnerName: string) => {
    try {
      // Get current user's UUID
      const userPhone = currentUser?.phone_number || 
                       (currentUser as any)?.phone || 
                       (currentUser as any)?.phoneNumber ||
                       (currentUser as any)?.mobile;
      
      if (!userPhone) {
        console.log('❌ No phone number found for deletion');
        return;
      }
      
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', userPhone)
        .maybeSingle();

      if (!currentUserProfile) {
        console.log('❌ User profile not found');
        return;
      }

      // Delete all messages between current user and partner
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${currentUserProfile.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserProfile.id})`);

      if (error) {
        console.error('Error deleting conversation:', error);
      } else {
        console.log(`✅ Deleted conversation with ${partnerName}`);
        // Remove from local state immediately
        setConversations(prev => prev.filter(c => c.partnerId !== partnerId));
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    }
  };

  const renderConversationItem = ({ item: conversation }: { item: any }) => {
    // Handle both UUID-based profiles and phone-based profiles
    const userName = conversation.partnerProfile?.name || 
                     conversation.partnerProfile?.username || 
                     conversation.partnerId?.substring(0, 8) || 
                     'Unknown';
    
    return (
      <View className="flex-row items-center border-b border-gray-200">
        <TouchableOpacity 
          className="flex-row items-center p-4 flex-1"
          onPress={() => router.push(`/(users)/chat/${conversation.partnerId}`)}
        >
          <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold">
              {userName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-800">
              {userName}
            </Text>
            <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
              {conversation.lastMessage?.content || 'No messages yet'}
            </Text>
          </View>
          <Text className="text-xs text-gray-400 mr-2">
            {conversation.lastMessage?.created_at ? 
              new Date(conversation.lastMessage.created_at).toLocaleDateString() : ''
            }
          </Text>
        </TouchableOpacity>
        
        {/* Delete Button */}
        <TouchableOpacity
          className="p-4 items-center justify-center"
          onPress={() => handleDeleteConversation(conversation.partnerId, userName)}
        >
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSearchResultItem = ({ item: user }: { item: any }) => {
    // Handle different possible column names
    const userName = user.name || user.username || user.full_name || 'Unknown User';
    const userPhone = user.phone || user.phone_number || user.mobile || 'Unknown';
    const userId = user.id; // This should be the UUID from profiles table
    
    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() => {
          setSearchQuery(""); // Clear search
          router.push(`/(users)/chat/${userId}`); // Use UUID instead of phone
        }}
      >
        <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {userName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {userName}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {userPhone}
          </Text>
        </View>
        <Ionicons name="chatbubble-outline" size={20} color="#666" />
      </TouchableOpacity>
    );
  };

  // If showing follow requests, render the FollowRequests component
  if (showFollowRequests) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />
        
        {/* Fixed Header */}
        <View className="bg-white px-4 py-6 border-b border-gray-200">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => setShowFollowRequests(false)} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            
            <Text className="text-xl font-bold text-gray-800">Follow Requests</Text>
            
            <View className="flex-1" />
            
            {followRequests.length > 0 && (
              <View className="bg-red-500 rounded-full w-6 h-6 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {followRequests.length}
                </Text>
              </View>
            )}
          </View>
        </View>

        <FollowRequests 
          followRequests={followRequests}
          onFollowBack={handleFollowBack}
          onReject={handleReject}
        />
      </View>
    );
  }

  const tabs = ['Messages', 'Mongoose', 'Requests'];

  return (
    <View className="flex-1 bg-background">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />
      
      {/* Fixed Header with spacing */}
      <View className="bg-white px-4 py-6 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-mbold text-primary">Welcome to Chats</Text>
            <Text className="text-base font-medium text-gray-700">
              {currentUser.username}
            </Text>
          </View>
          <TouchableOpacity 
            className="relative"
            onPress={() => setShowFollowRequests(true)}
          >
            <Ionicons name="person-add" size={24} color="#007AFF" />
            {followRequests.length > 0 && (
              <View className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {followRequests.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Tabs */}
        <View className="flex-row bg-white border-b border-gray-200">
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={index}
              className={`flex-1 py-4 items-center ${
                activeTab === index ? 'border-b-2 border-primary' : ''
              }`}
              onPress={() => setActiveTab(index)}
            >
              <Text className={`font-medium ${
                activeTab === index ? 'text-primary' : 'text-gray-500'
              }`}>
                {tab}
                {index === 2 && userData.requests.length > 0 && (
                  <Text className="text-red-500"> ({userData.requests.length})</Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Bar (only for Messages tab) */}
        {activeTab === 0 && (
          <View className="p-4 bg-white border-b border-gray-200">
            <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                className="flex-1 ml-2 text-base"
                placeholder="Search conversations or find new users..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {isSearching && (
                <View className="ml-2">
                  <Text className="text-xs text-gray-500">Searching...</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Content based on active tab */}
        <View className="flex-1 bg-white">
          {activeTab === 0 && (
            <>
              {/* Show search results when searching */}
              {searchQuery.trim() && searchResults.length > 0 && (
                <>
                  <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <Text className="text-sm font-medium text-gray-600">
                      Search Results ({searchResults.length})
                    </Text>
                  </View>
                  <FlatList
                    data={searchResults}
                    renderItem={renderSearchResultItem}
                    keyExtractor={(item) => item.id || item.phone || item.phone_number}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </>
              )}
              
              {/* Show "no results" when searching but no results */}
              {searchQuery.trim() && searchResults.length === 0 && !isSearching && (
                <View className="flex-1 items-center justify-center py-8">
                  <Text className="text-gray-500 text-center">
                    No users found for "{searchQuery}"
                  </Text>
                </View>
              )}
              
              {/* Show existing conversations when not searching */}
              {!searchQuery.trim() && (
                <>
                  {conversations.length > 0 ? (
                    <>
                      <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <Text className="text-sm font-medium text-gray-600">
                          Your Chats ({conversations.length})
                        </Text>
                      </View>
                      <FlatList
                        data={conversations}
                        renderItem={renderConversationItem}
                        keyExtractor={(item) => item.partnerId}
                        scrollEnabled={false}
                        showsVerticalScrollIndicator={false}
                      />
                    </>
                  ) : (
                    <View className="flex-1 items-center justify-center py-8">
                      <Text className="text-gray-500 text-center">
                        No conversations yet.{"\n"}Search for users to start chatting!
                      </Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 1 && (
            <MongooseMessages mongooseChats={mongooseChats} />
          )}

          {activeTab === 2 && (
            <RequestMessages requests={userData.requests} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}