import MaskedView from "@react-native-masked-view/masked-view";
import FollowRequests from "@/components/modals/FollowRequests";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import HamburgerMenu from "@/components/modals/HamburgerMenu";
import ImageCropOverlay from "@/components/modals/ImageCropOverlay";
import ManageListingsOverlay from "@/components/modals/ManageListingsOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import { useUser } from "@/contexts/UserContext";
import { useIsFocused } from "@react-navigation/native";
import CreatePost from "@/components/modals/CreatePost";
// Custom hooks
import { useProfileData } from "@/hooks/profile/useProfileData";
import { useServiceProvider } from "@/hooks/profile/useServiceProvider";
import { useUserPosts } from "@/hooks/profile/useUserPosts";
import { useUserProducts } from "@/hooks/profile/useUserProducts";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import { useEarlyAccessBadge } from "@/hooks/useEarlyAccessBadge";
// Profile components
import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import ShareArcIcon from "@/components/icons/ShareArcIcon";
import ProfilePostGridItem, { profileGridCellHeight } from "@/components/profile/ProfilePostGridItem";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import BottomNavBar from "@/components/ui/BottomNavBar";
import CircularLoader from "@/components/ui/CircularLoader";
import { useBottomBarScroll } from "@/hooks/useBottomBarScroll";
import { useGridReveal } from "@/hooks/useGridReveal";
import PopupMessage from "@/components/ui/PopupMessage";
import {
    deleteAvatar,
    deleteCoverImage,
    updateUserProfile,
    uploadAvatar,
    uploadCoverImage,
} from "@/lib/profileService";
import { getUserBookmarks } from "@/lib/bookmarkService";
import { getUserCommentedPosts } from "@/lib/commentsService";
import { getUserLikedPosts } from "@/lib/likesService";
import { Post } from "@/lib/postsService";
import { getProfileViewCount7d } from "@/lib/viewTrackingService";
import {
    buildProfileExternalSharePayload,
} from "@/lib/shareUtils";
import { useAppRouter } from "@/utils/navigation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
    Bookmark,
    Camera,
    Edit3,
    Eye,
    Grid,
    Heart,
    ImageIcon,
    MessageCircle,
    Menu,
    QrCode,
    ScanLine,
    ShoppingBag,
    Store,
    Trash2,
    User,
    Verified,
    Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    InteractionManager,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// HEADER_GRADIENT/COVER_GRADIENT used to be a fixed navy-blue pair here —
// now they're computed per-user by useCoverPalette (see below), so the
// header/cover/matte tint all share one hue drawn from the user's own cover
// photo (or a deterministic fallback when they have none). HEADER_GRADIENT's
// bottom stop is the same "dark" tone as the matte panel/tintRgb, so once the
// header is fully scrolled-in its solid color matches the bottom of the
// cover section (and the pinned tab bar sits on a seamless boundary).

// Height of the fixed icon/tab row overlaid on top of the cover (status bar
// spacer + header row) — the cover now renders behind this whole strip, so
// content that used to sit below it needs this much top offset instead.
const HEADER_HEIGHT = 84;
// How far (in scroll px) the header background fades from transparent
// (cover photo showing through) to the solid gradient, so icons stay
// legible once the cover has scrolled out of view.
const HEADER_FADE_DISTANCE = 150;

// Rendered by renderTabRow below — a single shared list so the tab row's
// magnet-pinned state never needs a duplicate copy to stay in sync.
const PROFILE_TABS = [
  { key: "images", label: "Posts" },
  { key: "products", label: "Marketplace" },
  { key: "likes", label: "Likes" },
  { key: "saves", label: "Saves" },
  { key: "comments", label: "Comments" },
] as const;

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

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"].some((ext) => lower.includes(ext)) ||
    lower.includes("post-videos")
  );
}

/** Same PostThumbnail shape hooks/profile/useUserPosts.ts builds for the
 *  Posts tab — reused here so the Likes/Comments tabs render with the exact
 *  same ProfilePostGridItem grid. */
function toThumbnails(posts: Post[]) {
  return posts
    .filter((post) => post.images && post.images.length > 0)
    .map((post) => ({
      postId: post.id,
      thumbnailUrl: post.images[0],
      thumbnailBlurHash: (post as any).blur_hashes?.[0] ?? null,
      mediaCount: post.images.length,
      isVideo: isVideoUrl(post.images[0]),
      post,
    }));
}

