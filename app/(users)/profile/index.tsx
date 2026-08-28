import FollowRequests from "@/components/modals/FollowRequests";
import FollowRequestsOverlay from "@/components/modals/FollowRequestsOverlay";
import ImageCropOverlay from "@/components/modals/ImageCropOverlay";
import LicenseViewerOverlay from "@/components/modals/LicenseViewerOverlay";
import ManageListingsOverlay from "@/components/modals/ManageListingsOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ProfileSettings from "@/components/modals/ProfileSettings";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import { useUser } from "@/contexts/UserContext";
import { useIsFocused } from "@react-navigation/native";
// Added import for profile services
import AddServicesModal from "@/components/modals/AddServicesModal";
import CreatePost from "@/components/modals/CreatePost";
import EditServicesModal from "@/components/modals/EditServicesModal";
// Custom hooks
import { useProfileData } from "@/hooks/profile/useProfileData";
import { useServiceProvider } from "@/hooks/profile/useServiceProvider";
import { useUserPosts } from "@/hooks/profile/useUserPosts";
import { useUserProducts } from "@/hooks/profile/useUserProducts";
import { useEarlyAccessBadge } from "@/hooks/useEarlyAccessBadge";
// Profile components
import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import ProfilePostGridItem, { profileGridCellHeight } from "@/components/profile/ProfilePostGridItem";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import ServiceProviderSection from "@/components/profile/ServiceProviderSection";
import BottomNavBar from "@/components/ui/BottomNavBar";
import CircularLoader from "@/components/ui/CircularLoader";
import { useBottomBarScroll } from "@/hooks/useBottomBarScroll";
import { useGridReveal } from "@/hooks/useGridReveal";
import PopupMessage from "@/components/ui/PopupMessage";
import {
    deleteAvatar,
    updateUserProfile,
    uploadAvatar,
} from "@/lib/profileService";
import { getProfileViewCount7d } from "@/lib/viewTrackingService";
import {
    deleteLicenseImage,
    deleteProviderAvatar,
    deleteProviderService,
    ProviderServiceWithDetails,
    toggleServiceStatus,
    updateServiceProviderLicense,
    updateServiceProviderProfile,
    uploadLicenseImage,
    uploadProviderAvatar,
} from "@/lib/servicesService";
import {
    buildProfileExternalSharePayload,
} from "@/lib/shareUtils";
import { useAppRouter } from "@/utils/navigation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
    Camera,
    Eye,
    GalleryHorizontal,
    Grid,
    ImageIcon,
    Package,
    Settings,
    Share2,
    ShoppingBag,
    Trash2,
    Upload,
    User,
    UserPlus,
    Verified,
    Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    InteractionManager,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- Reanimated & Gesture Handler ---
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    FadeOutDown,
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";

