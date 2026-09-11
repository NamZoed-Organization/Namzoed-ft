import MaskedView from "@react-native-masked-view/masked-view";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import HamburgerMenu from "@/components/modals/HamburgerMenu";
import ImageCropOverlay from "@/components/modals/ImageCropOverlay";
import CoverImageViewer from "@/components/modals/CoverImageViewer";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import { MODAL_RADIUS } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { useIsFocused } from "@react-navigation/native";
import CreatePost from "@/components/modals/CreatePost";
// Custom hooks
import { useProfileData } from "@/hooks/profile/useProfileData";
import { useServiceProvider } from "@/hooks/profile/useServiceProvider";
import { useUserPosts } from "@/hooks/profile/useUserPosts";
import { useUserMarketplace } from "@/hooks/profile/useUserMarketplace";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import { useEarlyAccessBadge } from "@/hooks/useEarlyAccessBadge";
// Profile components
import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import { MARKETPLACE_TYPE_LABEL } from "@/lib/postMarketPlace";
import BusinessSummaryCard from "@/components/profile/BusinessSummaryCard";
import ProfileTabRow from "@/components/profile/ProfileTabRow";
import PostDetailOverlay from "@/components/PostDetailOverlay";
import { usePostDetailMorph } from "@/hooks/usePostDetailMorph";
import { toPostData } from "@/lib/postData";
import ShareArcIcon from "@/components/icons/ShareArcIcon";
import GridCard, { gridCardHeight, LISTING_CARD_RATIO } from "@/components/GridCard";
import TaggedProductStrip from "@/components/post/TaggedProductStrip";
import MasonryGrid from "@/components/MasonryGrid";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import BottomNavBar from "@/components/ui/BottomNavBar";
import { useBottomBarScroll } from "@/hooks/useBottomBarScroll";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import AvatarStylePicker from "@/components/modals/AvatarStylePicker";
import GeneratedAvatar from "@/components/ui/GeneratedAvatar";
import {
  generatedAvatarFor,
  isAnimatedStyle,
  type AvatarAnimation,
} from "@/lib/dicebear";
import PopupMessage from "@/components/ui/PopupMessage";
import {
    deleteAvatar,
    deleteCoverImage,
    updateUserProfile,
} from "@/lib/profileService";
import { extractCoverHue } from "@/lib/coverHue";
import { getRandomHue } from "@/lib/coverTheme";
import { saveAvatarPhoto, saveCoverPhoto } from "@/lib/profileMedia";
import { getUserBookmarks } from "@/lib/bookmarkService";
import { getUserCommentedPosts } from "@/lib/commentsService";
import { getUserLikedPosts } from "@/lib/likesService";
import { Post, PostWithUser } from "@/lib/postsService";
import { ratioForUniformMode } from "@/lib/postMediaDisplay";
import { peekCache, readCache, writeCache } from "@/lib/queryCache";
import { getProfileViewCount7d } from "@/lib/viewTrackingService";
import {
    buildProfileExternalSharePayload,
} from "@/lib/shareUtils";
import { useAppRouter } from "@/utils/navigation";
import { presentSystemPicker, waitForIosModalDismiss } from "@/utils/modal";
import { birthdayBadge } from "@/utils/zodiac";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
    Camera,
    Edit3,
    Eye,
    Heart,
    History,
    ImageIcon,
    Menu,
    QrCode,
    ScanLine,
    Sparkles,
    Trash2,
    User,
    Verified,
    Wallet,
    Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
// How far the tab bar's rounded-corner "sheet" overlaps up into the cover
// above it (both in its normal in-flow spot and once pinned below the
// header) — see the tab bar wrapper's JSX for how this factors into the
// sticky spacer's height.
const TAB_BAR_CORNER_OVERLAP = 20;

/** Sub-pixel overlap between adjoining sections that share a background
 *  color, so no sliver of what's behind them shows through the seam. */
const SECTION_SEAM_OVERLAP = 0.5;

// Rendered by renderTabRow below — a single shared list so the tab row's
// magnet-pinned state never needs a duplicate copy to stay in sync.
const PROFILE_TABS = [
  { key: "images", label: "Posts" },
  { key: "products", label: "Marketplace" },
  { key: "likes", label: "Likes" },
  { key: "saves", label: "Saves" },
  { key: "comments", label: "Comments" },
] as const;
const PROFILE_TAB_ORDER = PROFILE_TABS.map((tab) => tab.key);

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

// v2: entries cached before these grids started showing the original
// author carry no profile on them, and would render as "Unknown" until the
// refetch landed. A new key just skips them.
const likedPostsCacheKey = (userId: string) => `profile:liked:v2:${userId}`;
const commentedPostsCacheKey = (userId: string) => `profile:commented:v2:${userId}`;
const savedItemsCacheKey = (userId: string) => `profile:saved:v2:${userId}`;

/** Same PostThumbnail shape hooks/profile/useUserPosts.ts builds for the
 *  Posts tab — reused here so the Likes/Comments tabs render in the exact
 *  same MasonryGrid/GridCard layout. */
