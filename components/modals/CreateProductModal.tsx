import ImageCropperOverlay from "@/components/modals/ImageCropperOverlay";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { categories } from "@/data/categories";
import { createProduct, uploadProductImages } from "@/lib/productsService";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import {
  Check,
  ChevronDown,
  Upload,
  X
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ReAnimated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";

interface CreateProductModalProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
}

export default function CreateProductModal({
  isVisible,
  onClose,
  userId,
}: CreateProductModalProps) {
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // Tag State (Selected tags)
  const [tags, setTags] = useState<string[]>([]);

  // Success popup state
  const [showSuccess, setShowSuccess] = useState(false);

  // Error popup state
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Category dropdown state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Image picker and crop states
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  const categoryKeys = Object.keys(categories);

  // Drag-to-close animation
  const screenHeight = Dimensions.get("window").height;
  const panY = useRef(new Animated.Value(0)).current;

  // Reset panY when modal opens
  useEffect(() => {
    if (isVisible) {
      panY.setValue(0);
    }
  }, [isVisible]);

  // PanResponder for drag-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy > 5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          Animated.timing(panY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onClose());
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  // Derive available tags (subcategories) based on selection
  const availableTags = selectedCategory
    ? categories[selectedCategory].map((sub) => sub.name)
    : [];

  // Clear tags when category changes
  useEffect(() => {
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
      mediaTypes: ['images'],
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    setImages([...images, croppedUri]);
    setShowCropper(false);
    setPendingImageUri(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setPendingImageUri(null);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
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

  // Show error popup helper
  const showErrorPopup = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  // In handlePost:
  const handlePost = async () => {
    if (!name || !price || !selectedCategory) {
      showErrorPopup("Please fill in the Name, Price, and Category.");
      return;
    }

    if (tags.length === 0) {
      showErrorPopup("Please select at least one tag.");
      return;
    }

    if (images.length === 0) {
      showErrorPopup("Please add at least one image.");
      return;
    }

    setLoading(true);

    try {
      // Upload images
      const uploadedUrls =
        images.length > 0 ? await uploadProductImages(images, userId) : [];

      // Create product
      await createProduct({
        name,
        description,
        price: parseFloat(price),
        category: selectedCategory,
        tags,
        images: uploadedUrls,
        userId,
      });

      // Reset form
      setName("");
      setDescription("");
      setPrice("");
      setTags([]);
      setImages([]);
      setSelectedCategory(null);

      // Show success popup
      setShowSuccess(true);

      // Auto close after animation
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error("Post error:", error);
      showErrorPopup(
        error.message || "Failed to create post. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="none"
      transparent={true}
      statusBarTranslucent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
      >
        {/* Backdrop - blur with fade in/out */}
        <ReAnimated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <BlurView
            intensity={50}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={onClose}
              style={{ flex: 1 }}
            />
          </BlurView>
        </ReAnimated.View>

        {/* Main Sheet - slides up */}
        <ReAnimated.View
          entering={SlideInDown.springify()}
          exiting={SlideOutDown}
          className="justify-end"
          style={{ height: "90%" }}
        >
          {/* Sheet Content */}
          <Animated.View
            className="bg-white rounded-t-3xl flex-1 w-full overflow-hidden shadow-xl"
            style={{ transform: [{ translateY: panY }] }}
          >
            {/* Drag Bar */}
            <View
              {...panResponder.panHandlers}
              className="w-full items-center justify-center py-3 bg-white z-50"
            >
              <View className="w-16 h-1.5 bg-gray-300 rounded-full" />
            </View>

            {/* Header */}
            <View className="flex-row justify-between items-center px-5 pb-4 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-900">
                Sell an Item
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="p-2 bg-gray-100 rounded-full"
              >
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

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
                  <TouchableOpacity
                    onPress={pickImage}
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl justify-center items-center mr-3 bg-gray-50"
                  >
                    <Upload size={24} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400 mt-1">
                      Add Photo
                    </Text>
                  </TouchableOpacity>

                  {images.map((uri, index) => (
                    <View key={index} className="relative mr-3">
                      <Image
                        source={{ uri }}
                        className="w-24 h-24 rounded-xl"
                      />
                      <TouchableOpacity
                        onPress={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 border-2 border-white"
                      >
                        <X size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
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
                    <View className="absolute left-4 top-3 z-10">
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#6B7280",
                        }}
                      >
                        Nu.
                      </Text>
                    </View>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900"
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={price}
                      onChangeText={setPrice}
                    />
                  </View>
                </View>

                {/* Category Selection - Dropdown */}
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">
                    Category
                  </Text>

                  {/* Dropdown Trigger */}
                  <TouchableOpacity
                    onPress={() =>
                      setShowCategoryDropdown(!showCategoryDropdown)
                    }
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
                  >
                    <Text
                      className={
                        selectedCategory
                          ? "text-gray-900 font-medium capitalize"
                          : "text-gray-400"
                      }
                    >
                      {selectedCategory
                        ? selectedCategory.replace("-", " & ")
                        : "Select a category"}
                    </Text>
                    <ReAnimated.View
                      style={{
                        transform: [
                          { rotate: showCategoryDropdown ? "180deg" : "0deg" },
                        ],
                      }}
                    >
                      <ChevronDown size={20} color="#6B7280" />
                    </ReAnimated.View>
                  </TouchableOpacity>

                  {/* Dropdown Content */}
                  {showCategoryDropdown && (
                    <ReAnimated.View
                      entering={FadeIn.duration(200)}
                      className="bg-white border border-gray-200 rounded-xl mt-2 p-3 shadow-lg"
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 5,
                      }}
                    >
                      <View className="flex-row flex-wrap gap-2">
                        {categoryKeys.map((cat) => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              onPress={() => {
                                setSelectedCategory(cat);
                                setShowCategoryDropdown(false);
                              }}
                              className={`flex-row items-center px-3 py-2.5 rounded-full border ${
                                isSelected
                                  ? "bg-primary/10 border-primary"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                              style={{ minWidth: "45%" }}
                            >
                              {/* Radio Button */}
                              <View
                                className={`w-5 h-5 rounded-full border-2 mr-2 items-center justify-center ${
                                  isSelected
                                    ? "border-primary"
                                    : "border-gray-300"
                                }`}
                              >
                                {isSelected && (
                                  <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                              </View>
                              <Text
                                className={`text-sm capitalize ${
                                  isSelected
                                    ? "text-primary font-semibold"
                                    : "text-gray-700"
                                }`}
                              >
                                {cat.replace("-", " & ")}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ReAnimated.View>
                  )}
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

            {/* Footer / Submit Button */}
            <View className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 shadow-lg">
              <TouchableOpacity
                onPress={handlePost}
                disabled={loading}
                className={`w-full py-4 rounded-xl flex-row justify-center items-center ${
                  loading ? "bg-gray-300" : "bg-primary"
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-lg">
                    Post Item
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ReAnimated.View>

        {/* Success Popup */}
        <PopupMessage
          visible={showSuccess}
          type="success"
          message="Your product is now live and ready for buyers!"
        />

        {/* Error Popup */}
        <PopupMessage visible={showError} type="error" message={errorMessage} />

        {/* Image Picker Sheet */}
        <ImagePickerSheet
          visible={showPickerSheet}
          onClose={() => setShowPickerSheet(false)}
          onCameraPress={openCamera}
          onGalleryPress={openGallery}
        />
      </KeyboardAvoidingView>

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
