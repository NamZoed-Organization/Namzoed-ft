import { MODAL_RADIUS, SWITCH_COLORS } from "@/constants/theme";
import ContentRatingSuggestion from "@/components/ContentRatingSuggestion";
import CreateProductModal from "@/components/modals/CreateProductModal";
import MarketplacePostOverlay from "@/components/modals/MarketplacePostOverlay";
import SellingIntentSuggestion from "@/components/post/SellingIntentSuggestion";
import VerifyToSellNotice from "@/components/VerifyToSellNotice";
import { detectSellingIntent } from "@/lib/sellingIntent";
import { canListProducts } from "@/lib/sellerService";
import FeedAspectReframeOverlay from "@/components/modals/FeedAspectReframeOverlay";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { suggestContentRating } from "@/lib/contentClassifier";
import { moderateImage, stricterRating } from "@/lib/imageModeration";
import { useUser } from "@/contexts/UserContext";
import {
  clampMediaRatio,
  type PostMediaDisplay,
  type PostMediaDisplayMode,
  RATIO_LANDSCAPE,
  RATIO_MAX,
  RATIO_MIN,
  RATIO_PORTRAIT,
  RATIO_SQUARE,
  RATIO_VIDEO_DEFAULT,
  ratioForUniformMode,
  slideHeight,
} from "@/lib/postMediaDisplay";
import { createPost, uploadImages, uploadVideos } from "@/lib/postsService";
import MediaEditor, { type EditorResult } from "@/components/create/media/MediaEditor";
import type { ImageEdit } from "@/lib/mediaEdit";
import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
import { useTutorial } from "@/contexts/TutorialContext";
import { TUTORIAL_SCREENS } from "@/lib/tutorialTours";
import { searchTaggableItems, type TaggableItem } from "@/lib/taggableItems";
import { taggedItemPrice } from "@/utils/price";
import { supabase } from "@/lib/supabase";
import type { ContentRating, TaggedAccount, TaggedProduct } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Crop,
  ImageIcon,
  MapPin,
  Plus,
  Ratio,
  Search,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Video,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48; // leaves 24px on each side so next item peeks

interface MediaItem {
  uri: string;
  type: "image" | "video";
  id: string;
  width?: number;
  height?: number;
  /** Mixed mode: feed width÷height override; omit to use file dimensions. */
  displayRatio?: number;
  /** Content rating implied by this image's Vision scan at selection time.
   *  Set when the image was moderated as it was picked; absent for videos. */
  moderationRating?: ContentRating;
}

function naturalMediaRatio(m: MediaItem): number {
  if (m.width && m.height && m.height > 0) {
    return clampMediaRatio(m.width / m.height);
  }
  return m.type === "video" ? RATIO_VIDEO_DEFAULT : RATIO_PORTRAIT;
}

function ratioPresetLabel(r: number): string {
  const tol = 0.04;
  if (Math.abs(r - RATIO_PORTRAIT) < tol) return "4:5";
  if (Math.abs(r - RATIO_SQUARE) < tol) return "1:1";
  if (Math.abs(r - RATIO_LANDSCAPE) < tol) return "16:9";
  if (Math.abs(r - 9 / 16) < tol) return "9:16";
  return `${r.toFixed(2)} (w÷h)`;
}

/**
 * A file the composer should open with, rather than one somebody picks.
 *
 * Deliberately the same shape `addPickedMedia` already takes, so seeded media
 * goes through the identical path a picked file does — including the Vision
 * scan. A second way in that skipped moderation is exactly the hole a
 * "share to the app" button would otherwise open.
 */
export interface ComposerSeedMedia {
  uri: string;
  type: "image" | "video";
  width?: number;
  height?: number;
}

interface CreatePostProps {
  onClose?: () => void;
  /** Media already on the device — a Setlog export, today. */
  initialMedia?: ComposerSeedMedia[];
  /** A caption to start from. The composer owns it from then on. */
  initialText?: string;
}

