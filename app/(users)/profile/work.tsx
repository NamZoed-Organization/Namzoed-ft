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
import { MODAL_RADIUS } from "@/constants/theme";
import LicenseViewerOverlay from "@/components/modals/LicenseViewerOverlay";
import ProfileImageViewer from "@/components/modals/ProfileImageViewer";
import SellerCredibilityCard from "@/components/SellerCredibilityCard";
import BusinessProfileHeader from "@/components/profile/BusinessProfileHeader";
import ShareArcIcon from "@/components/icons/ShareArcIcon";
import BusinessSearchModal from "@/components/profile/BusinessSearchModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import { GRID_BACKGROUND } from "@/components/MasonryGrid";
import { businessTabs, type BusinessSection } from "@/lib/businessSections";
import { serviceCategories } from "@/data/servicecategory";
import ProfileTabRow from "@/components/profile/ProfileTabRow";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import EditWorkProfile, { type WorkProfileForm } from "@/components/profile/EditWorkProfile";
import ShopReviews from "@/components/profile/ShopReviews";
import { businessDisplayName, businessKind, hasBusiness } from "@/lib/sellerService";
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
  getCategoryIdBySlug,
  updateServiceProviderLicense,
  updateServiceProviderProfile,
  uploadLicenseImage,
  uploadProviderAvatar,
} from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import { presentSystemPicker, waitForIosModalDismiss } from "@/utils/modal";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  ChevronLeft,
  Edit3,
  MessageCircle,
  Search,
  Store,
  ImageIcon as ImageIconLucide,
  Plus,
  ShoppingBag,
  Trash2,
  Verified,
  Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  RefreshControl,
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
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// How far the tab block is pulled up over the header, so its rounded top
// corners land on the gradient rather than starting below it. Matches the
// personal profile's own constant.
const TAB_BAR_CORNER_OVERLAP = 20;

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
  } = useServiceProvider(refreshKey, isOwnProfile ? undefined : targetUserId);



  // Products tagged to the work profile (is_work_listing) — shown here
  // regardless of viewer; only the owner gets the "Add Product" button.
  // The work profile is a business page, not a shop page: a carpenter with
  // no products and a grocery with no services should both feel at home on
  // it, and neither should see an empty tab for the thing they don't do. So
  // the tab set is derived from what this business actually has.
  const [activeWorkTab, setActiveWorkTab] = useState<BusinessSection>("products");
  const [workProducts, setWorkProducts] = useState<Product[]>([]);
  const [loadingWorkProducts, setLoadingWorkProducts] = useState(false);

  /**
   * A business that never filled in a page of its own borrows the person's.
   *
   * Plenty of sellers list products without ever naming a business — most
   * small shops in Bhutan *are* the person, and "Business" over a blank
   * circle is a worse answer than their own name and face. `service_providers`
   * already joins the profile, so this costs nothing: it is a fallback for
   * display only, and the editor still shows the fields as empty, because
   * they are (a logo that looked set would have nothing to remove).
   */
  const ownerProfile = serviceProvider?.profiles ?? null;
  const displayName = businessDisplayName(
    serviceProvider?.name,
    ownerProfile?.name,
  );
  const displayLogo =
    providerImageUri ?? serviceProvider?.profile_url ?? ownerProfile?.avatar_url ?? null;

  /**
   * A business that has never been set up is sent to set it up.
   *
   * Every account carries a `service_providers` row from signup, so the
   * row's existence means nothing. `hasBusiness` is the app's own answer to
   * "is there a business here" and it is used rather than the name alone
   * for the reason § The business profile gives: sellers who listed products
   * before the work profile existed never named anything, and judging by the
   * name would throw them into a setup form for a business they have been
   * running for a year.
   *
   * Only your own, and only once every read has finished — redirecting on a
   * loading state would bounce anybody whose connection was merely slow. A
   * `replace`, so a back gesture out of the form leaves the flow instead of
   * cycling between the two screens.
   */
  useEffect(() => {
    if (!isOwnProfile) return;
    if (loadingServiceProvider || loadingWorkProducts || loadingProviderServices) return;
    const exists = hasBusiness({
      providerName: serviceProvider?.name,
      productCount: workProducts.length,
      serviceCount: providerServices.length,
    });
    if (!exists) router.replace("/(users)/business/setup" as any);
  }, [
    isOwnProfile,
    loadingProviderServices,
    loadingServiceProvider,
    loadingWorkProducts,
    providerServices.length,
    router,
    serviceProvider?.name,
    workProducts.length,
  ]);
  // The owner's editing form is behind the header's Edit button rather than
  // always on screen: it repeats the logo, name and bio the header already
  // shows, so leaving it open by default made the page read as the same
  // block twice.
  const [showBusinessEditor, setShowBusinessEditor] = useState(false);
  const [savingBusinessField, setSavingBusinessField] = useState(false);
  // Measured rather than hardcoded: a constant can't account for the status
  // bar varying by device, which would leave a sliver of the tab row hidden
  // under the fixed bar (or a gap below it) once pinned.
  const [compactBarHeight, setCompactBarHeight] = useState(56);
  const [showBusinessSearch, setShowBusinessSearch] = useState(false);
  const [showShareComposer, setShowShareComposer] = useState(false);
  // The same per-business colour the header uses, so the bar the tabs pin
  // under is the same surface they scrolled up out of rather than a
  // differently-coloured lid.
  const { tintRgb } = useCoverPalette(serviceProvider?.id ?? targetUserId, null, null);

  // The bar starts transparent over the header's own gradient and fills in
  // as that gradient scrolls away, with the business avatar rising into it —
  // the personal profile's behaviour. A permanently filled bar reads as a
  // second, differently-coloured surface stacked on the header.
  const barFill = useSharedValue(0);
  const barFillStyle = useAnimatedStyle(() => ({ opacity: barFill.value }));
  const workScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      barFill.value = Math.max(0, Math.min(1, event.contentOffset.y / 120));
    },
  });

  // Everything in the bar is derived from that one value rather than swapped
  // at a threshold. A boolean flip was what made this snap: two layouts
  // exchanged in a single frame, with nothing in between. Widths and
  // opacities interpolated from the same driver give the Edit pill somewhere
  // to go and the search field something to grow from.
  //
  // Both measured once, because you cannot interpolate to "the rest of the
  // row" without knowing how wide the row is.
  const [searchTrackWidth, setSearchTrackWidth] = useState(0);
  const [editPillWidth, setEditPillWidth] = useState(0);

  const AVATAR_SLOT = 36; // 28pt avatar + its gap

  const barAvatarSlotStyle = useAnimatedStyle(() => ({
    width: interpolate(barFill.value, [0, 1], [0, AVATAR_SLOT], Extrapolation.CLAMP),
    opacity: interpolate(barFill.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Collapses to nothing rather than just fading: a pill that fades but keeps
  // its width leaves a hole the search field can't grow into, which is most
  // of why the old version felt stuck.
  const editPillStyle = useAnimatedStyle(() => ({
    width: interpolate(barFill.value, [0, 0.7], [editPillWidth, 0], Extrapolation.CLAMP),
    opacity: interpolate(barFill.value, [0, 0.45], [1, 0], Extrapolation.CLAMP),
    // It sits after the search control, so its gap is on the left.
    marginLeft: interpolate(barFill.value, [0, 0.7], [8, 0], Extrapolation.CLAMP),
  }));

  const searchStyle = useAnimatedStyle(() => ({
    width: interpolate(
      barFill.value,
      [0, 1],
      [36, Math.max(36, searchTrackWidth - AVATAR_SLOT)],
      Extrapolation.CLAMP,
    ),
    // Never squeezed: the pill beside it collapses to nothing, so there is
    // always room for whatever this has grown to.
    flexShrink: 0,
  }));

  // The label only exists once there is room for it; fading it in with the
  // width would show it clipped mid-word.
  const searchLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(barFill.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // One field at a time, so a failed save can only ever lose one thing —
  // which is the point of the hub shape (UI_STANDARD.md § Hub screens).
  // Its own handler rather than a field on the form: the type is a foreign
  // key chosen from a list, not free text, and changing it reshapes the page.
  const handleSaveBusinessType = useCallback(
    async (slug: string) => {
      if (!currentUser?.id) return;
      try {
        const categoryId = await getCategoryIdBySlug(slug);
        await updateServiceProviderProfile(currentUser.id, { category_id: categoryId });
        const chosen = serviceCategories.find((c) => c.slug === slug);
        setServiceProvider((prev: any) =>
          prev
            ? {
                ...prev,
                category_id: categoryId,
                service_categories: chosen
                  ? { id: categoryId, name: chosen.name, slug: chosen.slug }
                  : prev.service_categories,
              }
            : prev,
        );
      } catch (error) {
        console.error("Failed to set business type:", error);
        showErrorPopup("Could not save the business type.", "Save Failed");
      }
    },
    [currentUser?.id],
  );

  const handleSaveBusinessField = useCallback(
    async (patch: Partial<WorkProfileForm>) => {
      if (!currentUser?.id) return;
      setSavingBusinessField(true);
      try {
        // The form's names and the column names differ; map here rather than
        // renaming either, since both are load-bearing elsewhere.
        const columns: Record<string, unknown> = {};
        if (patch.businessName !== undefined) columns.name = patch.businessName;
        if (patch.bio !== undefined) columns.master_bio = patch.bio;
        if (patch.email !== undefined) columns.email = patch.email;
        if (patch.contact !== undefined) columns.contact = patch.contact;
        if (patch.emailActive !== undefined) columns.email_active = patch.emailActive;
        if (patch.contactActive !== undefined) columns.contact_active = patch.contactActive;

        await updateServiceProviderProfile(currentUser.id, columns);
        setProviderFormData((prev: any) => ({ ...prev, ...patch }));
        setServiceProvider((prev: any) => (prev ? { ...prev, ...columns } : prev));
      } catch (error) {
        console.error("Failed to save business field:", error);
        showErrorPopup("Could not save that. Please try again.", "Save Failed");
      } finally {
        setSavingBusinessField(false);
      }
    },
    [currentUser?.id],
  );

  // Decided by what kind of business this is, not by what it happens to have
  // listed (see lib/businessSections.ts). Deriving from presence worked for
  // visitors but never for the owner, who was always shown both content tabs
  // so they had somewhere to add the first item — exactly wrong for a taxi
  // driver, who will never have products.
  const workTabs = useMemo(
    () => businessTabs(serviceProvider?.service_categories?.slug),
    [serviceProvider?.service_categories?.slug],
  );

  // Keep the selection valid: a visitor who lands on a business with no
  // products would otherwise be looking at a tab that isn't in the row.
  useEffect(() => {
    if (!workTabs.some((t) => t.key === activeWorkTab)) {
      setActiveWorkTab(workTabs[0].key);
    }
  }, [workTabs, activeWorkTab]);
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    setLoadingWorkProducts(true);
    // Every product, not just those flagged is_work_listing. The work
    // profile IS the shop now, so the split that flag encoded — some
    // products here, some on the personal profile — no longer exists: the
    // personal profile shows marketplace listings instead. The flag stays on
    // the column for older rows rather than being migrated away.
    fetchUserProducts(targetUserId)
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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isServiceSelectionMode, setIsServiceSelectionMode] = useState(false);
  const [showProviderWorkImageViewer, setShowProviderWorkImageViewer] =
    useState(false);
  const [showLicenseViewer, setShowLicenseViewer] = useState(false);
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

      // Through presentSystemPicker: this is reached from the Business
      // license page inside the Edit business modal, and UIKit drops a
      // picker presented while one of ours is still settling — the same
      // hang the profile photo had (see utils/modal.ts).
      const result = await presentSystemPicker(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1.0,
        }),
      );

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

      {/* Fixed bar. Transparent over the header's own gradient at rest and
          filling in as that gradient scrolls away, with the business avatar
          rising into it — the personal profile's behaviour. A permanently
          filled bar reads as a second, differently-coloured surface stacked
          on the header rather than the same one continuing. */}
      <View
        onLayout={(e) => setCompactBarHeight(e.nativeEvent.layout.height)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          elevation: 20,
          paddingTop: insets.top,
        }}
        pointerEvents="box-none"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.98)`,
            },
            barFillStyle,
          ]}
        />

        <View className="flex-row items-center px-4 py-3 gap-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center -ml-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>

          {/* Avatar, Edit pill and search share one flexible track. Nothing
              here mounts or unmounts on scroll — the widths simply move, so
              there is no frame where the layout jumps. */}
          <View
            className="flex-1 flex-row items-center"
            onLayout={(e) => setSearchTrackWidth(e.nativeEvent.layout.width)}
          >
            {/* Left-aligned, unlike the personal profile's centred mini
                avatar: a business is identified by its logo and name
                together, and centring the logo puts it where a title
                belongs. */}
            <Animated.View
              style={[{ overflow: "hidden" }, barAvatarSlotStyle]}
              pointerEvents="none"
            >
              <View className="w-7 h-7 rounded-full bg-white/20 overflow-hidden items-center justify-center">
                {displayLogo ? (
                  <ProgressiveImage
                    uri={displayLogo}
                    style={{ width: "100%", height: "100%" }}
                    showProgress={false}
                  />
                ) : (
                  <Store size={14} color="#fff" strokeWidth={1.8} />
                )}
              </View>
            </Animated.View>

            <View className="flex-1" />

            {/* Grows out of the icon into the width the pill vacates
                beside it. */}
            <Animated.View style={[{ overflow: "hidden" }, searchStyle]}>
              <TouchableOpacity
                onPress={() => setShowBusinessSearch(true)}
                activeOpacity={0.7}
                style={{ borderRadius: 999, borderCurve: "continuous" }}
                className="flex-row items-center gap-2 px-2.5 h-9 bg-white/15"
              >
                <Search size={16} color="rgba(255,255,255,0.85)" />
                <Animated.Text
                  numberOfLines={1}
                  style={searchLabelStyle}
                  className="text-xs text-white/70"
                >
                  Search in Business
                </Animated.Text>
              </TouchableOpacity>
            </Animated.View>

            {/* The personal profile's own Edit pill, to the letter — same
                icon, size, padding and fill, so the two profiles offer the
                same affordance in the same shape.

                The animated width is only applied ONCE the pill has been
                measured. Applying it from the start is circular: the width
                interpolates from editPillWidth, which is 0 until the button
                inside lays out — and it can't lay out inside a wrapper that
                is already 0 wide, so it stayed invisible forever. */}
            {isOwnProfile && (
              <Animated.View
                style={[
                  editPillWidth > 0 ? { overflow: "hidden" } : null,
                  editPillWidth > 0 ? editPillStyle : null,
                ]}
              >
                <TouchableOpacity
                  onLayout={(e) => {
                    // Measured at its natural width before the collapse ever
                    // runs, so there is a real number to interpolate from.
                    const w = e.nativeEvent.layout.width;
                    if (w > 0 && editPillWidth === 0) setEditPillWidth(w);
                  }}
                  style={{
                    borderRadius: 999,
                    borderCurve: "continuous",
                    // Pinned to its measured width once known. Without this
                    // the button reflows as the wrapper narrows — the label
                    // squeezing and wrapping instead of being cleanly clipped
                    // — which is what made the collapse look like distortion
                    // rather than motion.
                    ...(editPillWidth > 0 ? { width: editPillWidth } : null),
                  }}
                  onPress={() => setShowBusinessEditor(true)}
                  className="flex-row items-center gap-1 px-3 py-1.5 bg-white/15 border border-white/30"
                >
                  <Edit3 size={13} strokeWidth={1.8} color="#fff" />
                  <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                    Edit Business
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              onPress={() =>
                targetUserId &&
                router.push({
                  pathname: "/(users)/chat/[id]",
                  params: { id: String(targetUserId) },
                } as any)
              }
              className="w-9 h-9 items-center justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MessageCircle size={20} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setShowShareComposer(true)}
            className="w-9 h-9 items-center justify-center -mr-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ShareArcIcon size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loadingServiceProvider ? (
        <View className="flex-1 items-center justify-center">
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : (
        <Animated.ScrollView
          onScroll={workScrollHandler}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          // Pins direct child index 1 — the tab row wrapper below. Index 0
          // is the header block above it; index 2 onward is the content.
          stickyHeaderIndices={[1]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#094569"
              progressViewOffset={0}
            />
          }
        >
          <View>
          {/* Mirrors the personal profile's header so the two read as one app —
              cover gradient behind the whole block, logo over it, identity to the
              right — plus the credibility strip a personal profile never has. */}
          <BusinessProfileHeader
            providerId={serviceProvider?.id}
            seedId={serviceProvider?.id ?? targetUserId}
            name={displayName}
            bio={serviceProvider?.master_bio}
            logoUrl={displayLogo}
            // No location yet: service_providers has no dzongkhag column, and a
            // business address is a different thing from the owner's district
            // anyway — worth its own column rather than borrowing the profile's.
            dzongkhag={null}
            // The business's own type, not the first service's — a salon
            // that also fixes a chair is still a salon.
            trade={serviceProvider?.service_categories?.name}
            verification={(verificationStatus as any) ?? "not_verified"}
            productCount={workProducts.length}
            serviceCount={providerServices.length}
            isOwnProfile={isOwnProfile}
            topInset={compactBarHeight + 8}
          />

          {/* The shop's own reputation, above its products — a buyer sizing
              up a storefront asks who they'd be buying from before browsing
              what's on the shelf. Renders nothing for an unverified work
              profile, which by definition isn't a shop. */}
          {targetUserId ? (
            <View className="px-4 mt-2 mb-3">
              <SellerCredibilityCard ownerId={targetUserId} hideWhenUnverified />
            </View>
          ) : null}
          </View>

          {/* The pinned child. `stickyHeaderIndices` below pins whatever
              sits at index 1, and it pins flush to the ScrollView's own top
              edge — true y=0, under the status bar. The compact bar is a
              separate overlay outside the scroller, so the tab row has to
              land at its height instead: the invisible spacer occupies
              exactly that, and the equal negative marginTop cancels it out
              in normal flow. Unstuck it renders as if neither existed; once
              pinned the cancellation no longer applies to what's inside, so
              the spacer sits behind the bar and the tabs start where it
              ends. Same trick as the personal profile. */}
          <View
            style={{
              // The extra TAB_BAR_CORNER_OVERLAP is pulled up OVER the header
              // above, so the tab block's rounded top corners sit on the
              // gradient rather than starting below it — the personal
              // profile's own treatment, and what was missing here.
              marginTop: -(compactBarHeight + TAB_BAR_CORNER_OVERLAP),
              zIndex: 10,
              elevation: 10,
            }}
          >
            <View
              pointerEvents="none"
              style={{ height: compactBarHeight + TAB_BAR_CORNER_OVERLAP }}
            />
            <View style={{ marginTop: -TAB_BAR_CORNER_OVERLAP }}>
              {/* Fills the band the corners curve away from, in the header's
                  own tint, so no sliver of what's behind shows through the
                  seam. */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: TAB_BAR_CORNER_OVERLAP,
                  backgroundColor: `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.95)`,
                }}
              />
              <View
                style={{
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                  borderCurve: "continuous",
                  // Clips the tab row's edge fades to the curve instead of
                  // letting them overflow past it as square patches.
                  overflow: "hidden",
                }}
                className="bg-white border-b border-gray-100"
              >
                <ProfileTabRow
                  tabs={workTabs}
                  activeKey={activeWorkTab}
                  onChange={setActiveWorkTab}
                />
              </View>
            </View>
          </View>

          {/* One page for everyone now. The owner's add/edit controls moved
              into EditWorkProfile behind the header's Edit button — a
              visitor shouldn't share a screen with them, and the business
              page is the shop front. */}
          {/* Tab content sits on the grid ground, not white: the cards and
              rows inside it are the content, and the standard's rule is
              content on white, screens on grey — a white panel behind white
              cards makes them disappear. */}
          <View style={{ backgroundColor: GRID_BACKGROUND, minHeight: 320 }}>
          {activeWorkTab === "services" ? (
            <View className="px-4 pt-4">
              {/* No business card here any more — the header above already
                  is one, and repeating it made the page read as the same
                  block twice. */}
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
          ) : null}

          {activeWorkTab === "reviews" && serviceProvider?.id ? (
            <ShopReviews
              providerId={serviceProvider.id}
              kind={businessKind(workProducts.length > 0, providerServices.length > 0)}
              ownerUserId={targetUserId}
              // The rolled-up product number leads to the products it came
              // from, rather than being a figure with nothing behind it.
              onOpenProducts={
                workTabs.some((t) => t.key === "products" || t.key === "menu")
                  ? () =>
                      setActiveWorkTab(
                        workTabs.some((t) => t.key === "menu") ? "menu" : "products",
                      )
                  : undefined
              }
            />
          ) : null}

          {activeWorkTab === "products" && (
          <View className="px-4 mt-2">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-mbold text-gray-900">Products</Text>
              {isOwnProfile && (
                // The catalogue screen, not a bare form: adding a product
                // and managing the ones already there are the same job, and
                // this tab is a shop window rather than a place to work
                // (app/(users)/listings.tsx).
                <TouchableOpacity
                  onPress={() =>
                    router.push("/(users)/listings?section=products" as any)
                  }
                  style={{ borderRadius: 999, borderCurve: "continuous" }}
                  className="flex-row items-center bg-primary px-3 py-1.5"
                >
                  <Plus size={14} color="white" style={{ marginRight: 4 }} />
                  <Text className="text-white text-xs font-semibold">Manage</Text>
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
                isOwnProfile ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/(users)/listings?section=products" as any)
                    }
                    className="px-1 py-2"
                  >
                    <Text className="text-sm text-gray-400">
                      No products listed yet —{" "}
                      <Text className="text-primary font-msemibold">
                        add the first one
                      </Text>
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-sm text-gray-400 px-1">
                    No products yet
                  </Text>
                )
              )}
            </View>
          </View>
          )}
          </View>
        </Animated.ScrollView>
      )}

      {targetUserId && (
        <ShareComposerModal
          visible={showShareComposer}
          onClose={() => setShowShareComposer(false)}
          heading="Share business"
          sharePayload={{
            // The same name the page shows — a share that said "Business"
            // while the page said the owner's name would read as a
            // different place.
            title: displayName,
            message: `Check out ${displayName} on Namzoed`,
            url: `https://namzoed.com/business/${targetUserId}`,
          }}
        />
      )}

      <BusinessSearchModal
        visible={showBusinessSearch}
        onClose={() => setShowBusinessSearch(false)}
        businessName={displayName}
        products={workProducts}
        services={providerServices}
        onOpenProduct={(id) => {
          setShowBusinessSearch(false);
          router.push(`/(users)/product/${id}` as any);
        }}
        onOpenService={(id) => {
          setShowBusinessSearch(false);
          router.push(`/(users)/servicedetail/${id}` as any);
        }}
      />

      {isOwnProfile && (
        <EditWorkProfile
          visible={showBusinessEditor}
          form={providerFormData as WorkProfileForm}
          logoUrl={providerImageUri ?? serviceProvider?.profile_url ?? null}
          verificationStatus={(verificationStatus as any) ?? "not_verified"}
          saving={savingBusinessField}
          onClose={() => setShowBusinessEditor(false)}
          onChangeLogo={() => {
            Haptics.impactAsync(ImpactFeedbackStyle.Medium);
            setShowProviderAvatarMenu(true);
          }}
          onSaveField={handleSaveBusinessField}
          licenseUrl={licenseImageUrl}
          uploadingLicense={uploadingLicense}
          onViewLicense={handleViewLicense}
          onUploadLicense={handleUploadLicense}
          onRemoveLicense={handleRemoveLicense}
          businessType={serviceProvider?.service_categories?.name ?? null}
          businessTypeSlug={serviceProvider?.service_categories?.slug ?? null}
          onSaveBusinessType={handleSaveBusinessType}
          services={providerServices.map((service) => ({
            id: service.id,
            name: service.name,
            status: service.status,
          }))}
          // Adding and editing happen on pages that slide within the editor
          // itself, so this only has to hear that the list changed.
          onServicesChanged={() => setRefreshKey((prev) => prev + 1)}
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
                borderTopLeftRadius: MODAL_RADIUS,
                borderTopRightRadius: MODAL_RADIUS,
                borderCurve: "continuous",
              }}
            >
              <View
                style={{ borderTopLeftRadius: MODAL_RADIUS, borderTopRightRadius: MODAL_RADIUS, borderCurve: "continuous" }} className="w-full items-center pt-5 pb-4 bg-white">
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
                borderTopLeftRadius: MODAL_RADIUS,
                borderTopRightRadius: MODAL_RADIUS,
                borderCurve: "continuous",
              }}
            >
              <View
                style={{ borderTopLeftRadius: MODAL_RADIUS, borderTopRightRadius: MODAL_RADIUS, borderCurve: "continuous" }} className="w-full items-center pt-5 pb-4 bg-white">
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



      {showLicenseViewer && licenseImageUrl && (
        <LicenseViewerOverlay
          visible={showLicenseViewer}
          licenseUrl={licenseImageUrl}
          onClose={() => setShowLicenseViewer(false)}
        />
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
