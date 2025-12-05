// components/ProductCardSkeleton.tsx
import React from 'react';
import { View } from 'react-native';

interface Props {
  isLeftColumn?: boolean;
}

export default function ProductCardSkeleton({ isLeftColumn = true }: Props) {
  return (
    <View 
      className={`bg-white rounded-xl mb-3 border border-gray-100 flex-1 overflow-hidden ${isLeftColumn ? 'mr-2' : 'ml-2'}`}
    >
      <View className="w-full h-40 bg-gray-200 animate-pulse" />
      <View className="p-3">
        <View className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
        <View className="h-3 bg-gray-100 rounded w-full mb-1 animate-pulse" />
        <View className="h-3 bg-gray-100 rounded w-2/3 mb-3 animate-pulse" />
        <View className="h-5 bg-gray-200 rounded w-1/3 animate-pulse" />
      </View>
    </View>
  );
}