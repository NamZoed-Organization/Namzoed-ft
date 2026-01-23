import ImageCropperOverlay from "@/components/modals/ImageCropperOverlay";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import PopupMessage from "@/components/ui/PopupMessage";
import { serviceCategories } from "@/data/servicecategory";
import {
  ProviderServiceWithDetails,
  updateProviderService,
  uploadServiceImages,
} from "@/lib/servicesService";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Check, Trash2, Upload, X } from "lucide-react-native";
import React, { useState } from "react";
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
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface EditServicesModalProps {
  isVisible: boolean;
  onClose: () => void;
  service: ProviderServiceWithDetails;
  userId: string;
  onSuccess: () => void;
}

export default function EditServicesModal({
  isVisible,
  onClose,
  service,
  userId,
  onSuccess,
}: EditServicesModalProps) {
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

  // Form State - Pre-populated from service
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(
    service.service_categories?.slug || "",
  );

  // Image State - Separate existing from new
  const [existingImages, setExistingImages] = useState<string[]>(
    service.images,
  );
  const [newImages, setNewImages] = useState<string[]>([]);

  // Image selection mode for deletion
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>(
    [],
  );
  const [isImageSelectionMode, setIsImageSelectionMode] = useState(false);

  // Image picker and crop states
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Animation
  const translateX = useSharedValue(isVisible ? 0 : 400);

  React.useEffect(() => {
    if (isVisible) {
      translateX.value = withTiming(0, { duration: 300 });
    } else {
      translateX.value = withTiming(400, { duration: 300 });
    }
  }, [isVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showErrorPopup("Camera access is needed to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
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
        showErrorPopup("Gallery access is needed to select photos.");
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

  const handleLongPressImage = (index: number) => {
    Haptics.notificationAsync(NotificationFeedbackType.Success);
    setIsImageSelectionMode(true);
    setSelectedImageIndices([index]);
  };

  const toggleImageSelection = (index: number) => {
    Haptics.impactAsync(ImpactFeedbackStyle.Light);
    setSelectedImageIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const handleDeleteSelectedImages = () => {
    Alert.alert(
      "Delete Images",
      `Remove ${selectedImageIndices.length} image(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setExistingImages((prev) =>
              prev.filter((_, i) => !selectedImageIndices.includes(i)),
            );
            setIsImageSelectionMode(false);
            setSelectedImageIndices([]);
            Haptics.notificationAsync(NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const handleCancelImageSelection = () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Light);
    setIsImageSelectionMode(false);
    setSelectedImageIndices([]);
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
    // Validation
    if (!name.trim() || !description.trim()) {
      showErrorPopup("Please fill in all required fields.");
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
          ? await uploadServiceImages(newImages, service.provider_id)
          : [];

      // Combine existing + newly uploaded images
      const finalImages = [...existingImages, ...uploadedUrls];

      // Update service
      await updateProviderService(service.id, {
        name,
        description,
        images: finalImages,
      });

      showSuccessPopup("Service updated successfully!", () => {
        onSuccess();
      });
    } catch (error: any) {
      console.error("Update error:", error);
      showErrorPopup(error.message || "Failed to update service");
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  const selectedCategory = serviceCategories.find(
    (cat) => cat.slug === selectedCategorySlug,
  );

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
                      Edit Service
                    </Text>
                    <Text className="text-gray-500 text-xs font-mregular">
                      Update your service details
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
                      <TouchableOpacity
                        key={`existing-${index}`}
                        onLongPress={() => handleLongPressImage(index)}
                        onPress={() =>
                          isImageSelectionMode && toggleImageSelection(index)
                        }
                        activeOpacity={0.8}
                        className="relative mr-3"
                      >
                        <Image
                          source={{ uri: url }}
                          className="w-24 h-24 rounded-xl"
                        />

                        {/* Selection overlay */}
                        {isImageSelectionMode && (
                          <View
                            className={`absolute inset-0 rounded-xl ${
                              selectedImageIndices.includes(index)
                                ? "border-4 border-red-500 bg-red-500/20"
                                : ""
                            } items-center justify-center`}
                          >
                            {selectedImageIndices.includes(index) && (
                              <View className="bg-red-500 rounded-full p-2">
                                <X size={20} color="white" strokeWidth={3} />
                              </View>
                            )}
                          </View>
                        )}

                        {!isImageSelectionMode && (
                          <View className="absolute bottom-1 left-1 bg-white/80 rounded px-1">
                            <Text className="text-[10px] text-gray-600">
                              Existing
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
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
                    {!isImageSelectionMode && (
                      <TouchableOpacity
                        onPress={pickImage}
                        className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl justify-center items-center mr-3 bg-gray-50"
                      >
                        <Upload size={24} color="#9CA3AF" />
                        <Text className="text-xs text-gray-400 mt-1">
                          Add Photo
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>

                {/* Service Info */}
                <View className="mt-6 gap-y-5">
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Service Name
                    </Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                      placeholder="e.g. Professional Photography Service"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Description
                    </Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[120px]"
                      placeholder="Describe your service..."
                      multiline
                      textAlignVertical="top"
                      value={description}
                      onChangeText={setDescription}
                    />
                  </View>

                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Category
                    </Text>
                    <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                      <Text className="text-gray-900 font-mmedium">
                        {selectedCategory?.name || "No category selected"}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-0.5">
                        Category cannot be changed after creation
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom spacing */}
                <View className="h-32" />
              </ScrollView>

              {/* Floating Delete Bar for Image Selection */}
              {isImageSelectionMode && selectedImageIndices.length > 0 && (
                <Animated.View
                  entering={FadeInDown.duration(400)}
                  exiting={FadeOutDown}
                  className="absolute bottom-24 left-6 right-6 h-20 bg-gray-900 rounded-[35px] flex-row items-center justify-between px-8 shadow-2xl"
                >
                  <View>
                    <Text className="text-white font-mbold text-lg">
                      {selectedImageIndices.length}
                    </Text>
                    <Text className="text-gray-400 text-[10px] uppercase tracking-widest font-mbold">
                      Selected Images
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-x-4">
                    <TouchableOpacity onPress={handleCancelImageSelection}>
                      <Text className="text-gray-400 font-msemibold">
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeleteSelectedImages}
                      className="bg-red-500 flex-row items-center px-6 py-3 rounded-full"
                    >
                      <Trash2 size={18} color="white" />
                      <Text className="text-white font-mbold ml-2">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {/* Fixed Footer with BlurView */}
              <BlurView
                intensity={80}
                tint="light"
                className="border-t border-gray-200/50"
              >
                <View className="px-6 py-4">
                  <TouchableOpacity
                    onPress={handleUpdate}
                    disabled={loading}
                    className="bg-primary rounded-[24px] py-4 shadow-md flex-row items-center justify-center"
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Check size={20} color="white" strokeWidth={3} />
                        <Text className="text-white font-mbold ml-2 text-base">
                          Update Service
                        </Text>
                      </>
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
