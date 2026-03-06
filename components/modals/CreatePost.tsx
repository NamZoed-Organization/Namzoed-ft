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
  Platform,
} from "react-native";
import PopupMessage from "@/components/ui/PopupMessage";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  ImageIcon,
  Search,
  ShoppingBag,
  UserPlus,
  Video,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useUser } from "@/contexts/UserContext";
import * as ImagePicker from "expo-image-picker";
import { createPost, uploadImages, uploadVideos } from "@/lib/postsService";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import type { TaggedProduct, TaggedAccount } from "@/types/post";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MediaItem {
  uri: string;
  type: "image" | "video";
  id: string;
}

interface CreatePostProps {
  onClose?: () => void;
}

export default function CreatePost({ onClose }: CreatePostProps) {
  const router = useRouter();
  const { currentUser } = useUser();
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  // Active media preview index (for carousel indicator)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const userId = (currentUser as any)?.id;
  const username =
    (currentUser as any)?.username ||
    (currentUser as any)?.name ||
    "User";
  const avatarUrl =
    (currentUser as any)?.avatar_url || (currentUser as any)?.profileImg;

  const showErrorPopup = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (message: string, callback?: () => void) => {
    setSuccessMessage(message);
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
        showErrorPopup("Photo library access is needed to select media.");
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
        showErrorPopup("Camera access is needed.");
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

  // --- Product tagging ---
  const loadUserProducts = useCallback(async () => {
    if (!userId) return;
    setLoadingProducts(true);
    try {
      const products = await fetchUserProducts(userId);
      setUserProducts(products);
    } catch {
      showErrorPopup("Failed to load your products.");
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
        showErrorPopup("You can tag up to 5 products per post.");
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
        showErrorPopup("You can tag up to 10 accounts per post.");
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
      showErrorPopup("You must be logged in to create a post");
      return;
    }
    if (!userId) {
      showErrorPopup("User information is incomplete. Please log in again.");
      return;
    }
    if (!postText.trim() && postMedia.length === 0) {
      showErrorPopup("Please add some text or media to your post");
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
            `Failed to upload images: ${err.message || err}`
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
            `Failed to upload videos: ${err.message || err}`
          );
          return;
        }
      }

      try {
        await createPost({
          content: postText.trim(),
          images: uploadedMediaUrls,
          userId,
          tagged_products:
            taggedProducts.length > 0 ? taggedProducts : undefined,
          tagged_accounts:
            taggedAccounts.length > 0 ? taggedAccounts : undefined,
        });
        showSuccessPopup("Your post has been published!", () => {
          setPostText("");
          setPostMedia([]);
          setTaggedProducts([]);
          setTaggedAccounts([]);
          onClose?.();
        });
      } catch (err: any) {
        showErrorPopup(
          `Failed to create post: ${err.message || err}`
        );
      }
    } catch (err: any) {
      showErrorPopup(
        `An unexpected error occurred: ${err.message || err}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const canShare = postText.trim().length > 0 || postMedia.length > 0;

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
            className="px-4 text-base text-gray-800 min-h-[80px]"
            placeholder="Write a caption..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={postText}
            onChangeText={setPostText}
            style={{ textAlignVertical: "top" }}
          />

          {/* Media carousel */}
          {postMedia.length > 0 && (
            <View className="mt-2">
              <FlatList
                data={postMedia}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                  );
                  setActiveMediaIndex(idx);
                }}
                renderItem={({ item }) => (
                  <View
                    style={{
                      width: SCREEN_WIDTH,
                      height: SCREEN_WIDTH,
                    }}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    {item.type === "video" && (
                      <View className="absolute inset-0 items-center justify-center">
                        <View className="w-16 h-16 rounded-full bg-black/40 items-center justify-center">
                          <Video size={28} color="white" />
                        </View>
                      </View>
                    )}
                    {/* Remove button */}
                    <TouchableOpacity
                      onPress={() => removeMedia(item.id)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 items-center justify-center"
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
              />
              {/* Dots */}
              {postMedia.length > 1 && (
                <View className="flex-row justify-center mt-2 gap-1">
                  {postMedia.map((_, i) => (
                    <View
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i === activeMediaIndex
                          ? "bg-primary"
                          : "bg-gray-300"
                      }`}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Tagged Products */}
          {taggedProducts.length > 0 && (
            <View className="px-4 mt-4">
              <View className="flex-row items-center mb-2">
                <ShoppingBag size={14} color="#094569" />
                <Text className="ml-1.5 text-sm font-semibold text-gray-700">
                  Tagged Products
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <View className="flex-row gap-2">
                  {taggedProducts.map((product) => (
                    <View
                      key={product.id}
                      className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                    >
                      {product.image && (
                        <Image
                          source={{ uri: product.image }}
                          className="w-8 h-8 rounded-lg bg-gray-200 mr-2"
                          resizeMode="cover"
                        />
                      )}
                      <View
                        className="mr-2"
                        style={{ maxWidth: 100 }}
                      >
                        <Text
                          className="text-xs font-semibold text-gray-800"
                          numberOfLines={1}
                        >
                          {product.name}
                        </Text>
                        <Text className="text-[10px] text-primary font-bold">
                          Nu.{" "}
                          {(
                            product.current_price ?? product.price
                          ).toLocaleString()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          removeTaggedProduct(product.id)
                        }
                        className="ml-1"
                      >
                        <X size={14} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Tagged Accounts */}
          {taggedAccounts.length > 0 && (
            <View className="px-4 mt-3">
              <View className="flex-row items-center mb-2">
                <UserPlus size={14} color="#094569" />
                <Text className="ml-1.5 text-sm font-semibold text-gray-700">
                  Tagged People
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {taggedAccounts.map((account) => (
                  <View
                    key={account.id}
                    className="flex-row items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5"
                  >
                    {account.avatar_url ? (
                      <Image
                        source={{ uri: account.avatar_url }}
                        className="w-5 h-5 rounded-full bg-gray-200 mr-1.5"
                      />
                    ) : (
                      <View className="w-5 h-5 rounded-full bg-primary/10 items-center justify-center mr-1.5">
                        <Text className="text-[8px] font-bold text-primary">
                          {account.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs font-medium text-gray-700 mr-1">
                      {account.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        removeTaggedAccount(account.id)
                      }
                    >
                      <X size={12} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className="h-6" />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View className="border-t border-gray-100 bg-white px-4 py-3 pb-8">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View className="flex-row items-center gap-2">
              {/* Add Media */}
              <TouchableOpacity
                onPress={() => setShowMediaSourceModal(true)}
                className="flex-row items-center px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
                disabled={postMedia.length >= 10}
              >
                <ImageIcon
                  size={18}
                  color={
                    postMedia.length >= 10
                      ? "#D1D5DB"
                      : "#059669"
                  }
                />
                <Text
                  className={`ml-2 text-sm font-medium ${
                    postMedia.length >= 10
                      ? "text-gray-300"
                      : "text-gray-700"
                  }`}
                >
                  Media
                </Text>
                {postMedia.length > 0 && (
                  <View className="ml-1.5 bg-primary/10 rounded-full px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-primary">
                      {postMedia.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Tag Products */}
              <TouchableOpacity
                onPress={() => {
                  loadUserProducts();
                  setShowProductPicker(true);
                }}
                className="flex-row items-center px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
              >
                <ShoppingBag size={18} color="#094569" />
                <Text className="ml-2 text-sm font-medium text-gray-700">
                  Products
                </Text>
                {taggedProducts.length > 0 && (
                  <View className="ml-1.5 bg-primary/10 rounded-full px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-primary">
                      {taggedProducts.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Tag People */}
              <TouchableOpacity
                onPress={() => setShowAccountPicker(true)}
                className="flex-row items-center px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
              >
                <UserPlus size={18} color="#6366F1" />
                <Text className="ml-2 text-sm font-medium text-gray-700">
                  Tag People
                </Text>
                {taggedAccounts.length > 0 && (
                  <View className="ml-1.5 bg-indigo-50 rounded-full px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-indigo-500">
                      {taggedAccounts.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
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

      <PopupMessage
        visible={showSuccess}
        type="success"
        message={successMessage}
      />
      <PopupMessage
        visible={showError}
        type="error"
        message={errorMessage}
      />
    </View>
  );
}
