import ImageCropperOverlay from "@/components/modals/ImageCropperOverlay";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { serviceCategories } from "@/data/servicecategory";
import { createProviderService } from "@/lib/servicesService";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { ChevronDown, ChevronUp, Upload, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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

interface AddServicesModalProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
}

export default function AddServicesModal({
  isVisible,
  onClose,
  userId,
  onSuccess,
}: AddServicesModalProps) {
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

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);

  // Image picker and crop states
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Animation - Slide up from bottom
  const translateY = useSharedValue(1000);

  useEffect(() => {
    if (isVisible) {
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = withTiming(1000, { duration: 300 });
    }
  }, [isVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Reset form when modal closes
  useEffect(() => {
    if (!isVisible) {
      setSelectedCategory("");
      setName("");
      setDescription("");
      setImages([]);
      setIsCategoryExpanded(false);
    }
  }, [isVisible]);

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

  // Get selected category name
  const getSelectedCategoryName = () => {
    const category = serviceCategories.find(
      (cat) => cat.slug === selectedCategory,
    );
    return category ? category.name : null;
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedCategory) {
      showErrorPopup("Please select a service category.");
      return;
    }

    if (!name.trim()) {
      showErrorPopup("Please provide a name for your service.");
      return;
    }

    if (!description.trim()) {
      showErrorPopup("Please provide a description for your service.");
      return;
    }

    if (images.length === 0) {
      showErrorPopup("Please add at least one image for your service.");
      return;
    }

    setLoading(true);

    try {
      // Create provider service
      await createProviderService(
        userId,
        selectedCategory,
        name,
        description,
        images,
      );

      showSuccessPopup("Service added successfully!", () => {
        onSuccess();
        onClose();
      });
    } catch (error: any) {
      console.error("Create service error:", error);

      // Check for duplicate service error
      if (error.code === "23505") {
        showErrorPopup(
          "You have already added this service category. Please edit your existing service instead.",
        );
      } else {
        showErrorPopup(error.message || "Failed to add service");
      }
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
              {/* Header */}
              <BlurView
                intensity={90}
                tint="light"
                className="border-b border-gray-200/50"
              >
                <View className="flex-row justify-between items-center px-6 py-4">
                  <View>
                    <Text className="text-2xl font-mbold text-gray-900">
                      Add Service
                    </Text>
                    <Text className="text-gray-500 text-xs font-mregular">
                      List your professional service
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
                {/* Category Selection - Accordion Style */}
                <View className="mt-5">
                  {/* Header with selected category */}
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold text-gray-700">
                        Service Category <Text className="text-red-500">*</Text>
                      </Text>
                      {getSelectedCategoryName() && (
                        <View className="bg-primary/10 px-2 py-1 rounded-md">
                          <Text className="text-xs text-primary font-medium">
                            {getSelectedCategoryName()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Accordion Toggle Button */}
                  <TouchableOpacity
                    onPress={() => setIsCategoryExpanded(!isCategoryExpanded)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-row justify-between items-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-gray-700 text-sm">
                      {getSelectedCategoryName() || "Select a category"}
                    </Text>
                    {isCategoryExpanded ? (
                      <ChevronUp size={20} color="#6B7280" />
                    ) : (
                      <ChevronDown size={20} color="#6B7280" />
                    )}
                  </TouchableOpacity>

                  {/* Category Options - Expandable */}
                  {isCategoryExpanded && (
                    <View className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                      <View className="flex-row flex-wrap gap-2">
                        {serviceCategories.map((category) => (
                          <TouchableOpacity
                            key={category.id}
                            onPress={() => {
                              setSelectedCategory(category.slug);
                              setIsCategoryExpanded(false);
                            }}
                            className={`px-3 py-2 rounded-lg border flex-row items-center ${
                              selectedCategory === category.slug
                                ? "bg-primary border-primary"
                                : "bg-white border-gray-300"
                            }`}
                          >
                            {/* Radio button indicator */}
                            <View
                              className={`w-4 h-4 rounded-full border-2 mr-2 items-center justify-center ${
                                selectedCategory === category.slug
                                  ? "border-white"
                                  : "border-gray-400"
                              }`}
                            >
                              {selectedCategory === category.slug && (
                                <View className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </View>
                            <Text
                              className={`text-xs ${
                                selectedCategory === category.slug
                                  ? "text-white font-semibold"
                                  : "text-gray-700"
                              }`}
                            >
                              {category.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Service Name */}
                <View className="mt-6">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Service Name <Text className="text-red-500">*</Text>
                  </Text>
                  <Text className="text-xs text-gray-500 mb-2">
                    Give your service a catchy name
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="e.g., Express Taxi Service, Professional Photography, etc."
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* Description */}
                <View className="mt-6">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Service Description <Text className="text-red-500">*</Text>
                  </Text>
                  <Text className="text-xs text-gray-500 mb-2">
                    Describe what you offer in this category
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[120px]"
                    placeholder="e.g., Professional taxi service with 5+ years experience. Available 24/7 for airport pickups and city tours..."
                    multiline
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                {/* Image Picker Section */}
                <View className="mt-6">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Service Photos <Text className="text-red-500">*</Text>
                  </Text>
                  <Text className="text-xs text-gray-500 mb-3">
                    Add photos of your work, equipment, or location
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                  >
                    {/* Selected Images */}
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

                {/* Spacing for bottom button */}
                <View className="h-32" />
              </ScrollView>

              {/* Submit Button */}
              <BlurView
                intensity={80}
                tint="light"
                className="absolute bottom-0 left-0 right-0 border-t border-gray-200/50"
              >
                <View className="p-5">
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={loading}
                    className={`w-full py-4 rounded-[24px] flex-row justify-center items-center shadow-lg ${
                      loading ? "bg-gray-300" : "bg-primary"
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-mbold text-lg">
                        Add Service
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          </View>
        </KeyboardAvoidingView>

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
      </Animated.View>

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
