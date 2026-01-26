import { Image as ImageLucide, ShoppingBag, Wrench } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ProfileTabsProps {
  activeTab: "images" | "products" | "services";
  onTabChange: (tab: "images" | "products" | "services") => void;
}

export default function ProfileTabs({
  activeTab,
  onTabChange,
}: ProfileTabsProps) {
  return (
    <View className="bg-white border-b border-gray-100">
      <View className="flex-row">
        <TouchableOpacity
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === "images" ? "border-primary" : "border-transparent"
          }`}
          onPress={() => onTabChange("images")}
        >
          <ImageLucide
            size={24}
            className={`mb-1 ${
              activeTab === "images" ? "text-primary" : "text-gray-500"
            }`}
          />
          <Text
            className={`font-msemibold text-xs ${
              activeTab === "images" ? "text-primary" : "text-gray-500"
            }`}
          >
            Images
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === "products" ? "border-primary" : "border-transparent"
          }`}
          onPress={() => onTabChange("products")}
        >
          <ShoppingBag
            size={24}
            className={`mb-1 ${
              activeTab === "products" ? "text-primary" : "text-gray-500"
            }`}
          />
          <Text
            className={`font-msemibold text-xs ${
              activeTab === "products" ? "text-primary" : "text-gray-500"
            }`}
          >
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === "services" ? "border-primary" : "border-transparent"
          }`}
          onPress={() => onTabChange("services")}
        >
          <Wrench
            size={24}
            className={`mb-1 ${
              activeTab === "services" ? "text-primary" : "text-gray-500"
            }`}
          />
          <Text
            className={`font-msemibold text-xs ${
              activeTab === "services" ? "text-primary" : "text-gray-500"
            }`}
          >
            Service
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
