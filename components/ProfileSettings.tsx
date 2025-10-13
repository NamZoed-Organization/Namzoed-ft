// Path: components/ProfileSettings.tsx
import { useRouter } from "expo-router";
import { Bell, FileText, Globe, HardDrive, HelpCircle, Info, Key, LogOut, MessageSquare, Phone, ScrollText, Shield, Smartphone, Users, X } from 'lucide-react-native';
import { ScrollView, Text, TouchableOpacity, View, Modal } from "react-native";
import { useState } from "react";
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
}

export default function ProfileSettings({ onClose, currentUser, onLogout }: ProfileSettingsProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const handleNavigation = (modalName: string) => {
    setActiveModal(modalName);
  };

  const closeActiveModal = () => {
    setActiveModal(null);
  };

  return (
    <TouchableOpacity
      className="flex-1 bg-black/50 justify-end"
      activeOpacity={1}
      onPress={onClose}
    >
      <TouchableOpacity activeOpacity={1} className="bg-white rounded-t-3xl max-h-4/5">
        <View className="p-6">
          {/* Handle Bar */}
          <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />
          
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-mbold text-gray-900">Settings</Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 items-center justify-center rounded-full bg-gray-100"
              activeOpacity={0.7}
            >
              <X size={16} className="text-gray-600" />
            </TouchableOpacity>
          </View>

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
        </View>

        {/* Modal Components */}
        <Modal
          visible={activeModal === 'changePassword'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <ChangePassword />
        </Modal>

        <Modal
          visible={activeModal === 'privacyPolicy'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <PrivacyPolicy />
        </Modal>

        <Modal
          visible={activeModal === 'sellerPolicy'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <SellerPolicy />
        </Modal>

        <Modal
          visible={activeModal === 'termsOfService'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <TermsOfService />
        </Modal>

        <Modal
          visible={activeModal === 'communityGuidelines'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <CommunityGuidelines />
        </Modal>

        <Modal
          visible={activeModal === 'notifications'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <Notifications />
        </Modal>

        <Modal
          visible={activeModal === 'dataStorage'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <DataStorage />
        </Modal>

        <Modal
          visible={activeModal === 'languageRegion'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <LanguageRegion />
        </Modal>

        <Modal
          visible={activeModal === 'helpCenter'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <HelpCenter />
        </Modal>

        <Modal
          visible={activeModal === 'contactUs'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <ContactUs />
        </Modal>

        <Modal
          visible={activeModal === 'sendFeedback'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <SendFeedback />
        </Modal>

        <Modal
          visible={activeModal === 'appVersion'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <AppVersion />
        </Modal>

        <Modal
          visible={activeModal === 'aboutApp'}
          animationType="slide"
          onRequestClose={closeActiveModal}
        >
          <AboutApp />
        </Modal>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}