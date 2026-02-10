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
import React, { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TabType = "foryou" | "featured" | "live" | "bidding" | "norbu";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("foryou");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabPress = (tab: TabType) => {
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
    switch (activeTab) {
      case "foryou":
        return <ForYou key={`foryou-${refreshKey}`} />;
      case "featured":
        return (
          <View className="mt-6">
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
        return <ForYou key={`foryou-default-${refreshKey}`} />;
    }
  };

  return (
    <ScrollView
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
    >
      {/* Header */}
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

      {/* Tab Content */}
      <View className="mt-2">
        {renderTabContent()}
      </View>

      {/* Bottom spacing */}
      <View className="mb-10" />
    </ScrollView>
  );
}