export default function CreatePost({
  onClose,
  initialMedia,
  initialText,
}: CreatePostProps) {
  const insets = useSafeAreaInsets();
  /**
   * How much room a `pageSheet` picker needs above its header.
   *
   * These two were spaced with a flat `h-14` (56pt), which is roughly the
   * status bar on a phone that has one — but a `pageSheet` on iOS is
   * *already* inset from the top of the screen and has no status bar of its
   * own, so the spacer was 56pt of nothing above the title. On Android the
   * presentation style is ignored and the modal is full-screen, where the
   * inset is real. Asking for the inset gets both right and neither wrong.
   */
  const sheetTopInset = Math.max(insets.top, 12);

  // The composer teaches itself the first time it is opened — on the real
  // fields, in the order they are used (lib/tutorialTours.ts).
  const { arrive, notify } = useTutorial();
  useEffect(() => {
    arrive(TUTORIAL_SCREENS.CREATE_POST);
  }, [arrive]);

  const router = useAppRouter();
  const { currentUser } = useUser();
  const [postText, setPostText] = useState(initialText ?? "");
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  /**
   * The editor's work, kept beside the pictures rather than inside them.
   *
   * `original` is the file that was picked and is never overwritten, so
   * reopening the editor shows the crop and the filter where they were left
   * instead of starting again from an already-flattened copy. The item's own
   * `uri` is the rendered result — that is what uploads.
   */
  const [mediaEdits, setMediaEdits] = useState<
    Record<string, { original: string; edit: ImageEdit }>
  >({});
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaAspectMode, setMediaAspectMode] =
    useState<PostMediaDisplayMode>("portrait");
  const [isUploading, setIsUploading] = useState(false);
  // True while a freshly-picked image is being scanned by Vision before it is
  // allowed into the preview.
  const [isScanningMedia, setIsScanningMedia] = useState(false);

  const [addPostLocation, setAddPostLocation] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);

  // Product tagging
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [taggableItems, setTaggableItems] = useState<TaggableItem[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [taggedProducts, setTaggedProducts] = useState<TaggedProduct[]>([]);

  // Account tagging
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountResults, setAccountResults] = useState<
    Array<{ id: string; name: string; avatar_url: string | null }>
  >([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);
  const [taggedAccounts, setTaggedAccounts] = useState<TaggedAccount[]>([]);

  // Media picker
  const [showMediaSourceModal, setShowMediaSourceModal] = useState(false);

  // Popups
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState("");
  const [successTitle, setSuccessTitle] = useState("");

  // Active media preview index (for carousel indicator)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [frameAdjustMediaId, setFrameAdjustMediaId] = useState<string | null>(
    null,
  );
  const [draftFrameRatio, setDraftFrameRatio] = useState(RATIO_PORTRAIT);
  const [reframeMediaId, setReframeMediaId] = useState<string | null>(null);
  const [reframeAspectOverride, setReframeAspectOverride] = useState<
    number | null
  >(null);
  const [showLocationPermissionPopup, setShowLocationPermissionPopup] =
    useState(false);

  // ── "This looks like a listing" ──────────────────────────────────────
  // A post selling something scrolls past once; the same thing as a listing
  // keeps its price and stays findable. See lib/sellingIntent.ts — it
  // suggests, it never redirects.
  const [sellingDismissed, setSellingDismissed] = useState(false);
  const [canSell, setCanSell] = useState<boolean | null>(null);
  const [showMarketplaceForm, setShowMarketplaceForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);

  const sellingIntent = React.useMemo(
    // A post that already tags a product is pointing at a listing; it does
    // not need to be told to make one.
    () =>
      taggedProducts.length > 0 ? null : detectSellingIntent(postText),
    [postText, taggedProducts.length],
  );

  // Asked only once, and only once there is something to ask about — every
  // composer opening does not need a shop lookup.
  const sellerId = (currentUser as any)?.id as string | undefined;
  useEffect(() => {
    if (!sellingIntent || !sellerId || canSell !== null) return;
    let alive = true;
    canListProducts(sellerId)
      .then((allowed) => alive && setCanSell(allowed))
      .catch(() => alive && setCanSell(false));
    return () => {
      alive = false;
    };
  }, [sellingIntent, sellerId, canSell]);

  /** The draft, in the shape a listing form wants: a title out of the first
   *  line, the whole thing as the description. */
  const draftTitle = postText.trim().split("\n")[0].slice(0, 60);

  // Content moderation
  const [contentRating, setContentRating] = useState<ContentRating>("general");
  const suggestion = React.useMemo(() => {
    return suggestContentRating(
      postText,
      undefined,
      taggedProducts.map((p) => p.name),
    );
  }, [postText, taggedProducts]);

  useEffect(() => {
    // If auto-detection finds sensitive content and user hasn't changed it from general, update it
    if (suggestion.suggested !== "general" && contentRating === "general") {
      setContentRating(suggestion.suggested);
    }
  }, [suggestion.suggested]);

  useEffect(() => {
    setActiveMediaIndex((i) =>
      postMedia.length === 0 ? 0 : Math.min(i, postMedia.length - 1),
    );
  }, [postMedia.length]);

  useEffect(() => {
    if (
      frameAdjustMediaId &&
      !postMedia.some((m) => m.id === frameAdjustMediaId)
    ) {
      setFrameAdjustMediaId(null);
    }
  }, [postMedia, frameAdjustMediaId]);

  useEffect(() => {
    if (reframeMediaId && !postMedia.some((m) => m.id === reframeMediaId)) {
      setReframeMediaId(null);
      setReframeAspectOverride(null);
    }
  }, [postMedia, reframeMediaId]);

  useEffect(() => {
    if (!frameAdjustMediaId) return;
    const item = postMedia.find((m) => m.id === frameAdjustMediaId);
    if (!item) return;
    setDraftFrameRatio(
      clampMediaRatio(item.displayRatio ?? naturalMediaRatio(item)),
    );
  }, [frameAdjustMediaId, postMedia]);

  const userId = (currentUser as any)?.id;
  const username =
    (currentUser as any)?.username || (currentUser as any)?.name || "User";
  const avatarUrl =
    (currentUser as any)?.avatar_url || (currentUser as any)?.profileImg;

  const showErrorPopup = (message: string, title: string = "Error") => {
    setErrorMessage(message);
    setErrorTitle(title);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (
    message: string,
    title: string = "Success",
    callback?: () => void,
  ) => {
    setSuccessMessage(message);
    setSuccessTitle(title);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      callback?.();
    }, 2000);
  };

  const genMediaId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Scan freshly-picked assets with Google Vision BEFORE they enter the
   * preview. Blocked images (nudity, drugs, tobacco, sex/adult toys) are
   * rejected with a message and never added; legal-but-mature images are added
   * but flagged 18+ so the post rating is bumped. Videos bypass image scanning.
   */
  const addPickedMedia = async (
    assets: {
      uri: string;
      type: "image" | "video";
      width?: number;
      height?: number;
    }[],
  ) => {
    const imageAssets = assets.filter((a) => a.type === "image");
    let results: Awaited<ReturnType<typeof moderateImage>>[] = [];

    if (imageAssets.length > 0) {
      setIsScanningMedia(true);
      try {
        results = await Promise.all(
          imageAssets.map((a) => moderateImage(a.uri)),
        );
      } finally {
        setIsScanningMedia(false);
      }
    }

    const resultByUri = new Map(
      imageAssets.map((a, i) => [a.uri, results[i]]),
    );

    const accepted: MediaItem[] = [];
    const blockedReasons: string[] = [];

    for (const a of assets) {
      if (a.type === "video") {
        accepted.push({
          uri: a.uri,
          type: "video",
          id: genMediaId(),
          width: a.width,
          height: a.height,
        });
        continue;
      }
      const r = resultByUri.get(a.uri);
      if (r?.decision === "block") {
        const reason =
          r.reason ||
          "This image can't be posted because it contains disallowed content.";
        if (!blockedReasons.includes(reason)) blockedReasons.push(reason);
        continue;
      }
      accepted.push({
        uri: a.uri,
        type: "image",
        id: genMediaId(),
        width: a.width,
        height: a.height,
        moderationRating: r?.decision === "age_restrict" ? "18_plus" : "general",
      });
    }

    if (accepted.length > 0) {
      setPostMedia((prev) => [...prev, ...accepted].slice(0, 10));
      // The composer's first step ends when a picture is actually chosen.
      notify("post.media-picked");
      const strictest = accepted.reduce<ContentRating>(
        (acc, m) =>
          m.moderationRating ? stricterRating(acc, m.moderationRating) : acc,
        "general",
      );
      if (strictest !== "general") {
        setContentRating((prev) => stricterRating(prev, strictest));
      }
    }

    if (blockedReasons.length > 0) {
      showErrorPopup(blockedReasons[0], "Image Blocked");
    }
  };

  /**
   * Anything handed in at open time goes through the picker's own path.
   *
   * Once, guarded by a ref rather than by an empty dependency list: the
   * caller passes a fresh array literal each render, so depending on
   * `initialMedia` would re-add the file on every keystroke in the caption.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !initialMedia?.length) return;
    seeded.current = true;
    void addPickedMedia(initialMedia);
    // addPickedMedia is redefined every render and adding it here would make
    // this effect re-run; the ref above is what actually guards it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMedia]);

  // --- Unified media picker ---
  const pickMediaFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showErrorPopup(
          "Photo library access is needed to select media.",
          "Permission Denied",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 10 - postMedia.length,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets.length > 0) {
        await addPickedMedia(
          result.assets.map((asset) => ({
            uri: asset.uri,
            type: asset.type === "video" ? "video" : ("image" as const),
            width: asset.width ?? undefined,
            height: asset.height ?? undefined,
          })),
        );
      }
    } catch (error) {
      console.error("Error picking media from gallery:", error);
    }
  };

  const pickMediaFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showErrorPopup("Camera access is needed.", "Permission Denied");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await addPickedMedia([
          {
            uri: asset.uri,
            type: asset.type === "video" ? "video" : ("image" as const),
            width: asset.width ?? undefined,
            height: asset.height ?? undefined,
          },
        ]);
      }
    } catch (error) {
      console.error("Error from camera:", error);
    }
  };

  const removeMedia = (id: string) => {
    setPostMedia((prev) => prev.filter((item) => item.id !== id));
  };

  const formatAddressFromGeo = (
    geo: Location.LocationGeocodedAddress | undefined,
    coords: { latitude: number; longitude: number },
  ): string => {
    if (!geo) {
      return `${coords.latitude.toFixed(3)}°, ${coords.longitude.toFixed(3)}°`;
    }
    const parts = [
      geo.name,
      geo.street,
      geo.district,
      geo.city,
      geo.subregion,
      geo.region,
      geo.country,
    ].filter((p): p is string => Boolean(p && String(p).trim()));
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const p of parts) {
      const k = p.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(p.trim());
      }
    }
    return (
      uniq.slice(0, 4).join(", ") ||
      `${coords.latitude.toFixed(3)}°, ${coords.longitude.toFixed(3)}°`
    );
  };

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setResolvingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setShowLocationPermissionPopup(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const label = formatAddressFromGeo(results[0], pos.coords);
      setLocationLabel(label);
      setLocationCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setAddPostLocation(true);
    } catch {
      showErrorPopup(
        "Could not read your location. Try typing a place instead.",
        "Location",
      );
    } finally {
      setResolvingLocation(false);
    }
  }, []);

  // --- Product and service tagging ---
  // Anything in the app, not only your own: a post about somebody's shop is
  // worth more to that shop than a post by it, and the seller gets an
  // audience they do not have to own (see lib/taggableItems.ts).
  const loadTaggableItems = useCallback(async (query: string) => {
    setLoadingProducts(true);
    try {
      setTaggableItems(await searchTaggableItems(query));
    } catch {
      showErrorPopup("Couldn't load products and services.", "Load Failed");
      setTaggableItems([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Debounced, because every keystroke is two queries otherwise. Runs on an
  // empty query too — the blank picker shows the newest of both kinds rather
  // than nothing, since somebody tagging a thing they just saw should not
  // have to know its name to find it.
  useEffect(() => {
    if (!showProductPicker) return;
    const t = setTimeout(() => loadTaggableItems(productQuery), 220);
    return () => clearTimeout(t);
  }, [showProductPicker, productQuery, loadTaggableItems]);

  const toggleProduct = (item: TaggableItem) => {
    setTaggedProducts((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      if (exists) {
        return prev.filter((p) => p.id !== item.id);
      }
      if (prev.length >= 5) {
        showErrorPopup(
          "You can tag up to 5 items per post.",
          "Limit Reached",
        );
        return prev;
      }
      return [
        ...prev,
        {
          id: item.id,
          kind: item.kind,
          name: item.name,
          price: item.price,
          image: item.image,
          current_price: item.currentPrice,
          is_currently_active: item.discountActive,
          discount_percent: item.discountPercent,
          owner_id: item.ownerId,
          owner_name: item.ownerName,
        },
      ];
    });
  };

  const removeTaggedProduct = (id: string) => {
    setTaggedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // --- Account tagging ---
  const searchAccounts = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setAccountResults([]);
        return;
      }
      setSearchingAccounts(true);
      try {
        const pattern = `%${query}%`;
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .or(`name.ilike.${pattern}`)
          .not("id", "eq", userId ?? "")
          .limit(10);

        if (!error && data) {
          setAccountResults(
            data.map((u: any) => ({
              id: u.id,
              name: u.name || "Unknown",
              avatar_url: u.avatar_url,
            })),
          );
        }
      } catch {
        // silent
      } finally {
        setSearchingAccounts(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchAccounts(accountSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [accountSearch, searchAccounts]);

  const toggleAccount = (account: {
    id: string;
    name: string;
    avatar_url: string | null;
  }) => {
    setTaggedAccounts((prev) => {
      const exists = prev.find((a) => a.id === account.id);
      if (exists) {
        return prev.filter((a) => a.id !== account.id);
      }
      if (prev.length >= 10) {
        showErrorPopup(
          "You can tag up to 10 accounts per post.",
          "Limit Reached",
        );
        return prev;
      }
      return [
        ...prev,
        {
          id: account.id,
          name: account.name,
          avatar_url: account.avatar_url,
        },
      ];
    });
  };

  const removeTaggedAccount = (id: string) => {
    setTaggedAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  // --- Share Post ---
  const handleSharePost = async () => {
    if (!currentUser) {
      showErrorPopup(
        "You must be logged in to create a post",
        "Login Required",
      );
      return;
    }
    if (!userId) {
      showErrorPopup(
        "User information is incomplete. Please log in again.",
        "Invalid User",
      );
      return;
    }
    if (!postText.trim() && postMedia.length === 0) {
      showErrorPopup(
        "Please add some text or media to your post",
        "Empty Post",
      );
      return;
    }

    try {
      setIsUploading(true);

      const imageUris = postMedia
        .filter((item) => item.type === "image")
        .map((item) => item.uri);
      const videoUris = postMedia
        .filter((item) => item.type === "video")
        .map((item) => item.uri);
      let uploadedMediaUrls: string[] = [];

      // Images were already scanned by Vision at selection time (blocked images
      // never made it into the preview). Aggregate the strictest rating those
      // scans implied so a legal-but-mature image keeps the post at 18+.
      let effectiveRating = contentRating;
      for (const m of postMedia) {
        if (m.type === "image" && m.moderationRating) {
          effectiveRating = stricterRating(effectiveRating, m.moderationRating);
        }
      }

      if (imageUris.length > 0) {
        try {
          // skipModeration: Vision already scanned these images above.
          const urls = await uploadImages(imageUris, true);
          uploadedMediaUrls.push(...urls);
        } catch (err: any) {
          showErrorPopup(
            `Failed to upload images: ${err.message || err}`,
            "Upload Failed",
          );
          return;
        }
      }

      if (videoUris.length > 0) {
        try {
          const urls = await uploadVideos(videoUris);
          uploadedMediaUrls.push(...urls);
        } catch (err: any) {
          showErrorPopup(
            `Failed to upload videos: ${err.message || err}`,
            "Upload Failed",
          );
          return;
        }
      }

      const imageItems = postMedia.filter((m) => m.type === "image");
      const videoItems = postMedia.filter((m) => m.type === "video");
      let mediaDisplay: PostMediaDisplay | undefined;
      if (uploadedMediaUrls.length > 0) {
        if (mediaAspectMode === "mixed") {
          const ratios = [
            ...imageItems.map((m) =>
              clampMediaRatio(m.displayRatio ?? naturalMediaRatio(m)),
            ),
            ...videoItems.map((m) =>
              clampMediaRatio(m.displayRatio ?? naturalMediaRatio(m)),
            ),
          ];
          mediaDisplay = { mode: "mixed", ratios };
        } else {
          mediaDisplay = { mode: mediaAspectMode };
        }
      }

      const trimmedLocation =
        addPostLocation && locationLabel.trim() ? locationLabel.trim() : "";

      try {
        await createPost({
          content: postText.trim(),
          images: uploadedMediaUrls,
          userId,
          mediaDisplay,
          contentRating: effectiveRating,
          tagged_products:
            taggedProducts.length > 0 ? taggedProducts : undefined,
          tagged_accounts:
            taggedAccounts.length > 0 ? taggedAccounts : undefined,
          locationName: trimmedLocation || undefined,
          locationLat:
            trimmedLocation && locationCoords ? locationCoords.lat : undefined,
          locationLng:
            trimmedLocation && locationCoords ? locationCoords.lng : undefined,
        });
        showSuccessPopup("Your post has been published!", "Posted!", () => {
          setPostText("");
          setPostMedia([]);
          setMediaAspectMode("portrait");
          setTaggedProducts([]);
          setTaggedAccounts([]);
          setAddPostLocation(false);
          setLocationLabel("");
          setLocationCoords(null);
          setContentRating("general");
          setFrameAdjustMediaId(null);
          setReframeMediaId(null);
          setReframeAspectOverride(null);
          onClose?.();
        });
      } catch (err: any) {
        showErrorPopup(
          `Failed to create post: ${err.message || err}`,
          "Post Failed",
        );
      }
    } catch (err: any) {
      showErrorPopup(
        `An unexpected error occurred: ${err.message || err}`,
        "Error",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const canShare = postText.trim().length > 0 || postMedia.length > 0;

  const previewWidth = SCREEN_WIDTH - 32;
  const previewIdx =
    postMedia.length === 0
      ? 0
      : Math.min(activeMediaIndex, postMedia.length - 1);
  const previewItem =
    postMedia.length > 0 ? (postMedia[previewIdx] ?? null) : null;
  const previewFrameRatio =
    previewItem == null
      ? RATIO_PORTRAIT
      : mediaAspectMode === "mixed"
        ? clampMediaRatio(
            previewItem.displayRatio ?? naturalMediaRatio(previewItem),
          )
        : ratioForUniformMode(mediaAspectMode);
  const previewHeight = slideHeight(previewWidth, previewFrameRatio);

  const reframeItem = reframeMediaId
    ? (postMedia.find((m) => m.id === reframeMediaId) ?? null)
    : null;

  const reframeAspectForOverlay = reframeItem
    ? clampMediaRatio(
        reframeAspectOverride ??
          (mediaAspectMode === "mixed"
            ? (reframeItem.displayRatio ?? naturalMediaRatio(reframeItem))
            : ratioForUniformMode(mediaAspectMode)),
      )
    : RATIO_PORTRAIT;

  const frameAdjustItem = frameAdjustMediaId
    ? (postMedia.find((m) => m.id === frameAdjustMediaId) ?? null)
    : null;

  // --- Render ---
  return (
    <View className="flex-1 bg-white">
      {/* Presented in its own Modal window, so the root overlay cannot
          reach it — the tour draws from here while the composer is open. */}
      <TutorialOverlay hostId="create-post" />
      {/* The real inset rather than a flat 56 — this is presented
          full-screen, so it is the status bar's own height that matters
          and it is not the same on every phone. */}
      <View style={{ height: insets.top, backgroundColor: "#fff" }} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => (onClose ? onClose() : router.back())}
          disabled={isUploading}
          className="p-1"
        >
          <X size={24} color={isUploading ? "#ccc" : "#111"} />
        </TouchableOpacity>

        <Text className="text-lg font-bold text-gray-900">New Post</Text>

        <TutorialAnchor id="post.share" radius={999}>
        <TouchableOpacity
          onPress={handleSharePost}
          disabled={isUploading || !canShare}
          className={`px-5 py-2 rounded-full ${
            canShare && !isUploading ? "bg-primary" : "bg-gray-200"
          }`}
        >
          {isUploading ? (
            <CircularLoader size="small" color="#fff" />
          ) : (
            <Text
              className={`font-semibold text-sm ${
                canShare ? "text-white" : "text-gray-400"
              }`}
            >
              Share
            </Text>
          )}
        </TouchableOpacity>
        </TutorialAnchor>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* User row */}
          <View className="flex-row items-center px-4 pt-4 pb-2">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-10 h-10 rounded-full bg-gray-200"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                <Text className="text-white font-bold text-base">
                  {username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="ml-3 text-base font-semibold text-gray-900">
              {username}
            </Text>
          </View>

          {/* Caption */}
          <TutorialAnchor id="post.caption" radius={12}>
          <TextInput
            style={{
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 8,
              fontSize: 15,
              color: "#1f2937",
              minHeight: 80,
              textAlignVertical: "top",
            }}
            placeholder="Write a caption..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={postText}
            onChangeText={setPostText}
          />
          </TutorialAnchor>

          {/* Selling? Offer the surfaces built for it (§ Shopping vs
              marketplace). Under the caption, because it is a reaction to
              what was just typed. */}
          {sellingIntent && !sellingDismissed && (
            <View style={{ marginHorizontal: 16, marginTop: 10 }}>
              <SellingIntentSuggestion
                intent={sellingIntent}
                canListProducts={canSell}
                onDismiss={() => setSellingDismissed(true)}
                onListProduct={() => setShowProductForm(true)}
                onListMarketplace={() => setShowMarketplaceForm(true)}
                onExplainVerification={() => setShowVerifyNotice(true)}
              />
            </View>
          )}

          {/* Content rating suggestion */}
          {suggestion.suggested !== "general" && (
            <View
              style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 12 }}
            >
              <ContentRatingSuggestion
                suggestion={suggestion}
                selectedRating={contentRating}
                onRatingChange={setContentRating}
                showProminent={suggestion.confidence === "high"}
              />
            </View>
          )}

          {/* Location (optional) */}
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <MapPin size={18} color="#094569" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Add location
                </Text>
              </View>
              <Switch
                value={addPostLocation}
                onValueChange={(v) => {
                  setAddPostLocation(v);
                  if (!v) {
                    setLocationLabel("");
                    setLocationCoords(null);
                  }
                }}
                trackColor={{ false: SWITCH_COLORS.trackOff, true: SWITCH_COLORS.trackOn }}
                thumbColor={SWITCH_COLORS.thumb}
                ios_backgroundColor={SWITCH_COLORS.trackOff}
              />
            </View>
            {addPostLocation && (
              <View style={{ marginTop: 10 }}>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 12,
                    borderCurve: "continuous",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: "#1f2937",
                    backgroundColor: "#fafafa",
                  }}
                  placeholder="Type a place, city, or address"
                  placeholderTextColor="#9ca3af"
                  value={locationLabel}
                  onChangeText={(t) => {
                    setLocationLabel(t);
                    setLocationCoords(null);
                  }}
                />
                <TouchableOpacity
                  onPress={handleUseCurrentLocation}
                  disabled={resolvingLocation}
                  activeOpacity={0.85}
                  style={{
                    marginTop: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    borderWidth: 1.5,
                    borderColor: "#094569",
                    opacity: resolvingLocation ? 0.7 : 1,
                  }}
                >
                  {resolvingLocation ? (
                    <CircularLoader size="small" color="#094569" />
                  ) : (
                    <>
                      <MapPin size={16} color="#094569" />
                      <Text
                        style={{
                          fontWeight: "700",
                          color: "#094569",
                          fontSize: 14,
                        }}
                      >
                        Use current location
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 6,
                  }}
                >
                  Your location appears next to the time on the post and
                  switches every few seconds.
                </Text>
              </View>
            )}
          </View>

          {/* Feed frame (Instagram-style) — applies to published post */}
          {postMedia.length > 0 && (
            <View style={{ marginHorizontal: 16, marginTop: 14 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                Feed layout
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    { mode: "portrait" as const, label: "Portrait 4:5" },
                    { mode: "square" as const, label: "Square" },
                    { mode: "landscape" as const, label: "Wide 16:9" },
                    { mode: "mixed" as const, label: "Mixed" },
                  ] as const
                ).map(({ mode, label }) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setMediaAspectMode(mode)}
                    activeOpacity={0.85}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderCurve: "continuous",
                      backgroundColor:
                        mediaAspectMode === mode ? "#094569" : "#f3f4f6",
                      borderWidth: 1,
                      borderColor:
                        mediaAspectMode === mode ? "#094569" : "#e5e7eb",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: mediaAspectMode === mode ? "#fff" : "#374151",
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {mediaAspectMode === "mixed" && (
                <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                  Set each slide&apos;s frame below, or use Crop to zoom inside
                  the frame (photos only).
                </Text>
              )}
            </View>
          )}

          {previewItem && (
            <View style={{ marginHorizontal: 16, marginTop: 16 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#6b7280",
                  marginBottom: 8,
                }}
              >
                Feed preview
                {postMedia.length > 1
                  ? ` · Slide ${previewIdx + 1} of ${postMedia.length}`
                  : ""}
              </Text>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "#f9fafb",
                  borderRadius: 14,
                  borderCurve: "continuous",
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              >
                <View
                  style={{
                    width: previewWidth,
                    height: previewHeight,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 10,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {previewItem.type === "video" ? (
                    <View
                      style={{
                        width: previewWidth,
                        height: previewHeight,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#e5e7eb",
                      }}
                    >
                      <Video size={40} color="#64748b" />
                      <Text
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          fontWeight: "600",
                          color: "#64748b",
                        }}
                      >
                        Video · frame matches feed
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: previewItem.uri }}
                      style={{ width: previewWidth, height: previewHeight }}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "#9ca3af",
                    textAlign: "center",
                  }}
                >
                  Matches feed · {ratioPresetLabel(previewFrameRatio)}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  {mediaAspectMode === "mixed" && (
                    <TouchableOpacity
                      onPress={() => setFrameAdjustMediaId(previewItem.id)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 22,
                        borderCurve: "continuous",
                        backgroundColor: "#094569",
                      }}
                    >
                      <Ratio size={16} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        Frame & ratio
                      </Text>
                    </TouchableOpacity>
                  )}
                  {previewItem.type === "image" && (
                    <TouchableOpacity
                      onPress={() => {
                        setReframeAspectOverride(null);
                        setReframeMediaId(previewItem.id);
                      }}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 22,
                        borderCurve: "continuous",
                        backgroundColor: "#1f2937",
                      }}
                    >
                      <Crop size={16} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        Crop & position
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* The editor proper: crop, filters, adjustments, words
                      on the picture, and tags pinned to the thing itself
                      (components/create/media/MediaEditor.tsx). The two
                      buttons beside it are its narrow cases — how a picture
                      sits in the feed's frame — so it leads them. */}
                  {previewItem.type === "image" && (
                    <TouchableOpacity
                      onPress={() => setEditingMediaId(previewItem.id)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 22,
                        borderCurve: "continuous",
                        backgroundColor: "#EDC06D",
                      }}
                    >
                      <Sparkles size={16} color="#0A0A0A" />
                      <Text
                        style={{
                          color: "#0A0A0A",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        {mediaEdits[previewItem.id] ? "Edited" : "Edit picture"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {mediaAspectMode !== "mixed" &&
                  previewItem.type === "image" && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#9ca3af",
                        marginTop: 8,
                        textAlign: "center",
                        paddingHorizontal: 12,
                      }}
                    >
                      Crop uses your selected layout (
                      {ratioPresetLabel(ratioForUniformMode(mediaAspectMode))}
                      ).
                    </Text>
                  )}
              </View>
            </View>
          )}

          {/* ── 3-Column Action Row ── */}
          <View
            style={{
              flexDirection: "row",
              marginHorizontal: 16,
              marginTop: 16,
              gap: 10,
            }}
          >
            {/* Media */}
            <TutorialAnchor id="post.media" radius={16} style={{ flex: 1 }}>
            <TouchableOpacity
              onPress={() => setShowMediaSourceModal(true)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: postMedia.length > 0 ? "#bfdbfe" : "#e5e7eb",
                borderStyle: "dashed",
                borderRadius: 16,
                borderCurve: "continuous",
                paddingVertical: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: postMedia.length > 0 ? "#eff6ff" : "#f9fafb",
              }}
            >
              {postMedia.length > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: "#3b82f6",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{ fontSize: 10, fontWeight: "700", color: "white" }}
                  >
                    {postMedia.length}
                  </Text>
                </View>
              )}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor: postMedia.length > 0 ? "#dbeafe" : "#eff6ff",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <ImageIcon size={22} color="#3b82f6" />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: postMedia.length > 0 ? "#1d4ed8" : "#6b7280",
                }}
              >
                Media
              </Text>
            </TouchableOpacity>
            </TutorialAnchor>

            {/* Products */}
            <TutorialAnchor id="post.tag" radius={16} style={{ flex: 1 }}>
            <TouchableOpacity
              onPress={() => {
                setShowProductPicker(true);
              }}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: taggedProducts.length > 0 ? "#bfdbfe" : "#e5e7eb",
                borderStyle: "dashed",
                borderRadius: 16,
                borderCurve: "continuous",
                paddingVertical: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  taggedProducts.length > 0 ? "#f0f7ff" : "#f9fafb",
              }}
            >
              {taggedProducts.length > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: "#094569",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{ fontSize: 10, fontWeight: "700", color: "white" }}
                  >
                    {taggedProducts.length}
                  </Text>
                </View>
              )}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor:
                    taggedProducts.length > 0 ? "#dbeafe" : "#eff6ff",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <ShoppingBag size={22} color="#094569" />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: taggedProducts.length > 0 ? "#094569" : "#6b7280",
                }}
              >
                Products
              </Text>
            </TouchableOpacity>
            </TutorialAnchor>

            {/* Tag People */}
            <TouchableOpacity
              onPress={() => setShowAccountPicker(true)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: taggedAccounts.length > 0 ? "#c7d2fe" : "#e5e7eb",
                borderStyle: "dashed",
                borderRadius: 16,
                borderCurve: "continuous",
                paddingVertical: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  taggedAccounts.length > 0 ? "#eef2ff" : "#f9fafb",
              }}
            >
              {taggedAccounts.length > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: "#6366f1",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{ fontSize: 10, fontWeight: "700", color: "white" }}
                  >
                    {taggedAccounts.length}
                  </Text>
                </View>
              )}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor:
                    taggedAccounts.length > 0 ? "#e0e7ff" : "#eef2ff",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <UserPlus size={22} color="#6366f1" />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: taggedAccounts.length > 0 ? "#4f46e5" : "#6b7280",
                }}
              >
                People
              </Text>
            </TouchableOpacity>
          </View>

          {/* Media filled — peeking carousel */}
          {postMedia.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <FlatList
                data={[
                  ...postMedia,
                  { id: "__add__", uri: "", type: "add" as any },
                ]}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 10}
                decelerationRate="fast"
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / (CARD_WIDTH + 10),
                  );
                  setActiveMediaIndex(Math.min(idx, postMedia.length - 1));
                }}
                renderItem={({ item, index }) => {
                  if (item.id === "__add__" && postMedia.length < 10) {
                    return (
                      <TouchableOpacity
                        onPress={() => setShowMediaSourceModal(true)}
                        activeOpacity={0.8}
                        style={{
                          width: CARD_WIDTH,
                          height: CARD_WIDTH * 0.75,
                          borderRadius: 18,
                          borderCurve: "continuous",
                          borderWidth: 1.5,
                          borderColor: "#e5e7eb",
                          borderStyle: "dashed",
                          backgroundColor: "#f9fafb",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            borderCurve: "continuous",
                            backgroundColor: "#eff6ff",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 8,
                          }}
                        >
                          <Plus size={22} color="#3b82f6" />
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#6b7280",
                          }}
                        >
                          Add more
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  if (item.id === "__add__") return null;
                  return (
                    <View
                      style={{
                        width: CARD_WIDTH,
                        height: CARD_WIDTH * 0.75,
                        borderRadius: 18,
                        borderCurve: "continuous",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        source={{ uri: item.uri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.55)"]}
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 56,
                          justifyContent: "flex-end",
                          paddingHorizontal: 12,
                          paddingBottom: 10,
                          flexDirection: "row",
                          alignItems: "flex-end",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: "rgba(255,255,255,0.22)",
                            borderRadius: 12,
                            borderCurve: "continuous",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.3)",
                          }}
                        >
                          <Text
                            style={{
                              color: "white",
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            {index + 1} / {postMedia.length}
                          </Text>
                        </View>
                      </LinearGradient>
                      {item.type === "video" && (
                        <View
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            marginTop: -28,
                            marginLeft: -28,
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            borderCurve: "continuous",
                            backgroundColor: "rgba(0,0,0,0.45)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Video size={26} color="white" />
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => removeMedia(item.id)}
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          borderCurve: "continuous",
                          backgroundColor: "rgba(0,0,0,0.5)",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.3)",
                        }}
                      >
                        <X size={14} color="white" />
                      </TouchableOpacity>
                      {mediaAspectMode === "mixed" && (
                        <TouchableOpacity
                          onPress={() => {
                            setActiveMediaIndex(index);
                            setFrameAdjustMediaId(item.id);
                          }}
                          style={{
                            position: "absolute",
                            bottom: 12,
                            left: 10,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 14,
                            borderCurve: "continuous",
                            backgroundColor: "rgba(9,69,105,0.92)",
                          }}
                        >
                          <Ratio size={14} color="#fff" />
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            Frame
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
              {postMedia.length > 1 && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    marginTop: 10,
                    gap: 5,
                  }}
                >
                  {postMedia.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === activeMediaIndex ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        borderCurve: "continuous",
                        backgroundColor:
                          i === activeMediaIndex ? "#094569" : "#d1d5db",
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Products filled */}
          {taggedProducts.length > 0 && (
            <View style={{ marginHorizontal: 16, marginTop: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {taggedProducts.map((product) => (
                  <View
                    key={product.id}
                    style={{
                      width: 116,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      overflow: "hidden",
                      backgroundColor: "#f8faff",
                      borderWidth: 1,
                      borderColor: "#dbeafe",
                    }}
                  >
                    {product.image ? (
                      <Image
                        source={{ uri: product.image }}
                        style={{ width: "100%", height: 76 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: "100%",
                          height: 76,
                          backgroundColor: "#eff6ff",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShoppingBag size={24} color="#bfdbfe" />
                      </View>
                    )}
                    <View style={{ padding: 8 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                        numberOfLines={1}
                      >
                        {product.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#094569",
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {/* A service is quoted, not listed — it shows whose
                            it is instead of a price. */}
                        {taggedItemPrice(product) ??
                          product.owner_name ??
                          "Service"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeTaggedProduct(product.id)}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderCurve: "continuous",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={11} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                {taggedProducts.length < 5 && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowProductPicker(true);
                    }}
                    activeOpacity={0.8}
                    style={{
                      width: 80,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      borderWidth: 1.5,
                      borderColor: "#dbeafe",
                      borderStyle: "dashed",
                      backgroundColor: "#f8faff",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 116,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderCurve: "continuous",
                        backgroundColor: "#eff6ff",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 6,
                      }}
                    >
                      <Plus size={16} color="#094569" />
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        fontWeight: "600",
                      }}
                    >
                      Add more
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* People filled */}
          {taggedAccounts.length > 0 && (
            <View style={{ marginHorizontal: 16, marginTop: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {taggedAccounts.map((account) => (
                  <View
                    key={account.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#fafafe",
                      borderWidth: 1,
                      borderColor: "#e0e7ff",
                      borderRadius: 24,
                      borderCurve: "continuous",
                      paddingLeft: 4,
                      paddingRight: 10,
                      paddingVertical: 4,
                    }}
                  >
                    {account.avatar_url ? (
                      <Image
                        source={{ uri: account.avatar_url }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          marginRight: 7,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          borderCurve: "continuous",
                          backgroundColor: "#e0e7ff",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 7,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#6366f1",
                          }}
                        >
                          {account.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#374151",
                        maxWidth: 90,
                      }}
                      numberOfLines={1}
                    >
                      {account.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeTaggedAccount(account.id)}
                      style={{
                        marginLeft: 7,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderCurve: "continuous",
                        backgroundColor: "#e0e7ff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={10} color="#6366f1" />
                    </TouchableOpacity>
                  </View>
                ))}
                {taggedAccounts.length < 10 && (
                  <TouchableOpacity
                    onPress={() => setShowAccountPicker(true)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#eef2ff",
                      borderRadius: 24,
                      borderCurve: "continuous",
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: "#e0e7ff",
                    }}
                  >
                    <Plus size={13} color="#6366f1" />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#6366f1",
                        marginLeft: 5,
                      }}
                    >
                      Add
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Media Source Modal */}
      <Modal
        visible={showMediaSourceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMediaSourceModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/40"
          activeOpacity={1}
          onPress={() => setShowMediaSourceModal(false)}
        />
        <View
          style={{ borderTopLeftRadius: MODAL_RADIUS, borderTopRightRadius: MODAL_RADIUS, borderCurve: "continuous" }} className="bg-white pb-10">
          <View className="w-10 h-1 bg-gray-300 rounded-full self-center mt-3 mb-4" />
          <Text className="text-lg font-bold text-center text-gray-900 mb-4">
            Add Media
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowMediaSourceModal(false);
              pickMediaFromGallery();
            }}
            className="flex-row items-center px-6 py-4"
          >
            <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center">
              <ImageIcon size={20} color="#059669" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Choose from Gallery
              </Text>
              <Text className="text-xs text-gray-500">
                Select multiple photos & videos
              </Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowMediaSourceModal(false);
              pickMediaFromCamera();
            }}
            className="flex-row items-center px-6 py-4 border-t border-gray-100"
          >
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
              <Camera size={20} color="#3B82F6" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Take Photo / Video
              </Text>
              <Text className="text-xs text-gray-500">Use your camera</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Scanning overlay — shown while Vision checks a freshly-picked image */}
      <Modal visible={isScanningMedia} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40">
          <View
            style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }} className="bg-white px-6 py-5 items-center">
            <CircularLoader size="large" color="#094569" />
            <Text className="mt-3 text-base font-semibold text-gray-900">
              Checking image…
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              Making sure it meets our guidelines
            </Text>
          </View>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <Modal
        visible={showProductPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View className="flex-1 bg-white" style={{ paddingTop: sheetTopInset }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowProductPicker(false)}>
              <ArrowLeft size={22} color="#111" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">
              Tag products & services
            </Text>
            <TouchableOpacity onPress={() => setShowProductPicker(false)}>
              <Text className="text-sm font-semibold text-primary">Done</Text>
            </TouchableOpacity>
          </View>

          {/* Anything in the app is taggable now, so the picker is a search
              rather than a list of your own things. */}
          <View className="px-4 pt-3 pb-1">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F5F5F5",
                borderRadius: 999,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                height: 42,
              }}
            >
              <Search size={16} color="#9CA3AF" />
              <TextInput
                value={productQuery}
                onChangeText={setProductQuery}
                placeholder="Search products and services"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, marginLeft: 8, fontSize: 15, color: "#111827" }}
              />
              {productQuery.length > 0 && (
                <TouchableOpacity onPress={() => setProductQuery("")} hitSlop={10}>
                  <X size={15} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {loadingProducts && taggableItems.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <CircularLoader size="small" color="#094569" />
            </View>
          ) : taggableItems.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <ShoppingBag size={48} color="#D1D5DB" />
              <Text className="text-base font-semibold text-gray-400 mt-3 text-center">
                {productQuery.trim()
                  ? "Nothing matches that"
                  : "Nothing to tag yet"}
              </Text>
              <Text className="text-sm text-gray-400 mt-1 text-center">
                {productQuery.trim()
                  ? "Try the seller's name, or a shorter word."
                  : "Products and services listed in the app show up here."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={taggableItems}
              keyExtractor={(item) => `${item.kind}-${item.id}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isSelected = taggedProducts.some((p) => p.id === item.id);
                const price = item.currentPrice ?? item.price;
                return (
                  <TouchableOpacity
                    onPress={() => toggleProduct(item)}
                    className={`flex-row items-center p-3 rounded-2xl mb-2 border ${
                      isSelected
                        ? "bg-primary/5 border-primary"
                        : "bg-white border-gray-100"
                    }`}
                    activeOpacity={0.7}
                  >
                    {item.image ? (
                      <Image
                        style={{ borderRadius: 12 }}
                        source={{ uri: item.image }}
                        className="w-14 h-14 bg-gray-100"
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{ borderRadius: 12, borderCurve: "continuous" }} className="w-14 h-14 bg-gray-100 items-center justify-center">
                        <ShoppingBag size={20} color="#D1D5DB" />
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-sm font-semibold text-gray-900"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {/* Whose it is, always — you are tagging other
                          people's things now, and the row has to say whose
                          before it is chosen, not after. */}
                      {item.subtitle ? (
                        <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                      {typeof price === "number" ? (
                        <Text className="text-xs text-primary font-bold mt-0.5">
                          Nu. {price.toLocaleString()}
                          {item.discountActive && typeof item.price === "number" && (
                            <Text className="text-gray-400 line-through font-normal">
                              {"  "}Nu. {item.price.toLocaleString()}
                            </Text>
                          )}
                        </Text>
                      ) : (
                        <Text className="text-xs text-gray-400 mt-0.5">Service</Text>
                      )}
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check size={14} color="white" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Account Picker Modal */}
      <Modal
        visible={showAccountPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAccountPicker(false)}
      >
        <View className="flex-1 bg-white" style={{ paddingTop: sheetTopInset }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
              <ArrowLeft size={22} color="#111" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">Tag People</Text>
            <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
              <Text className="text-sm font-semibold text-primary">Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-3">
            <View
              style={{ borderRadius: 12, borderCurve: "continuous" }} className="flex-row items-center bg-gray-100 px-3 py-2.5">
              <Search size={18} color="#9CA3AF" />
              <TextInput
                className="flex-1 ml-2 text-sm text-gray-800"
                placeholder="Search people..."
                placeholderTextColor="#9CA3AF"
                value={accountSearch}
                onChangeText={setAccountSearch}
                autoFocus
              />
              {accountSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAccountSearch("")}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Already tagged */}
          {taggedAccounts.length > 0 && (
            <View className="px-4 pb-2">
              <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Tagged
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {taggedAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    onPress={() => removeTaggedAccount(account.id)}
                    className="flex-row items-center bg-primary/10 rounded-full pl-1 pr-2.5 py-1"
                  >
                    {account.avatar_url ? (
                      <Image
                        source={{ uri: account.avatar_url }}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                        <Text className="text-white text-[9px] font-bold">
                          {account.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text className="ml-1.5 text-xs font-semibold text-primary">
                      {account.name}
                    </Text>
                    <View className="ml-1">
                      <X size={12} color="#094569" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Results */}
          {searchingAccounts ? (
            <View className="items-center py-8">
              <CircularLoader size="small" color="#094569" />
            </View>
          ) : accountSearch.length < 2 ? (
            <View className="items-center py-12 px-8">
              <Search size={40} color="#D1D5DB" />
              <Text className="text-sm text-gray-400 mt-3 text-center">
                Search for people to tag in your post
              </Text>
            </View>
          ) : (
            <FlatList
              data={accountResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View className="items-center py-8">
                  <Text className="text-sm text-gray-400">
                    No results found
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = taggedAccounts.some((a) => a.id === item.id);
                return (
                  <TouchableOpacity
                    onPress={() => toggleAccount(item)}
                    className={`flex-row items-center p-3 rounded-2xl mb-2 border ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-200"
                        : "bg-white border-gray-100"
                    }`}
                    activeOpacity={0.7}
                  >
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        className="w-11 h-11 rounded-full bg-gray-200"
                      />
                    ) : (
                      <View className="w-11 h-11 rounded-full bg-primary items-center justify-center">
                        <Text className="text-white font-bold text-sm">
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      className="flex-1 ml-3 text-sm font-semibold text-gray-900"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected
                          ? "bg-indigo-500 border-indigo-500"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check size={14} color="white" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={Boolean(frameAdjustMediaId && frameAdjustItem)}
        animationType="slide"
        transparent
        onRequestClose={() => setFrameAdjustMediaId(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFrameAdjustMediaId(null)}
          />
          {frameAdjustItem && (
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderCurve: "continuous",
                paddingBottom: 28,
                maxHeight: "78%",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  borderCurve: "continuous",
                  backgroundColor: "#e5e7eb",
                  alignSelf: "center",
                  marginTop: 10,
                  marginBottom: 6,
                }}
              />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: "#111",
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                Frame for this slide
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  textAlign: "center",
                  marginBottom: 14,
                  paddingHorizontal: 20,
                }}
              >
                {frameAdjustItem.type === "video"
                  ? "Videos use this aspect in the feed (no crop editor)."
                  : "Pick a ratio, fine-tune with the slider, then apply or open crop."}
              </Text>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingHorizontal: 18,
                  paddingBottom: 12,
                }}
              >
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setPostMedia((prev) =>
                        prev.map((m) =>
                          m.id === frameAdjustItem.id
                            ? { ...m, displayRatio: undefined }
                            : m,
                        ),
                      );
                      setFrameAdjustMediaId(null);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 18,
                      borderCurve: "continuous",
                      backgroundColor: "#f3f4f6",
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Original
                    </Text>
                  </TouchableOpacity>
                  {(
                    [
                      { label: "4:5", r: RATIO_PORTRAIT },
                      { label: "1:1", r: RATIO_SQUARE },
                      { label: "16:9", r: RATIO_LANDSCAPE },
                      { label: "9:16", r: 9 / 16 },
                    ] as const
                  ).map(({ label, r }) => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => setDraftFrameRatio(clampMediaRatio(r))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 18,
                        borderCurve: "continuous",
                        backgroundColor:
                          Math.abs(draftFrameRatio - r) < 0.02
                            ? "#094569"
                            : "#f3f4f6",
                        borderWidth: 1,
                        borderColor:
                          Math.abs(draftFrameRatio - r) < 0.02
                            ? "#094569"
                            : "#e5e7eb",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color:
                            Math.abs(draftFrameRatio - r) < 0.02
                              ? "#fff"
                              : "#374151",
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#6b7280",
                    marginTop: 16,
                    marginBottom: 8,
                  }}
                >
                  Custom width ÷ height: {draftFrameRatio.toFixed(2)}
                </Text>
                <Slider
                  minimumValue={RATIO_MIN}
                  maximumValue={RATIO_MAX}
                  value={draftFrameRatio}
                  onValueChange={(v) => setDraftFrameRatio(clampMediaRatio(v))}
                  step={0.01}
                  minimumTrackTintColor="#094569"
                  maximumTrackTintColor="#e5e7eb"
                  thumbTintColor="#094569"
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => setFrameAdjustMediaId(null)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor: "#f3f4f6",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: "#374151" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setPostMedia((prev) =>
                        prev.map((m) =>
                          m.id === frameAdjustItem.id
                            ? {
                                ...m,
                                displayRatio: clampMediaRatio(draftFrameRatio),
                              }
                            : m,
                        ),
                      );
                      setFrameAdjustMediaId(null);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      backgroundColor: "#094569",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: "#fff" }}>
                      Apply
                    </Text>
                  </TouchableOpacity>
                </View>

                {frameAdjustItem.type === "image" && (
                  <TouchableOpacity
                    onPress={() => {
                      setReframeAspectOverride(
                        clampMediaRatio(draftFrameRatio),
                      );
                      setReframeMediaId(frameAdjustItem.id);
                      setFrameAdjustMediaId(null);
                    }}
                    style={{
                      marginTop: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: "continuous",
                      borderWidth: 1.5,
                      borderColor: "#1f2937",
                    }}
                  >
                    <Crop size={18} color="#1f2937" />
                    <Text
                      style={{
                        fontWeight: "700",
                        color: "#1f2937",
                        fontSize: 15,
                      }}
                    >
                      Crop & position at this ratio
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      <FeedAspectReframeOverlay
        visible={Boolean(reframeItem && reframeItem.type === "image")}
        imageUri={reframeItem?.uri ?? ""}
        imageWidth={reframeItem?.width}
        imageHeight={reframeItem?.height}
        aspectWidthOverHeight={reframeAspectForOverlay}
        onSave={(result) => {
          setPostMedia((prev) =>
            prev.map((m) =>
              m.id === reframeMediaId
                ? {
                    ...m,
                    uri: result.uri,
                    width: result.width,
                    height: result.height,
                    displayRatio: undefined,
                  }
                : m,
            ),
          );
          setReframeMediaId(null);
          setReframeAspectOverride(null);
        }}
        onCancel={() => {
          setReframeMediaId(null);
          setReframeAspectOverride(null);
        }}
      />

      {/* The picture editor. It is handed the **original** file, never the
          rendered one, so reopening it continues the same edit rather than
          stacking a second generation of JPEG on top of the first. */}
      {editingMediaId && (() => {
        const item = postMedia.find((m) => m.id === editingMediaId);
        if (!item) return null;
        const held = mediaEdits[item.id];
        return (
          <MediaEditor
            visible
            uri={held?.original ?? item.uri}
            edit={held?.edit}
            onCancel={() => setEditingMediaId(null)}
            onDone={(result: EditorResult) => {
              const original = held?.original ?? item.uri;
              setMediaEdits((prev) => ({
                ...prev,
                [item.id]: { original, edit: result.edit },
              }));
              setPostMedia((prev) =>
                prev.map((m) =>
                  m.id === item.id
                    ? {
                        ...m,
                        uri: result.uri,
                        // The rendered file has the crop's shape, not the
                        // original's, and the feed measures posts by these.
                        width: undefined,
                        height: undefined,
                      }
                    : m,
                ),
              );
              // Tags pinned on the picture join the post's own tagged
              // products, carrying where they were pinned — the feed draws
              // them there, so they are data rather than paint.
              const index = postMedia.findIndex((m) => m.id === item.id);
              setTaggedProducts((prev) => {
                const withoutThisImage = prev.filter(
                  (p) => p.pin?.image !== index,
                );
                const pinned = result.edit.pins.map((pin) => {
                  const existing = prev.find((p) => p.id === pin.refId);
                  return {
                    ...(existing ?? { id: pin.refId, name: pin.label }),
                    pin: { image: index, x: pin.x, y: pin.y, side: pin.side },
                  };
                });
                // A product pinned twice is still one product on the post.
                const seen = new Set(pinned.map((p) => p.id));
                return [
                  ...withoutThisImage.filter((p) => !seen.has(p.id)),
                  ...pinned,
                ];
              });
              setEditingMediaId(null);
            }}
          />
        );
      })()}

      {/* The two surfaces this composer can hand a draft over to. Both are
          mounted here rather than routed to: the draft is in this
          component's state, and a push would leave it behind. */}
      {showMarketplaceForm && (
        <MarketplacePostOverlay
          onClose={() => setShowMarketplaceForm(false)}
          initialCategory={sellingIntent?.marketplaceKind ?? "second_hand"}
          initialTitle={draftTitle}
          initialDescription={postText.trim()}
        />
      )}
      {showProductForm && !!userId && (
        <CreateProductModal
          isVisible={showProductForm}
          onClose={() => setShowProductForm(false)}
          userId={userId}
          initialName={draftTitle}
          initialDescription={postText.trim()}
        />
      )}
      <VerifyToSellNotice
        visible={showVerifyNotice}
        onClose={() => setShowVerifyNotice(false)}
      />

      <PopupMessage
        visible={showSuccess}
        type="success"
        title={successTitle}
        message={successMessage}
      />
      <PopupMessage
        visible={showError}
        type="error"
        title={errorTitle}
        message={errorMessage}
      />
      <PopupMessage
        visible={showLocationPermissionPopup}
        type="warning"
        title="Location Permission Needed"
        message="Enable location permission in Settings to add your current location."
        onHide={() => setShowLocationPermissionPopup(false)}
        actions={[
          { label: "Not now", style: "cancel" },
          {
            label: "Open Settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]}
      />
    </View>
  );
}
