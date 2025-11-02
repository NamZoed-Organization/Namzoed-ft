// Path: components/ProfileSettings.tsx
import { useRouter } from "expo-router";
import { Bell, FileText, Globe, HardDrive, HelpCircle, Info, Key, LogOut, MessageSquare, Phone, ScrollText, Shield, Smartphone, Users, ArrowLeft } from 'lucide-react-native';
import { ScrollView, Text, TouchableOpacity, View, Animated, Dimensions } from "react-native";
import { useState, useRef } from "react";
import {
  ChangePassword,
  PrivacyPolicy,
  SellerPolicy,
  TermsOfService,
  CommunityGuidelines,
  Notifications,
  DataStorage,
  LanguageRegion,
  HelpCenter,
  ContactUs,
  SendFeedback,
  AppVersion,
  AboutApp
} from '@/components/settings';

interface ProfileSettingsProps {
  onClose: () => void;
  currentUser: any;
  onLogout: () => Promise<void>;
  panHandlers?: any;
  contentOpacity?: any;
}

export default function ProfileSettings({ onClose, currentUser, onLogout, panHandlers, contentOpacity }: ProfileSettingsProps) {
  const router = useRouter();
  const [modalStack, setModalStack] = useState<string[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  const activeModal = modalStack[modalStack.length - 1] || null;

  const handleNavigation = (modalName: string) => {
    setModalStack(prev => [...prev, modalName]);
    slideAnim.setValue(screenWidth);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeActiveModal = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: true,
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
    <View className="flex-1">
      {/* Top space to show underlying page */}
      <View className="h-20" />

      {/* Sliding white content */}
      <View className="flex-1 bg-white rounded-t-3xl overflow-hidden">
        {/* Drag bar */}
        <View {...panHandlers} className="px-6 pt-6 pb-2">
          <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
        </View>

        {/* Header with back button */}
        <View className="flex-row items-center px-4 pb-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="mr-3">
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">Settings</Text>
        </View>

        <Animated.View
          className="flex-1 p-6"
          style={{ opacity: contentOpacity || 1 }}
        >

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Privacy Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Privacy
              </Text>

              <View className="bg-gray-50 rounded-xl">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("changePassword")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Key size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Change Password
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center px-4 py-4"
                  onPress={onLogout}
                  activeOpacity={0.7}
                >
                  <LogOut size={20} className="text-red-500 mr-3" />
                  <Text className="text-base font-medium text-red-500">
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Policies Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Policies
              </Text>

              <View className="bg-gray-50 rounded-xl">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("privacyPolicy")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Shield size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Privacy Policy
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("sellerPolicy")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <FileText size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Seller Policy
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("termsOfService")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <ScrollText size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Terms of Service
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("communityGuidelines")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Users size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Community Guidelines
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Account Section */}
            <View className="mb-6">
              <Text className="text-sm font-msemibold text-gray-500 px-2 py-2 uppercase tracking-wide">
                Account
              </Text>

              <View className="bg-gray-50 rounded-xl">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("notifications")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Bell size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Notifications
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("dataStorage")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <HardDrive size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Data & Storage
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("languageRegion")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Globe size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Language & Region
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

              <View className="bg-gray-50 rounded-xl">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("helpCenter")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <HelpCircle size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Help Center
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("contactUs")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Phone size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      Contact Us
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("sendFeedback")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
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

              <View className="bg-gray-50 rounded-xl">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
                  onPress={() => handleNavigation("appVersion")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Smartphone size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      App Version
                    </Text>
                  </View>
                  <Text className="text-sm text-gray-500">v1.0.0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-4"
                  onPress={() => handleNavigation("aboutApp")}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Info size={20} className="text-gray-700 mr-3" />
                    <Text className="text-base font-medium text-gray-900">
                      About App
                    </Text>
                  </View>
                  <Text className="text-gray-400 font-bold text-lg">→</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Spacing */}
            <View className="h-4" />
          </ScrollView>
        </Animated.View>

        {/* Sliding Modal Container */}
        {activeModal && (
          <Animated.View
            className="absolute top-0 left-0 right-0 bottom-0 bg-white"
            style={{
              transform: [{ translateX: slideAnim }]
            }}
          >
            {renderModalContent()}
          </Animated.View>
        )}
      </View>
    </View>
  );
}
