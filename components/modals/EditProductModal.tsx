import ImageCropperOverlay from "@/components/modals/ImageCropperOverlay";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { categories } from "@/data/categories";
import {
  Product,
  updateProduct,
  uploadProductImages,
} from "@/lib/productsService";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { Check, DollarSign, Moon, Upload, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface EditProductModalProps {
  isVisible: boolean;
  onClose: () => void;
  product: Product;
  userId: string;
  onSuccess: () => void;
}

export default function EditProductModal({
  isVisible,
  onClose,
  product,
  userId,
  onSuccess,
}: EditProductModalProps) {
  const [loading, setLoading] = useState(false);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  // Popup helpers
  const showErrorPopup = (message: string) => {
    setPopupMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (message: string, callback?: () => void) => {
    setPopupMessage(message);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      callback?.();
    }, 2000);
  };

  // Form State - Pre-populated from product
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(product.price.toString());
  const [selectedCategory, setSelectedCategory] = useState<string>(
    product.category,
  );
  const [tags, setTags] = useState<string[]>(product.tags);

  // Image State - Separate existing from new
  const [existingImages, setExistingImages] = useState<string[]>(
    product.images,
  );
  const [newImages, setNewImages] = useState<string[]>([]);

  // Discount State (optional fields)
  const [isDiscountActive, setIsDiscountActive] = useState(
    product.is_discount_active || false,
  );
  const [discountPercent, setDiscountPercent] = useState<number>(
    product.discount_percent || 0,
  );
  const [discountStartedAt, setDiscountStartedAt] = useState<Date | undefined>(
    product.discount_started_at
      ? new Date(product.discount_started_at)
      : undefined,
  );
  const [discountDurationHrs, setDiscountDurationHrs] = useState<string>(
    product.discount_duration_hrs?.toString() || "24",
  );

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<"date" | "time">("date");

  // Image picker and crop states
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Ref to track initial mount for tags
  const isInitialMount = useRef(true);

  // Calculate discounted price (derived state)
  const discountedPrice = useMemo(() => {
    if (!isDiscountActive || !discountPercent) return null;
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return null;
    return numPrice - (numPrice * discountPercent) / 100;
  }, [price, discountPercent, isDiscountActive]);

  // Animation
  const translateX = useSharedValue(400);

  useEffect(() => {
    if (isVisible) {
      translateX.value = withTiming(0, { duration: 300 });
    } else {
      translateX.value = withTiming(400, { duration: 300 });
    }
  }, [isVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const categoryKeys = Object.keys(categories);

  // Check if selected category is food (for Closing Sale UI)
  const isFood = selectedCategory === "food";

  // Derive available tags based on selection
  // Defensive check: ensure category exists in categories object
  const availableTags =
    selectedCategory && categories[selectedCategory]
      ? categories[selectedCategory].map((sub) => sub.name)
      : [];

  // Clear tags when category changes (but not on initial mount)
  useEffect(() => {
    // Don't clear tags on initial mount (when pre-populating from product)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only clear tags when user manually changes category
    setTags([]);
  }, [selectedCategory]);

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera access is needed to take photos.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setShowCropper(true);
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setShowCropper(true);
    }
  };

  const pickImage = () => {
    setShowPickerSheet(true);
  };

  const handleCropSave = (croppedUri: string) => {
    setNewImages([...newImages, croppedUri]);
    setShowCropper(false);
    setPendingImageUri(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setPendingImageUri(null);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleSelectAllTags = () => {
    if (tags.length === availableTags.length) {
      setTags([]);
    } else {
      setTags([...availableTags]);
    }
  };

  const handleUpdate = async () => {
    // Validation
    if (!name || !price || !selectedCategory) {
      showErrorPopup("Please fill in the Name, Price, and Category.");
      return;
    }

    if (tags.length === 0) {
      showErrorPopup("Please select at least one tag.");
      return;
    }

    const totalImages = existingImages.length + newImages.length;
    if (totalImages === 0) {
      showErrorPopup("Please add at least one image.");
      return;
    }

    // Discount validation - start time is required when discount is active (except for food - auto-starts)
    if (isDiscountActive && !discountStartedAt && !isFood) {
      showErrorPopup("Please select when the discount should start.");
      return;
    }

    // For food Closing Sale, ensure start time is set to now if not already
    if (isFood && isDiscountActive && !discountStartedAt) {
      setDiscountStartedAt(new Date());
    }

    setLoading(true);

    try {
      // Upload only new images
      const uploadedUrls =
        newImages.length > 0
          ? await uploadProductImages(newImages, userId)
          : [];

      // Combine existing + newly uploaded images
      const finalImages = [...existingImages, ...uploadedUrls];

      // Debug discount fields before saving
      if (isDiscountActive) {
        console.log("Saving discount with:", {
          is_discount_active: isDiscountActive,
          discount_percent: discountPercent,
          discount_started_at_raw: discountStartedAt,
          discount_started_at_iso: discountStartedAt?.toISOString(),
          discount_duration_hrs: parseFloat(discountDurationHrs),
          current_time: new Date().toISOString(),
        });
      }

      // Update product
      await updateProduct(product.id, {
        name,
        description,
        price: parseFloat(price),
        category: selectedCategory,
        tags,
        images: finalImages,
        // Discount fields (optional)
        is_discount_active: isDiscountActive,
        discount_percent: discountPercent,
        discount_started_at: discountStartedAt?.toISOString(),
        discount_duration_hrs: parseFloat(discountDurationHrs),
      });

      showSuccessPopup("Product updated successfully!", () => {
        onSuccess();
      });
    } catch (error: any) {
      console.error("Update error:", error);
      showErrorPopup(error.message || "Failed to update product");
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-[90%] w-full overflow-hidden">
              {/* Premium Header with BlurView */}
              <BlurView
                intensity={90}
                tint="light"
                className="border-b border-gray-200/50"
              >
                <View className="flex-row justify-between items-center px-6 py-4">
                  <View>
                    <Text className="text-2xl font-mbold text-gray-900">
                      Edit Product
                    </Text>
                    <Text className="text-gray-500 text-xs font-mregular">
                      Update your listing details
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    className="bg-white/60 p-2.5 rounded-full shadow-sm border border-gray-100"
                  >
                    <X size={20} color="#1F2937" />
                  </TouchableOpacity>
                </View>
              </BlurView>

              <ScrollView
                className="flex-1 px-5"
                showsVerticalScrollIndicator={false}
              >
                {/* Image Picker Section */}
                <View className="mt-5">
                  <Text className="text-sm font-semibold text-gray-700 mb-3">
                    Photos <Text className="text-red-500">*</Text>
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                  >
                    {/* Existing Images */}
                    {existingImages.map((url, index) => (
                      <View key={`existing-${index}`} className="relative mr-3">
                        <Image
                          source={{ uri: url }}
                          className="w-24 h-24 rounded-xl"
                        />
                        <TouchableOpacity
                          onPress={() => removeExistingImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 border-2 border-white"
                        >
                          <X size={12} color="white" />
                        </TouchableOpacity>
                        <View className="absolute bottom-1 left-1 bg-white/80 rounded px-1">
                          <Text className="text-[10px] text-gray-600">
                            Existing
                          </Text>
                        </View>
                      </View>
                    ))}

                    {/* New Images */}
                    {newImages.map((uri, index) => (
                      <View key={`new-${index}`} className="relative mr-3">
                        <Image
                          source={{ uri }}
                          className="w-24 h-24 rounded-xl"
                        />
                        <TouchableOpacity
                          onPress={() => removeNewImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 border-2 border-white"
                        >
                          <X size={12} color="white" />
                        </TouchableOpacity>
                        <View className="absolute bottom-1 left-1 bg-primary/80 rounded px-1">
                          <Text className="text-[10px] text-white">New</Text>
                        </View>
                      </View>
                    ))}

                    {/* Add Photo Button */}
                    <TouchableOpacity
                      onPress={pickImage}
                      className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl justify-center items-center mr-3 bg-gray-50"
                    >
                      <Upload size={24} color="#9CA3AF" />
                      <Text className="text-xs text-gray-400 mt-1">
                        Add Photo
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* Product Info */}
                <View className="mt-6 gap-y-5">
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Product Name
                    </Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                      placeholder="e.g. Vintage Leather Jacket"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Price
                    </Text>
                    <View className="relative">
                      <View className="absolute left-4 top-3.5 z-10">
                        <DollarSign size={16} color="#6B7280" />
                      </View>
                      <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900"
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={price}
                        onChangeText={setPrice}
                      />
                    </View>
                  </View>

                  {/* CONDITIONAL: Closing Sale (Food) vs Discount (Non-Food) */}
                  {isFood ? (
                    /* ========== CLOSING SALE UI (Food Only) ========== */
                    <View className="bg-amber-50 border border-amber-200 rounded-[24px] p-5 shadow-sm">
                      <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                          <Moon size={18} color="#D97706" />
                          <Text className="text-sm font-semibold text-amber-800">
                            Closing Sale
                          </Text>
                        </View>

                        {/* Toggle Switch */}
                        <View className="flex-row items-center">
                          <Text className="text-xs text-amber-700 mr-2">
                            {isDiscountActive ? "Active" : "Off"}
                          </Text>
                          <Switch
                            value={isDiscountActive}
                            onValueChange={(newValue) => {
                              setIsDiscountActive(newValue);
                              // Auto-set start time to NOW when toggled on
                              if (newValue) {
                                setDiscountStartedAt(new Date());
                              }
                            }}
                            trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
                            thumbColor={
                              isDiscountActive ? "#D97706" : "#F3F4F6"
                            }
                          />
                        </View>
                      </View>

                      <Text className="text-xs text-amber-600 mb-4">
                        Clear your leftover food quickly with a time-limited
                        offer
                      </Text>

                      {/* Closing Sale Percent Dropdown - Higher discounts */}
                      <View className="mb-4">
                        <Text className="text-sm font-medium text-amber-800 mb-2">
                          Discount
                        </Text>
                        <View className="bg-white border border-amber-200 rounded-xl">
                          <Picker
                            selectedValue={discountPercent}
                            onValueChange={(value) => setDiscountPercent(value)}
                            enabled={isDiscountActive}
                            style={{ opacity: isDiscountActive ? 1 : 0.5 }}
                          >
                            <Picker.Item label="Select discount..." value={0} />
                            <Picker.Item label="20% Off" value={20} />
                            <Picker.Item label="30% Off" value={30} />
                            <Picker.Item label="40% Off" value={40} />
                            <Picker.Item label="50% Off" value={50} />
                            <Picker.Item label="60% Off" value={60} />
                            <Picker.Item label="70% Off" value={70} />
                          </Picker>
                        </View>
                      </View>

                      {/* Closing Sale Price Display */}
                      {isDiscountActive && discountedPrice !== null && (
                        <View className="mb-4 bg-amber-100 border border-amber-300 rounded-xl p-3">
                          <Text className="text-xs text-amber-700 mb-1">
                            Closing Sale Price:
                          </Text>
                          <View className="flex-row items-baseline">
                            <Text className="text-amber-500 line-through text-sm mr-2">
                              Nu. {parseFloat(price).toLocaleString()}
                            </Text>
                            <Text className="text-amber-700 font-bold text-lg">
                              Nu. {discountedPrice.toLocaleString()}
                            </Text>
                            <Text className="text-amber-600 text-xs ml-2">
                              ({discountPercent}% off)
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Duration - Shorter options for food */}
                      <View>
                        <Text className="text-sm font-medium text-amber-800 mb-2">
                          Duration
                        </Text>
                        <View className="bg-white border border-amber-200 rounded-xl overflow-hidden">
                          <Picker
                            selectedValue={discountDurationHrs}
                            onValueChange={(value) =>
                              setDiscountDurationHrs(value)
                            }
                            enabled={isDiscountActive}
                            style={{ opacity: isDiscountActive ? 1 : 0.5 }}
                          >
                            <Picker.Item label="1 hour" value="1" />
                            <Picker.Item label="2 hours" value="2" />
                            <Picker.Item label="3 hours" value="3" />
                            <Picker.Item label="4 hours" value="4" />
                            <Picker.Item label="6 hours" value="6" />
                          </Picker>
                        </View>
                        <Text className="text-xs text-amber-600 mt-1">
                          Starts immediately when activated
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* ========== REGULAR DISCOUNT UI (Non-Food) ========== */
                    <View className="bg-gray-50 border border-gray-200 rounded-[24px] p-5 shadow-sm">
                      <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-sm font-semibold text-gray-700">
                          Discount Settings{" "}
                          <Text className="text-gray-400 font-normal">
                            (Optional)
                          </Text>
                        </Text>

                        {/* Toggle Switch */}
                        <View className="flex-row items-center">
                          <Text className="text-xs text-gray-600 mr-2">
                            {isDiscountActive ? "Active" : "Inactive"}
                          </Text>
                          <Switch
                            value={isDiscountActive}
                            onValueChange={setIsDiscountActive}
                            trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                            thumbColor={
                              isDiscountActive ? "#059669" : "#F3F4F6"
                            }
                          />
                        </View>
                      </View>

                      {/* Discount Percent Dropdown */}
                      <View className="mb-4">
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                          Discount Percentage
                        </Text>
                        <View className="bg-white border border-gray-200 rounded-xl">
                          <Picker
                            selectedValue={discountPercent}
                            onValueChange={(value) => setDiscountPercent(value)}
                            enabled={isDiscountActive}
                            style={{ opacity: isDiscountActive ? 1 : 0.5 }}
                          >
                            <Picker.Item label="No Discount" value={0} />
                            <Picker.Item label="5% Off" value={5} />
                            <Picker.Item label="10% Off" value={10} />
                            <Picker.Item label="15% Off" value={15} />
                            <Picker.Item label="20% Off" value={20} />
                            <Picker.Item label="25% Off" value={25} />
                            <Picker.Item label="30% Off" value={30} />
                            <Picker.Item label="35% Off" value={35} />
                            <Picker.Item label="40% Off" value={40} />
                            <Picker.Item label="50% Off" value={50} />
                          </Picker>
                        </View>
                      </View>

                      {/* Discounted Price Display (Read-only) */}
                      {isDiscountActive && discountedPrice !== null && (
                        <View className="mb-4 bg-primary/10 border border-primary/30 rounded-xl p-3">
                          <Text className="text-xs text-gray-600 mb-1">
                            Discounted Price:
                          </Text>
                          <View className="flex-row items-baseline">
                            <Text className="text-gray-400 line-through text-sm mr-2">
                              Nu. {parseFloat(price).toLocaleString()}
                            </Text>
                            <Text className="text-primary font-bold text-lg">
                              Nu. {discountedPrice.toLocaleString()}
                            </Text>
                            <Text className="text-primary text-xs ml-2">
                              ({discountPercent}% off)
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Discount Start Time - Two Options */}
                      <View className="mb-4">
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                          Start Time{" "}
                          {isDiscountActive && (
                            <Text className="text-red-500">*</Text>
                          )}
                        </Text>

                        <View className="flex-row gap-2">
                          {/* Start Now Button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (isDiscountActive) {
                                const now = new Date();
                                console.log("Start Now clicked:", {
                                  localTime: now.toString(),
                                  isoTime: now.toISOString(),
                                  timestamp: now.getTime(),
                                });
                                setDiscountStartedAt(now);
                              }
                            }}
                            disabled={!isDiscountActive}
                            className={`flex-1 py-3 rounded-xl border ${
                              !isDiscountActive
                                ? "bg-gray-100 border-gray-200 opacity-50"
                                : discountStartedAt &&
                                    Math.abs(
                                      discountStartedAt.getTime() -
                                        new Date().getTime(),
                                    ) < 60000
                                  ? "border-primary border-2"
                                  : "bg-white border-gray-300"
                            }`}
                          >
                            <Text
                              className={`text-center font-medium ${
                                !isDiscountActive
                                  ? "text-gray-400"
                                  : discountStartedAt &&
                                      Math.abs(
                                        discountStartedAt.getTime() -
                                          new Date().getTime(),
                                      ) < 60000
                                    ? "text-primary"
                                    : "text-gray-700"
                              }`}
                            >
                              Start Now
                            </Text>
                          </TouchableOpacity>

                          {/* Choose Date Button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (isDiscountActive) {
                                setDatePickerMode("date");
                                setShowDatePicker(true);
                              }
                            }}
                            disabled={!isDiscountActive}
                            className={`flex-1 py-3 rounded-xl border ${
                              !isDiscountActive
                                ? "bg-gray-100 border-gray-200 opacity-50"
                                : discountStartedAt &&
                                    Math.abs(
                                      discountStartedAt.getTime() -
                                        new Date().getTime(),
                                    ) >= 60000
                                  ? "border-primary border-2"
                                  : "bg-white border-gray-300"
                            }`}
                          >
                            <Text
                              className={`text-center font-medium ${
                                !isDiscountActive
                                  ? "text-gray-400"
                                  : discountStartedAt &&
                                      Math.abs(
                                        discountStartedAt.getTime() -
                                          new Date().getTime(),
                                      ) >= 60000
                                    ? "text-primary"
                                    : "text-gray-700"
                              }`}
                            >
                              Choose Date
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Selected Date Display */}
                        {discountStartedAt && (
                          <View className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex-row items-center justify-between">
                            <View className="flex-1">
                              <Text className="text-xs text-gray-500 mb-0.5">
                                Selected:
                              </Text>
                              <Text className="text-sm font-medium text-gray-900">
                                {discountStartedAt.toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                if (isDiscountActive) {
                                  setDiscountStartedAt(undefined);
                                }
                              }}
                              disabled={!isDiscountActive}
                              className="p-1"
                            >
                              <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Discount Duration - Dropdown */}
                      <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                          Duration
                        </Text>
                        <View className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <Picker
                            selectedValue={discountDurationHrs}
                            onValueChange={(value) =>
                              setDiscountDurationHrs(value)
                            }
                            enabled={isDiscountActive}
                            style={{ opacity: isDiscountActive ? 1 : 0.5 }}
                          >
                            <Picker.Item label="6 hours" value="6" />
                            <Picker.Item label="12 hours" value="12" />
                            <Picker.Item label="18 hours" value="18" />
                            <Picker.Item label="24 hours / 1 day" value="24" />
                            <Picker.Item label="2 days" value="48" />
                            <Picker.Item label="3 days" value="72" />
                            <Picker.Item label="4 days" value="96" />
                          </Picker>
                        </View>
                        <Text className="text-xs text-gray-500 mt-1">
                          How long the discount will last after it starts
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Category Selection */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Category
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row gap-2"
                    >
                      {categoryKeys.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-full border ${
                            selectedCategory === cat
                              ? "bg-primary border-primary"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <Text
                            className={
                              selectedCategory === cat
                                ? "text-white font-medium"
                                : "text-gray-600"
                            }
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Tags Section (Bubbles) */}
                  <View>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-sm font-medium text-gray-700">
                        Tags{" "}
                        <Text className="text-gray-400 font-normal">
                          (Select at least one)
                        </Text>
                      </Text>
                      {selectedCategory && (
                        <TouchableOpacity onPress={handleSelectAllTags}>
                          <Text className="text-xs text-primary font-medium">
                            {tags.length === availableTags.length
                              ? "Deselect All"
                              : "Select All"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View className="bg-gray-50 rounded-xl p-3 min-h-[100px] border border-gray-100">
                      {!selectedCategory ? (
                        <View className="flex-1 justify-center items-center py-4">
                          <Text className="text-gray-400 text-center">
                            Select a category above to see available tags.
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-row flex-wrap gap-2">
                          {availableTags.map((tag) => {
                            const isSelected = tags.includes(tag);
                            return (
                              <TouchableOpacity
                                key={tag}
                                onPress={() => toggleTag(tag)}
                                className={`px-3 py-2 rounded-lg border flex-row items-center ${
                                  isSelected
                                    ? "bg-primary/10 border-primary"
                                    : "bg-white border-gray-200"
                                }`}
                              >
                                <Text
                                  className={`text-xs ${
                                    isSelected
                                      ? "text-primary font-medium"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {tag}
                                </Text>
                                {isSelected && (
                                  <View className="ml-1.5 bg-primary/20 rounded-full p-0.5">
                                    <Check size={8} color="#059669" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>

                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Description
                    </Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[100px]"
                      placeholder="Describe your item..."
                      multiline
                      textAlignVertical="top"
                      value={description}
                      onChangeText={setDescription}
                    />
                  </View>
                </View>

                {/* Spacing for bottom button */}
                <View className="h-32" />
              </ScrollView>

              {/* Premium Footer / Submit Button */}
              <BlurView
                intensity={80}
                tint="light"
                className="absolute bottom-0 left-0 right-0 border-t border-gray-200/50"
              >
                <View className="p-5">
                  <TouchableOpacity
                    onPress={handleUpdate}
                    disabled={loading}
                    className={`w-full py-4 rounded-[24px] flex-row justify-center items-center shadow-lg ${
                      loading ? "bg-gray-300" : "bg-primary"
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-mbold text-lg">
                        Update Product
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Date/Time Picker Modal for iOS */}
      {showDatePicker && Platform.OS === "ios" && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View className="flex-1 justify-end bg-black/50">
            <BlurView
              intensity={80}
              tint="light"
              className="bg-white rounded-t-3xl"
            >
              <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text className="text-gray-500 font-medium">Cancel</Text>
                </TouchableOpacity>
                <Text className="font-semibold text-gray-900">
                  Select {datePickerMode === "date" ? "Date" : "Time"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (datePickerMode === "date") {
                      setDatePickerMode("time");
                    } else {
                      setShowDatePicker(false);
                    }
                  }}
                >
                  <Text className="text-primary font-semibold">
                    {datePickerMode === "date" ? "Next" : "Done"}
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={discountStartedAt || new Date()}
                mode={datePickerMode}
                display="spinner"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    console.log("iOS DatePicker selected:", {
                      mode: datePickerMode,
                      localTime: selectedDate.toString(),
                      isoTime: selectedDate.toISOString(),
                      timestamp: selectedDate.getTime(),
                    });
                    setDiscountStartedAt(selectedDate);
                  }
                }}
                textColor="#000"
                style={{ height: 200 }}
              />
            </BlurView>
          </View>
        </Modal>
      )}

      {/* Android DateTimePicker */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={discountStartedAt || new Date()}
          mode={datePickerMode}
          display="spinner"
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event.type === "set" && selectedDate) {
              console.log("Android DatePicker selected:", {
                mode: datePickerMode,
                localTime: selectedDate.toString(),
                isoTime: selectedDate.toISOString(),
                timestamp: selectedDate.getTime(),
              });
              if (datePickerMode === "date") {
                setDiscountStartedAt(selectedDate);
                // Immediately show time picker
                setTimeout(() => {
                  setDatePickerMode("time");
                  setShowDatePicker(true);
                }, 100);
              } else {
                setDiscountStartedAt(selectedDate);
                setDatePickerMode("date"); // Reset for next time
              }
            } else {
              setDatePickerMode("date"); // Reset on cancel
            }
          }}
        />
      )}

      {/* Success/Error Popups */}
      <PopupMessage
        visible={showSuccess}
        type="success"
        message={popupMessage}
      />
      <PopupMessage visible={showError} type="error" message={popupMessage} />

      {/* Image Picker Sheet */}
      <ImagePickerSheet
        visible={showPickerSheet}
        onClose={() => setShowPickerSheet(false)}
        onCameraPress={openCamera}
        onGalleryPress={openGallery}
      />

      {/* Image Cropper */}
      {showCropper && pendingImageUri && (
        <Modal visible={showCropper} animationType="slide">
          <ImageCropperOverlay
            imageUri={pendingImageUri}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
            initialAspectRatio="1:1"
          />
        </Modal>
      )}
    </Modal>
  );
}
