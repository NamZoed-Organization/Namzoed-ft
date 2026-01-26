import ImageCropperOverlay from "@/components/modals/ImageCropperOverlay";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { categories } from "@/data/categories";
import {
  Product,
  updateProduct,
  uploadProductImages,
} from "@/lib/productsService";
import { Picker } from "@react-native-picker/picker";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { Check, DollarSign, Upload, X } from "lucide-react-native";
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
  const [discountDurationHrs, setDiscountDurationHrs] = useState<string>(
    product.discount_duration_hrs?.toString() || "24",
  );

  // Calculate 8pm-10pm time window for food items
  const getFoodDiscountTimes = () => {
    const today = new Date();
    const startTime = new Date(today);
    startTime.setHours(20, 0, 0, 0); // 8pm today
    const endTime = new Date(today);
    endTime.setHours(22, 0, 0, 0); // 10pm today
    return { startTime, endTime };
  };

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
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to take photos.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets?.[0]) {
        setPendingImageUri(result.assets[0].uri);
        setShowCropper(true);
      }
    } catch (error) {
      console.error("Failed to open camera:", error);
      showErrorPopup("Failed to open camera.");
    }
  };

  const openGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Gallery access is needed to select photos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets?.[0]) {
        setPendingImageUri(result.assets[0].uri);
        setShowCropper(true);
      }
    } catch (error) {
      console.error("Failed to open gallery:", error);
      showErrorPopup("Failed to open gallery.");
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

    setLoading(true);

    try {
      // Upload only new images
      const uploadedUrls =
        newImages.length > 0
          ? await uploadProductImages(newImages, userId)
          : [];

      // Combine existing + newly uploaded images
      const finalImages = [...existingImages, ...uploadedUrls];

      // Prepare discount fields
      let discountStartTime = null;
      let discountDuration = parseFloat(discountDurationHrs);

      if (isDiscountActive) {
        if (isFood) {
          // Food items: Always 8pm-10pm today
          const { startTime } = getFoodDiscountTimes();
          discountStartTime = startTime.toISOString();
          discountDuration = 2; // Always 2 hours (8pm-10pm)
        } else {
          // Non-food: Start immediately
          discountStartTime = new Date().toISOString();
        }
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
        discount_started_at: discountStartTime,
        discount_duration_hrs: discountDuration,
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
                        <View>
                          <Text className="text-sm font-semibold text-amber-800">
                            Closing Sale
                          </Text>
                          <Text className="text-xs text-amber-600 mt-0.5">
                            8:00 PM - 10:00 PM Today
                          </Text>
                        </View>

                        {/* Toggle Switch */}
                        <View className="flex-row items-center">
                          <Text className="text-xs text-amber-700 mr-2">
                            {isDiscountActive ? "Active" : "Off"}
                          </Text>
                          <Switch
                            value={isDiscountActive}
                            onValueChange={setIsDiscountActive}
                            trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
                            thumbColor={
                              isDiscountActive ? "#D97706" : "#F3F4F6"
                            }
                          />
                        </View>
                      </View>

                      <View className="bg-amber-100/50 border border-amber-300 rounded-xl p-3 mb-4">
                        <Text className="text-xs text-amber-700 leading-5">
                          💡 Your discount will automatically activate from <Text className="font-semibold">8:00 PM to 10:00 PM today</Text>, regardless of when you turn it on. Perfect for clearing leftover food!
                        </Text>
                      </View>

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
                        <View className="bg-amber-100 border border-amber-300 rounded-xl p-3">
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
                          Starts immediately when activated. You can turn it off anytime.
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