export default function ProfileScreen() {
  const { currentUser, setCurrentUser, logout } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  // A screen pushed on top of this one (e.g. /post/[id], presented as a
  // transparentModal so this stays mounted/visible underneath while its own
  // ContextDrop edge-swipe-back is in progress) shouldn't leave this still
  // competing for the same touches — this screen's own full-bleed
  // horizontal Main/Work tab ScrollView spans the same left-edge strip
  // ContextDrop captures from, and was winning that race often enough to
  // make the edge-swipe unreliable whenever a post was opened from here.
  // Turning this off entirely while unfocused removes it from the picture.
  const isFocused = useIsFocused();
  const { scale: bottomBarScale, onScroll: onBottomBarScroll } = useBottomBarScroll();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [mainTab, setMainTab] = useState<"main" | "work">(
    tab === "work" ? "work" : "main",
  );
  const [activeTab, setActiveTab] = useState<
    "images" | "products" | "services"
  >("images");

  // UI State
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pendingImageOption, setPendingImageOption] = useState<
    "camera" | "gallery" | null
  >(null);
  const [showMainAvatarMenu, setShowMainAvatarMenu] = useState(false);
  const [showProviderImagePicker, setShowProviderImagePicker] = useState(false);
  const [pendingProviderImageOption, setPendingProviderImageOption] = useState<
    "camera" | "gallery" | null
  >(null);
  const [showProviderAvatarMenu, setShowProviderAvatarMenu] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialModal, setSettingsInitialModal] = useState<
    string | undefined
  >(undefined);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [followRequestsTab, setFollowRequestsTab] = useState<
    "following" | "followers"
  >("following");
  const [showManageListings, setShowManageListings] = useState(false);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageDims, setSelectedImageDims] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Service management state (kept here, not in provider hook)
  const [isEditingProvider, setIsEditingProvider] = useState(false);

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

  // Profile image viewer state
  const [showProfileImageViewer, setShowProfileImageViewer] = useState(false);
  const [showProviderWorkImageViewer, setShowProviderWorkImageViewer] =
    useState(false);

  // License viewer state
  const [showLicenseViewer, setShowLicenseViewer] = useState(false);
  const [showLicenseMenu, setShowLicenseMenu] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [showShareComposer, setShowShareComposer] = useState(false);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

  // Popup helpers
  const showErrorPopup = (message: string, title: string = "Error") => {
    setPopupMessage(message);
    setPopupTitle(title);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  const showSuccessPopup = (message: string, title: string = "Success") => {
    setPopupMessage(message);
    setPopupTitle(title);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const profileSharePayload = useMemo(() => {
    if (!currentUser?.id) return null;
    return buildProfileExternalSharePayload({
      id: String(currentUser.id),
      name: currentUser.name || currentUser.full_name || undefined,
      username: currentUser.username || undefined,
    });
  }, [currentUser]);

  const handleShareProfile = () => {
    if (!profileSharePayload) {
      showErrorPopup("Profile link unavailable right now.");
      return;
    }
    setShowShareComposer(true);
  };

  // ------------------------------------------------------
  // CUSTOM HOOKS
  // ------------------------------------------------------

  // Profile data hook
  const {
    profileImage,
    setProfileImage,
    followerCount,
    setFollowerCount,
    followingCount,
    setFollowingCount,
  } = useProfileData(refreshKey);

  // 7-day rolling profile view count
  const [profileViews7d, setProfileViews7d] = useState<number>(0);
  useEffect(() => {
    if (!currentUser?.id) return;
    getProfileViewCount7d(currentUser.id).then(setProfileViews7d).catch(() => {});
  }, [currentUser?.id]);

  // Early-access badge for the logged-in user
  const badgeType = useEarlyAccessBadge(currentUser?.id);

  // Service provider hook
  const {
    serviceProvider,
    setServiceProvider,
    loadingServiceProvider,
    providerFormData,
    setProviderFormData,
    providerImageUri,
    setProviderImageUri,
    licenseImageUrl,
    setLicenseImageUrl,
    verificationStatus,
    setVerificationStatus,
    providerServices,
    setProviderServices,
    loadingProviderServices,
  } = useServiceProvider(refreshKey);

  // User posts hook
  const {
    userPosts,
    setUserPosts,
    loadingPosts,
    postThumbnails,
  } = useUserPosts(refreshKey, showErrorPopup);
  const postGridReveal = useGridReveal();
  useEffect(() => {
    postGridReveal.rearm();
  }, [postThumbnails.length, postGridReveal.rearm]);

  // User products hook
  const { userProducts, setUserProducts, loadingProducts } = useUserProducts(
    refreshKey,
    showErrorPopup,
  );

  // (Animation logic for avatar/picker modals removed — using native Modal animations now)

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
        setPendingImageOption(null);
        setShowMainAvatarMenu(false);
        setShowProviderImagePicker(false);
        setPendingProviderImageOption(null);
        setShowProviderAvatarMenu(false);
        setShowManageListings(false);
        setShowCropOverlay(false);
        setShowProfileImageViewer(false);
        setShowProviderWorkImageViewer(false);
        setShowLicenseViewer(false);
        setShowLicenseMenu(false);
      };
    }, []),
  );

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleEditProfile = () => {
    if (Platform.OS === "ios") {
      Alert.alert("Change Profile Picture", undefined, [
        {
          text: "Take Photo",
          onPress: () => handleImageOption("camera"),
        },
        {
          text: "Choose from Gallery",
          onPress: () => handleImageOption("gallery"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
      return;
    }
    setShowMainAvatarMenu(true);
  };
  const handleEditProviderProfile = () => setShowProviderImagePicker(true);
  const handleSettings = () => { if (!showSettings) setShowSettings(true); };
  const handleFollowRequests = () => setShowPendingRequests(true);
  const handleManageListings = () => setShowManageListings(true);

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
        name: providerFormData.businessName,
        master_bio: providerFormData.bio,
        email: providerFormData.email.trim() || null,
        contact: providerFormData.contact.trim() || null,
        email_active: providerFormData.email.trim()
          ? providerFormData.emailActive
          : false,
        contact_active: providerFormData.contact.trim()
          ? providerFormData.contactActive
          : false,
      });

      setIsEditingProvider(false);
      setRefreshKey((prev) => prev + 1);
      showSuccessPopup(
        "Service provider profile updated successfully",
        "Profile Updated!",
      );
    } catch (error) {
      console.error("Failed to update service provider profile:", error);
      showErrorPopup(
        "Failed to update profile. Please try again.",
        "Update Failed",
      );
    }
  };

  // Handle edit mode toggle
  const handleToggleEditProvider = () => {
    if (isEditingProvider) {
      // Cancel editing - reload original data
      if (serviceProvider) {
        setProviderFormData({
          businessName: serviceProvider.name || "",
          email: serviceProvider.email || "",
          contact: serviceProvider.contact || "",
          emailActive: serviceProvider.email_active || false,
          contactActive: serviceProvider.contact_active || false,
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
    setSelectedImageDims(null);

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

      showSuccessPopup(
        "Profile has been changed successfully",
        "Profile Saved!",
      );
    } catch (error) {
      console.error("Failed to save profile image:", error);
      showErrorPopup(
        "Failed to save profile image. Please try again.",
        "Save Failed",
      );
      // Optional: Revert profileImage state here if needed
    }
  };

  const handleCropCancel = () => {
    setShowCropOverlay(false);
    setSelectedImageUri(null);
    setSelectedImageDims(null);
  };

  const ensureCameraPermission = async (
    message = "Camera access is needed.",
  ) => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      showErrorPopup(message, "Permission Denied");
      return false;
    }
    return true;
  };

  const waitForIosModalDismiss = async () => {
    if (Platform.OS !== "ios") return;
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
  };

  const openImageOption = async (option: "camera" | "gallery") => {
    try {
      const useNativeEditor = Platform.OS === "ios";
      // Defensive cleanup to avoid any stale overlays intercepting touches.
      setShowMainAvatarMenu(false);
      setShowImagePicker(false);
      setShowError(false);
      setShowSuccess(false);
      let result;
      if (option === "camera") {
        const cameraGranted = await ensureCameraPermission(
          "Camera access is needed.",
        );
        if (!cameraGranted) return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: useNativeEditor,
          aspect: [1, 1],
          quality: 1.0,
        });
      } else {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.", "Permission Denied");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: useNativeEditor,
          aspect: [1, 1],
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (useNativeEditor) {
          // iOS: use native editor result directly to avoid custom crop overlay
          // modal interactions that can leave touches blocked after camera return.
          await handleCropSave(asset.uri);
        } else {
          setSelectedImageUri(asset.uri);
          // Pass actual picker dimensions to avoid EXIF orientation issues with Image.getSize
          if (asset.width && asset.height) {
            setSelectedImageDims({ width: asset.width, height: asset.height });
          } else {
            setSelectedImageDims(null);
          }
          setShowCropOverlay(true);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showErrorPopup("Failed to select image.", "Selection Failed");
    }
  };

  const openProviderImageOption = async (option: "camera" | "gallery") => {
    if (!currentUser?.id) return;

    try {
      let result;
      if (option === "camera") {
        const cameraGranted = await ensureCameraPermission(
          "Camera access is needed.",
        );
        if (!cameraGranted) return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1.0,
        });
      } else {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          showErrorPopup("Gallery access is needed.", "Permission Denied");
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

          showSuccessPopup(
            "Service provider avatar updated successfully",
            "Avatar Updated!",
          );
        } catch (uploadError) {
          console.error("Failed to upload provider avatar:", uploadError);
          showErrorPopup(
            "Failed to upload avatar. Please try again.",
            "Upload Failed",
          );
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
      showErrorPopup("Failed to select image.", "Selection Failed");
    }
  };

  const handleImageOption = (option: "camera" | "gallery") => {
    setPendingImageOption(option);
    setShowMainAvatarMenu(false);
    setShowImagePicker(false);
  };

  const handleProviderImageOption = (option: "camera" | "gallery") => {
    setPendingProviderImageOption(option);
    setShowProviderImagePicker(false);
  };

  useEffect(() => {
    if (showImagePicker || showMainAvatarMenu || !pendingImageOption) return;

    let cancelled = false;
    (async () => {
      await waitForIosModalDismiss();
      if (cancelled) return;
      const option = pendingImageOption;
      setPendingImageOption(null);
      await openImageOption(option);
    })();

    return () => {
      cancelled = true;
    };
  }, [showImagePicker, showMainAvatarMenu, pendingImageOption]);

  useEffect(() => {
    if (showProviderImagePicker || !pendingProviderImageOption) return;

    let cancelled = false;
    (async () => {
      await waitForIosModalDismiss();
      if (cancelled) return;
      const option = pendingProviderImageOption;
      setPendingProviderImageOption(null);
      await openProviderImageOption(option);
    })();

    return () => {
      cancelled = true;
    };
  }, [showProviderImagePicker, pendingProviderImageOption, currentUser?.id]);

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
                newStatus ? "Activated!" : "Deactivated!",
              );
            } catch (error: any) {
              showErrorPopup(
                error.message || "Failed to update service status",
                "Update Failed",
              );
            }
          },
        },
      ],
    );
  };

  const handleEditService = (service: ProviderServiceWithDetails) => {
    Haptics.impactAsync(ImpactFeedbackStyle.Heavy);
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
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
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
              showSuccessPopup("Services deleted successfully", "Removed!");
            } catch (error: any) {
              showErrorPopup(
                error.message || "Failed to delete services",
                "Deletion Failed",
              );
            }
          },
        },
      ],
    );
  };

  const handleCancelSelection = () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
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
        showErrorPopup(
          "Gallery access is needed to upload license.",
          "Permission Denied",
        );
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
      showErrorPopup("Failed to select image.", "Selection Failed");
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
        "Uploaded!",
      );
    } catch (uploadError) {
      console.error("Failed to upload license:", uploadError);
      showErrorPopup(
        "Failed to upload license. Please try again.",
        "Upload Failed",
      );
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
              showSuccessPopup(
                "Profile picture removed successfully",
                "Removed!",
              );
            } catch (error) {
              console.error("Failed to remove profile picture:", error);
              showErrorPopup(
                "Failed to remove profile picture. Please try again.",
                "Removal Failed",
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
              showSuccessPopup("Avatar removed successfully", "Removed!");
            } catch (error) {
              console.error("Failed to remove provider avatar:", error);
              showErrorPopup(
                "Failed to remove avatar. Please try again.",
                "Removal Failed",
              );
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
              showSuccessPopup("License removed successfully", "Removed!");
            } catch (error) {
              console.error("Failed to remove license:", error);
              showErrorPopup(
                "Failed to remove license. Please try again.",
                "Removal Failed",
              );
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
    <View className="flex-1 bg-background" pointerEvents={isFocused ? "auto" : "none"}>
      {/* Fixed Header - Absolute Position */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
      >
        <View className="h-12 bg-transparent" />

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2 bg-transparent ">
          {/* Left Icons */}
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleFollowRequests}
              className="w-10 h-10 items-center justify-center"
            >
              <UserPlus size={24} strokeWidth={1.5} className="text-primary" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleManageListings}
              className="w-10 h-10 items-center justify-center"
            >
              <Package size={24} strokeWidth={1.5} className="text-primary" />
            </TouchableOpacity>
          </View>

          {/* Main/Work Tabs — center of topbar */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`px-6 py-1.5 items-center rounded-full ${mainTab === "main" ? "bg-primary" : "bg-gray-100"}`}
              onPress={() => handleMainTabChange("main")}
            >
              <Text
                className={`font-msemibold text-sm ${mainTab === "main" ? "text-white" : "text-gray-600"}`}
              >
                Main
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-6 py-1.5 items-center rounded-full ${mainTab === "work" ? "bg-primary" : "bg-gray-100"}`}
              onPress={() => handleMainTabChange("work")}
            >
              <Text
                className={`font-msemibold text-sm ${mainTab === "work" ? "text-white" : "text-gray-600"}`}
              >
                Work
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right Actions */}
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              onPress={handleShareProfile}
              className="w-10 h-10 items-center justify-center"
            >
              <Share2 size={22} strokeWidth={1.7} className="text-gray-700" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSettings}
              className="w-10 h-10 items-center justify-center"
            >
              <Settings size={24} strokeWidth={1.5} className="text-gray-700" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content with Top Padding for Fixed Header */}
      <View style={{ paddingTop: 84 }} className="flex-1">
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
          <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 84 }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: 100 }}
              onScroll={onBottomBarScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#094569"
                  progressViewOffset={0}
                />
              }
            >
              {/* Profile Info Section — Instagram style */}
              <View className="px-4 pt-5 pb-4">
                {/* Row: Avatar + Stats */}
                <View className="flex-row items-center mb-3">
                  {/* Avatar */}
                  <View className="relative">
                    <TouchableOpacity
                      onPress={() =>
                        profileImage
                          ? setShowProfileImageViewer(true)
                          : setShowMainAvatarMenu(true)
                      }
                      onLongPress={() => setShowMainAvatarMenu(true)}
                      activeOpacity={0.85}
                      className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100"
                    >
                      {profileImage ? (
                        <ProgressiveImage
                          uri={profileImage}
                          style={{ width: "100%", height: "100%" }}
                          showProgress={false}
                          priority="high"
                        />
                      ) : (
                        <View className="w-full h-full items-center justify-center bg-gray-100">
                          <User size={34} strokeWidth={1.5} color="#9ca3af" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowMainAvatarMenu(true)}
                      className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-white items-center justify-center"
                    >
                      <Camera size={12} strokeWidth={1.5} color="white" />
                    </TouchableOpacity>
                  </View>

                  {/* Stats row + Badge */}
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center justify-around">
                      <View className="items-center">
                        <Text className="text-lg font-mbold text-gray-900">
                          {userPosts.length}
                        </Text>
                        <Text className="text-xs font-regular text-gray-500">
                          Posts
                        </Text>
                      </View>
                      <TouchableOpacity
                        className="items-center"
                        onPress={() => {
                          setFollowRequestsTab("followers");
                          setShowFollowRequests(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-lg font-mbold text-gray-900">
                          {followerCount}
                        </Text>
                        <Text className="text-xs font-regular text-gray-500">
                          Followers
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="items-center"
                        onPress={() => {
                          setFollowRequestsTab("following");
                          setShowFollowRequests(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-lg font-mbold text-gray-900">
                          {followingCount}
                        </Text>
                        <Text className="text-xs font-regular text-gray-500">
                          Following
                        </Text>
                      </TouchableOpacity>
                      {/* Profile views — private 7-day rolling stat */}
                      {profileViews7d > 0 && (
                        <>
                          <Text className="text-gray-300 text-xl font-light">|</Text>
                          <View className="items-center">
                            <View className="flex-row items-center" style={{ gap: 3 }}>
                              <Eye size={14} color="#1F2937" />
                              <Text className="text-lg font-mbold text-gray-900">
                                {profileViews7d > 999
                                  ? `${(profileViews7d / 1000).toFixed(1)}k`
                                  : profileViews7d}
                              </Text>
                            </View>
                            <Text className="text-xs font-regular text-gray-500">
                              Profile views
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                    {badgeType && (
                      <TouchableOpacity
                        style={{ marginTop: 10 }}
                        onPress={() => {
                          if (showSettings) return;
                          setSettingsInitialModal("appearance");
                          setShowSettings(true);
                        }}
                      >
                        <EarlyAccessBadge badgeType={badgeType} size="sm" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Name & Email */}
                <View className="flex-row items-center gap-1.5 mb-0.5">
                  <Text className="text-base font-mbold text-gray-900">
                    {currentUser.name}
                  </Text>
                  {verificationStatus === "verified" && (
                    <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                      <Verified size={11} color="#094569" />
                      <Text className="text-[10px] font-msemibold text-[#094569] leading-none">
                        Verified
                      </Text>
                    </View>
                  )}
                </View>
                {currentUser.email && (
                  <Text className="text-sm font-regular text-gray-500 mb-3">
                    {currentUser.email}
                  </Text>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity
                    onPress={() => {
                      if (showSettings) return;
                      setSettingsInitialModal("editProfile");
                      setShowSettings(true);
                    }}
                    className="flex-1 py-[9px] rounded-lg flex-row items-center justify-center bg-gray-100 border border-gray-300"
                  >
                    <Text className="text-sm font-semibold text-gray-800">
                      Edit Profile
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleManageListings}
                    className="flex-1 py-[9px] rounded-lg flex-row items-center justify-center bg-gray-100 border border-gray-300"
                  >
                    <Text className="text-sm font-semibold text-gray-800">
                      Manage
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tab Navigation */}
              <View className="bg-transparent border-b border-gray-100 mt-2">
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "images"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("images")}
                  >
                    <GalleryHorizontal
                      size={24}
                      strokeWidth={1.5}
                      className={`mb-1 ${
                        activeTab === "images"
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "images"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Media
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
                      strokeWidth={1.5}
                      className={`mb-1 ${
                        activeTab === "products"
                          ? "text-primary"
                          : "text-gray-400"
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
                    className={`flex-1 py-4 items-center border-b-2 ${
                      activeTab === "services"
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    onPress={() => setActiveTab("services")}
                  >
                    <Wrench
                      size={24}
                      strokeWidth={1.5}
                      className={`mb-1 ${
                        activeTab === "services"
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <Text
                      className={`font-msemibold text-xs ${
                        activeTab === "services"
                          ? "text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      Services
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tab Content */}
              <View className="min-h-[300px]">
                {activeTab === "images" && (
                  <View
                    ref={postGridReveal.containerRef}
                    collapsable={false}
                    className="flex-row flex-wrap"
                  >
                    {loadingPosts ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : postThumbnails.length > 0 ? (
                      postThumbnails.map((thumb, index) => {
                        const cellHeight = profileGridCellHeight(SCREEN_WIDTH);
                        const top = Math.floor(index / 3) * cellHeight;
                        return (
                          <ProfilePostGridItem
                            key={thumb.postId}
                            thumbnailUrl={thumb.thumbnailUrl}
                            thumbnailBlurHash={thumb.thumbnailBlurHash}
                            isVideo={thumb.isVideo}
                            mediaCount={thumb.mediaCount}
                            deferred={!postGridReveal.isNear(thumb.postId, top, cellHeight)}
                            priority={postGridReveal.isAboveFold(top) ? "high" : "normal"}
                            onPress={() =>
                              router.push(
                                `/(users)/post/${thumb.postId}` as any,
                              )
                            }
                          />
                        );
                      })
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                          <Grid size={26} strokeWidth={1.5} color="#3B82F6" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          Share your first moment
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          Your posts and media will show up here
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowCreatePost(true)}
                          className="mt-4 bg-primary px-5 py-2.5 rounded-full"
                        >
                          <Text className="text-white text-sm font-semibold">
                            Create a Post
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "products" && (
                  <View className="flex-row flex-wrap">
                    {loadingProducts ? (
                      <CircularLoader size="large" color="#059669" />
                    ) : userProducts.length > 0 ? (
                      userProducts.map((product) => (
                        <View key={product.id} className="w-[50%] p-2">
                          <TouchableOpacity
                            onPress={() =>
                              router.push(
                                `/(users)/product/${product.id}` as any,
                              )
                            }
                            className="bg-white rounded-xl overflow-hidden border border-gray-100"
                          >
                            {product.images && product.images.length > 0 ? (
                              <ProgressiveImage
                                uri={product.images[0]}
                                style={{ width: "100%", height: 160 }}
                                showProgress={false}
                                recyclingKey={product.id}
                              />
                            ) : (
                              <View className="w-full h-40 bg-gray-100 items-center justify-center">
                                <ShoppingBag
                                  size={32}
                                  strokeWidth={1.5}
                                  className="text-gray-300"
                                />
                              </View>
                            )}
                            <View className="p-3">
                              <Text
                                className="text-sm font-msemibold text-gray-900"
                                numberOfLines={2}
                              >
                                {product.name}
                              </Text>
                              <Text
                                className="text-xs font-regular text-gray-500 mt-1"
                                numberOfLines={1}
                              >
                                {product.category}
                              </Text>
                              <Text className="text-base font-mbold text-primary mt-2">
                                Nu. {product.price.toLocaleString()}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-3">
                          <ShoppingBag
                            size={26}
                            strokeWidth={1.5}
                            color="#059669"
                          />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          Start selling on Namzoed
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          List your first product and reach buyers nearby
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            router.push("/(users)/(tabs)/categories" as any)
                          }
                          className="mt-4 bg-emerald-600 px-5 py-2.5 rounded-full"
                        >
                          <Text className="text-white text-sm font-semibold">
                            List a Product
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === "services" && (
                  <View className="flex-row flex-wrap">
                    {providerServices.length > 0 ? (
                      providerServices.map((service) => (
                        <View key={service.id} className="w-[50%] p-2">
                          <TouchableOpacity
                            onPress={() =>
                              router.push(
                                `/(users)/servicedetail/${service.id}` as any,
                              )
                            }
                            className="bg-transparent rounded-xl overflow-hidden border border-gray-100"
                          >
                            {service.images && service.images.length > 0 ? (
                              <ProgressiveImage
                                uri={service.images[0]}
                                style={{ width: "100%", height: 160 }}
                                showProgress={false}
                                recyclingKey={service.id}
                              />
                            ) : (
                              <View className="w-full h-40 bg-gray-100 items-center justify-center">
                                <Wrench
                                  size={32}
                                  strokeWidth={1.5}
                                  color="#9CA3AF"
                                />
                              </View>
                            )}
                            <View className="p-3">
                              <Text
                                className="text-sm font-msemibold text-gray-900"
                                numberOfLines={2}
                              >
                                {service.name}
                              </Text>
                              {service.service_categories?.name && (
                                <Text
                                  className="text-xs font-regular text-gray-500 mt-1"
                                  numberOfLines={1}
                                >
                                  {service.service_categories.name}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <View className="w-full py-16 items-center px-6">
                        <View className="w-14 h-14 rounded-full bg-amber-50 items-center justify-center mb-3">
                          <Wrench size={26} strokeWidth={1.5} color="#D97706" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700">
                          Offer your skills as services
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1 text-center">
                          Switch to the Work tab to manage your services
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>

          {/* Work Profile Page (Service Provider) */}
          <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 84 }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: 100 }}
              onScroll={onBottomBarScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#094569"
                  progressViewOffset={0}
                />
              }
            >
              <ServiceProviderSection
                loadingServiceProvider={loadingServiceProvider}
                isEditingProvider={isEditingProvider}
                providerImageUri={providerImageUri}
                verificationStatus={verificationStatus}
                providerFormData={providerFormData}
                licenseImageUrl={licenseImageUrl}
                uploadingLicense={uploadingLicense}
                providerServices={providerServices}
                loadingProviderServices={loadingProviderServices}
                isServiceSelectionMode={isServiceSelectionMode}
                selectedServiceIds={selectedServiceIds}
                onEditWork={() => {
                  if (showSettings) return;
                  setSettingsInitialModal("editWorkProfile");
                  setShowSettings(true);
                }}
                onShowProviderAvatarMenu={() => {
                  Haptics.impactAsync(ImpactFeedbackStyle.Medium);
                  setShowProviderAvatarMenu(true);
                }}
                onViewProviderImage={() => {
                  Haptics.impactAsync(ImpactFeedbackStyle.Medium);
                  setShowProviderWorkImageViewer(true);
                }}
                onEditProviderProfile={() => {
                  Haptics.impactAsync(ImpactFeedbackStyle.Medium);
                  handleEditProviderProfile();
                }}
                onUploadLicense={handleUploadLicense}
                onShowLicenseMenu={() => {
                  Haptics.impactAsync(ImpactFeedbackStyle.Medium);
                  setShowLicenseMenu(true);
                }}
                onServiceLongPress={handleServiceLongPress}
                onToggleServiceSelection={toggleServiceSelection}
                onToggleStatus={handleToggleStatus}
                onEditService={handleEditService}
                onNavigateToService={(serviceId) =>
                  router.push(`/(users)/servicedetail/${serviceId}` as any)
                }
                onAddService={() => setShowAddServiceModal(true)}
              />

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
                      <Text className="text-white font-mbold ml-2">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* ------------------------------------------------------ */}
      {/* MAIN PROFILE AVATAR ACTION MENU MODAL (merged) */}
      {/* ------------------------------------------------------ */}
      {showMainAvatarMenu && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="fade"
          visible={showMainAvatarMenu}
          onRequestClose={() => setShowMainAvatarMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "flex-end",
            }}
            onPress={() => setShowMainAvatarMenu(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "white",
                borderRadius: 24,
                marginHorizontal: 12,
                marginBottom: 12 + insets.bottom,
              }}
            >
              <View className="px-4 pt-4 pb-4">
                <View className="flex-row gap-x-3 mb-3">
                  <TouchableOpacity
                    onPress={() => handleImageOption("camera")}
                    className="flex-1 items-center bg-gray-50 rounded-xl py-2"
                  >
                    <Camera size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Take Photo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleImageOption("gallery")}
                    className="flex-1 items-center bg-gray-50 rounded-xl py-2"
                  >
                    <ImageIcon size={18} color="#374151" />
                    <Text className="text-[10px] font-msemibold text-gray-900 mt-1">
                      Choose Gallery
                    </Text>
                  </TouchableOpacity>

                  {profileImage && (
                    <TouchableOpacity
                      onPress={handleRemoveMainAvatar}
                      className="flex-1 items-center bg-red-50 rounded-xl py-2"
                    >
                      <Trash2 size={18} color="#dc2626" />
                      <Text className="text-[10px] font-msemibold text-red-600 mt-1">
                        Remove
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  className="bg-gray-100 rounded-2xl py-3 items-center"
                  onPress={() => setShowMainAvatarMenu(false)}
                >
                  <Text className="text-gray-500 font-msemibold text-sm">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
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
          onRequestClose={() => {
            /* handled inside ProfileSettings */
          }}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}>
            <ProfileSettings
              onClose={() => {
                setShowSettings(false);
                setSettingsInitialModal(undefined);
              }}
              currentUser={currentUser}
              initialModal={settingsInitialModal}
              onLogout={async () => {
                setShowSettings(false);
                setSettingsInitialModal(undefined);
                await logout();
                router.replace("/login");
              }}
            />
          </View>
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
            style={{ flex: 1 }}
          >
            <FollowRequestsOverlay
              onClose={() => {
                setShowFollowRequests(false);
                setRefreshKey((prev) => prev + 1);
              }}
              userId={currentUser.id}
              actorUserId={currentUser.id}
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
            style={{ flex: 1 }}
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
            style={{ flex: 1 }}
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
            imageWidth={selectedImageDims?.width}
            imageHeight={selectedImageDims?.height}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        </Modal>
      )}

      {/* Profile Image Viewer */}
      {showProfileImageViewer && profileImage && (
        <ProfileImageViewer
          visible={showProfileImageViewer}
          imageUri={profileImage}
          onClose={() => {
            setShowProfileImageViewer(false);
          }}
        />
      )}

      {showProviderWorkImageViewer && providerImageUri && (
        <ProfileImageViewer
          visible={showProviderWorkImageViewer}
          imageUri={providerImageUri}
          onClose={() => setShowProviderWorkImageViewer(false)}
        />
      )}

      {/* Add Service Modal */}
      <AddServicesModal
        isVisible={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        userId={currentUser?.id || ""}
        onSuccess={() => {
          setShowAddServiceModal(false);
          setRefreshKey((prev) => prev + 1);
        }}
      />

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
        title={popupTitle}
        message={popupMessage}
      />
      <PopupMessage
        visible={showError}
        type="error"
        title={popupTitle}
        message={popupMessage}
      />

      {profileSharePayload && (
        <ShareComposerModal
          visible={showShareComposer}
          onClose={() => setShowShareComposer(false)}
          heading="Share profile"
          sharePayload={profileSharePayload}
          inAppContextParams={{
            context_product_id: String(currentUser?.id || ""),
            context_product_title:
              currentUser?.name || currentUser?.full_name || currentUser?.username || "Profile",
            context_product_price: "",
            context_product_image:
              profileImage ||
              (currentUser as any)?.avatar_url ||
              currentUser?.profileImg ||
              "",
            context_source: "profile",
            context_caption: serviceProvider?.master_bio || "",
            context_username: currentUser?.username || "",
            context_verified: verificationStatus === "verified" ? "true" : "",
          }}
        />
      )}

      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View className="flex-1 bg-background">
          <CreatePost onClose={() => setShowCreatePost(false)} />
        </View>
      </Modal>

      <BottomNavBar scale={bottomBarScale} />
    </View>
  );
}
