import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Switch,
} from "react-native";
import * as Location from "expo-location";
import FeedAspectReframeOverlay from "@/components/modals/FeedAspectReframeOverlay";
import PopupMessage from "@/components/ui/PopupMessage";
import { LinearGradient } from "expo-linear-gradient";
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
  UserPlus,
  Video,
  X,
} from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { useUser } from "@/contexts/UserContext";
import * as ImagePicker from "expo-image-picker";
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
import Slider from "@react-native-community/slider";
import { createPost, uploadImages, uploadVideos } from "@/lib/postsService";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import type { TaggedProduct, TaggedAccount } from "@/types/post";

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

interface CreatePostProps {
  onClose?: () => void;
}

export default function CreatePost({ onClose }: CreatePostProps) {
  const router = useAppRouter();
  const { currentUser } = useUser();
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [mediaAspectMode, setMediaAspectMode] =
    useState<PostMediaDisplayMode>("portrait");
  const [isUploading, setIsUploading] = useState(false);

  const [addPostLocation, setAddPostLocation] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);

  // Product tagging
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
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
  const [frameAdjustMediaId, setFrameAdjustMediaId] = useState<string | null>(null);
  const [draftFrameRatio, setDraftFrameRatio] = useState(RATIO_PORTRAIT);
  const [reframeMediaId, setReframeMediaId] = useState<string | null>(null);
  const [reframeAspectOverride, setReframeAspectOverride] = useState<
    number | null
  >(null);
  const [showLocationPermissionPopup, setShowLocationPermissionPopup] =
    useState(false);

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
    (currentUser as any)?.username ||
    (currentUser as any)?.name ||
    "User";
  const avatarUrl =
    (currentUser as any)?.avatar_url || (currentUser as any)?.profileImg;

  const showErrorPopup = (message: string, title: string = "Error") => {
    setErrorMessage(message);
    setErrorTitle(title);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (message: string, title: string = "Success", callback?: () => void) => {
    setSuccessMessage(message);
    setSuccessTitle(title);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      callback?.();
    }, 2000);
  };

  // --- Unified media picker ---
  const pickMediaFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showErrorPopup("Photo library access is needed to select media.", "Permission Denied");
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
        const newItems: MediaItem[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.type === "video" ? "video" : ("image" as const),
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          width: asset.width ?? undefined,
          height: asset.height ?? undefined,
        }));
        setPostMedia((prev) => [...prev, ...newItems].slice(0, 10));
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
        setPostMedia((prev) =>
          [
            ...prev,
            {
              uri: asset.uri,
              type:
                asset.type === "video"
                  ? ("video" as const)
                  : ("image" as const),
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              width: asset.width ?? undefined,
              height: asset.height ?? undefined,
            },
          ].slice(0, 10)
        );
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

  // --- Product tagging ---
  const loadUserProducts = useCallback(async () => {
    if (!userId) return;
    setLoadingProducts(true);
    try {
      const products = await fetchUserProducts(userId);
      setUserProducts(products);
    } catch {
      showErrorPopup("Failed to load your products.", "Load Failed");
    } finally {
      setLoadingProducts(false);
    }
  }, [userId]);

  const toggleProduct = (product: Product) => {
    setTaggedProducts((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 5) {
        showErrorPopup("You can tag up to 5 products per post.", "Limit Reached");
        return prev;
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0],
          current_price: product.current_price,
          is_currently_active: product.is_currently_active,
          discount_percent: product.discount_percent,
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
            }))
          );
        }
      } catch {
        // silent
      } finally {
        setSearchingAccounts(false);
      }
    },
    [userId]
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
        showErrorPopup("You can tag up to 10 accounts per post.", "Limit Reached");
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
      showErrorPopup("You must be logged in to create a post", "Login Required");
      return;
    }
    if (!userId) {
      showErrorPopup("User information is incomplete. Please log in again.", "Invalid User");
      return;
    }
    if (!postText.trim() && postMedia.length === 0) {
      showErrorPopup("Please add some text or media to your post", "Empty Post");
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

      if (imageUris.length > 0) {
        try {
          const urls = await uploadImages(imageUris);
          uploadedMediaUrls.push(...urls);
        } catch (err: any) {
          showErrorPopup(
            `Failed to upload images: ${err.message || err}`,
            "Upload Failed"
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
            "Upload Failed"
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
          tagged_products:
            taggedProducts.length > 0 ? taggedProducts : undefined,
          tagged_accounts:
            taggedAccounts.length > 0 ? taggedAccounts : undefined,
          locationName: trimmedLocation || undefined,
          locationLat:
            trimmedLocation && locationCoords
              ? locationCoords.lat
              : undefined,
          locationLng:
            trimmedLocation && locationCoords
              ? locationCoords.lng
              : undefined,
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
          setFrameAdjustMediaId(null);
          setReframeMediaId(null);
          setReframeAspectOverride(null);
          onClose?.();
        });
      } catch (err: any) {
        showErrorPopup(
          `Failed to create post: ${err.message || err}`,
          "Post Failed"
        );
      }
    } catch (err: any) {
      showErrorPopup(
        `An unexpected error occurred: ${err.message || err}`,
        "Error"
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
      {/* Safe area spacer */}
      <View className="h-14 bg-white" />

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

        <TouchableOpacity
          onPress={handleSharePost}
          disabled={isUploading || !canShare}
          className={`px-5 py-2 rounded-full ${
            canShare && !isUploading ? "bg-primary" : "bg-gray-200"
          }`}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
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
                trackColor={{ false: "#e5e7eb", true: "#94c9e8" }}
                thumbColor={addPostLocation ? "#094569" : "#f4f4f5"}
              />
            </View>
            {addPostLocation && (
              <View style={{ marginTop: 10 }}>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 12,
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
                    borderWidth: 1.5,
                    borderColor: "#094569",
                    opacity: resolvingLocation ? 0.7 : 1,
                  }}
                >
                  {resolvingLocation ? (
                    <ActivityIndicator size="small" color="#094569" />
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
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>
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
                  Set each slide&apos;s frame below, or use Crop to zoom inside the
                  frame (photos only).
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
                      onPress={() =>
                        setFrameAdjustMediaId(previewItem.id)
                      }
                      activeOpacity={0.85}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 22,
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
                </View>
                {mediaAspectMode !== "mixed" && previewItem.type === "image" && (
                  <Text
                    style={{
                      fontSize: 10,
                      color: "#9ca3af",
                      marginTop: 8,
                      textAlign: "center",
                      paddingHorizontal: 12,
                    }}
                  >
                    Crop uses your selected layout ({ratioPresetLabel(
                      ratioForUniformMode(mediaAspectMode),
                    )}
                    ).
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* ── 3-Column Action Row ── */}
          <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 16, gap: 10 }}>

            {/* Media */}
            <TouchableOpacity
              onPress={() => setShowMediaSourceModal(true)}
              activeOpacity={0.8}
              style={{ flex: 1, borderWidth: 1.5, borderColor: postMedia.length > 0 ? "#bfdbfe" : "#e5e7eb", borderStyle: "dashed", borderRadius: 16, paddingVertical: 20, alignItems: "center", justifyContent: "center", backgroundColor: postMedia.length > 0 ? "#eff6ff" : "#f9fafb" }}
            >
              {postMedia.length > 0 && (
                <View style={{ position: "absolute", top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "white" }}>{postMedia.length}</Text>
                </View>
              )}
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: postMedia.length > 0 ? "#dbeafe" : "#eff6ff", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <ImageIcon size={22} color="#3b82f6" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: postMedia.length > 0 ? "#1d4ed8" : "#6b7280" }}>Media</Text>
            </TouchableOpacity>

            {/* Products */}
            <TouchableOpacity
              onPress={() => { loadUserProducts(); setShowProductPicker(true); }}
              activeOpacity={0.8}
              style={{ flex: 1, borderWidth: 1.5, borderColor: taggedProducts.length > 0 ? "#bfdbfe" : "#e5e7eb", borderStyle: "dashed", borderRadius: 16, paddingVertical: 20, alignItems: "center", justifyContent: "center", backgroundColor: taggedProducts.length > 0 ? "#f0f7ff" : "#f9fafb" }}
            >
              {taggedProducts.length > 0 && (
                <View style={{ position: "absolute", top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#094569", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "white" }}>{taggedProducts.length}</Text>
                </View>
              )}
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: taggedProducts.length > 0 ? "#dbeafe" : "#eff6ff", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <ShoppingBag size={22} color="#094569" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: taggedProducts.length > 0 ? "#094569" : "#6b7280" }}>Products</Text>
            </TouchableOpacity>

            {/* Tag People */}
            <TouchableOpacity
              onPress={() => setShowAccountPicker(true)}
              activeOpacity={0.8}
              style={{ flex: 1, borderWidth: 1.5, borderColor: taggedAccounts.length > 0 ? "#c7d2fe" : "#e5e7eb", borderStyle: "dashed", borderRadius: 16, paddingVertical: 20, alignItems: "center", justifyContent: "center", backgroundColor: taggedAccounts.length > 0 ? "#eef2ff" : "#f9fafb" }}
            >
              {taggedAccounts.length > 0 && (
                <View style={{ position: "absolute", top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "white" }}>{taggedAccounts.length}</Text>
                </View>
              )}
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: taggedAccounts.length > 0 ? "#e0e7ff" : "#eef2ff", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <UserPlus size={22} color="#6366f1" />
              </View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: taggedAccounts.length > 0 ? "#4f46e5" : "#6b7280" }}>People</Text>
            </TouchableOpacity>

          </View>

          {/* Media filled — peeking carousel */}
          {postMedia.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <FlatList
                data={[...postMedia, { id: "__add__", uri: "", type: "add" as any }]}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 10}
                decelerationRate="fast"
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 10));
                  setActiveMediaIndex(Math.min(idx, postMedia.length - 1));
                }}
                renderItem={({ item, index }) => {
                  if (item.id === "__add__" && postMedia.length < 10) {
                    return (
                      <TouchableOpacity
                        onPress={() => setShowMediaSourceModal(true)}
                        activeOpacity={0.8}
                        style={{ width: CARD_WIDTH, height: CARD_WIDTH * 0.75, borderRadius: 18, borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed", backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center" }}
                      >
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                          <Plus size={22} color="#3b82f6" />
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>Add more</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (item.id === "__add__") return null;
                  return (
                    <View style={{ width: CARD_WIDTH, height: CARD_WIDTH * 0.75, borderRadius: 18, overflow: "hidden" }}>
                      <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.55)"]}
                        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "flex-end" }}
                      >
                        <View style={{ backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
                          <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{index + 1} / {postMedia.length}</Text>
                        </View>
                      </LinearGradient>
                      {item.type === "video" && (
                        <View style={{ position: "absolute", top: "50%", left: "50%", marginTop: -28, marginLeft: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
                          <Video size={26} color="white" />
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => removeMedia(item.id)}
                        style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
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
                            backgroundColor: "rgba(9,69,105,0.92)",
                          }}
                        >
                          <Ratio size={14} color="#fff" />
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                            Frame
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
              {postMedia.length > 1 && (
                <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 5 }}>
                  {postMedia.map((_, i) => (
                    <View key={i} style={{ width: i === activeMediaIndex ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeMediaIndex ? "#094569" : "#d1d5db" }} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Products filled */}
          {taggedProducts.length > 0 && (
            <View style={{ marginHorizontal: 16, marginTop: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {taggedProducts.map((product) => (
                  <View key={product.id} style={{ width: 116, borderRadius: 16, overflow: "hidden", backgroundColor: "#f8faff", borderWidth: 1, borderColor: "#dbeafe" }}>
                    {product.image ? (
                      <Image source={{ uri: product.image }} style={{ width: "100%", height: 76 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 76, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" }}>
                        <ShoppingBag size={24} color="#bfdbfe" />
                      </View>
                    )}
                    <View style={{ padding: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#1f2937" }} numberOfLines={1}>{product.name}</Text>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#094569", marginTop: 2 }}>Nu. {(product.current_price ?? product.price).toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeTaggedProduct(product.id)} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
                      <X size={11} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                {taggedProducts.length < 5 && (
                  <TouchableOpacity
                    onPress={() => { loadUserProducts(); setShowProductPicker(true); }}
                    activeOpacity={0.8}
                    style={{ width: 80, borderRadius: 16, borderWidth: 1.5, borderColor: "#dbeafe", borderStyle: "dashed", backgroundColor: "#f8faff", alignItems: "center", justifyContent: "center", height: 116 }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                      <Plus size={16} color="#094569" />
                    </View>
                    <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "600" }}>Add more</Text>
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
                  <View key={account.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fafafe", borderWidth: 1, borderColor: "#e0e7ff", borderRadius: 24, paddingLeft: 4, paddingRight: 10, paddingVertical: 4 }}>
                    {account.avatar_url ? (
                      <Image source={{ uri: account.avatar_url }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 7 }} />
                    ) : (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#e0e7ff", alignItems: "center", justifyContent: "center", marginRight: 7 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#6366f1" }}>{account.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", maxWidth: 90 }} numberOfLines={1}>{account.name}</Text>
                    <TouchableOpacity onPress={() => removeTaggedAccount(account.id)} style={{ marginLeft: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: "#e0e7ff", alignItems: "center", justifyContent: "center" }}>
                      <X size={10} color="#6366f1" />
                    </TouchableOpacity>
                  </View>
                ))}
                {taggedAccounts.length < 10 && (
                  <TouchableOpacity
                    onPress={() => setShowAccountPicker(true)}
                    activeOpacity={0.8}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#eef2ff", borderRadius: 24, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#e0e7ff" }}
                  >
                    <Plus size={13} color="#6366f1" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#6366f1", marginLeft: 5 }}>Add</Text>
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
        <View className="bg-white rounded-t-3xl pb-10">
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
              <Text className="text-xs text-gray-500">
                Use your camera
              </Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <Modal
        visible={showProductPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View className="flex-1 bg-white">
          <View className="h-14" />
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => setShowProductPicker(false)}
            >
              <ArrowLeft size={22} color="#111" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">
              Tag Products
            </Text>
            <TouchableOpacity
              onPress={() => setShowProductPicker(false)}
            >
              <Text className="text-sm font-semibold text-primary">
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {loadingProducts ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#094569" />
              <Text className="text-sm text-gray-400 mt-2">
                Loading your products...
              </Text>
            </View>
          ) : userProducts.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <ShoppingBag size={48} color="#D1D5DB" />
              <Text className="text-base font-semibold text-gray-400 mt-3 text-center">
                No products yet
              </Text>
              <Text className="text-sm text-gray-400 mt-1 text-center">
                Add products to your profile first, then you can tag
                them in your posts.
              </Text>
            </View>
          ) : (
            <FlatList
              data={userProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isSelected = taggedProducts.some(
                  (p) => p.id === item.id
                );
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
                    {item.images?.[0] ? (
                      <Image
                        source={{ uri: item.images[0] }}
                        className="w-14 h-14 rounded-xl bg-gray-100"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-14 h-14 rounded-xl bg-gray-100 items-center justify-center">
                        <ShoppingBag
                          size={20}
                          color="#D1D5DB"
                        />
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-sm font-semibold text-gray-900"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text className="text-xs text-primary font-bold mt-0.5">
                        Nu.{" "}
                        {(
                          item.current_price ?? item.price
                        ).toLocaleString()}
                        {item.is_currently_active && (
                          <Text className="text-gray-400 line-through font-normal">
                            {"  "}Nu.{" "}
                            {item.price.toLocaleString()}
                          </Text>
                        )}
                      </Text>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <Check size={14} color="white" />
                      )}
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
        <View className="flex-1 bg-white">
          <View className="h-14" />
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => setShowAccountPicker(false)}
            >
              <ArrowLeft size={22} color="#111" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">
              Tag People
            </Text>
            <TouchableOpacity
              onPress={() => setShowAccountPicker(false)}
            >
              <Text className="text-sm font-semibold text-primary">
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-3">
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5">
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
                <TouchableOpacity
                  onPress={() => setAccountSearch("")}
                >
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
                    onPress={() =>
                      removeTaggedAccount(account.id)
                    }
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
                          {account.name
                            .charAt(0)
                            .toUpperCase()}
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
              <ActivityIndicator size="small" color="#094569" />
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
                const isSelected = taggedAccounts.some(
                  (a) => a.id === item.id
                );
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
                          {item.name
                            .charAt(0)
                            .toUpperCase()}
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
                      {isSelected && (
                        <Check size={14} color="white" />
                      )}
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
                paddingBottom: 28,
                maxHeight: "78%",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
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
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                      backgroundColor: "#f3f4f6",
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151" }}>
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
                        backgroundColor:
                          Math.abs(draftFrameRatio - r) < 0.02 ? "#094569" : "#f3f4f6",
                        borderWidth: 1,
                        borderColor:
                          Math.abs(draftFrameRatio - r) < 0.02 ? "#094569" : "#e5e7eb",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color:
                            Math.abs(draftFrameRatio - r) < 0.02 ? "#fff" : "#374151",
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
                      backgroundColor: "#f3f4f6",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: "#374151" }}>Cancel</Text>
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
                      backgroundColor: "#094569",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: "#fff" }}>Apply</Text>
                  </TouchableOpacity>
                </View>

                {frameAdjustItem.type === "image" && (
                  <TouchableOpacity
                    onPress={() => {
                      setReframeAspectOverride(clampMediaRatio(draftFrameRatio));
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
                      borderWidth: 1.5,
                      borderColor: "#1f2937",
                    }}
                  >
                    <Crop size={18} color="#1f2937" />
                    <Text style={{ fontWeight: "700", color: "#1f2937", fontSize: 15 }}>
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
