// Path: components/FeaturedSellers.tsx

import users from '@/data/UserData';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // Account for padding and gap

interface User {
  username: string;
  phone_number: string;
  password: string;
  followers: number;
  following: number;
  profileImg: any;
  products?: Array<{
    name: string;
    productImg: any;
  }>;
}

interface UserWithKey extends User {
  key: string;
}

// Skeleton Card Component
const SkeletonCard = () => (
  <View 
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4"
    style={{ width: cardWidth }}
  >
    <View className="items-center mb-3">
      <View className="w-16 h-16 bg-gray-200 rounded-full animate-pulse mb-2" />
      <View className="w-20 h-4 bg-gray-200 rounded animate-pulse mb-1" />
      <View className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
    </View>
    
    <View className="flex-row justify-between mb-3">
      <View className="items-center">
        <View className="w-8 h-4 bg-gray-200 rounded animate-pulse mb-1" />
        <View className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
      </View>
      <View className="items-center">
        <View className="w-8 h-4 bg-gray-200 rounded animate-pulse mb-1" />
        <View className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
      </View>
    </View>
    
    <View className="w-full h-8 bg-gray-200 rounded-lg animate-pulse" />
  </View>
);

// User Card Component
const UserCard = ({ user, onPress, onFollow }: { 
  user: UserWithKey; 
  onPress: () => void;
  onFollow: () => void;
}) => (
  <TouchableOpacity
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4"
    style={{ width: cardWidth }}
    onPress={onPress}
    activeOpacity={0.7}
  >
    {/* Profile Section */}
    <View className="items-center mb-3">
      <Image
        source={user.profileImg}
        className="w-16 h-16 rounded-full mb-2"
        resizeMode="cover"
      />
      <Text className="text-sm font-msemibold text-gray-900 text-center" numberOfLines={1}>
        @{user.username}
      </Text>
      <Text className="text-xs font-regular text-gray-500">
        {user.products?.length || 0} products
      </Text>
    </View>

    {/* Stats Section */}
    <View className="flex-row justify-between mb-3">
      <View className="items-center">
        <Text className="text-sm font-mbold text-gray-900">
          {user.followers > 999 ? `${(user.followers / 1000).toFixed(1)}k` : user.followers}
        </Text>
        <Text className="text-xs font-regular text-gray-500">Followers</Text>
      </View>
      <View className="items-center">
        <Text className="text-sm font-mbold text-gray-900">
          {user.following > 999 ? `${(user.following / 1000).toFixed(1)}k` : user.following}
        </Text>
        <Text className="text-xs font-regular text-gray-500">Following</Text>
      </View>
    </View>

    {/* Follow Button */}
    <TouchableOpacity
      className="bg-primary rounded-lg py-2 px-4 items-center"
      onPress={(e) => {
        e.stopPropagation();
        onFollow();
      }}
      activeOpacity={0.8}
    >
      <Text className="text-white font-msemibold text-sm">Follow</Text>
    </TouchableOpacity>
  </TouchableOpacity>
);

const FeaturedSellers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserWithKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserWithKey[]>([]);

  // Convert users object to array with keys
  useEffect(() => {
    const usersArray = Object.keys(users).map(key => ({
      ...users[key as keyof typeof users],
      key
    }));
    setAllUsers(usersArray);
    setFilteredUsers(usersArray);
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    const timer = setTimeout(() => {
      setIsLoading(true);
      
      // Simulate search delay
      setTimeout(() => {
        if (query.trim() === '') {
          setFilteredUsers(allUsers);
        } else {
          const filtered = allUsers.filter(user =>
            user.username.toLowerCase().includes(query.toLowerCase()) ||
            user.products?.some(product => 
              product.name.toLowerCase().includes(query.toLowerCase())
            )
          );
          setFilteredUsers(filtered);
        }
        setIsLoading(false);
      }, 800); // Simulate network delay
    }, 2000); // 2 second debounce

    return timer;
  }, [allUsers]);

  // Handle search input
  useEffect(() => {
    if (searchQuery !== '') {
      setIsLoading(true);
    }
    
    const timer = debouncedSearch(searchQuery);
    
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, debouncedSearch]);

  const handleUserPress = (user: UserWithKey) => {
    router.push(`/(users)/profile/${user.phone_number}`);
  };

  const handleFollow = (user: UserWithKey) => {
    // Handle follow logic here
    console.log(`Following ${user.username}`);
  };

  const renderUser = ({ item }: { item: UserWithKey }) => (
    <UserCard
      user={item}
      onPress={() => handleUserPress(item)}
      onFollow={() => handleFollow(item)}
    />
  );

  const renderSkeleton = () => (
    <FlatList
      data={Array(6).fill(null)}
      renderItem={() => <SkeletonCard />}
      keyExtractor={(_, index) => `skeleton-${index}`}
      numColumns={2}
      columnWrapperStyle={{ justifyContent: 'space-between' }}
      scrollEnabled={false}
    />
  );

  return (
    <View className="flex-1 bg-background px-4">
      {/* Header */}
      <View className="mb-4 pt-4">
        <Text className="text-sm font-regular text-gray-500">
          Discover amazing sellers and their products
        </Text>
      </View>

      {/* Search Bar */}
      <View className="mb-4">
        <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center">
          <Text className="text-gray-400 mr-3 text-lg">🔍</Text>
          <TextInput
            className="flex-1 text-base font-regular text-gray-900"
            placeholder="Search sellers or products..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {isLoading && (
            <View className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </View>
      </View>

      {/* Results Count */}
      {!isLoading && (
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-sm font-medium text-gray-700">
            {filteredUsers.length} sellers found
          </Text>
          {searchQuery !== '' && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setFilteredUsers(allUsers);
              }}
            >
              <Text className="text-sm font-medium text-primary">Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      <View className="flex-1">
        {isLoading ? (
          renderSkeleton()
        ) : filteredUsers.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-6xl mb-4">🔍</Text>
            <Text className="text-lg font-msemibold text-gray-700 mb-2">
              No sellers found
            </Text>
            <Text className="text-sm font-regular text-gray-500 text-center">
              Try adjusting your search terms or browse all sellers
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUser}
            keyExtractor={(item) => item.key}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </View>
  );
};

export default FeaturedSellers;