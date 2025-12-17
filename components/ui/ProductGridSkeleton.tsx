import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

export default function ProductGridSkeleton() {
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

  return (
    <View>
      {/* Two column grid */}
      <View className="flex-row justify-between mb-3">
        <View className="flex-1 mr-2 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          {/* Image skeleton */}
          <SkeletonBox height="160" className="w-full" />
          {/* Content skeleton */}
          <View className="p-3">
            <SkeletonBox width="80%" height="16" className="mb-2" />
            <SkeletonBox width="100%" height="12" className="mb-1" />
            <SkeletonBox width="60%" height="12" className="mb-3" />
            <SkeletonBox width="50%" height="18" />
          </View>
        </View>

        <View className="flex-1 ml-2 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          {/* Image skeleton */}
          <SkeletonBox height="160" className="w-full" />
          {/* Content skeleton */}
          <View className="p-3">
            <SkeletonBox width="80%" height="16" className="mb-2" />
            <SkeletonBox width="100%" height="12" className="mb-1" />
            <SkeletonBox width="60%" height="12" className="mb-3" />
            <SkeletonBox width="50%" height="18" />
          </View>
        </View>
      </View>

      {/* Second row */}
      <View className="flex-row justify-between mb-3">
        <View className="flex-1 mr-2 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          <SkeletonBox height="160" className="w-full" />
          <View className="p-3">
            <SkeletonBox width="80%" height="16" className="mb-2" />
            <SkeletonBox width="100%" height="12" className="mb-1" />
            <SkeletonBox width="60%" height="12" className="mb-3" />
            <SkeletonBox width="50%" height="18" />
          </View>
        </View>

        <View className="flex-1 ml-2 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          <SkeletonBox height="160" className="w-full" />
          <View className="p-3">
            <SkeletonBox width="80%" height="16" className="mb-2" />
            <SkeletonBox width="100%" height="12" className="mb-1" />
            <SkeletonBox width="60%" height="12" className="mb-3" />
            <SkeletonBox width="50%" height="18" />
          </View>
        </View>
      </View>

      {/* Third row */}
      <View className="flex-row justify-between">
        <View className="flex-1 mr-2 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          <SkeletonBox height="160" className="w-full" />
          <View className="p-3">
            <SkeletonBox width="80%" height="16" className="mb-2" />
            <SkeletonBox width="100%" height="12" className="mb-1" />
            <SkeletonBox width="60%" height="12" className="mb-3" />
            <SkeletonBox width="50%" height="18" />
          </View>
        </View>

        <View className="flex-1 ml-2 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          <SkeletonBox height="160" className="w-full" />
          <View className="p-3">
            <SkeletonBox width="80%" height="16" className="mb-2" />
            <SkeletonBox width="100%" height="12" className="mb-1" />
            <SkeletonBox width="60%" height="12" className="mb-3" />
            <SkeletonBox width="50%" height="18" />
          </View>
        </View>
      </View>
    </View>
  );
}
