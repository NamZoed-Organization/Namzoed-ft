import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StatusBar,
  Pressable,
} from "react-native";
import {
  ArrowLeft,
  Camera,
  Video,
  Radio,
  ImageIcon,
  MapPin,
  ChevronDown,
  X,
  Plus,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useUser } from "@/contexts/UserContext";
import { categories } from "@/data/categories";
import * as ImagePicker from 'expo-image-picker';
import { createPost, uploadImages, uploadVideos } from "@/lib/postsService";

const LOCATIONS = [
  "My Location",
  "Bumthang",
  "Chhukha",
  "Dagana",
  "Gasa",
  "Haa",
  "Lhuntse",
  "Mongar",
  "Paro",
  "Pemagatshel",
  "Punakha",
  "Samdrup Jongkhar",
  "Samtse",
  "Sarpang",
  "Thimphu",
  "Trashigang",
  "Trashiyangtse",
  "Trongsa",
  "Tsirang",
  "Wangdue Phodrang",
  "Zhemgang",
];

interface MediaItem {
  uri: string;
  type: 'image' | 'video';
  id: string;
}

interface CreatePostProps {
  onClose?: () => void;
}

export default function CreatePost({ onClose }: CreatePostProps) {
  const router = useRouter();
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<"post" | "sell">("post");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [sellForm, setSellForm] = useState({
    title: "",
    price: "",
    category: "",
    tags: "",
    location: "My Location",
    description: "",
  });
  const [sellMedia, setSellMedia] = useState<MediaItem[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImagePicker, setShowImagePickerModal] = useState(false);
  const [showVideoPicker, setShowVideoPickerModal] = useState(false);
  const [pickerContext, setPickerContext] = useState<{ isForSell: boolean }>({ isForSell: false });
  const [isUploading, setIsUploading] = useState(false);

  // Debug logging for state changes
  useEffect(() => {
    console.log('CreatePost component state update');
    console.log('Current state:', {
      activeTab,
      postMediaCount: postMedia.length,
      sellMediaCount: sellMedia.length,
      showImagePicker,
      showVideoPicker
    });
  }, [activeTab, postMedia.length, sellMedia.length, showImagePicker, showVideoPicker]);

  const showImagePickerModal = (isForSell: boolean = false) => {
    console.log(`Image picker button pressed for ${isForSell ? 'sell' : 'post'} tab`);
    setPickerContext({ isForSell });
    setShowImagePickerModal(true);
    console.log('Image picker modal should be visible now');
  };

  const showVideoPickerModal = (isForSell: boolean = false) => {
    console.log(`Video picker button pressed for ${isForSell ? 'sell' : 'post'} tab`);
    setPickerContext({ isForSell });
    setShowVideoPickerModal(true);
    console.log('Video picker modal should be visible now');
  };

  const pickImageFromCamera = async (isForSell: boolean = false) => {
    console.log('Starting camera image picker, isForSell:', isForSell);
    
    try {
      console.log('Available ImagePicker object:', Object.keys(ImagePicker));

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const newMedia: MediaItem = {
          uri: result.assets[0].uri,
          type: 'image',
          id: Date.now().toString(),
        };
        
        console.log('Adding new image media:', newMedia);
        
        if (isForSell) {
          setSellMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated sell media array:', updated.length, 'items');
            return updated;
          });
        } else {
          setPostMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated post media array:', updated.length, 'items');
            return updated;
          });
        }
      } else {
        console.log('Image picking canceled or failed');
      }
    } catch (error) {
      console.error('Error picking image from camera:', error);
    }
  };

  const pickImageFromGallery = async (isForSell: boolean = false) => {
    console.log('Starting gallery image picker, isForSell:', isForSell);


    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      console.log('Gallery result:', result);

      if (!result.canceled && result.assets[0]) {
        const newMedia: MediaItem = {
          uri: result.assets[0].uri,
          type: 'image',
          id: Date.now().toString(),
        };
        
        console.log('Adding new image media:', newMedia);
        
        if (isForSell) {
          setSellMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated sell media array:', updated.length, 'items');
            return updated;
          });
        } else {
          setPostMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated post media array:', updated.length, 'items');
            return updated;
          });
        }
      } else {
        console.log('Image picking canceled or failed');
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
    }
  };

  const pickVideoFromCamera = async (isForSell: boolean = false) => {
    console.log('Starting camera video picker, isForSell:', isForSell);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 1,
      });

      console.log('Camera video result:', result);

      if (!result.canceled && result.assets[0]) {
        const newMedia: MediaItem = {
          uri: result.assets[0].uri,
          type: 'video',
          id: Date.now().toString(),
        };
        
        console.log('Adding new video media:', newMedia);
        
        if (isForSell) {
          setSellMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated sell media array:', updated.length, 'items');
            return updated;
          });
        } else {
          setPostMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated post media array:', updated.length, 'items');
            return updated;
          });
        }
      } else {
        console.log('Video picking canceled or failed');
      }
    } catch (error) {
      console.error('Error picking video from camera:', error);
    }
  };

  const pickVideoFromGallery = async (isForSell: boolean = false) => {
    console.log('Starting gallery video picker, isForSell:', isForSell);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 1,
      });

      console.log('Gallery video result:', result);

      if (!result.canceled && result.assets[0]) {
        const newMedia: MediaItem = {
          uri: result.assets[0].uri,
          type: 'video',
          id: Date.now().toString(),
        };
        
        console.log('Adding new video media:', newMedia);
        
        if (isForSell) {
          setSellMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated sell media array:', updated.length, 'items');
            return updated;
          });
        } else {
          setPostMedia(prev => {
            const updated = [...prev, newMedia];
            console.log('Updated post media array:', updated.length, 'items');
            return updated;
          });
        }
      } else {
        console.log('Video picking canceled or failed');
      }
    } catch (error) {
      console.error('Error picking video from gallery:', error);
    }
  };

  const removeMedia = (id: string, isForSell: boolean = false) => {
    if (isForSell) {
      setSellMedia(prev => prev.filter(item => item.id !== id));
    } else {
      setPostMedia(prev => prev.filter(item => item.id !== id));
    }
  };

  const renderMediaGrid = (media: MediaItem[], isForSell: boolean = false) => {
    console.log(`Rendering media grid for ${isForSell ? 'sell' : 'post'} tab:`, media.length, 'items');
    console.log('Media items:', media.map(item => ({ id: item.id, type: item.type, uri: item.uri.substring(0, 50) + '...' })));
    
    if (media.length === 0) {
      console.log('No media items to display');
      return null;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row">
          {media.map((item) => (
            <View key={item.id} className="relative mr-3">
              <Image 
                source={{ uri: item.uri }} 
                className="w-20 h-20 rounded-lg bg-gray-200"
                resizeMode="cover"
                onLoad={() => console.log(`Media loaded successfully for ${item.id}`)}
                onError={(error) => console.error(`Media load error for ${item.id}:`, error.nativeEvent)}
              />
              {item.type === 'video' && (
                <View className="absolute inset-0 items-center justify-center">
                  <View className="bg-black/60 rounded-full p-2">
                    <Video size={16} color="white" />
                  </View>
                </View>
              )}
              <TouchableOpacity
                className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center z-20"
                onPress={() => {
                  console.log(`Removing media item ${item.id} from ${isForSell ? 'sell' : 'post'} tab`);
                  removeMedia(item.id, isForSell);
                }}
              >
                <X size={12} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const handleLocationSelect = (location: string) => {
    setSellForm({ ...sellForm, location });
    setShowLocationModal(false);
  };

  const handleCategorySelect = (category: string) => {
    setSellForm({ ...sellForm, category });
    setShowCategoryModal(false);
  };

  const handleSharePost = async () => {
    // Validate user is logged in
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create a post');
      return;
    }

    // Get user ID
    const userId = (currentUser as any).id;

    // Validate user has ID
    if (!userId) {
      Alert.alert('Error', 'User information is incomplete. Please log in again.');
      return;
    }

    // Validate at least one field is filled
    if (!postText.trim() && postMedia.length === 0) {
      Alert.alert('Error', 'Please add some text or media to your post');
      return;
    }

    try {
      setIsUploading(true);

      console.log('=== Starting Post Creation ===');
      console.log('Current user:', currentUser);
      console.log('User ID:', userId);
      console.log('Post text:', postText);
      console.log('Post media:', postMedia);

      // Separate images and videos
      const imageUris = postMedia
        .filter(item => item.type === 'image')
        .map(item => item.uri);

      const videoUris = postMedia
        .filter(item => item.type === 'video')
        .map(item => item.uri);

      let uploadedMediaUrls: string[] = [];

      // Upload images to Supabase storage
      if (imageUris.length > 0) {
        console.log('Uploading images to Supabase...', imageUris);
        try {
          const uploadedImageUrls = await uploadImages(imageUris);
          console.log('Images uploaded successfully:', uploadedImageUrls);
          uploadedMediaUrls.push(...uploadedImageUrls);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          Alert.alert('Error', `Failed to upload images: ${uploadError.message || uploadError}`);
          return;
        }
      }

      // Upload videos to Supabase storage
      if (videoUris.length > 0) {
        console.log('Uploading videos to Supabase...', videoUris);
        try {
          const uploadedVideoUrls = await uploadVideos(videoUris);
          console.log('Videos uploaded successfully:', uploadedVideoUrls);
          uploadedMediaUrls.push(...uploadedVideoUrls);
        } catch (uploadError) {
          console.error('Video upload error:', uploadError);
          Alert.alert('Error', `Failed to upload videos: ${uploadError.message || uploadError}`);
          return;
        }
      }

      // Create post in Supabase
      console.log('Creating post with data:', {
        content: postText.trim(),
        images: uploadedMediaUrls,
        userId: userId,
      });

      try {
        const newPost = await createPost({
          content: postText.trim(),
          images: uploadedMediaUrls, // This array now contains both image and video URLs
          userId: userId,
        });

        console.log('Post created successfully:', newPost);

        // Show success message briefly
        Alert.alert('Success', 'Your post has been published!', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setPostText('');
              setPostMedia([]);

              // Close modal and go back to feed
              onClose?.();
            }
          }
        ]);
      } catch (postError) {
        console.error('Post creation error:', postError);
        Alert.alert('Error', `Failed to create post: ${postError.message || postError}`);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message || error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const renderLocationModal = () => (
    <Modal
      visible={showLocationModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setShowLocationModal(false)}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowLocationModal(false)}
        activeOpacity={1}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold">Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LOCATIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="px-4 py-3 border-b border-gray-100"
                  onPress={() => handleLocationSelect(item)}
                >
                  <Text className={`text-base ${item === sellForm.location ? 'text-blue-600 font-medium' : 'text-gray-800'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderCategoryModal = () => (
    <Modal
      visible={showCategoryModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setShowCategoryModal(false)}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowCategoryModal(false)}
        activeOpacity={1}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold">Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={Object.keys(categories)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="px-4 py-3 border-b border-gray-100"
                  onPress={() => handleCategorySelect(item)}
                >
                  <Text className={`text-base capitalize ${item === sellForm.category ? 'text-blue-600 font-medium' : 'text-gray-800'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderImagePickerModal = () => (
    <Modal
      visible={showImagePicker}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setShowImagePickerModal(false)}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowImagePickerModal(false)}
        activeOpacity={1}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-t-3xl">
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-center">Select Image</Text>
            </View>
            <View className="p-4">
              <TouchableOpacity
                className="flex-row items-center py-4 px-2"
                onPress={() => {
                  pickImageFromCamera(pickerContext.isForSell);
                  setShowImagePickerModal(false);
                }}
              >
                <Camera size={24} color="#666" />
                <Text className="ml-4 text-base text-gray-800">Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center py-4 px-2 border-t border-gray-100"
                onPress={() => {
                  pickImageFromGallery(pickerContext.isForSell);
                  setShowImagePickerModal(false);
                }}
              >
                <ImageIcon size={24} color="#666" />
                <Text className="ml-4 text-base text-gray-800">Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center justify-center py-4 px-2 border-t border-gray-100 mt-2"
                onPress={() => setShowImagePickerModal(false)}
              >
                <Text className="text-base text-red-600">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderVideoPickerModal = () => (
    <Modal
      visible={showVideoPicker}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setShowVideoPickerModal(false)}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowVideoPickerModal(false)}
        activeOpacity={1}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-t-3xl">
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-center">Select Video</Text>
            </View>
            <View className="p-4">
              <TouchableOpacity
                className="flex-row items-center py-4 px-2"
                onPress={() => {
                  pickVideoFromCamera(pickerContext.isForSell);
                  setShowVideoPickerModal(false);
                }}
              >
                <Video size={24} color="#666" />
                <Text className="ml-4 text-base text-gray-800">Record Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center py-4 px-2 border-t border-gray-100"
                onPress={() => {
                  pickVideoFromGallery(pickerContext.isForSell);
                  setShowVideoPickerModal(false);
                }}
              >
                <Video size={24} color="#666" />
                <Text className="ml-4 text-base text-gray-800">Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center justify-center py-4 px-2 border-t border-gray-100 mt-2"
                onPress={() => setShowVideoPickerModal(false)}
              >
                <Text className="text-base text-red-600">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderPostTab = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="p-4">
        {/* User Profile */}
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold text-lg">
              {((currentUser as any)?.username || (currentUser as any)?.name || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-lg font-semibold text-gray-800">
            {(currentUser as any)?.username || (currentUser as any)?.name || "User"}
          </Text>
        </View>

        {/* Text Input */}
        <TextInput
          className="text-base text-gray-800 mb-4 min-h-[100px] border border-gray-300 rounded-lg px-3 py-2"
          placeholder="What's on your mind?"
          multiline
          value={postText}
          onChangeText={setPostText}
          style={{ textAlignVertical: "top" }}
        />

        {/* Media Selection */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Add Media</Text>
          {renderMediaGrid(postMedia, false)}
          <View className="flex-row">
            <TouchableOpacity 
              className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg mr-2"
              onPress={() => showImagePickerModal(false)}
            >
              <ImageIcon size={18} color="#059669" />
              <Text className="ml-1 text-sm font-medium text-gray-700">Add Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg"
              onPress={() => showVideoPickerModal(false)}
            >
              <Video size={18} color="#DC2626" />
              <Text className="ml-1 text-sm font-medium text-gray-700">Add Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderSellTab = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="p-4">
        {/* User Profile */}
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold text-lg">
              {((currentUser as any)?.username || (currentUser as any)?.name || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-lg font-semibold text-gray-800">
            {(currentUser as any)?.username || (currentUser as any)?.name || "User"}
          </Text>
        </View>

        {/* Title Field */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Title</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2 text-base"
            placeholder="What are you selling?"
            value={sellForm.title}
            onChangeText={(text) => setSellForm({ ...sellForm, title: text })}
          />
        </View>

        {/* Price Field */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Price (BTN)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2 text-base"
            placeholder="Enter price"
            value={sellForm.price}
            onChangeText={(text) => setSellForm({ ...sellForm, price: text })}
            keyboardType="numeric"
          />
        </View>

        {/* Category Field */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Category</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-lg px-3 py-2 flex-row items-center justify-between"
            onPress={() => setShowCategoryModal(true)}
          >
            <Text className={`text-base ${sellForm.category ? 'text-gray-800' : 'text-gray-400'}`}>
              {sellForm.category ? sellForm.category.charAt(0).toUpperCase() + sellForm.category.slice(1) : "Select category"}
            </Text>
            <ChevronDown size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Tags Field */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Tags</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2 text-base"
            placeholder="Add tags (separated by commas)"
            value={sellForm.tags}
            onChangeText={(text) => setSellForm({ ...sellForm, tags: text })}
          />
        </View>

        {/* Location Field */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Location</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-lg px-3 py-2 flex-row items-center justify-between"
            onPress={() => setShowLocationModal(true)}
          >
            <View className="flex-row items-center">
              <MapPin size={16} color="#666" />
              <Text className="text-base text-gray-800 ml-2">{sellForm.location}</Text>
            </View>
            <ChevronDown size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Description Field */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Description</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-3 py-2 text-base min-h-[100px]"
            placeholder="Describe your item..."
            value={sellForm.description}
            onChangeText={(text) => setSellForm({ ...sellForm, description: text })}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Media Section - Moved Below Fields */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Product Images/Videos</Text>
          {renderMediaGrid(sellMedia, true)}
          <View className="flex-row">
            <TouchableOpacity 
              className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg mr-2"
              onPress={() => showImagePickerModal(true)}
            >
              <ImageIcon size={18} color="#059669" />
              <Text className="ml-1 text-sm font-medium text-gray-700">Add Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg"
              onPress={() => showVideoPickerModal(true)}
            >
              <Video size={18} color="#DC2626" />
              <Text className="ml-1 text-sm font-medium text-gray-700">Add Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-white">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => onClose ? onClose() : router.back()}
            className="mr-4"
            disabled={isUploading}
          >
            <ArrowLeft size={24} color={isUploading ? "#ccc" : "#000"} />
          </TouchableOpacity>
          <Text className="text-xl font-semibold">Post</Text>
        </View>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg flex-row items-center"
          onPress={handleSharePost}
          disabled={isUploading || (activeTab === 'post' && !postText.trim() && postMedia.length === 0)}
        >
          {isUploading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-white font-medium ml-2">Posting...</Text>
            </>
          ) : (
            <Text className="text-white font-medium">Share</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200">
        <TouchableOpacity
          className={`flex-1 py-3 items-center ${activeTab === "post" ? "border-b-2 border-primary" : ""}`}
          onPress={() => setActiveTab("post")}
        >
          <Text className={`font-medium ${activeTab === "post" ? "text-primary" : "text-gray-600"}`}>
            Post
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center ${activeTab === "sell" ? "border-b-2 border-primary" : ""}`}
          onPress={() => setActiveTab("sell")}
        >
          <Text className={`font-medium ${activeTab === "sell" ? "text-primary" : "text-gray-600"}`}>
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "post" ? renderPostTab() : renderSellTab()}

      {/* Modals */}
      {renderLocationModal()}
      {renderCategoryModal()}
      {renderImagePickerModal()}
      {renderVideoPickerModal()}
    </View>
  );
}