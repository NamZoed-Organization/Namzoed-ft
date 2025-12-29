import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from 'expo-router';
import { ArrowDownAZ, ArrowUpAZ, UserCheck, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight
} from "react-native-reanimated";
import { fetchFollowers, fetchFollowing, followUser, FollowUser, unfollowUser } from '@/lib/followService';

interface FollowRequestsOverlayProps {
  onClose: () => void;
  userId: string;
  initialTab?: TabType;
}

type TabType = 'followers' | 'following';
type SortOrder = 'asc' | 'desc';

export default function FollowRequestsOverlay({ onClose, userId, initialTab = 'following' }: FollowRequestsOverlayProps) {
  // States
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const previousTab = useRef<TabType>('following');

  useEffect(() => {
    loadData();
  }, [userId]);

  // Reset when switching tabs
  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    previousTab.current = activeTab;
    setActiveTab(tab);
  };

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);

      // Fetch followers and following from Supabase (always desc, will sort locally)
      const [followersData, followingData] = await Promise.all([
        fetchFollowers(userId, 'desc'),
        fetchFollowing(userId, 'desc')
      ]);

      setFollowers(followersData);
      setFollowing(followingData);

    } catch (error) {
      console.error('Error loading follow data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async (user: FollowUser) => {
    try {
      const result = await followUser(userId, user.id);
      if (result.success) {
        // Update state based on active tab
        if (activeTab === 'following') {
          // Clear isUnfollowed flag when re-following
          setFollowing(prev =>
            prev.map(u => u.id === user.id ? { ...u, isUnfollowed: false } : u)
          );
        } else {
          // Update isFollowingBack status in Followers tab
          setFollowers(prev =>
            prev.map(u => u.id === user.id ? { ...u, isFollowingBack: true } : u)
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', result.error || 'Failed to follow user');
      }
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    }
  };

  const handleUnfollow = async (user: FollowUser) => {
    try {
      const result = await unfollowUser(userId, user.id);
      if (result.success) {
        // Mark as unfollowed instead of removing (soft delete)
        if (activeTab === 'following') {
          setFollowing(prev =>
            prev.map(u => u.id === user.id ? { ...u, isUnfollowed: true } : u)
          );
        } else {
          setFollowers(prev =>
            prev.map(u => u.id === user.id ? { ...u, isFollowingBack: false } : u)
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', result.error || 'Failed to unfollow user');
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  // Render user item
  const renderUserItem = useCallback(({ item }: { item: FollowUser }) => {
    const isFollowing = activeTab === 'following' ? !item.isUnfollowed : item.isFollowingBack;

    return (
      <View className={`mx-4 mb-3 ${item.isUnfollowed ? 'opacity-50' : ''}`}>
        <TouchableOpacity
          className="flex-row items-center bg-white p-4 rounded-2xl border border-gray-100"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/profile/${item.id}`);
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

          {/* Action Button - Only show for Following tab */}
          {activeTab === 'following' && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (isFollowing) {
                  handleUnfollow(item);
                } else {
                  handleFollow(item);
                }
              }}
              className={`px-4 py-2 rounded-lg border ${
                isFollowing
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-primary border-primary'
              }`}
            >
              <Text className={`font-msemibold text-sm ${
                isFollowing ? 'text-gray-700' : 'text-white'
              }`}>
                {item.isUnfollowed ? 'Unfollowed' : (isFollowing ? 'Following' : 'Follow')}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [activeTab, userId]);

  // Memoize and sort data for FlashList
  const currentListData = useMemo(() => {
    const data = activeTab === 'followers' ? followers : following;

    // Sort by created_at based on sortOrder
    return [...data].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();

      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [activeTab, followers, following, sortOrder]);

  // Empty state component
  const renderEmptyState = () => {
    const emptyMessages = {
      followers: {
        title: 'No followers yet',
        subtitle: 'People who follow you will appear here'
      },
      following: {
        title: 'Not following anyone',
        subtitle: 'People you follow will appear here'
      }
    };

    const message = emptyMessages[activeTab];

    return (
      <View className="flex-1 items-center justify-center px-4 py-20">
        <Text className="text-gray-500 text-base font-msemibold">{message.title}</Text>
        <Text className="text-gray-400 text-sm font-regular mt-2 text-center">
          {message.subtitle}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Premium Header with BlurView */}
      <BlurView intensity={90} tint="light" className="pt-14 pb-2 z-10 border-b border-gray-200/50">
        <View className="flex-row items-center justify-between px-6 mb-4">
          <View className="flex-1">
            <Text className="text-2xl font-mbold text-gray-900">
              {activeTab === 'followers' ? 'Followers' : 'Following'}
            </Text>
            <Text className="text-gray-500 text-xs font-mregular">Manage your connections</Text>
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

        {/* Custom Tab Bar */}
        <View className="flex-row px-4 pb-2 gap-x-2">
          {[
            { id: 'following' as TabType, label: 'Following', icon: UserCheck, count: following.length },
            { id: 'followers' as TabType, label: 'Followers', icon: Users, count: followers.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => handleTabChange(tab.id)}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-2xl border ${
                  isTabActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
              >
                <Icon size={16} color={isTabActive ? '#fff' : '#6B7280'} />
                <Text className={`ml-1.5 text-sm font-msemibold ${isTabActive ? 'text-white' : 'text-gray-700'}`}>
                  {tab.label}
                </Text>
                <View className={`ml-1.5 px-1.5 py-0.5 rounded-full ${isTabActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                  <Text className={`text-xs font-mbold ${isTabActive ? 'text-white' : 'text-gray-600'}`}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#094569" />
        </View>
      ) : (
        <Animated.View
          key={activeTab}
          entering={
            previousTab.current === 'followers' && activeTab === 'following'
              ? SlideInRight.duration(250)
              : previousTab.current === 'following' && activeTab === 'followers'
              ? SlideInLeft.duration(250)
              : FadeIn.duration(250)
          }
          exiting={
            activeTab === 'followers'
              ? SlideOutLeft.duration(250)
              : SlideOutRight.duration(250)
          }
          className="flex-1"
        >
          <FlashList
            data={currentListData}
            renderItem={renderUserItem}
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
        </Animated.View>
      )}
    </View>
  );
}
