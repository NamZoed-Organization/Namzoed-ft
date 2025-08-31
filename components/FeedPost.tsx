import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Heart, MessageCircle, Bookmark, MoreHorizontal } from "lucide-react-native";
import { PostData } from "@/data/postdata";
import ImageViewer from "@/components/ImageViewer";

interface FeedPostProps {
  post: PostData;
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }
};

const renderImages = (images: string[], onImagePress: (index: number) => void) => {
  if (images.length === 0) return null;
  
  if (images.length === 1) {
    return (
      <View className="mt-3 rounded-lg overflow-hidden">
        <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
          <Image
            source={require('@/assets/images/all.png')}
            className="w-full h-64"
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    );
  }
  
  if (images.length === 2) {
    return (
      <View className="mt-3 flex-row gap-1 rounded-lg overflow-hidden">
        <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9} className="flex-1">
          <Image
            source={require('@/assets/images/all.png')}
            className="w-full h-48"
            resizeMode="cover"
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onImagePress(1)} activeOpacity={0.9} className="flex-1">
          <Image
            source={require('@/assets/images/all.png')}
            className="w-full h-48"
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    );
  }
  
  // For 3 or more images - Facebook layout
  const remainingCount = images.length - 3;
  
  return (
    <View className="mt-3 gap-1 rounded-lg overflow-hidden">
      {/* First row - single large image */}
      <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
        <Image
          source={require('@/assets/images/all.png')}
          className="w-full h-48"
          resizeMode="cover"
        />
      </TouchableOpacity>
      
      {/* Second row - two smaller images */}
      <View className="flex-row gap-1">
        <TouchableOpacity onPress={() => onImagePress(1)} activeOpacity={0.9} className="flex-1">
          <Image
            source={require('@/assets/images/all.png')}
            className="w-full h-32"
            resizeMode="cover"
          />
        </TouchableOpacity>
        
        {/* Third image with overlay if more exist */}
        <TouchableOpacity onPress={() => onImagePress(2)} activeOpacity={0.9} className="flex-1 relative">
          <Image
            source={require('@/assets/images/all.png')}
            className="w-full h-32"
            resizeMode="cover"
          />
          {remainingCount > 0 && (
            <View className="absolute inset-0 bg-black/60 items-center justify-center">
              <Text className="text-white font-bold text-xl">
                +{remainingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function FeedPost({ post }: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikesCount(likesCount - 1);
    } else {
      setIsLiked(true);
      setLikesCount(likesCount + 1);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  return (
    <View className="bg-white border-b border-gray-200">
      {/* Post Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
          {/* Profile Picture */}
          <View className="w-10 h-10 rounded-full bg-gray-300 items-center justify-center mr-3">
            <Text className="text-gray-600 font-semibold">
              {post.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          {/* User Info */}
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-base">
              {post.username}
            </Text>
            <Text className="text-gray-500 text-sm">
              {formatDate(post.date)}
            </Text>
          </View>
        </View>
        
        {/* Three Dots Menu */}
        <TouchableOpacity className="p-2">
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      {/* Post Content */}
      <View className="px-4">
        <Text className="text-gray-900 text-base leading-6">
          {post.content}
        </Text>
      </View>
      
      {/* Post Images */}
      <View className="px-4">
        {renderImages(post.images, handleImagePress)}
      </View>
      
      {/* Action Buttons */}
      <View className="border-t border-gray-200 px-4 py-4">
        <View className="flex-row items-center justify-between">
          {/* Left side - Like and Bookmark */}
          <View className="flex-row items-center">
            <TouchableOpacity 
              className="flex-row items-center mr-6"
              onPress={handleLike}
            >
              <Heart 
                size={20} 
                color={isLiked ? "#e91e63" : "#666"} 
                fill={isLiked ? "#e91e63" : "none"}
                strokeWidth={1.5} 
              />
              <Text className={`ml-1 font-medium ${isLiked ? 'text-pink-600' : 'text-gray-600'}`}>
                {likesCount}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={handleBookmark}
            >
              <Bookmark 
                size={20} 
                color={isBookmarked ? "#1976d2" : "#666"} 
                fill={isBookmarked ? "#1976d2" : "none"}
                strokeWidth={1.5} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Right side - Message */}
          <TouchableOpacity className="flex-row items-center">
            <MessageCircle size={20} color="#666" strokeWidth={1.5} />
            <Text className="ml-2 text-gray-600 font-medium">Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Viewer Modal */}
      <ImageViewer
        visible={showImageViewer}
        images={post.images}
        initialIndex={selectedImageIndex}
        onClose={() => setShowImageViewer(false)}
      />
    </View>
  );
}