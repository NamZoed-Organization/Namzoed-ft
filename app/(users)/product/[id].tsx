import { products } from "@/data/products";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-gray-600">Product not found.</Text>
      </View>
    );
  }

  const oldPrice = product.price + 80;
  const discount = Math.round(((oldPrice - product.price) / oldPrice) * 100);

  return (
    <ScrollView className="flex-1 bg-background">
      <Image
        source={product.image}
        className="w-full h-64"
        resizeMode="cover"
      />

      <View className="p-4">
        <Text className="text-xl font-mbold text-gray-900">
          {product.name}
        </Text>

        <View className="flex-row items-center gap-2 mt-1">
          <Text className="text-lg font-bold text-black">Nu. {product.price}</Text>
          <Text className="text-sm text-gray-400 line-through">Nu. {oldPrice}</Text>
          <Text className="text-sm text-red-500 font-semibold">-{discount}%</Text>
        </View>

        <View className="flex-row items-center gap-1 mt-2">
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text className="text-sm text-gray-500">{product.dzongkhag}</Text>
        </View>

        <View className="flex-row items-center gap-1 mt-1">
          <Ionicons name="star" size={14} color="#facc15" />
          <Text className="text-sm text-gray-600">4.5 (24 reviews)</Text>
        </View>

        <Text className="text-base text-gray-700 mt-4">{product.description}</Text>
      </View>
    </ScrollView>
  );
}
