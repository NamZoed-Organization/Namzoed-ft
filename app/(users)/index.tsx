// Path: app/(users)/index.tsx

import Banner from "@/components/Banner";
import FeaturedSellers from "@/components/FeaturedSellers";
import ForYou from "@/components/ForYou";
import SearchBar from "@/components/modals/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import {
  Coins,
  Heart,
  Radio,
  Ticket,
  Users,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  SlideInLeft,
  SlideInRight,
} from "react-native-reanimated";

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

  const animationDirection = useRef<"right" | "left">("right");
  const tabPressTime = useRef<number>(0);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleTabPress = (tab: TabType) => {
    const now = Date.now();
    if (now - tabPressTime.current < 100) return;
    tabPressTime.current = now;

    const currentPos = getTabPosition(activeTab);
    const newPos = getTabPosition(tab);
    animationDirection.current = newPos > currentPos ? "right" : "left";

    setActiveTab(tab);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
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

          {/* Tab Navigation */}
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
      if (activeTab !== "foryou") {
        return <View className="mb-10" />;
      }

      return <View className="px-4 gap-2 mb-10"></View>;
    }

    return null;
  };

  return (
    <>
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
    </>
  );
}
