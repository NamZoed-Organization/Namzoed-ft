import React from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { Heart, MessageCircle, Bookmark, Video, MoreHorizontal } from "lucide-react-native";

interface MediaItem {
  uri: string;
  type: 'image' | 'video';
  id: string;
}

interface PostPreviewProps {
  text: string;
  media: MediaItem[];
  userProfile?: {
    username: string;
    profilePic?: string;
  };
  isSellingPost?: boolean;
  sellData?: {
    title: string;
    price: string;
    category: string;
    location: string;
  };
}

export default function PostPreview({
  text,
  media,
  userProfile = { username: "You" },
  isSellingPost = false,
  sellData
}: PostPreviewProps) {
  const renderMediaGrid = () => {
    if (media.length === 0) return null;

    if (media.length === 1) {
      return (
        <View className="mt-3 rounded-lg overflow-hidden relative">
          <Image
            source={{ uri: media[0].uri }}
            className="w-full h-64"
            resizeMode="cover"
          />
          {media[0].type === 'video' && (
            <View className="absolute inset-0 items-center justify-center">
              <View className="bg-black/60 rounded-full p-3">
                <Video size={32} color="white" />
              </View>
            </View>
          )}
        </View>
      );
    }

    if (media.length === 2) {
      return (
        <View className="mt-3 flex-row gap-1 rounded-lg overflow-hidden">
          {media.slice(0, 2).map((item) => (
            <View key={item.id} className="flex-1 relative">
              <Image
                source={{ uri: item.uri }}
                className="w-full h-48"
                resizeMode="cover"
              />
              {item.type === 'video' && (
                <View className="absolute inset-0 items-center justify-center">
                  <View className="bg-black/60 rounded-full p-2">
                    <Video size={20} color="white" />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      );
    }

    // For 3 or more media items
    const remainingCount = media.length - 3;
    
    return (
      <View className="mt-3 gap-1 rounded-lg overflow-hidden">
        {/* First row - single large media */}
        <View className="relative">
          <Image
            source={{ uri: media[0].uri }}
            className="w-full h-48"
            resizeMode="cover"
          />
          {media[0].type === 'video' && (
            <View className="absolute inset-0 items-center justify-center">
              <View className="bg-black/60 rounded-full p-2">
                <Video size={24} color="white" />
              </View>
            </View>
          )}
        </View>
        
        {/* Second row - two smaller media */}
        <View className="flex-row gap-1">
          <View className="flex-1 relative">
            <Image
              source={{ uri: media[1].uri }}
              className="w-full h-32"
              resizeMode="cover"
            />
            {media[1].type === 'video' && (
              <View className="absolute inset-0 items-center justify-center">
                <View className="bg-black/60 rounded-full p-1">
                  <Video size={16} color="white" />
                </View>
              </View>
            )}
          </View>
          
          {/* Third media with overlay if more exist */}
          <View className="flex-1 relative">
            <Image
              source={{ uri: media[2].uri }}
              className="w-full h-32"
              resizeMode="cover"
            />
            {media[2].type === 'video' && (
              <View className="absolute inset-0 items-center justify-center">
                <View className="bg-black/60 rounded-full p-1">
                  <Video size={16} color="white" />
                </View>
              </View>
            )}
            {remainingCount > 0 && (
              <View className="absolute inset-0 bg-black/60 items-center justify-center">
                <Text className="text-white font-bold text-xl">
                  +{remainingCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg mx-4 mb-4">
      <Text className="text-sm font-medium text-gray-600 px-4 pt-3 pb-2">Preview</Text>
      
      {/* Post Header */}
      <View className="flex-row items-center justify-between px-4 pb-3">
        <View className="flex-row items-center flex-1">
          {/* Profile Picture */}
          <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
            <Text className="text-white font-semibold">
              {userProfile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          {/* User Info */}
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-base">
              {userProfile.username}
            </Text>
            <Text className="text-gray-500 text-sm">
              Just now
            </Text>
          </View>
        </View>
        
        {/* Three Dots Menu */}
        <MoreHorizontal size={20} color="#666" />
      </View>
      
      {/* Post Content */}
      <View className="px-4">
        {isSellingPost && sellData && (
          <View className="mb-2">
            <Text className="text-lg font-semibold text-gray-900 mb-1">
              {sellData.title}
            </Text>
            <Text className="text-xl font-bold text-primary mb-1">
              BTN {sellData.price}
            </Text>
            <View className="flex-row items-center mb-2">
              <Text className="text-sm text-gray-600 capitalize">
                {sellData.category}
              </Text>
              {sellData.location && (
                <>
                  <Text className="text-sm text-gray-400 mx-2">•</Text>
                  <Text className="text-sm text-gray-600">
                    {sellData.location}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
        
        {text && (
          <Text className="text-gray-900 text-base leading-6 mb-2">
            {text}
          </Text>
        )}
      </View>
      
      {/* Post Media */}
      <View className="px-4">
        {renderMediaGrid()}
      </View>
      
      {/* Action Buttons */}
      <View className="border-t border-gray-200 px-4 py-3 mt-3">
        <View className="flex-row items-center justify-between">
          {/* Left side - Like and Bookmark */}
          <View className="flex-row items-center">
            <View className="flex-row items-center mr-6">
              <Heart size={20} color="#666" strokeWidth={1.5} />
              <Text className="ml-1 font-medium text-gray-600">0</Text>
            </View>
            
            <Bookmark size={20} color="#666" strokeWidth={1.5} />
          </View>
          
          {/* Right side - Message */}
          <View className="flex-row items-center">
            <MessageCircle size={20} color="#666" strokeWidth={1.5} />
            <Text className="ml-2 text-gray-600 font-medium">Message</Text>
          </View>
        </View>
      </View>
    </View>
  );
}