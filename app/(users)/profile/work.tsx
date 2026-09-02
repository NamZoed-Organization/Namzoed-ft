// app/(users)/profile/work.tsx
//
// Full management screen for the "Work" (service-provider) side of a
// profile — license verification, business details, and the provider's
// service/product listings. Used to live as a swipeable "Work" tab on the
// main profile screen; that paging went away in favor of a compact summary
// card on the main profile (only shown once a business name is actually
// set) that pushes here.
//
// Also doubles as the read-only view of someone ELSE's work profile — pass
// ?userId=<their id> and every edit affordance (avatar/license upload, Add
// Service/Product, business-name edit) disappears, leaving just their
// business card, services, and products.
import AddServicesModal from "@/components/modals/AddServicesModal";
import CreateProductModal from "@/components/modals/CreateProductModal";
import EditServicesModal from "@/components/modals/EditServicesModal";
import LicenseViewerOverlay from "@/components/modals/LicenseViewerOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import ServiceProviderSection from "@/components/profile/ServiceProviderSection";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useServiceProvider } from "@/hooks/profile/useServiceProvider";
import { useUser } from "@/contexts/UserContext";
import { fetchUserProducts, Product } from "@/lib/productsService";
import {
  deleteProviderAvatar,
  deleteProviderService,
  deleteLicenseImage,
  ProviderServiceWithDetails,
  toggleServiceStatus,
  updateServiceProviderLicense,
  updateServiceProviderProfile,
  uploadLicenseImage,
  uploadProviderAvatar,
} from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  ChevronLeft,
  Eye,
  ImageIcon as ImageIconLucide,
  Plus,
  ShoppingBag,
  Trash2,
  Upload,
  Verified,
  Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WorkProfileScreen() {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { userId: viewUserIdParam } = useLocalSearchParams<{ userId?: string }>();
  const isOwnProfile = !viewUserIdParam || viewUserIdParam === currentUser?.id;
  const targetUserId = viewUserIdParam || currentUser?.id;

  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    serviceProvider,
    loadingServiceProvider,
    providerFormData,
    providerImageUri,
    setProviderImageUri,
    licenseImageUrl,
    setLicenseImageUrl,
    verificationStatus,
    setVerificationStatus,
    providerServices,
    setProviderServices,
    loadingProviderServices,
  } = useServiceProvider(refreshKey, isOwnProfile ? undefined : targetUserId);

  // Products tagged to the work profile (is_work_listing) — shown here
  // regardless of viewer; only the owner gets the "Add Product" button.
  const [workProducts, setWorkProducts] = useState<Product[]>([]);
  const [loadingWorkProducts, setLoadingWorkProducts] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    setLoadingWorkProducts(true);
    fetchUserProducts(targetUserId, { isWorkListing: true })
      .then((products) => {
        if (!cancelled) setWorkProducts(products as Product[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingWorkProducts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetUserId, refreshKey]);

  const [showProviderImagePicker, setShowProviderImagePicker] = useState(false);
  const [pendingProviderImageOption, setPendingProviderImageOption] = useState<
    "camera" | "gallery" | null
  >(null);
  const [showProviderAvatarMenu, setShowProviderAvatarMenu] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isServiceSelectionMode, setIsServiceSelectionMode] = useState(false);
  const [serviceToEdit, setServiceToEdit] =
    useState<ProviderServiceWithDetails | null>(null);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [showProviderWorkImageViewer, setShowProviderWorkImageViewer] =
    useState(false);
  const [showLicenseViewer, setShowLicenseViewer] = useState(false);
  const [showLicenseMenu, setShowLicenseMenu] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

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

  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowProviderImagePicker(false);
        setPendingProviderImageOption(null);
        setShowProviderAvatarMenu(false);
        setShowProviderWorkImageViewer(false);
        setShowLicenseViewer(false);
        setShowLicenseMenu(false);
      };
    }, []),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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

  const handleEditProviderProfile = () => setShowProviderImagePicker(true);

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

  const handleProviderImageOption = (option: "camera" | "gallery") => {
    setPendingProviderImageOption(option);
    setShowProviderImagePicker(false);
  };

  React.useEffect(() => {
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
              await Promise.all(
                selectedServiceIds.map((id) => deleteProviderService(id)),
              );

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

        if (licenseImageUrl) {
          Alert.alert(
            "Replace License",
            "Are you sure you want to replace your existing license document? This will set your verification status back to pending.",
            [
              { text: "Cancel", style: "cancel" },
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
          Alert.alert(
            "Upload License",
            "Are you sure you want to upload this document as your license?",
            [
              { text: "Cancel", style: "cancel" },
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

  const uploadLicenseDocument = async (imageUri: string) => {
    if (!currentUser?.id) return;

    setUploadingLicense(true);

    try {
      const publicUrl = await uploadLicenseImage(imageUri, currentUser.id);
      await updateServiceProviderLicense(currentUser.id, publicUrl);

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

  const handleViewLicense = () => {
    if (licenseImageUrl) {
      setShowLicenseViewer(true);
    }
  };

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
              if (providerImageUri && serviceProvider?.profile_url) {
                try {
                  await deleteProviderAvatar(serviceProvider.profile_url);
                } catch (error) {
                  console.error("Failed to delete avatar from storage:", error);
                }
              }

              await updateServiceProviderProfile(currentUser.id, {
                profile_url: undefined,
              });

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

              await updateServiceProviderProfile(currentUser.id, {
                identification: null,
                verification_status: "not_verified",
              });

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

  return (
    <View className="flex-1 bg-white" pointerEvents={isFocused ? "auto" : "none"}>
      <View
        style={{ paddingTop: insets.top }}
        className="bg-white border-b border-gray-100"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#111" />
          </TouchableOpacity>
          <Text className="text-lg font-mbold text-gray-900" numberOfLines={1}>
            {isOwnProfile ? "Work Profile" : serviceProvider?.name || "Work Profile"}
          </Text>
          <View className="w-9 h-9" />
        </View>
      </View>

      {loadingServiceProvider ? (
        <View className="flex-1 items-center justify-center">
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#094569"
              progressViewOffset={0}
            />
          }
        >
          {isOwnProfile ? (
            <ServiceProviderSection
              loadingServiceProvider={false}
              isEditingProvider={false}
              providerImageUri={providerImageUri}
              verificationStatus={verificationStatus}
              providerFormData={providerFormData}
              licenseImageUrl={licenseImageUrl}
              uploadingLicense={uploadingLicense}
              providerServices={providerServices}
              loadingProviderServices={loadingProviderServices}
              isServiceSelectionMode={isServiceSelectionMode}
              selectedServiceIds={selectedServiceIds}
              onEditWork={() =>
                router.push({
                  pathname: "/settings",
                  params: { modal: "editWorkProfile" },
                } as any)
              }
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
          ) : (
            <View className="px-4 pt-6">
              {/* Read-only business card — no edit/upload affordances */}
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }}
                className="bg-white p-5 mb-6 shadow-sm border border-gray-100 flex-row items-start"
              >
                <View className="flex-1 pr-4">
                  <View className="flex-row items-center gap-1.5 mb-0.5 flex-wrap">
                    <Text
                      className="text-lg font-mbold text-gray-900 flex-shrink"
                      numberOfLines={2}
                    >
                      {serviceProvider?.name || "Business"}
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
                  {serviceProvider?.master_bio ? (
                    <Text className="text-sm font-regular text-gray-500" numberOfLines={4}>
                      {serviceProvider.master_bio}
                    </Text>
                  ) : null}
                </View>
                <View className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden items-center justify-center border-2 border-gray-100">
                  {providerImageUri ? (
                    <ProgressiveImage
                      uri={providerImageUri}
                      style={{ width: "100%", height: "100%" }}
                      showProgress={false}
                      priority="high"
                    />
                  ) : (
                    <Wrench size={34} strokeWidth={1.5} color="#9ca3af" />
                  )}
                </View>
              </View>

              {/* Services — read-only grid (owner mode gets this same list
                  inside ServiceProviderSection above, with edit controls) */}
              <Text className="text-lg font-mbold text-gray-900 mb-3">Services</Text>
              <View className="flex-row flex-wrap mb-6">
                {loadingProviderServices ? (
                  <CircularLoader size="large" color="#059669" />
                ) : providerServices.length > 0 ? (
                  providerServices.map((service) => (
                    <View key={service.id} className="w-[50%] p-1.5">
                      <TouchableOpacity
                        style={{ borderRadius: 12, borderCurve: "continuous" }}
                        onPress={() =>
                          router.push(`/(users)/servicedetail/${service.id}` as any)
                        }
                        className="bg-white overflow-hidden border border-gray-100"
                      >
                        {service.images && service.images.length > 0 ? (
                          <ProgressiveImage
                            uri={service.images[0]}
                            style={{ width: "100%", height: 140 }}
                            showProgress={false}
                            recyclingKey={service.id}
                          />
                        ) : (
                          <View className="w-full h-32 bg-gray-100 items-center justify-center">
                            <Wrench size={28} strokeWidth={1.5} color="#9CA3AF" />
                          </View>
                        )}
                        <View className="p-2.5">
                          <Text className="text-sm font-msemibold text-gray-900" numberOfLines={2}>
                            {service.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text className="text-sm text-gray-400 px-1">No services yet</Text>
                )}
              </View>
            </View>
          )}

          {/* Products — tagged to this work profile (is_work_listing), shown
              regardless of viewer; only the owner can add one. */}
          <View className="px-4 mt-2">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-mbold text-gray-900">Products</Text>
              {isOwnProfile && (
                <TouchableOpacity
                  onPress={() => setShowAddProductModal(true)}
                  style={{ borderRadius: 999, borderCurve: "continuous" }}
                  className="flex-row items-center bg-primary px-3 py-1.5"
                >
                  <Plus size={14} color="white" style={{ marginRight: 4 }} />
                  <Text className="text-white text-xs font-semibold">Add Product</Text>
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row flex-wrap">
              {loadingWorkProducts ? (
                <CircularLoader size="large" color="#059669" />
              ) : workProducts.length > 0 ? (
                workProducts.map((product) => (
                  <View key={product.id} className="w-[50%] p-1.5">
                    <TouchableOpacity
                      style={{ borderRadius: 12, borderCurve: "continuous" }}
                      onPress={() => router.push(`/(users)/product/${product.id}` as any)}
                      className="bg-white overflow-hidden border border-gray-100"
                    >
                      {product.images && product.images.length > 0 ? (
                        <ProgressiveImage
                          uri={product.images[0]}
                          style={{ width: "100%", height: 140 }}
                          showProgress={false}
                          recyclingKey={product.id}
                        />
                      ) : (
                        <View className="w-full h-32 bg-gray-100 items-center justify-center">
                          <ShoppingBag size={28} strokeWidth={1.5} color="#9CA3AF" />
                        </View>
                      )}
                      <View className="p-2.5">
                        <Text className="text-sm font-msemibold text-gray-900" numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text className="text-sm font-mbold text-primary mt-1">
                          Nu. {product.price.toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text className="text-sm text-gray-400 px-1">
                  {isOwnProfile ? "No work products yet" : "No products yet"}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {isOwnProfile && currentUser?.id && (
        <CreateProductModal
          isVisible={showAddProductModal}
          onClose={() => {
            setShowAddProductModal(false);
            setRefreshKey((prev) => prev + 1);
          }}
          userId={currentUser.id}
          isWorkListing
        />
      )}

      {/* Floating Delete Bar for Service Selection */}
      {isOwnProfile && isServiceSelectionMode && selectedServiceIds.length > 0 && (
        <Animated.View
          style={{ borderRadius: 35, borderCurve: "continuous" }}
          entering={FadeInDown.duration(400)}
          exiting={FadeOutDown}
          className="absolute bottom-6 left-6 right-6 h-20 bg-gray-900 flex-row items-center justify-between px-8 shadow-2xl"
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
              <Text className="text-gray-400 font-msemibold">Cancel</Text>
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

      {/* PROVIDER IMAGE PICKER MODAL */}
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
                borderCurve: "continuous",
              }}
            >
              <View
                style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="w-full items-center pt-5 pb-4 bg-white">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  Change Service Provider Photo
                </Text>

                <TouchableOpacity
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={() => handleProviderImageOption("camera")}
                  className="flex-row items-center bg-gray-50 px-4 py-4 mb-3"
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={() => handleProviderImageOption("gallery")}
                  className="flex-row items-center bg-gray-50 px-4 py-4 mb-6"
                >
                  <ImageIconLucide size={24} className="text-gray-700 mr-4" />
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  className="bg-gray-100 py-4 items-center"
                  onPress={() => setShowProviderImagePicker(false)}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* PROVIDER AVATAR ACTION MENU MODAL */}
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
                borderCurve: "continuous",
              }}
            >
              <View
                style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="w-full items-center pt-5 pb-4 bg-white">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  Avatar Options
                </Text>

                <TouchableOpacity
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={() => {
                    setShowProviderAvatarMenu(false);
                    setTimeout(() => handleEditProviderProfile(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 px-4 py-4 mb-3"
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={handleRemoveProviderAvatar}
                  className="flex-row items-center bg-red-50 px-4 py-4 mb-6"
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  className="bg-gray-100 py-4 items-center"
                  onPress={() => setShowProviderAvatarMenu(false)}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {showProviderWorkImageViewer && providerImageUri && (
        <ProfileImageViewer
          visible={showProviderWorkImageViewer}
          imageUri={providerImageUri}
          onClose={() => setShowProviderWorkImageViewer(false)}
        />
      )}

      <AddServicesModal
        isVisible={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        userId={currentUser?.id || ""}
        onSuccess={() => {
          setShowAddServiceModal(false);
          setRefreshKey((prev) => prev + 1);
        }}
      />

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

      {showLicenseViewer && licenseImageUrl && (
        <LicenseViewerOverlay
          visible={showLicenseViewer}
          licenseUrl={licenseImageUrl}
          onClose={() => setShowLicenseViewer(false)}
        />
      )}

      {/* LICENSE ACTION MENU MODAL */}
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
                borderCurve: "continuous",
              }}
            >
              <View
                style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="w-full items-center pt-5 pb-4 bg-white">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              <View className="px-6 pb-6">
                <Text className="text-xl font-mbold text-gray-900 mb-6 text-center">
                  License Options
                </Text>

                <TouchableOpacity
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={() => {
                    setShowLicenseMenu(false);
                    setTimeout(() => handleViewLicense(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 px-4 py-4 mb-3"
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={() => {
                    setShowLicenseMenu(false);
                    setTimeout(() => handleUploadLicense(), 300);
                  }}
                  className="flex-row items-center bg-gray-50 px-4 py-4 mb-3"
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  onPress={handleRemoveLicense}
                  className="flex-row items-center bg-red-50 px-4 py-4 mb-6"
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
                  style={{ borderRadius: 12, borderCurve: "continuous" }}
                  className="bg-gray-100 py-4 items-center"
                  onPress={() => setShowLicenseMenu(false)}
                >
                  <Text className="text-gray-600 font-msemibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

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
    </View>
  );
}
