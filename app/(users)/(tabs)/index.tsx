// Path: app/(users)/index.tsx

import Banner from "@/components/Banner";
import FeaturedSellers from "@/components/FeaturedSellers";
import ForYou from "@/components/ForYou";
import SearchBar from "@/components/modals/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { useLivestreams } from "@/hooks/useLivestreams";
import { Briefcase, Coins, Eye, Heart, Radio, Ticket, Tv2, Users } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ListRenderItem,
  Modal,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";

type TabType = "foryou" | "featured" | "live" | "bidding" | "norbu";
type HeaderDataItem = { key: string; component: "header" | "content" | "footer" };

type LiveFilter = "all" | "business" | "entertainment";

function LiveTab({ onOpen }: { onOpen: (streamId: string) => void }) {
  const { livestreams, loading } = useLivestreams();
  const [filter, setFilter] = useState<LiveFilter>("all");

  const filtered =
    filter === "all" ? livestreams : livestreams.filter((s) => s.stream_type === filter);

  const filters: { key: LiveFilter; label: string; icon: React.ReactNode }[] = [
    { key: "all",           label: "All",           icon: <Radio size={13} color={filter === "all" ? "white" : "#6B7280"} /> },
    { key: "business",     label: "Business",     icon: <Briefcase size={13} color={filter === "business" ? "white" : "#6B7280"} /> },
    { key: "entertainment",label: "Entertainment", icon: <Tv2 size={13} color={filter === "entertainment" ? "white" : "#6B7280"} /> },
  ];

  return (
    <View className="mt-4">
      {/* Filter pills */}
      <View className="flex-row gap-2 mb-4">
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.75}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
              filter === f.key ? "bg-primary" : "bg-white border border-gray-200"
            }`}
          >
            {f.icon}
            <Text
              className={`text-xs font-semibold ${
                filter === f.key ? "text-white" : "text-gray-500"
              }`}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View className="min-h-64 justify-center items-center">
          <ActivityIndicator size="small" color="#094569" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="min-h-64 justify-center items-center gap-2">
          <Radio size={36} color="#D1D5DB" />
          <Text className="text-sm font-semibold text-gray-400">
            No {filter === "all" ? "" : filter + " "}live streams right now
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {filtered.map((stream) => (
            <TouchableOpacity
              key={stream.id}
              onPress={() => onOpen(stream.id)}
              activeOpacity={0.85}
              style={{ width: "47%" }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
            >
              {/* Thumbnail / avatar area */}
              <View className="w-full bg-gray-100" style={{ height: 110 }}>
                {stream.thumbnail ? (
                  <Image
                    source={{ uri: stream.thumbnail }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : stream.profile_image ? (
                  <Image
                    source={{ uri: stream.profile_image }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full bg-primary/10 items-center justify-center">
                    <Text className="text-primary font-bold text-3xl">
                      {(stream.username ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* LIVE badge */}
                <View
                  className="absolute top-2 left-2 bg-red-500 rounded px-1.5 py-0.5"
                  style={{ borderWidth: 1, borderColor: "white" }}
                >
                  <Text className="text-white text-[9px] font-black">LIVE</Text>
                </View>

                {/* Type badge */}
                {stream.stream_type && (
                  <View className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-0.5 flex-row items-center gap-1">
                    {stream.stream_type === "business" ? (
                      <Briefcase size={9} color="white" />
                    ) : (
                      <Tv2 size={9} color="white" />
                    )}
                    <Text className="text-white text-[9px] font-semibold capitalize">
                      {stream.stream_type}
                    </Text>
                  </View>
                )}

                {/* Viewer count */}
                <View className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2 py-0.5 flex-row items-center gap-1">
                  <Eye size={10} color="white" />
                  <Text className="text-white text-[9px] font-semibold">
                    {stream.viewer_count ?? 0}
                  </Text>
                </View>
              </View>

              {/* Info row */}
              <View className="px-2.5 py-2 flex-row items-center gap-2">
                {stream.profile_image ? (
                  <Image
                    source={{ uri: stream.profile_image }}
                    className="w-7 h-7 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white font-bold text-xs">
                      {(stream.username ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-800" numberOfLines={1}>
                    {stream.username ?? "Unknown"}
                  </Text>
                  {stream.title ? (
                    <Text className="text-[10px] text-gray-500" numberOfLines={1}>
                      {stream.title}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("foryou");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const animationDirection = useRef<"left" | "right">("right");
  const [showLive, setShowLive] = useState(false);
  const [liveStreamId, setLiveStreamId] = useState<string | undefined>(undefined);

  // Lazily load LiveScrollScreen only when needed
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
  }> | null>(null);
  const [liveScreenLoading, setLiveScreenLoading] = useState(false);

  useEffect(() => {
    if (showLive && !LiveScrollScreen && !liveScreenLoading) {
      setLiveScreenLoading(true);
      import("@/components/livestream/LiveScrollScreen")
        .then((module) => {
          setLiveScrollScreen(() => module.default);
          setLiveScreenLoading(false);
        })
        .catch(() => setLiveScreenLoading(false));
    }
  }, [showLive, LiveScrollScreen, liveScreenLoading]);

  const handleTabPress = (tab: TabType) => {
    const tabOrder: TabType[] = ["foryou", "featured", "live", "norbu", "bidding"];
    const currentIndex = tabOrder.indexOf(activeTab);
    const nextIndex = tabOrder.indexOf(tab);
    animationDirection.current = nextIndex >= currentIndex ? "right" : "left";
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
          <LiveTab
            onOpen={(streamId) => {
              setLiveStreamId(streamId);
              setShowLive(true);
            }}
          />
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

  const headerData: HeaderDataItem[] = [
    { key: "header", component: "header" },
    { key: "content", component: "content" },
    { key: "footer", component: "footer" },
  ];

  const renderItem: ListRenderItem<HeaderDataItem> = ({ item }) => {
    if (item.component === "header") {
      return (
        <View>
          <TopNavbar />
          <View className="px-4 gap-2">
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
                ? FadeInRight.duration(200)
                : FadeInLeft.duration(200)
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
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 80 }}
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

      {/* Live scroll modal */}
      {showLive && (
        <Modal
          visible={showLive}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowLive(false)}
        >
          {LiveScrollScreen ? (
            <LiveScrollScreen
              initialStreamId={liveStreamId}
              onClose={() => setShowLive(false)}
            />
          ) : (
            <View className="flex-1 bg-black items-center justify-center">
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
        </Modal>
      )}
    </>
  );
}
