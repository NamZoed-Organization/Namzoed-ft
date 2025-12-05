// app/(users)/product/[id].tsx
import { fetchProductById, ProductWithUser } from "@/lib/productsService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

function DetailSkeleton() {
  return (
    <View className="flex-1 bg-white">
      <View className="w-full h-72 bg-gray-200 animate-pulse" />
      <View className="p-4">
        <View className="h-6 bg-gray-200 rounded w-3/4 mb-3 animate-pulse" />
        <View className="h-5 bg-gray-200 rounded w-1/3 mb-4 animate-pulse" />
        <View className="flex-row items-center gap-2 mb-2">
          <View className="h-4 bg-gray-100 rounded w-24 animate-pulse" />
        </View>
        <View className="flex-row items-center gap-2 mb-4">
          <View className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
        </View>
        <View className="h-4 bg-gray-100 rounded w-full mb-2 animate-pulse" />
        <View className="h-4 bg-gray-100 rounded w-full mb-2 animate-pulse" />
        <View className="h-4 bg-gray-100 rounded w-2/3 mb-6 animate-pulse" />
        <View className="h-12 bg-gray-200 rounded-lg w-full animate-pulse" />
      </View>
    </View>
  );
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [product, setProduct] = useState<ProductWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;

    const loadProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProductById(id);
        setProduct(data);
      } catch (err: any) {
        console.error("Error loading product:", err);
        setError(err.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleMessageSeller = () => {
    if (!product) return;
    
    Alert.alert(
      "Message Seller",
      `Send a message about "${product.name}" to ${product.profiles?.name || 'the seller'}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Send Message", 
          onPress: () => {
            Alert.alert("Success", "Message sent to seller!");
          }
        }
      ]
    );
  };

  if (loading) return <DetailSkeleton />;

  if (error || !product) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-4">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-gray-600 text-center mt-4 mb-6">
          {error || "Product not found."}
        </Text>
        <TouchableOpacity 
          className="bg-primary px-6 py-3 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasImages = product.images && product.images.length > 0;
  const images = hasImages ? product.images : [];
  const mainImage = hasImages ? { uri: images[activeImageIndex] } : null;

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Main Image */}
        {mainImage ? (
          <Image
            source={mainImage}
            className="w-full h-72 bg-gray-100"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-72 bg-gray-200 items-center justify-center">
            <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          </View>
        )}

        {/* Image Thumbnails */}
        {images.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="px-4 py-3 bg-gray-50"
          >
            {images.map((img, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setActiveImageIndex(index)}
                className={`mr-2 rounded-lg overflow-hidden border-2 ${
                  activeImageIndex === index ? 'border-primary' : 'border-transparent'
                }`}
              >
                <Image 
                  source={{ uri: img }} 
                  className="w-16 h-16 bg-gray-200" 
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View className="p-4">
          {/* Category & Tags */}
          <View className="flex-row flex-wrap gap-2 mb-3">
            <View className="bg-gray-100 px-3 py-1 rounded-full">
              <Text className="text-xs text-gray-600">{product.category}</Text>
            </View>
            {product.tags?.slice(0, 3).map((tag, i) => (
              <View key={i} className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-xs text-primary">{tag}</Text>
              </View>
            ))}
          </View>

          {/* Title */}
          <Text className="text-xl font-bold text-gray-900 mb-2">
            {product.name}
          </Text>

          {/* Price */}
          <Text className="text-2xl font-bold text-primary mb-4">
            Nu. {product.price.toLocaleString()}
          </Text>

          {/* Seller Info */}
          {product.profiles?.name && (
            <View className="flex-row items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              <View className="w-10 h-10 bg-gray-300 rounded-full items-center justify-center">
                <Ionicons name="person" size={20} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {product.profiles.name}
                </Text>
                <Text className="text-xs text-gray-500">Seller</Text>
              </View>
            </View>
          )}

          {/* Description */}
          <Text className="text-sm font-semibold text-gray-900 mb-2">Description</Text>
          <Text className="text-base text-gray-600 leading-6 mb-6">
            {product.description || "No description provided."}
          </Text>

          {/* Posted Date */}
          <Text className="text-xs text-gray-400 mb-6">
            Posted {new Date(product.created_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className="p-4 bg-white border-t border-gray-100">
        <TouchableOpacity
          className="bg-primary rounded-xl py-4 flex-row items-center justify-center"
          onPress={handleMessageSeller}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={20} color="white" />
          <Text className="text-white font-bold text-base ml-2">
            Message Seller
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}