import MaskedView from "@react-native-masked-view/masked-view";
import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import ShareArcIcon from "@/components/icons/ShareArcIcon";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ReportUserModal from "@/components/modals/ReportUserModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import ProfilePostGridItem, { profileGridCellHeight } from "@/components/profile/ProfilePostGridItem";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import { useGridReveal } from "@/hooks/useGridReveal";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { blockUser, isUserBlocked, unblockUser } from "@/lib/blockService";
import { EarlyAccessBadgeType, getEarlyAccessBadge } from "@/lib/earlyAccessService";
import { followUser, isFollowing, unfollowUser } from "@/lib/followService";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { fetchUserProfile } from "@/lib/profileService";
import { trackProfileView } from "@/lib/viewTrackingService";
import { fetchServiceProviderProfile } from "@/lib/servicesService";
import { buildProfileExternalSharePayload } from "@/lib/shareUtils";
import { useAppRouter } from "@/utils/navigation";
import { useIsFocused } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import {
    AlertCircle,
    Ban,
    ChevronLeft,
    Grid,
    MapPin,
    MoreHorizontal,
    QrCode,
    ShoppingBag,
    User,
    Verified,
    Wrench
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    SlideInDown,
    SlideOutDown,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// HEADER_GRADIENT/COVER_GRADIENT used to be a fixed navy-blue pair here —
// now they're computed per-profile by useCoverPalette (see below), so the
// header/cover/matte tint all share one hue drawn from this user's own cover
// photo (or a deterministic fallback when they have none). HEADER_GRADIENT's
// bottom stop is still exactly COVER_GRADIENT's top stop so the seam between
// them stays invisible, same as before.

// Height of the fixed icon/tab row overlaid on top of the cover — the cover
// now renders behind this whole strip, so content that used to sit below it
// needs this much top offset instead.
const HEADER_HEIGHT = 80;
// How far (in scroll px) the header background fades from transparent
// (cover photo showing through) to the solid gradient, so icons stay
// legible once the cover has scrolled out of view.
const HEADER_FADE_DISTANCE = 150;

// Eases the blur mask below from 0 at the panel's top edge to 1 at its
// bottom, instead of the blur switching on abruptly — same smoothstep
// recipe as FeedPost's header blur fade (components/FeedPost.tsx).
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}
function matteBlurFadeStops() {
  const STEPS = 5;
  const locations = Array.from(
    { length: STEPS + 1 },
    (_, i) => i / STEPS,
  ) as unknown as [number, number, ...number[]];
  const colors = Array.from({ length: STEPS + 1 }, (_, i) => {
    const alpha = smoothstep(i / STEPS);
    return `rgba(255,255,255,${alpha.toFixed(3)})`;
  }) as unknown as [string, string, ...string[]];
  return { colors, locations };
}
const MATTE_BLUR_FADE_STOPS = matteBlurFadeStops();

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
  const router = useAppRouter();
  // A screen pushed on top of this one (e.g. /post/[id], presented as a
  // transparentModal so this stays mounted/visible underneath while its own
  // ContextDrop edge-swipe-back is in progress) shouldn't leave this still
  // competing for the same touches — this screen's own full-bleed vertical
  // ScrollView spans the same left-edge strip ContextDrop captures from, and
  // was winning that race often enough to make the edge-swipe unreliable
  // whenever a post was opened from here. Turning this off entirely while
  // unfocused removes it from the picture.
  const isFocused = useIsFocused();

  // State - ALL hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState<"images" | "products">("images");
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [userProducts, setUserProducts] = useState<Product[]>([]);

  // Post thumbnails (grouped by post)
  const [postThumbnails, setPostThumbnails] = useState<
    Array<{ postId: string; thumbnailUrl: string; thumbnailBlurHash: string | null; mediaCount: number; isVideo: boolean; post: Post }>
  >([]);
  const postGridReveal = useGridReveal();
  useEffect(() => {
    postGridReveal.rearm();
  }, [postThumbnails.length, postGridReveal.rearm]);
  // Service provider state — just enough to show/link the Work profile
  // summary card; the services list itself now lives on /profile/work.
  const [serviceProvider, setServiceProvider] = useState<any>(null);
  const [loadingServiceProvider, setLoadingServiceProvider] = useState(false);

  // Follow/Message State
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  // Block/Report State
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const [showShareComposer, setShowShareComposer] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [followRequestsTab, setFollowRequestsTab] = useState<
    "followers" | "following"
  >("followers");
  const [popup, setPopup] = useState<{visible: boolean; type: 'success'|'warning'|'error'|'white'; title: string; message: string}>({visible: false, type: 'white', title: '', message: ''});
  const showPopup = (type: 'success'|'warning'|'error'|'white', title: string, message: string) => setPopup({visible: true, type, title, message});

  // Early-access badge for this profile
  const [badgeType, setBadgeType] = useState<EarlyAccessBadgeType>(null);

  const profileSharePayload = useMemo(() => {
    if (!id || typeof id !== "string") return null;
    return buildProfileExternalSharePayload({
      id,
      name: userProfile?.name || userProfile?.full_name || undefined,
      username: userProfile?.username || undefined,
    });
  }, [id, userProfile]);

  // Fixed header now overlays the cover (transparent at rest, so the cover
  // photo/gradient is visible from the status bar down) — fades to its
  // solid gradient as the user scrolls the cover out of view.
  const headerBgOpacity = useSharedValue(0);
  const headerBgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerBgOpacity.value,
  }));
  const mainScrollYRef = React.useRef(0);

  // Mini avatar in the header — stays hidden until the real avatar (in the
  // cover) is ~90% passed behind the header, then slides up + fades in over
  // MINI_AVATAR_REVEAL_DISTANCE of additional scroll. avatarContentYRef is
  // filled in by the avatar's onLayout measurement below (content-space Y,
  // scroll-offset independent), since its on-screen position shifts with
  // badge/dzongkhag layout and shouldn't be hardcoded.
  const AVATAR_SIZE = 86;
  const MINI_AVATAR_REVEAL_DISTANCE = 70;
  const avatarContentYRef = React.useRef<number | null>(null);
  const avatarRef = React.useRef<any>(null);
  const miniAvatarProgress = useSharedValue(0);
  const miniAvatarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: miniAvatarProgress.value,
    transform: [{ translateY: (1 - miniAvatarProgress.value) * 14 }],
  }));
  const computeMiniAvatarProgress = (y: number) => {
    const avatarContentY = avatarContentYRef.current;
    if (avatarContentY == null) return 0;
    const triggerY = avatarContentY + AVATAR_SIZE * 0.9 - HEADER_HEIGHT;
    return Math.max(0, Math.min(1, (y - triggerY) / MINI_AVATAR_REVEAL_DISTANCE));
  };

  // Magnetic tab bar — the SAME Posts/Marketplace row (no duplicate) gets a
  // translateY that exactly cancels out its own natural upward scroll once
  // its top edge would slide behind the fixed header, so it appears to lock
  // in place right there while the rest of the content keeps scrolling
  // underneath; below that threshold translateY is 0 and it scrolls
  // completely normally.
  //
  // This has to be computed on the UI thread (via useAnimatedScrollHandler
  // below), not from the plain JS-thread onScroll callback the rest of this
  // header uses — a JS-thread update lags a frame or more behind the
  // ScrollView's own native-driven position, and since this transform is
  // fighting to stay glued to a fast-moving native scroll (rather than just
  // easing an opacity/translate in over a fixed distance, like the header
  // fade/mini-avatar below), that lag is what read as "wobbling": the bar
  // visibly hunting to catch up to where the scroll actually is instead of
  // tracking it 1:1. tabBarContentY is a shared value (not a plain ref) so
  // the worklet can read it directly; it's filled in from the row's own
  // onLayout measurement, same content-space-Y approach as
  // avatarContentYRef above, just JS-thread-writable/UI-thread-readable.
  const tabBarRef = React.useRef<any>(null);
  const tabBarContentY = useSharedValue<number>(Number.POSITIVE_INFINITY);
  const tabBarTranslateY = useSharedValue(0);
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));
  // HEADER_HEIGHT is a rough constant (it doesn't account for status bar
  // height varying by device) — fine for the avatar-reveal threshold above,
  // which just needs to be roughly right, but the tab bar needs to stop
  // exactly flush with the header's real bottom edge or a sliver of it ends
  // up hidden underneath. headerActualHeight is measured from the header's
  // own onLayout, falling back to the constant until that first measurement
  // lands.
  const headerActualHeight = useSharedValue(HEADER_HEIGHT);

  const onProfileScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    mainScrollYRef.current = y;
    headerBgOpacity.value = Math.max(0, Math.min(1, y / HEADER_FADE_DISTANCE));
    miniAvatarProgress.value = computeMiniAvatarProgress(y);
  };

  // Drives tabBarTranslateY directly on the UI thread every scroll frame
  // (zero bridge latency), then hands the event off to the existing
  // JS-thread onProfileScroll for everything else it already does (header
  // fade, mini avatar) — unchanged.
  const mainScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const triggerY = tabBarContentY.value - headerActualHeight.value;
      tabBarTranslateY.value = Math.max(0, y - triggerY);
      runOnJS(onProfileScroll)({ nativeEvent: event });
    },
  });

  // Per-profile cover color identity — derived from the cover photo's
  // dominant hue when there is one (so the header/gradient/matte tint blend
  // with it), or a deterministic fallback hue keyed to this profile's id
  // otherwise. Same "dark matte navy" formula either way (see
  // lib/coverTheme.ts), just with a different hue, so it's unique per user
  // without ever looking garish. userProfile isn't loaded yet on first
  // render — the hook just falls back to its default hue until it is.
  const { header: HEADER_GRADIENT, cover: COVER_GRADIENT, tintRgb } =
    useCoverPalette(userProfile?.id, userProfile?.cover_image_url);

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

        // 1b. Track profile view (fire-and-forget, skips self-views)
        if (currentUser?.id && currentUser.id !== id) {
          trackProfileView(id, currentUser.id).catch(() => {});
        }

        // 1c. Fetch early-access badge (non-blocking, fails silently)
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
              thumbnailBlurHash: (post as any).blur_hashes?.[0] ?? null,
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
        // Main profile's Products tab — excludes anything tagged to this
        // user's Work profile (see Product.is_work_listing).
        const products = await fetchUserProducts(id, { isWorkListing: false });
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
              thumbnailBlurHash: (post as any).blur_hashes?.[0] ?? null,
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
        // Main profile's Products tab — excludes anything tagged to this
        // user's Work profile (see Product.is_work_listing).
        const products = await fetchUserProducts(id, { isWorkListing: false });
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

        setLoadingServiceProvider(false);
      } catch (error) {
        console.error("Error loading public profile:", error);
      } finally {
        setRefreshing(false);
      }
    };
    loadData();
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

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
    setShowMoreMenu(false);
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowMoreMenu(false);
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
        <CircularLoader size="large" color="#059669" />
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

  // Posts/Marketplace row — shared between the in-flow tab bar (rendered
  // inside the ScrollView, overlapping the cover's rounded corners) and its
  // pinned duplicate (an absolute overlay right below the fixed header,
  // shown once the in-flow one has scrolled up to meet it).
  const renderTabRow = () => (
    <View className="flex-row">
      <TouchableOpacity
        className="flex-1 pt-4 pb-3 items-center"
        onPress={() => setActiveTab("images")}
      >
        <Text
          className={`font-msemibold text-lg ${
            activeTab === "images" ? "text-primary" : "text-gray-500"
          }`}
        >
          Posts
        </Text>
        <View
          className={`w-6 h-[2px] rounded-full mt-1.5 ${
            activeTab === "images" ? "bg-primary" : "bg-transparent"
          }`}
        />
      </TouchableOpacity>

      <TouchableOpacity
        className="flex-1 pt-4 pb-3 items-center"
        onPress={() => setActiveTab("products")}
      >
        <Text
          className={`font-msemibold text-lg ${
            activeTab === "products" ? "text-primary" : "text-gray-500"
          }`}
        >
          Marketplace
        </Text>
        <View
          className={`w-6 h-[2px] rounded-full mt-1.5 ${
            activeTab === "products" ? "bg-primary" : "bg-transparent"
          }`}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-background" pointerEvents={isFocused ? "auto" : "none"}>
      <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />

      <Stack.Screen options={{ headerShown: false }} />

      {/* Light status-bar icons — the header/cover gradient behind them is
          dark, so the app's default dark-content bar would be unreadable
          here. Overrides the global one from app/_layout.tsx while focused. */}
      <StatusBar barStyle="light-content" />

      {/* Fixed Header — transparent at rest so the cover section beneath
          (image or COVER_GRADIENT) shows through all the way from the status
          bar; fades in HEADER_GRADIENT as the cover scrolls out of view so
          the icons stay legible over whatever's beneath. */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
        onLayout={(e) => {
          headerActualHeight.value = e.nativeEvent.layout.height;
        }}
      >
        <Animated.View
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            headerBgAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={HEADER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* Status-bar/Dynamic Island spacer — kept as its own sibling rather
            than padding-top on the header row below, since the mini avatar
            inside that row is absolutely positioned (top:0/bottom:0) to
            self-center vertically; padding on its own positioning ancestor
            doesn't push an absolute child down, so with this as row padding
            instead the mini avatar centered across the padding too and rode
            up into the notch/Dynamic Island. */}
        <View style={{ height: 64 }} />

        {/* Custom Header */}
        <View className="flex-row items-center justify-between px-4 pb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>

          {/* Mini avatar — stays hidden until the real avatar (in the cover)
              is ~90% covered by this header, then slides up + fades in over
              MINI_AVATAR_REVEAL_DISTANCE of further scroll (see
              computeMiniAvatarProgress). No name — avatar only. Absolutely
              centered so it sits dead-center regardless of the left/right
              icon groups' widths, rather than following flex space-between. */}
          <Animated.View
            style={[
              { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
              miniAvatarAnimatedStyle,
            ]}
            pointerEvents="none"
          >
            <View className="w-7 h-7 rounded-full bg-white/20 overflow-hidden items-center justify-center">
              {userProfile.avatar_url ? (
                <ProgressiveImage
                  uri={userProfile.avatar_url}
                  style={{ width: "100%", height: "100%" }}
                  showProgress={false}
                />
              ) : (
                <User size={14} color="#fff" />
              )}
            </View>
          </Animated.View>

          {/* Share + Block/Report now live together in the "More" menu below,
              behind a single trigger, instead of two separate header icons. */}
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowMoreMenu(true);
              }}
              className="w-10 h-10 items-center justify-center"
            >
              <MoreHorizontal size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content — no top padding now: the fixed header above overlays the
          cover section transparently, so this starts at the very top of the
          screen and the cover renders behind the header/status bar. */}
      <View className="flex-1">
        <Animated.ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          onScroll={mainScrollHandler}
          scrollEventThrottle={16}
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
              {/* Cover / background photo — extends down through the avatar,
                  name/id/location, badge, stats and bio, stopping right
                  above the Follow/Message buttons. Default linear gradient
                  when no cover photo is set. */}
              <View className="relative overflow-hidden">
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  {userProfile.cover_image_url ? (
                    <ProgressiveImage
                      uri={userProfile.cover_image_url}
                      style={{ width: "100%", height: "100%" }}
                      showProgress={false}
                      priority="high"
                    />
                  ) : (
                    <LinearGradient
                      colors={COVER_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  )}
                  {/* Legibility scrim — a neutral grey wash (not pure black)
                      over the whole cover, so a bright/colorful photo reads
                      as a muted backdrop instead of competing for attention
                      with the avatar, stats, bio and buttons on top of it. */}
                  <View
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(70,72,76,0.58)" }}
                  />
                </View>

                {/* Profile Info Section — Instagram style. Top padding
                    clears the fixed header row now that the cover renders
                    behind it. */}
                <View className="px-4" style={{ paddingTop: HEADER_HEIGHT + 28 }}>
                  {/* Row: Avatar + Name/Email/Location */}
                  <View className="flex-row items-center mb-3">
                    {/* Avatar — measured on layout so the header's mini
                        avatar knows exactly when this one is ~90% scrolled
                        behind the header (see avatarContentYRef). */}
                    <TouchableOpacity
                      ref={avatarRef}
                      onLayout={() => {
                        avatarRef.current?.measure((_x: number, _y: number, _w: number, _h: number, _pageX: number, pageY: number) => {
                          avatarContentYRef.current = pageY + mainScrollYRef.current;
                        });
                      }}
                      onPress={() => handleOpenProfileImage(userProfile.avatar_url)}
                      disabled={!userProfile.avatar_url}
                      activeOpacity={0.85}
                      className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border border-white"
                    >
                      {userProfile.avatar_url ? (
                        <ProgressiveImage
                          uri={userProfile.avatar_url}
                          style={{ width: "100%", height: "100%" }}
                          showProgress={false}
                          priority="high"
                        />
                      ) : (
                        <View className="w-full h-full items-center justify-center bg-gray-100">
                          <User size={34} color="#9ca3af" />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Name, Email & Location */}
                    <View className="flex-1 ml-4">
                      <View className="flex-row items-center gap-1.5 flex-wrap mb-0.5">
                        <Text className="text-lg font-mbold text-white">
                          {userProfile.name}
                        </Text>
                        {serviceProvider?.verification_status === "verified" && (
                          <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                            <Verified size={11} color="#094569" />
                            <Text className="text-[10px] font-msemibold text-[#094569] leading-none">Verified</Text>
                          </View>
                        )}
                      </View>
                      {userProfile.namzoed_id && (
                        <TouchableOpacity
                          onPress={() => setShowShareComposer(true)}
                          activeOpacity={0.7}
                          className={`flex-row items-center gap-1 ${userProfile.dzongkhag ? "mb-1" : ""}`}
                        >
                          <Text
                            style={{ flexShrink: 1 }}
                            className="text-base font-regular text-white/80"
                            numberOfLines={1}
                          >
                            NamZoed ID: {userProfile.namzoed_id}
                          </Text>
                          <QrCode size={16} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                      )}
                      {userProfile.dzongkhag && (
                        <View className="flex-row items-center gap-1">
                          <MapPin size={15} color="rgba(255,255,255,0.8)" />
                          <Text className="text-base font-regular text-white/80">
                            {userProfile.dzongkhag}
                          </Text>
                        </View>
                      )}

                      {/* Badge — moved below the location line instead of
                          sitting beside the whole row. */}
                      {badgeType && (
                        <View className="mt-1.5 self-start">
                          <EarlyAccessBadge badgeType={badgeType} size="sm" />
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Matte panel — frosted blur (iOS) + a navy-tinted gradient
                    (matches COVER_GRADIENT's own hue rather than plain black)
                    sit behind just the stats/bio block. The panel itself
                    starts right at the Posts/Followers/Following row, but the
                    tint starts fully transparent at that same top edge and
                    only builds up going down — so it blends seamlessly into
                    the plain cover photo above instead of showing a hard
                    line where the panel begins. Deliberately not applied
                    above this line — the avatar/name area stays a clear view
                    of the cover photo — and not below it either: the buttons
                    get their own flat (non-gradient) backing instead, right
                    below. */}
                <View className="relative overflow-hidden" style={{ marginTop: 12 }}>
                  {Platform.OS === "ios" && (
                    <MaskedView
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                      maskElement={
                        <LinearGradient
                          colors={MATTE_BLUR_FADE_STOPS.colors}
                          locations={MATTE_BLUR_FADE_STOPS.locations}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={{ flex: 1 }}
                        />
                      }
                    >
                      <BlurView intensity={30} tint="dark" style={{ flex: 1 }} />
                    </MaskedView>
                  )}
                  <LinearGradient
                    colors={[
                      `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0)`,
                      `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.55)`,
                      `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.95)`,
                    ]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <View className="px-4 pt-3 pb-3">
                  {/* Stats row — below the avatar/name row */}
                  <View className="flex-row items-center justify-around mb-3">
                    <View className="items-center">
                      <Text className="text-lg font-mbold text-white">
                        {userPosts.length}
                      </Text>
                      <Text className="text-xs font-regular text-white/70">
                        Posts
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        if (!id || typeof id !== "string") return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setFollowRequestsTab("followers");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-lg font-mbold text-white">
                        {userProfile.follower_count || 0}
                      </Text>
                      <Text className="text-xs font-regular text-white/70">
                        Followers
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        if (!id || typeof id !== "string") return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setFollowRequestsTab("following");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-lg font-mbold text-white">
                        {userProfile.following_count || 0}
                      </Text>
                      <Text className="text-xs font-regular text-white/70">
                        Following
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {userProfile.bio && (
                    <Text className="text-sm font-regular text-white/90 mb-1">
                      {userProfile.bio}
                    </Text>
                  )}
                  </View>
                </View>

                {/* Action Buttons + Work profile summary — one shared flat
                    matte backing (same solid color the gradient panel above
                    ends on, no gradient/blur of its own), so everything here
                    reads as one grouped section instead of separate blocks. */}
                <View
                  className="px-4 pt-3"
                  style={{
                    backgroundColor: `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.95)`,
                    // Extra bottom padding so the buttons keep clear space
                    // below them even though the tab bar overlaps this
                    // section by 20px (its own corner radius) to blend with
                    // it — without this, that overlap would land right on
                    // the buttons instead of the padding beneath them.
                    paddingBottom: 32,
                  }}
                >
                  {/* Work profile summary — shown first, above Follow/
                      Message, to give it top billing when it exists. Only
                      shown once this user has actually set a business name
                      (every profile auto-gets an empty service_providers
                      row, so a null/empty name means "no work profile" in
                      practice). Read-only: no edit affordances, just their
                      business card + services/products, on the pushed
                      /profile/work screen. */}
                  {serviceProvider?.name?.trim() && typeof id === "string" && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: "/(users)/profile/work",
                          params: { userId: id },
                        } as any)
                      }
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      className="mb-2 py-3 px-3 flex-row items-center bg-white/15 border border-white/30"
                    >
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center gap-1.5 mb-0.5">
                          <Text
                            className="text-sm font-semibold text-white flex-shrink"
                            numberOfLines={1}
                          >
                            {serviceProvider.name}
                          </Text>
                          {serviceProvider.verification_status === "verified" && (
                            <Verified size={13} color="#7FD1FF" />
                          )}
                        </View>
                        {serviceProvider.master_bio ? (
                          <Text
                            className="text-xs font-regular text-white/70"
                            numberOfLines={1}
                          >
                            {serviceProvider.master_bio}
                          </Text>
                        ) : (
                          <Text className="text-xs font-regular text-white/50 italic">
                            Work profile
                          </Text>
                        )}
                      </View>
                      <View className="w-10 h-10 rounded-full bg-white/15 overflow-hidden items-center justify-center">
                        {serviceProvider.profile_url ? (
                          <ProgressiveImage
                            uri={serviceProvider.profile_url}
                            style={{ width: "100%", height: "100%" }}
                            showProgress={false}
                          />
                        ) : (
                          <Wrench size={18} strokeWidth={1.5} color="rgba(255,255,255,0.8)" />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  <View className="flex-row gap-2">
                    {/* Follow / Following button */}
                    <TouchableOpacity
                      onPress={handleMainAction}
                      disabled={loadingFollow}
                      className={`flex-1 py-[9px] rounded-lg flex-row items-center justify-center ${
                        isFollowingUser
                          ? "bg-white/15 border border-white/30"
                          : "bg-primary"
                      }`}
                    >
                      {loadingFollow ? (
                        <CircularLoader size="small" color="white" />
                      ) : (
                        <Text className="text-sm font-semibold text-white">
                          {isFollowingUser ? "Following" : "Follow"}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Message button — visible only when following */}
                    {isFollowingUser && (
                      <TouchableOpacity
                        style={{ borderRadius: 8, borderCurve: "continuous" }}
                        onPress={() => {
                          if (typeof id !== "string") return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          router.push(`/(users)/chat/${id}` as any);
                        }}
                        className="flex-1 py-[9px] flex-row items-center justify-center gap-1.5 bg-white/15 border border-white/30"
                      >

                        <Text className="text-sm font-semibold text-white">
                          Message
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Tab Navigation — rounded top corners so it reads as a sheet
                  rising out of the dark cover above. Pulled up to overlap
                  the cover by the same amount as the corner radius, with an
                  internal dark strip (not a reveal-through-clip trick) so
                  the corners read consistently dark whether this sits in
                  its normal in-flow spot or is magnet-pinned to the header
                  (see tabBarAnimatedStyle below). Text-only (no icons); just
                  the two tabs — Services moved out entirely, since it now
                  only ever appears via the Work profile summary card above
                  when this user has actually added one.

                  The outer View here is only for layout/measurement (ref +
                  onLayout feed the tabBarContentY shared value, and
                  marginTop keeps the same overlap density as before); the
                  actual magnetic translateY lives on the inner
                  Animated.View so transform never disturbs the measured
                  layout position or pushes Tab Content around. */}
              <View
                ref={tabBarRef}
                onLayout={() => {
                  tabBarRef.current?.measure((_x: number, _y: number, _w: number, _h: number, _pageX: number, pageY: number) => {
                    tabBarContentY.value = pageY + mainScrollYRef.current;
                  });
                }}
                style={{ marginTop: -20 }}
              >
                <Animated.View style={[{ zIndex: 10 }, tabBarAnimatedStyle]}>
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 20,
                      backgroundColor: `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.95)`,
                    }}
                  />
                  <View
                    style={{
                      borderTopLeftRadius: 20,
                      borderTopRightRadius: 20,
                      borderCurve: "continuous",
                      overflow: "hidden",
                    }}
                    className="bg-white border-b border-gray-100"
                  >
                    {renderTabRow()}
                  </View>
                </Animated.View>
              </View>

              {/* Tab Content */}
              <View className="min-h-[300px]">
                {activeTab === "images" && (
                  <View
                    ref={postGridReveal.containerRef}
                    collapsable={false}
                    className="flex-row flex-wrap"
                  >
                    {postThumbnails.length > 0 ? (
                      postThumbnails.map((thumb, index) => {
                        const cellHeight = profileGridCellHeight(SCREEN_WIDTH);
                        const top = Math.floor(index / 3) * cellHeight;
                        return (
                          <ProfilePostGridItem
                            key={thumb.postId}
                            thumbnailUrl={thumb.thumbnailUrl}
                            thumbnailBlurHash={thumb.thumbnailBlurHash}
                            isVideo={thumb.isVideo}
                            mediaCount={thumb.mediaCount}
                            deferred={!postGridReveal.isNear(thumb.postId, top, cellHeight)}
                            priority={postGridReveal.isAboveFold(top) ? "high" : "normal"}
                            onPress={() =>
                              router.push(
                                `/(users)/post/${thumb.postId}` as any,
                              )
                            }
                          />
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
                            style={{ borderRadius: 12, borderCurve: "continuous" }}
                            onPress={() =>
                              router.push(
                                `/(users)/product/${product.id}` as any,
                              )
                            }
                            className="bg-transparent overflow-hidden border border-gray-100"
                          >
                            {product.images && product.images.length > 0 ? (
                              <ProgressiveImage
                                uri={product.images[0]}
                                style={{ width: "100%", height: 160 }}
                                showProgress={false}
                                recyclingKey={product.id}
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

              </View>

              {/* Bottom spacer */}
              <View className="h-8" />
        </Animated.ScrollView>
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
              borderCurve: "continuous",
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

      {/* More Menu Modal — replaces the header's separate Share + Report
          icons with one "..." trigger; Share sits first, Report last (right
          above Cancel), Block in between. */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={() => setShowMoreMenu(false)}
        >
          <Pressable onPress={() => {}}>
            <Animated.View
              style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }}
              entering={SlideInDown.springify()}
              className="bg-white pb-8"
            >
              <View className="px-6 py-4 border-b border-gray-200">
                <Text className="text-lg font-mbold text-gray-900">
                  User Actions
                </Text>
              </View>

              {/* Share Option */}
              <TouchableOpacity
                onPress={() => {
                  setShowMoreMenu(false);
                  setShowShareComposer(true);
                }}
                className="flex-row items-center px-6 py-4 border-b border-gray-100"
              >
                <ShareArcIcon size={24} color="#111" />
                <View className="ml-4 flex-1">
                  <Text className="text-base font-msemibold text-gray-900">
                    Share Profile
                  </Text>
                  <Text className="text-sm text-gray-500 font-regular">
                    Send this profile to someone else
                  </Text>
                </View>
              </TouchableOpacity>

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
                style={{ borderRadius: 16, borderCurve: "continuous" }}
                onPress={() => setShowMoreMenu(false)}
                className="mx-6 mt-4 py-3 bg-gray-100"
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

      <ProfileImageViewer
        visible={showProfileImageViewer}
        imageUri={viewerImageUri}
        onClose={() => {
          setShowProfileImageViewer(false);
          setViewerImageUri(null);
        }}
      />

      {profileSharePayload && (
        <ShareComposerModal
          visible={showShareComposer}
          onClose={() => setShowShareComposer(false)}
          heading="Share profile"
          sharePayload={profileSharePayload}
          inAppContextParams={{
            context_product_id: typeof id === "string" ? id : "",
            context_product_title:
              userProfile?.name || userProfile?.full_name || userProfile?.username || "Profile",
            context_product_price: "",
            context_product_image:
              userProfile?.avatar_url ||
              userProfile?.profile_url ||
              userProfile?.image ||
              "",
            context_source: "profile",
            context_caption: userProfile?.bio || "",
            context_username: userProfile?.username || "",
            context_verified:
              serviceProvider?.verification_status === "verified" ? "true" : "",
          }}
        />
      )}
    </View>
  );
}
