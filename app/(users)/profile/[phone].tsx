// Path: app/(users)/profile/[phone].tsx

import users from '@/data/UserData';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const productCardWidth = (width - 48) / 2;

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

interface Product {
  name: string;
  productImg: any;
}

const UserProfileScreen = () => {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'about'>('products');

  useEffect(() => {
    if (phone) {
      // Find user by phone number
      const foundUser = Object.values(users).find(user => user.phone_number === phone);
      setUser(foundUser || null);
    }
  }, [phone]);

  const handleCallPress = () => {
    if (user?.phone_number) {
      Alert.alert(
        "Call User",
        `Call ${user.username} at ${user.phone_number}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Call", 
            onPress: () => Linking.openURL(`tel:${user.phone_number}`)
          }
        ]
      );
    }
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleFollowPress = () => {
    setIsFollowing(!isFollowing);
    // Handle follow/unfollow logic here
  };

  const renderProductCard = ({ item, index }: { item: Product; index: number }) => (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4"
      style={{ width: productCardWidth }}
      activeOpacity={0.7}
    >
      <Image
        source={item.productImg}
        className="w-full h-32 rounded-t-xl"
        resizeMode="cover"
      />
      <View className="p-3">
        <Text className="text-sm font-msemibold text-gray-900" numberOfLines={2}>
          {item.name}
        </Text>
        <TouchableOpacity
          className="bg-primary/10 rounded-lg py-2 px-3 items-center mt-2"
          activeOpacity={0.8}
        >
          <Text className="text-primary font-medium text-xs">
            View Product
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View className="flex-1 bg-background">
        {/* Back Button */}
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
          <TouchableOpacity
            onPress={handleBackPress}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 mr-3"
            activeOpacity={0.7}
          >
            <Text className="text-gray-700 font-bold text-lg">←</Text>
          </TouchableOpacity>
          <Text className="text-lg font-msemibold text-gray-900">Profile</Text>
        </View>
        
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-mbold text-gray-700">
            User Not Found
          </Text>
          <Text className="text-sm font-regular text-gray-500 text-center mt-2">
            The requested user profile could not be found.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Back Button Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={handleBackPress}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 mr-3"
          activeOpacity={0.7}
        >
          <Text className="text-gray-700 font-bold text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-lg font-msemibold text-gray-900">@{user.username}</Text>
      </View>
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-white border-b border-gray-100 px-4 py-6">
          <View className="items-center mb-4">
            <Image
              source={user.profileImg}
              className="w-24 h-24 rounded-full mb-4"
              resizeMode="cover"
            />
            <Text className="text-2xl font-mbold text-gray-900 mb-1">
              @{user.username}
            </Text>
            <Text className="text-sm font-regular text-gray-500 mb-4">
              📞 {user.phone_number}
            </Text>

            {/* Stats */}
            <View className="flex-row items-center space-x-8 mb-6">
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">
                  {user.products?.length || 0}
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Products
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">
                  {user.followers > 999 ? `${(user.followers / 1000).toFixed(1)}k` : user.followers}
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Followers
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">
                  {user.following > 999 ? `${(user.following / 1000).toFixed(1)}k` : user.following}
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Following
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row space-x-3 w-full">
              <TouchableOpacity
                className={`flex-1 rounded-xl py-3 px-4 items-center ${
                  isFollowing ? 'bg-gray-100' : 'bg-primary'
                }`}
                onPress={handleFollowPress}
                activeOpacity={0.8}
              >
                <Text className={`font-msemibold ${
                  isFollowing ? 'text-gray-700' : 'text-white'
                }`}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-gray-800 rounded-xl py-3 px-4 items-center"
                onPress={handleCallPress}
                activeOpacity={0.8}
              >
                <Text className="text-white font-msemibold">
                  📞 Call
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View className="bg-white border-b border-gray-100">
          <View className="flex-row">
            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'products' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('products')}
            >
              <Text className={`font-msemibold ${
                activeTab === 'products' ? 'text-primary' : 'text-gray-500'
              }`}>
                Products ({user.products?.length || 0})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'about' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('about')}
            >
              <Text className={`font-msemibold ${
                activeTab === 'about' ? 'text-primary' : 'text-gray-500'
              }`}>
                About
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 py-4">
          {activeTab === 'products' ? (
            user.products && user.products.length > 0 ? (
              <FlatList
                data={user.products}
                renderItem={renderProductCard}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="items-center justify-center py-12">
                <Text className="text-6xl mb-4">📦</Text>
                <Text className="text-lg font-msemibold text-gray-700 mb-2">
                  No Products Yet
                </Text>
                <Text className="text-sm font-regular text-gray-500 text-center">
                  This seller hasn't added any products yet.
                </Text>
              </View>
            )
          ) : (
            <View className="bg-white rounded-xl p-6">
              <Text className="text-lg font-msemibold text-gray-900 mb-4">
                About {user.username}
              </Text>
              
              <View className="space-y-4">
                <View className="flex-row items-center">
                  <Text className="text-gray-500 font-medium w-20">Phone:</Text>
                  <Text className="text-gray-900 font-regular flex-1">
                    {user.phone_number}
                  </Text>
                </View>
                
                <View className="flex-row items-center">
                  <Text className="text-gray-500 font-medium w-20">Joined:</Text>
                  <Text className="text-gray-900 font-regular flex-1">
                    Member since 2024
                  </Text>
                </View>
                
                <View className="flex-row items-center">
                  <Text className="text-gray-500 font-medium w-20">Status:</Text>
                  <View className="bg-green-100 px-2 py-1 rounded-full">
                    <Text className="text-green-600 font-medium text-xs">
                      ✓ Active Seller
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
};

export default UserProfileScreen;