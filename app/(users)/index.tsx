// Path: app/(users)/index.tsx

import allImage from "@/assets/images/all.png";
import Banner from "@/components/Banner";
import FeaturedSellers from "@/components/FeaturedSellers";
import ForYou from "@/components/ForYou";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { Coins, Heart, Radio, Ticket, Users } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ListRenderItem,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";

type TabType = "foryou" | "featured" | "live" | "bidding" | "norbu";

interface HeaderDataItem {
  key: string;
  component: "header" | "content" | "footer";
}

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("foryou");
  const [previousTab, setPreviousTab] = useState<TabType>("foryou");
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  console.log(" home screen");

  // Map tab names to positions for directional animations
  // Use ref for immediate direction tracking
  const animationDirection = useRef<"right" | "left">("right");
  const tabPressTime = useRef<number>(0);

  console.log(" home screen");

  // Map tab names to positions
  const getTabPosition = (tab: TabType): number => {
    const positions: Record<TabType, number> = {
      foryou: 0,
      featured: 1,
      live: 2,
      norbu: 3,
      bidding: 4,
    };
    return positions[tab];
  };

  // Force re-render after initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleTabPress = (tab: TabType) => {
    const now = Date.now();

    // Debounce rapid clicks
    if (now - tabPressTime.current < 100) return;
    tabPressTime.current = now;

    const currentPos = getTabPosition(activeTab);
    const newPos = getTabPosition(tab);

    // Set animation direction
    animationDirection.current = newPos > currentPos ? "right" : "left";

    setActiveTab(tab);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Increment refresh key to force component remount
    setRefreshKey((prev) => prev + 1);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

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
            <ForYou key={`foryou-content-${refreshKey}`} />
          </View>
        );
      case "featured":
        return (
          <View className="mt-6 min-h-96">
            <FeaturedSellers key={`featured-${refreshKey}`} />
          </View>
        );
      case "live":
        return (
          <View className="mt-6 min-h-96 justify-center items-center">
            <Text className="text-base font-semibold text-primary mb-2">
              No live events at the moment.
            </Text>
          </View>
        );
      case "bidding":
        return (
          <View className="mt-6 min-h-96 justify-center items-center">
            <Text className="text-base font-semibold text-primary mb-2">
              Bidding (Coming Soon)
            </Text>
          </View>
        );
      case "norbu":
        return (
          <View className="mt-6 min-h-96 justify-center items-center">
            <Text className="text-base font-semibold text-primary mb-2">
              Norbu Coin (Coming Soon)
            </Text>
          </View>
        );
      default:
        return (
          <View className="min-h-96">
            <ForYou key={`foryou-default-${refreshKey}`} />
          </View>
        );
    }
  };

  const headerData: HeaderDataItem[] = [
    { key: "header", component: "header" },
    { key: "content", component: "content" },
    { key: "footer", component: "footer" },
  ];

  const renderItem: ListRenderItem<HeaderDataItem> = ({ item }) => {
    if (item.component === "header") {
      return (
        <View className="px-4 gap-2">
          <TopNavbar />
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          <Banner />

          {/* Tab Navigation - Updated styling */}
          <View className="flex-row items-center w-full mx-auto mt-2 gap-2">
            <TouchableOpacity
              onPress={() => handleTabPress("foryou")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm ${
                activeTab === "foryou" ? "bg-primary" : "bg-white"
              }`}
            >
              <Heart
                size={20}
                color={activeTab === "foryou" ? "white" : "black"}
                fill={activeTab === "foryou" ? "white" : "none"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabPress("featured")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm ${
                activeTab === "featured" ? "bg-primary" : "bg-white"
              }`}
            >
              <Users
                size={20}
                color={activeTab === "featured" ? "white" : "black"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabPress("live")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm ${
                activeTab === "live" ? "bg-primary" : "bg-white"
              }`}
            >
              <Radio
                size={20}
                color={activeTab === "live" ? "white" : "black"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabPress("norbu")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm ${
                activeTab === "norbu" ? "bg-primary" : "bg-white"
              }`}
            >
              <Coins
                size={20}
                color={activeTab === "norbu" ? "white" : "black"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabPress("bidding")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm ${
                activeTab === "bidding" ? "bg-primary" : "bg-white"
              }`}
            >
              <Ticket
                size={20}
                color={activeTab === "bidding" ? "white" : "black"}
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (item.component === "content") {
      const isMovingRight = animationDirection.current === "right";

      return (
        <View className="px-4 mt-2" style={{ minHeight: 400 }}>
          <Animated.View
            key={activeTab}
            entering={
              isMovingRight
                ? SlideInRight.duration(180)
                : SlideInLeft.duration(180)
            }
          >
            {renderTabContent()}
          </Animated.View>
        </View>
      );
    }

    if (item.component === "footer") {
      // Only show footer cards in "For You" tab
      if (activeTab !== "foryou") {
        return <View className="mb-10" />;
      }

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
                <Text className="text-white text-sm font-medium">
                  Visit now
                </Text>
                <Text className="ml-1 text-white text-lg">→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <FlatList
      data={headerData}
      renderItem={renderItem}
      keyExtractor={(item: HeaderDataItem) => item.key}
      className="flex-1 bg-background mb-20"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#059669"]}
          tintColor="#059669"
        />
      }
    />
  );
}
