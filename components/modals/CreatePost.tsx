import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import PopupMessage from "@/components/ui/PopupMessage";
import {
  ArrowLeft,
  Video,
  ImageIcon,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useUser } from "@/contexts/UserContext";
import * as ImagePicker from 'expo-image-picker';
import { createPost, uploadImages, uploadVideos } from "@/lib/postsService";

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
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<MediaItem[]>([]);
  const [showImagePicker, setShowImagePickerModal] = useState(false);
  const [showVideoPicker, setShowVideoPickerModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const showErrorPopup = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (message: string, callback?: () => void) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      callback?.();
    }, 2000);
  };

  const pickImageFromCamera = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        showErrorPopup('Camera access is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setPostMedia(prev => [...prev, { uri: result.assets[0].uri, type: 'image', id: Date.now().toString() }]);
      }
    } catch (error) {
      console.error('Error picking image from camera:', error);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libraryPermission.granted) {
        showErrorPopup('Photo library access is needed to select images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setPostMedia(prev => [...prev, { uri: result.assets[0].uri, type: 'image', id: Date.now().toString() }]);
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
    }
  };

  const pickVideoFromCamera = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        showErrorPopup('Camera access is needed to record videos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setPostMedia(prev => [...prev, { uri: result.assets[0].uri, type: 'video', id: Date.now().toString() }]);
      }
    } catch (error) {
      console.error('Error picking video from camera:', error);
    }
  };

  const pickVideoFromGallery = async () => {
    try {
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libraryPermission.granted) {
        showErrorPopup('Photo library access is needed to select videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setPostMedia(prev => [...prev, { uri: result.assets[0].uri, type: 'video', id: Date.now().toString() }]);
      }
    } catch (error) {
      console.error('Error picking video from gallery:', error);
    }
  };

  const removeMedia = (id: string) => {
    setPostMedia(prev => prev.filter(item => item.id !== id));
  };

  const renderMediaGrid = () => {
    if (postMedia.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row">
          {postMedia.map((item) => (
            <View key={item.id} className="relative mr-3">
              <Image
                source={{ uri: item.uri }}
                className="w-20 h-20 rounded-lg bg-gray-200"
                resizeMode="cover"
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
                onPress={() => removeMedia(item.id)}
              >
                <X size={12} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const handleSharePost = async () => {
    if (!currentUser) {
      showErrorPopup('You must be logged in to create a post');
      return;
    }
    const userId = (currentUser as any).id;
    if (!userId) {
      showErrorPopup('User information is incomplete. Please log in again.');
      return;
    }
    if (!postText.trim() && postMedia.length === 0) {
      showErrorPopup('Please add some text or media to your post');
      return;
    }

    try {
      setIsUploading(true);

      const imageUris = postMedia.filter(item => item.type === 'image').map(item => item.uri);
      const videoUris = postMedia.filter(item => item.type === 'video').map(item => item.uri);
      let uploadedMediaUrls: string[] = [];

      if (imageUris.length > 0) {
        try {
          const uploadedImageUrls = await uploadImages(imageUris);
          uploadedMediaUrls.push(...uploadedImageUrls);
        } catch (uploadError: any) {
          showErrorPopup(`Failed to upload images: ${uploadError.message || uploadError}`);
          return;
        }
      }

      if (videoUris.length > 0) {
        try {
          const uploadedVideoUrls = await uploadVideos(videoUris);
          uploadedMediaUrls.push(...uploadedVideoUrls);
        } catch (uploadError: any) {
          showErrorPopup(`Failed to upload videos: ${uploadError.message || uploadError}`);
          return;
        }
      }

      try {
        await createPost({
          content: postText.trim(),
          images: uploadedMediaUrls,
          userId,
        });
        showSuccessPopup('Your post has been published!', () => {
          setPostText('');
          setPostMedia([]);
          onClose?.();
        });
      } catch (postError: any) {
        showErrorPopup(`Failed to create post: ${postError.message || postError}`);
      }
    } catch (error: any) {
      showErrorPopup(`An unexpected error occurred: ${error.message || error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const renderImagePickerModal = () => (
    <Modal
      visible={showImagePicker}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setShowImagePickerModal(false)}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowImagePickerModal(false)}
        activeOpacity={1}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl">
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-center">Select Image</Text>
            </View>
            <View className="p-4">
              <TouchableOpacity
                className="flex-row items-center py-4 px-2"
                onPress={() => { pickImageFromCamera(); setShowImagePickerModal(false); }}
              >
                <ImageIcon size={24} color="#666" />
                <Text className="ml-4 text-base text-gray-800">Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center py-4 px-2 border-t border-gray-100"
                onPress={() => { pickImageFromGallery(); setShowImagePickerModal(false); }}
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
        </TouchableOpacity>
      </TouchableOpacity>
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
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-end"
        onPress={() => setShowVideoPickerModal(false)}
        activeOpacity={1}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl">
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-center">Select Video</Text>
            </View>
            <View className="p-4">
              <TouchableOpacity
                className="flex-row items-center py-4 px-2"
                onPress={() => { pickVideoFromCamera(); setShowVideoPickerModal(false); }}
              >
                <Video size={24} color="#666" />
                <Text className="ml-4 text-base text-gray-800">Record Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center py-4 px-2 border-t border-gray-100"
                onPress={() => { pickVideoFromGallery(); setShowVideoPickerModal(false); }}
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
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View className="flex-1 bg-white">
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
          <Text className="text-xl font-semibold">Create Post</Text>
        </View>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg flex-row items-center"
          onPress={handleSharePost}
          disabled={isUploading || (!postText.trim() && postMedia.length === 0)}
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

      {/* Post Content */}
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

          {/* Media */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Add Media</Text>
            {renderMediaGrid()}
            <View className="flex-row">
              <TouchableOpacity
                className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg mr-2"
                onPress={() => setShowImagePickerModal(true)}
              >
                <ImageIcon size={18} color="#059669" />
                <Text className="ml-1 text-sm font-medium text-gray-700">Add Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center px-3 py-2 bg-gray-100 rounded-lg"
                onPress={() => setShowVideoPickerModal(true)}
              >
                <Video size={18} color="#DC2626" />
                <Text className="ml-1 text-sm font-medium text-gray-700">Add Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {renderImagePickerModal()}
      {renderVideoPickerModal()}

      <PopupMessage visible={showSuccess} type="success" message={successMessage} />
      <PopupMessage visible={showError} type="error" message={errorMessage} />
    </View>
  );
}
