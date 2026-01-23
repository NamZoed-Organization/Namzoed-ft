// Path: components/ProfileSettings.tsx
import {
  AboutApp,
  AppVersion,
  ChangePassword,
  CommunityGuidelines,
  ContactUs,
  DataStorage,
  HelpCenter,
  LanguageRegion,
  Notifications,
  PrivacyPolicy,
  SellerPolicy,
  SendFeedback,
  TermsOfService
} from '@/components/settings';
import { ArrowLeft, Bell, FileText, Globe, HardDrive, HelpCircle, Info, Key, LogOut, MessageSquare, Phone, ScrollText, Shield, Smartphone, Users } from 'lucide-react-native';
import React, { useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileSettingsProps {
  onClose: () => void;
  currentUser: any;
  onLogout: () => Promise<void>;
  panHandlers?: any;
  contentOpacity?: any;
}

export default function ProfileSettings({ onClose, currentUser, onLogout, panHandlers, contentOpacity }: ProfileSettingsProps) {
  const insets = useSafeAreaInsets();
  
  const [modalStack, setModalStack] = useState<string[]>([]);
  
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
      case 'changePassword': return <ChangePassword onClose={closeActiveModal} />;
      case 'privacyPolicy': return <PrivacyPolicy onClose={closeActiveModal} />;
      case 'sellerPolicy': return <SellerPolicy onClose={closeActiveModal} />;
      case 'termsOfService': return <TermsOfService onClose={closeActiveModal} />;
      case 'communityGuidelines': return <CommunityGuidelines onClose={closeActiveModal} />;
      case 'notifications': return <Notifications onClose={closeActiveModal} />;
      case 'dataStorage': return <DataStorage onClose={closeActiveModal} />;
      case 'languageRegion': return <LanguageRegion onClose={closeActiveModal} />;
      case 'helpCenter': return <HelpCenter onClose={closeActiveModal} />;
      case 'contactUs': return <ContactUs onClose={closeActiveModal} />;
      case 'sendFeedback': return <SendFeedback onClose={closeActiveModal} />;
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
                      <View className="flex-row items-center">
                        <Key size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Change Password</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center px-4 py-4"
                      onPress={onLogout}
                      activeOpacity={0.7}
                    >
                      <LogOut size={20} className="text-red-500 mr-3" />
                      <Text className="text-base font-medium text-red-500">Logout</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Policies Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">Policies</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("privacyPolicy")}>
                      <View className="flex-row items-center">
                        <Shield size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Privacy Policy</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("sellerPolicy")}>
                      <View className="flex-row items-center">
                        <FileText size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Seller Policy</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("termsOfService")}>
                      <View className="flex-row items-center">
                        <ScrollText size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Terms of Service</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4" onPress={() => handleNavigation("communityGuidelines")}>
                      <View className="flex-row items-center">
                        <Users size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Community Guidelines</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Account Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">Account</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("notifications")}>
                      <View className="flex-row items-center">
                        <Bell size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Notifications</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("dataStorage")}>
                      <View className="flex-row items-center">
                        <HardDrive size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Data & Storage</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4" onPress={() => handleNavigation("languageRegion")}>
                      <View className="flex-row items-center">
                        <Globe size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Language & Region</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Support Section */}
                <View className="mb-6">
                  <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">Support</Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("helpCenter")}>
                      <View className="flex-row items-center">
                        <HelpCircle size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Help Center</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" onPress={() => handleNavigation("contactUs")}>
                      <View className="flex-row items-center">
                        <Phone size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">Contact Us</Text>
                      </View>
                      <Text className="text-gray-400 font-bold text-lg">→</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4" onPress={() => handleNavigation("sendFeedback")}>
                      <View className="flex-row items-center">
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
                      <View className="flex-row items-center">
                        <Smartphone size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">App Version</Text>
                      </View>
                      <Text className="text-sm text-gray-500">v1.0.0</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center justify-between px-4 py-4" onPress={() => handleNavigation("aboutApp")}>
                      <View className="flex-row items-center">
                        <Info size={20} className="text-gray-700 mr-3" />
                        <Text className="text-base font-medium text-gray-900">About App</Text>
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