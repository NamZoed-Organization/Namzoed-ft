// components/MongooseMessages.tsx
import { useUser } from "@/contexts/UserContext";
import mongooses from "@/data/mongoose";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

interface MongooseMessagesProps {
  mongooseChats: any[]; // We'll ignore this and use all mongooses from data
}

export default function MongooseMessages({ mongooseChats }: MongooseMessagesProps) {
  const router = useRouter();
  const { currentUser } = useUser();

  // Get all mongoose names from data
  const allMongooses = Object.keys(mongooses);
  
  // Debug log
  console.log('All mongooses:', allMongooses);

  // Get existing messages for current user with mongoose
  const getExistingMessages = (mongooseName: string) => {
    const mongooseData = mongooses[mongooseName as keyof typeof mongooses];
    
    // For demo purposes, always show messages for 17123456
    const demoPhone = '+97517123456';
    
    return (mongooseData?.clientChats as any)?.[demoPhone] || [];
  };

  const renderMongooseItem = ({ item: mongooseName }: { item: string }) => {
    const existingMessages = getExistingMessages(mongooseName);
    const lastMessage = existingMessages[existingMessages.length - 1];
    
    // Debug log
    console.log('Rendering mongoose:', mongooseName, 'Messages:', existingMessages.length);
    
    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() => {
          console.log('Navigating to:', `/(users)/mongoose-chat/${mongooseName}`);
          router.push(`/(users)/mongoose-chat/${mongooseName}` as any);
        }}
      >
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {mongooseName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {mongooseName} (Mongoose)
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

  return (
    <FlatList
      data={allMongooses}
      renderItem={renderMongooseItem}
      keyExtractor={(item) => item}
      scrollEnabled={false}
    />
  );
}
