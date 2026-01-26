import { Edit3, Mail, MoreVertical, User } from "lucide-react-native";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle } from "expo-haptics";

interface ProfileHeaderProps {
  profileImage: string | null;
  userName?: string;
  userEmail?: string;
  followerCount: number;
  followingCount: number;
  onAvatarPress: () => void;
  onAvatarMenuPress: () => void;
  onEditProfile: () => void;
  onFollowingPress: () => void;
  onFollowersPress: () => void;
}

export default function ProfileHeader({
  profileImage,
  userName,
  userEmail,
  followerCount,
  followingCount,
  onAvatarPress,
  onAvatarMenuPress,
  onEditProfile,
  onFollowingPress,
  onFollowersPress,
}: ProfileHeaderProps) {
  return (
    <View className="bg-white border-b border-gray-100 px-4 py-8">
      <View className="items-center">
        <View className="relative mb-4">
          <TouchableOpacity
            onPress={onAvatarPress}
            disabled={!profileImage}
            className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center overflow-hidden"
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                className="w-24 h-24 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <User size={32} className="text-gray-400" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(ImpactFeedbackStyle.Light);
              if (profileImage) {
                onAvatarMenuPress();
              } else {
                onEditProfile();
              }
            }}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
          >
            {profileImage ? (
              <MoreVertical size={16} className="text-white" />
            ) : (
              <Edit3 size={16} className="text-white" />
            )}
          </TouchableOpacity>
        </View>

        {userName && (
          <Text className="text-2xl font-mbold text-gray-900 mb-1">
            {userName}
          </Text>
        )}
        {userEmail && (
          <View className="flex-row items-center mb-2">
            <Mail size={16} color="#6B7280" />
            <Text className="text-sm font-regular text-gray-500 ml-1">
              {userEmail}
            </Text>
          </View>
        )}

        <View className="flex-row items-center space-x-6 mt-4">
          <TouchableOpacity className="items-center" onPress={onFollowingPress}>
            <Text className="text-xl font-mbold text-gray-900">
              {followingCount > 999
                ? `${(followingCount / 1000).toFixed(1)}k`
                : followingCount}
            </Text>
            <Text className="text-sm font-regular text-gray-500">
              Following
            </Text>
          </TouchableOpacity>
          <Text className="text-gray-300 text-xl font-light">|</Text>
          <TouchableOpacity className="items-center" onPress={onFollowersPress}>
            <Text className="text-xl font-mbold text-gray-900">
              {followerCount > 999
                ? `${(followerCount / 1000).toFixed(1)}k`
                : followerCount}
            </Text>
            <Text className="text-sm font-regular text-gray-500">
              Followers
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
