import allImage from "@/assets/images/all.png";
import Banner from "@/components/Banner";
import ForYou from "@/components/ForYou";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import React, { useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"foryou" | "featured" | "live">(
    "foryou"
  );

  return (
    <ScrollView
      className="flex-1 bg-background  mb-20"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      <View className="px-4 gap-2 mb-10">
        <TopNavbar />
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        <Banner />

        <View className="flex-row justify-between items-center w-[90%] mx-auto mt-2">
          {[
            { label: "For You", key: "foryou" },
            { label: "Featured Sellers", key: "featured" },
            { label: "Live", key: "live" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setActiveTab(item.key as typeof activeTab)}
              className={`px-5 py-3 rounded-lg ${
                activeTab === item.key
                  ? "bg-primary"
                  : "bg-white border border-primary"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === item.key ? "text-white" : "text-primary"
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content based on tab */}
        <View className="mt-2">
          {activeTab === "foryou" && <ForYou />}
          {activeTab === "featured" && <ForYou />}
          {activeTab === "live" && <ForYou />}
        </View>
        {/* Offer Header Card */}
        <View className="bg-white rounded-xl p-4 flex-row items-center gap-4">
          <Image
            source={allImage}
            className="w-14 h-14 rounded-md"
            resizeMode="contain"
          />
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">
              Special Offers 😱
            </Text>
            <Text className="text-sm text-gray-500">
              We make sure you get the offer you need at best prices
            </Text>
          </View>
        </View>

        {/* Destination Promo Card (Side-by-side) */}
        <View className="flex-row bg-white rounded-xl overflow-hidden mt-3">
          {/* Left: Image */}
          <Image source={allImage} className="w-36 h-36" resizeMode="cover" />

          {/* Right: Content */}
          <View className="flex-1 justify-center p-4">
            <Text className="text-base font-semibold text-gray-800">
              Six Senses Bhutan
            </Text>
            <Text className="text-sm text-gray-500 mb-3">
              Stand a chance to get rewarded
            </Text>
            <TouchableOpacity className="self-start px-4 py-2 bg-primary rounded-full flex-row items-center">
              <Text className="text-white text-sm font-medium">Visit now</Text>
              <Text className="ml-1 text-white text-lg">→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
