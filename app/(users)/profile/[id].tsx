import ReportUserModal from "@/components/modals/ReportUserModal";
import { useUser } from "@/contexts/UserContext";
import { blockUser, isUserBlocked, unblockUser } from "@/lib/blockService";
import { followUser, isFollowing, unfollowUser } from "@/lib/followService";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { fetchUserProfile } from "@/lib/profileService";
import {
  fetchServiceProviderProfile,
  fetchUserProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Grid,
  Image as ImageLucide,
  Play,
  ShoppingBag,
  User,
  UserCheck,
  UserPlus,
  Wrench,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Helper to check if URL is a video
const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("post-videos")
  );
};

export default function PublicProfileScreen() {
  const { id, tab } = useLocalSearchParams(); // Get user ID from route: /user/123
  const { currentUser } = useUser();
  const router = useRouter();

  // Guard: If viewing own profile, redirect to the main profile tab
  if (currentUser?.id === id) {
    return <Redirect href="/(users)/profile" />;
  }

  // State
  const [mainTab, setMainTab] = useState<"main" | "work">(
    tab === "work" ? "work" : "main",
  );
  const [activeTab, setActiveTab] = useState<
    "images" | "products" | "services"
  >("images");
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [userProducts, setUserProducts] = useState<Product[]>([]);

  // Service provider state
  const [serviceProvider, setServiceProvider] = useState<any>(null);
  const [providerServices, setProviderServices] = useState<
    ProviderServiceWithDetails[]
  >([]);
  const [loadingServiceProvider, setLoadingServiceProvider] = useState(false);

  // Follow/Message State
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  // Block/Report State
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Horizontal scroll ref
  const horizontalScrollRef = React.useRef<ScrollView>(null);

  // Fetch Data on Mount
  useEffect(() => {
    const loadData = async () => {
      if (!id || typeof id !== "string") return;

      if (!refreshing) setLoading(true);
      try {
        // 1. Fetch Profile Data
        const profile = await fetchUserProfile(id);
        setUserProfile(profile);

        // 2. Fetch Posts
        const posts = await fetchUserPosts(id);
        setUserPosts(posts);

        // 3. Process Images
        const allImages: string[] = [];
        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            post.images.forEach((img: string) => allImages.push(img));
          }
        });
        setUserImages(allImages);

        // 4. Fetch Products
        const products = await fetchUserProducts(id);
        setUserProducts(products);

        // 5. Check Follow Status
        if (currentUser?.id) {
          const status = await isFollowing(currentUser.id, id);
          setIsFollowingUser(status);

          // 6. Check Block Status
          const blocked = await isUserBlocked(currentUser.id, id);
          setIsBlocked(blocked);
        }

        // 7. Fetch Service Provider Profile
        setLoadingServiceProvider(true);
        const providerData = await fetchServiceProviderProfile(id);
        setServiceProvider(providerData);

        // 8. Fetch Provider Services
        if (providerData) {
          const services = await fetchUserProviderServices(id);
          setProviderServices(services);
        }
        setLoadingServiceProvider(false);
      } catch (error) {
        console.error("Error loading public profile:", error);
        Alert.alert("Error", "Could not load user profile");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    loadData();
  }, [id, currentUser?.id]);

  // Scroll to Work tab if tab parameter is "work"
  useEffect(() => {
    if (tab === "work" && horizontalScrollRef.current) {
      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({
          x: SCREEN_WIDTH,
          animated: true,
        });
      }, 100);
    }
  }, [tab]);

  // Refresh Handler
  const handleRefresh = () => {
    setRefreshing(true);
    const loadData = async () => {
      if (!id || typeof id !== "string") return;

      try {
        // 1. Fetch Profile Data
        const profile = await fetchUserProfile(id);
        setUserProfile(profile);

        // 2. Fetch Posts
        const posts = await fetchUserPosts(id);
        setUserPosts(posts);

        // 3. Process Images
        const allImages: string[] = [];
        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            post.images.forEach((img: string) => allImages.push(img));
          }
        });
        setUserImages(allImages);

        // 4. Fetch Products
        const products = await fetchUserProducts(id);
        setUserProducts(products);

        // 5. Check Follow Status
        if (currentUser?.id) {
          const status = await isFollowing(currentUser.id, id);
          setIsFollowingUser(status);

          // 6. Check Block Status
          const blocked = await isUserBlocked(currentUser.id, id);
          setIsBlocked(blocked);
        }

        // 7. Fetch Service Provider Profile
        setLoadingServiceProvider(true);
        const providerData = await fetchServiceProviderProfile(id);
        setServiceProvider(providerData);

        // 8. Fetch Provider Services
        if (providerData) {
          const services = await fetchUserProviderServices(id);
          setProviderServices(services);
        }
        setLoadingServiceProvider(false);
      } catch (error) {
        console.error("Error loading public profile:", error);
      } finally {
        setRefreshing(false);
      }
    };
    loadData();
  };

  // Handle main tab change with scroll
  const handleMainTabChange = (tab: "main" | "work") => {
    setMainTab(tab);
    if (horizontalScrollRef.current) {
      const offset = tab === "main" ? 0 : SCREEN_WIDTH;
      horizontalScrollRef.current.scrollTo({ x: offset, animated: true });
    }
  };

  // Handle scroll event to update active tab
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newTab = offsetX > SCREEN_WIDTH / 2 ? "work" : "main";
    if (newTab !== mainTab) {
      setMainTab(newTab);
    }
  };

  // Action Handlers
  const handleMainAction = async () => {
    if (!currentUser?.id || typeof id !== "string") return;

    if (isFollowingUser) {
      // If already following, unfollow on button click
      Alert.alert(
        "Unfollow",
        `Are you sure you want to unfollow ${
          userProfile?.name || "this user"
        }?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unfollow",
            style: "destructive",
            onPress: async () => {
              setLoadingFollow(true);
              try {
                const result = await unfollowUser(currentUser.id, id as string);
                if (result.success) {
                  setIsFollowingUser(false);
                } else {
                  Alert.alert("Error", result.error || "Failed to unfollow");
                }
              } catch (error) {
                Alert.alert("Error", "Failed to unfollow");
              } finally {
                setLoadingFollow(false);
              }
            },
          },
        ],
      );
    } else {
      // If not following, this button is "Follow"
      setLoadingFollow(true);
      try {
        const result = await followUser(currentUser.id, id);
        if (result.success) {
          setIsFollowingUser(true);
        } else {
          Alert.alert("Error", result.error || "Failed to follow user");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to follow user");
      } finally {
        setLoadingFollow(false);
      }
    }
  };

  // Block/Unblock Handler
  const handleBlockToggle = async () => {
    if (!currentUser?.id || typeof id !== "string") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isBlocked) {
      // Show unblock confirmation
      Alert.alert(
        "Unblock User",
        `Are you sure you want to unblock @${
          userProfile?.name || "this user"
        }?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            style: "default",
            onPress: async () => {
              const result = await unblockUser(currentUser.id, id as string);
              if (result.success) {
                setIsBlocked(false);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert("Success", "User unblocked");
              } else {
                Alert.alert("Error", result.error || "Failed to unblock user");
              }
            },
          },
        ],
      );
    } else {
      // Block user
      Alert.alert(
        "Block User",
        `Are you sure you want to block @${userProfile?.name || "this user"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              const result = await blockUser(currentUser.id, id as string);
              if (result.success) {
                setIsBlocked(true);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert("Success", "User blocked");
              } else {
                Alert.alert("Error", result.error || "Failed to block user");
              }
            },
          },
        ],
      );
    }
    setShowBlockMenu(false);
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowBlockMenu(false);
    setShowReportModal(true);
  };

  const handleReportSuccess = () => {
    // Called after successful report with "Block" confirmation
    handleBlockToggle();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">User not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Set Header Title dynamically if needed, or hide default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Fixed Header */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
        className="bg-white"
      >
        {/* Custom Header */}
        <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-white border-b border-gray-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <ArrowLeft size={24} className="text-gray-800" />
          </TouchableOpacity>

          <Text className="text-lg font-mbold text-gray-900" numberOfLines={1}>
            {userProfile.username || userProfile.name || "Profile"}
          </Text>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowBlockMenu(true);
            }}
            className="w-10 h-10 items-center justify-center"
          >
            <AlertCircle size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Main/Work Tabs - Floating Bubbles */}
        <View className="bg-white px-4 py-2">
          <View className="flex-row gap-2 justify-center">
            <TouchableOpacity
              className={`px-8 py-1.5 items-center rounded-full ${mainTab === "main" ? "bg-primary" : "bg-gray-100"}`}
              onPress={() => handleMainTabChange("main")}
            >
              <Text
                className={`font-msemibold text-sm ${mainTab === "main" ? "text-white" : "text-gray-600"}`}
              >
                Main
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-8 py-1.5 items-center rounded-full ${mainTab === "work" ? "bg-primary" : "bg-gray-100"}`}
              onPress={() => handleMainTabChange("work")}
            >
              <Text
                className={`font-msemibold text-sm ${mainTab === "work" ? "text-white" : "text-gray-600"}`}
              >
                Work
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content with Top Padding for Fixed Header */}
      <View style={{ paddingTop: 120 }} className="flex-1">
        {/* Horizontal Scrollable Content */}
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          className="flex-1"
        >
          {/* Main Profile Page */}
          <View style={{ width: SCREEN_WIDTH }}>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#094569"
                  colors={["#094569"]}
                  progressViewOffset={0}
                />
              }
            >
              {/* Profile Info Section */}
              <View className="px-4 py-6 items-center">
                {/* Avatar */}
                <View className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden mb-4 border border-gray-100">
                  {userProfile.avatar_url ? (
                    <Image
                      source={{ uri: userProfile.avatar_url }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-gray-100">
                      <User size={32} className="text-gray-400" />
                    </View>
                  )}
                </View>

                {/* Name & Bio */}
                <Text className="text-2xl font-mbold text-gray-900 text-center mb-1">
                  {userProfile.name}
                </Text>
                {userProfile.bio && (
                  <Text className="text-sm font-regular text-gray-500 text-center px-8 mb-4">
                    {userProfile.bio}
                  </Text>
                )}

                {/* Stats */}
                <View className="flex-row items-center justify-center space-x-8 mt-2 mb-6">
                  <View className="items-center">
                    <Text className="text-lg font-mbold text-gray-900">
                      {userProducts.length}
                    </Text>
                    <Text className="text-xs font-regular text-gray-500">
                      Products
                    </Text>
                  </View>
                  <View className="w-[1px] h-8 bg-gray-200" />
                  <View className="items-center">
                    <Text className="text-lg font-mbold text-gray-900">
                      {userProfile.follower_count || 0}
                    </Text>
                    <Text className="text-xs font-regular text-gray-500">
                      Followers
                    </Text>
                  </View>
                  <View className="w-[1px] h-8 bg-gray-200" />
                  <View className="items-center">
                    <Text className="text-lg font-mbold text-gray-900">
                      {userProfile.following_count || 0}
                    </Text>
                    <Text className="text-xs font-regular text-gray-500">
                      Following
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3 w-full px-4">
                  {/* Main Button: Follow OR Followed (tap to unfollow) */}
                  <TouchableOpacity
                    onPress={handleMainAction}
                    disabled={loadingFollow}
                    className={`flex-1 py-3 rounded-xl flex-row items-center justify-center ${
                      isFollowingUser
                        ? "bg-gray-100 border border-gray-300"
                        : "bg-primary"
                    }`}
                  >
                    {loadingFollow ? (
                      <ActivityIndicator
                        size="small"
                        color={isFollowingUser ? "black" : "white"}
                      />
                    ) : (
                      <>
                        {isFollowingUser ? (
                          <>
                            <UserCheck
                              size={18}
                              className="text-gray-600 mr-2"
                            />
                            <Text className="text-gray-600 font-msemibold">
                              Followed
                            </Text>
                          </>
                        ) : (
                          <>
                            <UserPlus size={18} className="text-white mr-2" />
                            <Text className="text-white font-msemibold">
                              Follow
                            </Text>
                          </>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tab Navigation */}
              <View className="bg-white border-b border-gray-100 mt-2">
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "images"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("images")}
                  >
                    <ImageLucide
                      size={24}
                      className={`mb-1 ${
                        activeTab === "images"
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "images"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Images
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "products"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("products")}
                  >
                    <ShoppingBag
                      size={24}
                      className={`mb-1 ${
                        activeTab === "products"
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "products"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Products
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "services"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("services")}
                  >
                    <Wrench
                      size={24}
                      className={`mb-1 ${
                        activeTab === "services"
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "services"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Services
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tab Content */}
              <View className="min-h-[300px]">
                {activeTab === "images" && (
                  <View className="flex-row flex-wrap">
                    {userImages.length > 0 ? (
                      userImages.map((imageUrl, index) => {
                        const isVideo = isVideoUrl(imageUrl);
                        return (
                          <View
                            key={index}
                            className="w-[33.33%] aspect-square p-[1px]"
                          >
                            <TouchableOpacity className="flex-1 bg-gray-100 relative">
                              <Image
                                source={{ uri: imageUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                              />
                              {isVideo && (
                                <View className="absolute inset-0 items-center justify-center bg-black/30">
                                  <Play size={20} color="#FFF" fill="#FFF" />
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    ) : (
                      <View className="w-full py-12 items-center">
                        <Grid size={40} className="text-gray-300 mb-2" />
                        <Text className="text-gray-400 font-mmedium">
                          No images shared yet
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "products" && (
                  <View className="flex-row flex-wrap">
                    {userProducts.length > 0 ? (
                      userProducts.map((product) => (
                        <View key={product.id} className="w-[50%] p-2">
                          <TouchableOpacity
                            onPress={() =>
                              router.push(
                                `/(users)/product/${product.id}` as any,
                              )
                            }
                            className="bg-white rounded-xl overflow-hidden border border-gray-100"
                          >
                            {product.images && product.images.length > 0 ? (
                              <Image
                                source={{ uri: product.images[0] }}
                                className="w-full h-40"
                                resizeMode="cover"
                              />
                            ) : (
                              <View className="w-full h-40 bg-gray-100 items-center justify-center">
                                <ShoppingBag
                                  size={32}
                                  className="text-gray-300"
                                />
                              </View>
                            )}
                            <View className="p-3">
                              <Text
                                className="text-sm font-msemibold text-gray-900"
                                numberOfLines={2}
                              >
                                {product.name}
                              </Text>
                              <Text
                                className="text-xs font-regular text-gray-500 mt-1"
                                numberOfLines={1}
                              >
                                {product.category}
                              </Text>
                              <Text className="text-base font-mbold text-primary mt-2">
                                Nu. {product.price.toLocaleString()}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <View className="w-full py-12 items-center">
                        <ShoppingBag size={40} className="text-gray-300 mb-2" />
                        <Text className="text-gray-400 font-mmedium">
                          No products listed
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "services" && (
                  <View className="items-center justify-center py-12">
                    <Wrench size={40} className="text-gray-300 mb-2" />
                    <Text className="text-gray-400 font-mmedium">
                      No services offered
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom spacer */}
              <View className="h-8" />
            </ScrollView>
          </View>

          {/* Work Profile Page (Service Provider) */}
          <View style={{ width: SCREEN_WIDTH }}>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#094569"
                  colors={["#094569"]}
                  progressViewOffset={0}
                />
              }
            >
              {loadingServiceProvider ? (
                <ActivityIndicator
                  size="large"
                  color="#094569"
                  className="py-12"
                />
              ) : serviceProvider ? (
                <View className="px-4 py-6">
                  {/* Service Provider Header */}
                  <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
                    <Text className="text-xl font-mbold text-gray-900 mb-6">
                      Service Provider Profile
                    </Text>

                    {/* Avatar Section */}
                    <View className="items-center mb-6">
                      <View className="relative">
                        <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center overflow-hidden">
                          {serviceProvider.profile_url ? (
                            <Image
                              source={{ uri: serviceProvider.profile_url }}
                              className="w-24 h-24 rounded-full"
                              resizeMode="cover"
                            />
                          ) : (
                            <Wrench size={40} className="text-gray-400" />
                          )}
                        </View>
                        {/* Verified Badge */}
                        {serviceProvider.status === "verified" && (
                          <View className="absolute top-0 right-0 w-7 h-7 bg-blue-500 rounded-full items-center justify-center border-2 border-white">
                            <CheckCircle2
                              size={16}
                              color="white"
                              fill="white"
                            />
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Form Fields */}
                    <View className="space-y-4">
                      {/* Two Column Layout - Email & Phone */}
                      <View className="flex-row gap-3 mb-4">
                        {/* Contact Email */}
                        <View className="flex-1">
                          <Text className="text-sm font-msemibold text-gray-700 mb-2">
                            Email
                          </Text>
                          <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <Text
                              className="text-base font-regular text-gray-900"
                              numberOfLines={1}
                            >
                              {serviceProvider.profiles?.email || "Not set"}
                            </Text>
                          </View>
                        </View>

                        {/* Contact Phone */}
                        <View className="flex-1">
                          <Text className="text-sm font-msemibold text-gray-700 mb-2">
                            Phone
                          </Text>
                          <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <Text
                              className="text-base font-regular text-gray-900"
                              numberOfLines={1}
                            >
                              {serviceProvider.profiles?.phone || "Not set"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Business Bio - Full Width */}
                      <View className="mb-4">
                        <Text className="text-sm font-msemibold text-gray-700 mb-2">
                          Business Bio
                        </Text>
                        <View className="bg-gray-50 rounded-xl px-4 py-3">
                          <Text className="text-base font-regular text-gray-900">
                            {serviceProvider.master_bio || (
                              <Text className="italic text-gray-400">
                                Not set
                              </Text>
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Services Section */}
                  <View className="bg-white rounded-2xl p-6 shadow-sm">
                    <Text className="text-lg font-mbold text-gray-900 mb-2">
                      Services Offered
                    </Text>
                    <Text className="text-sm text-gray-500 mb-4">
                      {providerServices.length > 0
                        ? `${providerServices.length} service${providerServices.length > 1 ? "s" : ""} offered`
                        : "No services listed"}
                    </Text>

                    {providerServices.length > 0 ? (
                      <View className="space-y-3">
                        {providerServices.map((service) => (
                          <TouchableOpacity
                            key={service.id}
                            className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                            onPress={() =>
                              router.push(
                                `/(users)/servicedetail/${service.id}` as any,
                              )
                            }
                          >
                            <View className="flex-row">
                              {/* Service Image */}
                              {service.images && service.images.length > 0 ? (
                                <Image
                                  source={{ uri: service.images[0] }}
                                  className="w-20 h-20 rounded-lg"
                                  resizeMode="cover"
                                />
                              ) : (
                                <View className="w-20 h-20 rounded-lg bg-gray-200 items-center justify-center">
                                  <Wrench size={32} className="text-gray-400" />
                                </View>
                              )}

                              {/* Service Info */}
                              <View className="flex-1 ml-4">
                                <View className="flex-row items-center justify-between mb-1">
                                  <Text
                                    className="text-base font-mbold text-gray-900 flex-1"
                                    numberOfLines={1}
                                  >
                                    {service.name}
                                  </Text>
                                  <View
                                    className={`px-2 py-1 rounded-full ${service.status ? "bg-green-100" : "bg-red-100"}`}
                                  >
                                    <Text
                                      className={`text-xs font-msemibold ${service.status ? "text-green-700" : "text-red-700"}`}
                                    >
                                      {service.status ? "Active" : "Inactive"}
                                    </Text>
                                  </View>
                                </View>

                                {service.service_categories && (
                                  <Text className="text-xs font-regular text-primary mb-1">
                                    {service.service_categories.name}
                                  </Text>
                                )}

                                <Text
                                  className="text-sm font-regular text-gray-600"
                                  numberOfLines={2}
                                >
                                  {service.description}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View className="items-center justify-center py-8 bg-gray-50 rounded-xl">
                        <Wrench size={48} className="text-gray-400 mb-4" />
                        <Text className="text-base text-gray-500">
                          No services listed yet
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View className="items-center justify-center py-12 px-4">
                  <User size={48} className="text-gray-400 mb-4" />
                  <Text className="text-base text-gray-500">
                    Not a service provider
                  </Text>
                </View>
              )}
              <View className="h-8" />
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* Block/Report Menu Modal */}
      {showBlockMenu && (
        <Modal
          visible={showBlockMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBlockMenu(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowBlockMenu(false)}
            className="flex-1 bg-black/50 justify-end"
          >
            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              className="bg-white rounded-t-3xl pb-8"
            >
              <View className="px-6 py-4 border-b border-gray-200">
                <Text className="text-lg font-mbold text-gray-900">
                  User Actions
                </Text>
              </View>

              {/* Block/Unblock Option */}
              <TouchableOpacity
                onPress={handleBlockToggle}
                className="flex-row items-center px-6 py-4 border-b border-gray-100"
              >
                <Ban size={24} color={isBlocked ? "#10B981" : "#EF4444"} />
                <View className="ml-4 flex-1">
                  <Text className="text-base font-msemibold text-gray-900">
                    {isBlocked ? "Unblock User" : "Block User"}
                  </Text>
                  <Text className="text-sm text-gray-500 font-regular">
                    {isBlocked
                      ? "You will see their content again"
                      : "You won't see their content"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Report Option */}
              <TouchableOpacity
                onPress={handleReport}
                className="flex-row items-center px-6 py-4"
              >
                <AlertCircle size={24} color="#F59E0B" />
                <View className="ml-4 flex-1">
                  <Text className="text-base font-msemibold text-gray-900">
                    Report User
                  </Text>
                  <Text className="text-sm text-gray-500 font-regular">
                    Report for violating guidelines
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setShowBlockMenu(false)}
                className="mx-6 mt-4 py-3 rounded-2xl bg-gray-100"
              >
                <Text className="text-center text-gray-900 font-msemibold">
                  Cancel
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Report Modal */}
      {currentUser?.id && userProfile && typeof id === "string" && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetUserId={id}
          targetUserName={userProfile.name || userProfile.username || "user"}
          currentUserId={currentUser.id}
          onReportSuccess={handleReportSuccess}
        />
      )}
    </View>
  );
}
