import { Product } from "@/data/products";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Image, Text, TouchableOpacity, View, ViewStyle, Alert } from "react-native";

export default function ProductCard({
  product,
  style,
}: {
  product: Product;
  style?: ViewStyle;
}) {
  const oldPrice = product.price + 80;
  const discount = Math.round(((oldPrice - product.price) / oldPrice) * 100);

  const handleMessagePress = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    Alert.alert(
      "Message Seller",
      `Send a message about "${product.name}" to the seller?`,
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

          <TouchableOpacity
            className="bg-blue-100 rounded-md py-2 px-3 flex-row items-center justify-center mt-3"
            onPress={handleMessagePress}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={12} color="#2563eb" />
            <Text className="text-blue-600 font-medium text-xs ml-1">
              Message
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Link>
  );
}
