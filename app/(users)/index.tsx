import allImage from "@/assets/images/all.png";
import Banner from "@/components/Banner";
import ForYou from "@/components/ForYou";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import React, { useEffect, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("foryou");
  const [isLoaded, setIsLoaded] = useState(false);

  // Force re-render after initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const renderTabContent = () => {
    if (!isLoaded && activeTab === "foryou") {
      return (
        <View className="h-96 justify-center items-center">
          <Text className="text-gray-500">Loading...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case "foryou":
        return (
          <View className="min-h-96">
            <ForYou key="foryou-content" />
          </View>
        );
      case "featured":
        return (
          <View className="mt-6 min-h-96">
            <Text className="text-base font-semibold text-primary mb-2">
              Featured Sellers (Coming Soon)
            </Text>
          </View>
        );
      case "live":
        return (
          <View className="mt-6 min-h-96">
            <Text className="text-base font-semibold text-primary mb-2">
              Live Products (Coming Soon)
            </Text>
          </View>
        );
      default:
        return (
          <View className="min-h-96">
            <ForYou key="foryou-default" />
          </View>
        );
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background mb-20"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      <View className="px-4 gap-2 mb-10">
        <TopNavbar />
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        <Banner />
        
        {/* Tab Navigation */}
        <View className="flex-row items-center w-[90%] mx-auto mt-2 gap-4">
          <TouchableOpacity
            onPress={() => setActiveTab("foryou")}
            className={`flex-1 items-center px-2 py-3 rounded-lg ${
              activeTab === "foryou"
                ? "bg-primary"
                : "bg-white border border-primary"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === "foryou" ? "text-white" : "text-primary"
              }`}
            >
              For You
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("featured")}
            className={`flex-3 items-center px-4 py-3 rounded-lg mx-2 ${
              activeTab === "featured"
                ? "bg-primary"
                : "bg-white border border-primary"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === "featured" ? "text-white" : "text-primary"
              }`}
            >
              Featured Sellers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("live")}
            className={`flex-1 items-center px-2 py-3 rounded-lg ${
              activeTab === "live"
                ? "bg-primary"
                : "bg-white border border-primary"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === "live" ? "text-white" : "text-primary"
              }`}
            >
              Live
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View className="mt-2 flex-1" style={{ minHeight: 400 }}>
          {renderTabContent()}
        </View>

        {/* Offer Header Card */}
        <View className="bg-white rounded-xl p-4 flex-row items-center gap-4 mt-6">
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