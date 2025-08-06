// components/FollowRequests.tsx
import users from "@/data/UserData";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    FlatList,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface FollowRequestsProps {
  followRequests: string[];
  onFollowBack: (phoneNumber: string) => void;
  onReject: (phoneNumber: string) => void;
}

export default function FollowRequests({ followRequests, onFollowBack, onReject }: FollowRequestsProps) {
  const router = useRouter();
  const [processedRequests, setProcessedRequests] = useState<Set<string>>(new Set());

  const getUserByPhone = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace('+975', '');
    return Object.values(users).find(u => u.phone_number === cleanPhone);
  };

  const handleAccept = (phoneNumber: string) => {
    setProcessedRequests(prev => new Set(prev).add(phoneNumber));
    onFollowBack(phoneNumber);
  };

  const handleRemove = (phoneNumber: string) => {
    setProcessedRequests(prev => new Set(prev).add(phoneNumber));
    onReject(phoneNumber);
  };

  // Filter out processed requests
  const activeRequests = followRequests.filter(phone => !processedRequests.has(phone));

  const renderRequestItem = ({ item: phoneNumber }: { item: string }) => {
    const user = getUserByPhone(phoneNumber);
    const isProcessed = processedRequests.has(phoneNumber);
    
    return (
      <View className={`flex-row items-center p-4 border-b border-gray-200 ${
        isProcessed ? 'bg-gray-50 opacity-50' : 'bg-white'
      }`}>
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {user?.username.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        
        <View className="flex-1 mr-3">
          <Text className="font-semibold text-gray-800">
            {user?.username || phoneNumber}
          </Text>
          <Text className="text-sm text-gray-500">
            {user?.followers || 0} followers
          </Text>
        </View>

        {!isProcessed && (
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={() => handleAccept(phoneNumber)}
              className="bg-primary px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium text-sm">Accept</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleRemove(phoneNumber)}
              className="bg-red-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium text-sm">Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {isProcessed && (
          <View className="px-4 py-2">
            <Text className="text-gray-500 text-sm italic">Processed</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView className="flex-1">
      {activeRequests.length > 0 ? (
        <>
          <View className="p-4 bg-blue-50 border-b border-blue-200">
            <Text className="text-sm text-blue-700 text-center">
              {activeRequests.length} people want to follow you
            </Text>
          </View>
          
          <FlatList
            data={followRequests}
            renderItem={renderRequestItem}
            keyExtractor={(item) => item}
            scrollEnabled={false}
          />

          {/* Quick Actions */}
          {activeRequests.length > 1 && (
            <View className="p-4 bg-gray-50 border-t border-gray-200">
              <View className="flex-row space-x-3 justify-center">
                <TouchableOpacity
                  onPress={() => {
                    activeRequests.forEach(phone => handleAccept(phone));
                  }}
                  className="bg-primary px-6 py-3 rounded-lg flex-1"
                >
                  <Text className="text-white font-medium text-center">Accept All</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => {
                    activeRequests.forEach(phone => handleRemove(phone));
                  }}
                  className="bg-red-500 px-6 py-3 rounded-lg flex-1"
                >
                  <Text className="text-white font-medium text-center">Remove All</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="people" size={64} color="#CBD5E0" />
          <Text className="text-xl font-semibold text-gray-600 mt-4 text-center">
            {processedRequests.size > 0 ? 'All Requests Processed' : 'No Follow Requests'}
          </Text>
          <Text className="text-gray-500 mt-2 text-center">
            {processedRequests.size > 0 
              ? 'You have handled all follow requests'
              : 'When people follow you, their requests will appear here'
            }
          </Text>
        </View>
      )}
    </ScrollView>
  );
}