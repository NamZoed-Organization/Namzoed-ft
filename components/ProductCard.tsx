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
      className={`bg-white rounded-xl mb-3 shadow-sm border border-gray-100 flex-1 overflow-hidden ${
        isLeftColumn ? "mr-2" : "ml-2"
      }`}
      onPress={() => router.push(`/(users)/product/${product.id}`)}
      activeOpacity={0.9}
    >
      <View className="relative">
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

        {/* Discount Badge Overlay */}
        {product.is_currently_active && (
          <View className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded-md shadow-lg">
            <Text className="text-white text-xs font-bold">
              -{product.discount_percent}% OFF
            </Text>
          </View>
        )}
      </View>
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

        {/* Price with Discount Info */}
        {product.is_currently_active ? (
          <View className="gap-1">
            {/* Original price struck */}
            <Text className="text-xs text-gray-400 line-through">
              Nu. {product.price.toLocaleString()}
            </Text>

            {/* Discounted price, badge, and timer */}
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-base font-bold text-primary">
                Nu. {product.current_price?.toLocaleString()}
              </Text>

              {/* Discount badge */}
              <View className="bg-red-500 px-1.5 py-0.5 rounded">
                <Text className="text-white text-[10px] font-bold">
                  -{product.discount_percent}%
                </Text>
              </View>

              {/* Countdown (compact) */}
              <CountdownTimer endsAt={product.discount_ends_at} compact={true} />
            </View>
          </View>
        ) : (
          <Text className="text-base font-bold text-primary">
            Nu. {product.price.toLocaleString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
