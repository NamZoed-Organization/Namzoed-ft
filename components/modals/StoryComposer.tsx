import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { moderateImage } from "@/lib/imageModeration";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { createStory } from "@/lib/storiesService";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Check,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import StoryCropOverlay, { type StoryCropResult } from "./StoryCropOverlay";
import StoryDesignOverlay, { type StoryDesignResult } from "./StoryDesignOverlay";

interface StoryComposerProps {
  onClose?: () => void;
}

interface TaggedAccount {
  id: string;
  name: string;
  avatar_url: string | null;
}

type Step = "source" | "crop" | "design" | "tag";

export default function StoryComposer({ onClose }: StoryComposerProps) {
  const { currentUser } = useUser();
  const userId = (currentUser as any)?.id;

  const [step, setStep] = useState<Step>("source");
  const [pickedImage, setPickedImage] = useState<{
    uri: string;
    width?: number;
    height?: number;
  } | null>(null);
  const [croppedImage, setCroppedImage] = useState<StoryCropResult | null>(null);
  const [designedImage, setDesignedImage] = useState<StoryDesignResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [taggedProduct, setTaggedProduct] = useState<Product | null>(null);
  const [taggedAccount, setTaggedAccount] = useState<TaggedAccount | null>(null);

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountResults, setAccountResults] = useState<TaggedAccount[]>([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);

  const [showError, setShowError] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const showErrorPopup = (message: string, title: string = "Error") => {
    setErrorMessage(message);
    setErrorTitle(title);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  // ─── Step 1: pick/capture (single image, moderated at selection time) ──

  const handlePickedAsset = async (asset: { uri: string; width?: number; height?: number }) => {
    setIsScanning(true);
    try {
      const result = await moderateImage(asset.uri);
      if (result.decision === "block") {
        showErrorPopup(
          result.reason || "This image can't be posted because it contains disallowed content.",
          "Image Blocked",
        );
        return;
      }
      setPickedImage(asset);
      setStep("crop");
    } finally {
      setIsScanning(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showErrorPopup("Photo library access is needed to select a photo.", "Permission Denied");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await handlePickedAsset({
          uri: asset.uri,
          width: asset.width ?? undefined,
          height: asset.height ?? undefined,
        });
      }
    } catch (error) {
      console.error("Error picking story photo from gallery:", error);
    }
  };

  const pickFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showErrorPopup("Camera access is needed.", "Permission Denied");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await handlePickedAsset({
          uri: asset.uri,
          width: asset.width ?? undefined,
          height: asset.height ?? undefined,
        });
      }
    } catch (error) {
      console.error("Error capturing story photo:", error);
    }
  };

  // ─── Step 3: optional tag (product OR account, mutually exclusive) ─────

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

  const selectProduct = (product: Product) => {
    setTaggedProduct((prev) => (prev?.id === product.id ? null : product));
    setTaggedAccount(null);
  };

  const searchAccounts = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setAccountResults([]);
        return;
      }
      setSearchingAccounts(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .ilike("name", `%${query}%`)
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
        // silent, matches CreatePost's search convention
      } finally {
        setSearchingAccounts(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => searchAccounts(accountSearch), 300);
    return () => clearTimeout(timeout);
  }, [accountSearch, searchAccounts]);

  const selectAccount = (account: TaggedAccount) => {
    setTaggedAccount((prev) => (prev?.id === account.id ? null : account));
    setTaggedProduct(null);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!userId || !designedImage || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createStory({
        userId,
        imageUri: designedImage.uri,
        width: croppedImage?.width,
        height: croppedImage?.height,
        taggedProductId: taggedProduct?.id ?? null,
        taggedAccountId: taggedAccount?.id ?? null,
        taggedProductName: taggedProduct?.name,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose?.();
      }, 1200);
    } catch (error) {
      console.error("Error sharing story:", error);
      showErrorPopup("Failed to share your story. Please try again.", "Share Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (step === "crop" && pickedImage) {
    return (
      <StoryCropOverlay
        visible
        imageUri={pickedImage.uri}
        imageWidth={pickedImage.width}
        imageHeight={pickedImage.height}
        onSave={(result) => {
          setCroppedImage(result);
          setStep("design");
        }}
        onCancel={() => setStep("source")}
      />
    );
  }

  if (step === "design" && croppedImage) {
    return (
      <StoryDesignOverlay
        visible
        imageUri={croppedImage.uri}
        onSave={(result) => {
          setDesignedImage(result);
          setStep("tag");
        }}
        onCancel={() => setStep("crop")}
      />
    );
  }

  if (step === "tag" && designedImage) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setStep("design")}>
        <View className="flex-1 bg-black">
          <StatusBar barStyle="light-content" />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 52,
              paddingBottom: 12,
            }}
          >
            <TouchableOpacity onPress={() => setStep("design")} hitSlop={16} style={{ padding: 10 }}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 17 }}>Add to Story</Text>
            <TouchableOpacity
              onPress={handleShare}
              disabled={isSubmitting}
              hitSlop={16}
              style={{ padding: 10 }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#4ade80" />
              ) : (
                <Text style={{ color: "#4ade80", fontWeight: "700", fontSize: 15 }}>Share</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
            <Image
              source={{ uri: designedImage.uri }}
              style={{ width: "80%", aspectRatio: 9 / 16, borderRadius: 12 }}
              resizeMode="cover"
            />
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                loadUserProducts();
                setShowProductPicker(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: taggedProduct ? "rgba(9,69,105,0.25)" : "rgba(255,255,255,0.1)",
                borderWidth: 1,
                borderColor: taggedProduct ? "#094569" : "rgba(255,255,255,0.2)",
              }}
            >
              <ShoppingBag size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
                {taggedProduct ? `Tagged: ${taggedProduct.name}` : "Tag a product"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowAccountPicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: taggedAccount ? "rgba(79,70,229,0.25)" : "rgba(255,255,255,0.1)",
                borderWidth: 1,
                borderColor: taggedAccount ? "#4f46e5" : "rgba(255,255,255,0.2)",
              }}
            >
              <User size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
                {taggedAccount ? `Tagged: ${taggedAccount.name}` : "Tag someone"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Product Picker — single-select variant of CreatePost's picker */}
        <Modal
          visible={showProductPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowProductPicker(false)}
        >
          <View className="flex-1 bg-white">
            <View className="h-14" />
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <ArrowLeft size={22} color="#111" />
              </TouchableOpacity>
              <Text className="text-lg font-bold text-gray-900">Tag a Product</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Text className="text-sm font-semibold text-primary">Done</Text>
              </TouchableOpacity>
            </View>

            {loadingProducts ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color="#094569" />
                <Text className="text-sm text-gray-400 mt-2">Loading your products...</Text>
              </View>
            ) : userProducts.length === 0 ? (
              <View className="flex-1 items-center justify-center px-8">
                <ShoppingBag size={48} color="#D1D5DB" />
                <Text className="text-base font-semibold text-gray-400 mt-3 text-center">
                  No products yet
                </Text>
                <Text className="text-sm text-gray-400 mt-1 text-center">
                  Add products to your profile first, then you can tag them in your story.
                </Text>
              </View>
            ) : (
              <FlatList
                data={userProducts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const isSelected = taggedProduct?.id === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => selectProduct(item)}
                      className={`flex-row items-center p-3 rounded-2xl mb-2 border ${
                        isSelected ? "bg-primary/5 border-primary" : "bg-white border-gray-100"
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
                          <ShoppingBag size={20} color="#D1D5DB" />
                        </View>
                      )}
                      <View className="flex-1 ml-3">
                        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-xs text-primary font-bold mt-0.5">
                          Nu. {(item.current_price ?? item.price).toLocaleString()}
                        </Text>
                      </View>
                      <View
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isSelected ? "bg-primary border-primary" : "border-gray-300"
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

        {/* Account Picker — single-select variant of CreatePost's picker */}
        <Modal
          visible={showAccountPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAccountPicker(false)}
        >
          <View className="flex-1 bg-white">
            <View className="h-14" />
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <ArrowLeft size={22} color="#111" />
              </TouchableOpacity>
              <Text className="text-lg font-bold text-gray-900">Tag Someone</Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Text className="text-sm font-semibold text-primary">Done</Text>
              </TouchableOpacity>
            </View>

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
                  <TouchableOpacity onPress={() => setAccountSearch("")}>
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {searchingAccounts ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color="#094569" />
              </View>
            ) : accountSearch.length < 2 ? (
              <View className="items-center py-12 px-8">
                <Search size={40} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-3 text-center">
                  Search for someone to tag in your story
                </Text>
              </View>
            ) : (
              <FlatList
                data={accountResults}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                  <View className="items-center py-8">
                    <Text className="text-sm text-gray-400">No results found</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected = taggedAccount?.id === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => selectAccount(item)}
                      className={`flex-row items-center p-3 rounded-2xl mb-2 border ${
                        isSelected ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-100"
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
                      <Text className="flex-1 ml-3 text-sm font-semibold text-gray-900" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isSelected ? "bg-indigo-500 border-indigo-500" : "border-gray-300"
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

        <PopupMessage visible={showError} type="error" title={errorTitle} message={errorMessage} />
        <PopupMessage
          visible={showSuccess}
          type="success"
          title="Shared!"
          message="Your story is live for the next 24 hours."
        />
      </Modal>
    );
  }

  // Step "source" — initial pick-photo screen
  return (
    <Modal visible animationType="slide" onRequestClose={() => onClose?.()}>
      <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 52,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => onClose?.()} hitSlop={16} style={{ padding: 10 }}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 17 }}>Add to Story</Text>
          <View style={{ width: 44 }} />
        </View>

        {isScanning && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12 }}>Checking photo...</Text>
          </View>
        )}

        <ImagePickerSheet
          visible={!isScanning}
          onClose={() => onClose?.()}
          onCameraPress={pickFromCamera}
          onGalleryPress={pickFromGallery}
          title="Add to Your Story"
        />

        <PopupMessage visible={showError} type="error" title={errorTitle} message={errorMessage} />
      </View>
    </Modal>
  );
}
