// Path: app/(tabs)/profile.tsx
import ProfileSettings from "@/components/ProfileSettings";
import ImageViewer from "@/components/ImageViewer";
import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import { Camera, Edit3, ImageIcon, Image as ImageLucide, Mail, Phone, Settings, ShoppingBag, User, Wrench, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, PanResponder, ScrollView, Text, TouchableOpacity, View } from "react-native";

// Helper to check if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('post-videos');
};

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

  // ImageViewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [imagePostMap, setImagePostMap] = useState<Map<string, Post>>(new Map());

  // Animation values for fade and slide
  const fadeAnimImagePicker = useRef(new Animated.Value(0)).current;
  const slideAnimImagePicker = useRef(new Animated.Value(0)).current;
  const fadeAnimSettings = useRef(new Animated.Value(0)).current;
  const slideAnimSettings = useRef(new Animated.Value(0)).current;
  const contentOpacitySettings = useRef(new Animated.Value(1)).current;

  // Pan responder for drag to close - Image Picker
  const panResponderImagePicker = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnimImagePicker.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose = gestureState.dy > 150 || gestureState.vy > 0.5;

        if (shouldClose) {
          const velocity = Math.max(Math.abs(gestureState.vy), 0.5);
          const distance = 600 - gestureState.dy;
          const duration = Math.min(Math.max(distance / velocity / 3, 150), 300);

          Animated.parallel([
            Animated.timing(fadeAnimImagePicker, {
              toValue: 0,
              duration: duration,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(slideAnimImagePicker, {
              toValue: 600,
              duration: duration,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            })
          ]).start(({ finished }) => {
            if (finished) {
              setShowImagePicker(false);
              slideAnimImagePicker.setValue(600);
              fadeAnimImagePicker.setValue(0);
            }
          });
        } else {
          Animated.spring(slideAnimImagePicker, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Pan responder for drag to close - Settings
  const panResponderSettings = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnimSettings.setValue(gestureState.dy);
          // Fade out content as user drags down
          const opacity = Math.max(0, 1 - (gestureState.dy / 300));
          contentOpacitySettings.setValue(opacity);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose = gestureState.dy > 150 || gestureState.vy > 0.5;

        if (shouldClose) {
          const velocity = Math.max(Math.abs(gestureState.vy), 0.5);
          const distance = 600 - gestureState.dy;
          const duration = Math.min(Math.max(distance / velocity / 3, 150), 300);

          Animated.parallel([
            Animated.timing(fadeAnimSettings, {
              toValue: 0,
              duration: duration,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(slideAnimSettings, {
              toValue: 600,
              duration: duration,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(contentOpacitySettings, {
              toValue: 0,
              duration: duration,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            })
          ]).start(({ finished }) => {
            if (finished) {
              setShowSettings(false);
              slideAnimSettings.setValue(600);
              fadeAnimSettings.setValue(0);
              contentOpacitySettings.setValue(1);
            }
          });
        } else {
          Animated.parallel([
            Animated.spring(slideAnimSettings, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }),
            Animated.spring(contentOpacitySettings, {
              toValue: 1,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            })
          ]).start();
        }
      },
    })
  ).current;

  const handleCloseImagePicker = () => {
    Animated.parallel([
      Animated.timing(fadeAnimImagePicker, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimImagePicker, {
        toValue: 600,
        duration: 250,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      })
    ]).start(({ finished }) => {
      if (finished) {
        setShowImagePicker(false);
        slideAnimImagePicker.setValue(600);
        fadeAnimImagePicker.setValue(0);
      }
    });
  };

  const handleCloseSettings = () => {
    Animated.parallel([
      Animated.timing(fadeAnimSettings, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimSettings, {
        toValue: 600,
        duration: 250,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      })
    ]).start(({ finished }) => {
      if (finished) {
        setShowSettings(false);
        slideAnimSettings.setValue(600);
        fadeAnimSettings.setValue(0);
      }
    });
  };

  // Animate image picker
  useEffect(() => {
    if (showImagePicker) {
      slideAnimImagePicker.setValue(600);
      fadeAnimImagePicker.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnimImagePicker, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnimImagePicker, {
          toValue: 0,
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showImagePicker]);

  // Animate settings
  useEffect(() => {
    if (showSettings) {
      slideAnimSettings.setValue(600);
      fadeAnimSettings.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnimSettings, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnimSettings, {
          toValue: 0,
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showSettings]);

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

        // Extract all images from posts and create mapping
        const allImages: string[] = [];
        const postMap = new Map<string, Post>();

        posts.forEach(post => {
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

  const handleMediaClick = (imageUrl: string) => {
    const post = imagePostMap.get(imageUrl);
    if (!post) return;

    // Find the index of this image in the post's images array
    const mediaIndex = post.images.findIndex((img: string) => img === imageUrl);

    setSelectedPost(post);
    setSelectedMediaIndex(mediaIndex >= 0 ? mediaIndex : 0);
    setShowImageViewer(true);
  };

  const handleImageOption = async (option: 'camera' | 'gallery') => {
    handleCloseImagePicker();

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
                  {userImages.map((imageUrl, index) => {
                    const isVideo = isVideoUrl(imageUrl);
                    return (
                      <View key={index} className="w-[33.33%] aspect-square p-1">
                        <TouchableOpacity
                          className="flex-1 bg-gray-200 rounded-lg overflow-hidden relative"
                          onPress={() => handleMediaClick(imageUrl)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                          {/* Video play icon overlay */}
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
      {showImagePicker && (
        <Modal
          visible={true}
          transparent={true}
          animationType="none"
          onRequestClose={handleCloseImagePicker}
          statusBarTranslucent={true}
        >
          <View className="flex-1">
            <Animated.View
              className="absolute top-0 left-0 right-0 bottom-0"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                opacity: fadeAnimImagePicker
              }}
            />
            <TouchableOpacity
              className="flex-1"
              activeOpacity={1}
              onPress={handleCloseImagePicker}
            />
            <Animated.View
              className="bg-white rounded-t-3xl"
              style={{
                transform: [{ translateY: slideAnimImagePicker }]
              }}
            >
              <View {...panResponderImagePicker.panHandlers} className="px-6 pt-6 pb-2">
                <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
              </View>

              <View className="px-6 pb-6">
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
                  onPress={handleCloseImagePicker}
                  activeOpacity={0.8}
                >
                  <Text className="text-gray-600 font-msemibold">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Settings Overlay */}
      {showSettings && (
        <Modal
          visible={true}
          transparent={true}
          animationType="none"
          onRequestClose={handleCloseSettings}
          statusBarTranslucent={true}
        >
          <View className="flex-1">
            <Animated.View
              className="absolute top-0 left-0 right-0 bottom-0"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                opacity: fadeAnimSettings
              }}
            />
            <Animated.View
              className="flex-1"
              style={{
                transform: [{ translateY: slideAnimSettings }]
              }}
            >
              <ProfileSettings
                onClose={handleCloseSettings}
                currentUser={currentUser}
                onLogout={async () => {
                  handleCloseSettings();
                  await logout();
                  router.replace("/login");
                }}
                panHandlers={panResponderSettings.panHandlers}
                contentOpacity={contentOpacitySettings}
              />
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* ImageViewer Modal */}
      {showImageViewer && selectedPost && (
        <ImageViewer
          visible={showImageViewer}
          images={selectedPost.images}
          initialIndex={selectedMediaIndex}
          onClose={() => setShowImageViewer(false)}
          postContent={selectedPost.content}
          username={currentUser?.name || 'User'}
          likes={selectedPost.likes}
          comments={selectedPost.comments}
        />
      )}
    </View>
  );
}
