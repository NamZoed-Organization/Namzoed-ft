import TopNavbar from "@/components/ui/TopNavbar";
import { getBookingCategoryBySlug } from "@/data/bookings";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function RoomBookingScreen() {
  const router = useAppRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const bookingCategory = getBookingCategoryBySlug(slug ?? "");

  if (!bookingCategory) {
    return (
      <View className="flex-1 bg-background">
        <TopNavbar />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-gray-500">Booking category not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            style={{ borderRadius: 12, borderCurve: "continuous" }}
            onPress={() => router.back()}
            activeOpacity={0.8}
            className="w-10 h-10 bg-gray-100 items-center justify-center"
          >
            <ChevronLeft size={22} color="#111827" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-mbold text-gray-900">
              {bookingCategory.name}
            </Text>
            <Text className="text-sm text-gray-500">
              Choose a subcategory
            </Text>
          </View>
        </View>
      </View>

      <View className="px-4 pt-5">
        <View className="flex-row flex-wrap">
          {bookingCategory.subcategories.map((subcategory) => (
            <View key={subcategory.slug} className="w-1/2 p-2">
              <TouchableOpacity
                style={{ borderRadius: 16, borderCurve: "continuous" }}
                activeOpacity={0.8}
                className="bg-white border border-gray-200 px-4 py-5"
              >
                <Text className="text-base font-msemibold text-gray-900">
                  {subcategory.name}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
