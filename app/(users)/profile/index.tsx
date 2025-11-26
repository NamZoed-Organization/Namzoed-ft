// Path: app/(tabs)/profile.tsx
import ImageViewer from "@/components/ImageViewer";
import ProfileSettings from "@/components/ProfileSettings";
import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Camera,
  Edit3,
  ImageIcon,
  Image as ImageLucide,
  Mail,
  Play,
  Settings,
  ShoppingBag,
  User,
  Wrench,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// --- Reanimated & Gesture Handler ---
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// Helper to check if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("post-videos")
  );
};

export default function ProfileScreen() {
  const { currentUser, logout } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"images" | "products" | "tools">(
    "images"
  );

  // UI State
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Data State
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [userImages, setUserImages] = useState<string[]>([]);

  // ImageViewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [imagePostMap, setImagePostMap] = useState<Map<string, Post>>(
    new Map()
  );

  // ------------------------------------------------------
  // 1. SMOOTH ANIMATION LOGIC (Reanimated)
  // ------------------------------------------------------

  const pickerTranslateY = useSharedValue(0);
  const pickerContext = useSharedValue({ y: 0 });

  // --- Gesture for Image Picker ---
  const pickerGesture = Gesture.Pan()
    .onStart(() => {
      pickerContext.value = { y: pickerTranslateY.value };
    })
    .onUpdate((e) => {
      // Only allow drag down
      if (e.translationY > 0)
        pickerTranslateY.value = e.translationY + pickerContext.value.y;
    })
    .onEnd((e) => {
      if (pickerTranslateY.value > 100 || e.velocityY > 500) {
        pickerTranslateY.value = withTiming(1000, { duration: 250 }, (finished) => {
          if (finished) runOnJS(setShowImagePicker)(false);
        });
      } else {
        pickerTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  useEffect(() => { if (showImagePicker) pickerTranslateY.value = 0; }, [showImagePicker]);

  const rPickerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pickerTranslateY.value }] }));
  const rPickerBackdrop = useAnimatedStyle(() => ({ opacity: 1 - pickerTranslateY.value / 500 }));

  // ------------------------------------------------------
  // END ANIMATION LOGIC
  // ------------------------------------------------------

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

        const allImages: string[] = [];
        const postMap = new Map<string, Post>();

        posts.forEach((post) => {
          if (post.images && post.images.length > 0) {
            post.images.forEach((imageUrl: string) => {
              allImages.push(imageUrl);
              postMap.set(imageUrl, post);
            });
          }
        });

        setUserImages(allImages);
        setImagePostMap(postMap);
      } catch (error) {
        console.error("Error loading user posts:", error);
        Alert.alert("Error", "Failed to load your posts");
      } finally {
        setLoadingPosts(false);
      }
    };
    loadUserPosts();
  }, [currentUser?.id]);

  const handleEditProfile = () => setShowImagePicker(true);
  const handleSettings = () => setShowSettings(true);

  const handleMediaClick = (imageUrl: string) => {
    const post = imagePostMap.get(imageUrl);
    if (!post) return;
    const mediaIndex = post.images.findIndex((img: string) => img === imageUrl);
    setSelectedPost(post);
    setSelectedMediaIndex(mediaIndex >= 0 ? mediaIndex : 0);
    setShowImageViewer(true);
  };

  const handleImageOption = async (option: "camera" | "gallery") => {
    pickerTranslateY.value = withTiming(1000, {}, () =>
      runOnJS(setShowImagePicker)(false)
    );

    try {
      let result;
      if (option === "camera") {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert("Permission Required", "Camera access is needed.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          Alert.alert("Permission Required", "Gallery access is needed.");
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
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image.");
    }
  };

  if (!currentUser) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-4">
        <User size={72} className="text-gray-700 mb-4" />
        <Text className="text-xl font-mbold text-gray-700 mb-2">Not Logged In</Text>
        <TouchableOpacity onPress={() => router.replace("/login")} className="bg-primary rounded-xl py-3 px-6">
          <Text className="text-white font-msemibold">Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="h-12 bg-white" />

      {/* Header */}
      <View className="flex-row items-center justify-end px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={handleSettings} className="w-10 h-10 items-center justify-center">
          <Settings size={24} className="text-gray-700" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-white border-b border-gray-100 px-4 py-8">
          <View className="items-center">
            <View className="relative mb-4">
              <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
                {profileImage ? (
                  <Image source={{ uri: profileImage }} className="w-24 h-24 rounded-full" resizeMode="cover" />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </View>
              <TouchableOpacity onPress={handleEditProfile} className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white">
                <Edit3 size={16} className="text-white" />
              </TouchableOpacity>
            </View>

            {currentUser.name && <Text className="text-2xl font-mbold text-gray-900 mb-1">{currentUser.name}</Text>}
            {currentUser.email && (
              <View className="flex-row items-center mb-2">
                <Mail size={16} color="#6B7280" />
                <Text className="text-sm font-regular text-gray-500 ml-1">{currentUser.email}</Text>
              </View>
            )}
            
            <View className="flex-row items-center space-x-6 mt-4">
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">{currentUser.products?.length || 0}</Text>
                <Text className="text-sm font-regular text-gray-500">Products</Text>
              </View>
              <Text className="text-gray-300 text-xl font-light">|</Text>
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">{currentUser.followers || 0}</Text>
                <Text className="text-sm font-regular text-gray-500">Followers</Text>
              </View>
              <Text className="text-gray-300 text-xl font-light">|</Text>
              <View className="items-center">
                <Text className="text-xl font-mbold text-gray-900">{currentUser.following || 0}</Text>
                <Text className="text-sm font-regular text-gray-500">Following</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View className="bg-white border-b border-gray-100">
          <View className="flex-row">
            <TouchableOpacity className={`flex-1 py-4 items-center border-b-2 ${activeTab === "images" ? "border-primary" : "border-transparent"}`} onPress={() => setActiveTab("images")}>
              <ImageLucide size={24} className={`mb-1 ${activeTab === "images" ? "text-primary" : "text-gray-500"}`} />
              <Text className={`font-msemibold text-xs ${activeTab === "images" ? "text-primary" : "text-gray-500"}`}>Images</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-1 py-4 items-center border-b-2 ${activeTab === "products" ? "border-primary" : "border-transparent"}`} onPress={() => setActiveTab("products")}>
              <ShoppingBag size={24} className={`mb-1 ${activeTab === "products" ? "text-primary" : "text-gray-500"}`} />
              <Text className={`font-msemibold text-xs ${activeTab === "products" ? "text-primary" : "text-gray-500"}`}>Products</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-1 py-4 items-center border-b-2 ${activeTab === "tools" ? "border-primary" : "border-transparent"}`} onPress={() => setActiveTab("tools")}>
              <Wrench size={24} className={`mb-1 ${activeTab === "tools" ? "text-primary" : "text-gray-500"}`} />
              <Text className={`font-msemibold text-xs ${activeTab === "tools" ? "text-primary" : "text-gray-500"}`}>Tools</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 py-4">
          {activeTab === "images" && (
            <>
              {loadingPosts ? (
                <ActivityIndicator size="large" color="#059669" className="py-12" />
              ) : userImages.length > 0 ? (
                <View className="flex-row flex-wrap">
                  {userImages.map((imageUrl, index) => {
                    const isVideo = isVideoUrl(imageUrl);
                    return (
                      <View key={index} className="w-[33.33%] aspect-square p-1">
                        <TouchableOpacity className="flex-1 bg-gray-200 rounded-lg overflow-hidden relative" onPress={() => handleMediaClick(imageUrl)}>
                          <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                          {isVideo && (
                            <View className="absolute inset-0 items-center justify-center bg-black/30">
                              <View className="bg-white rounded-full p-2">
                                <Play size={24} color="#000" fill="#000" />
                              </View>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="items-center justify-center py-12">
                  <ImageLucide size={48} className="text-gray-400 mb-4" />
                  <Text className="text-lg font-msemibold text-gray-700">No Images Yet</Text>
                </View>
              )}
            </>
          )}
          {activeTab === "products" && <Text className="text-center py-8 text-gray-500">Products Tab Placeholder</Text>}
          {activeTab === "tools" && <Text className="text-center py-8 text-gray-500">Tools Tab Placeholder</Text>}
        </View>
        <View className="h-8" />
      </ScrollView>

      {/* ------------------------------------------------------ */}
      {/* SMOOTH IMAGE PICKER MODAL */}
      {/* ------------------------------------------------------ */}
      {showImagePicker && (
        <Modal transparent statusBarTranslucent animationType="none" visible={showImagePicker} onRequestClose={() => setShowImagePicker(false)}>
          <View className="flex-1 justify-end">
            <Animated.View entering={FadeIn} exiting={FadeOut} style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }, rPickerBackdrop]}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowImagePicker(false)} />
            </Animated.View>

            <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={[{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24 }, rPickerStyle]}>
              {/* --- DRAG HANDLE START --- */}
              <GestureDetector gesture={pickerGesture}>
                <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                  <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </View>
              </GestureDetector>
              {/* --- DRAG HANDLE END --- */}

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">Change Profile Picture</Text>

                <TouchableOpacity onPress={() => handleImageOption("camera")} className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3">
                  <Camera size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-gray-900">Take Photo</Text>
                    <Text className="text-sm font-regular text-gray-500">Use camera to take a new photo</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleImageOption("gallery")} className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-6">
                  <ImageIcon size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-gray-900">Choose from Gallery</Text>
                    <Text className="text-sm font-regular text-gray-500">Select from your photo library</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity className="bg-gray-100 rounded-xl py-4 items-center" onPress={() => { pickerTranslateY.value = withTiming(1000, {}, () => runOnJS(setShowImagePicker)(false)); }}>
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* SMOOTH SETTINGS MODAL */}
      {/* ------------------------------------------------------ */}
      {showSettings && (
        <Modal transparent statusBarTranslucent animationType="none" visible={showSettings} onRequestClose={() => setShowSettings(false)}>
          <View className="flex-1 justify-end">
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSettings(false)} />
            </Animated.View>

            <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={{ height: "90%", backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>

              <ProfileSettings
                onClose={() => setShowSettings(false)}
                currentUser={currentUser}
                onLogout={async () => {
                  setShowSettings(false);
                  await logout();
                  router.replace("/login");
                }}
              />
            </Animated.View>
          </View>
        </Modal>
      )}

      {showImageViewer && selectedPost && (
        <ImageViewer
          visible={showImageViewer}
          images={selectedPost.images}
          initialIndex={selectedMediaIndex}
          onClose={() => setShowImageViewer(false)}
          postContent={selectedPost.content}
          username={currentUser?.name || "User"}
          likes={selectedPost.likes}
          comments={selectedPost.comments}
        />
      )}
    </View>
  );
}