// Path: app/(tabs)/profile.tsx
import ProfileSettings from "@/components/ProfileSettings";
import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import { Camera, Edit3, ImageIcon, Image as ImageLucide, Mail, Phone, Settings, ShoppingBag, User, Wrench } from 'lucide-react-native';
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function ProfileScreen() {
  const { currentUser, logout } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'images' | 'products' | 'tools'>('images');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [userImages, setUserImages] = useState<string[]>([]);

  // Fetch user posts when component mounts or user changes
  useEffect(() => {
    const loadUserPosts = async () => {
      if (!currentUser?.id) {
        setLoadingPosts(false);
        return;
      }

      try {
        setLoadingPosts(true);
        const posts = await fetchUserPosts(currentUser.id);
        setUserPosts(posts);

        // Extract all images from posts
        const allImages: string[] = [];
        posts.forEach(post => {
          if (post.images && post.images.length > 0) {
            allImages.push(...post.images);
          }
        });
        setUserImages(allImages);
      } catch (error) {
        console.error('Error loading user posts:', error);
        Alert.alert('Error', 'Failed to load your posts');
      } finally {
        setLoadingPosts(false);
      }
    };

    loadUserPosts();
  }, [currentUser?.id]);

  const handleEditProfile = () => {
    setShowImagePicker(true);
  };

  const handleSettings = () => {
    setShowSettings(true);
  };

  const handleImageOption = async (option: 'camera' | 'gallery') => {
    setShowImagePicker(false);
    
    try {
      let result;
      
      if (option === 'camera') {
        // Request camera permissions
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to take photos.');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        // Request gallery permissions
        const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          Alert.alert('Permission Required', 'Gallery access is needed to select photos.');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
        // Here you would typically upload the image and update user profile
        console.log('Selected image:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  if (!currentUser) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />
        
        <View className="flex-1 items-center justify-center px-4">
          <User size={72} className="text-gray-700 mb-4" />
          <Text className="text-xl font-mbold text-gray-700 mb-2">
            Not Logged In
          </Text>
          <Text className="text-sm font-regular text-gray-500 text-center mb-6">
            Please log in to view your profile
          </Text>
          
          <TouchableOpacity
            onPress={() => router.replace("/login")}
            className="bg-primary rounded-xl py-3 px-6"
            activeOpacity={0.8}
          >
            <Text className="text-white font-msemibold">
              Go to Login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />
      
      {/* Header with Settings */}
      <View className="flex-row items-center justify-end px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={handleSettings}
          className="w-10 h-10 items-center justify-center"
          activeOpacity={0.7}
        >
          <Settings size={24} className="text-gray-700" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-white border-b border-gray-100 px-4 py-8">
          <View className="items-center">
            {/* Profile Image with Edit Button */}
            <View className="relative mb-4">
              <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    className="w-24 h-24 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </View>
              
              {/* Edit Profile Button */}
              <TouchableOpacity
                onPress={handleEditProfile}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
                activeOpacity={0.8}
              >
                <Edit3 size={16} className="text-white" />
              </TouchableOpacity>
            </View>

            {currentUser.name && (
              <Text className="text-2xl font-mbold text-gray-900 mb-1">
                {currentUser.name}
              </Text>
            )}

    

            {currentUser.email && (
              <View className="flex-row items-center mb-2">
                <Mail size={16} color="#6B7280" />
                <Text className="text-sm font-regular text-gray-500 ml-1">
                  {currentUser.email}
                </Text>
              </View>
            )}

            {currentUser.phone_number && (
              <View className="flex-row items-center mb-6">
                <Phone size={16} color="#6B7280" />
                <Text className="text-sm font-regular text-gray-500 ml-1">
                  {currentUser.phone_number}
                </Text>
              </View>
            )}

            {/* Stats */}
            <View className="flex-row items-center space-x-6">
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">
                  {currentUser.products?.length || 0}
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Products
                </Text>
              </View>

              <Text className="text-gray-300 text-xl font-light">|</Text>

              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">
                  {currentUser.followers || 0}
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Followers
                </Text>
              </View>

              <Text className="text-gray-300 text-xl font-light">|</Text>

              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">
                  {currentUser.following || 0}
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Following
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View className="bg-white border-b border-gray-100">
          <View className="flex-row">
            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'images' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('images')}
            >
              <ImageLucide size={24} className={`mb-1 ${
                activeTab === 'images' ? 'text-primary' : 'text-gray-500'
              }`} />
              <Text className={`font-msemibold text-xs ${
                activeTab === 'images' ? 'text-primary' : 'text-gray-500'
              }`}>
                Images
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'products' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('products')}
            >
              <ShoppingBag size={24} className={`mb-1 ${
                activeTab === 'products' ? 'text-primary' : 'text-gray-500'
              }`} />
              <Text className={`font-msemibold text-xs ${
                activeTab === 'products' ? 'text-primary' : 'text-gray-500'
              }`}>
                Products
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'tools' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('tools')}
            >
              <Wrench size={24} className={`mb-1 ${
                activeTab === 'tools' ? 'text-primary' : 'text-gray-500'
              }`} />
              <Text className={`font-msemibold text-xs ${
                activeTab === 'tools' ? 'text-primary' : 'text-gray-500'
              }`}>
                Tools
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 py-4">
          {activeTab === 'images' && (
            <>
              {loadingPosts ? (
                <View className="items-center justify-center py-12">
                  <ActivityIndicator size="large" color="#059669" />
                  <Text className="text-sm font-regular text-gray-500 mt-4">
                    Loading posts...
                  </Text>
                </View>
              ) : userImages.length > 0 ? (
                <View className="flex-row flex-wrap">
                  {userImages.map((imageUrl, index) => (
                    <View key={index} className="w-[33.33%] aspect-square p-1">
                      <View className="flex-1 bg-gray-200 rounded-lg overflow-hidden">
                        <Image
                          source={{ uri: imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="items-center justify-center py-12">
                  <ImageLucide size={48} className="text-gray-400 mb-4" />
                  <Text className="text-lg font-msemibold text-gray-700 mb-2">
                    No Images Yet
                  </Text>
                  <Text className="text-sm font-regular text-gray-500 text-center">
                    Create a post with images to see them here
                  </Text>
                </View>
              )}
            </>
          )}
          
          {activeTab === 'products' && (
            <View className="flex-row flex-wrap">
              {[1, 2].map((index) => (
                <View key={index} className="w-[33.33%] aspect-square p-1">
                  <View className="flex-1 bg-gray-200 rounded-lg overflow-hidden">
                    <Image
                      source={require('@/assets/images/all.png')}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
          
          {activeTab === 'tools' && (
            <View className="items-center justify-center py-12">
              <Wrench size={48} className="text-gray-700 mb-4" />
              <Text className="text-lg font-msemibold text-gray-700 mb-2">
                Tools
              </Text>
              <Text className="text-sm font-regular text-gray-500 text-center">
                No tools available
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Image Picker Bottom Sheet */}
      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setShowImagePicker(false)}
        >
          <View className="bg-white rounded-t-3xl p-6">
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />
            
            <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
              Change Profile Picture
            </Text>

            <TouchableOpacity
              className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
              onPress={() => handleImageOption('camera')}
              activeOpacity={0.7}
            >
              <Camera size={24} className="text-gray-700 mr-4" />
              <View>
                <Text className="text-base font-msemibold text-gray-900">
                  Take Photo
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Use camera to take a new photo
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-6"
              onPress={() => handleImageOption('gallery')}
              activeOpacity={0.7}
            >
              <ImageIcon size={24} className="text-gray-700 mr-4" />
              <View>
                <Text className="text-base font-msemibold text-gray-900">
                  Choose from Gallery
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  Select from your photo library
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-100 rounded-xl py-4 items-center"
              onPress={() => setShowImagePicker(false)}
              activeOpacity={0.8}
            >
              <Text className="text-gray-600 font-msemibold">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Overlay */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <ProfileSettings 
          onClose={() => setShowSettings(false)}
          currentUser={currentUser}
          onLogout={async () => {
            setShowSettings(false);
            await logout();
            router.replace("/login");
          }}
        />
      </Modal>
    </View>
  );
}