// --- Reanimated & Gesture Handler ---
import Animated, {
    SlideInDown,
    SlideOutDown,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

export default function ProfileScreen() {
  const { currentUser, setCurrentUser } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  // A screen pushed on top of this one (e.g. /post/[id], presented as a
  // transparentModal so this stays mounted/visible underneath while its own
  // ContextDrop edge-swipe-back is in progress) shouldn't leave this still
  // competing for the same touches — this screen's own full-bleed
  // horizontal Main/Work tab ScrollView spans the same left-edge strip
  // ContextDrop captures from, and was winning that race often enough to
  // make the edge-swipe unreliable whenever a post was opened from here.
  // Turning this off entirely while unfocused removes it from the picture.
  const isFocused = useIsFocused();
  const { scale: bottomBarScale, onScroll: onBottomBarScroll } = useBottomBarScroll();

  const { openManageListings, openFollowRequests } = useLocalSearchParams<{
    openManageListings?: string;
    openFollowRequests?: string;
  }>();

  // Fixed header now overlays the cover (transparent at rest, so the cover
  // photo/gradient is visible from the status bar down) — fades to its
  // solid gradient as the user scrolls the cover out of view.
  const headerBgOpacity = useSharedValue(0);
  const headerBgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerBgOpacity.value,
  }));

  // Mini avatar in the header — stays hidden until the real avatar (in the
  // cover) is ~90% passed behind the header, then slides up + fades in over
  // MINI_AVATAR_REVEAL_DISTANCE of additional scroll. avatarContentYRef is
  // filled in by the avatar's onLayout measurement below (content-space Y,
  // scroll-offset independent), since its on-screen position shifts with
  // badge/dzongkhag layout and shouldn't be hardcoded.
  const AVATAR_SIZE = 86;
  const MINI_AVATAR_REVEAL_DISTANCE = 70;
  const avatarContentYRef = React.useRef<number | null>(null);
  const avatarRef = React.useRef<View>(null);
  const mainScrollYRef = React.useRef(0);
  const miniAvatarProgress = useSharedValue(0);
  const miniAvatarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: miniAvatarProgress.value,
    transform: [{ translateY: (1 - miniAvatarProgress.value) * 14 }],
  }));
  // Inverse of the mini avatar's own fade — Edit Profile crossfades out of
  // the header exactly as the mini avatar fades in, instead of sitting
  // alongside it once you've scrolled past the cover.
  const editProfilePillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - miniAvatarProgress.value,
  }));
  const computeMiniAvatarProgress = (y: number) => {
    const avatarContentY = avatarContentYRef.current;
    if (avatarContentY == null) return 0;
    const triggerY = avatarContentY + AVATAR_SIZE * 0.9 - HEADER_HEIGHT;
    return Math.max(0, Math.min(1, (y - triggerY) / MINI_AVATAR_REVEAL_DISTANCE));
  };

  // Magnetic tab bar — the SAME Posts/Marketplace/etc. row (no duplicate)
  // gets a translateY that exactly cancels out its own natural upward
  // scroll once its top edge would slide behind the fixed header, so it
  // appears to lock in place right there while the rest of the content
  // keeps scrolling underneath; below that threshold translateY is 0 and it
  // scrolls completely normally.
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
  const tabBarRef = React.useRef<View>(null);
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
    onBottomBarScroll(event);
  };

  // Drives tabBarTranslateY directly on the UI thread every scroll frame
  // (zero bridge latency), then hands the event off to the existing
  // JS-thread onProfileScroll for everything else it already does
  // (header fade, mini avatar, bottom bar hide/show) — unchanged.
  const mainScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const triggerY = tabBarContentY.value - headerActualHeight.value;
      tabBarTranslateY.value = Math.max(0, y - triggerY);
      runOnJS(onProfileScroll)({ nativeEvent: event });
    },
  });
  const [activeTab, setActiveTab] = useState<
    "images" | "products" | "likes" | "saves" | "comments"
  >("images");

  // Likes/Saves/Comments — only ever shown on your own profile, so these
  // load lazily the first time each tab is opened rather than eagerly like
  // Posts/Marketplace, to avoid three extra queries most visits never need.
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loadingLikedPosts, setLoadingLikedPosts] = useState(false);
  const [likedPostsLoaded, setLikedPostsLoaded] = useState(false);

  const [commentedPosts, setCommentedPosts] = useState<Post[]>([]);
  const [loadingCommentedPosts, setLoadingCommentedPosts] = useState(false);
  const [commentedPostsLoaded, setCommentedPostsLoaded] = useState(false);

  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loadingSavedItems, setLoadingSavedItems] = useState(false);
  const [savedItemsLoaded, setSavedItemsLoaded] = useState(false);

  // UI State
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pendingImageOption, setPendingImageOption] = useState<
    "camera" | "gallery" | null
  >(null);
  const [showMainAvatarMenu, setShowMainAvatarMenu] = useState(false);
  const [pendingCoverOption, setPendingCoverOption] = useState<
    "camera" | "gallery" | null
  >(null);
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [followRequestsTab, setFollowRequestsTab] = useState<
    "following" | "followers"
  >("following");
  const [showManageListings, setShowManageListings] = useState(false);
  // Hamburger drawer — same component/trigger as the Home tab's TopNavbar,
  // now replacing the header's separate Follow Requests / Manage Listings
  // icons (Manage Listings already lives inside this menu).
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageDims, setSelectedImageDims] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Profile image viewer state
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);

  const [showShareComposer, setShowShareComposer] = useState(false);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

  // Popup helpers
  const showErrorPopup = (message: string, title: string = "Error") => {
    setPopupMessage(message);
    setPopupTitle(title);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (message: string, title: string = "Success") => {
    setPopupMessage(message);
    setPopupTitle(title);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const profileSharePayload = useMemo(() => {
    if (!currentUser?.id) return null;
    return buildProfileExternalSharePayload({
      id: String(currentUser.id),
      name: currentUser.name || currentUser.full_name || undefined,
      username: currentUser.username || undefined,
    });
  }, [currentUser]);

  const handleShareProfile = () => {
    if (!profileSharePayload) {
      showErrorPopup("Profile link unavailable right now.");
      return;
    }
    setShowShareComposer(true);
  };

  // ------------------------------------------------------
  // CUSTOM HOOKS
  // ------------------------------------------------------

  // Profile data hook
  const {
    profileImage,
    setProfileImage,
    coverImage,
    setCoverImage,
    bio,
    namzoedId,
    followerCount,
    setFollowerCount,
    followingCount,
    setFollowingCount,
  } = useProfileData(refreshKey);

  // Per-user cover color identity — derived from the cover photo's dominant
  // hue when there is one (so the header/gradient/matte tint blend with it),
  // or a deterministic fallback hue keyed to the user's id otherwise. Same
  // "dark matte navy" formula either way (see lib/coverTheme.ts), just with
  // a different hue, so it's unique per user without ever looking garish.
  const { header: HEADER_GRADIENT, cover: COVER_GRADIENT, tintRgb } =
    useCoverPalette(currentUser?.id, coverImage);

  // 7-day rolling profile view count
  const [profileViews7d, setProfileViews7d] = useState<number>(0);
  useEffect(() => {
    if (!currentUser?.id) return;
    getProfileViewCount7d(currentUser.id).then(setProfileViews7d).catch(() => {});
  }, [currentUser?.id]);

  // Early-access badge for the logged-in user
  const badgeType = useEarlyAccessBadge(currentUser?.id);

  // Service provider hook — trimmed to just what the Main page needs: the
  // summary card below Edit Profile/Manage (full management, including the
  // services list, lives on the pushed /profile/work screen now — there's
  // no separate Services sub-tab here anymore).
  const { serviceProvider, providerImageUri, verificationStatus } =
    useServiceProvider(refreshKey);

  // User posts hook
  const {
    userPosts,
    setUserPosts,
    loadingPosts,
    postThumbnails,
  } = useUserPosts(refreshKey, showErrorPopup);
  const postGridReveal = useGridReveal();
  useEffect(() => {
    postGridReveal.rearm();
  }, [postThumbnails.length, postGridReveal.rearm]);

  // User products hook
  const { userProducts, setUserProducts, loadingProducts } = useUserProducts(
    refreshKey,
    showErrorPopup,
  );

  // Pull-to-refresh should refresh these too, not just Posts/Marketplace —
  // resetting the "loaded" flags lets the lazy-load effects below refetch.
  useEffect(() => {
    setLikedPostsLoaded(false);
    setCommentedPostsLoaded(false);
    setSavedItemsLoaded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Lazy-load Likes/Saves/Comments the first time each tab is opened.
  useEffect(() => {
    if (activeTab !== "likes" || likedPostsLoaded || !currentUser?.id) return;
    setLoadingLikedPosts(true);
    getUserLikedPosts(currentUser.id)
      .then((posts) => {
        setLikedPosts(posts);
        setLikedPostsLoaded(true);
      })
      .finally(() => setLoadingLikedPosts(false));
  }, [activeTab, likedPostsLoaded, currentUser?.id]);

  useEffect(() => {
    if (activeTab !== "comments" || commentedPostsLoaded || !currentUser?.id) return;
    setLoadingCommentedPosts(true);
    getUserCommentedPosts(currentUser.id)
      .then((posts) => {
        setCommentedPosts(posts);
        setCommentedPostsLoaded(true);
      })
      .finally(() => setLoadingCommentedPosts(false));
  }, [activeTab, commentedPostsLoaded, currentUser?.id]);

  useEffect(() => {
    if (activeTab !== "saves" || savedItemsLoaded || !currentUser?.id) return;
    setLoadingSavedItems(true);
    getUserBookmarks(currentUser.id)
      .then((items) => {
        setSavedItems(items as any[]);
        setSavedItemsLoaded(true);
      })
      .finally(() => setLoadingSavedItems(false));
  }, [activeTab, savedItemsLoaded, currentUser?.id]);

  // (Animation logic for avatar/picker modals removed — using native Modal animations now)

  // Deep-link param from the hamburger drawer (components/modals/HamburgerMenu.tsx)
  // — jump straight to Manage Listings on arrival. Settings itself now lives
  // at its own route (app/(users)/settings/index.tsx).
  useEffect(() => {
    if (openManageListings === "1") {
      setShowManageListings(true);
    }
  }, [openManageListings]);

  // Deep-link param from the hamburger drawer's "+ Add Friends" item —
  // stands in for a real add-friends flow for now by surfacing the pending
  // follow requests list (the same one the header's old UserPlus icon used
  // to open) until that flow exists.
  useEffect(() => {
    if (openFollowRequests === "1") {
      setShowPendingRequests(true);
    }
  }, [openFollowRequests]);

  // Close all overlays when navigating away from screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup function runs when screen loses focus
        setShowFollowRequests(false);
        setShowPendingRequests(false);
        setShowImagePicker(false);
        setPendingImageOption(null);
        setShowMainAvatarMenu(false);
        setShowManageListings(false);
        setShowCropOverlay(false);
        setShowProfileImageViewer(false);
      };
    }, []),
  );

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleEditProfile = () => {
    if (Platform.OS === "ios") {
      Alert.alert("Change Profile Picture", undefined, [
        {
          text: "Take Photo",
          onPress: () => handleImageOption("camera"),
        },
        {
          text: "Choose from Gallery",
          onPress: () => handleImageOption("gallery"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
      return;
    }
    setShowMainAvatarMenu(true);
  };
  const handleManageListings = () => setShowManageListings(true);

  // UPDATED: Save Logic
  const handleCropSave = async (croppedUri: string) => {
    if (!currentUser?.id) return;

    // 1. Optimistic Update (Immediate UI feedback)
    setProfileImage(croppedUri);
    setShowCropOverlay(false);
    setSelectedImageUri(null);
    setSelectedImageDims(null);

    try {
      // 2. Upload to Supabase Storage
      // Note: Ensure your 'profile' bucket exists and has RLS policies for uploads
      const publicUrl = await uploadAvatar(croppedUri, currentUser.id);

      // 3. Update User Profile in Database
      await updateUserProfile(currentUser.id, { avatar_url: publicUrl });

      // 4. Update UserContext and AsyncStorage to sync across app
      const updatedUser = { ...currentUser, avatar_url: publicUrl };
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      showSuccessPopup(
        "Profile has been changed successfully",
        "Profile Saved!",
      );
    } catch (error) {
      console.error("Failed to save profile image:", error);
      showErrorPopup(
        "Failed to save profile image. Please try again.",
        "Save Failed",
      );
      // Optional: Revert profileImage state here if needed
    }
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setSelectedImageUri(null);
    setSelectedImageDims(null);
  };

  const ensureCameraPermission = async (
    message = "Camera access is needed.",
  ) => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      showErrorPopup(message, "Permission Denied");
      return false;
    }
    return true;
  };

  const waitForIosModalDismiss = async () => {
    if (Platform.OS !== "ios") return;
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
  };

  const openImageOption = async (option: "camera" | "gallery") => {
    try {
      const useNativeEditor = Platform.OS === "ios";
      // Defensive cleanup to avoid any stale overlays intercepting touches.
      setShowMainAvatarMenu(false);
      setShowImagePicker(false);
      setShowError(false);
      setShowSuccess(false);
      let result;
      if (option === "camera") {
        const cameraGranted = await ensureCameraPermission(
          "Camera access is needed.",
        );
        if (!cameraGranted) return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: useNativeEditor,
          aspect: [1, 1],
          quality: 1.0,
        });
      } else {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.", "Permission Denied");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: useNativeEditor,
          aspect: [1, 1],
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (useNativeEditor) {
          // iOS: use native editor result directly to avoid custom crop overlay
          // modal interactions that can leave touches blocked after camera return.
          await handleCropSave(asset.uri);
        } else {
          setSelectedImageUri(asset.uri);
          // Pass actual picker dimensions to avoid EXIF orientation issues with Image.getSize
          if (asset.width && asset.height) {
            setSelectedImageDims({ width: asset.width, height: asset.height });
          } else {
            setSelectedImageDims(null);
          }
          setShowCropOverlay(true);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showErrorPopup("Failed to select image.", "Selection Failed");
    }
  };

  const handleImageOption = (option: "camera" | "gallery") => {
    setPendingImageOption(option);
    setShowMainAvatarMenu(false);
    setShowImagePicker(false);
  };

  // Cover/background image upload — always uses the native picker's own
  // crop editor (banner aspect) on both platforms, so there's no need for
  // ImageCropOverlay's Android-only flow here.
  const handleCoverSave = async (uri: string) => {
    if (!currentUser?.id) return;

    const previousCover = coverImage;
    setCoverImage(uri);

    try {
      const publicUrl = await uploadCoverImage(uri, currentUser.id);
      await updateUserProfile(currentUser.id, { cover_image_url: publicUrl });
      setCoverImage(publicUrl);

      const updatedUser = { ...currentUser, cover_image_url: publicUrl };
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      if (previousCover) {
        deleteCoverImage(previousCover).catch((error) =>
          console.error("Failed to delete previous cover image:", error),
        );
      }

      showSuccessPopup("Cover photo has been updated.", "Cover Updated!");
    } catch (error) {
      console.error("Failed to save cover image:", error);
      setCoverImage(previousCover);
      showErrorPopup("Failed to save cover photo. Please try again.", "Save Failed");
    }
  };

  const openCoverImageOption = async (option: "camera" | "gallery") => {
    try {
      setShowCoverMenu(false);
      let result;
      if (option === "camera") {
        const cameraGranted = await ensureCameraPermission("Camera access is needed.");
        if (!cameraGranted) return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [3, 1],
          quality: 1.0,
        });
      } else {
        const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.", "Permission Denied");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [3, 1],
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets[0]) {
        await handleCoverSave(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking cover image:", error);
      showErrorPopup("Failed to select image.", "Selection Failed");
    }
  };

  const handleCoverImageOption = (option: "camera" | "gallery") => {
    setPendingCoverOption(option);
    setShowCoverMenu(false);
  };

  const handleRemoveCoverImage = () => {
    setShowCoverMenu(false);
    Alert.alert(
      "Remove Cover Photo",
      "Are you sure you want to remove your cover photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!currentUser?.id) return;

            try {
              if (coverImage) {
                try {
                  await deleteCoverImage(coverImage);
                } catch (error) {
                  console.error("Failed to delete cover image from storage:", error);
                }
              }

              await updateUserProfile(currentUser.id, { cover_image_url: null });
              setCoverImage(null);

              const updatedUser = { ...currentUser, cover_image_url: null };
              await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
              setCurrentUser(updatedUser);

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup("Cover photo removed successfully", "Removed!");
            } catch (error) {
              console.error("Failed to remove cover photo:", error);
              showErrorPopup("Failed to remove cover photo. Please try again.", "Removal Failed");
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (showImagePicker || showMainAvatarMenu || !pendingImageOption) return;

    let cancelled = false;
    (async () => {
      await waitForIosModalDismiss();
      if (cancelled) return;
      const option = pendingImageOption;
      setPendingImageOption(null);
      await openImageOption(option);
    })();

    return () => {
      cancelled = true;
    };
  }, [showImagePicker, showMainAvatarMenu, pendingImageOption]);

  useEffect(() => {
    if (showCoverMenu || !pendingCoverOption) return;

    let cancelled = false;
    (async () => {
      await waitForIosModalDismiss();
      if (cancelled) return;
      const option = pendingCoverOption;
      setPendingCoverOption(null);
      await openCoverImageOption(option);
    })();

    return () => {
      cancelled = true;
    };
  }, [showCoverMenu, pendingCoverOption]);

  // Handle remove main profile avatar
  const handleRemoveMainAvatar = () => {
    setShowMainAvatarMenu(false);
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!currentUser?.id) return;

            try {
              // Delete from storage if exists
              if (profileImage) {
                try {
                  await deleteAvatar(profileImage);
                } catch (error) {
                  console.error("Failed to delete avatar from storage:", error);
                }
              }

              // Update database
              await updateUserProfile(currentUser.id, { avatar_url: null });

              // Update local state
              setProfileImage(null);

              // Update UserContext and AsyncStorage
              const updatedUser = { ...currentUser, avatar_url: null };
              await AsyncStorage.setItem(
                "currentUser",
                JSON.stringify(updatedUser),
              );
              setCurrentUser(updatedUser);

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup(
                "Profile picture removed successfully",
                "Removed!",
              );
            } catch (error) {
              console.error("Failed to remove profile picture:", error);
              showErrorPopup(
                "Failed to remove profile picture. Please try again.",
                "Removal Failed",
              );
            }
          },
        },
      ],
    );
  };

  if (!currentUser) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-4">
        <User size={72} className="text-gray-700 mb-4" />
        <Text className="text-xl font-mbold text-gray-700 mb-2">
          Not Logged In
        </Text>
        <TouchableOpacity
          style={{ borderRadius: 12, borderCurve: "continuous" }}
          onPress={() => router.replace("/login")}
          className="bg-primary py-3 px-6"
        >
          <Text className="text-white font-msemibold">Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Posts/Marketplace/Likes/Saves/Comments row — shared between the in-flow
  // tab bar (rendered inside the ScrollView, overlapping the cover's rounded
  // corners) and its pinned duplicate (an absolute overlay right below the
  // fixed header, shown once the in-flow one has scrolled up to meet it), so
  // the two never drift out of sync.
  const renderTabRow = () => (
    <View style={{ position: "relative" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {PROFILE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className="px-5 pt-4 pb-3 items-center"
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              className={`font-msemibold text-lg ${
                activeTab === tab.key ? "text-primary" : "text-gray-500"
              }`}
            >
              {tab.label}
            </Text>
            <View
              className={`w-6 h-[2px] rounded-full mt-1.5 ${
                activeTab === tab.key ? "bg-primary" : "bg-transparent"
              }`}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <LinearGradient
        colors={["#ffffff", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 20 }}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0)", "#ffffff"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 20 }}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background" pointerEvents={isFocused ? "auto" : "none"}>
      {/* Light status-bar icons — the header/cover gradient behind them is
          dark, so the app's default dark-content bar would be unreadable
          here. Overrides the global one from app/_layout.tsx while focused. */}
      <StatusBar barStyle="light-content" />

      {/* Fixed Header - Absolute Position — transparent at rest so the cover
          section beneath (image or COVER_GRADIENT) shows through all the way
          from the status bar; fades in HEADER_GRADIENT as the cover scrolls
          out of view so the icons stay legible over whatever's beneath. */}
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

        <View className="h-12" />

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
          {/* Left Icons — hamburger drawer, same as Home's TopNavbar */}
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setShowDrawer(true)}
              className="w-10 h-10 items-center justify-center"
            >
              <Menu size={24} strokeWidth={1.5} color="#fff" />
            </TouchableOpacity>
          </View>

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
              {profileImage ? (
                <ProgressiveImage
                  uri={profileImage}
                  style={{ width: "100%", height: "100%" }}
                  showProgress={false}
                />
              ) : (
                <User size={14} strokeWidth={1.5} color="#fff" />
              )}
            </View>
          </Animated.View>

          {/* Right Actions */}
          <View className="flex-row items-center gap-2">
            <Animated.View style={editProfilePillAnimatedStyle}>
              <TouchableOpacity
                style={{ borderRadius: 999, borderCurve: "continuous" }}
                onPress={() =>
                  router.push({
                    pathname: "/settings",
                    params: { modal: "editProfile" },
                  } as any)
                }
                className="flex-row items-center gap-1 px-3 py-1.5 bg-white/15 border border-white/30"
              >
                <Edit3 size={13} strokeWidth={1.8} color="#fff" />
                <Text className="text-xs font-semibold text-white">
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Scan — no scanner screen exists yet, so this is a placeholder
                stub for now rather than a dead, unresponsive icon. */}
            <TouchableOpacity
              onPress={() =>
                Alert.alert("Coming Soon", "QR scanning isn't available yet.")
              }
              className="w-10 h-10 items-center justify-center"
            >
              <ScanLine size={22} strokeWidth={1.7} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShareProfile}
              className="w-10 h-10 items-center justify-center"
            >
              <ShareArcIcon size={22} strokeWidth={1.7} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content — no top padding now: the fixed header above overlays the
          cover section transparently, so this starts at the very top of the
          screen and the cover renders behind the header/status bar. */}
      <View className="flex-1">
        <Animated.ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          onScroll={mainScrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#094569"
              progressViewOffset={0}
            />
          }
        >
              {/* Cover / background photo — extends down through the avatar,
                  name/id/location, badge, stats, bio and the Edit Profile /
                  Manage buttons, stopping right above the Media/Products/
                  Services tab row. Default linear gradient when no cover
                  photo is set. */}
              <View className="relative overflow-hidden">
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  {coverImage ? (
                    <ProgressiveImage
                      uri={coverImage}
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
                <TouchableOpacity
                  onPress={() => setShowCoverMenu(true)}
                  style={{ top: HEADER_HEIGHT + 12 }}
                  className="absolute right-3 w-9 h-9 rounded-full bg-black/40 items-center justify-center"
                >
                  <Camera size={16} strokeWidth={1.5} color="white" />
                </TouchableOpacity>

                {/* Profile Info Section — Instagram style. Top padding clears
                    the fixed header row now that the cover renders behind it. */}
                <View className="px-4" style={{ paddingTop: HEADER_HEIGHT + 20 }}>
                  {/* Row: Avatar + Name/Email/Location */}
                  <View className="flex-row items-center mb-3">
                    {/* Avatar — measured on layout so the header's mini
                        avatar knows exactly when this one is ~90% scrolled
                        behind the header (see avatarContentYRef). */}
                    <View
                      ref={avatarRef}
                      className="relative"
                      onLayout={() => {
                        avatarRef.current?.measure((_x, _y, _w, _h, _pageX, pageY) => {
                          avatarContentYRef.current = pageY + mainScrollYRef.current;
                        });
                      }}
                    >
                      {/* No camera badge — long-press still opens the
                          same avatar menu as before, just without the
                          visible affordance. */}
                      <TouchableOpacity
                        onPress={() =>
                          profileImage
                            ? setShowProfileImageViewer(true)
                            : setShowMainAvatarMenu(true)
                        }
                        onLongPress={() => setShowMainAvatarMenu(true)}
                        activeOpacity={0.85}
                        className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border border-white"
                      >
                        {profileImage ? (
                          <ProgressiveImage
                            uri={profileImage}
                            style={{ width: "100%", height: "100%" }}
                            showProgress={false}
                            priority="high"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center bg-gray-100">
                            <User size={34} strokeWidth={1.5} color="#9ca3af" />
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Name, Email & Location */}
                    <View className="flex-1 ml-4">
                      <View className="flex-row items-center gap-1.5 mb-0.5">
                        <Text className="text-lg font-mbold text-white">
                          {currentUser.name}
                        </Text>
                        {verificationStatus === "verified" && (
                          <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                            <Verified size={11} color="#094569" />
                            <Text className="text-[10px] font-msemibold text-[#094569] leading-none">
                              Verified
                            </Text>
                          </View>
                        )}
                      </View>
                      {namzoedId && (
                        <TouchableOpacity
                          onPress={handleShareProfile}
                          activeOpacity={0.7}
                          className={`flex-row items-center gap-1 ${currentUser.dzongkhag ? "mb-1" : ""}`}
                        >
                          <Text
                            style={{ flexShrink: 1 }}
                            className="text-base font-regular text-white/80"
                            numberOfLines={1}
                          >
                            NamZoed ID: {namzoedId}
                          </Text>
                          <QrCode size={16} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                      )}
                      {currentUser.dzongkhag && (
                        <View className="flex-row items-center gap-1">
                          <Text className="text-base font-msemibold text-white/80">
                            GP:
                          </Text>
                          <Text className="text-base font-regular text-white/80">
                            {currentUser.dzongkhag}
                          </Text>
                        </View>
                      )}

                      {/* Badge — moved below the location line instead of
                          sitting beside the whole row. */}
                      {badgeType && (
                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname: "/settings",
                              params: { modal: "appearance" },
                            } as any)
                          }
                          className="mt-1.5 self-start"
                        >
                          <EarlyAccessBadge badgeType={badgeType} size="sm" />
                        </TouchableOpacity>
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
                        setFollowRequestsTab("followers");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-lg font-mbold text-white">
                        {followerCount}
                      </Text>
                      <Text className="text-xs font-regular text-white/70">
                        Followers
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        setFollowRequestsTab("following");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-lg font-mbold text-white">
                        {followingCount}
                      </Text>
                      <Text className="text-xs font-regular text-white/70">
                        Following
                      </Text>
                    </TouchableOpacity>
                    {/* Profile views — private 7-day rolling stat */}
                    {profileViews7d > 0 && (
                      <>
                        <Text className="text-white/40 text-xl font-light">|</Text>
                        <View className="items-center">
                          <View className="flex-row items-center" style={{ gap: 3 }}>
                            <Eye size={14} color="#fff" />
                            <Text className="text-lg font-mbold text-white">
                              {profileViews7d > 999
                                ? `${(profileViews7d / 1000).toFixed(1)}k`
                                : profileViews7d}
                            </Text>
                          </View>
                          <Text className="text-xs font-regular text-white/70">
                            Profile views
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Bio — tapping either the existing text or the empty
                      placeholder opens the dedicated bio-only edit screen
                      (just a text area), not the full Edit Profile form. */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/settings",
                        params: { modal: "editBio" },
                      } as any)
                    }
                  >
                    {bio ? (
                      <Text className="text-sm font-regular text-white/90 mb-1">
                        {bio}
                      </Text>
                    ) : (
                      <Text className="text-sm font-regular text-white/50 italic mb-1">
                        Insert your bio here
                      </Text>
                    )}
                  </TouchableOpacity>
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
                  {/* Work profile summary — shown first, above Edit
                      Profile/Manage, to give it top billing when it exists.
                      Only shown once a business name is actually set (every
                      profile auto-gets an empty service_providers row, so a
                      null/empty name means "no work profile" in practice).
                      Full management (license, service listings) lives on
                      the pushed /profile/work screen; setting one up for the
                      first time is reachable from the hamburger menu instead
                      of a tab, since an unused Work tab was dead weight for
                      anyone without one. */}
                  {serviceProvider?.name?.trim() && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => router.push("/(users)/profile/work" as any)}
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
                          {verificationStatus === "verified" && (
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
                        {providerImageUri ? (
                          <ProgressiveImage
                            uri={providerImageUri}
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
                    {/* Edit Profile moved up into the header as a pill next
                        to Scan/Share — no history screen exists yet, so this
                        is a placeholder stub for now rather than a dead,
                        unresponsive button. */}
                    <TouchableOpacity
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      onPress={() =>
                        Alert.alert("Coming Soon", "Activity history isn't available yet.")
                      }
                      className="flex-1 py-[9px] flex-row items-center justify-center bg-white/15 border border-white/30"
                    >
                      <Text className="text-sm font-semibold text-white">
                        History
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      onPress={handleManageListings}
                      className="flex-1 py-[9px] flex-row items-center justify-center bg-white/15 border border-white/30"
                    >
                      <Text className="text-sm font-semibold text-white">
                        Manage
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Tab Navigation — rounded top corners so it reads as a sheet
                  rising out of the dark cover above. Pulled up to overlap
                  the cover by the same amount as the corner radius, with an
                  internal dark strip (not a reveal-through-clip trick) so
                  the corners read consistently dark whether this sits in
                  its normal in-flow spot or is magnet-pinned to the header
                  (see tabBarAnimatedStyle below) — otherwise, once pinned,
                  the clipped corners would end up showing whatever grid
                  content happens to be scrolling past behind them instead
                  of a stable color. Text-only (no icons); Services moved
                  out entirely, since it now only ever appears via the Work
                  profile summary card above when the user has actually
                  added one.

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
                      // Clips the edge fades (and anything else inside) to
                      // the rounded corners below, instead of them
                      // overflowing past the curve as sharp rectangular
                      // patches.
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
                    {loadingPosts ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : postThumbnails.length > 0 ? (
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
                        <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                          <Grid size={26} strokeWidth={1.5} color="#3B82F6" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          Share your first moment
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          Your posts and media will show up here
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowCreatePost(true)}
                          className="mt-4 bg-primary px-5 py-2.5 rounded-full"
                        >
                          <Text className="text-white text-sm font-semibold">
                            Create a Post
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "products" && (
                  <View className="flex-row flex-wrap">
                    {loadingProducts ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : userProducts.length > 0 ? (
                      userProducts.map((product) => (
                        <View key={product.id} className="w-[50%] p-2">
                          <TouchableOpacity
                            style={{ borderRadius: 12, borderCurve: "continuous" }}
                            onPress={() =>
                              router.push(
                                `/(users)/product/${product.id}` as any,
                              )
                            }
                            className="bg-white overflow-hidden border border-gray-100"
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
                        <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-3">
                          <ShoppingBag
                            size={26}
                            strokeWidth={1.5}
                            color="#059669"
                          />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          Start selling on Namzoed
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          List your first product and reach buyers nearby
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            router.push("/(users)/(tabs)/categories" as any)
                          }
                          className="mt-4 bg-emerald-600 px-5 py-2.5 rounded-full"
                        >
                          <Text className="text-white text-sm font-semibold">
                            List a Product
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "likes" && (
                  <View className="flex-row flex-wrap">
                    {loadingLikedPosts ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : likedPosts.length > 0 ? (
                      toThumbnails(likedPosts).map((thumb) => (
                        <ProfilePostGridItem
                          key={thumb.postId}
                          thumbnailUrl={thumb.thumbnailUrl}
                          thumbnailBlurHash={thumb.thumbnailBlurHash}
                          isVideo={thumb.isVideo}
                          mediaCount={thumb.mediaCount}
                          onPress={() =>
                            router.push(`/(users)/post/${thumb.postId}` as any)
                          }
                        />
                      ))
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-pink-50 items-center justify-center mb-3">
                          <Heart size={26} strokeWidth={1.5} color="#e91e63" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          No liked posts yet
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          Posts you like will show up here
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "comments" && (
                  <View className="flex-row flex-wrap">
                    {loadingCommentedPosts ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : commentedPosts.length > 0 ? (
                      toThumbnails(commentedPosts).map((thumb) => (
                        <ProfilePostGridItem
                          key={thumb.postId}
                          thumbnailUrl={thumb.thumbnailUrl}
                          thumbnailBlurHash={thumb.thumbnailBlurHash}
                          isVideo={thumb.isVideo}
                          mediaCount={thumb.mediaCount}
                          onPress={() =>
                            router.push(`/(users)/post/${thumb.postId}` as any)
                          }
                        />
                      ))
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                          <MessageCircle size={26} strokeWidth={1.5} color="#3B82F6" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          No comments yet
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          Posts you've commented on will show up here
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "saves" && (
                  <View className="flex-row flex-wrap">
                    {loadingSavedItems ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : savedItems.length > 0 ? (
                      savedItems.map((item) => {
                        const post = item.posts;
                        const product = item.products;
                        const listing = item.marketplace;
                        const target = post
                          ? { href: `/(users)/post/${post.id}`, image: post.images?.[0], label: post.content, price: null as number | null }
                          : product
                            ? { href: `/(users)/product/${product.id}`, image: product.images?.[0], label: product.name, price: product.price }
                            : listing
                              ? { href: `/(users)/marketplace/${listing.id}`, image: listing.images?.[0], label: listing.title, price: listing.price }
                              : null;
                        if (!target) return null;
                        return (
                          <View key={item.id} className="w-[50%] p-2">
                            <TouchableOpacity
                              style={{ borderRadius: 12, borderCurve: "continuous" }}
                              onPress={() => router.push(target.href as any)}
                              className="bg-white overflow-hidden border border-gray-100"
                            >
                              {target.image ? (
                                <ProgressiveImage
                                  uri={target.image}
                                  style={{ width: "100%", height: 160 }}
                                  showProgress={false}
                                  recyclingKey={item.id}
                                />
                              ) : (
                                <View className="w-full h-40 bg-gray-100 items-center justify-center">
                                  {product ? (
                                    <ShoppingBag size={32} strokeWidth={1.5} className="text-gray-300" />
                                  ) : listing ? (
                                    <Store size={32} strokeWidth={1.5} className="text-gray-300" />
                                  ) : (
                                    <Bookmark size={32} strokeWidth={1.5} className="text-gray-300" />
                                  )}
                                </View>
                              )}
                              <View className="p-3">
                                <Text
                                  className="text-sm font-msemibold text-gray-900"
                                  numberOfLines={2}
                                >
                                  {target.label}
                                </Text>
                                {target.price != null && (
                                  <Text className="text-base font-mbold text-primary mt-2">
                                    Nu. {target.price.toLocaleString()}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-amber-50 items-center justify-center mb-3">
                          <Bookmark size={26} strokeWidth={1.5} color="#D97706" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          No saved items yet
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          Tap the bookmark icon on any post, product or listing to save it here
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Animated.ScrollView>
      </View>

      {/* ------------------------------------------------------ */}
      {/* MAIN PROFILE AVATAR ACTION MENU MODAL (merged) */}
      {/* ------------------------------------------------------ */}
      {showMainAvatarMenu && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="fade"
          visible={showMainAvatarMenu}
          onRequestClose={() => setShowMainAvatarMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "flex-end",
            }}
            onPress={() => setShowMainAvatarMenu(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "white",
                borderRadius: 24,
                borderCurve: "continuous",
                marginHorizontal: 12,
                marginBottom: 12 + insets.bottom,
              }}
            >
              <View className="px-4 pt-4 pb-4">
                <View className="flex-row gap-x-3 mb-3">
                  <TouchableOpacity
                    style={{ borderRadius: 12, borderCurve: "continuous" }}
                    onPress={() => handleImageOption("camera")}
                    className="flex-1 items-center bg-gray-50 py-2"
                  >
                    <Camera size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Take Photo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ borderRadius: 12, borderCurve: "continuous" }}
                    onPress={() => handleImageOption("gallery")}
                    className="flex-1 items-center bg-gray-50 py-2"
                  >
                    <ImageIcon size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Choose Gallery
                    </Text>
                  </TouchableOpacity>

                  {profileImage && (
                    <TouchableOpacity
                      style={{ borderRadius: 12, borderCurve: "continuous" }}
                      onPress={handleRemoveMainAvatar}
                      className="flex-1 items-center bg-red-50 py-2"
                    >
                      <Trash2 size={18} color="#dc2626" />
                      <Text className="text-[10px] font-msemibold text-red-600 mt-1">
                        Remove
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={{ borderRadius: 16, borderCurve: "continuous" }}
                  className="bg-gray-100 py-3 items-center"
                  onPress={() => setShowMainAvatarMenu(false)}
                >
                  <Text className="text-gray-500 font-msemibold text-sm">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* COVER PHOTO ACTION MENU MODAL */}
      {/* ------------------------------------------------------ */}
      {showCoverMenu && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="fade"
          visible={showCoverMenu}
          onRequestClose={() => setShowCoverMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "flex-end",
            }}
            onPress={() => setShowCoverMenu(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "white",
                borderRadius: 24,
                borderCurve: "continuous",
                marginHorizontal: 12,
                marginBottom: 12 + insets.bottom,
              }}
            >
              <View className="px-4 pt-4 pb-4">
                <View className="flex-row gap-x-3 mb-3">
                  <TouchableOpacity
                    style={{ borderRadius: 12, borderCurve: "continuous" }}
                    onPress={() => handleCoverImageOption("camera")}
                    className="flex-1 items-center bg-gray-50 py-2"
                  >
                    <Camera size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Take Photo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ borderRadius: 12, borderCurve: "continuous" }}
                    onPress={() => handleCoverImageOption("gallery")}
                    className="flex-1 items-center bg-gray-50 py-2"
                  >
                    <ImageIcon size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Choose Gallery
                    </Text>
                  </TouchableOpacity>

                  {coverImage && (
                    <TouchableOpacity
                      style={{ borderRadius: 12, borderCurve: "continuous" }}
                      onPress={handleRemoveCoverImage}
                      className="flex-1 items-center bg-red-50 py-2"
                    >
                      <Trash2 size={18} color="#dc2626" />
                      <Text className="text-[10px] font-msemibold text-red-600 mt-1">
                        Remove
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={{ borderRadius: 16, borderCurve: "continuous" }}
                  className="bg-gray-100 py-3 items-center"
                  onPress={() => setShowCoverMenu(false)}
                >
                  <Text className="text-gray-500 font-msemibold text-sm">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Success/Error Popups */}
      <PopupMessage
        visible={showSuccess}
        type="success"
        title={popupTitle}
        message={popupMessage}
      />
      <PopupMessage
        visible={showError}
        type="error"
        title={popupTitle}
        message={popupMessage}
      />

      {profileSharePayload && (
        <ShareComposerModal
          visible={showShareComposer}
          onClose={() => setShowShareComposer(false)}
          heading="Share profile"
          sharePayload={profileSharePayload}
          inAppContextParams={{
            context_product_id: String(currentUser?.id || ""),
            context_product_title:
              currentUser?.name || currentUser?.full_name || currentUser?.username || "Profile",
            context_product_price: "",
            context_product_image:
              profileImage ||
              (currentUser as any)?.avatar_url ||
              currentUser?.profileImg ||
              "",
            context_source: "profile",
            context_caption: serviceProvider?.master_bio || "",
            context_username: currentUser?.username || "",
            context_verified: verificationStatus === "verified" ? "true" : "",
          }}
        />
      )}

      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View className="flex-1 bg-background">
          <CreatePost onClose={() => setShowCreatePost(false)} />
        </View>
      </Modal>

      {showDrawer && (
        <HamburgerMenu visible={showDrawer} onClose={() => setShowDrawer(false)} />
      )}

      <BottomNavBar scale={bottomBarScale} />
    </View>
  );
}
