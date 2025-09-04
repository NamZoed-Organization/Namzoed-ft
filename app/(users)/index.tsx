// Path: app/(users)/index.tsx

import allImage from "@/assets/images/all.png";
import Banner from "@/components/Banner";
import FeaturedSellers from "@/components/FeaturedSellers";
import ForYou from "@/components/ForYou";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { Coins, Heart, Radio, Ticket, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("foryou");
  const [isLoaded, setIsLoaded] = useState(false);
  console.log(" home screen" )
  
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
            <FeaturedSellers />
          </View>
        );
      case "live":
        return (
          <View className="mt-6 min-h-96">
            <Text className="text-base font-semibold text-primary mb-2">
              No live events at the moment.
            </Text>
          </View>
        );
      case "bidding":
        return (
          <View className="mt-6 min-h-96">
            <Text className="text-base font-semibold text-primary mb-2">
              Bidding (Coming Soon)
            </Text>
          </View>
        );
      case "norbu":
        return (
          <View className="mt-6 min-h-96">
            <Text className="text-base font-semibold text-primary mb-2">
              Norbu Coin (Coming Soon)
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

  const headerData = [
    { key: 'header', component: 'header' },
    { key: 'content', component: 'content' },
    { key: 'footer', component: 'footer' }
  ];

  const renderItem = ({ item }) => {
    if (item.component === 'header') {
      return (
        <View className="px-4 gap-2">
          <TopNavbar />
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          <Banner />
          
          {/* Tab Navigation */}
          <View className="flex-row items-center w-full mx-auto mt-2 gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab("foryou")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "foryou"
                  ? "border-2 border-black"
                  : ""
              }`}
            >
              <Heart 
                size={20} 
                color="black"
                fill="none"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("featured")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "featured"
                  ? "border-2 border-black"
                  : ""
              }`}
            >
              <Users 
                size={20} 
                color="black"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("live")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "live"
                  ? "border-2 border-black"
                  : ""
              }`}
            >
              <Radio 
                size={20} 
                color="black"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("norbu")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "bidding"
                  ? "border-2 border-black"
                  : ""
              }`}
            >
              <Coins 
                size={20} 
                color="black"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("bidding")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "placeholder"
                  ? "border-2 border-black"
                  : ""
              }`}
            >
              <Ticket 
                size={20} 
                color="black"
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (item.component === 'content') {
      return (
        <View className="px-4 mt-2 flex-1" style={{ minHeight: 400 }}>
          {renderTabContent()}
        </View>
      );
    }
    
    if (item.component === 'footer') {
      return (
        <View className="px-4 gap-2 mb-10">
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
      );
    }
  };

  return (
    <FlatList
      data={headerData}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      className="flex-1 bg-background mb-20"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    />
  );
}