import { MarketplaceItem, updateMarketplaceItem, uploadMarketplaceImages } from '@/lib/postMarketPlace';
import { dzongkhagCenters } from '@/data/dzongkhag';
import * as ImagePicker from 'expo-image-picker';
import { Briefcase, DollarSign, Upload, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
  View
} from 'react-native';
import PopupMessage from '@/components/ui/PopupMessage';
import ImagePickerSheet from '@/components/ui/ImagePickerSheet';
import ImageCropOverlay from '@/components/ImageCropOverlay';
import { Picker } from '@react-native-picker/picker';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

interface EditMarketplaceModalProps {
  isVisible: boolean;
  onClose: () => void;
  item: MarketplaceItem;
  userId: string;
  onSuccess: () => void;
}

export default function EditMarketplaceModal({ isVisible, onClose, item, userId, onSuccess }: EditMarketplaceModalProps) {
  const [loading, setLoading] = useState(false);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

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

  // Form State - Pre-populated from item
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(
    typeof item.description === 'string'
      ? item.description
      : (item.description as any)?.text || ''
  );

  // Job-specific fields
  const [jobDescription, setJobDescription] = useState(
    item.type === 'job_vacancy' && typeof item.description === 'object' && 'description' in item.description
      ? item.description.description
      : ''
  );
  const [jobRequirements, setJobRequirements] = useState(
    item.type === 'job_vacancy' && typeof item.description === 'object' && 'requirements' in item.description
      ? item.description.requirements || ''
      : ''
  );
  const [jobResponsibilities, setJobResponsibilities] = useState(
    item.type === 'job_vacancy' && typeof item.description === 'object' && 'responsibilities' in item.description
      ? item.description.responsibilities || ''
      : ''
  );

  const [price, setPrice] = useState(item.price.toString());
  const [selectedType, setSelectedType] = useState<'rent' | 'swap' | 'second_hand' | 'free' | 'job_vacancy'>(item.type);
  const [dzongkhag, setDzongkhag] = useState(item.dzongkhag || '');
  const [tags, setTags] = useState(item.tags.join(', ')); // Freeform text

  // Image State - Separate existing from new
  const [existingImages, setExistingImages] = useState<string[]>(item.images);
  const [newImages, setNewImages] = useState<string[]>([]);

  // Image picker and crop states
  const [showPickerSheet, setShowPickerSheet] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

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
    transform: [{ translateX: translateX.value }]
  }));

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setShowCropOverlay(true);
    }
  };

  const openGallery = async () => {
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

  const pickImage = () => {
    setShowPickerSheet(true);
  };

  const handleCropSave = (croppedUri: string) => {
    setNewImages([...newImages, croppedUri]);
    setShowCropOverlay(false);
    setPendingImageUri(null);
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setPendingImageUri(null);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
    // Validation
    if (!title || !selectedType) {
      showErrorPopup('Please fill in the Title and Type.');
      return;
    }

    // Price validation for rent/second_hand
    if ((selectedType === 'rent' || selectedType === 'second_hand') && (!price || parseFloat(price) <= 0)) {
      showErrorPopup('Please enter a valid price for rent or second hand items.');
      return;
    }

    const totalImages = existingImages.length + newImages.length;
    if (totalImages === 0) {
      showErrorPopup('Please add at least one image.');
      return;
    }

    setLoading(true);

    try {
      // Upload only new images
      const uploadedUrls = newImages.length > 0
        ? await uploadMarketplaceImages(newImages)
        : [];

      // Combine existing + newly uploaded images
      const finalImages = [...existingImages, ...uploadedUrls];

      // Price handling:
      // - swap/free: Always 0
      // - job_vacancy: Use entered value or 0 if empty
      // - rent/second_hand: Use entered value (validated above)
      let finalPrice = 0;
      if (selectedType === 'swap' || selectedType === 'free') {
        finalPrice = 0;
      } else if (selectedType === 'job_vacancy') {
        finalPrice = price.trim() ? parseFloat(price) : 0;
      } else {
        finalPrice = parseFloat(price);
      }

      // Parse tags
      const parsedTags = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Build description based on type
      let descriptionData;
      if (selectedType === 'job_vacancy') {
        // Structured JSONB for job vacancies
        descriptionData = {
          description: jobDescription.trim(),
          ...(jobRequirements.trim() && { requirements: jobRequirements.trim() }),
          ...(jobResponsibilities.trim() && { responsibilities: jobResponsibilities.trim() }),
        };
      } else {
        // Simple text format for other categories
        descriptionData = { text: description.trim() };
      }

      // Update marketplace item
      await updateMarketplaceItem(item.id, {
        type: selectedType,
        title: title.trim(),
        description: descriptionData,
        price: finalPrice,
        images: finalImages,
        dzongkhag: dzongkhag || undefined,
        tags: parsedTags,
      });

      showSuccessPopup('Marketplace item updated successfully!', () => {
        onSuccess();
      });
    } catch (error: any) {
      console.error("Update error:", error);
      showErrorPopup(error.message || "Failed to update item");
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
              <BlurView intensity={90} tint="light" className="border-b border-gray-200/50">
                <View className="flex-row justify-between items-center px-6 py-4">
                  <View>
                    <Text className="text-2xl font-mbold text-gray-900">Edit Marketplace Item</Text>
                    <Text className="text-gray-500 text-xs font-mregular">Update your listing details</Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    className="bg-white/60 p-2.5 rounded-full shadow-sm border border-gray-100"
                  >
                    <X size={20} color="#1F2937" />
                  </TouchableOpacity>
                </View>
              </BlurView>

              <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>

                {/* Image Picker Section */}
                <View className="mt-5">
                  <Text className="text-sm font-semibold text-gray-700 mb-3">Photos <Text className="text-red-500">*</Text></Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">

                    {/* Existing Images */}
                    {existingImages.map((url, index) => (
                      <View key={`existing-${index}`} className="relative mr-3">
                        <Image source={{ uri: url }} className="w-24 h-24 rounded-xl" />
                        <TouchableOpacity
                          onPress={() => removeExistingImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 border-2 border-white"
                        >
                          <X size={12} color="white" />
                        </TouchableOpacity>
                        <View className="absolute bottom-1 left-1 bg-white/80 rounded px-1">
                          <Text className="text-[10px] text-gray-600">Existing</Text>
                        </View>
                      </View>
                    ))}

                    {/* New Images */}
                    {newImages.map((uri, index) => (
                      <View key={`new-${index}`} className="relative mr-3">
                        <Image source={{ uri }} className="w-24 h-24 rounded-xl" />
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
                      <Text className="text-xs text-gray-400 mt-1">Add Photo</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* Marketplace Item Info */}
                <View className="mt-6 gap-y-5">
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">Title</Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                      placeholder="e.g. Apartment for Rent in Thimphu"
                      value={title}
                      onChangeText={setTitle}
                      maxLength={100}
                    />
                  </View>

                  {/* Type Selection */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">Type</Text>
                    <View className="flex-row gap-2 flex-wrap">
                      {(['rent', 'swap', 'second_hand', 'free', 'job_vacancy'] as const).map((typeOption) => (
                        <TouchableOpacity
                          key={typeOption}
                          onPress={() => setSelectedType(typeOption)}
                          className={`py-2 px-3 rounded-full border ${
                            selectedType === typeOption
                              ? 'bg-primary border-primary'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Text className={`text-center text-xs ${selectedType === typeOption ? 'text-white font-medium' : 'text-gray-600'}`}>
                            {typeOption === 'second_hand' ? 'Second Hand' : typeOption === 'job_vacancy' ? 'Job Vacancy' : typeOption.charAt(0).toUpperCase() + typeOption.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      {selectedType === 'job_vacancy' ? 'Salary' : 'Price'}
                      {(selectedType === 'rent' || selectedType === 'second_hand') && <Text className="text-red-500">*</Text>}
                      {selectedType === 'job_vacancy' && <Text className="text-gray-400 text-xs ml-1">(Optional)</Text>}
                    </Text>
                    <View className="relative">
                      <View className="absolute left-4 top-3.5 z-10">
                         <Text className="text-gray-600 font-medium">Nu.</Text>
                      </View>
                      <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl pl-14 pr-4 py-3 text-gray-900"
                        placeholder={selectedType === 'swap' || selectedType === 'free' ? '0' : selectedType === 'job_vacancy' ? 'Enter salary or leave empty' : '0.00'}
                        keyboardType="numeric"
                        value={price}
                        onChangeText={setPrice}
                        editable={selectedType !== 'swap' && selectedType !== 'free'}
                        style={{ opacity: selectedType === 'swap' || selectedType === 'free' ? 0.5 : 1 }}
                      />
                    </View>
                    {(selectedType === 'swap' || selectedType === 'free') && (
                      <Text className="text-xs text-gray-500 mt-1">Price is not required for {selectedType} items</Text>
                    )}
                  </View>

                  {/* Location (Dzongkhag) */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">Location (Optional)</Text>
                    <View className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                      <Picker
                        selectedValue={dzongkhag}
                        onValueChange={(value) => setDzongkhag(value)}
                        style={{ height: 50 }}
                      >
                        <Picker.Item label="Select Dzongkhag" value="" />
                        {dzongkhagCenters.map((dz) => (
                          <Picker.Item key={dz.name} label={dz.name} value={dz.name} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {/* Tags (Freeform) */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Tags <Text className="text-gray-400 font-normal">(Optional, comma-separated)</Text>
                    </Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                      placeholder="e.g. 2BHK, furnished, parking"
                      value={tags}
                      onChangeText={setTags}
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      Separate tags with commas
                    </Text>
                  </View>

                  {/* Conditional Description/Job Fields */}
                  {selectedType === 'job_vacancy' ? (
                    // Job-specific fields
                    <>
                      <View>
                        <Text className="text-sm font-medium text-gray-700 mb-1">
                          Job Description <Text className="text-red-500">*</Text>
                        </Text>
                        <TextInput
                          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[100px]"
                          placeholder="Describe the role and what makes it unique"
                          multiline
                          textAlignVertical="top"
                          value={jobDescription}
                          onChangeText={setJobDescription}
                          maxLength={500}
                        />
                        <Text className="text-xs text-gray-500 mt-1">{jobDescription.length}/500</Text>
                      </View>

                      <View>
                        <Text className="text-sm font-medium text-gray-700 mb-1">
                          Requirements <Text className="text-gray-400 text-xs">(Optional)</Text>
                        </Text>
                        <TextInput
                          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[100px]"
                          placeholder="List required qualifications and skills"
                          multiline
                          textAlignVertical="top"
                          value={jobRequirements}
                          onChangeText={setJobRequirements}
                          maxLength={500}
                        />
                        <Text className="text-xs text-gray-500 mt-1">{jobRequirements.length}/500</Text>
                      </View>

                      <View>
                        <Text className="text-sm font-medium text-gray-700 mb-1">
                          Responsibilities <Text className="text-gray-400 text-xs">(Optional)</Text>
                        </Text>
                        <TextInput
                          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[100px]"
                          placeholder="List key responsibilities and duties"
                          multiline
                          textAlignVertical="top"
                          value={jobResponsibilities}
                          onChangeText={setJobResponsibilities}
                          maxLength={500}
                        />
                        <Text className="text-xs text-gray-500 mt-1">{jobResponsibilities.length}/500</Text>
                      </View>
                    </>
                  ) : (
                    // Regular description for other categories
                    <View>
                      <Text className="text-sm font-medium text-gray-700 mb-1">
                        Description <Text className="text-red-500">*</Text>
                      </Text>
                      <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[100px]"
                        placeholder="Describe your item..."
                        multiline
                        textAlignVertical="top"
                        value={description}
                        onChangeText={setDescription}
                        maxLength={500}
                      />
                      <Text className="text-xs text-gray-500 mt-1">{description.length}/500</Text>
                    </View>
                  )}

                </View>

                {/* Spacing for bottom button */}
                <View className="h-32" />
              </ScrollView>

              {/* Premium Footer / Submit Button */}
              <BlurView intensity={80} tint="light" className="absolute bottom-0 left-0 right-0 border-t border-gray-200/50">
                <View className="p-5">
                  <TouchableOpacity
                    onPress={handleUpdate}
                    disabled={loading}
                    className={`w-full py-4 rounded-[24px] flex-row justify-center items-center shadow-lg ${
                      loading ? 'bg-gray-300' : 'bg-primary'
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-mbold text-lg">Update Item</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </BlurView>

            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Success/Error Popups */}
        <PopupMessage visible={showSuccess} type="success" message={popupMessage} />
        <PopupMessage visible={showError} type="error" message={popupMessage} />

        {/* Image Picker Sheet */}
        <ImagePickerSheet
          visible={showPickerSheet}
          onClose={() => setShowPickerSheet(false)}
          onCameraPress={openCamera}
          onGalleryPress={openGallery}
        />
      </Animated.View>

      {/* Image Crop Overlay */}
      {showCropOverlay && pendingImageUri && (
        <Modal visible={showCropOverlay} animationType="slide">
          <ImageCropOverlay
            imageUri={pendingImageUri}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        </Modal>
      )}
    </Modal>
  );
}
