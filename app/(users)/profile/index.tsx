import BookmarksOverlay from "@/components/BookmarksOverlay";
import ImageCropOverlay from "@/components/ImageCropOverlay";
import ImageViewer from "@/components/ImageViewer";
import ManageListingsOverlay from "@/components/ManageListingsOverlay";
import ProfileImageViewer from "@/components/ProfileImageViewer";
import ProfileSettings from "@/components/ProfileSettings";
import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
// Added import for profile services
import { fetchUserProfile, updateUserProfile, uploadAvatar } from "@/lib/profileService";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Bell,
  Bookmark,
  Camera,
  Edit3,
  ImageIcon,
  Image as ImageLucide,
  Mail,
  Package,
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
  const [activeTab, setActiveTab] = useState<"images" | "products" | "services">(
    "images"
  );

  // UI State
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showManageListings, setShowManageListings] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

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

  // Profile image viewer state
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);

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
  const rPickerBackdrop = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, 1 - pickerTranslateY.value / 500)) }));

  // ------------------------------------------------------
  // END ANIMATION LOGIC
  // ------------------------------------------------------

  // Initialize profile image from current user data or fetch if missing
  useEffect(() => {
    const loadProfileImage = async () => {
      if (!currentUser?.id) return;

      // 1. Try from context first (if available)
      const user = currentUser as any;
      if (user?.avatar_url) {
        setProfileImage(user.avatar_url);
        return;
      }

      // 2. Fetch from DB if not in context
      try {
        const profile = await fetchUserProfile(currentUser.id);
        if (profile?.avatar_url) {
          setProfileImage(profile.avatar_url);
        }
      } catch (error) {
        console.error("Failed to fetch profile image:", error);
      }
    };

    loadProfileImage();
  }, [currentUser]);

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
  const handleBookmark = () => setShowBookmarks(true);
  const handleManageListings = () => setShowManageListings(true);
  const handleNotifications = () => {
    setShowNotifications(true);
    // You can implement a notifications modal similar to settings
    Alert.alert("Notifications", "Notifications feature coming soon!");
  };

  // UPDATED: Save Logic
  const handleCropSave = async (croppedUri: string) => {
    if (!currentUser?.id) return;

    // 1. Optimistic Update (Immediate UI feedback)
    setProfileImage(croppedUri);
    setShowCropOverlay(false);
    setSelectedImageUri(null);

    try {
      // 2. Upload to Supabase Storage
      // Note: Ensure your 'profile' bucket exists and has RLS policies for uploads
      const publicUrl = await uploadAvatar(croppedUri, currentUser.id);

      // 3. Update User Profile in Database
      await updateUserProfile(currentUser.id, { avatar_url: publicUrl });
      
      console.log("Profile image updated successfully:", publicUrl);
      Alert.alert("Success", "Profile has been changed successfully");
    } catch (error) {
      console.error("Failed to save profile image:", error);
      Alert.alert("Error", "Failed to save profile image. Please try again.");
      // Optional: Revert profileImage state here if needed
    }
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setSelectedImageUri(null);
  };

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
          mediaTypes: ['images'],
          allowsEditing: false, // We use our own cropper
          quality: 1.0,
        });
      } else {
        const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          Alert.alert("Permission Required", "Gallery access is needed.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false, // We use our own cropper
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImageUri(result.assets[0].uri);
        setShowCropOverlay(true);
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
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        {/* Left Icons */}
        <View className="flex-row items-center gap-2">
          {/* Bookmark Icon */}
          <TouchableOpacity onPress={handleBookmark} className="w-10 h-10 items-center justify-center">
            <Bookmark size={24} className="text-yellow-400" />
          </TouchableOpacity>

          {/* Manage Listings Icon */}
          <TouchableOpacity onPress={handleManageListings} className="w-10 h-10 items-center justify-center">
            <Package size={24} className="text-primary" />
          </TouchableOpacity>
        </View>

        {/* Notification and Settings Icons on Right */}
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleNotifications} className="w-10 h-10 items-center justify-center mr-2">
            <Bell size={24} className="text-gray-700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSettings} className="w-10 h-10 items-center justify-center">
            <Settings size={24} className="text-gray-700" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-white border-b border-gray-100 px-4 py-8">
          <View className="items-center">
            <View className="relative mb-4">
              <TouchableOpacity
                onPress={() => profileImage && setShowProfileImageViewer(true)}
                disabled={!profileImage}
                className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center overflow-hidden"
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} className="w-24 h-24 rounded-full" resizeMode="cover" />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </TouchableOpacity>
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
            <TouchableOpacity className={`flex-1 py-4 items-center border-b-2 ${activeTab === "services" ? "border-primary" : "border-transparent"}`} onPress={() => setActiveTab("services")}>
              <Wrench size={24} className={`mb-1 ${activeTab === "services" ? "text-primary" : "text-gray-500"}`} />
              <Text className={`font-msemibold text-xs ${activeTab === "services" ? "text-primary" : "text-gray-500"}`}>services</Text>
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
          {activeTab === "services" && <Text className="text-center py-8 text-gray-500">services Tab Placeholder</Text>}
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
          <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={{ height: "100%",  borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>
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
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* BOOKMARKS MODAL */}
      {/* ------------------------------------------------------ */}
      {showBookmarks && currentUser?.id && (
        <Modal transparent statusBarTranslucent animationType="none" visible={showBookmarks} onRequestClose={() => setShowBookmarks(false)}>
          <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={{ height: "100%",  borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>
            <BookmarksOverlay
              onClose={() => setShowBookmarks(false)}
              userId={currentUser.id}
            />
          </Animated.View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* MANAGE LISTINGS MODAL */}
      {/* ------------------------------------------------------ */}
      {showManageListings && currentUser?.id && (
        <Modal transparent statusBarTranslucent animationType="none" visible={showManageListings} onRequestClose={() => setShowManageListings(false)}>
          <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={{ height: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>
            <ManageListingsOverlay
              onClose={() => setShowManageListings(false)}
              userId={currentUser.id}
            />
          </Animated.View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* IMAGE CROP OVERLAY */}
      {/* ------------------------------------------------------ */}
      {showCropOverlay && selectedImageUri && (
        <Modal
          visible={showCropOverlay}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={handleCropCancel}
        >
          <ImageCropOverlay
            imageUri={selectedImageUri}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
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

      {/* Profile Image Viewer */}
      {showProfileImageViewer && profileImage && (
        <ProfileImageViewer
          visible={showProfileImageViewer}
          imageUri={profileImage}
          onClose={() => setShowProfileImageViewer(false)}
        />
      )}
    </View>
  );
}