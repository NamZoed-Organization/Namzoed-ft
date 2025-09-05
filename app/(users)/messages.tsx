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

  // Filter users based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversationPartners;
    
    return conversationPartners.filter(phoneNumber => {
      const user = Object.values(users).find(u => 
        `+975${u.phone_number}` === phoneNumber || u.phone_number === phoneNumber.replace('+975', '')
      );
      return user?.username.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [searchQuery, conversationPartners]);

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
    if (!currentUser?.phone_number) return;
    
    setIsLoadingConversations(true);
    try {
      console.log('Temporarily disabled conversation fetch until we know column names');
      setConversations([]);
      /*
      // Get all unique conversations for the current user
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_profile:profiles!messages_sender_id_fkey(name, phone),
          receiver_profile:profiles!messages_receiver_id_fkey(name, phone)
        `)
        .or(`sender_id.eq.${currentUser.phone_number},receiver_id.eq.${currentUser.phone_number}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
      } else {
        // Group messages by conversation partner and get the latest message for each
        const conversationMap = new Map();
        
        data?.forEach(message => {
          const partnerId = message.sender_id === currentUser.phone_number 
            ? message.receiver_id 
            : message.sender_id;
          
          const partnerProfile = message.sender_id === currentUser.phone_number
            ? message.receiver_profile
            : message.sender_profile;

          if (!conversationMap.has(partnerId) || 
              new Date(message.created_at) > new Date(conversationMap.get(partnerId).created_at)) {
            conversationMap.set(partnerId, {
              partnerId,
              partnerProfile,
              lastMessage: message,
              created_at: message.created_at
            });
          }
        });

        setConversations(Array.from(conversationMap.values()));
      }
      */
    } catch (e) {
      console.error('Error fetching conversations:', e);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [currentUser?.phone_number]);

  // Subscribe to real-time updates for new messages
  useEffect(() => {
    if (!currentUser?.phone_number) return;

    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `or(sender_id.eq.${currentUser.phone_number},receiver_id.eq.${currentUser.phone_number})`
      }, (payload) => {
        console.log('New message received, refreshing conversations');
        // Refresh conversations when a new message is received
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.phone_number]);

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

  const renderConversationItem = ({ item: conversation }: { item: any }) => {
    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() => router.push(`/(users)/chat/${conversation.partnerId}`)}
      >
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {conversation.partnerProfile?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {conversation.partnerProfile?.name || conversation.partnerId}
          </Text>
          <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
            {conversation.lastMessage?.content || 'No messages yet'}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">
          {conversation.lastMessage?.created_at ? 
            new Date(conversation.lastMessage.created_at).toLocaleDateString() : ''
          }
        </Text>
      </TouchableOpacity>
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
                  {isLoadingConversations ? (
                    <View className="flex-1 items-center justify-center py-8">
                      <Text className="text-gray-500 text-center">Loading conversations...</Text>
                    </View>
                  ) : conversations.length > 0 ? (
                    <>
                      <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <Text className="text-sm font-medium text-gray-600">
                          Recent Conversations
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
                        No conversations yet.{'\n'}Search for users to start chatting!
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