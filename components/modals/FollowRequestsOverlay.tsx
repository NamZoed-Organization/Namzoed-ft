import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useAppRouter } from '@/utils/navigation';
import { ArrowDownAZ, ArrowUpAZ, UserCheck, Users, X } from 'lucide-react-native';
import CircularLoader from '@/components/ui/CircularLoader';
import PopupMessage from '@/components/ui/PopupMessage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
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
import { useUser } from "@/contexts/UserContext";
import { fetchFollowers, fetchFollowing, followUser, FollowUser, unfollowUser } from '@/lib/followService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FollowRequestsOverlayProps {
  onClose: () => void;
  userId: string;
  actorUserId?: string;
  initialTab?: TabType;
}

type TabType = 'followers' | 'following';
type SortOrder = 'asc' | 'desc';

export default function FollowRequestsOverlay({
  onClose,
  userId,
  actorUserId,
  initialTab = 'following',
}: FollowRequestsOverlayProps) {
  // States
  const router = useAppRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const resolvedActorUserId = actorUserId || currentUser?.id || userId;
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [viewerFollowerIds, setViewerFollowerIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [popup, setPopup] = useState<{visible: boolean; type: 'error'; title: string; message: string}>({visible: false, type: 'error', title: '', message: ''});
  const showPopup = (title: string, message: string) => setPopup({visible: true, type: 'error', title, message});
  const previousTab = useRef<TabType>('following');

  useEffect(() => {
    loadData();
  }, [userId, resolvedActorUserId]);

  // Reset when switching tabs
  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    previousTab.current = activeTab;
    setActiveTab(tab);
  };

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);

      // Fetch followers and following from Supabase (always desc, will sort locally)
      const [followersData, followingData, viewerFollowers] = await Promise.all([
        fetchFollowers(userId, 'desc'),
        fetchFollowing(userId, 'desc'),
        fetchFollowers(resolvedActorUserId, 'desc'),
      ]);

      setFollowers(followersData);
      setFollowing(followingData);
      setViewerFollowerIds(new Set(viewerFollowers.map((u) => u.id)));

    } catch (error) {
      console.error('Error loading follow data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async (user: FollowUser) => {
    try {
      const result = await followUser(resolvedActorUserId, user.id);
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
        showPopup('Follow Failed', result.error || 'Could not follow this user. Try again.');
      }
    } catch (error) {
      console.error('Error following user:', error);
      showPopup('Follow Failed', 'Could not follow this user. Try again.');
    }
  };

  const handleUnfollow = async (user: FollowUser) => {
    try {
      const result = await unfollowUser(resolvedActorUserId, user.id);
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
        showPopup('Unfollow Failed', result.error || 'Could not unfollow this user. Try again.');
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      showPopup('Unfollow Failed', 'Could not unfollow this user. Try again.');
    }
  };

  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  // Render user item
  const renderUserItem = useCallback(({ item }: { item: FollowUser }) => {
    const isFollowing = activeTab === 'following' ? !item.isUnfollowed : item.isFollowingBack;
    const followsYou = viewerFollowerIds.has(item.id);
    const canShowAction = activeTab === 'following' && item.id !== resolvedActorUserId;

    return (
      <View className={`mx-4 mb-3 ${item.isUnfollowed ? 'opacity-50' : ''}`}>
        <TouchableOpacity
          style={{ borderRadius: 16, borderCurve: "continuous" }}
          className="flex-row items-center bg-white p-4 border border-gray-100"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            <View className="flex-row items-center mt-0.5">
              {item.phone && (
                <Text className="text-gray-500 font-regular text-sm">{item.phone}</Text>
              )}
              {followsYou && (
                <View className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <Text className="text-[10px] font-msemibold text-primary">
                    Follows you
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Button - Only show for Following tab */}
          {canShowAction && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
  }, [activeTab, resolvedActorUserId, viewerFollowerIds]);

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
    <View className="flex-1 bg-[#F8FAFC]" style={{ marginBottom: -insets.bottom, paddingBottom: insets.bottom }}>
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
          <CircularLoader size="large" color="#094569" />
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
      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
      </Modal>
    </View>
  );
}
