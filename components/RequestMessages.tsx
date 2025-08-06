// components/RequestMessages.tsx
import users from "@/data/UserData";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

interface RequestMessage {
  sender: string;
  content: string;
  timestamp: Date;
}

interface RequestMessagesProps {
  requests: RequestMessage[];
}

export default function RequestMessages({ requests }: RequestMessagesProps) {
  const router = useRouter();

  const getUserByPhone = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace('+975', '');
    return Object.values(users).find(u => u.phone_number === cleanPhone);
  };

  const renderRequestItem = ({ item }: { item: RequestMessage }) => {
    const user = getUserByPhone(item.sender);
    
    return (
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() => router.push(`/(users)/chat/${item.sender.replace('+975', '')}` as any)}
      >
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {user?.username.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {user?.username || item.sender}
          </Text>
          <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
            {item.content}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={requests}
      renderItem={renderRequestItem}
      keyExtractor={(item, index) => `${item.sender}-${index}`}
      scrollEnabled={false}
    />
  );
}