import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import PopupMessage from "@/components/ui/PopupMessage";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import ImageViewer from "@/components/modals/ImageViewer";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ReportUserModal from "@/components/modals/ReportUserModal";
import { useUser } from "@/contexts/UserContext";
import { blockUser, isUserBlocked, unblockUser } from "@/lib/blockService";
import { EarlyAccessBadgeType, getEarlyAccessBadge } from "@/lib/earlyAccessService";
import { followUser, isFollowing, unfollowUser } from "@/lib/followService";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { fetchUserProfile } from "@/lib/profileService";
import {
    fetchServiceProviderProfile,
    fetchUserProviderServices,
    ProviderServiceWithDetails,
} from "@/lib/servicesService";
import * as Haptics from "expo-haptics";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
    AlertCircle,
    Ban,
    CheckCircle2,
    ChevronLeft,
    Copy,
    GalleryHorizontal,
    Grid,
    MessageCircle,
    Play,
    ShoppingBag,
    User,
    Wrench
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Pressable,
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

// Video thumbnail component – renders the first frame via expo-video
function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

export default function PublicProfileScreen() {
  const { id, tab } = useLocalSearchParams(); // Get user ID from route: /user/123
  const { currentUser } = useUser();
  const router = useRouter();

  // State - ALL hooks must be called before any conditional returns
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

  // Post thumbnails (grouped by post)
  const [postThumbnails, setPostThumbnails] = useState<
    Array<{ postId: string; thumbnailUrl: string; mediaCount: number; isVideo: boolean; post: Post }>
  >([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);

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
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [followRequestsTab, setFollowRequestsTab] = useState<
    "followers" | "following"
  >("followers");
  const [popup, setPopup] = useState<{visible: boolean; type: 'success'|'warning'|'error'|'white'; title: string; message: string}>({visible: false, type: 'white', title: '', message: ''});
  const showPopup = (type: 'success'|'warning'|'error'|'white', title: string, message: string) => setPopup({visible: true, type, title, message});

  // Early-access badge for this profile
  const [badgeType, setBadgeType] = useState<EarlyAccessBadgeType>(null);

  // Horizontal scroll ref
  const horizontalScrollRef = React.useRef<ScrollView>(null);

  // Guard: If viewing own profile, redirect to the main profile tab
  // MOVED AFTER all hooks to avoid hook order violations
  if (currentUser?.id === id) {
    return <Redirect href="/(users)/profile" />;
  }

  // Fetch Data on Mount
  useEffect(() => {
    const loadData = async () => {
      if (!id || typeof id !== "string") return;

      if (!refreshing) setLoading(true);
      try {
        // 1. Fetch Profile Data
        const profile = await fetchUserProfile(id);
        setUserProfile(profile);

        // 1b. Fetch early-access badge (non-blocking, fails silently)
        getEarlyAccessBadge(id).then(setBadgeType).catch(() => {});

        // 2. Fetch Posts
        const posts = await fetchUserPosts(id);
        setUserPosts(posts);

        // 3. Process Images — build grouped thumbnails
        const allImages: string[] = [];
        const thumbs: typeof postThumbnails = [];
        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            thumbs.push({
              postId: post.id,
              thumbnailUrl: post.images[0],
              mediaCount: post.images.length,
              isVideo: isVideoUrl(post.images[0]),
              post,
            });
            post.images.forEach((img: string) => allImages.push(img));
          }
        });
        setUserImages(allImages);
        setPostThumbnails(thumbs);

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
        showPopup('error', 'Load Failed', 'Could not load user profile. Please try again.');
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

        // 1b. Badge (non-blocking)
        getEarlyAccessBadge(id).then(setBadgeType).catch(() => {});

        // 2. Fetch Posts
        const posts = await fetchUserPosts(id);
        setUserPosts(posts);

        // 3. Process Images — build grouped thumbnails
        const allImages: string[] = [];
        const thumbs: typeof postThumbnails = [];
        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            thumbs.push({
              postId: post.id,
              thumbnailUrl: post.images[0],
              mediaCount: post.images.length,
              isVideo: isVideoUrl(post.images[0]),
              post,
            });
            post.images.forEach((img: string) => allImages.push(img));
          }
        });
        setUserImages(allImages);
        setPostThumbnails(thumbs);

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
              if (!currentUser?.id || typeof id !== "string") return;
              setLoadingFollow(true);
              try {
                const result = await unfollowUser(currentUser.id, id);
                if (result.success) {
                  setIsFollowingUser(false);
                  setUserProfile((prev: any) => prev ? { ...prev, follower_count: Math.max(0, (prev.follower_count || 0) - 1) } : prev);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } else {
                  showPopup('error', 'Unfollow Failed', result.error || 'Failed to unfollow user.');
                }
              } catch (error) {
                showPopup('error', 'Unfollow Failed', 'Could not unfollow this user. Please try again.');
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
          setUserProfile((prev: any) => prev ? { ...prev, follower_count: (prev.follower_count || 0) + 1 } : prev);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          showPopup('error', 'Follow Failed', result.error || 'Failed to follow user.');
        }
      } catch (error) {
        showPopup('error', 'Follow Failed', 'Could not follow this user. Please try again.');
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
              if (!currentUser?.id || typeof id !== "string") return;
              const result = await unblockUser(currentUser.id, id);
              if (result.success) {
                setIsBlocked(false);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                showPopup('success', 'User Unblocked', 'This user has been unblocked successfully.');
              } else {
                showPopup('error', 'Unblock Failed', result.error || 'Failed to unblock user.');
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
              if (!currentUser?.id || typeof id !== "string") return;
              const result = await blockUser(currentUser.id, id);
              if (result.success) {
                setIsBlocked(true);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                showPopup('success', 'User Blocked', 'This user has been blocked successfully.');
              } else {
                showPopup('error', 'Block Failed', result.error || 'Failed to block user.');
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

  const handleOpenProfileImage = (imageUri?: string | null) => {
    if (!imageUri) return;
    setViewerImageUri(imageUri);
    setShowProfileImageViewer(true);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-500">User not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />

      <Stack.Screen options={{ headerShown: false }} />

      {/* Fixed Header */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
        className="bg-transparent"
      >
        {/* Custom Header */}
        <View className="flex-row items-center justify-between px-4 pt-16 pb-3 bg-transparent">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <ChevronLeft size={24} className="text-gray-800" />
          </TouchableOpacity>

        <View className="bg-transparent px-4 py-2">
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

      </View>

      {/* Content with Top Padding for Fixed Header */}
      <View style={{ paddingTop: 80 }} className="flex-1">
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
              {/* Profile Info Section — Instagram style */}
              <View className="px-4 pt-5 pb-4">
                {/* Row: Avatar + Stats */}
                <View className="flex-row items-center mb-3">
                  {/* Avatar */}
                  <TouchableOpacity
                    onPress={() => handleOpenProfileImage(userProfile.avatar_url)}
                    disabled={!userProfile.avatar_url}
                    activeOpacity={0.85}
                    className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100"
                  >
                    {userProfile.avatar_url ? (
                      <Image
                        source={{ uri: userProfile.avatar_url }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-gray-100">
                        <User size={34} color="#9ca3af" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Stats row */}
                  <View className="flex-1 flex-row items-center justify-around ml-4">
                    <View className="items-center">
                      <Text className="text-lg font-mbold text-gray-900">
                        {userPosts.length}
                      </Text>
                      <Text className="text-xs font-regular text-gray-500">
                        Posts
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        if (!id || typeof id !== "string") return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFollowRequestsTab("followers");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-lg font-mbold text-gray-900">
                        {userProfile.follower_count || 0}
                      </Text>
                      <Text className="text-xs font-regular text-gray-500">
                        Followers
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        if (!id || typeof id !== "string") return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFollowRequestsTab("following");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-lg font-mbold text-gray-900">
                        {userProfile.following_count || 0}
                      </Text>
                      <Text className="text-xs font-regular text-gray-500">
                        Following
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Name, Badge & Bio */}
                <View className="flex-row items-center gap-4 mb-0.5 flex-wrap">
                  <Text className="text-base font-mbold text-gray-900">
                    {userProfile.name}
                  </Text>
                  {badgeType && (
                    <EarlyAccessBadge badgeType={badgeType} size="sm" />
                  )}
                </View>
                {userProfile.bio && (
                  <Text className="text-sm font-regular text-gray-600 mb-3">
                    {userProfile.bio}
                  </Text>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-2 mt-2">
                  {/* Follow / Following button */}
                  <TouchableOpacity
                    onPress={handleMainAction}
                    disabled={loadingFollow}
                    className={`flex-1 py-[9px] rounded-lg flex-row items-center justify-center ${
                      isFollowingUser
                        ? "bg-gray-100 border border-gray-300"
                        : "bg-primary"
                    }`}
                  >
                    {loadingFollow ? (
                      <ActivityIndicator
                        size="small"
                        color={isFollowingUser ? "#374151" : "white"}
                      />
                    ) : (
                      <Text
                        className={`text-sm font-semibold ${
                          isFollowingUser ? "text-gray-800" : "text-white"
                        }`}
                      >
                        {isFollowingUser ? "Following" : "Follow"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Message button — visible only when following */}
                  {isFollowingUser && (
                    <TouchableOpacity
                      onPress={() => {
                        if (typeof id !== "string") return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/(users)/chat/${id}` as any);
                      }}
                      className="flex-1 py-[9px] rounded-lg flex-row items-center justify-center gap-1.5 bg-gray-100 border border-gray-300"
                    >

                      <Text className="text-sm font-semibold text-gray-800">
                        Message
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Tab Navigation */}
              <View className="bg-transparent border-b border-gray-100 mt-2">
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "images"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("images")}
                  >
                    <GalleryHorizontal
                      size={24}
                      strokeWidth={1.5}
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
                      Media
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
                      strokeWidth={1.5}
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
                      strokeWidth={1.5}
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
                    {postThumbnails.length > 0 ? (
                      postThumbnails.map((thumb) => {
                        return (
                          <View
                            key={thumb.postId}
                            className="w-[33.33%] aspect-[9/12] p-[1px]"
                          >
                            <TouchableOpacity
                              className="flex-1 bg-gray-100 relative"
                              onPress={() => {
                                setSelectedPost(thumb.post);
                                setSelectedMediaIndex(0);
                                setShowImageViewer(true);
                              }}
                            >
                              {thumb.isVideo ? (
                                <VideoThumb uri={thumb.thumbnailUrl} />
                              ) : (
                                <Image
                                  source={{ uri: thumb.thumbnailUrl }}
                                  className="w-full h-full"
                                  resizeMode="cover"
                                />
                              )}
                              {/* Stacked icon for multi-image posts */}
                              {thumb.mediaCount > 1 && (
                                <View className="absolute top-1.5 right-1.5">
                                  <Copy size={14} color="#fff" strokeWidth={2} />
                                </View>
                              )}
                              {/* Video indicator */}
                              {thumb.isVideo && thumb.mediaCount <= 1 && (
                                <View className="absolute top-1.5 right-1.5">
                                  <Play size={14} color="#fff" strokeWidth={1.5} />
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                          <Grid size={26} strokeWidth={1.5} color="#9CA3AF" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-500">
                          No moments shared yet
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1">
                          Posts will appear here
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
                            className="bg-transparent rounded-xl overflow-hidden border border-gray-100"
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
                                  strokeWidth={1.5}
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
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                          <ShoppingBag size={26} strokeWidth={1.5} color="#9CA3AF" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-500">
                          No products listed yet
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1">
                          Products will show up here once listed
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "services" && (
                  <View className="items-center justify-center py-16 px-6">
                    <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                      <Wrench size={26} strokeWidth={1.5} color="#9CA3AF" />
                    </View>
                    <Text className="text-sm font-semibold text-gray-500">
                      No services offered yet
                    </Text>
                    <Text className="text-xs text-gray-400 mt-1">
                      Services will appear here when available
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
                <View>
                  {/* Profile Info Section — Instagram style */}
                  <View className="px-4 pt-5 pb-2">
                    {/* Certified badge above avatar */}
                    {serviceProvider.verification_status === "verified" && (
                      <View className="flex-row items-center bg-blue-50 border border-blue-100 px-3 py-1 rounded-full mb-3 self-start">
                        <CheckCircle2 size={13} color="#3B82F6" fill="#3B82F6" />
                        <Text className="text-xs font-msemibold text-blue-600 ml-1">
                          Certified
                        </Text>
                      </View>
                    )}

                    {/* Row: Avatar + Stats */}
                    <View className="flex-row items-center mb-3 w-full">
                      {/* Avatar */}
                      <TouchableOpacity
                        onPress={() =>
                          handleOpenProfileImage(
                            serviceProvider.profile_url || userProfile.avatar_url,
                          )
                        }
                        disabled={!serviceProvider.profile_url && !userProfile.avatar_url}
                        activeOpacity={0.85}
                        className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100"
                      >
                        {serviceProvider.profile_url || userProfile.avatar_url ? (
                          <Image
                            source={{
                              uri: serviceProvider.profile_url || userProfile.avatar_url,
                            }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center bg-gray-100">
                            <Wrench size={32} color="#9ca3af" />
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Work stats */}
                      <View className="flex-1 flex-row items-center justify-around ml-4">
                        <View className="items-center">
                          <Text className="text-lg font-mbold text-gray-900">
                            {providerServices.length}
                          </Text>
                          <Text className="text-xs font-regular text-gray-500">
                            Services
                          </Text>
                        </View>
                        <TouchableOpacity
                          className="items-center"
                          onPress={() => {
                            if (!id || typeof id !== "string") return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setFollowRequestsTab("followers");
                            setShowFollowRequests(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text className="text-lg font-mbold text-gray-900">
                            {userProfile.follower_count || 0}
                          </Text>
                          <Text className="text-xs font-regular text-gray-500">
                            Followers
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="items-center"
                          onPress={() => {
                            if (!id || typeof id !== "string") return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setFollowRequestsTab("following");
                            setShowFollowRequests(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text className="text-lg font-mbold text-gray-900">
                            {userProfile.following_count || 0}
                          </Text>
                          <Text className="text-xs font-regular text-gray-500">
                            Following
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Name */}
                    <Text className="text-base font-mbold text-gray-900 mb-0.5">
                      {userProfile.name}
                    </Text>

                    {/* Business bio */}
                    {serviceProvider.master_bio ? (
                      <Text className="text-sm font-regular text-gray-500 mb-3">
                        {serviceProvider.master_bio}
                      </Text>
                    ) : null}

                    {/* Action Buttons for Work tab */}
                    <View className="flex-row gap-2 mt-1">
                      <TouchableOpacity
                        onPress={handleMainAction}
                        disabled={loadingFollow}
                        className={`flex-1 py-[9px] rounded-lg flex-row items-center justify-center ${
                          isFollowingUser
                            ? "bg-gray-100 border border-gray-300"
                            : "bg-primary"
                        }`}
                      >
                        {loadingFollow ? (
                          <ActivityIndicator
                            size="small"
                            color={isFollowingUser ? "#374151" : "white"}
                          />
                        ) : (
                          <Text
                            className={`text-sm font-msemibold ${
                              isFollowingUser ? "text-gray-800" : "text-white"
                            }`}
                          >
                            {isFollowingUser ? "Following" : "Follow"}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {isFollowingUser && (
                        <TouchableOpacity
                          onPress={() => {
                            if (typeof id !== "string") return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/(users)/chat/${id}` as any);
                          }}
                          className="flex-1 py-[9px] rounded-lg flex-row items-center justify-center gap-1.5 bg-gray-100 border border-gray-300"
                        >
                          <MessageCircle size={16} color="#374151" />
                          <Text className="text-sm font-msemibold text-gray-800">
                            Message
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Contact info row */}
                    {(serviceProvider.profiles?.email || serviceProvider.profiles?.phone) && (
                      <View className="flex-row items-center gap-3 mt-2">
                        {serviceProvider.profiles?.email ? (
                          <Text className="text-xs font-regular text-gray-500" numberOfLines={1}>
                            {serviceProvider.profiles.email}
                          </Text>
                        ) : null}
                        {serviceProvider.profiles?.email && serviceProvider.profiles?.phone && (
                          <View className="w-[1px] h-3 bg-gray-300" />
                        )}
                        {serviceProvider.profiles?.phone ? (
                          <Text className="text-xs font-regular text-gray-500">
                            {serviceProvider.profiles.phone}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {/* Divider */}
                  <View className="h-[1px] bg-gray-100 mx-4 mb-4" />

                  {/* Services Section */}
                  <View className="bg-transparent border-b border-gray-100">
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                      <Text className="text-base font-mbold text-gray-900">
                        Services Offered
                      </Text>
                      {providerServices.length > 0 && (
                        <Text className="text-xs font-regular text-gray-400">
                          {providerServices.length} service{providerServices.length > 1 ? "s" : ""}
                        </Text>
                      )}
                    </View>

                    {providerServices.length > 0 ? (
                      <View>
                        {providerServices.map((service) => (
                          <TouchableOpacity
                            key={service.id}
                            className="flex-row items-center px-4 py-4 border-b border-gray-100"
                            onPress={() =>
                              router.push(
                                `/(users)/servicedetail/${service.id}` as any,
                              )
                            }
                          >
                            {/* Service Image */}
                            {service.images && service.images.length > 0 ? (
                              <Image
                                source={{ uri: service.images[0] }}
                                className="w-16 h-16 rounded-xl"
                                resizeMode="cover"
                              />
                            ) : (
                              <View className="w-16 h-16 rounded-xl bg-gray-100 items-center justify-center">
                                <Wrench size={24} className="text-gray-400" />
                              </View>
                            )}

                            {/* Service Info */}
                            <View className="flex-1 ml-3">
                              <Text
                                className="text-sm font-msemibold text-gray-900 mb-0.5"
                                numberOfLines={1}
                              >
                                {service.name}
                              </Text>
                              {service.service_categories && (
                                <Text className="text-xs font-regular text-primary mb-1">
                                  {service.service_categories.name}
                                </Text>
                              )}
                              <Text
                                className="text-xs font-regular text-gray-500"
                                numberOfLines={2}
                              >
                                {service.description}
                              </Text>
                            </View>

                            {/* Active badge */}
                            <View
                              className={`px-2 py-1 rounded-full ml-2 ${service.status ? "bg-green-100" : "bg-red-100"}`}
                            >
                              <Text
                                className={`text-xs font-msemibold ${service.status ? "text-green-700" : "text-red-700"}`}
                              >
                                {service.status ? "Active" : "Inactive"}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View className="items-center justify-center py-16 px-6">
                        <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                          <Wrench size={26} strokeWidth={1.5} color="#9CA3AF" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-500">
                          No services listed yet
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1">
                          Services will appear here when available
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

      {showFollowRequests && typeof id === "string" && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showFollowRequests}
          onRequestClose={() => setShowFollowRequests(false)}
        >
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={{
              height: "100%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <FollowRequestsOverlay
              onClose={() => setShowFollowRequests(false)}
              userId={id}
              actorUserId={currentUser?.id}
              initialTab={followRequestsTab}
            />
          </Animated.View>
        </Modal>
      )}

      {/* Block/Report Menu Modal */}
      <Modal
        visible={showBlockMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlockMenu(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={() => setShowBlockMenu(false)}
        >
          <Pressable onPress={() => {}}>
            <Animated.View
              entering={SlideInDown.springify()}
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
          </Pressable>
        </Pressable>
      </Modal>

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

      {showImageViewer && selectedPost && (
        <ImageViewer
          visible={showImageViewer}
          images={selectedPost.images}
          initialIndex={selectedMediaIndex}
          onClose={() => setShowImageViewer(false)}
          postContent={selectedPost.content}
          username={userProfile?.name || userProfile?.username || "User"}
          likes={selectedPost.likes}
          comments={selectedPost.comments}
          postId={selectedPost.id}
          postUserId={selectedPost.user_id}
        />
      )}

      <ProfileImageViewer
        visible={showProfileImageViewer}
        imageUri={viewerImageUri}
        onClose={() => {
          setShowProfileImageViewer(false);
          setViewerImageUri(null);
        }}
      />
    </View>
  );
}
