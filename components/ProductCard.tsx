// components/ProductCard.tsx
import { ProductWithUser } from "@/lib/productsService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface Props {
  product: ProductWithUser;
  isLeftColumn?: boolean;
}

export default function ProductCard({ product, isLeftColumn = true }: Props) {
  const router = useRouter();

  const hasImages = product.images && product.images.length > 0;
  const mainImage = hasImages ? { uri: product.images[0] } : null;

  return (
    <TouchableOpacity
      className={`bg-white rounded-xl mb-3 shadow-sm border border-gray-100 flex-1 overflow-hidden ${
        isLeftColumn ? "mr-2" : "ml-2"
      }`}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.9}
    >
      {mainImage ? (
        <Image
          source={mainImage}
          className="w-full h-40 bg-gray-100"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-40 bg-gray-200 items-center justify-center">
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        </View>
      )}
      <View className="p-3">
        <Text
          className="text-sm font-semibold text-gray-900 mb-1"
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <Text className="text-xs text-gray-500 mb-2" numberOfLines={2}>
          {product.description}
        </Text>
        <Text className="text-base font-bold text-primary">
          Nu. {product.price.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}