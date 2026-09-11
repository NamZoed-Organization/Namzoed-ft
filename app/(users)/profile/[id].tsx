import { MODAL_RADIUS } from "@/constants/theme";
import MaskedView from "@react-native-masked-view/masked-view";
import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ReportUserModal from "@/components/modals/ReportUserModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import { waitForIosModalDismiss } from "@/utils/modal";
import GridCard, { gridCardHeight, LISTING_CARD_RATIO } from "@/components/GridCard";
import TaggedProductStrip from "@/components/post/TaggedProductStrip";
import MasonryGrid from "@/components/MasonryGrid";
import BusinessSummaryCard from "@/components/profile/BusinessSummaryCard";
import SheetAction, {
  SHEET_ICON,
  SHEET_TILE_GAP,
} from "@/components/ui/SheetAction";
import PostDetailOverlay from "@/components/PostDetailOverlay";
import { usePostDetailMorph } from "@/hooks/usePostDetailMorph";
import { toPostData } from "@/lib/postData";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { blockUser, isUserBlocked, unblockUser } from "@/lib/blockService";
import {
  EarlyAccessBadgeType,
  getEarlyAccessBadge,
} from "@/lib/earlyAccessService";
import { followUser, isFollowing, unfollowUser } from "@/lib/followService";
import { fetchUserPosts, Post } from "@/lib/postsService";
import {
  fetchUserMarketplaceItems,
  MARKETPLACE_TYPE_LABEL,
  MarketplaceItem,
} from "@/lib/postMarketPlace";
import { fetchUserProfile } from "@/lib/profileService";
import { ratioForUniformMode } from "@/lib/postMediaDisplay";
import { trackProfileView } from "@/lib/viewTrackingService";
import { fetchServiceProviderProfile } from "@/lib/servicesService";
import { buildProfileExternalSharePayload } from "@/lib/shareUtils";
import { useAppRouter } from "@/utils/navigation";
import { birthdayBadge } from "@/utils/zodiac";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import {
  Ban,
  ChevronLeft,
  Flag,
  MapPin,
  MoreHorizontal,
  QrCode,
  Send,
  User,
  Verified,
  Wrench,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  SlideInDown,
  SlideOutDown,
  measure,
  runOnUI,
  useAnimatedRef,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";


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

/** Real media aspect ratio for a post's first image, same formula
 *  PostGridCard uses for the home feed grid, so this profile's grid
 *  balances columns/frames images identically instead of a fixed guess. */
function postThumbRatio(post: Post): number {
  return (
    post.media_display?.ratios?.[0] ??
    ratioForUniformMode(post.media_display?.mode ?? "portrait")
  );
}

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
  const insets = useSafeAreaInsets();
  // Tapping a post morphs the card into the detail view instead of
  // pushing /post/[id], which faded in over a spinner while it refetched
  // a post this screen was already holding.
  const { openPost, overlayProps } = usePostDetailMorph();

  // State - ALL hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState<"images" | "products">("images");

  // Nothing here gates the whole screen any more. The chrome renders on the
  // first frame and each section reports its own state: the header fills in
  // when the profile row lands, and the grids show GridSkeleton (MasonryGrid
  // does it from `loading`) until their own query does. A white screen with a
  // spinner behind six sequential round trips is what this replaced.
  const [profileLoading, setProfileLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userImages, setUserImages] = useState<string[]>([]);
  // The Marketplace tab shows this person's marketplace listings, not
  // products: products are the shopping catalogue and belong to a verified
  // shop's work profile.
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);

  // Post thumbnails (grouped by post)
  const [postThumbnails, setPostThumbnails] = useState<
    Array<{
      postId: string;
      thumbnailUrl: string;
      thumbnailBlurHash: string | null;
      mediaCount: number;
      isVideo: boolean;
      post: Post;
    }>
  >([]);
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
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "white", title: "", message: "" });
  const showPopup = (
    type: "success" | "warning" | "error" | "white",
    title: string,
    message: string,
  ) => setPopup({ visible: true, type, title, message });

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
  // scrollY is written straight from the UI-thread scroll worklet below —
  // used both for the avatar/tab-bar content-space measurements and (were
  // it needed here) anything else wanting live scroll position without a
  // bridge crossing.
  const scrollY = useSharedValue(0);

  // Mini avatar in the header — stays hidden until the real avatar (in the
  // cover) is ~90% passed behind the header, then slides up + fades in over
  // MINI_AVATAR_REVEAL_DISTANCE of additional scroll. avatarContentY is
  // filled in by the avatar's onLayout measurement below (content-space Y,
  // scroll-offset independent), since its on-screen position shifts with
  // badge/dzongkhag layout and shouldn't be hardcoded. This and
  // headerBgOpacity are computed directly in the UI-thread scroll worklet
  // (mainScrollHandler) rather than a JS-thread function — see the tab-bar
  // comment below for why that matters.
  const AVATAR_SIZE = 86;
  const MINI_AVATAR_REVEAL_DISTANCE = 70;
  const avatarContentY = useSharedValue<number>(Number.POSITIVE_INFINITY);
  const avatarRef = useAnimatedRef<View>();
  // measure() can legitimately return null on the very first layout pass —
  // the native view isn't always fully registered with the UI thread yet at
  // that exact instant, a known Reanimated race. Since avatarContentY is
  // only ever set here, a single failed read would leave the mini-avatar
  // reveal permanently stuck instead of just briefly wrong — retry across a
  // few frames until it succeeds.
  const measureAvatarContentY = (attempt = 0) => {
    "worklet";
    const m = measure(avatarRef);
    if (m) {
      avatarContentY.value = m.pageY + scrollY.value;
    } else if (attempt < 10) {
      requestAnimationFrame(() => measureAvatarContentY(attempt + 1));
    }
  };
  const miniAvatarProgress = useSharedValue(0);
  const miniAvatarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: miniAvatarProgress.value,
    transform: [{ translateY: (1 - miniAvatarProgress.value) * 14 }],
  }));

  // Magnetic tab bar — the SAME Posts/Marketplace row (no duplicate) gets a
  // translateY that exactly cancels out its own natural upward scroll once
  // its top edge would slide behind the fixed header, so it appears to lock
  // in place right there while the rest of the content keeps scrolling
  // underneath; below that threshold translateY is 0 and it scrolls
  // completely normally.
  //
  // This has to be computed on the UI thread (via useAnimatedScrollHandler
  // below), not from a plain JS-thread onScroll callback — a JS-thread
  // update lags a frame or more behind the ScrollView's own native-driven
  // position, and since this transform is fighting to stay glued to a
  // fast-moving native scroll, that lag is what reads as "wobbling": the
  // bar visibly hunting to catch up to where the scroll actually is instead
  // of tracking it 1:1. tabBarContentY is a shared value (not a plain ref)
  // so the worklet can read it directly; it's filled in from the row's own
  // onLayout via Reanimated's measure() (UI-thread, synchronous) rather
  // than the legacy ref.measure() bridge call, which crosses the JS↔native
  // bridge asynchronously — if the row's onLayout ever refires near/during
  // an active scroll, that round-trip alone is enough to stall a frame and
  // read as the whole magnetic pin stuttering.
  const tabBarRef = useAnimatedRef<View>();
  const tabBarContentY = useSharedValue<number>(Number.POSITIVE_INFINITY);
  // Same retry-until-it-lands reasoning as measureAvatarContentY above —
  // measure() can return null on the very first layout pass, and since
  // tabBarContentY is only ever set here, a single failed read used to
  // leave the pin permanently stuck at its Infinity sentinel (never
  // activating at all) instead of just being briefly wrong.
  const measureTabBarContentY = (attempt = 0) => {
    "worklet";
    const m = measure(tabBarRef);
    if (m) {
      tabBarContentY.value = m.pageY + scrollY.value;
    } else if (attempt < 10) {
      requestAnimationFrame(() => measureTabBarContentY(attempt + 1));
    }
  };
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

  // Drives tabBarTranslateY, headerBgOpacity, and miniAvatarProgress
  // directly on the UI thread every scroll frame (zero bridge latency) —
  // moving these off the JS thread matters most exactly when it's most
  // likely to be missed: fast/sustained scrolling, where that JS-thread
  // work was competing with MasonryGrid mounting newly-revealed cards for
  // the same frame budget and showing up as stutter across the whole
  // header, not just the tab bar.
  const mainScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
      const triggerY = tabBarContentY.value - headerActualHeight.value;
      tabBarTranslateY.value = Math.max(0, y - triggerY);

      headerBgOpacity.value = Math.max(
        0,
        Math.min(1, y / HEADER_FADE_DISTANCE),
      );
      const avatarTriggerY =
        avatarContentY.value + AVATAR_SIZE * 0.9 - HEADER_HEIGHT;
      miniAvatarProgress.value = Math.max(
        0,
        Math.min(1, (y - avatarTriggerY) / MINI_AVATAR_REVEAL_DISTANCE),
      );
    },
  });

  // tabBarTranslateY above is only ever written inside the scroll handler,
  // so a remeasurement landing between scroll events (tabBarContentY/
  // headerActualHeight shifting as async content above — badge,
  // service-provider card, stats — finishes loading and reflows the tab
  // row's position) had no way to reach the pin until the next scroll
  // frame, which then snapped it to the corrected position all at once —
  // reading as the bar glitching a few scrolls into a fresh mount.
  // Reacting to the trigger point itself recomputes translateY the instant
  // a remeasurement lands, using whatever scrollY already is, so the
  // correction happens invisibly instead of surfacing as a jump.
  useAnimatedReaction(
    () => tabBarContentY.value - headerActualHeight.value,
    (triggerY, previousTriggerY) => {
      if (previousTriggerY !== null && triggerY === previousTriggerY) return;
      tabBarTranslateY.value = Math.max(0, scrollY.value - triggerY);
    },
  );

  // Per-profile cover color identity, read straight off the profile row
  // (profiles.cover_hue): extracted from their cover photo when they
  // uploaded one, random when they have none. Same "dark matte navy"
  // formula either way (see lib/coverTheme.ts), just with a different hue,
  // so it's unique per user without ever looking garish. userProfile isn't
  // loaded yet on first render — the hook falls back to its default hue
  // until it is. No write-back here the way the owner's own profile screen
  // does: a viewer can't update someone else's row.
  const birthday = birthdayBadge(
    userProfile?.birth_date,
    userProfile?.show_birthday,
    userProfile?.birthday_display,
  );

  const {
    header: HEADER_GRADIENT,
    cover: COVER_GRADIENT,
    tintRgb,
  } = useCoverPalette(
    userProfile?.id,
    userProfile?.cover_image_url,
    userProfile?.cover_hue,
  );

  // Guard: If viewing own profile, redirect to the main profile tab
  // MOVED AFTER all hooks to avoid hook order violations
  if (currentUser?.id === id) {
    return <Redirect href="/(users)/profile" />;
  }

  // One loader for both mount and pull-to-refresh. Every request is fired
  // together and each one updates its own slice as it lands — the header no
  // longer waits on the product query, and the post grid no longer waits on
  // the follow check. Previously these ran as a single sequential chain, and
  // the screen showed nothing at all until the last of them returned.
  const loadProfileData = React.useCallback(
    async (mode: "initial" | "refresh") => {
      if (!id || typeof id !== "string") return;

      if (mode === "initial") {
        setProfileLoading(true);
        setPostsLoading(true);
        setProductsLoading(true);
      }

      const viewerId = currentUser?.id;

      // Fire-and-forget: neither one renders anything the user waits for.
      if (viewerId && viewerId !== id) {
        trackProfileView(id, viewerId).catch(() => {});
      }
      getEarlyAccessBadge(id).then(setBadgeType).catch(() => {});

      const profileTask = fetchUserProfile(id)
        .then(setUserProfile)
        .catch((error) => {
          console.error("Error loading public profile:", error);
          if (mode === "initial") {
            showPopup(
              "error",
              "Load Failed",
              "Could not load user profile. Please try again.",
            );
          }
        })
        .finally(() => setProfileLoading(false));

      const postsTask = fetchUserPosts(id)
        .then((posts) => {
          setUserPosts(posts);

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
        })
        .catch((error) => console.error("Error loading profile posts:", error))
        .finally(() => setPostsLoading(false));

      const marketplaceTask = fetchUserMarketplaceItems(id)
        .then((rows) => setMarketplaceItems(rows ?? []))
        .catch((error) => console.error("Error loading profile marketplace:", error))
        .finally(() => setProductsLoading(false));

      setLoadingServiceProvider(true);
      const providerTask = fetchServiceProviderProfile(id)
        .then(setServiceProvider)
        .catch((error) => console.error("Error loading service provider:", error))
        .finally(() => setLoadingServiceProvider(false));

      const relationTask = viewerId
        ? Promise.all([
            isFollowing(viewerId, id).then(setIsFollowingUser),
            isUserBlocked(viewerId, id).then(setIsBlocked),
          ]).catch((error) =>
            console.error("Error loading follow/block state:", error),
          )
        : Promise.resolve();

      await Promise.allSettled([
        profileTask,
        postsTask,
        marketplaceTask,
        providerTask,
        relationTask,
      ]);
      setRefreshing(false);
    },
    // showPopup and the setters are stable enough for this; the identity that
    // matters is which profile is being viewed and who is viewing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, currentUser?.id],
  );

  useEffect(() => {
    void loadProfileData("initial");
  }, [loadProfileData]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadProfileData("refresh");
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
                  setUserProfile((prev: any) =>
                    prev
                      ? {
                          ...prev,
                          follower_count: Math.max(
                            0,
                            (prev.follower_count || 0) - 1,
                          ),
                        }
                      : prev,
                  );
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                } else {
                  showPopup(
                    "error",
                    "Unfollow Failed",
                    result.error || "Failed to unfollow user.",
                  );
                }
              } catch (error) {
                showPopup(
                  "error",
                  "Unfollow Failed",
                  "Could not unfollow this user. Please try again.",
                );
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
          setUserProfile((prev: any) =>
            prev
              ? { ...prev, follower_count: (prev.follower_count || 0) + 1 }
              : prev,
          );
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else {
          showPopup(
            "error",
            "Follow Failed",
            result.error || "Failed to follow user.",
          );
        }
      } catch (error) {
        showPopup(
          "error",
          "Follow Failed",
          "Could not follow this user. Please try again.",
        );
      } finally {
        setLoadingFollow(false);
      }
    }
  };

  // Every action on the "more" sheet opens something else — another modal,
  // or a native Alert — and on iOS presenting into the sheet's own dismissal
  // means it never appears (UI_STANDARD.md § Feedback and motion). So the
  // sheet goes down first and the wait is paid before whatever comes next.
  const closeMoreMenuThen = async (next: () => void) => {
    setShowMoreMenu(false);
    await waitForIosModalDismiss();
    next();
  };

  const handleShareProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeMoreMenuThen(() => setShowShareComposer(true));
  };

  // Block/Unblock Handler
  const handleBlockToggle = async () => {
    if (!currentUser?.id || typeof id !== "string") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Also reached from handleReportSuccess, where what's dismissing is the
    // report modal rather than the sheet — the same wait covers both.
    closeMoreMenuThen(() => {
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
                  showPopup(
                    "success",
                    "User Unblocked",
                    "This user has been unblocked successfully.",
                  );
                } else {
                  showPopup(
                    "error",
                    "Unblock Failed",
                    result.error || "Failed to unblock user.",
                  );
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
                  showPopup(
                    "success",
                    "User Blocked",
                    "This user has been blocked successfully.",
                  );
                } else {
                  showPopup(
                    "error",
                    "Block Failed",
                    result.error || "Failed to block user.",
                  );
                }
              },
            },
          ],
        );
      }
    });
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeMoreMenuThen(() => setShowReportModal(true));
  };

  const handleReportSuccess = async () => {
    // Called after a successful report, to offer blocking as well. The
    // report screen is a full-screen modal on its way out and takes longer
    // to go than a sheet does, so the block confirmation — a native Alert,
    // just as easily lost into a dismissal — waits for it properly.
    await waitForIosModalDismiss(400);
    handleBlockToggle();
  };

  const handleOpenProfileImage = (imageUri?: string | null) => {
    if (!imageUri) return;
    setViewerImageUri(imageUri);
    setShowProfileImageViewer(true);
  };

  // Only a profile that has finished loading and come back empty is a
  // missing user. While it's still in flight the screen renders normally —
  // cover gradient, avatar placeholder, skeleton grids — and fills in.
  if (!profileLoading && !userProfile) {
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
        className="flex-1 pt-3 items-center"
        onPress={() => setActiveTab("images")}
      >
        <Text
          className={`font-msemibold text-xl ${
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
        className="flex-1 pt-3 items-center"
        onPress={() => setActiveTab("products")}
      >
        <Text
          className={`font-msemibold text-xl ${
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
    <View
      className="flex-1"
      style={{ backgroundColor: "#F0F1F3" }}
      pointerEvents={isFocused ? "auto" : "none"}
    >
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

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
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
              },
              miniAvatarAnimatedStyle,
            ]}
            pointerEvents="none"
          >
            <View className="w-7 h-7 rounded-full bg-white/20 overflow-hidden items-center justify-center">
              {userProfile?.avatar_url ? (
                <ProgressiveImage
                  uri={userProfile?.avatar_url}
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
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              {userProfile?.cover_image_url ? (
                <ProgressiveImage
                  uri={userProfile?.cover_image_url}
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
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(70,72,76,0.58)",
                }}
              />
            </View>

            {/* Profile Info Section — Instagram style. Top padding
                    clears the fixed header row now that the cover renders
                    behind it. */}
            <View className="px-4" style={{ paddingTop: HEADER_HEIGHT + 40 }}>
              {/* Row: Avatar + Name/Email/Location */}
              <View className="flex-row items-center mb-1">
                {/* Avatar — measured on layout so the header's mini
                        avatar knows exactly when this one is ~90% scrolled
                        behind the header (see avatarContentY above). */}
                <TouchableOpacity
                  ref={avatarRef}
                  onLayout={() => {
                    runOnUI(measureAvatarContentY)();
                  }}
                  onPress={() => handleOpenProfileImage(userProfile?.avatar_url)}
                  disabled={!userProfile?.avatar_url}
                  activeOpacity={0.85}
                  className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border border-white"
                >
                  {userProfile?.avatar_url ? (
                    <ProgressiveImage
                      uri={userProfile?.avatar_url}
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
                    <Text className="text-3xl font-mbold text-white">
                      {userProfile?.name}
                    </Text>
                    {serviceProvider?.verification_status === "verified" && (
                      <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                        <Verified size={11} color="#094569" />
                        <Text className="text-[10px] font-msemibold text-[#094569] leading-none">
                          Verified
                        </Text>
                      </View>
                    )}
                  </View>
                  {userProfile?.namzoed_id && (
                    <TouchableOpacity
                      onPress={() => setShowShareComposer(true)}
                      activeOpacity={0.7}
                      className={`flex-row items-center gap-1 ${userProfile?.dzongkhag ? "mb-1" : ""}`}
                    >
                      <Text
                        style={{ flexShrink: 1 }}
                        className="text-sm font-regular text-white/50"
                        numberOfLines={1}
                      >
                        NamZoed ID: {userProfile?.namzoed_id}
                      </Text>
                      <QrCode size={14} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  )}
                  {userProfile?.dzongkhag && (
                    <View className="flex-row items-center gap-1">
                      <MapPin size={13} color="rgba(255,255,255,0.5)" />
                      <Text className="text-sm font-regular text-white/50">
                        {userProfile?.dzongkhag}
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
            <View className="relative overflow-hidden" style={{ marginTop: 4 }}>
              {Platform.OS === "ios" && (
                <MaskedView
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
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
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <View className="px-4 pt-2 pb-3">
                {/* Stats row — below the avatar/name row */}
                <View className="flex-row items-center justify-start gap-8 mb-4">
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-xl font-mbold text-white">
                      {userPosts.length}
                    </Text>
                    <Text className="text-lg font-medium text-white/70">
                      Posts
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="flex-row items-baseline gap-1"
                    onPress={() => {
                      if (!id || typeof id !== "string") return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setFollowRequestsTab("followers");
                      setShowFollowRequests(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text className="text-xl font-mbold text-white">
                      {userProfile?.follower_count || 0}
                    </Text>
                    <Text className="text-lg font-medium text-white/70">
                      Followers
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-baseline gap-1"
                    onPress={() => {
                      if (!id || typeof id !== "string") return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setFollowRequestsTab("following");
                      setShowFollowRequests(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text className="text-xl font-mbold text-white">
                      {userProfile?.following_count || 0}
                    </Text>
                    <Text className="text-lg font-medium text-white/70">
                      Following
                    </Text>
                  </TouchableOpacity>
                </View>

                {userProfile?.bio && (
                  <Text className="text-base font-medium text-white/70">
                    {userProfile?.bio}
                  </Text>
                )}

                {/* Age / animal year / sun sign as a pill under the bio —
                      only what this user chose to reveal. Their actual birth
                      date is never shown to anyone. */}
                {birthday && (
                  <View
                    className="flex-row items-center gap-1 self-start mt-2.5 px-2.5 py-1 bg-white/[0.14]"
                    style={{ borderRadius: 999, borderCurve: "continuous" }}
                  >
                    <Text className="text-xs font-msemibold text-white/80">
                      {birthday.label}
                    </Text>
                  </View>
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
              {/* Business summary — shown first, above Follow/
                      Message, to give it top billing when it exists. Only
                      shown once this user has actually set a business name
                      (every profile auto-gets an empty service_providers
                      row, so a null/empty name means "no business" in
                      practice). Read-only: no edit affordances, just their
                      business card + services/products, on the pushed
                      /profile/work screen. */}
              {typeof id === "string" && (
                <BusinessSummaryCard
                  userId={id}
                  providerId={serviceProvider?.id}
                  providerName={serviceProvider?.name}
                  fallbackName={userProfile?.name}
                  isVerified={serviceProvider?.verification_status === "verified"}
                  onPress={() =>
                    router.push({
                      pathname: "/(users)/profile/work",
                      params: { userId: id },
                    } as any)
                  }
                />
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
            collapsable={false}
            onLayout={() => {
              runOnUI(measureTabBarContentY)();
            }}
            style={{ marginTop: -20, zIndex: 10, elevation: 10 }}
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
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                  borderCurve: "continuous",
                  overflow: "hidden",
                }}
                className="bg-white border-b border-gray-100"
              >
                {renderTabRow()}
              </View>
            </Animated.View>
          </View>

          {/* Tab Content — single mounted panel per tab. */}
          {activeTab === "images" && (
            <MasonryGrid
              items={postThumbnails}
              loading={postsLoading}
              keyExtractor={(thumb) => thumb.postId}
              getHeight={(thumb, width) =>
                gridCardHeight(postThumbRatio(thumb.post), width)
              }
              renderCard={(thumb, width, deferred, priority) => (
                <GridCard
                  id={thumb.postId}
                  width={width}
                  ratio={postThumbRatio(thumb.post)}
                  imageUri={thumb.thumbnailUrl}
                  blurhash={thumb.thumbnailBlurHash ?? undefined}
                  isVideo={thumb.isVideo}
                  title={thumb.post.content}
                  belowTitle={
                    <TaggedProductStrip
                      products={(thumb.post as any).tagged_products}
                    />
                  }
                  avatarUri={userProfile?.avatar_url ?? undefined}
                  avatarLabel={userProfile?.name}
                  subtitle={userProfile?.name}
                  onPress={(_id, rect) =>
                    openPost(
                      toPostData(thumb.post, {
                        name: userProfile?.name,
                        avatarUrl: userProfile?.avatar_url,
                      }),
                      rect,
                    )
                  }
                  deferred={deferred}
                  priority={priority}
                />
              )}
              emptyText="Posts will appear here"
            />
          )}
          {activeTab === "products" && (
            <MasonryGrid
              items={marketplaceItems}
              loading={productsLoading}
              keyExtractor={(item) => item.id}
              getHeight={(_item, width) =>
                gridCardHeight(LISTING_CARD_RATIO, width)
              }
              renderCard={(item, width, deferred, priority) => (
                <GridCard
                  id={item.id}
                  width={width}
                  ratio={LISTING_CARD_RATIO}
                  imageUri={item.images?.[0]}
                  title={item.title}
                  subtitle={MARKETPLACE_TYPE_LABEL[item.type]}
                  footerRight={
                    // "Free" rather than "Nu. 0", which reads as a missing
                    // price rather than a deliberate one.
                    <Text className="text-sm font-mbold text-primary">
                      {item.type === "free" || !item.price
                        ? "Free"
                        : `Nu. ${item.price.toLocaleString()}`}
                    </Text>
                  }
                  onPress={(id) => router.push(`/(users)/marketplace/${id}` as any)}
                  deferred={deferred}
                  priority={priority}
                />
              )}
              emptyText="Nothing listed for sale yet"
            />
          )}

          {/* Bottom spacer */}
          <View className="h-8" />
        </Animated.ScrollView>
      </View>

      {showFollowRequests && typeof id === "string" && (
        <Modal
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          visible={showFollowRequests}
          onRequestClose={() => setShowFollowRequests(false)}
        >
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={{
              height: "100%",
              borderTopLeftRadius: MODAL_RADIUS,
              borderTopRightRadius: MODAL_RADIUS,
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

      {/* More menu — round action tiles rather than a list of description
          rows (UI_STANDARD.md § Sheets). Send sits on its own row so more
          share targets can join it later; Report and Block share the row
          below the hairline. One icon weight and one icon colour across the
          sheet — the old red/amber/black per-item colouring is exactly what
          the standard rules out. */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
        // A bottom-anchored sheet has to own the whole screen, or Android's
        // system-bar inset leaves a strip below it and the sheet looks like
        // it's floating. Its own paddingBottom clears the gesture bar.
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setShowMoreMenu(false)}
        >
          <Pressable onPress={() => {}}>
            <Animated.View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: MODAL_RADIUS,
                borderTopRightRadius: MODAL_RADIUS,
                borderCurve: "continuous",
                // Clears the home indicator on the phones that have one.
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              }}
              entering={SlideInDown.springify()}
            >
              {/* Handle — same 40x4 grab bar as BottomSheetModal. */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  borderCurve: "continuous",
                  backgroundColor: "#D1D5DB",
                  alignSelf: "center",
                  marginTop: 12,
                  marginBottom: 4,
                }}
              />

              <Text className="px-4 pt-3 pb-4 text-[13px] font-semibold text-gray-500">
                Share profile
              </Text>
              <View
                className="flex-row px-4 pb-5"
                style={{ gap: SHEET_TILE_GAP }}
              >
                <SheetAction
                  icon={<Send size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                  label="Send"
                  onPress={handleShareProfile}
                />
              </View>

              {/* Inset to where the tiles start, per the separator rule. */}
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: "#f0f0f0",
                  marginHorizontal: 16,
                }}
              />

              <View
                className="flex-row px-4 pt-5"
                style={{ gap: SHEET_TILE_GAP }}
              >
                <SheetAction
                  icon={<Flag size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                  label="Report"
                  onPress={handleReport}
                />
                <SheetAction
                  icon={<Ban size={22} color={SHEET_ICON} strokeWidth={1.8} />}
                  label={isBlocked ? "Unblock" : "Block"}
                  onPress={handleBlockToggle}
                />
              </View>

              {/* Cancel */}
              <TouchableOpacity
                style={{
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                }}
                onPress={() => setShowMoreMenu(false)}
                activeOpacity={0.7}
                className="mx-4 mt-6 py-3.5 bg-[#F5F5F5]"
              >
                <Text className="text-center text-[15.5px] font-semibold text-[#111]">
                  Cancel
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      <PostDetailOverlay {...overlayProps} />

      {/* Report Modal */}
      {currentUser?.id && userProfile && typeof id === "string" && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetUserId={id}
          targetUserName={userProfile?.name || userProfile?.username || "user"}
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
              userProfile?.name ||
              userProfile?.full_name ||
              userProfile?.username ||
              "Profile",
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
