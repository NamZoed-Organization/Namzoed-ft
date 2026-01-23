// components/FollowRequests.tsx
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from 'expo-router';
import { ArrowDownAZ, ArrowUpAZ, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { fetchFollowers, followUser, FollowUser } from '@/lib/followService';

interface FollowRequestsProps {
  onClose: () => void;
  userId: string;
}

type SortOrder = 'asc' | 'desc';

export default function FollowRequests({ onClose, userId }: FollowRequestsProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    loadRequests();
  }, [userId]);

  const loadRequests = async () => {
    try {
      if (!refreshing) setLoading(true);

      // Fetch followers where I haven't followed back
      const followersData = await fetchFollowers(userId, 'desc');
      const pendingRequests = followersData.filter(user => !user.isFollowingBack);

      setRequests(pendingRequests);
    } catch (error) {
      console.error('Error loading follow requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (user: FollowUser) => {
    try {
      const result = await followUser(userId, user.id);
      if (result.success) {
        // Soft delete - mark as accepted
        setRequests(prev =>
          prev.map(u => u.id === user.id ? { ...u, isFollowingBack: true } : u)
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleReject = async (user: FollowUser) => {
    // Soft delete - just mark locally
    setRequests(prev =>
      prev.map(u => u.id === user.id ? { ...u, isUnfollowed: true } : u)
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadRequests();
  }, []);

  // Render request item
  const renderRequestItem = useCallback(({ item }: { item: FollowUser }) => {
    const isProcessed = item.isFollowingBack || item.isUnfollowed;

    return (
      <View className={`mx-4 mb-3 ${isProcessed ? 'opacity-50' : ''}`}>
        <TouchableOpacity
          className="flex-row items-center bg-white p-4 rounded-2xl border border-gray-100"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/(users)/profile/${item.id}`);
          }}
          activeOpacity={0.7}
        >
          {/* Avatar */}
          <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center overflow-hidden">
            {item.avatar_url ? (
              <Image
                source={{ uri: item.avatar_url }}
                className="w-12 h-12"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-gray-400 font-mbold text-lg">
                {item.name?.[0]?.toUpperCase() || '?'}
              </Text>
            )}
          </View>

          {/* User Info */}
          <View className="flex-1 ml-3">
            <Text className="text-gray-900 font-msemibold text-base">{item.name}</Text>
            {item.phone && (
              <Text className="text-gray-500 font-regular text-sm">{item.phone}</Text>
            )}
          </View>

          {/* Action Buttons */}
          {!isProcessed && (
            <View className="flex-row gap-x-2">
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleAccept(item);
                }}
                className="bg-primary px-4 py-2 rounded-lg border border-primary"
              >
                <Text className="font-msemibold text-sm text-white">Accept</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleReject(item);
                }}
                className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200"
              >
                <Text className="font-msemibold text-sm text-gray-700">Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {item.isFollowingBack && (
            <View className="px-4 py-2 bg-green-50 rounded-lg">
              <Text className="text-green-700 text-sm font-msemibold">Accepted</Text>
            </View>
          )}

          {item.isUnfollowed && (
            <View className="px-4 py-2 bg-gray-50 rounded-lg">
              <Text className="text-gray-500 text-sm font-msemibold">Rejected</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [userId]);

  // Sort requests
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [requests, sortOrder]);

  // Empty state
  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-4 py-20">
      <Text className="text-gray-500 text-base font-msemibold">No follow requests</Text>
      <Text className="text-gray-400 text-sm font-regular mt-2 text-center">
        When people follow you, their requests will appear here
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Premium Header with BlurView */}
      <BlurView intensity={90} tint="light" className="pt-14 pb-4 z-10 border-b border-gray-200/50">
        <View className="flex-row items-center justify-between px-6">
          <View className="flex-1">
            <Text className="text-2xl font-mbold text-gray-900">Follow Requests</Text>
            <Text className="text-gray-500 text-xs font-mregular">
              {sortedRequests.filter(r => !r.isFollowingBack && !r.isUnfollowed).length} pending
            </Text>
          </View>

          <View className="flex-row items-center gap-x-2">
            <TouchableOpacity
              onPress={toggleSortOrder}
              className="bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100 flex-row items-center gap-x-1.5"
            >
              {sortOrder === 'asc' ? (
                <ArrowUpAZ size={18} color="#1F2937" />
              ) : (
                <ArrowDownAZ size={18} color="#1F2937" />
              )}
              <Text className="text-xs font-msemibold text-gray-900">
                {sortOrder === 'asc' ? 'Oldest' : 'Latest'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="bg-white p-2 rounded-full shadow-sm border border-gray-100"
            >
              <X size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#094569" />
        </View>
      ) : (
        <FlashList
          data={sortedRequests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#094569"
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </View>
  );
}
