import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { useDzongkhag } from "@/contexts/DzongkhagContext";
import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
import {
  createMarketplaceItem,
  uploadMarketplaceImages,
} from "@/lib/postMarketPlace";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Gift,
  Home,
  RefreshCw,
  ShoppingCart,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ImageCropperOverlay from "./ImageCropperOverlay";

interface MarketplacePostOverlayProps {
  onClose: () => void;
  onCategorySelect?: (category: string) => void;
}

type Category = "rent" | "swap" | "second_hand" | "free" | "job_vacancy" | null;

const CATEGORY_LABELS = {
  rent: "Rent",
  swap: "Swap",
  second_hand: "Second Hand",
  free: "Free",
  job_vacancy: "Job Vacancy",
};

export default function MarketplacePostOverlay({
  onClose,
  onCategorySelect,
}: MarketplacePostOverlayProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>(null);
  const { currentUser } = useUser();
  const { name: userDzongkhag } = useDzongkhag();

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [dzongkhag, setDzongkhag] = useState("");
  const [tags, setTags] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Job-specific fields
  const [jobDescription, setJobDescription] = useState("");
  const [jobRequirements, setJobRequirements] = useState("");
  const [jobResponsibilities, setJobResponsibilities] = useState("");

  // Prefill location from context
  useEffect(() => {
    if (userDzongkhag && !dzongkhag) {
      setDzongkhag(userDzongkhag);
    }
  }, [userDzongkhag]);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  // Image picker sheet
  const [showPickerSheet, setShowPickerSheet] = useState(false);

  // Popup helpers
  const showErrorPopup = (message: string) => {
    setPopupMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showWarningPopup = (message: string) => {
    setPopupMessage(message);
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 2500);
  };

  const showSuccessPopup = (message: string, callback?: () => void) => {
    setPopupMessage(message);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      callback?.();
    }, 2000);
  };

  // Image crop overlay
  const [showCropper, setShowCropper] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Vertical slide for drag-to-close
  const panY = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get("window").height;

  // --- Pan Responder for Drag-to-Close ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activate if dragging down vertically more than horizontally
        return (
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy > 5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging downwards
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Drag threshold: 100px or 500px/s velocity
          Animated.timing(panY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onClose());
        } else {
          // Spring back to top
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    if (onCategorySelect && category) {
      onCategorySelect(category);
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showErrorPopup("Camera access is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setShowCropper(true);
    }
  };

  const openGallery = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showErrorPopup("Please allow access to your photos.");
      return;
    }

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

  const handleAddImage = () => {
    if (selectedImages.length >= 5) {
      showWarningPopup("You can upload up to 5 images only.");
      return;
    }
    setShowPickerSheet(true);
  };

  const handleCropSave = (croppedUri: string) => {
    setSelectedImages([...selectedImages, croppedUri]);
    setShowCropper(false);
    setPendingImageUri(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setPendingImageUri(null);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!selectedCategory) return "Please select a category";
    if (!title.trim()) return "Please enter a title";
    if (title.length > 100) return "Title must be 100 characters or less";

    // For job_vacancy, validate description (requirements and responsibilities are optional)
    if (selectedCategory === "job_vacancy") {
      if (!jobDescription.trim()) return "Please enter a job description";
      if (jobDescription.length > 500)
        return "Job description must be 500 characters or less";
      if (jobRequirements.length > 500)
        return "Job requirements must be 500 characters or less";
      if (jobResponsibilities.length > 500)
        return "Job responsibilities must be 500 characters or less";
    } else {
      // For other categories, validate regular description
      if (!description.trim()) return "Please enter a description";
      if (description.length > 500)
        return "Description must be 500 characters or less";
    }

    // Price is only required for rent and second_hand
    if (selectedCategory === "rent" || selectedCategory === "second_hand") {
      if (!price.trim()) return "Please enter a price";
      if (isNaN(Number(price)) || Number(price) < 0)
        return "Please enter a valid price";
    }

    if (selectedImages.length === 0) return "Please add at least one image";
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      showErrorPopup(error);
      return;
    }

    if (!currentUser?.id) {
      showErrorPopup("User not logged in");
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload images
      const uploadedUrls = await uploadMarketplaceImages(selectedImages);

      // Price handling:
      // - swap/free: Always 0
      // - job_vacancy: Use entered value or 0 if empty
      // - rent/second_hand: Use entered value (validated above)
      let finalPrice = 0;
      if (selectedCategory === "swap" || selectedCategory === "free") {
        finalPrice = 0;
      } else if (selectedCategory === "job_vacancy") {
        finalPrice = price.trim() ? Number(price) : 0;
      } else {
        finalPrice = Number(price);
      }

      // Parse tags from comma-separated string
      const parsedTags = tags.trim()
        ? tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : [];

      // Build description based on category
      let descriptionData;
      if (selectedCategory === "job_vacancy") {
        // Structured JSONB for job vacancies (requirements and responsibilities are optional)
        descriptionData = {
          description: jobDescription.trim(),
          ...(jobRequirements.trim() && {
            requirements: jobRequirements.trim(),
          }),
          ...(jobResponsibilities.trim() && {
            responsibilities: jobResponsibilities.trim(),
          }),
        };
      } else {
        // Simple text format for other categories
        descriptionData = { text: description.trim() };
      }

      // Create marketplace item with category name as type
      await createMarketplaceItem({
        type: selectedCategory as any,
        title: title.trim(),
        description: descriptionData,
        price: finalPrice,
        images: uploadedUrls,
        dzongkhag: dzongkhag || undefined,
        tags: parsedTags,
        userId: currentUser.id,
      });

      showSuccessPopup("Your post has been created!", () => {
        onClose();
      });
    } catch (error) {
      console.error("Error creating post:", error);
      showErrorPopup("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <View className="flex-1 justify-end">
        {/* Backdrop Tap Zone */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="absolute top-0 left-0 right-0 bottom-0"
        />

        {/* --- MAIN SHEET --- */}
        <Animated.View
          className="bg-white rounded-t-3xl overflow-hidden shadow-xl w-full h-[90%]"
          style={{
            transform: [{ translateY: panY }],
          }}
        >
          {/* --- DRAG BAR AREA (ALWAYS ON TOP) --- */}
          <View
            {...panResponder.panHandlers}
            className="w-full items-center justify-center py-3 bg-white z-50"
          >
            <View className="w-16 h-1.5 bg-gray-300 rounded-full" />
          </View>

          {/* --- CONTENT CONTAINER --- */}
          <View className="flex-1 overflow-hidden">
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Header */}
              <View className="px-4 py-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={onClose}
                    className="w-10 h-10 items-center justify-center -ml-2"
                  >
                    <ArrowLeft size={24} className="text-gray-700" />
                  </TouchableOpacity>
                  <Text className="text-xl font-mbold text-gray-900 ml-2">
                    Create Marketplace Post
                  </Text>
                </View>
              </View>

              {/* Category Selection */}
              <View className="px-4 py-6">
                <Text className="text-base font-msemibold text-gray-900 mb-4">
                  Select Category
                </Text>

                {/* 5 Tab Buttons */}
                <View className="flex-row items-center w-full gap-2 mb-6">
                  {/* Job Vacancy Tab - FIRST */}
                  <TouchableOpacity
                    onPress={() => handleCategorySelect("job_vacancy")}
                    className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                      selectedCategory === "job_vacancy"
                        ? "border-2 border-black"
                        : ""
                    }`}
                  >
                    <Briefcase size={20} color="black" />
                  </TouchableOpacity>

                  {/* Rent Tab */}
                  <TouchableOpacity
                    onPress={() => handleCategorySelect("rent")}
                    className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                      selectedCategory === "rent" ? "border-2 border-black" : ""
                    }`}
                  >
                    <Home size={20} color="black" />
                  </TouchableOpacity>

                  {/* Second Hand Tab */}
                  <TouchableOpacity
                    onPress={() => handleCategorySelect("second_hand")}
                    className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                      selectedCategory === "second_hand"
                        ? "border-2 border-black"
                        : ""
                    }`}
                  >
                    <ShoppingCart size={20} color="black" />
                  </TouchableOpacity>

                  {/* Swap Tab */}
                  <TouchableOpacity
                    onPress={() => handleCategorySelect("swap")}
                    className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                      selectedCategory === "swap" ? "border-2 border-black" : ""
                    }`}
                  >
                    <RefreshCw size={20} color="black" />
                  </TouchableOpacity>

                  {/* Free Tab */}
                  <TouchableOpacity
                    onPress={() => handleCategorySelect("free")}
                    className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                      selectedCategory === "free" ? "border-2 border-black" : ""
                    }`}
                  >
                    <Gift size={20} color="black" />
                  </TouchableOpacity>
                </View>

                {/* Selected Category Display */}
                <View className="items-center py-4">
                  {selectedCategory ? (
                    <View className="bg-gray-50 px-6 py-3 rounded-lg">
                      <Text className="text-base font-msemibold text-gray-900">
                        Selected: {CATEGORY_LABELS[selectedCategory]}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-sm font-regular text-gray-500">
                      Please select a category to continue
                    </Text>
                  )}
                </View>
              </View>

              {/* Form Section - Only show when category is selected */}
              {selectedCategory && (
                <View className="px-4 pb-6">
                  {/* Title Input */}
                  <View className="mb-4">
                    <Text className="text-sm font-msemibold text-gray-900 mb-2">
                      Title <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Enter title (max 100 characters)"
                      maxLength={100}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      {title.length}/100
                    </Text>
                  </View>

                  {/* Conditional Description/Job Fields */}
                  {selectedCategory === "job_vacancy" ? (
                    // Job-specific fields
                    <>
                      {/* Job Description */}
                      <View className="mb-4">
                        <Text className="text-sm font-msemibold text-gray-900 mb-2">
                          Job Description{" "}
                          <Text className="text-red-500">*</Text>
                        </Text>
                        <TextInput
                          value={jobDescription}
                          onChangeText={setJobDescription}
                          placeholder="Describe the role and what makes it unique"
                          maxLength={500}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular min-h-[100px]"
                        />
                        <Text className="text-xs text-gray-500 mt-1">
                          {jobDescription.length}/500
                        </Text>
                      </View>

                      {/* Job Requirements */}
                      <View className="mb-4">
                        <Text className="text-sm font-msemibold text-gray-900 mb-2">
                          Requirements{" "}
                          <Text className="text-gray-400 text-xs">
                            (Optional)
                          </Text>
                        </Text>
                        <TextInput
                          value={jobRequirements}
                          onChangeText={setJobRequirements}
                          placeholder="List required qualifications and skills"
                          maxLength={500}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular min-h-[100px]"
                        />
                        <Text className="text-xs text-gray-500 mt-1">
                          {jobRequirements.length}/500
                        </Text>
                      </View>

                      {/* Job Responsibilities */}
                      <View className="mb-4">
                        <Text className="text-sm font-msemibold text-gray-900 mb-2">
                          Responsibilities{" "}
                          <Text className="text-gray-400 text-xs">
                            (Optional)
                          </Text>
                        </Text>
                        <TextInput
                          value={jobResponsibilities}
                          onChangeText={setJobResponsibilities}
                          placeholder="List key responsibilities and duties"
                          maxLength={500}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular min-h-[100px]"
                        />
                        <Text className="text-xs text-gray-500 mt-1">
                          {jobResponsibilities.length}/500
                        </Text>
                      </View>
                    </>
                  ) : (
                    // Regular description field for other categories
                    <View className="mb-4">
                      <Text className="text-sm font-msemibold text-gray-900 mb-2">
                        Description <Text className="text-red-500">*</Text>
                      </Text>
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Enter description (max 500 characters)"
                        maxLength={500}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular min-h-[100px]"
                      />
                      <Text className="text-xs text-gray-500 mt-1">
                        {description.length}/500
                      </Text>
                    </View>
                  )}

                  {/* Price Input - For rent, second_hand (required), and job_vacancy (optional) */}
                  {(selectedCategory === "rent" ||
                    selectedCategory === "second_hand" ||
                    selectedCategory === "job_vacancy") && (
                    <View className="mb-4">
                      <Text className="text-sm font-msemibold text-gray-900 mb-2">
                        {selectedCategory === "job_vacancy"
                          ? "Salary (Nu.)"
                          : "Price (Nu.)"}
                        {(selectedCategory === "rent" ||
                          selectedCategory === "second_hand") && (
                          <Text className="text-red-500">*</Text>
                        )}
                        {selectedCategory === "job_vacancy" && (
                          <Text className="text-gray-400 text-xs ml-1">
                            (Optional)
                          </Text>
                        )}
                      </Text>
                      <TextInput
                        value={price}
                        onChangeText={setPrice}
                        placeholder={
                          selectedCategory === "job_vacancy"
                            ? "Enter salary or leave empty"
                            : "Enter price"
                        }
                        keyboardType="numeric"
                        className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular"
                      />
                    </View>
                  )}

                  {/* Dzongkhag Dropdown (Optional) */}
                  <View className="mb-4">
                    <Text className="text-sm font-msemibold text-gray-900 mb-2">
                      Location (Dzongkhag){" "}
                      <Text className="text-gray-400 text-xs">(Optional)</Text>
                    </Text>
                    <View className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <Picker
                        selectedValue={dzongkhag}
                        onValueChange={(itemValue) => setDzongkhag(itemValue)}
                        style={{ height: 50 }}
                      >
                        <Picker.Item label="Select Dzongkhag" value="" />
                        {dzongkhagCenters.map((dz) => (
                          <Picker.Item
                            key={dz.name}
                            label={dz.name}
                            value={dz.name}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {/* Tags Field */}
                  <View className="mb-4">
                    <Text className="text-sm font-msemibold text-gray-900 mb-2">
                      Tags{" "}
                      <Text className="text-gray-400 text-xs">(Optional)</Text>
                    </Text>
                    <TextInput
                      value={tags}
                      onChangeText={setTags}
                      placeholder="Add tags (separated by commas)"
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      Example: furniture, affordable, like-new
                    </Text>
                  </View>

                  {/* Images Section */}
                  <View className="mb-4">
                    <Text className="text-sm font-msemibold text-gray-900 mb-2">
                      Images <Text className="text-red-500">*</Text> (Up to 5)
                    </Text>

                    {/* Image Grid */}
                    <View className="flex-row flex-wrap gap-2">
                      {selectedImages.map((uri, index) => (
                        <View key={index} className="relative w-20 h-20">
                          <Image
                            source={{ uri }}
                            className="w-full h-full rounded-lg"
                          />
                          <TouchableOpacity
                            onPress={() => handleRemoveImage(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                          >
                            <Trash2 size={14} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}

                      {/* Add Image Button */}
                      {selectedImages.length < 5 && (
                        <TouchableOpacity
                          onPress={handleAddImage}
                          className="w-20 h-20 bg-gray-100 rounded-lg items-center justify-center border-2 border-dashed border-gray-300"
                        >
                          <Camera size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className={`mt-4 py-4 rounded-lg items-center justify-center ${
                      isSubmitting ? "bg-gray-400" : "bg-primary"
                    }`}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-msemibold text-base">
                        Create Post
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </Animated.View>

        {/* Image Picker Sheet */}
        <ImagePickerSheet
          visible={showPickerSheet}
          onClose={() => setShowPickerSheet(false)}
          onCameraPress={openCamera}
          onGalleryPress={openGallery}
        />

        {/* Success/Error/Warning Popups */}
        <PopupMessage
          visible={showSuccess}
          type="success"
          message={popupMessage}
        />
        <PopupMessage visible={showError} type="error" message={popupMessage} />
        <PopupMessage
          visible={showWarning}
          type="warning"
          message={popupMessage}
        />
      </View>

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
    </>
  );
}
