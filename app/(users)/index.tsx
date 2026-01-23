// Path: app/(users)/index.tsx

import Banner from "@/components/Banner";
import FeaturedSellers from "@/components/FeaturedSellers";
import ForYou from "@/components/ForYou";
import FullscreenVideoPlayer from "@/components/FullscreenVideoPlayer";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  Coins,
  Heart,
  Play,
  Radio,
  Ticket,
  Upload,
  Users,
  Video as VideoIcon,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  ListRenderItem,
  Modal,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
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

  // Video upload state
  const [uploadedVideos, setUploadedVideos] = useState<
    Array<{ uri: string; id: string }>
  >([]);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);

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

  const handleVideoOption = async (option: "camera" | "gallery") => {
    setShowVideoPicker(false);

    try {
      let result;
      if (option === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Permission Required",
            "Camera access is needed to record videos.",
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["videos"],
          allowsEditing: false,
          quality: 1,
        });
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Permission Required",
            "Gallery access is needed to select videos.",
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["videos"],
          allowsMultipleSelection: true,
          selectionLimit: 4,
          quality: 1,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        const videos = result.assets.map((asset) => ({
          uri: asset.uri,
          id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
        }));
        setUploadedVideos(videos);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to select video. Please try again.");
    }
  };

  const handleClearVideos = () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Light);
    setUploadedVideos([]);
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

          {/* Video Upload Section */}
          {uploadedVideos.length === 0 ? (
            <TouchableOpacity
              onPress={() => setShowVideoPicker(true)}
              className="bg-primary rounded-xl p-4 flex-row items-center justify-center gap-2 mb-2"
            >
              <Upload size={20} color="white" />
              <Text className="text-white font-semibold">Upload Video</Text>
            </TouchableOpacity>
          ) : (
            <Animated.View entering={FadeInDown} className="mb-2">
              <View className="bg-white rounded-xl overflow-hidden shadow-md">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
                    setShowVideoPlayer(true);
                  }}
                  className="relative"
                >
                  <View className="w-full aspect-video bg-gray-900 items-center justify-center">
                    <View className="bg-white/90 rounded-full p-4">
                      <Play size={32} color="#094569" fill="#094569" />
                    </View>

                    {/* Video Count Badge */}
                    <View className="absolute top-3 left-3 bg-black/60 rounded-full px-3 py-1">
                      <Text className="text-white text-xs font-semibold">
                        {uploadedVideos.length}{" "}
                        {uploadedVideos.length === 1 ? "video" : "videos"}
                      </Text>
                    </View>

                    {/* Clear Button */}
                    <TouchableOpacity
                      onPress={handleClearVideos}
                      className="absolute top-3 right-3 bg-black/60 rounded-full p-2"
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>

                    {/* Swipe Hint */}
                    {uploadedVideos.length > 1 && (
                      <View className="absolute bottom-3 left-0 right-0 items-center">
                        <Text className="text-white/80 text-xs font-medium">
                          ↕ Swipe to browse videos
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

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

      {/* Video Picker Modal */}
      {showVideoPicker && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showVideoPicker}
          onRequestClose={() => setShowVideoPicker(false)}
        >
          <View className="flex-1 justify-end">
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                }}
                activeOpacity={1}
                onPress={() => setShowVideoPicker(false)}
              />
            </Animated.View>

            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-semibold text-gray-900 mb-6 text-center">
                  Upload Video
                </Text>

                <TouchableOpacity
                  onPress={() => handleVideoOption("camera")}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
                >
                  <VideoIcon size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Record Video
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Use camera to record a new video
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleVideoOption("gallery")}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-6"
                >
                  <Upload size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Choose from Gallery
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Select up to 4 videos from your library
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-gray-100 rounded-xl py-4 items-center"
                  onPress={() => setShowVideoPicker(false)}
                >
                  <Text className="text-gray-600 font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Fullscreen Video Player */}
      {uploadedVideos.length > 0 && (
        <FullscreenVideoPlayer
          visible={showVideoPlayer}
          videos={uploadedVideos}
          onClose={() => setShowVideoPlayer(false)}
        />
      )}
    </>
  );
}
