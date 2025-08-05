import { Product } from "@/data/products";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Image, Text, TouchableOpacity, View, ViewStyle } from "react-native";

export default function ProductCard({
  product,
  style,
}: {
  product: Product;
  style?: ViewStyle;
}) {
  const oldPrice = product.price + 80;
  const discount = Math.round(((oldPrice - product.price) / oldPrice) * 100);

  return (
    <Link
      href={{ pathname: "/product/[id]", params: { id: product.id } }}
      asChild
    >
      <TouchableOpacity
        className="rounded-lg bg-white overflow-hidden shadow-sm max-w-[48%]"
        activeOpacity={0.7}
       
      >
        <Image
          source={product.image}
          className="w-full h-24"
          resizeMode="cover"
        />

        <View className="p-2">
          <Text
            className="text-sm font-semibold text-gray-800"
            numberOfLines={1}
          >
            {product.name}
          </Text>

          <Text className="text-xs text-gray-500 mb-1" numberOfLines={2}>
            {product.description}
          </Text>

          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-bold text-black">
              Nu. {product.price}
            </Text>
            <Text className="text-xs text-gray-400 line-through">
              Nu. {oldPrice}
            </Text>
            <Text className="text-xs text-red-400 font-semibold">
              -{discount}%
            </Text>
          </View>

          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text className="text-xs text-gray-500">{product.dzongkhag}</Text>
          </View>

          <View className="flex-row items-center gap-1 mt-2">
            <Ionicons name="star" size={12} color="#facc15" />
            <Text className="text-xs text-gray-600">4.5 (24)</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}
