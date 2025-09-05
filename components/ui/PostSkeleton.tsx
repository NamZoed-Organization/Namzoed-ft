import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

interface PostSkeletonProps {
  hasImages?: boolean;
  imageCount?: number;
}

export default function PostSkeleton({ hasImages = true, imageCount = 1 }: PostSkeletonProps) {
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerOpacity]);

  const SkeletonBox = ({ width, height, className }: { width?: string; height?: string; className?: string }) => (
    <Animated.View
      className={`bg-gray-300 rounded ${className}`}
      style={{
        opacity: shimmerOpacity,
        width: width || "100%",
        height: height ? parseInt(height) : 16,
      }}
    />
  );

  const renderImageSkeleton = () => {
    if (!hasImages) return null;

    if (imageCount === 1) {
      return (
        <View className="mt-3 rounded-lg overflow-hidden">
          <SkeletonBox height="256" className="w-full" />
        </View>
      );
    }

    if (imageCount === 2) {
      return (
        <View className="mt-3 flex-row gap-1 rounded-lg overflow-hidden">
          <SkeletonBox height="192" className="flex-1" />
          <SkeletonBox height="192" className="flex-1" />
        </View>
      );
    }

    // For 3 or more images
    return (
      <View className="mt-3 gap-1 rounded-lg overflow-hidden">
        <SkeletonBox height="192" className="w-full" />
        <View className="flex-row gap-1">
          <SkeletonBox height="128" className="flex-1" />
          <SkeletonBox height="128" className="flex-1" />
        </View>
      </View>
    );
  };

  return (
    <View className="bg-white border-b border-gray-200">
      {/* Post Header Skeleton */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
          {/* Profile Picture Skeleton */}
          <SkeletonBox width="40" height="40" className="rounded-full mr-3" />
          
          {/* User Info Skeleton */}
          <View className="flex-1">
            <SkeletonBox width="120" height="16" className="mb-2" />
            <SkeletonBox width="60" height="12" />
          </View>
        </View>
        
        {/* Three Dots Menu Skeleton */}
        <SkeletonBox width="20" height="20" className="rounded" />
      </View>
      
      {/* Post Content Skeleton */}
      <View className="px-4">
        <SkeletonBox width="100%" height="16" className="mb-2" />
        <SkeletonBox width="80%" height="16" className="mb-2" />
        <SkeletonBox width="60%" height="16" />
      </View>
      
      {/* Post Images Skeleton */}
      <View className="px-4">
        {renderImageSkeleton()}
      </View>
      
      {/* Action Buttons Skeleton */}
      <View className="border-t border-gray-200 px-4 py-4 mt-4">
        <View className="flex-row items-center justify-between">
          {/* Left side - Like and Bookmark */}
          <View className="flex-row items-center">
            <View className="flex-row items-center mr-6">
              <SkeletonBox width="20" height="20" className="rounded mr-1" />
              <SkeletonBox width="20" height="16" />
            </View>
            <SkeletonBox width="20" height="20" className="rounded" />
          </View>
          
          {/* Right side - Message */}
          <View className="flex-row items-center">
            <SkeletonBox width="20" height="20" className="rounded mr-2" />
            <SkeletonBox width="60" height="16" />
          </View>
        </View>
      </View>
    </View>
  );
}