// app/(users)/settings/index.tsx
import {
  AboutApp,
  AppVersion,
  AppearanceManager,
  ChangePassword,
  CommunityGuidelines,
  DataStorage,
  DeleteAccount,
  DevComponents,
  EditBio,
  EditProfile,
  EditWorkProfile,
  HelpCenter,
  LanguageRegion,
  Notifications,
  PrivacyPolicy,
  SavedPosts,
  SellerPolicy,
  TermsOfService,
  Tutorials,
} from "@/components/settings";
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  Download,
  EyeOff,
  FlaskConical,
  Key,
  LogOut,
  Megaphone,
  MessageSquare,
  Phone,
  ScrollText,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafety } from "@/contexts/SafetyContext";
import { useUser } from "@/contexts/UserContext";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { openAppStoreForUpdate } from "@/utils/appUpdate";
import WhatsNewModal from "@/components/modals/WhatsNewModal";
import { useWhatsNew } from "@/hooks/useWhatsNew";

// Full-screen replacement for the old bottom-sheet ProfileSettings modal —
// same section list + nested sub-page slide mechanic, just under a real
// route with a chevron-left back button instead of a draggable sheet.
// Jump straight to a sub-page (e.g. from the hamburger drawer, or the
// profile header's Edit Profile / Appearance-badge taps) via ?modal=<name>.
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const { currentUser, logout } = useUser();
  const { safeView, setSafeView, isAdult } = useSafety();
  const { modal: initialModal } = useLocalSearchParams<{ modal?: string }>();

  const [modalStack, setModalStack] = useState<string[]>(
    initialModal ? [initialModal] : [],
  );
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const { markSeen: markWhatsNewSeen } = useWhatsNew();

  const screenWidth = Dimensions.get("window").width;
  // Horizontal slide for nested sub-pages over the root list.
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  const activeModal = modalStack[modalStack.length - 1] || null;

  const handleNavigation = (modalName: string) => {
    if (isAnimating.current) return;
    if (modalStack[modalStack.length - 1] === modalName) return;
    isAnimating.current = true;
    setModalStack((prev) => [...prev, modalName]);
    slideAnim.setValue(screenWidth);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
    });
  };

  const closeActiveModal = useCallback(() => {
    // Arrived directly at a sub-page (e.g. "Edit Profile" from the profile
    // header) with nothing else on the stack — leave the screen entirely
    // instead of revealing the root settings list the user never browsed to.
    if (modalStack.length === 1 && initialModal) {
      router.back();
      return;
    }
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      isAnimating.current = false;
      if (finished) {
        setModalStack((prev) => prev.slice(0, -1));
        slideAnim.setValue(screenWidth);
      }
    });
  }, [modalStack.length, initialModal, router, screenWidth, slideAnim]);

  // Android hardware back: pop the nested sub-page first; otherwise fall
  // through to the default screen-back behaviour.
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modalStack.length > 0) {
        closeActiveModal();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [modalStack, closeActiveModal]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case "editProfile":
        return <EditProfile onClose={closeActiveModal} />;
      case "editBio":
        return <EditBio onClose={closeActiveModal} />;
      case "editWorkProfile":
        return (
          <EditWorkProfile onClose={closeActiveModal} onSaved={() => router.back()} />
        );
      case "appearance":
        return (
          <AppearanceManager onClose={closeActiveModal} userId={currentUser?.id} />
        );
      case "savedPosts":
        return (
          <SavedPosts onClose={closeActiveModal} userId={currentUser?.id} />
        );
      case "changePassword":
        return <ChangePassword onClose={closeActiveModal} />;
      case "privacyPolicy":
        return <PrivacyPolicy onClose={closeActiveModal} />;
      case "sellerPolicy":
        return <SellerPolicy onClose={closeActiveModal} />;
      case "termsOfService":
        return <TermsOfService onClose={closeActiveModal} />;
      case "communityGuidelines":
        return <CommunityGuidelines onClose={closeActiveModal} />;
      case "notifications":
        return <Notifications onClose={closeActiveModal} />;
      case "dataStorage":
        return <DataStorage onClose={closeActiveModal} />;
      case "languageRegion":
        return <LanguageRegion onClose={closeActiveModal} />;
      case "helpCenter":
        return <HelpCenter onClose={closeActiveModal} />;
      case "deleteAccount":
        return (
          <DeleteAccount
            onClose={closeActiveModal}
            onAccountDeleted={async () => {
              await logout();
              router.replace("/login");
            }}
          />
        );
      case "appVersion":
        return <AppVersion onClose={closeActiveModal} />;
      case "aboutApp":
        return <AboutApp onClose={closeActiveModal} />;
      case "tutorials":
        return <Tutorials onClose={closeActiveModal} />;
      case "devComponents":
        return <DevComponents onClose={closeActiveModal} />;
      default:
        return null;
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-1 relative overflow-hidden">
        {/* 1. ROOT SETTINGS LIST */}
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center px-4 pb-4 pt-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-900">
              Settings
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 10,
              paddingBottom: (insets.bottom || 20) + 10,
            }}
          >
            {/* Personalisation Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Personalisation
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("tutorials")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <BookOpen size={20} color="#0369a1" style={{ marginRight: 12 }} />
                    <View>
                      <Text className="text-base font-medium text-gray-900">
                        Tutorials
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        How to add products & tag in posts
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("savedPosts")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Bookmark size={20} color="#094569" style={{ marginRight: 12 }} />
                    <View>
                      <Text className="text-base font-medium text-gray-900">
                        Saved Posts
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        View your bookmarked posts
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("appearance")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Sparkles size={20} color="#c9a96e" style={{ marginRight: 12 }} />
                    <View>
                      <Text className="text-base font-medium text-gray-900">
                        Appearance
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        Badge style &amp; chat bubble skin
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Privacy Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Privacy
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
                  <View className="flex-row items-center flex-1 pr-3">
                    <EyeOff size={20} color="#374151" style={{ marginRight: 12 }} />
                    <View className="flex-1">
                      <Text className="text-base font-medium text-gray-900">
                        Safe View
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {isAdult
                          ? "Hides 18+ and sensitive content from your feed"
                          : "Always on — only verified adults (18+) can turn this off"}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={safeView}
                    disabled={!isAdult}
                    onValueChange={(v) => {
                      if (!isAdult) return;
                      setSafeView(v);
                    }}
                    trackColor={{ false: "#e5e7eb", true: "#94c9e8" }}
                    thumbColor={safeView ? "#094569" : "#f4f4f5"}
                  />
                </View>
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("changePassword")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Key size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Change Password
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Policies Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Policies
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("privacyPolicy")}
                >
                  <View className="flex-row items-center gap-2">
                    <Shield size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Privacy Policy
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("termsOfService")}
                >
                  <View className="flex-row items-center gap-2">
                    <ScrollText size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Terms of Service
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Support Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Support
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => Linking.openURL("https://namzoed.com/support")}
                >
                  <View className="flex-row items-center gap-2">
                    <Phone size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Contact Us
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => Linking.openURL("https://namzoed.com/community")}
                >
                  <View className="flex-row items-center gap-2">
                    <MessageSquare size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Send Feedback
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* App Info Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                About
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("appVersion")}
                >
                  <View className="flex-row items-center gap-2">
                    <Smartphone size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      App Version
                    </Text>
                  </View>
                  <Text className="text-sm text-gray-500">
                    v{Constants.expoConfig?.version || "1.0.0"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-row items-center justify-between px-4 py-4 ${
                    Platform.OS === "web" ? "" : "border-b border-gray-200"
                  }`}
                  onPress={() => setShowWhatsNew(true)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Megaphone size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      What&apos;s New
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && (
                  <TouchableOpacity
                    className="flex-row items-center justify-between px-4 py-4"
                    onPress={() => void openAppStoreForUpdate()}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2">
                      <Download size={20} className="text-gray-700 mr-3" />
                      <Text className="text-base font-medium text-gray-900">
                        Update App
                      </Text>
                    </View>
                    <Text className="text-gray-400 font-bold text-lg">→</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Account Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Account
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <LogOut size={20} color="#6b7280" />
                    <Text className="text-base font-medium text-gray-900">
                      Logout
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("deleteAccount")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Trash2 size={20} color="#ef4444" />
                    <Text className="text-base font-medium text-red-500">
                      Delete Account
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Developer Section — dev builds only */}
            {__DEV__ && (
              <View className="mb-6">
                <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                  Developer
                </Text>
                <View
                  style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 overflow-hidden">
                  <TouchableOpacity
                    className="flex-row items-center justify-between px-4 py-4"
                    onPress={() => handleNavigation("devComponents")}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2">
                      <FlaskConical size={20} color="#7c3aed" />
                      <View>
                        <Text className="text-base font-medium text-gray-900">
                          DevComp
                        </Text>
                        <Text className="text-xs text-gray-400 mt-0.5">
                          UI playground — loading states, popups, overlays
                        </Text>
                      </View>
                    </View>
                    <Text className="text-gray-400 font-bold text-lg">→</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* 2. NESTED SUB-PAGE (SLIDES OVER THE ROOT LIST) */}
        {activeModal && (
          <Animated.View
            className="absolute top-0 left-0 right-0 bottom-0 bg-white z-40"
            style={{
              transform: [{ translateX: slideAnim }],
              paddingBottom: insets.bottom,
            }}
          >
            {renderModalContent()}
          </Animated.View>
        )}
      </View>

      <WhatsNewModal
        visible={showWhatsNew}
        onClose={() => {
          setShowWhatsNew(false);
          void markWhatsNewSeen();
        }}
      />
    </View>
  );
}
