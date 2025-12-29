import { ArrowLeft, Camera, Gift, Home, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react-native';
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Modal, PanResponder, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@/contexts/UserContext';
import ImageCropOverlay from './ImageCropOverlay';
import { createMarketplaceItem, uploadMarketplaceImages } from '@/lib/postMarketPlace';
import { dzongkhagCenters } from '@/data/dzongkhag';

interface MarketplacePostOverlayProps {
  onClose: () => void;
  onCategorySelect?: (category: string) => void;
}

type Category = "rent" | "swap" | "secondhand" | "free" | null;

const CATEGORY_LABELS = {
  rent: "Rent",
  swap: "Swap",
  secondhand: "Second Hand",
  free: "Free"
};

export default function MarketplacePostOverlay({ onClose, onCategorySelect }: MarketplacePostOverlayProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>(null);
  const { currentUser } = useUser();

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [dzongkhag, setDzongkhag] = useState('');
  const [tags, setTags] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image crop overlay
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Vertical slide for drag-to-close
  const panY = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  // --- Pan Responder for Drag-to-Close ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activate if dragging down vertically more than horizontally
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging downwards
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) { // Drag threshold: 100px or 500px/s velocity
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
            bounciness: 4
          }).start();
        }
      },
    })
  ).current;

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    if (onCategorySelect && category) {
      onCategorySelect(category);
    }
  };

  const handleAddImage = async () => {
    if (selectedImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload up to 5 images only.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setShowCropOverlay(true);
    }
  };

  const handleCropSave = (croppedUri: string) => {
    setSelectedImages([...selectedImages, croppedUri]);
    setShowCropOverlay(false);
    setPendingImageUri(null);
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setPendingImageUri(null);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!selectedCategory) return 'Please select a category';
    if (!title.trim()) return 'Please enter a title';
    if (title.length > 100) return 'Title must be 100 characters or less';
    if (!description.trim()) return 'Please enter a description';
    if (description.length > 500) return 'Description must be 500 characters or less';

    // Price is only required for rent and secondhand
    if ((selectedCategory === 'rent' || selectedCategory === 'secondhand')) {
      if (!price.trim()) return 'Please enter a price';
      if (isNaN(Number(price)) || Number(price) < 0) return 'Please enter a valid price';
    }

    if (selectedImages.length === 0) return 'Please add at least one image';
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload images
      const uploadedUrls = await uploadMarketplaceImages(selectedImages);

      // Price is 0 for swap and free, otherwise use the entered value
      const finalPrice = (selectedCategory === 'swap' || selectedCategory === 'free')
        ? 0
        : Number(price);

      // Parse tags from comma-separated string
      const parsedTags = tags.trim()
        ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : [];

      // Create marketplace item with category name as type
      await createMarketplaceItem({
        type: selectedCategory as any, // Use category name directly: rent, swap, secondhand, free
        title: title.trim(),
        description: description.trim(),
        price: finalPrice,
        images: uploadedUrls,
        dzongkhag: dzongkhag || undefined,
        tags: parsedTags,
        userId: currentUser.id,
      });

      Alert.alert('Success', 'Your post has been created!');
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          transform: [{ translateY: panY }]
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

              {/* 4 Tab Buttons */}
              <View className="flex-row items-center w-full gap-2 mb-6">
                {/* Rent Tab */}
                <TouchableOpacity
                  onPress={() => handleCategorySelect("rent")}
                  className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                    selectedCategory === "rent"
                      ? "border-2 border-black"
                      : ""
                  }`}
                >
                  <Home
                    size={20}
                    color="black"
                  />
                </TouchableOpacity>

                {/* Swap Tab */}
                <TouchableOpacity
                  onPress={() => handleCategorySelect("swap")}
                  className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                    selectedCategory === "swap"
                      ? "border-2 border-black"
                      : ""
                  }`}
                >
                  <RefreshCw
                    size={20}
                    color="black"
                  />
                </TouchableOpacity>

                {/* Second Hand Tab */}
                <TouchableOpacity
                  onPress={() => handleCategorySelect("secondhand")}
                  className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                    selectedCategory === "secondhand"
                      ? "border-2 border-black"
                      : ""
                  }`}
                >
                  <ShoppingCart
                    size={20}
                    color="black"
                  />
                </TouchableOpacity>

                {/* Free Tab */}
                <TouchableOpacity
                  onPress={() => handleCategorySelect("free")}
                  className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                    selectedCategory === "free"
                      ? "border-2 border-black"
                      : ""
                  }`}
                >
                  <Gift
                    size={20}
                    color="black"
                  />
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
                  <Text className="text-xs text-gray-500 mt-1">{title.length}/100</Text>
                </View>

                {/* Description Input */}
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
                  <Text className="text-xs text-gray-500 mt-1">{description.length}/500</Text>
                </View>

                {/* Price Input - Only for rent and secondhand */}
                {(selectedCategory === 'rent' || selectedCategory === 'secondhand') && (
                  <View className="mb-4">
                    <Text className="text-sm font-msemibold text-gray-900 mb-2">
                      Price (Nu.) <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      value={price}
                      onChangeText={setPrice}
                      placeholder="Enter price"
                      keyboardType="numeric"
                      className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-base font-regular"
                    />
                  </View>
                )}

                {/* Dzongkhag Dropdown (Optional) */}
                <View className="mb-4">
                  <Text className="text-sm font-msemibold text-gray-900 mb-2">
                    Location (Dzongkhag) <Text className="text-gray-400 text-xs">(Optional)</Text>
                  </Text>
                  <View className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <Picker
                      selectedValue={dzongkhag}
                      onValueChange={(itemValue) => setDzongkhag(itemValue)}
                      style={{ height: 50 }}
                    >
                      <Picker.Item label="Select Dzongkhag" value="" />
                      {dzongkhagCenters.map((dz) => (
                        <Picker.Item key={dz.name} label={dz.name} value={dz.name} />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Tags Field */}
                <View className="mb-4">
                  <Text className="text-sm font-msemibold text-gray-900 mb-2">
                    Tags <Text className="text-gray-400 text-xs">(Optional)</Text>
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
                        <Image source={{ uri }} className="w-full h-full rounded-lg" />
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
                    isSubmitting ? 'bg-gray-400' : 'bg-primary'
                  }`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-msemibold text-base">Create Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </Animated.View>

      {/* Image Crop Overlay Modal */}
      {showCropOverlay && pendingImageUri && (
        <Modal
          visible={showCropOverlay}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={handleCropCancel}
        >
          <ImageCropOverlay
            imageUri={pendingImageUri}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        </Modal>
      )}
    </View>
  );
}
