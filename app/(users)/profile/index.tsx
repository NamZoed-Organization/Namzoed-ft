import FollowRequests from "@/components/modals/FollowRequests";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import ImageCropOverlay from "@/components/modals/ImageCropOverlay";
import ImageViewer from "@/components/modals/ImageViewer";
import LicenseViewerOverlay from "@/components/modals/LicenseViewerOverlay";
import ManageListingsOverlay from "@/components/modals/ManageListingsOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ProfileSettings from "@/components/modals/ProfileSettings";
import { useUser } from "@/contexts/UserContext";
import { fetchUserPosts, Post } from "@/lib/postsService";
import { fetchUserProducts, Product } from "@/lib/productsService";
// Added import for profile services
import EditServicesModal from "@/components/modals/EditServicesModal";
import PopupMessage from "@/components/ui/PopupMessage";
import {
  deleteAvatar,
  fetchUserProfile,
  updateUserProfile,
  uploadAvatar,
} from "@/lib/profileService";
import {
  deleteLicenseImage,
  deleteProviderAvatar,
  deleteProviderService,
  fetchServiceProviderProfile,
  fetchUserProviderServices,
  ProviderServiceWithDetails,
  toggleServiceStatus,
  updateServiceProviderLicense,
  updateServiceProviderProfile,
  uploadLicenseImage,
  uploadProviderAvatar,
} from "@/lib/servicesService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Bell,
  Camera,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  ImageIcon,
  Image as ImageLucide,
  Mail,
  MoreVertical,
  Package,
  Play,
  Settings,
  ShoppingBag,
  Trash2,
  Upload,
  User,
  UserPlus,
  Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- Reanimated & Gesture Handler ---
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutDown,
  FadeOutLeft,
  Layout,
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
  const { currentUser, setCurrentUser, logout } = useUser();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [mainTab, setMainTab] = useState<"main" | "work">(
    tab === "work" ? "work" : "main",
  );
  const [activeTab, setActiveTab] = useState<
    "images" | "products" | "services"
  >("images");

  // UI State
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showMainAvatarMenu, setShowMainAvatarMenu] = useState(false);
  const [showProviderImagePicker, setShowProviderImagePicker] = useState(false);
  const [showProviderAvatarMenu, setShowProviderAvatarMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [followRequestsTab, setFollowRequestsTab] = useState<
    "following" | "followers"
  >("following");
  const [showManageListings, setShowManageListings] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [providerImageUri, setProviderImageUri] = useState<string | null>(null);

  // Data State
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [userImages, setUserImages] = useState<string[]>([]);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Service provider data
  const [serviceProvider, setServiceProvider] = useState<any>(null);
  const [loadingServiceProvider, setLoadingServiceProvider] = useState(false);
  const [isEditingProvider, setIsEditingProvider] = useState(false);
  const [providerFormData, setProviderFormData] = useState({
    businessName: "",
    email: "",
    phone: "",
    bio: "",
  });
  const [verificationStatus, setVerificationStatus] = useState<
    "verified" | "not_verified" | "pending"
  >("not_verified");
  const [providerServices, setProviderServices] = useState<
    ProviderServiceWithDetails[]
  >([]);
  const [loadingProviderServices, setLoadingProviderServices] = useState(false);

  // Service management state
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isServiceSelectionMode, setIsServiceSelectionMode] = useState(false);
  const [serviceToEdit, setServiceToEdit] =
    useState<ProviderServiceWithDetails | null>(null);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Horizontal scroll ref
  const horizontalScrollRef = React.useRef<ScrollView>(null);
  // Ref to track programmatic scrolling (tap) vs user swiping
  const isScrollingProgrammatically = React.useRef(false);

  // ImageViewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [imagePostMap, setImagePostMap] = useState<Map<string, Post>>(
    new Map(),
  );

  // Profile image viewer state
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);

  // License viewer state
  const [showLicenseViewer, setShowLicenseViewer] = useState(false);
  const [showLicenseMenu, setShowLicenseMenu] = useState(false);
  const [licenseImageUrl, setLicenseImageUrl] = useState<string | null>(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);

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

  const showSuccessPopup = (message: string) => {
    setPopupMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

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
        pickerTranslateY.value = withTiming(
          1000,
          { duration: 250 },
          (finished) => {
            if (finished) runOnJS(setShowImagePicker)(false);
          },
        );
      } else {
        pickerTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  useEffect(() => {
    if (showImagePicker) pickerTranslateY.value = 0;
  }, [showImagePicker]);

  const rPickerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pickerTranslateY.value }],
  }));
  const rPickerBackdrop = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, 1 - pickerTranslateY.value / 500)),
  }));

  // ------------------------------------------------------
  // END ANIMATION LOGIC
  // ------------------------------------------------------

  // Initialize profile image and follower counts from DB
  useEffect(() => {
    const loadProfileData = async () => {
      if (!currentUser?.id) return;

      try {
        const profile = await fetchUserProfile(currentUser.id);

        // Set profile image
        if (profile?.avatar_url) {
          setProfileImage(profile.avatar_url);

          // ALWAYS sync avatar_url from database to context/AsyncStorage
          if (currentUser?.avatar_url !== profile.avatar_url) {
            const updatedUser = {
              ...currentUser,
              avatar_url: profile.avatar_url,
            };
            await AsyncStorage.setItem(
              "currentUser",
              JSON.stringify(updatedUser),
            );
            setCurrentUser(updatedUser);
          }
        } else {
          // Fallback to context
          const user = currentUser as any;
          if (user?.avatar_url) {
            setProfileImage(user.avatar_url);
          }
        }

        // Set follower counts from database
        setFollowerCount(profile?.follower_count || 0);
        setFollowingCount(profile?.following_count || 0);
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      }
    };

    loadProfileData();
  }, [currentUser, refreshKey]);

  // Load service provider profile
  useEffect(() => {
    const loadServiceProvider = async () => {
      if (!currentUser?.id) return;

      try {
        setLoadingServiceProvider(true);
        const providerData = await fetchServiceProviderProfile(currentUser.id);
        setServiceProvider(providerData);

        // Populate form data and avatar
        if (providerData) {
          setProviderFormData({
            businessName: "",
            email: providerData.profiles?.email || "",
            phone: providerData.profiles?.phone || "",
            bio: providerData.master_bio || "",
          });
          // Load provider avatar
          if (providerData.profile_url) {
            setProviderImageUri(providerData.profile_url);
          }
          // Load license URL from identification jsonb
          if (providerData.identification?.licenseUrl) {
            setLicenseImageUrl(providerData.identification.licenseUrl);
          }
          // Load verification status
          setVerificationStatus(
            providerData.verification_status || "not_verified",
          );
        }
      } catch (error) {
        console.error("Failed to fetch service provider data:", error);
      } finally {
        setLoadingServiceProvider(false);
      }
    };

    loadServiceProvider();
  }, [currentUser?.id, refreshKey]);

  // Load user's provider services
  useEffect(() => {
    const loadProviderServices = async () => {
      if (!currentUser?.id) return;

      try {
        setLoadingProviderServices(true);
        const services = await fetchUserProviderServices(currentUser.id);
        setProviderServices(services);
      } catch (error) {
        console.error("Failed to fetch provider services:", error);
      } finally {
        setLoadingProviderServices(false);
      }
    };

    loadProviderServices();
  }, [currentUser?.id, refreshKey]);

  // Scroll to Work tab if tab parameter is "work"
  useEffect(() => {
    if (tab === "work" && horizontalScrollRef.current) {
      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({
          x: SCREEN_WIDTH,
          animated: true,
        });
      }, 100);
    }
  }, [tab]);

  // Close all overlays when navigating away from screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup function runs when screen loses focus
        setShowFollowRequests(false);
        setShowPendingRequests(false);
        setShowSettings(false);
        setShowImagePicker(false);
        setShowMainAvatarMenu(false);
        setShowProviderImagePicker(false);
        setShowProviderAvatarMenu(false);
        setShowManageListings(false);
        setShowCropOverlay(false);
        setShowImageViewer(false);
        setShowProfileImageViewer(false);
        setShowLicenseViewer(false);
        setShowLicenseMenu(false);
      };
    }, []),
  );

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
        showErrorPopup("Failed to load your posts");
      } finally {
        setLoadingPosts(false);
      }
    };
    loadUserPosts();
  }, [currentUser?.id, refreshKey]);

  // Load user products
  useEffect(() => {
    const loadProducts = async () => {
      if (!currentUser?.id) {
        setLoadingProducts(false);
        return;
      }
      try {
        setLoadingProducts(true);
        const products = await fetchUserProducts(currentUser.id);
        setUserProducts(products);
      } catch (error) {
        console.error("Error loading user products:", error);
        showErrorPopup("Failed to load your products");
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, [currentUser?.id, refreshKey]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleEditProfile = () => setShowImagePicker(true);
  const handleEditProviderProfile = () => setShowProviderImagePicker(true);
  const handleSettings = () => setShowSettings(true);
  const handleFollowRequests = () => setShowPendingRequests(true);
  const handleManageListings = () => setShowManageListings(true);
  const handleNotifications = () => {
    setShowNotifications(true);
    // You can implement a notifications modal similar to settings
    showSuccessPopup("Notifications feature coming soon!");
  };

  // Handle main tab change with scroll
  const handleMainTabChange = (tab: "main" | "work") => {
    setMainTab(tab);
    if (horizontalScrollRef.current) {
      isScrollingProgrammatically.current = true;
      const offset = tab === "main" ? 0 : SCREEN_WIDTH;
      horizontalScrollRef.current.scrollTo({ x: offset, animated: true });
    }
  };

  // Handle scroll event to update active tab (only for user swipes, not taps)
  const handleScroll = (event: any) => {
    // Skip state updates during programmatic scrolling (from tab tap)
    if (isScrollingProgrammatically.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    const newTab = offsetX > SCREEN_WIDTH / 2 ? "work" : "main";
    if (newTab !== mainTab) {
      setMainTab(newTab);
    }
  };

  // Reset the programmatic scroll flag when user starts dragging (swiping)
  const handleScrollBeginDrag = () => {
    isScrollingProgrammatically.current = false;
  };

  // Reset the programmatic scroll flag when scrolling ends
  const handleScrollEnd = () => {
    isScrollingProgrammatically.current = false;
  };

  // Handle service provider profile save
  const handleSaveProviderProfile = async () => {
    if (!currentUser?.id) return;

    try {
      await updateServiceProviderProfile(currentUser.id, {
        master_bio: providerFormData.bio,
      });

      setIsEditingProvider(false);
      setRefreshKey((prev) => prev + 1);
      showSuccessPopup("Service provider profile updated successfully");
    } catch (error) {
      console.error("Failed to update service provider profile:", error);
      showErrorPopup("Failed to update profile. Please try again.");
    }
  };

  // Handle edit mode toggle
  const handleToggleEditProvider = () => {
    if (isEditingProvider) {
      // Cancel editing - reload original data
      if (serviceProvider) {
        setProviderFormData({
          businessName: "",
          email: serviceProvider.profiles?.email || "",
          phone: serviceProvider.profiles?.phone || "",
          bio: serviceProvider.master_bio || "",
        });
      }
    }
    setIsEditingProvider(!isEditingProvider);
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

      // 4. Update UserContext and AsyncStorage to sync across app
      const updatedUser = { ...currentUser, avatar_url: publicUrl };
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      console.log("Profile image updated successfully:", publicUrl);
      showSuccessPopup("Profile has been changed successfully");
    } catch (error) {
      console.error("Failed to save profile image:", error);
      showErrorPopup("Failed to save profile image. Please try again.");
      // Optional: Revert profileImage state here if needed
    }
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setSelectedImageUri(null);
    setRefreshKey((prev) => prev + 1);
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
      runOnJS(setShowImagePicker)(false),
    );

    try {
      let result;
      if (option === "camera") {
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          showErrorPopup("Camera access is needed.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false, // We use our own cropper
          quality: 1.0,
        });
      } else {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
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
      showErrorPopup("Failed to select image.");
    }
  };

  const handleProviderImageOption = async (option: "camera" | "gallery") => {
    setShowProviderImagePicker(false);

    if (!currentUser?.id) return;

    try {
      let result;
      if (option === "camera") {
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          showErrorPopup("Camera access is needed.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1.0,
        });
      } else {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;

        // Optimistic update (show image immediately)
        setProviderImageUri(imageUri);

        try {
          // Upload to Supabase Storage
          const publicUrl = await uploadProviderAvatar(
            imageUri,
            currentUser.id,
          );

          // Update database with new avatar URL (profile_url is the avatar)
          await updateServiceProviderProfile(currentUser.id, {
            profile_url: publicUrl,
          });

          showSuccessPopup("Service provider avatar updated successfully");
        } catch (uploadError) {
          console.error("Failed to upload provider avatar:", uploadError);
          showErrorPopup("Failed to upload avatar. Please try again.");
          // Revert to previous image on error
          if (serviceProvider?.profile_url) {
            setProviderImageUri(serviceProvider.profile_url);
          } else {
            setProviderImageUri(null);
          }
        }
      }
    } catch (error) {
      console.error("Error picking provider image:", error);
      showErrorPopup("Failed to select image.");
    }
  };

  // Service management handlers
  const handleToggleStatus = (serviceId: string, newStatus: boolean) => {
    const actionText = newStatus ? "activate" : "deactivate";

    Alert.alert(
      `${newStatus ? "Activate" : "Deactivate"} Service`,
      `Are you sure you want to ${actionText} this service?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await toggleServiceStatus(serviceId, newStatus);

              // Update local state
              setProviderServices((prev) =>
                prev.map((s) =>
                  s.id === serviceId ? { ...s, status: newStatus } : s,
                ),
              );

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup(
                `Service ${newStatus ? "activated" : "deactivated"} successfully`,
              );
            } catch (error: any) {
              showErrorPopup(
                error.message || "Failed to update service status",
              );
            }
          },
        },
      ],
    );
  };

  const handleEditService = (service: ProviderServiceWithDetails) => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
    setServiceToEdit(service);
    setShowEditServiceModal(true);
  };

  const handleServiceLongPress = (serviceId: string) => {
    if (!isServiceSelectionMode) {
      Haptics.notificationAsync(NotificationFeedbackType.Success);
      setIsServiceSelectionMode(true);
      setSelectedServiceIds([serviceId]);
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    Haptics.impactAsync(ImpactFeedbackStyle.Light);
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId],
    );
  };

  const handleDeleteSelectedServices = () => {
    Alert.alert(
      "Delete Services",
      `Are you sure you want to delete ${selectedServiceIds.length} service(s)? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all selected services
              await Promise.all(
                selectedServiceIds.map((id) => deleteProviderService(id)),
              );

              // Update local state
              setProviderServices((prev) =>
                prev.filter((s) => !selectedServiceIds.includes(s.id)),
              );

              setIsServiceSelectionMode(false);
              setSelectedServiceIds([]);

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup("Services deleted successfully");
            } catch (error: any) {
              showErrorPopup(error.message || "Failed to delete services");
            }
          },
        },
      ],
    );
  };

  const handleCancelSelection = () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Light);
    setIsServiceSelectionMode(false);
    setSelectedServiceIds([]);
  };

  // Handle license upload
  const handleUploadLicense = async () => {
    if (!currentUser?.id) return;

    try {
      const galleryPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!galleryPermission.granted) {
        showErrorPopup("Gallery access is needed to upload license.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;

        // Show confirmation popup after image selection (for both first time and replacement)
        if (licenseImageUrl) {
          // Replacing existing license
          Alert.alert(
            "Replace License",
            "Are you sure you want to replace your existing license document? This will set your verification status back to pending.",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Replace",
                style: "destructive",
                onPress: async () => {
                  await uploadLicenseDocument(imageUri);
                },
              },
            ],
          );
        } else {
          // First time upload with confirmation
          Alert.alert(
            "Upload License",
            "Are you sure you want to upload this document as your license?",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Upload",
                onPress: async () => {
                  await uploadLicenseDocument(imageUri);
                },
              },
            ],
          );
        }
      }
    } catch (error) {
      console.error("Error picking license image:", error);
      showErrorPopup("Failed to select image.");
    }
  };

  // Upload license document helper
  const uploadLicenseDocument = async (imageUri: string) => {
    if (!currentUser?.id) return;

    setUploadingLicense(true);

    try {
      // Upload to Supabase Storage
      const publicUrl = await uploadLicenseImage(imageUri, currentUser.id);

      // Update database with license URL and set status to pending
      await updateServiceProviderLicense(currentUser.id, publicUrl);

      // Update local state
      setLicenseImageUrl(publicUrl);
      setVerificationStatus("pending");

      Haptics.notificationAsync(NotificationFeedbackType.Success);
      showSuccessPopup(
        "License document uploaded successfully. Pending verification.",
      );
    } catch (uploadError) {
      console.error("Failed to upload license:", uploadError);
      showErrorPopup("Failed to upload license. Please try again.");
    } finally {
      setUploadingLicense(false);
    }
  };

  // Handle view license
  const handleViewLicense = () => {
    if (licenseImageUrl) {
      setShowLicenseViewer(true);
    }
  };

  // Handle remove main profile avatar
  const handleRemoveMainAvatar = () => {
    setShowMainAvatarMenu(false);
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!currentUser?.id) return;

            try {
              // Delete from storage if exists
              if (profileImage) {
                try {
                  await deleteAvatar(profileImage);
                } catch (error) {
                  console.error("Failed to delete avatar from storage:", error);
                }
              }

              // Update database
              await updateUserProfile(currentUser.id, { avatar_url: null });

              // Update local state
              setProfileImage(null);

              // Update UserContext and AsyncStorage
              const updatedUser = { ...currentUser, avatar_url: null };
              await AsyncStorage.setItem(
                "currentUser",
                JSON.stringify(updatedUser),
              );
              setCurrentUser(updatedUser);

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup("Profile picture removed successfully");
            } catch (error) {
              console.error("Failed to remove profile picture:", error);
              showErrorPopup(
                "Failed to remove profile picture. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  // Handle remove provider avatar
  const handleRemoveProviderAvatar = () => {
    setShowProviderAvatarMenu(false);
    Alert.alert(
      "Remove Avatar",
      "Are you sure you want to remove your service provider avatar?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!currentUser?.id) return;

            try {
              // Delete from storage if exists
              if (providerImageUri && serviceProvider?.profile_url) {
                try {
                  await deleteProviderAvatar(serviceProvider.profile_url);
                } catch (error) {
                  console.error("Failed to delete avatar from storage:", error);
                }
              }

              // Update database
              await updateServiceProviderProfile(currentUser.id, {
                profile_url: undefined,
              });

              // Update local state
              setProviderImageUri(null);

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup("Avatar removed successfully");
            } catch (error) {
              console.error("Failed to remove provider avatar:", error);
              showErrorPopup("Failed to remove avatar. Please try again.");
            }
          },
        },
      ],
    );
  };

  // Handle remove license
  const handleRemoveLicense = () => {
    setShowLicenseMenu(false);
    Alert.alert(
      "Remove License",
      'Are you sure you want to remove your license document? This will reset your verification status to "not verified".',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!currentUser?.id) return;

            try {
              // Delete from storage if exists
              if (licenseImageUrl) {
                try {
                  await deleteLicenseImage(licenseImageUrl);
                } catch (error) {
                  console.error(
                    "Failed to delete license from storage:",
                    error,
                  );
                }
              }

              // Update database
              await updateServiceProviderProfile(currentUser.id, {
                identification: null,
                verification_status: "not_verified",
              });

              // Update local state
              setLicenseImageUrl(null);
              setVerificationStatus("not_verified");

              Haptics.notificationAsync(NotificationFeedbackType.Success);
              showSuccessPopup("License removed successfully");
            } catch (error) {
              console.error("Failed to remove license:", error);
              showErrorPopup("Failed to remove license. Please try again.");
            }
          },
        },
      ],
    );
  };

  if (!currentUser) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-4">
        <User size={72} className="text-gray-700 mb-4" />
        <Text className="text-xl font-mbold text-gray-700 mb-2">
          Not Logged In
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          className="bg-primary rounded-xl py-3 px-6"
        >
          <Text className="text-white font-msemibold">Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Fixed Header - Absolute Position */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
      >
        <View className="h-12 bg-white" />

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          {/* Left Icons */}
          <View className="flex-row items-center gap-2">
            {/* Follow Requests Icon */}
            <TouchableOpacity
              onPress={handleFollowRequests}
              className="w-10 h-10 items-center justify-center"
            >
              <UserPlus size={24} className="text-primary" />
            </TouchableOpacity>

            {/* Manage Listings Icon */}
            <TouchableOpacity
              onPress={handleManageListings}
              className="w-10 h-10 items-center justify-center"
            >
              <Package size={24} className="text-primary" />
            </TouchableOpacity>
          </View>

          {/* Notification and Settings Icons on Right */}
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleNotifications}
              className="w-10 h-10 items-center justify-center mr-2"
            >
              <Bell size={24} className="text-gray-700" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSettings}
              className="w-10 h-10 items-center justify-center"
            >
              <Settings size={24} className="text-gray-700" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main/Work Tabs - Floating Bubbles */}
        <View className="bg-white px-4 py-2">
          <View className="flex-row gap-2 justify-center">
            <TouchableOpacity
              className={`px-8 py-1.5 items-center rounded-full ${mainTab === "main" ? "bg-primary" : "bg-gray-100"}`}
              onPress={() => handleMainTabChange("main")}
            >
              <Text
                className={`font-msemibold text-sm ${mainTab === "main" ? "text-white" : "text-gray-600"}`}
              >
                Main
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-8 py-1.5 items-center rounded-full ${mainTab === "work" ? "bg-primary" : "bg-gray-100"}`}
              onPress={() => handleMainTabChange("work")}
            >
              <Text
                className={`font-msemibold text-sm ${mainTab === "work" ? "text-white" : "text-gray-600"}`}
              >
                Work
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content with Top Padding for Fixed Header */}
      <View style={{ paddingTop: 120 }} className="flex-1">
        {/* Horizontal Scrollable Content */}
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleScrollEnd}
          className="flex-1"
        >
          {/* Main Profile Page */}
          <View style={{ width: SCREEN_WIDTH }}>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#094569"
                  progressViewOffset={0}
                />
              }
            >
              {/* Profile Header */}
              <View className="bg-white border-b border-gray-100 px-4 py-8">
                <View className="items-center">
                  <View className="relative mb-4">
                    <TouchableOpacity
                      onPress={() =>
                        profileImage && setShowProfileImageViewer(true)
                      }
                      disabled={!profileImage}
                      className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center overflow-hidden"
                    >
                      {profileImage ? (
                        <Image
                          source={{ uri: profileImage }}
                          className="w-24 h-24 rounded-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <User size={32} className="text-gray-400" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(ImpactFeedbackStyle.Light);
                        if (profileImage) {
                          setShowMainAvatarMenu(true);
                        } else {
                          handleEditProfile();
                        }
                      }}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
                    >
                      {profileImage ? (
                        <MoreVertical size={16} className="text-white" />
                      ) : (
                        <Edit3 size={16} className="text-white" />
                      )}
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

                  <View className="flex-row items-center space-x-6 mt-4">
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        setFollowRequestsTab("following");
                        setShowFollowRequests(true);
                      }}
                    >
                      <Text className="text-xl font-mbold text-gray-900">
                        {followingCount > 999
                          ? `${(followingCount / 1000).toFixed(1)}k`
                          : followingCount}
                      </Text>
                      <Text className="text-sm font-regular text-gray-500">
                        Following
                      </Text>
                    </TouchableOpacity>
                    <Text className="text-gray-300 text-xl font-light">|</Text>
                    <TouchableOpacity
                      className="items-center"
                      onPress={() => {
                        setFollowRequestsTab("followers");
                        setShowFollowRequests(true);
                      }}
                    >
                      <Text className="text-xl font-mbold text-gray-900">
                        {followerCount > 999
                          ? `${(followerCount / 1000).toFixed(1)}k`
                          : followerCount}
                      </Text>
                      <Text className="text-sm font-regular text-gray-500">
                        Followers
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Tab Navigation */}
              <View className="bg-white border-b border-gray-100">
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "images"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("images")}
                  >
                    <ImageLucide
                      size={24}
                      className={`mb-1 ${
                        activeTab === "images"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "images"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Images
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "products"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("products")}
                  >
                    <ShoppingBag
                      size={24}
                      className={`mb-1 ${
                        activeTab === "products"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "products"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Products
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${activeTab === "services" ? "border-primary" : "border-transparent"}`}
                    onPress={() => setActiveTab("services")}
                  >
                    <Wrench
                      size={24}
                      className={`mb-1 ${activeTab === "services" ? "text-primary" : "text-gray-500"}`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${activeTab === "services" ? "text-primary" : "text-gray-500"}`}
                    >
                      Service
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tab Content */}
              <View className="px-4 py-4">
                {activeTab === "images" && (
                  <>
                    {loadingPosts ? (
                      <ActivityIndicator
                        size="large"
                        color="#059669"
                        className="py-12"
                      />
                    ) : userImages.length > 0 ? (
                      <View className="flex-row flex-wrap">
                        {userImages.map((imageUrl, index) => {
                          const isVideo = isVideoUrl(imageUrl);
                          return (
                            <View
                              key={index}
                              className="w-[33.33%] aspect-square p-1"
                            >
                              <TouchableOpacity
                                className="flex-1 bg-gray-200 rounded-lg overflow-hidden relative"
                                onPress={() => handleMediaClick(imageUrl)}
                              >
                                <Image
                                  source={{ uri: imageUrl }}
                                  className="w-full h-full"
                                  resizeMode="cover"
                                />
                                {isVideo && (
                                  <View className="absolute inset-0 items-center justify-center bg-black/30">
                                    <View className="bg-white rounded-full p-2">
                                      <Play
                                        size={24}
                                        color="#000"
                                        fill="#000"
                                      />
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
                        <Text className="text-lg font-msemibold text-gray-700">
                          No Images Yet
                        </Text>
                      </View>
                    )}
                  </>
                )}
                {activeTab === "products" && (
                  <>
                    {loadingProducts ? (
                      <ActivityIndicator
                        size="large"
                        color="#059669"
                        className="py-12"
                      />
                    ) : userProducts.length > 0 ? (
                      <View className="flex-row flex-wrap">
                        {userProducts.map((product, index) => (
                          <View
                            key={product.id || index}
                            className="w-[33.33%] aspect-square p-1"
                          >
                            <TouchableOpacity
                              className="flex-1 bg-gray-200 rounded-lg overflow-hidden"
                              onPress={() =>
                                router.push(
                                  `/(users)/product/${product.id}` as any,
                                )
                              }
                            >
                              {product.images && product.images.length > 0 ? (
                                <Image
                                  source={{ uri: product.images[0] }}
                                  className="w-full h-full"
                                  resizeMode="cover"
                                />
                              ) : (
                                <View className="w-full h-full items-center justify-center bg-gray-100">
                                  <ShoppingBag
                                    size={32}
                                    className="text-gray-400"
                                  />
                                </View>
                              )}
                              {/* Price tag overlay */}
                              <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                <Text
                                  className="text-white text-xs font-semibold"
                                  numberOfLines={1}
                                >
                                  {product.name}
                                </Text>
                                <Text className="text-white text-xs font-bold">
                                  Nu. {product.price.toLocaleString()}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View className="items-center justify-center py-12">
                        <ShoppingBag size={48} className="text-gray-400 mb-4" />
                        <Text className="text-lg font-msemibold text-gray-700">
                          No Products Yet
                        </Text>
                        <Text className="text-sm text-gray-500 mt-2">
                          Start selling to see your products here
                        </Text>
                      </View>
                    )}
                  </>
                )}
                {activeTab === "services" && (
                  <Text className="text-center py-8 text-gray-500">
                    Services coming soon
                  </Text>
                )}
              </View>
              <View className="h-8" />
            </ScrollView>
          </View>

          {/* Work Profile Page (Service Provider) */}
          <View style={{ width: SCREEN_WIDTH }}>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#094569"
                  progressViewOffset={0}
                />
              }
            >
              {loadingServiceProvider ? (
                <ActivityIndicator
                  size="large"
                  color="#094569"
                  className="py-12"
                />
              ) : (
                <View className="px-4 py-6">
                  {/* Service Provider Header */}
                  <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
                    {/* Top Bar with Title and Menu Button */}
                    <View className="flex-row items-center justify-between mb-6">
                      <Text className="text-xl font-mbold text-gray-900">
                        Service Provider Profile
                      </Text>

                      {isEditingProvider ? (
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            className="bg-primary rounded-full px-4 py-2 items-center"
                            onPress={handleSaveProviderProfile}
                          >
                            <Text className="text-white font-msemibold text-sm">
                              Save
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="bg-gray-100 rounded-full px-4 py-2 items-center"
                            onPress={handleToggleEditProvider}
                          >
                            <Text className="text-gray-700 font-msemibold text-sm">
                              Cancel
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            className="flex-row items-center gap-1 bg-primary rounded-full px-4 py-2"
                            onPress={handleToggleEditProvider}
                          >
                            <Edit3 size={14} className="text-white" />
                            <Text className="text-white font-msemibold text-sm">
                              Edit
                            </Text>
                          </TouchableOpacity>
                          {providerImageUri && (
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.impactAsync(ImpactFeedbackStyle.Light);
                                setShowProviderAvatarMenu(true);
                              }}
                              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
                            >
                              <MoreVertical
                                size={20}
                                className="text-gray-700"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Avatar Section */}
                    <View className="items-center mb-6">
                      <View className="relative mb-4">
                        <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center overflow-hidden">
                          {providerImageUri ? (
                            <Image
                              source={{ uri: providerImageUri }}
                              className="w-24 h-24 rounded-full"
                              resizeMode="cover"
                            />
                          ) : (
                            <Wrench size={40} className="text-gray-400" />
                          )}
                        </View>
                        {/* Verified Badge - Made Larger and More Visible */}
                        {verificationStatus === "verified" && (
                          <View className="absolute top-0 right-0 w-9 h-9 bg-blue-500 rounded-full items-center justify-center border-3 border-white shadow-lg">
                            <CheckCircle2
                              size={20}
                              color="white"
                              fill="white"
                            />
                          </View>
                        )}
                        {!providerImageUri && (
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(ImpactFeedbackStyle.Light);
                              handleEditProviderProfile();
                            }}
                            className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
                          >
                            <Camera size={16} className="text-white" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Form Fields */}
                    <View className="space-y-4">
                      {/* Business Name - Full Width */}
                      <View className="mb-4">
                        <Text className="text-sm font-msemibold text-gray-700 mb-2">
                          Business Name
                        </Text>
                        {isEditingProvider ? (
                          <TextInput
                            className="bg-gray-50 rounded-xl px-4 py-3 text-base font-regular text-gray-900 border border-gray-200"
                            placeholder="Enter business name"
                            placeholderTextColor="#9CA3AF"
                            value={providerFormData.businessName}
                            onChangeText={(text) =>
                              setProviderFormData({
                                ...providerFormData,
                                businessName: text,
                              })
                            }
                          />
                        ) : (
                          <View className="bg-gray-50 rounded-xl px-4 py-3">
                            <Text className="text-base font-regular text-gray-400 italic">
                              Not set
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Two Column Layout - Email & Phone */}
                      <View className="flex-row gap-3 mb-4">
                        {/* Contact Email */}
                        <View className="flex-1">
                          <Text className="text-sm font-msemibold text-gray-700 mb-2">
                            Email
                          </Text>
                          <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <Text
                              className="text-base font-regular text-gray-900"
                              numberOfLines={1}
                            >
                              {providerFormData.email || "Not set"}
                            </Text>
                          </View>
                        </View>

                        {/* Contact Phone */}
                        <View className="flex-1">
                          <Text className="text-sm font-msemibold text-gray-700 mb-2">
                            Phone
                          </Text>
                          <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <Text
                              className="text-base font-regular text-gray-900"
                              numberOfLines={1}
                            >
                              {providerFormData.phone || "Not set"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Business Bio - Full Width */}
                      <View className="mb-4">
                        <Text className="text-sm font-msemibold text-gray-700 mb-2">
                          Business Bio
                        </Text>
                        {isEditingProvider ? (
                          <TextInput
                            className="bg-gray-50 rounded-xl px-4 py-3 text-base font-regular text-gray-900 border border-gray-200"
                            placeholder="Tell us about your business"
                            placeholderTextColor="#9CA3AF"
                            value={providerFormData.bio}
                            onChangeText={(text) =>
                              setProviderFormData({
                                ...providerFormData,
                                bio: text,
                              })
                            }
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            style={{ minHeight: 100 }}
                          />
                        ) : (
                          <View className="bg-gray-50 rounded-xl px-4 py-3">
                            <Text className="text-base font-regular text-gray-900">
                              {providerFormData.bio || (
                                <Text className="italic text-gray-400">
                                  Not set
                                </Text>
                              )}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* License Verification Section */}
                  <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-row items-center">
                        <FileText size={20} className="text-primary mr-2" />
                        <Text className="text-lg font-mbold text-gray-900">
                          License Verification
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        {!uploadingLicense &&
                          verificationStatus !== "not_verified" && (
                            <View
                              className={`px-3 py-1 rounded-full ${
                                verificationStatus === "verified"
                                  ? "bg-green-100"
                                  : "bg-yellow-100"
                              }`}
                            >
                              <Text
                                className={`text-xs font-msemibold ${
                                  verificationStatus === "verified"
                                    ? "text-green-700"
                                    : "text-yellow-700"
                                }`}
                              >
                                {verificationStatus === "verified"
                                  ? "Verified"
                                  : "Pending Verification"}
                              </Text>
                            </View>
                          )}
                        {licenseImageUrl && !uploadingLicense && (
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(ImpactFeedbackStyle.Light);
                              setShowLicenseMenu(true);
                            }}
                            className="w-8 h-8 items-center justify-center"
                          >
                            <MoreVertical size={20} className="text-gray-700" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <Text className="text-sm text-gray-500 mb-4">
                      {uploadingLicense
                        ? "Uploading license document..."
                        : verificationStatus === "verified"
                          ? "Your license has been verified."
                          : verificationStatus === "pending"
                            ? "Your license is pending verification by our team."
                            : "Upload your business license or identification document for verification."}
                    </Text>

                    {uploadingLicense ? (
                      <View className="flex-row items-center justify-center py-3">
                        <ActivityIndicator size="small" color="#094569" />
                        <Text className="text-primary font-msemibold ml-3">
                          Processing document...
                        </Text>
                      </View>
                    ) : !licenseImageUrl ? (
                      <TouchableOpacity
                        onPress={handleUploadLicense}
                        className="flex-row items-center justify-center bg-primary rounded-xl py-3 px-4"
                      >
                        <Upload size={18} className="text-white mr-2" />
                        <Text className="text-white font-msemibold">
                          Upload License
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Your Services Section */}
                  <View className="bg-white rounded-2xl p-6 shadow-sm">
                    <Text className="text-lg font-mbold text-gray-900 mb-2">
                      Your Services
                    </Text>
                    <Text className="text-sm text-gray-500 mb-4">
                      {providerServices.length > 0
                        ? `You have ${providerServices.length} service${providerServices.length > 1 ? "s" : ""} listed`
                        : "Services you offer will appear here"}
                    </Text>

                    {loadingProviderServices ? (
                      <ActivityIndicator
                        size="large"
                        color="#094569"
                        className="py-8"
                      />
                    ) : providerServices.length > 0 ? (
                      <View className="space-y-3">
                        {providerServices.map((service) => (
                          <Animated.View
                            key={service.id}
                            entering={FadeInRight}
                            exiting={FadeOutLeft}
                            layout={Layout.springify()}
                            className="mb-3"
                          >
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onLongPress={() =>
                                handleServiceLongPress(service.id)
                              }
                              onPress={() =>
                                isServiceSelectionMode
                                  ? toggleServiceSelection(service.id)
                                  : router.push(
                                      `/(users)/servicedetail/${service.id}` as any,
                                    )
                              }
                              className={`bg-white rounded-[24px] p-3 shadow-sm border-2 ${
                                selectedServiceIds.includes(service.id)
                                  ? "border-primary bg-blue-50/50"
                                  : "border-transparent"
                              }`}
                            >
                              <View className="flex-row">
                                {/* Service Image with Selection Overlay */}
                                <View className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 relative">
                                  {service.images &&
                                  service.images.length > 0 ? (
                                    <Image
                                      source={{ uri: service.images[0] }}
                                      className="w-full h-full"
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View className="w-full h-full items-center justify-center">
                                      <Wrench
                                        size={32}
                                        className="text-gray-400"
                                      />
                                    </View>
                                  )}

                                  {/* Selection Checkmark Overlay */}
                                  {selectedServiceIds.includes(service.id) && (
                                    <View className="absolute inset-0 bg-primary/30 items-center justify-center">
                                      <CheckCircle2
                                        color="white"
                                        size={28}
                                        strokeWidth={3}
                                      />
                                    </View>
                                  )}
                                </View>

                                {/* Service Info */}
                                <View className="flex-1 ml-4">
                                  <Text
                                    className="text-base font-mbold text-gray-900"
                                    numberOfLines={1}
                                  >
                                    {service.name}
                                  </Text>

                                  {service.service_categories && (
                                    <Text className="text-xs font-regular text-primary mb-1">
                                      {service.service_categories.name}
                                    </Text>
                                  )}

                                  <Text
                                    className="text-sm font-regular text-gray-600"
                                    numberOfLines={2}
                                  >
                                    {service.description}
                                  </Text>
                                </View>

                                {/* Action Controls - Only show when NOT in selection mode */}
                                {!isServiceSelectionMode && (
                                  <View className="items-center justify-between ml-2">
                                    {/* Toggle Switch */}
                                    <View className="items-center mb-2">
                                      <Switch
                                        value={service.status}
                                        onValueChange={(value) =>
                                          handleToggleStatus(service.id, value)
                                        }
                                        trackColor={{
                                          false: "#D1D5DB",
                                          true: "#10B981",
                                        }}
                                        thumbColor={
                                          service.status ? "#059669" : "#F3F4F6"
                                        }
                                        ios_backgroundColor="#D1D5DB"
                                      />
                                      <Text
                                        className={`text-[10px] font-msemibold mt-1 ${
                                          service.status
                                            ? "text-green-700"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {service.status ? "Active" : "Inactive"}
                                      </Text>
                                    </View>

                                    {/* Edit Button */}
                                    <TouchableOpacity
                                      onPress={() => handleEditService(service)}
                                      className="w-9 h-9 bg-gray-50 items-center justify-center rounded-full border border-gray-100"
                                    >
                                      <Edit3 size={16} color="#4B5563" />
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          </Animated.View>
                        ))}
                      </View>
                    ) : (
                      <View className="items-center justify-center py-8 bg-gray-50 rounded-xl">
                        <Wrench size={48} className="text-gray-400 mb-4" />
                        <Text className="text-base text-gray-500">
                          No services listed yet
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Floating Delete Bar for Service Selection */}
                  {isServiceSelectionMode && selectedServiceIds.length > 0 && (
                    <Animated.View
                      entering={FadeInDown.duration(400)}
                      exiting={FadeOutDown}
                      className="absolute bottom-6 left-6 right-6 h-20 bg-gray-900 rounded-[35px] flex-row items-center justify-between px-8 shadow-2xl"
                    >
                      <View>
                        <Text className="text-white font-mbold text-lg">
                          {selectedServiceIds.length}
                        </Text>
                        <Text className="text-gray-400 text-[10px] uppercase tracking-widest font-mbold">
                          Selected Services
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-x-4">
                        <TouchableOpacity onPress={handleCancelSelection}>
                          <Text className="text-gray-400 font-msemibold">
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleDeleteSelectedServices}
                          className="bg-red-500 flex-row items-center px-6 py-3 rounded-full"
                        >
                          <Trash2 size={18} color="white" />
                          <Text className="text-white font-mbold ml-2">
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  )}
                </View>
              )}
              <View className="h-8" />
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* ------------------------------------------------------ */}
      {/* SMOOTH IMAGE PICKER MODAL */}
      {/* ------------------------------------------------------ */}
      {showImagePicker && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showImagePicker}
          onRequestClose={() => setShowImagePicker(false)}
        >
          <View className="flex-1 justify-end">
            <Animated.View
              entering={FadeIn}
              exiting={FadeOut}
              style={[
                {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                },
                rPickerBackdrop,
              ]}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setShowImagePicker(false)}
              />
            </Animated.View>

            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              style={[
                {
                  backgroundColor: "white",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                },
                rPickerStyle,
              ]}
            >
              {/* --- DRAG HANDLE START --- */}
              <GestureDetector gesture={pickerGesture}>
                <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                  <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </View>
              </GestureDetector>
              {/* --- DRAG HANDLE END --- */}

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  Change Profile Picture
                </Text>

                <TouchableOpacity
                  onPress={() => handleImageOption("camera")}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
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
                  onPress={() => handleImageOption("gallery")}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-6"
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
                  onPress={() => {
                    pickerTranslateY.value = withTiming(1000, {}, () => {
                      runOnJS(setShowImagePicker)(false);
                      runOnJS(setRefreshKey)((prev: number) => prev + 1);
                    });
                  }}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* MAIN PROFILE AVATAR ACTION MENU MODAL */}
      {/* ------------------------------------------------------ */}
      {showMainAvatarMenu && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showMainAvatarMenu}
          onRequestClose={() => setShowMainAvatarMenu(false)}
        >
          <View className="flex-1 justify-end">
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                }}
                activeOpacity={1}
                onPress={() => setShowMainAvatarMenu(false)}
              />
            </Animated.View>

            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  Profile Picture Options
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setShowMainAvatarMenu(false);
                    setTimeout(() => handleEditProfile(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
                >
                  <Camera size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-gray-900">
                      Change Photo
                    </Text>
                    <Text className="text-sm font-regular text-gray-500">
                      Take a new photo or choose from gallery
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRemoveMainAvatar}
                  className="flex-row items-center bg-red-50 rounded-xl px-4 py-4 mb-6"
                >
                  <Trash2 size={24} className="text-red-600 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-red-600">
                      Remove Photo
                    </Text>
                    <Text className="text-sm font-regular text-red-400">
                      Delete your profile picture
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-gray-100 rounded-xl py-4 items-center"
                  onPress={() => setShowMainAvatarMenu(false)}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* PROVIDER IMAGE PICKER MODAL */}
      {/* ------------------------------------------------------ */}
      {showProviderImagePicker && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="slide"
          visible={showProviderImagePicker}
          onRequestClose={() => setShowProviderImagePicker(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
              activeOpacity={1}
              onPress={() => setShowProviderImagePicker(false)}
            />

            <View
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  Change Service Provider Photo
                </Text>

                <TouchableOpacity
                  onPress={() => handleProviderImageOption("camera")}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
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
                  onPress={() => handleProviderImageOption("gallery")}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-6"
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
                  onPress={() => setShowProviderImagePicker(false)}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* PROVIDER AVATAR ACTION MENU MODAL */}
      {/* ------------------------------------------------------ */}
      {showProviderAvatarMenu && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showProviderAvatarMenu}
          onRequestClose={() => setShowProviderAvatarMenu(false)}
        >
          <View className="flex-1 justify-end">
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                }}
                activeOpacity={1}
                onPress={() => setShowProviderAvatarMenu(false)}
              />
            </Animated.View>

            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  Avatar Options
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setShowProviderAvatarMenu(false);
                    setTimeout(() => handleEditProviderProfile(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
                >
                  <Camera size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-gray-900">
                      Change Photo
                    </Text>
                    <Text className="text-sm font-regular text-gray-500">
                      Take a new photo or choose from gallery
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRemoveProviderAvatar}
                  className="flex-row items-center bg-red-50 rounded-xl px-4 py-4 mb-6"
                >
                  <Trash2 size={24} className="text-red-600 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-red-600">
                      Remove Photo
                    </Text>
                    <Text className="text-sm font-regular text-red-400">
                      Delete your service provider avatar
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-gray-100 rounded-xl py-4 items-center"
                  onPress={() => setShowProviderAvatarMenu(false)}
                >
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
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showSettings}
          onRequestClose={() => setShowSettings(false)}
        >
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={{
              height: "100%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
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
          </Animated.View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* FOLLOW REQUESTS MODAL */}
      {/* ------------------------------------------------------ */}
      {showFollowRequests && currentUser?.id && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showFollowRequests}
          onRequestClose={() => setShowFollowRequests(false)}
        >
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={{
              height: "100%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <FollowRequestsOverlay
              onClose={() => {
                setShowFollowRequests(false);
                setRefreshKey((prev) => prev + 1);
              }}
              userId={currentUser.id}
              initialTab={followRequestsTab}
            />
          </Animated.View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* PENDING FOLLOW REQUESTS MODAL */}
      {/* ------------------------------------------------------ */}
      {showPendingRequests && currentUser?.id && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showPendingRequests}
          onRequestClose={() => setShowPendingRequests(false)}
        >
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={{
              height: "100%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <FollowRequests
              onClose={() => {
                setShowPendingRequests(false);
                setRefreshKey((prev) => prev + 1);
              }}
              userId={currentUser.id}
            />
          </Animated.View>
        </Modal>
      )}

      {/* ------------------------------------------------------ */}
      {/* MANAGE LISTINGS MODAL */}
      {/* ------------------------------------------------------ */}
      {showManageListings && currentUser?.id && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showManageListings}
          onRequestClose={() => setShowManageListings(false)}
        >
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={SlideOutDown}
            style={{
              height: "100%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <ManageListingsOverlay
              onClose={() => {
                setShowManageListings(false);
                setRefreshKey((prev) => prev + 1);
              }}
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
          onClose={() => {
            setShowImageViewer(false);
            setRefreshKey((prev) => prev + 1);
          }}
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
          onClose={() => {
            setShowProfileImageViewer(false);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}

      {/* Edit Service Modal */}
      {showEditServiceModal && serviceToEdit && (
        <EditServicesModal
          isVisible={showEditServiceModal}
          onClose={() => {
            setShowEditServiceModal(false);
            setServiceToEdit(null);
          }}
          service={serviceToEdit}
          userId={currentUser?.id || ""}
          onSuccess={() => {
            setShowEditServiceModal(false);
            setServiceToEdit(null);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}

      {/* License Viewer Overlay */}
      {showLicenseViewer && licenseImageUrl && (
        <LicenseViewerOverlay
          visible={showLicenseViewer}
          licenseUrl={licenseImageUrl}
          onClose={() => setShowLicenseViewer(false)}
        />
      )}

      {/* ------------------------------------------------------ */}
      {/* LICENSE ACTION MENU MODAL */}
      {/* ------------------------------------------------------ */}
      {showLicenseMenu && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showLicenseMenu}
          onRequestClose={() => setShowLicenseMenu(false)}
        >
          <View className="flex-1 justify-end">
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                }}
                activeOpacity={1}
                onPress={() => setShowLicenseMenu(false)}
              />
            </Animated.View>

            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              style={{
                backgroundColor: "white",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View className="w-full items-center pt-5 pb-4 bg-white rounded-t-3xl">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  License Options
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setShowLicenseMenu(false);
                    setTimeout(() => handleViewLicense(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
                >
                  <Eye size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-gray-900">
                      View License
                    </Text>
                    <Text className="text-sm font-regular text-gray-500">
                      See your uploaded license document
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowLicenseMenu(false);
                    setTimeout(() => handleUploadLicense(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4 mb-3"
                >
                  <Upload size={24} className="text-gray-700 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-gray-900">
                      Replace License
                    </Text>
                    <Text className="text-sm font-regular text-gray-500">
                      Upload a new license document
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRemoveLicense}
                  className="flex-row items-center bg-red-50 rounded-xl px-4 py-4 mb-6"
                >
                  <Trash2 size={24} className="text-red-600 mr-4" />
                  <View>
                    <Text className="text-base font-msemibold text-red-600">
                      Remove License
                    </Text>
                    <Text className="text-sm font-regular text-red-400">
                      Delete license and reset verification
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-gray-100 rounded-xl py-4 items-center"
                  onPress={() => setShowLicenseMenu(false)}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Success/Error Popups */}
      <PopupMessage
        visible={showSuccess}
        type="success"
        message={popupMessage}
      />
      <PopupMessage visible={showError} type="error" message={popupMessage} />
    </View>
  );
}
