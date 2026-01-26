import {
  Image as ImageLucide,
  Play,
  ShoppingBag,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Product } from "@/lib/productsService";
import { useRouter } from "expo-router";

interface ProfileTabContentProps {
  activeTab: "images" | "products" | "services";
  // Images tab
  loadingPosts: boolean;
  userImages: string[];
  onImageClick: (imageUrl: string) => void;
  isVideoUrl: (url: string) => boolean;
  // Products tab
  loadingProducts: boolean;
  userProducts: Product[];
}

export default function ProfileTabContent({
  activeTab,
  loadingPosts,
  userImages,
  onImageClick,
  isVideoUrl,
  loadingProducts,
  userProducts,
}: ProfileTabContentProps) {
  const router = useRouter();

  if (activeTab === "images") {
    return (
      <>
        {loadingPosts ? (
          <ActivityIndicator size="large" color="#059669" className="py-12" />
        ) : userImages.length > 0 ? (
          <View className="flex-row flex-wrap">
            {userImages.map((imageUrl, index) => {
              const isVideo = isVideoUrl(imageUrl);
              return (
                <View key={index} className="w-[33.33%] aspect-square p-1">
                  <TouchableOpacity
                    className="flex-1 bg-gray-200 rounded-lg overflow-hidden relative"
                    onPress={() => onImageClick(imageUrl)}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    {isVideo && (
                      <View className="absolute inset-0 items-center justify-center bg-black/30">
                        <View className="bg-white rounded-full p-2">
                          <Play size={24} color="#000" fill="#000" />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="items-center justify-center py-12">
            <ImageLucide size={48} className="text-gray-400 mb-4" />
            <Text className="text-lg font-msemibold text-gray-700">
              No Images Yet
            </Text>
          </View>
        )}
      </>
    );
  }

  if (activeTab === "products") {
    return (
      <>
        {loadingProducts ? (
          <ActivityIndicator size="large" color="#059669" className="py-12" />
        ) : userProducts.length > 0 ? (
          <View className="flex-row flex-wrap">
            {userProducts.map((product, index) => (
              <View
                key={product.id || index}
                className="w-[33.33%] aspect-square p-1"
              >
                <TouchableOpacity
                  className="flex-1 bg-gray-200 rounded-lg overflow-hidden"
                  onPress={() =>
                    router.push(`/(users)/product/${product.id}` as any)
                  }
                >
                  {product.images && product.images.length > 0 ? (
                    <Image
                      source={{ uri: product.images[0] }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-gray-100">
                      <ShoppingBag size={32} className="text-gray-400" />
                    </View>
                  )}
                  {/* Price tag overlay */}
                  <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                    <Text
                      className="text-white text-xs font-semibold"
                      numberOfLines={1}
                    >
                      {product.name}
                    </Text>
                    <Text className="text-white text-xs font-bold">
                      Nu. {product.price.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center justify-center py-12">
            <ShoppingBag size={48} className="text-gray-400 mb-4" />
            <Text className="text-lg font-msemibold text-gray-700">
              No Products Yet
            </Text>
            <Text className="text-sm text-gray-500 mt-2">
              Start selling to see your products here
            </Text>
          </View>
        )}
      </>
    );
  }

  // Services tab
  return (
    <Text className="text-center py-8 text-gray-500">
      Services coming soon
    </Text>
  );
}
