import { categories } from '@/data/categories';
import { createProduct, uploadProductImages } from '@/lib/productsService';
import * as ImagePicker from 'expo-image-picker';
import { Check, DollarSign, Upload, X } from 'lucide-react-native';
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

interface CreateProductModalProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
}

export default function CreateProductModal({ isVisible, onClose, userId }: CreateProductModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  
  // Tag State (Selected tags)
  const [tags, setTags] = useState<string[]>([]);

  const categoryKeys = Object.keys(categories);

  // Derive available tags (subcategories) based on selection
  const availableTags = selectedCategory 
    ? categories[selectedCategory].map(sub => sub.name) 
    : [];

  // Clear tags when category changes
  useEffect(() => {
    setTags([]);
  }, [selectedCategory]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
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

  
// In handlePost:
const handlePost = async () => {
  if (!name || !price || !selectedCategory) {
    Alert.alert('Missing Fields', 'Please fill in the Name, Price, and Category.');
    return;
  }

  if (tags.length === 0) {
    Alert.alert('Missing Tags', 'Please select at least one tag.');
    return;
  }

  setLoading(true);

  try {
    // Upload images
    const uploadedUrls = images.length > 0 
      ? await uploadProductImages(images, userId) 
      : [];

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

    Alert.alert('Success', 'Product posted successfully!');
    
    // Reset form
    setName('');
    setDescription('');
    setPrice('');
    setTags([]);
    setImages([]);
    setSelectedCategory(null);
    onClose();

  } catch (error: any) {
    console.error("Post error:", error);
    Alert.alert('Error', error.message || "Failed to create post");
  } finally {
    setLoading(false);
  }
};

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl h-[90%] w-full overflow-hidden">
            
            {/* Header */}
            <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-900">Sell an Item</Text>
              <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                <X size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
              
              {/* Image Picker Section */}
              <View className="mt-5">
                <Text className="text-sm font-semibold text-gray-700 mb-3">Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  <TouchableOpacity 
                    onPress={pickImage}
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl justify-center items-center mr-3 bg-gray-50"
                  >
                    <Upload size={24} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400 mt-1">Add Photo</Text>
                  </TouchableOpacity>

                  {images.map((uri, index) => (
                    <View key={index} className="relative mr-3">
                      <Image source={{ uri }} className="w-24 h-24 rounded-xl" />
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
                  <Text className="text-sm font-medium text-gray-700 mb-1">Product Name</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="e.g. Vintage Leather Jacket"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-1">Price</Text>
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

                {/* Category Selection */}
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                    {categoryKeys.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full border ${
                          selectedCategory === cat 
                            ? 'bg-primary border-primary' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <Text className={selectedCategory === cat ? 'text-white font-medium' : 'text-gray-600'}>
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
                      Tags <Text className="text-gray-400 font-normal">(Select at least one)</Text>
                    </Text>
                    {selectedCategory && (
                        <TouchableOpacity onPress={handleSelectAllTags}>
                            <Text className="text-xs text-primary font-medium">
                                {tags.length === availableTags.length ? 'Deselect All' : 'Select All'}
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
                                                ? 'bg-primary/10 border-primary' 
                                                : 'bg-white border-gray-200'
                                        }`}
                                    >
                                        <Text className={`text-xs ${
                                            isSelected ? 'text-primary font-medium' : 'text-gray-600'
                                        }`}>
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
                  <Text className="text-sm font-medium text-gray-700 mb-1">Description</Text>
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
                  loading ? 'bg-gray-300' : 'bg-primary'
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-lg">Post Item</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}