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
    TermsOfService
} from '@/components/settings';
import { ArrowLeft, Bookmark, Key, LogOut, MessageSquare, Phone, ScrollText, Shield, Smartphone, Sparkles, Trash2 } from 'lucide-react-native';
import React, { useRef, useState } from "react";
import { Animated, Dimensions, Linking, PanResponder, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileSettingsProps {
  onClose: () => void;
  currentUser: any;
  onLogout: () => Promise<void>;
  panHandlers?: any;
  contentOpacity?: any;
  initialModal?: string;
}

export default function ProfileSettings({ onClose, currentUser, onLogout, panHandlers, contentOpacity, initialModal }: ProfileSettingsProps) {
  const insets = useSafeAreaInsets();
  
  const [modalStack, setModalStack] = useState<string[]>(initialModal ? [initialModal] : []);
  
  // Horizontal slide for nested menus
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Vertical slide for drag-to-close
  const panY = useRef(new Animated.Value(0)).current;
  
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const activeModal = modalStack[modalStack.length - 1] || null;

  // --- Pan Responder for Drag-to-Close ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activate if dragging down vertically more than horizontally
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging downwards
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) { // Drag threshold to close
          Animated.timing(panY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: false, // Changed to false for web compatibility in preview
          }).start(() => onClose());
        } else {
          // Spring back to top
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4
          }).start();
        }
      },
    })
  ).current;

  const handleNavigation = (modalName: string) => {
    setModalStack(prev => [...prev, modalName]);
    slideAnim.setValue(screenWidth);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const closeActiveModal = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setModalStack(prev => prev.slice(0, -1));
        slideAnim.setValue(screenWidth);
      }
    });
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case 'editProfile': return <EditProfile onClose={closeActiveModal} />;
      case 'editWorkProfile': return <EditWorkProfile onClose={closeActiveModal} onSaved={onClose} />;
      case 'appearance': return <AppearanceManager onClose={closeActiveModal} userId={currentUser?.id} />;
      case 'savedPosts': return <SavedPosts onClose={closeActiveModal} userId={currentUser?.id} />;
      case 'changePassword': return <ChangePassword onClose={closeActiveModal} />;
      case 'privacyPolicy': return <PrivacyPolicy onClose={closeActiveModal} />;
      case 'sellerPolicy': return <SellerPolicy onClose={closeActiveModal} />;
      case 'termsOfService': return <TermsOfService onClose={closeActiveModal} />;
      case 'communityGuidelines': return <CommunityGuidelines onClose={closeActiveModal} />;
      case 'notifications': return <Notifications onClose={closeActiveModal} />;
      case 'dataStorage': return <DataStorage onClose={closeActiveModal} />;
      case 'languageRegion': return <LanguageRegion onClose={closeActiveModal} />;
      case 'helpCenter': return <HelpCenter onClose={closeActiveModal} />;
      case 'deleteAccount': return <DeleteAccount onClose={closeActiveModal} onAccountDeleted={onLogout} />;
      case 'appVersion': return <AppVersion onClose={closeActiveModal} />;
      case 'aboutApp': return <AboutApp onClose={closeActiveModal} />;
      default: return null;
    }
  };

  return (
    <View className="flex-1 justify-end">
      {/* Backdrop Tap Zone: 
        The transparent area above the sheet. Tapping here closes the sheet.
      */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={onClose}
        className="absolute top-0 left-0 right-0 bottom-0" 
      />

      {/* --- MAIN SHEET --- */}
      <Animated.View 
        className="bg-white rounded-t-3xl overflow-hidden shadow-xl w-full h-[90%]"
        style={{
          transform: [{ translateY: panY }]
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
                <Text className="text-lg font-semibold text-gray-900">Settings</Text>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ 
                  paddingHorizontal: 24,
                  paddingTop: 10,
                  paddingBottom: (insets.bottom || 20) + 10
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
                      onPress={() => handleNavigation('savedPosts')}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <Bookmark size={20} color="#094569" style={{ marginRight: 12 }} />
                        <View>
                          <Text className="text-base font-medium text-gray-900">Saved Posts</Text>
                          <Text className="text-xs text-gray-400 mt-0.5">View your bookmarked posts</Text>
                        </View>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4"
                      onPress={() => handleNavigation('appearance')}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <Sparkles size={20} color="#c9a96e" style={{ marginRight: 12 }} />
                        <View>
                          <Text className="text-base font-medium text-gray-900">Appearance</Text>
                          <Text className="text-xs text-gray-400 mt-0.5">Badge style &amp; chat bubble skin</Text>
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
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                      onPress={() => handleNavigation("changePassword")}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-2">
                        <Key size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Change Password</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                 
                  </View>
                </View>

                {/* Policies Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">Policies</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("privacyPolicy")}>
                      <View className="flex-row items-center gap-2">
                        <Shield size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Privacy Policy</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("termsOfService")}>
                      <View className="flex-row items-center gap-2">
                        <ScrollText size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Terms of Service</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
  
                  </View>
                </View>

                {/* Support Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">Support</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => Linking.openURL('https://namzoed.com/support')}>
                      <View className="flex-row items-center gap-2">
                        <Phone size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Contact Us</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4" onPress={() => Linking.openURL('https://namzoed.com/community')}>
                      <View className="flex-row items-center gap-2">
                        <MessageSquare size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Send Feedback</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* App Info Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">About</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("appVersion")}>
                      <View className="flex-row items-center gap-2">
                        <Smartphone size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">App Version</Text>
                      </View>
                      <Text className="text-sm text-gray-500">v1.0.0</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Account Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">Account</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                      onPress={onLogout}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-2">
                        <LogOut size={20} color="#6b7280" />
                        <Text className="text-base font-medium text-gray-900">Logout</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center justify-between px-4 py-4"
                      onPress={() => handleNavigation('deleteAccount')}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-2">
                        <Trash2 size={20} color="#ef4444" />
                        <Text className="text-base font-medium text-red-500">Delete Account</Text>
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
                  paddingBottom: (insets.bottom || 20) + 10
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