function toThumbnails(posts: PostWithUser[]) {
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

/** Display name of whoever actually posted something shown in the
 *  Likes/Comments grids. These tabs list *other people's* content the user
 *  interacted with, so the footer has to name the author — never the
 *  viewer, which is what it used to do. */
function postAuthorName(post: PostWithUser): string {
  return post.profiles?.name || "Unknown";
}

/** Real media aspect ratio for a post's first image, same formula
 *  PostGridCard uses for the home feed grid, so profile grids balance
 *  columns/frame images identically instead of a fixed guess. */
function postThumbRatio(post: Post): number {
  return (
    post.media_display?.ratios?.[0] ??
    ratioForUniformMode(post.media_display?.mode ?? "portrait")
  );
}

/** Saved items are polymorphic (a post, product, or marketplace listing) —
 *  this normalizes whichever one a bookmark row points at into the shape
 *  the Saves tab's grid needs. Returns null for rows with none of the
 *  three (shouldn't happen, but keeps the grid from rendering a blank
 *  card if one ever does). */
function savedItemInfo(item: any): {
  id: string;
  href: string;
  image: string | undefined;
  title: string;
  price: number | null;
  ratio: number;
  isVideo: boolean;
  /** Whoever posted/listed the saved item — the viewer saved it, they
   *  didn't create it, so the card credits its owner. */
  authorName: string;
  authorAvatar: string | undefined;
} | null {
  const post = item.posts;
  const product = item.products;
  const listing = item.marketplace;
  const owner = (row: any) => ({
    authorName: row?.profiles?.name || "Unknown",
    authorAvatar: row?.profiles?.avatar_url ?? undefined,
  });
  if (post) {
    return {
      id: item.id,
      href: `/(users)/post/${post.id}`,
      image: post.images?.[0],
      title: post.content,
      price: null,
      ratio: postThumbRatio(post),
      isVideo: post.images?.[0] ? isVideoUrl(post.images[0]) : false,
      ...owner(post),
    };
  }
  if (product) {
    return {
      id: item.id,
      href: `/(users)/product/${product.id}`,
      image: product.images?.[0],
      title: product.name,
      price: product.price,
      ratio: LISTING_CARD_RATIO,
      isVideo: false,
      ...owner(product),
    };
  }
  if (listing) {
    return {
      id: item.id,
      href: `/(users)/marketplace/${listing.id}`,
      image: listing.images?.[0],
      title: listing.title,
      price: listing.price,
      ratio: LISTING_CARD_RATIO,
      isVideo: false,
      ...owner(listing),
    };
  }
  return null;
}

// --- Reanimated ---
import Animated, {
    SlideInDown,
    SlideOutDown,
    measure,
    runOnJS,
    runOnUI,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

export default function ProfileScreen() {
  const { currentUser, setCurrentUser } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  // All three post grids below morph their card into the detail view —
  // see UI_STANDARD.md § Grid to detail. Each already holds the whole post,
  // so there is nothing to refetch and no spinner to sit through.
  const { openPost, overlayProps } = usePostDetailMorph();
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

  const { openManageListings } = useLocalSearchParams<{
    openManageListings?: string;
  }>();

  // Live scroll position, written straight from the UI-thread scroll
  // worklet below (mainScrollHandler) — declared up here, before anything
  // that closes over it, because a worklet's closure captures whatever a
  // variable resolves to at the line the worklet is *defined*, not the line
  // it's later *called* from. Several worklets below (measureAvatarContentY,
  // the stretchy-cover style, mainScrollHandler itself) all read
  // scrollY.value, so it has to exist before all of them.
  const scrollY = useSharedValue(0);

  // Fixed header now overlays the cover (transparent at rest, so the cover
  // photo/gradient is visible from the status bar down) — fades to its
  // solid gradient as the user scrolls the cover out of view.
  const headerBgOpacity = useSharedValue(0);
  const headerBgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerBgOpacity.value,
  }));

  // Mini avatar in the header — stays hidden until the real avatar (in the
  // cover) is ~90% passed behind the header, then slides up + fades in over
  // MINI_AVATAR_REVEAL_DISTANCE of additional scroll. avatarContentY is
  // filled in by the avatar's onLayout measurement below (content-space Y,
  // scroll-offset independent), since its on-screen position shifts with
  // badge/dzongkhag layout and shouldn't be hardcoded. Both this and
  // headerBgOpacity below used to be computed from a JS-thread function
  // (runOnJS'd on every single scroll event) — moved into the UI-thread
  // scroll worklet instead (see mainScrollHandler): it removes a bridge
  // crossing from every scroll frame, which matters most exactly when it's
  // most likely to be missed — fast/sustained scrolling, where that
  // JS-thread work was competing with MasonryGrid mounting newly-revealed
  // cards for the same frame budget and showing up as stutter across the
  // whole header, not just here. avatarContentY needs to be a shared value
  // (not a plain ref) for the worklet to read it directly.
  const AVATAR_SIZE = 86;
  const MINI_AVATAR_REVEAL_DISTANCE = 70;
  const avatarContentY = useSharedValue<number>(Number.POSITIVE_INFINITY);
  const avatarRef = useAnimatedRef<View>();
  // measure() can return null on the very first layout pass — retry
  // across a few frames until it succeeds rather than leaving
  // avatarContentY stuck at its Infinity sentinel forever.
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
  // Inverse of the mini avatar's own fade — Edit Profile crossfades out of
  // the header exactly as the mini avatar fades in, instead of sitting
  // alongside it once you've scrolled past the cover.
  const editProfilePillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - miniAvatarProgress.value,
  }));

  // Magnetic tab bar — the SAME Posts/Marketplace/etc. row (no duplicate)
  // locks in place right below the fixed header once scrolled up to meet
  // it, via the ScrollView's own native `stickyHeaderIndices` (see the
  // Animated.ScrollView below) rather than a hand-computed translateY.
  // This used to be driven by a UI-thread scroll worklet doing its own
  // measure()-based position tracking + `Math.max(0, y - triggerY)` math —
  // technically correct, but every one of those measure() calls, the
  // reaction to remeasurement, and the transform recompute was still this
  // screen's own JS/UI-thread code competing for the same frame budget as
  // everything else this heavy screen does on a fresh scroll (async data
  // settling, images decoding, grid cards mounting) — and any hitch there
  // read as the pin stuttering, since it was the one thing on screen that
  // *had* to update every single frame to stay glued to the scroll.
  // `stickyHeaderIndices` hands that job to the platform's native scroll
  // implementation instead (the same mechanism SectionList uses for
  // sticky section headers) — zero custom per-frame computation, so
  // there's nothing left for this screen's own workload to stall.
  //
  // The tricky part: stickyHeaderIndices pins its target flush to the
  // ScrollView's own top edge (true y=0, i.e. under the status bar), but
  // the fixed header lives *outside* the ScrollView as a separate
  // absolutely-positioned overlay — so the tab bar needs to land at
  // headerHeight, not 0. The tab bar wrapper below solves this with an
  // invisible spacer the height of the header, offset by an equal
  // negative marginTop on the wrapper itself: in normal (unstuck) flow the
  // negative margin exactly cancels the spacer out (renders identically to
  // not having one), but once natively pinned, that cancellation no longer
  // applies to what's *inside* the pinned block — the spacer still
  // occupies its own headerHeight at the top, landing right behind the
  // fixed header, and the real tab row content starts exactly where the
  // spacer ends. See the wrapper's JSX below for the actual layout.
  //
  // headerHeight is measured from the fixed header's own onLayout (falling
  // back to the HEADER_HEIGHT constant until that first measurement
  // lands) — a rough hardcoded constant doesn't account for status bar
  // height varying by device, which would leave a device-dependent sliver
  // of the tab bar hidden under (or a gap below) the header once pinned.
  const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT);

  // Stretchy cover — on overscroll (pulling down past the top, contentOffset
  // going negative) the cover image/gradient scales up to fill the gap that
  // would otherwise show blank background, instead of just the native
  // bounce revealing empty space above it. coverContainerHeight is measured
  // from the cover's own onLayout (it spans down through the avatar/name/
  // stats/bio, not a fixed banner height, so this can't be hardcoded);
  // scrollY (declared up near avatarContentY, since the measure*ContentY
  // worklets above close over it too — a worklet's closure captures
  // whatever a variable resolves to at the line it's defined, so it needs
  // to already exist by then, not just by the time it's called) is written
  // straight from the UI-thread scroll worklet below so the stretch tracks
  // the finger with zero lag.
  const coverContainerHeight = useSharedValue(500);
  const coverAnimatedStyle = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    if (pull === 0) {
      return { transform: [{ translateY: 0 }, { scale: 1 }] };
    }
    const scale = 1 + pull / coverContainerHeight.value;
    // Center-anchored scale grows the layer both up and down by pull/2;
    // shifting it up by that same amount cancels the downward half so the
    // bottom edge (where the avatar/name row sits, unscaled, right below)
    // stays put while all the growth goes into filling the gap above.
    return { transform: [{ translateY: -pull / 2 }, { scale }] };
  });

  // The only thing left that still needs the JS thread on every scroll
  // frame — BottomNavBar's shrink-on-scroll lives in a shared hook
  // (useBottomBarScroll, also used by the reels screen) that isn't worth
  // forking just for this. Everything else moved onto the UI thread below.
  const onProfileScroll = (event: any) => {
    onBottomBarScroll(event);
  };

  // Drives headerBgOpacity and miniAvatarProgress directly on the UI thread
  // every scroll frame (zero bridge latency), then hands the event off to
  // the JS-thread onProfileScroll for just the one remaining thing that
  // needs it (bottom bar shrink). The tab bar's own pin no longer needs
  // anything here — see stickyHeaderIndices above.
  const mainScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;

      headerBgOpacity.value = Math.max(0, Math.min(1, y / HEADER_FADE_DISTANCE));
      const avatarTriggerY = avatarContentY.value + AVATAR_SIZE * 0.9 - HEADER_HEIGHT;
      miniAvatarProgress.value = Math.max(
        0,
        Math.min(1, (y - avatarTriggerY) / MINI_AVATAR_REVEAL_DISTANCE),
      );

      runOnJS(onProfileScroll)({ nativeEvent: event });
    },
  });

  const [activeTab, setActiveTab] = useState<
    "images" | "products" | "likes" | "saves" | "comments"
  >("images");

  // Bringing the active tab's full label into view — whether it was tapped
  // or reached by swiping the content — is ProfileTabRow's own job now.

  // Likes/Saves/Comments — only ever shown on your own profile, so these
  // load lazily the first time each tab is opened rather than eagerly like
  // Posts/Marketplace, to avoid three extra queries most visits never need.
  // Seeded from cache below (see the Likes/Saves/Comments cache-key
  // constants and the "Lazy-load" effects further down) so reopening these
  // tabs after the screen has remounted shows the last-known content
  // instantly instead of a blank loading spinner.
  const cachedLikedPosts = currentUser?.id
    ? peekCache<PostWithUser[]>(likedPostsCacheKey(currentUser.id))?.data ?? null
    : null;
  const [likedPosts, setLikedPosts] = useState<PostWithUser[]>(cachedLikedPosts ?? []);
  const [loadingLikedPosts, setLoadingLikedPosts] = useState(false);
  const [likedPostsLoaded, setLikedPostsLoaded] = useState(false);

  const cachedCommentedPosts = currentUser?.id
    ? peekCache<PostWithUser[]>(commentedPostsCacheKey(currentUser.id))?.data ?? null
    : null;
  const [commentedPosts, setCommentedPosts] = useState<PostWithUser[]>(cachedCommentedPosts ?? []);
  const [loadingCommentedPosts, setLoadingCommentedPosts] = useState(false);
  const [commentedPostsLoaded, setCommentedPostsLoaded] = useState(false);

  const cachedSavedItems = currentUser?.id
    ? peekCache<any[]>(savedItemsCacheKey(currentUser.id))?.data ?? null
    : null;
  const [savedItems, setSavedItems] = useState<any[]>(cachedSavedItems ?? []);
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
  const [followRequestsTab, setFollowRequestsTab] = useState<
    "following" | "followers"
  >("following");
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
  // Covers the two gaps that otherwise show nothing happening: "picking" is
  // the wait between tapping a camera/gallery option and the system picker
  // actually appearing, and "saving" is the upload afterwards, before its
  // success/error popup lands. They are separate phases because only the
  // second one may use a native modal — see LoadingOverlay's
  // `presentation` prop and presentSystemPicker in utils/modal.ts.
  const [imageBusy, setImageBusy] = useState<null | "picking" | "saving">(
    null,
  );

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Profile image viewer state
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);
  const [showAvatarStyles, setShowAvatarStyles] = useState(false);
  const [showCoverImageViewer, setShowCoverImageViewer] = useState(false);

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
    coverHue,
    setCoverHue,
    bio,
    namzoedId,
    followerCount,
    setFollowerCount,
    followingCount,
    setFollowingCount,
  } = useProfileData(refreshKey);

  // Per-user cover color identity. The hue lives on the profile row
  // (profiles.cover_hue) — extracted from the cover photo when one is
  // uploaded, random when there isn't one — so the first paint is already
  // the right color instead of settling on it a moment later. Same "dark
  // matte navy" formula either way (see lib/coverTheme.ts), just with a
  // different hue, so it's unique per user without ever looking garish.
  //
  // persistCoverHue is the recovery path for profiles that predate the
  // column: the hook extracts the hue from their existing cover photo once
  // and hands it here to be stored, after which the extraction never runs
  // again for that profile.
  const persistCoverHue = useCallback(
    (hue: number) => {
      const userId = currentUser?.id;
      if (!userId) return;
      setCoverHue(hue);
      updateUserProfile(userId, { cover_hue: hue }).catch((error) =>
        console.error("Failed to save cover gradient hue:", error),
      );
    },
    // setCoverHue is a setState function, stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.id],
  );

  const { header: HEADER_GRADIENT, cover: COVER_GRADIENT, tintRgb } =
    useCoverPalette(currentUser?.id, coverImage, coverHue, persistCoverHue);

  const birthday = birthdayBadge(
    currentUser?.birth_date,
    currentUser?.show_birthday,
    currentUser?.birthday_display,
  );

  // 7-day rolling profile view count
  const profileViewsCacheKey = currentUser?.id ? `profile:views7d:${currentUser.id}` : null;
  const [profileViews7d, setProfileViews7d] = useState<number>(
    () => (profileViewsCacheKey ? peekCache<number>(profileViewsCacheKey)?.data ?? 0 : 0),
  );
  useEffect(() => {
    if (!currentUser?.id) return;
    const key = `profile:views7d:${currentUser.id}`;
    readCache<number>(key).then((cached) => {
      if (cached) setProfileViews7d(cached.data);
    });
    getProfileViewCount7d(currentUser.id)
      .then((count) => {
        setProfileViews7d(count);
        writeCache(key, count);
      })
      .catch(() => {});
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

  // The Marketplace tab shows marketplace listings, not products: products
  // are the shopping catalogue and belong to a verified shop's work profile.
  // See hooks/profile/useUserMarketplace.
  const { marketplaceItems, loadingMarketplace } = useUserMarketplace(
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

  // Lazy-load Likes/Saves/Comments the first time each tab is opened. Each
  // is seeded from cache above (so reopening the tab after the screen has
  // remounted shows the last-known content immediately, not a blank
  // spinner) and writes the fresh result back to cache once this resolves.
  useEffect(() => {
    if (activeTab !== "likes" || likedPostsLoaded || !currentUser?.id) return;
    const userId = currentUser.id;
    if (likedPosts.length === 0) setLoadingLikedPosts(true);
    (async () => {
      const cached = await readCache<PostWithUser[]>(likedPostsCacheKey(userId));
      if (cached) {
        setLikedPosts(cached.data);
        setLoadingLikedPosts(false);
      }
      try {
        const posts = await getUserLikedPosts(userId);
        setLikedPosts(posts);
        setLikedPostsLoaded(true);
        await writeCache(likedPostsCacheKey(userId), posts);
      } finally {
        setLoadingLikedPosts(false);
      }
    })();
  }, [activeTab, likedPostsLoaded, currentUser?.id]);

  useEffect(() => {
    if (activeTab !== "comments" || commentedPostsLoaded || !currentUser?.id) return;
    const userId = currentUser.id;
    if (commentedPosts.length === 0) setLoadingCommentedPosts(true);
    (async () => {
      const cached = await readCache<PostWithUser[]>(commentedPostsCacheKey(userId));
      if (cached) {
        setCommentedPosts(cached.data);
        setLoadingCommentedPosts(false);
      }
      try {
        const posts = await getUserCommentedPosts(userId);
        setCommentedPosts(posts);
        setCommentedPostsLoaded(true);
        await writeCache(commentedPostsCacheKey(userId), posts);
      } finally {
        setLoadingCommentedPosts(false);
      }
    })();
  }, [activeTab, commentedPostsLoaded, currentUser?.id]);

  useEffect(() => {
    if (activeTab !== "saves" || savedItemsLoaded || !currentUser?.id) return;
    const userId = currentUser.id;
    if (savedItems.length === 0) setLoadingSavedItems(true);
    (async () => {
      const cached = await readCache<any[]>(savedItemsCacheKey(userId));
      if (cached) {
        setSavedItems(cached.data);
        setLoadingSavedItems(false);
      }
      try {
        const items = await getUserBookmarks(userId);
        setSavedItems(items as any[]);
        setSavedItemsLoaded(true);
        await writeCache(savedItemsCacheKey(userId), items);
      } finally {
        setLoadingSavedItems(false);
      }
    })();
  }, [activeTab, savedItemsLoaded, currentUser?.id]);

  // (Animation logic for avatar/picker modals removed — using native Modal animations now)

  // Deep-link param from the hamburger drawer (components/modals/HamburgerMenu.tsx)
  // — jump straight to Manage Listings on arrival. Settings itself now lives
  // at its own route (app/(users)/settings/index.tsx).
  useEffect(() => {
    if (openManageListings === "1") {
      router.push("/(users)/listings" as any);
    }
  }, [openManageListings, router]);

  // Close all overlays when navigating away from screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup function runs when screen loses focus
        setShowFollowRequests(false);
        setShowImagePicker(false);
        setPendingImageOption(null);
        setShowMainAvatarMenu(false);
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
  // Listings management is no longer on the Norbu Wallet card (that now
  // opens the wallet screen itself, same as the drawer entry) — this is
  // still what the drawer's ?openManageListings=1 arrival calls.
  const handleManageListings = () => router.push("/(users)/listings" as any);

  // UPDATED: Save Logic
  const handleCropSave = async (croppedUri: string) => {
    if (!currentUser?.id) {
      setImageBusy(null);
      return;
    }

    // 1. Optimistic Update (Immediate UI feedback)
    setProfileImage(croppedUri);
    setShowCropOverlay(false);
    setSelectedImageUri(null);
    setSelectedImageDims(null);
    // Hands over from the inline "picking" indicator to the modal overlay,
    // covering the upload below however this was reached — straight from the
    // iOS picker, or from the crop overlay.
    setImageBusy("saving");

    try {
      // 2. Upload, point the profile at it, and bin the file it replaced
      const publicUrl = await saveAvatarPhoto(
        currentUser.id,
        croppedUri,
        (currentUser as any)?.avatar_url,
      );

      // 3. Update UserContext and AsyncStorage to sync across app
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
    } finally {
      setImageBusy(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setSelectedImageUri(null);
    setSelectedImageDims(null);
    setImageBusy(null);
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

  const openImageOption = async (option: "camera" | "gallery") => {
    // Covers the permission prompt and the picker's own startup — the
    // screen is back to the bare profile by now, with no other sign that
    // anything is coming. "picking" renders inline rather than as a modal,
    // because a native modal here either eats the picker or freezes the
    // app; see LoadingOverlay. It stays up *under* the picker until one of
    // the branches below takes over.
    setImageBusy("picking");
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
        if (!cameraGranted) {
          setImageBusy(null);
          return;
        }
        result = await presentSystemPicker(() =>
          ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: useNativeEditor,
            aspect: [1, 1],
            quality: 1.0,
          }),
        );
      } else {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.", "Permission Denied");
          setImageBusy(null);
          return;
        }
        result = await presentSystemPicker(() =>
          ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: useNativeEditor,
            aspect: [1, 1],
            quality: 1.0,
          }),
        );
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (useNativeEditor) {
          // iOS: use native editor result directly to avoid custom crop overlay
          // modal interactions that can leave touches blocked after camera return.
          // handleCropSave switches imageBusy over to the upload overlay.
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
          // The crop overlay is now the interactive surface — no longer a
          // "nothing's happening" gap.
          setImageBusy(null);
        }
      } else {
        setImageBusy(null); // user canceled the picker
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showErrorPopup("Failed to select image.", "Selection Failed");
      setImageBusy(null);
    }
  };

  // What the profile is wearing: a generated avatar carries its recipe on
  // the row (lib/dicebear.ts), a real photo carries none.
  const avatarStyle = ((currentUser as any)?.avatar_style ?? null) as string | null;
  const avatarAnimation = (((currentUser as any)?.avatar_animation ??
    "none") as AvatarAnimation);
  // The only avatar in the app that plays: one, large, and on your own
  // profile. See components/ui/GeneratedAvatar.tsx for why it is not every
  // avatar.
  const avatarPlays =
    !!avatarStyle && isAnimatedStyle(avatarStyle) && avatarAnimation !== "none";

  const saveGeneratedAvatar = async (
    style: string,
    animation: AvatarAnimation,
  ) => {
    if (!currentUser?.id) return;
    setImageBusy("saving");
    try {
      const patch = generatedAvatarFor(currentUser.id, style, animation);
      await updateUserProfile(currentUser.id, patch);
      const updatedUser = { ...currentUser, ...patch };
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser as any);
      setProfileImage(patch.avatar_url);
      setShowAvatarStyles(false);
      showSuccessPopup("Your avatar has been updated", "Avatar Saved!");
    } catch (error) {
      console.error("Failed to save generated avatar:", error);
      showErrorPopup("Failed to save the avatar. Please try again.", "Save Failed");
    } finally {
      setImageBusy(null);
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
    if (!currentUser?.id) {
      setImageBusy(null);
      return;
    }

    const previousCover = coverImage;
    const previousHue = coverHue;

    // Hands over from the inline "picking" indicator to the modal overlay,
    // covering the hue extraction and upload below.
    setImageBusy("saving");

    // Work the gradient hue out from the local file *before* the upload, so
    // the new cover and its matching gradient appear together — and so the
    // hue can go into the same profile update as the URL below.
    const nextHue = (await extractCoverHue(uri)) ?? previousHue ?? getRandomHue();

    setCoverHue(nextHue);
    setCoverImage(uri);

    try {
      const { url: publicUrl } = await saveCoverPhoto(currentUser.id, uri, {
        previousUrl: previousCover,
        fallbackHue: nextHue,
      });
      setCoverImage(publicUrl);

      const updatedUser = {
        ...currentUser,
        cover_image_url: publicUrl,
        cover_hue: nextHue,
      };
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      showSuccessPopup("Cover photo has been updated.", "Cover Updated!");
    } catch (error) {
      console.error("Failed to save cover image:", error);
      setCoverImage(previousCover);
      setCoverHue(previousHue);
      showErrorPopup("Failed to save cover photo. Please try again.", "Save Failed");
    } finally {
      setImageBusy(null);
    }
  };

  const openCoverImageOption = async (option: "camera" | "gallery") => {
    // See openImageOption's matching comment — inline while the picker is
    // coming up, and handleCoverSave switches it to the modal overlay for
    // the upload.
    setImageBusy("picking");
    try {
      setShowCoverMenu(false);
      let result;
      if (option === "camera") {
        const cameraGranted = await ensureCameraPermission("Camera access is needed.");
        if (!cameraGranted) {
          setImageBusy(null);
          return;
        }
        result = await presentSystemPicker(() =>
          ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [3, 1],
            quality: 1.0,
          }),
        );
      } else {
        const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.", "Permission Denied");
          setImageBusy(null);
          return;
        }
        result = await presentSystemPicker(() =>
          ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [3, 1],
            quality: 1.0,
          }),
        );
      }

      if (!result.canceled && result.assets[0]) {
        await handleCoverSave(result.assets[0].uri);
      } else {
        setImageBusy(null); // user canceled the picker
      }
    } catch (error) {
      console.error("Error picking cover image:", error);
      showErrorPopup("Failed to select image.", "Selection Failed");
      setImageBusy(null);
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

              // No photo left to take a color from, so the profile goes
              // back to a randomly assigned one — stored, so it stays put
              // from here on rather than being re-rolled on every load.
              const nextHue = getRandomHue();
              await updateUserProfile(currentUser.id, {
                cover_image_url: null,
                cover_hue: nextHue,
              });
              setCoverImage(null);
              setCoverHue(nextHue);

              const updatedUser = {
                ...currentUser,
                cover_image_url: null,
                cover_hue: nextHue,
              };
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

              // Removing a photo lands on a generated avatar, not on an
              // empty circle — nobody in this app is a grey silhouette
              // (§ Generated avatars). Keeps whatever style was chosen
              // before, so removing a photo you added over one restores the
              // avatar you had rather than resetting your choice.
              const patch = generatedAvatarFor(
                currentUser.id,
                avatarStyle || undefined,
                avatarAnimation,
              );
              await updateUserProfile(currentUser.id, patch);

              setProfileImage(patch.avatar_url);

              const updatedUser = { ...currentUser, ...patch };
              await AsyncStorage.setItem(
                "currentUser",
                JSON.stringify(updatedUser),
              );
              setCurrentUser(updatedUser as any);

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup(
                "Your photo was replaced with a generated avatar",
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

  // One tab's grid content, by key — pulled out of the carousel JSX so the
  // same body can render whichever of prev/current/next a given slot needs
  // (see the "Tab Content" carousel below and tabSwipeGesture above).
  const renderTabPanel = (
    key: (typeof PROFILE_TAB_ORDER)[number],
  ): React.ReactNode => {
    switch (key) {
      case "images":
        return (
          <MasonryGrid
            items={postThumbnails}
            loading={loadingPosts}
            keyExtractor={(thumb) => thumb.postId}
            getHeight={(thumb, width) => gridCardHeight(postThumbRatio(thumb.post), width)}
            renderCard={(thumb, width, deferred, priority) => (
              <GridCard
                id={thumb.postId}
                width={width}
                ratio={postThumbRatio(thumb.post)}
                imageUri={thumb.thumbnailUrl}
                blurhash={thumb.thumbnailBlurHash ?? undefined}
                isVideo={thumb.isVideo}
                title={thumb.post.content}
                // What the post is selling, in the grid — the same tag the
                // opened post shows at the top, at tile scale.
                belowTitle={
                  <TaggedProductStrip
                    products={(thumb.post as any).tagged_products}
                  />
                }
                avatarUri={profileImage ?? undefined}
                avatarLabel={currentUser.name}
                subtitle={currentUser.name}
                footerRight={
                  <View className="flex-row items-center">
                    <Heart size={15} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400 ml-1">
                      {thumb.post.likes}
                    </Text>
                  </View>
                }
                onPress={(_id, rect) =>
                  openPost(
                    toPostData(thumb.post, {
                      name: currentUser?.name,
                      avatarUrl: (currentUser as any)?.avatar_url,
                    }),
                    rect,
                  )
                }
                deferred={deferred}
                priority={priority}
              />
            )}
            emptyText="Share your first moment"
            emptyAction={
              <TouchableOpacity
                onPress={() => setShowCreatePost(true)}
                className="bg-primary px-5 py-2.5 rounded-full"
              >
                <Text className="text-white text-sm font-semibold">
                  Create a Post
                </Text>
              </TouchableOpacity>
            }
          />
        );

      case "products":
        return (
          <MasonryGrid
            items={marketplaceItems}
            loading={loadingMarketplace}
            keyExtractor={(item) => item.id}
            getHeight={(_item, width) => gridCardHeight(LISTING_CARD_RATIO, width)}
            renderCard={(item, width, deferred, priority) => (
              <GridCard
                id={item.id}
                width={width}
                ratio={LISTING_CARD_RATIO}
                imageUri={item.images?.[0]}
                title={item.title}
                subtitle={MARKETPLACE_TYPE_LABEL[item.type]}
                footerRight={
                  // A free listing says so rather than showing "Nu. 0",
                  // which reads as a missing price.
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
            emptyText="Sell something you no longer need"
            // Your own empty tab wants the screen where you *list*
            // something, not the tab where you browse everyone else's —
            // "Open Marketplace" answered a question nobody asked here.
            emptyAction={
              <TouchableOpacity
                onPress={() =>
                  router.push("/(users)/listings?section=marketplace" as any)
                }
                className="bg-primary px-5 py-2.5 rounded-full"
              >
                <Text className="text-white text-sm font-semibold">
                  List something
                </Text>
              </TouchableOpacity>
            }
          />
        );

      case "likes":
        return (
          <MasonryGrid
            items={toThumbnails(likedPosts)}
            loading={loadingLikedPosts}
            keyExtractor={(thumb) => thumb.postId}
            getHeight={(thumb, width) => gridCardHeight(postThumbRatio(thumb.post), width)}
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
                avatarUri={thumb.post.profiles?.avatar_url ?? undefined}
                avatarLabel={postAuthorName(thumb.post)}
                subtitle={postAuthorName(thumb.post)}
                footerRight={
                  <View className="flex-row items-center">
                    <Heart size={15} color="#e91e63" fill="#e91e63" />
                    <Text className="text-xs text-gray-400 ml-1">
                      {thumb.post.likes}
                    </Text>
                  </View>
                }
                onPress={(_id, rect) => openPost(toPostData(thumb.post), rect)}
                deferred={deferred}
                priority={priority}
              />
            )}
            emptyText="Posts you like will show up here"
            emptyAction={
              <TouchableOpacity
                onPress={() => router.push("/(users)/(tabs)" as any)}
                className="bg-primary px-5 py-2.5 rounded-full"
              >
                <Text className="text-white text-sm font-semibold">
                  Explore Posts
                </Text>
              </TouchableOpacity>
            }
          />
        );

      case "comments":
        return (
          <MasonryGrid
            items={toThumbnails(commentedPosts)}
            loading={loadingCommentedPosts}
            keyExtractor={(thumb) => thumb.postId}
            getHeight={(thumb, width) => gridCardHeight(postThumbRatio(thumb.post), width)}
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
                avatarUri={thumb.post.profiles?.avatar_url ?? undefined}
                avatarLabel={postAuthorName(thumb.post)}
                subtitle={postAuthorName(thumb.post)}
                footerRight={
                  <View className="flex-row items-center">
                    <Heart size={15} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400 ml-1">
                      {thumb.post.likes}
                    </Text>
                  </View>
                }
                onPress={(_id, rect) => openPost(toPostData(thumb.post), rect)}
                deferred={deferred}
                priority={priority}
              />
            )}
            emptyText="Posts you've commented on will show up here"
            emptyAction={
              <TouchableOpacity
                onPress={() => router.push("/(users)/(tabs)" as any)}
                className="bg-primary px-5 py-2.5 rounded-full"
              >
                <Text className="text-white text-sm font-semibold">
                  Explore Posts
                </Text>
              </TouchableOpacity>
            }
          />
        );

      case "saves":
        return (
          <MasonryGrid
            items={savedItems.filter((item) => savedItemInfo(item) !== null)}
            loading={loadingSavedItems}
            keyExtractor={(item) => item.id}
            getHeight={(item, width) => gridCardHeight(savedItemInfo(item)!.ratio, width)}
            renderCard={(item, width, deferred, priority) => {
              const info = savedItemInfo(item)!;
              return (
                <GridCard
                  id={info.id}
                  width={width}
                  ratio={info.ratio}
                  imageUri={info.image}
                  isVideo={info.isVideo}
                  title={info.title}
                  avatarUri={info.authorAvatar}
                  avatarLabel={info.authorName}
                  subtitle={info.authorName}
                  footerRight={
                    info.price != null ? (
                      <Text className="text-sm font-mbold text-primary">
                        Nu. {info.price.toLocaleString()}
                      </Text>
                    ) : undefined
                  }
                  onPress={() => router.push(info.href as any)}
                  deferred={deferred}
                  priority={priority}
                />
              );
            }}
            emptyText="Tap the bookmark icon on any post, product or listing to save it here"
            emptyAction={
              <TouchableOpacity
                onPress={() =>
                  router.push("/(users)/(tabs)/categories" as any)
                }
                className="bg-primary px-5 py-2.5 rounded-full"
              >
                <Text className="text-white text-sm font-semibold">
                  Explore Marketplace
                </Text>
              </TouchableOpacity>
            }
          />
        );

      default:
        return null;
    }
  };

  // Posts/Marketplace/Likes/Saves/Comments row. The row itself lives in
  // components/profile/ProfileTabRow so the work profile uses the same one
  // rather than a second copy that quietly drifts from this.
  const renderTabRow = () => (
    <ProfileTabRow
      tabs={PROFILE_TABS}
      activeKey={activeTab}
      onChange={setActiveTab}
    />
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: "#F0F1F3" }}
      pointerEvents={isFocused ? "auto" : "none"}
    >
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
          // Rounded: the tab bar wrapper below cancels this exact value with
          // a negative margin, and a fractional height (status bars vary by
          // device) let the spacer and that margin round in opposite
          // directions — leaving a hairline of bare cover showing between
          // the bio panel and the buttons' backing below it.
          setHeaderHeight(Math.round(e.nativeEvent.layout.height));
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

            {/* Scan — reads another person's Namzoed code
                (app/(users)/qr-scanner.tsx). Scanning writes nothing on its
                own: it opens a confirmation, and the two of you follow each
                other only once they confirm too. */}
            <TouchableOpacity
              onPress={() => router.push("/qr-scanner" as any)}
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
          // Natively pins direct child index 1 (the tab bar wrapper below)
          // to the ScrollView's own top edge once scrolled up to meet it —
          // see the long comment above the headerHeight declaration for why
          // this replaced a hand-rolled transform, and the tab bar
          // wrapper's own JSX for how it lands
          // flush below the separate fixed header despite pinning to true
          // y=0. Index 0 is the cover container right above it; index 2 is
          // the tab content panel right after.
          stickyHeaderIndices={[1]}
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
              <View
                className="relative overflow-hidden"
                onLayout={(e) => {
                  coverContainerHeight.value = e.nativeEvent.layout.height;
                }}
              >
                {/* Tapping anywhere on the cover that isn't already claimed
                    by a more specific control below (avatar, name, stats,
                    bio, Norbu Wallet/History) opens the full-screen cover
                    viewer — those controls render later/on top in the same
                    outer container and claim their own taps first, so this
                    only fires on the actual empty cover space. The
                    Pressable itself stays a static, unscaled hit target;
                    the stretch-on-overscroll transform lives on the
                    Animated.View inside it instead, so tap bounds don't
                    shift as it zooms. */}
                <Pressable
                  onPress={() => setShowCoverImageViewer(true)}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                >
                <Animated.View style={[{ flex: 1 }, coverAnimatedStyle]}>
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
                </Animated.View>
                </Pressable>

                {/* Profile Info Section — Instagram style. Top padding clears
                    the fixed header row now that the cover renders behind it. */}
                <View className="px-4" style={{ paddingTop: HEADER_HEIGHT + 32 }}>
                  {/* Row: Avatar + Name/Email/Location */}
                  <View className="flex-row items-center mb-1">
                    {/* Avatar — measured on layout so the header's mini
                        avatar knows exactly when this one is ~90% scrolled
                        behind the header (see avatarContentY above). */}
                    <View
                      ref={avatarRef}
                      collapsable={false}
                      className="relative"
                      onLayout={() => {
                        runOnUI(measureAvatarContentY)();
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
                        {avatarPlays ? (
                          // The generated avatar's own SVG, which is where
                          // its animation lives — the raster one every
                          // other surface reads cannot move.
                          <GeneratedAvatar
                            seed={currentUser.id ?? ""}
                            style={avatarStyle}
                            animation={avatarAnimation}
                            size={86}
                          />
                        ) : profileImage ? (
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
                        <Text className="text-3xl font-mbold text-white">
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
                            className="text-sm font-regular text-white/50"
                            numberOfLines={1}
                          >
                            NamZoed ID: {namzoedId}
                          </Text>
                          <QrCode size={14} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      )}
                      {currentUser.dzongkhag && (
                        <View className="flex-row items-center gap-1">
                          <Text className="text-sm font-msemibold text-white/50">
                            GP:
                          </Text>
                          <Text className="text-sm font-regular text-white/50">
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
                <View className="relative overflow-hidden" style={{ marginTop: 4 }}>
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
                        setFollowRequestsTab("followers");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xl font-mbold text-white">
                        {followerCount}
                      </Text>
                      <Text className="text-lg font-medium text-white/70">
                        Followers
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-baseline gap-1"
                      onPress={() => {
                        setFollowRequestsTab("following");
                        setShowFollowRequests(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xl font-mbold text-white">
                        {followingCount}
                      </Text>
                      <Text className="text-lg font-medium text-white/70">
                        Following
                      </Text>
                    </TouchableOpacity>
                    {/* Profile views — private 7-day rolling stat */}
                    {profileViews7d > 0 && (
                      <>
                        <Text className="text-white/40 text-xl font-light">|</Text>
                        <View className="flex-row items-baseline gap-1">
                          <View className="flex-row items-center" style={{ gap: 3 }}>
                            <Eye size={16} color="#fff" />
                            <Text className="text-xl font-mbold text-white">
                              {profileViews7d > 999
                                ? `${(profileViews7d / 1000).toFixed(1)}k`
                                : profileViews7d}
                            </Text>
                          </View>
                          <Text className="text-lg font-medium text-white/70">
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
                      <Text className="text-base font-medium text-white/70">
                        {bio}
                      </Text>
                    ) : (
                      <Text className="text-base font-medium text-white/70 italic">
                        Insert your bio here
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Age / animal year / sun sign — whatever was picked on
                      the Birthday screen, as a pill under the bio. The date
                      itself is never shown, here or on anyone else's
                      profile. */}
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
                    // Pulled up by half a point so this backing and the
                    // gradient panel above it overlap rather than merely
                    // meeting. The panel's gradient ends on exactly this
                    // color, but the two are separate views on a fractional
                    // boundary, and rasterising each to its own edge left a
                    // sub-pixel line of bare cover photo showing between
                    // them. They're the same color, so overlapping costs
                    // nothing visually.
                    marginTop: -SECTION_SEAM_OVERLAP,
                    // Extra bottom padding so the buttons keep clear space
                    // below them even though the tab bar overlaps this
                    // section by 20px (its own corner radius) to blend with
                    // it — without this, that overlap would land right on
                    // the buttons instead of the padding beneath them.
                    paddingBottom: 32,
                  }}
                >
                  {/* Business summary — shown first, above Edit
                      Profile/Manage, to give it top billing when it exists.
                      Only shown once a business name is actually set (every
                      profile auto-gets an empty service_providers row, so a
                      null/empty name means "no business" in practice).
                      Full management (license, service listings) lives on
                      the pushed /profile/work screen; setting one up for the
                      first time is reachable from the hamburger menu instead
                      of a tab, since an unused Work tab was dead weight for
                      anyone without one. */}
                  {currentUser?.id && (
                    <BusinessSummaryCard
                      userId={currentUser.id}
                      providerId={serviceProvider?.id}
                      providerName={serviceProvider?.name}
                      fallbackName={(currentUser as any)?.name}
                      isVerified={verificationStatus === "verified"}
                      onPress={() => router.push("/(users)/profile/work" as any)}
                    />
                  )}

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      onPress={() => router.push("/(users)/norbu-wallet" as any)}
                      className="flex-1 py-[9px] px-3 items-start bg-white/[0.07]"
                    >
                      <View className="flex-row items-center gap-1.5">
                        <Wallet size={16} color="#fff" />
                        <Text className="text-sm font-semibold text-white">
                          Norbu Wallet
                        </Text>
                      </View>
                      <Text className="text-xs font-regular text-white/60 mt-0.5">
                        Manage your balance
                      </Text>
                    </TouchableOpacity>
                    {/* Everything this user has viewed — posts, watched
                        videos, products, services and listings. */}
                    <TouchableOpacity
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      onPress={() => router.push("/(users)/history" as any)}
                      className="flex-1 py-[9px] px-3 items-start bg-white/[0.07]"
                    >
                      <View className="flex-row items-center gap-1.5">
                        <History size={16} color="#fff" />
                        <Text className="text-sm font-semibold text-white">
                          History
                        </Text>
                      </View>
                      <Text className="text-xs font-regular text-white/60 mt-0.5">
                        Everything you've viewed
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Tab Navigation — pinned below the fixed header via the
                  ScrollView's own stickyHeaderIndices (set on
                  Animated.ScrollView above) once scrolled up to meet it,
                  instead of a hand-computed transform. Rounded top corners
                  so it reads as a sheet rising out of the dark cover above,
                  with an internal dark strip (not a reveal-through-clip
                  trick) so the corners read consistently dark whether this
                  sits in its normal in-flow spot or is natively pinned —
                  otherwise, once pinned, the clipped corners would end up
                  showing whatever grid content happens to be scrolling
                  past behind them instead of a stable color. Text-only (no
                  icons); Services moved out entirely, since it now only
                  ever appears via the Work profile summary card above when
                  the user has actually added one.

                  The outer marginTop exactly cancels the spacer's own
                  height right below it — net zero, so normal (unstuck)
                  flow renders identically to not having either. Once
                  natively pinned to the ScrollView's top edge though, that
                  cancellation only affects this wrapper's position *among
                  its siblings*, not the layout *inside* it: the spacer
                  still occupies its full height at the pinned block's own
                  top, landing right behind the separate fixed header above
                  it. That reserved height has to be headerHeight PLUS the
                  inner marginTop:-20 corner-overlap below (not just
                  headerHeight) — the inner wrapper pulls itself up by 20
                  regardless of whether it's sticky or not, so the spacer
                  needs those extra 20 to still land the tab row's actual
                  content flush with the header's bottom edge once pinned,
                  rather than 20px too high into the header. */}
              <View
                style={{
                  marginTop: -(headerHeight + TAB_BAR_CORNER_OVERLAP),
                  zIndex: 10,
                  elevation: 10,
                  // pointerEvents in the STYLE, not as a prop, and that is
                  // load-bearing. This View is the sticky child, and
                  // ScrollViewStickyHeader wraps it in an Animated.View of
                  // its own built from `child.props.style` (re-cloning this
                  // one as flex:1). So the view that actually overlaps the
                  // section above — the band this wrapper is pulled up over,
                  // right where Norbu Wallet / History sit — is RN's
                  // wrapper, not this. A `pointerEvents` *prop* stays on
                  // this inner view and never reaches it, which is why the
                  // buttons stayed dead; in the style object it's copied up
                  // and the wrapper stops swallowing those taps. RN blocks
                  // touches on an overlapping view even with no handler of
                  // its own — they don't fall through to what's behind.
                  pointerEvents: "box-none",
                }}
              >
                {/* Pure spacer — reserves height, takes no touches. */}
                <View
                  pointerEvents="none"
                  style={{ height: headerHeight + TAB_BAR_CORNER_OVERLAP }}
                />
                <View style={{ marginTop: -TAB_BAR_CORNER_OVERLAP }}>
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: TAB_BAR_CORNER_OVERLAP,
                      backgroundColor: `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.95)`,
                    }}
                  />
                  <View
                    style={{
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
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
                </View>
              </View>

              {/* Tab Content — single mounted panel per tab (see
                  renderTabPanel above). */}
              {renderTabPanel(activeTab)}
            </Animated.ScrollView>
      </View>

      {/* Full-screen viewers — opened by tapping the avatar/cover image
          itself. Their "Change ... Photo" card hands off to the existing
          gallery picker directly instead of the Take Photo/Choose
          Gallery/Remove action sheet — that sheet is still reachable via
          the small camera icon (cover) and long-press (avatar). */}
      {/* Android's avatar crop step. iOS uses the picker's own editor
          (see openImageOption), so this is the Android half of that flow —
          without it, picking an avatar on Android set the state and then
          did nothing at all. */}
      {showCropOverlay && selectedImageUri && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="fade"
          visible={showCropOverlay}
          onRequestClose={handleCropCancel}
        >
          <ImageCropOverlay
            imageUri={selectedImageUri}
            imageWidth={selectedImageDims?.width}
            imageHeight={selectedImageDims?.height}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        </Modal>
      )}

      {/* Followers / Following list — same presentation the other-user
          profile uses for it. */}
      {showFollowRequests && currentUser?.id && (
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
              userId={currentUser.id}
              actorUserId={currentUser.id}
              initialTab={followRequestsTab}
            />
          </Animated.View>
        </Modal>
      )}

      {/* Both sources live on the viewer itself — "Choose from Library" /
          "Take a Photo" — rather than a single "Change ..." action that
          always meant the library. */}
      <ProfileImageViewer
        visible={showProfileImageViewer}
        imageUri={profileImage}
        onClose={() => setShowProfileImageViewer(false)}
        onChangePhoto={() => {
          setShowProfileImageViewer(false);
          handleImageOption("gallery");
        }}
        onTakePhoto={() => {
          setShowProfileImageViewer(false);
          handleImageOption("camera");
        }}
        onGeneratedAvatar={() => {
          setShowProfileImageViewer(false);
          setShowAvatarStyles(true);
        }}
      />
      {/* Sixty-one versions of this account's own avatar — see
          components/modals/AvatarStylePicker.tsx. */}
      <AvatarStylePicker
        visible={showAvatarStyles}
        userId={currentUser?.id ?? ""}
        currentStyle={avatarStyle}
        currentAnimation={avatarAnimation}
        saving={imageBusy === "saving"}
        onClose={() => setShowAvatarStyles(false)}
        onSave={saveGeneratedAvatar}
      />
      <CoverImageViewer
        visible={showCoverImageViewer}
        imageUri={coverImage}
        gradientColors={COVER_GRADIENT}
        onClose={() => setShowCoverImageViewer(false)}
        onChangePhoto={() => {
          setShowCoverImageViewer(false);
          handleCoverImageOption("gallery");
        }}
        onTakePhoto={() => {
          setShowCoverImageViewer(false);
          handleCoverImageOption("camera");
        }}
      />

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

                  {/* The third source, beside the two cameras: what this
                      circle shows is one decision, and not owning a photo of
                      yourself is not a reason to have no face. */}
                  <TouchableOpacity
                    style={{ borderRadius: 12, borderCurve: "continuous" }}
                    onPress={() => {
                      setShowMainAvatarMenu(false);
                      setShowAvatarStyles(true);
                    }}
                    className="flex-1 items-center bg-gray-50 py-2"
                  >
                    <Sparkles size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Generated
                    </Text>
                  </TouchableOpacity>

                  {/* Only a real photo can be removed — removing a generated
                      avatar would land on the thing it was there to replace. */}
                  {profileImage && !avatarStyle && (
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

      {/* Covers the gap before the native image picker appears, and the
          upload afterward, before the popups above land — see imageBusy's
          declaration for why the two phases are presented differently. */}
      <PostDetailOverlay {...overlayProps} />

      <LoadingOverlay visible={imageBusy === "saving"} />
      <LoadingOverlay visible={imageBusy === "picking"} presentation="inline" />

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
