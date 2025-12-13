// components/BookmarksOverlay.tsx
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ArrowRight, Bookmark, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface BookmarkedProduct {
  id: string;
  product_id: string;
  created_at: string;
  products: {
    id: string;
    name: string;
    price: number;
    images: string[];
  };
}

interface BookmarksOverlayProps {
  onClose: () => void;
  userId: string;
}

export default function BookmarksOverlay({ onClose, userId }: BookmarksOverlayProps) {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, [userId]);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_bookmarks')
        .select(`
          id,
          product_id,
          created_at,
          products (
            id,
            name,
            price,
            images
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookmarks(data || []);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToProduct = (productId: string) => {
    onClose();
    router.push(`/(users)/product/${productId}`);
  };


  return (
    <View className="flex-1 bg-white">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <Bookmark size={24} className="text-primary mr-2" />
          <Text className="text-xl font-mbold text-gray-900">My Bookmarks</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
        >
          <X size={24} className="text-gray-700" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="#094569" />
            <Text className="text-gray-500 mt-4">Loading bookmarks...</Text>
          </View>
        ) : bookmarks.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12 px-8">
            <Bookmark size={64} className="text-gray-300 mb-4" />
            <Text className="text-xl font-mbold text-gray-700 mb-2">No Bookmarks Yet</Text>
            <Text className="text-base text-gray-500 text-center">
              Bookmark products to save them for later
            </Text>
          </View>
        ) : (
          <View className="px-4 py-2">
            {bookmarks.map((bookmark) => {
              const product = bookmark.products;
              const imageUrl = product.images?.[0];

              return (
                <View
                  key={bookmark.id}
                  className="flex-row items-center bg-white border border-gray-200 rounded-xl p-3 mb-3"
                >
                  {/* Product Image */}
                  <View className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden mr-3">
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center">
                        <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                      </View>
                    )}
                  </View>

                  {/* Product Info */}
                  <View className="flex-1 mr-2">
                    <Text
                      className="text-base font-semibold text-gray-900 mb-1"
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>
                    <Text className="text-sm font-bold text-primary">
                      Nu. {product.price.toLocaleString()}
                    </Text>
                  </View>

                  {/* Navigate Button */}
                  <TouchableOpacity
                    onPress={() => handleNavigateToProduct(product.id)}
                    className="w-9 h-9 items-center justify-center "
                  >
                    <ArrowRight size={18} className="text-white" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
