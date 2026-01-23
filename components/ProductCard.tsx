// components/ProductCard.tsx
import { ProductWithUser } from "@/lib/productsService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import CountdownTimer from "./CountdownTimer";

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
      className={`bg-white rounded-xl mb-3 shadow-sm border border-gray-100 flex-1 ${
        isLeftColumn ? "mr-2" : "ml-2"
      }`}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.9}
    >
      {/* Image with padding inside card */}
      <View className="p-2">
        <View className="relative overflow-hidden rounded-lg">
          {mainImage ? (
            <Image
              source={mainImage}
              className="w-full h-44 bg-gray-100"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-44 bg-gray-200 items-center justify-center rounded-lg">
              <Ionicons name="image-outline" size={32} color="#9CA3AF" />
            </View>
          )}

          {/* Discount Badge Overlay - Closing Sale for Food, Regular for others */}
          {product.is_currently_active && (
            product.category === 'food' ? (
              <View className="absolute top-2 left-2 bg-amber-500 px-2 py-1 rounded-md shadow-lg flex-row items-center gap-1">
                <Text className="text-white text-xs">🌙</Text>
                <Text className="text-white text-xs font-bold">
                  CLOSING SALE
                </Text>
              </View>
            ) : (
              <View className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded-md shadow-lg">
                <Text className="text-white text-xs font-bold">
                  -{product.discount_percent}% OFF
                </Text>
              </View>
            )
          )}
        </View>
      </View>

      {/* Content section */}
      <View className="px-3 pb-3">
        {/* Title */}
        <Text
          className="text-lg font-bold text-gray-900 mb-2"
          numberOfLines={2}
        >
          {product.name}
        </Text>

        {/* Price */}
        {!product.is_currently_active && (
          <Text className="text-base font-bold text-primary">
            Nu. {product.price.toLocaleString()}
          </Text>
        )}

        {/* Discount Price Info (when active) - Closing Sale styling for Food */}
        {product.is_currently_active && (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className={`text-base font-bold ${product.category === 'food' ? 'text-amber-600' : 'text-primary'}`}>
                Nu. {product.current_price?.toLocaleString()}
              </Text>
              <View className={`px-1.5 py-0.5 rounded ${product.category === 'food' ? 'bg-amber-500' : 'bg-red-500'}`}>
                <Text className="text-white text-[10px] font-bold">
                  -{product.discount_percent}%
                </Text>
              </View>
            </View>
            <Text className="text-xs text-gray-400 line-through">
              Nu. {product.price.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Countdown timer */}
        {product.is_currently_active && (
          <View className="mt-2">
            <CountdownTimer endsAt={product.discount_ends_at} compact={true} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}