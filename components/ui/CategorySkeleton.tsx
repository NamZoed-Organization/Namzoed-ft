import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

export default function CategorySkeleton() {
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
      {/* Section Title Skeleton */}
      <SkeletonBox width="160" height="24" className="mt-2 mb-2" />

      {/* Category Cards Grid Skeleton */}
      <View className="flex flex-row flex-wrap justify-between gap-y-4 mb-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <View
            key={item}
            className="w-[48%] h-56 rounded-2xl overflow-hidden bg-white shadow-sm"
          >
            {/* Image Placeholder */}
            <SkeletonBox height="224" className="w-full" />
          </View>
        ))}
      </View>

      {/* Popular Sub Categories Section */}
      <SkeletonBox width="200" height="24" className="mt-6 mb-4" />

      {/* Sub Category Cards Grid Skeleton */}
      <View className="flex flex-row flex-wrap justify-between gap-y-3 mb-14">
        {[1, 2, 3, 4].map((item) => (
          <View
            key={`sub-${item}`}
            className="w-[48%] bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-100"
          >
            {/* Subcategory name */}
            <SkeletonBox width="80%" height="16" className="mb-2" />
            {/* Items count */}
            <SkeletonBox width="50%" height="12" className="mb-2" />
            {/* Category label */}
            <SkeletonBox width="60%" height="12" />
          </View>
        ))}
      </View>
    </View>
  );
}
