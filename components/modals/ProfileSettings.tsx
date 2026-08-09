// Path: components/ProfileSettings.tsx
import {
  AboutApp,
  AppVersion,
  AppearanceManager,
  ChangePassword,
  CommunityGuidelines,
  DataStorage,
  DeleteAccount,
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
  ArrowLeft,
  Bookmark,
  BookOpen,
  Download,
  EyeOff,
  Key,
  LogOut,
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
  PanResponder,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafety } from "@/contexts/SafetyContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { openAppStoreForUpdate } from "@/utils/appUpdate";

interface ProfileSettingsProps {
  onClose: () => void;
  currentUser: any;
  onLogout: () => Promise<void>;
  panHandlers?: any;
  contentOpacity?: any;
  initialModal?: string;
}

export default function ProfileSettings({
  onClose,
  currentUser,
  onLogout,
  panHandlers,
  contentOpacity,
  initialModal,
}: ProfileSettingsProps) {
  const insets = useSafeAreaInsets();
  const { safeView, setSafeView, isAdult } = useSafety();

  const [modalStack, setModalStack] = useState<string[]>(
    initialModal ? [initialModal] : [],
  );

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  // Horizontal slide for nested menus
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Vertical — starts off-screen so the sheet slides up on mount
  const panY = useRef(new Animated.Value(screenHeight)).current;
  // Guard: prevent spamming navigation while an animation is in progress
  const isAnimating = useRef(false);

  // Slide up on mount
  useEffect(() => {
    Animated.spring(panY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
      speed: 16,
    }).start();
  }, []);

  // Animated close: slide sheet down, then unmount
  const handleClose = useCallback(() => {
    Animated.timing(panY, {
      toValue: screenHeight,
      duration: 280,
      useNativeDriver: false,
    }).start(() => onClose());
  }, [screenHeight, onClose]);

  const activeModal = modalStack[modalStack.length - 1] || null;

  // --- Android back button: pop nested modal first, then close settings ---
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modalStack.length > 0) {
        closeActiveModal();
        return true;
      }
      handleClose();
      return true;
    });
    return () => handler.remove();
  }, [modalStack, handleClose]);

  // --- Pan Responder for Drag-to-Close ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activate if dragging down vertically more than horizontally
        return (
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy > 5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging downwards
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Drag threshold to close
          Animated.timing(panY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onClose());
        } else {
          // Spring back to top
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  const handleNavigation = (modalName: string) => {
    // Block if already animating or the same screen is already on top
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

  const closeActiveModal = () => {
    // If this was opened directly to a specific modal (e.g. editProfile),
    // and it's the only item in the stack — close the whole sheet, don't go back to settings list.
    if (modalStack.length === 1 && initialModal) {
      handleClose();
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
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case "editProfile":
        return <EditProfile onClose={closeActiveModal} />;
      case "editWorkProfile":
        return <EditWorkProfile onClose={closeActiveModal} onSaved={onClose} />;
      case "appearance":
        return (
          <AppearanceManager
            onClose={closeActiveModal}
            userId={currentUser?.id}
          />
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
            onAccountDeleted={onLogout}
          />
        );
      case "appVersion":
        return <AppVersion onClose={closeActiveModal} />;
      case "aboutApp":
        return <AboutApp onClose={closeActiveModal} />;
      case "tutorials":
        return <Tutorials onClose={closeActiveModal} />;
      default:
        return null;
    }
  };

  return (
    <View className="flex-1">
      {/* Backdrop Tap Zone:
        The transparent area above the sheet. Tapping here closes the sheet.
      */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleClose}
        className="absolute top-0 left-0 right-0 bottom-0"
      />

      {/* --- MAIN SHEET --- */}
      <Animated.View
        className="bg-white rounded-t-3xl overflow-hidden shadow-xl w-full"
        style={{
          flex: 1,
          marginTop: "50%",
          marginBottom: -insets.bottom,
          paddingBottom: insets.bottom,
          transform: [{ translateY: panY }],
        }}
      >
        {/* --- DRAG BAR AREA (ALWAYS ON TOP) --- */}
        {/* Placed OUTSIDE the scroll view. The nested modal slides underneath this.
           This prevents the "overlay on overlay" look.
        */}
        <View
          {...panResponder.panHandlers}
          className="w-full items-center justify-center py-3 bg-white z-50 "
        >
          <View className="w-16 h-1.5 bg-gray-300 rounded-full" />
        </View>

        {/* --- CONTENT CONTAINER --- */}
        <View className="flex-1 relative overflow-hidden">
          {/* 1. MAIN SETTINGS LIST */}
          <View className="flex-1">
            <Animated.View
              className="flex-1 bg-white"
              style={{ opacity: contentOpacity || 1 }}
            >
              {/* Header */}
              <View className="flex-row items-center px-4 pb-4 pt-2">
                <TouchableOpacity onPress={onClose} className="mr-3 p-1">
                  <ArrowLeft size={24} color="#000" />
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
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                      onPress={() => handleNavigation("tutorials")}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <BookOpen
                          size={20}
                          color="#0369a1"
                          style={{ marginRight: 12 }}
                        />
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
                        <Bookmark
                          size={20}
                          color="#094569"
                          style={{ marginRight: 12 }}
                        />
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
                        <Sparkles
                          size={20}
                          color="#c9a96e"
                          style={{ marginRight: 12 }}
                        />
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
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
                      <View className="flex-row items-center flex-1 pr-3">
                        <EyeOff
                          size={20}
                          color="#374151"
                          style={{ marginRight: 12 }}
                        />
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
                        // Only verified adults may disable Safe View.
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
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
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
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                      onPress={() =>
                        Linking.openURL("https://namzoed.com/support")
                      }
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
                      onPress={() =>
                        Linking.openURL("https://namzoed.com/community")
                      }
                    >
                      <View className="flex-row items-center gap-2">
                        <MessageSquare
                          size={20}
                          className="text-gray-700 mr-3"
                        />
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
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity
                      className={`flex-row items-center justify-between px-4 py-4 ${
                        Platform.OS === "web" ? "" : "border-b border-gray-200"
                      }`}
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
                        <Text className="text-gray-400 font-bold text-lg">
                          →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {/* Account Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                    Account
                  </Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                      onPress={onLogout}
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
              </ScrollView>
            </Animated.View>
          </View>

          {/* 2. NESTED MODAL (SLIDES OVER CONTENT, UNDER BAR) */}
          {/* Key Fix: This is now absolute positioned INSIDE the 'Content Container',
               so it sits 'on top' of the settings list, but 'below' the drag handle
               (which is outside this container).
            */}
          {activeModal && (
            <Animated.View
              className="absolute top-0 left-0 right-0 bottom-0 bg-white z-40"
              style={{
                transform: [{ translateX: slideAnim }],
                paddingBottom: (insets.bottom || 20) + 10,
              }}
            >
              {renderModalContent()}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
