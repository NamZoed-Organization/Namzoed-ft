// app/(tabs)/messages.tsx
import FollowRequests from "@/components/FollowRequests";
import MongooseMessages from "@/components/MongooseMessages";
import RequestMessages from "@/components/RequestMessages";
import { useUser } from "@/contexts/UserContext";
import userData17123456 from "@/data/17123456";
import mongooses from "@/data/mongoose";
import users from "@/data/UserData";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  SafeAreaView,
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

  const userData = getUserData(currentUser.phone_number);
  
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

  // Get mongoose chats for current user
  const mongooseChats = useMemo(() => {
    const chats: { mongooseName: string; messages: any[] }[] = [];
    Object.entries(mongooses).forEach(([mongooseName, mongooseData]) => {
      const currentUserPhone = `+975${currentUser.phone_number}`;
      if (mongooseData.clientChats[currentUserPhone]) {
        chats.push({
          mongooseName,
          messages: mongooseData.clientChats[currentUserPhone]
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
                placeholder="Search conversations..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        )}

        {/* Content based on active tab */}
        <View className="flex-1 bg-white">
          {activeTab === 0 && (
            <FlatList
              data={filteredConversations}
              renderItem={renderMessageItem}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
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