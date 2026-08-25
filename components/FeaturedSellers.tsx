import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { followUser, getFollowingIds, unfollowUser } from '@/lib/followService';
import { FeaturedSellerProfile, fetchFeaturedSellers, fetchRandomSellers } from '@/lib/profileService';
import * as Haptics from 'expo-haptics';
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from '@/utils/initials';
import { Image } from 'expo-image';
import { Clock, MapPin, Package, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

type SortOption = 'near_me' | 'most_products' | 'followed';

// User Card Component
const UserCard = ({ user, onPress, onFollow, onUnfollow, isFollowed }: {
  user: FeaturedSellerProfile;
  onPress: () => void;
  onFollow: () => void;
  onUnfollow: () => void;
  isFollowed: boolean;
}) => (
  <TouchableOpacity
    className="bg-white rounded-lg shadow-sm border border-gray-100 p-2 mb-2"
    style={{ width: cardWidth }}
    onPress={onPress}
    activeOpacity={0.7}
  >
    {/* Profile Section */}
    <View className="items-center mb-3">
      {user.avatar_url ? (
        <Image
          source={{ uri: user.avatar_url }}
          className="w-16 h-16 rounded-full mb-2"
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View className="w-16 h-16 bg-[#e0e7ef] rounded-full items-center justify-center mb-2">
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#094569' }}>
            {getInitials(user.name)}
          </Text>
        </View>
      )}
      <Text className="text-sm font-msemibold text-gray-900 text-center" numberOfLines={1}>
        {user.name || 'Unknown User'}
      </Text>
      {user.dzongkhag && (
        <Text className="text-xs font-regular text-gray-500 text-center" numberOfLines={1}>
          {user.dzongkhag}
        </Text>
      )}
      <Text className="text-xs font-regular text-gray-500 text-center">
        {user.product_count || 0} products
      </Text>
    </View>

    {/* Stats Section */}
    <View className="flex-row justify-between mb-3">
      <View className="items-center">
        <Text className="text-sm font-mbold text-gray-900">
          {user.follower_count > 999
            ? `${(user.follower_count / 1000).toFixed(1)}k`
            : user.follower_count}
        </Text>
        <Text className="text-xs font-regular text-gray-500">Followers</Text>
      </View>
      <View className="items-center">
        <Text className="text-sm font-mbold text-gray-900">
          {user.following_count > 999
            ? `${(user.following_count / 1000).toFixed(1)}k`
            : user.following_count}
        </Text>
        <Text className="text-xs font-regular text-gray-500">Following</Text>
      </View>
    </View>

    {/* Follow Button */}
    <TouchableOpacity
      className={`rounded-lg py-2 px-4 items-center ${
        isFollowed ? 'bg-gray-100 border border-gray-300' : 'bg-primary'
      }`}
      onPress={(e) => {
        e.stopPropagation();
        if (isFollowed) {
          onUnfollow();
        } else {
          onFollow();
        }
      }}
      activeOpacity={0.8}
    >
      <Text className={`font-msemibold text-sm ${
        isFollowed ? 'text-gray-600' : 'text-white'
      }`}>
        {isFollowed ? 'Followed' : 'Follow'}
      </Text>
    </TouchableOpacity>
  </TouchableOpacity>
);

const FeaturedSellers = () => {
  const router = useAppRouter();
  const { currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<FeaturedSellerProfile[]>([]);
  const [popup, setPopup] = useState<{visible: boolean; type: 'success'|'warning'|'error'|'white'; title: string; message: string}>({visible: false, type: 'white', title: '', message: ''});
  const showPopup = (type: 'success'|'warning'|'error'|'white', title: string, message: string) => setPopup({visible: true, type, title, message});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [newlyFollowedIds, setNewlyFollowedIds] = useState<string[]>([]);
  const [unfollowedIds, setUnfollowedIds] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState<SortOption>('near_me');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const PAGE_SIZE = 10;

  // Load following IDs on mount
  useEffect(() => {
    const loadFollowingIds = async () => {
      if (currentUser?.id) {
        const ids = await getFollowingIds(currentUser.id);
        setFollowingIds([...ids, currentUser.id]);
      }
    };
    loadFollowingIds();
  }, [currentUser?.id]);

  // Load users function
  const loadUsers = async (isLoadMore: boolean = false) => {
    if (loading) return;

    try {
      setLoading(true);
      if (!isLoadMore) setUsers([]);
      const currentPage = isLoadMore ? page + 1 : 0;
      const offset = currentPage * PAGE_SIZE;

      // Determine which users to exclude based on filter and search state
      let excludeIds: string[] = [];

      if (searchQuery.trim() !== '') {
        // When searching: Only exclude current user, show all others (including followed)
        excludeIds = [currentUser?.id || ''];
      } else if (activeSort === 'followed') {
        // "Followed" filter: Only exclude current user, will filter to show followed later
        excludeIds = [currentUser?.id || ''];
      } else {
        // "All", "Near Me", "Top Sellers" filters: Exclude current user + all followed users
        excludeIds = [...followingIds];
      }

      // Ensure current user is ALWAYS excluded (defensive check)
      if (currentUser?.id && !excludeIds.includes(currentUser.id)) {
        excludeIds.push(currentUser.id);
      }

      let fetchedUsers = await fetchFeaturedSellers(
        PAGE_SIZE,
        offset,
        searchQuery,
        excludeIds.filter(id => id !== ''),
        activeSort === 'most_products' ? undefined : (currentUser?.dzongkhag || undefined)
      );

      // Apply filter-specific logic
      if (activeSort === 'most_products') {
        fetchedUsers.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
      } else if (activeSort === 'followed') {
        // Show only followed users (excluding current user)
        fetchedUsers = fetchedUsers.filter(u =>
          followingIds.includes(u.id) && u.id !== currentUser?.id
        );
      }

      // If less than 10 users on first page, fill with random users
      // Don't fill when: 1) "followed" filter, 2) searching (show only search results)
      if (fetchedUsers.length < PAGE_SIZE && currentPage === 0 && activeSort !== 'followed' && searchQuery.trim() === '') {
        const remaining = PAGE_SIZE - fetchedUsers.length;
        const existingIds = [...fetchedUsers.map(u => u.id), ...followingIds];
        const randomUsers = await fetchRandomSellers(existingIds, remaining);
        fetchedUsers.push(...randomUsers);
      }

      if (isLoadMore) {
        setUsers(prev => [...prev, ...fetchedUsers]);
      } else {
        setUsers(fetchedUsers);
      }

      setPage(currentPage);
      setHasMore(fetchedUsers.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading users:', error);
      showPopup('error', 'Load Failed', 'Failed to load sellers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load - only runs once when followingIds are loaded
  useEffect(() => {
    if (followingIds.length > 0 && !initialLoadDone) {
      loadUsers(false);
      setInitialLoadDone(true);
    }
  }, [followingIds, initialLoadDone]);

  // Reload when filters or search changes (but not when following/unfollowing)
  useEffect(() => {
    if (!initialLoadDone) return; // Wait for initial load

    const timer = setTimeout(() => {
      loadUsers(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, activeSort, initialLoadDone]);

  const handleUserPress = (user: FeaturedSellerProfile) => {
    router.push(`/(users)/profile/${user.id}` as any);
  };

  const handleFollow = async (user: FeaturedSellerProfile) => {
    if (!currentUser?.id) {
      showPopup('warning', 'Login Required', 'Please log in to follow users.');
      return;
    }

    try {
      const result = await followUser(currentUser.id, user.id);

      if (result.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Add to newly followed IDs for UI update
        setNewlyFollowedIds(prev => [...prev, user.id]);
        // Update following IDs (will trigger reload on filter/search change)
        setFollowingIds(prev => [...prev, user.id]);
        // Remove from unfollowed list if re-following
        setUnfollowedIds(prev => prev.filter(id => id !== user.id));
      } else {
        showPopup('error', 'Follow Failed', result.error || 'Failed to follow user.');
      }
    } catch (error) {
      console.error('Error following user:', error);
      showPopup('error', 'Follow Failed', 'Could not follow this user. Please try again.');
    }
  };

  const handleUnfollow = async (user: FeaturedSellerProfile) => {
    if (!currentUser?.id) {
      showPopup('warning', 'Login Required', 'Please log in to unfollow users.');
      return;
    }

    try {
      const result = await unfollowUser(currentUser.id, user.id);

      if (result.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Mark as unfollowed (soft delete - keeps visible until reload)
        setUnfollowedIds(prev => [...prev, user.id]);
        // Remove from newly followed list if was just followed
        setNewlyFollowedIds(prev => prev.filter(id => id !== user.id));
        // Remove from following IDs
        setFollowingIds(prev => prev.filter(id => id !== user.id));
      } else {
        showPopup('error', 'Unfollow Failed', result.error || 'Failed to unfollow user.');
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      showPopup('error', 'Unfollow Failed', 'Could not unfollow this user. Please try again.');
    }
  };

  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const getFilterIcon = () => {
    switch (activeSort) {
      case 'near_me': return MapPin;
      case 'most_products': return Package;
      case 'followed': return Clock;
      default: return MapPin;  // Default to MapPin (Near Me is default filter)
    }
  };

  return (
    <View className="bg-background px-4">
      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
      </Modal>
      {/* Header */}
      <View className="mb-4 pt-4">
        <Text className="text-sm font-regular text-gray-500">
          Discover amazing sellers and their products
        </Text>
      </View>

      {/* Backdrop overlay to close dropdown when clicking outside */}
      {showFilterMenu && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowFilterMenu(false)}
          className="absolute inset-0 z-10"
          style={{ backgroundColor: 'transparent' }}
        />
      )}

      {/* Search Bar with Filter Button */}
      <View className="mb-4 flex-row gap-2 relative" style={{ zIndex: 1000 }}>
        <View className="flex-1 gap-2 bg-white rounded-xl border border-gray-200 px-3 flex-row items-center">
          <Search size={18} className="text-gray-400 mr-2" />
          <TextInput
            className="flex-1 text-sm font-regular text-gray-900"
            placeholder="Search sellers..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} className="text-gray-400" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Dropdown Button */}
        <View>
          <TouchableOpacity
            onPress={() => setShowFilterMenu(!showFilterMenu)}
            className="bg-white rounded-xl border border-gray-200 px-3.5 items-center justify-center"
            style={{ height: 44 }}
          >
            {React.createElement(getFilterIcon(), { size: 18, color: '#094569' })}
          </TouchableOpacity>

          {/* Filter Dropdown Menu */}
          {showFilterMenu && (
            <View
              className="absolute top-full right-0 mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg"
              style={{ zIndex: 10000, minWidth: 180, elevation: 10 }}
            >
              <TouchableOpacity
                onPress={() => {
                  setActiveSort('near_me');
                  setShowFilterMenu(false);
                  setSearchQuery('');
                }}
                className={`flex-row items-center px-4 py-3 ${activeSort === 'near_me' ? 'bg-primary/10' : ''}`}
              >
                <MapPin size={16} color={activeSort === 'near_me' ? '#094569' : '#666'} />
                <Text className={`ml-3 text-sm font-medium ${activeSort === 'near_me' ? 'text-primary' : 'text-gray-700'}`}>
                  Near Me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setActiveSort('most_products');
                  setShowFilterMenu(false);
                  setSearchQuery('');
                }}
                className={`flex-row items-center px-4 py-3 border-t border-gray-100 ${activeSort === 'most_products' ? 'bg-primary/10' : ''}`}
              >
                <Package size={16} color={activeSort === 'most_products' ? '#094569' : '#666'} />
                <Text className={`ml-3 text-sm font-medium ${activeSort === 'most_products' ? 'text-primary' : 'text-gray-700'}`}>
                  Top Sellers
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setActiveSort('followed');
                  setShowFilterMenu(false);
                  setSearchQuery('');
                }}
                className={`flex-row items-center px-4 py-3 border-t border-gray-100 ${activeSort === 'followed' ? 'bg-primary/10' : ''}`}
              >
                <Clock size={16} color={activeSort === 'followed' ? '#094569' : '#666'} />
                <Text className={`ml-3 text-sm font-medium ${activeSort === 'followed' ? 'text-primary' : 'text-gray-700'}`}>
                  Followed
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Results Count */}
      {searchQuery !== '' && !loading && (
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-sm font-medium text-gray-700">
            {users.length} results
          </Text>
        </View>
      )}

      {/* Content */}
      <View>
        {loading && users.length === 0 ? (
          <View className="items-center justify-center py-12">
            <CircularLoader size="large" color="#094569" />
            <Text className="text-sm text-gray-500 mt-2">Loading sellers...</Text>
          </View>
        ) : users.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Search size={48} className="text-gray-300 mb-4" />
            <Text className="text-lg font-msemibold text-gray-700 mb-2">
              No sellers found
            </Text>
            <Text className="text-sm font-regular text-gray-500 text-center">
              Try adjusting your search terms or filters
            </Text>
          </View>
        ) : (
          <View className='flex justify-center items-center'>
            {Array.from({ length: Math.ceil(users.length / 2) }, (_, rowIndex) => {
              const rowUsers = users.slice(rowIndex * 2, rowIndex * 2 + 2);
              return (
                <View key={rowIndex} className=" gap-2 flex-row">
                  {rowUsers.map((user) => {
                    const isFollowed = (followingIds.includes(user.id) || newlyFollowedIds.includes(user.id)) && !unfollowedIds.includes(user.id);
                    return (
                      <UserCard
                        key={user.id}
                        user={user}
                        onPress={() => handleUserPress(user)}
                        onFollow={() => handleFollow(user)}
                        onUnfollow={() => handleUnfollow(user)}
                        isFollowed={isFollowed}
                      />
                    );
                  })}
                  {rowUsers.length === 1 && <View style={{ width: cardWidth }} />}
                </View>
              );
            })}
            {hasMore && (
              <TouchableOpacity
                onPress={() => loadUsers(true)}
                disabled={loading}
                className={`rounded-lg py-3 px-6 items-center mx-auto mb-4 mt-2 ${loading ? 'bg-gray-300' : 'bg-primary'}`}
              >
                {loading ? (
                  <CircularLoader size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Show More</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default FeaturedSellers;
