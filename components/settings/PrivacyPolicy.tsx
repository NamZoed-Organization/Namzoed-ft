import { BlurView } from 'expo-blur';
import { AlertCircle, ArrowLeft, BadgeCheck, Database, Eye, FileText, Lock, MapPin, Settings, Share2, Shield, Smartphone, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface PrivacyPolicyProps {
  onClose?: () => void;
}

export default function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setScrolled(offsetY > 10);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header with Blur */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 }}>
        {scrolled && Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint="light"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(229, 231, 235, 0.5)'
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
              <TouchableOpacity onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
                <ArrowLeft size={24} color="#094569" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Privacy Policy</Text>
            </View>
          </BlurView>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomWidth: 1,
              backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.95)' : '#ffffff',
              borderBottomColor: scrolled ? '#e5e7eb' : '#f3f4f6',
              shadowColor: scrolled ? '#000' : 'transparent',
              shadowOffset: scrolled ? { width: 0, height: 1 } : { width: 0, height: 0 },
              shadowOpacity: scrolled ? 0.05 : 0,
              shadowRadius: scrolled ? 2 : 0,
              elevation: scrolled ? 2 : 0,
            }}
          >
            <TouchableOpacity onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
              <ArrowLeft size={24} color="#094569" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Privacy Policy</Text>
          </View>
        )}
      </View>

      {/* Add padding for fixed header */}
      <View className="h-16" />

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <View className="bg-primary px-6 py-10">
          <View className="items-center mb-4">
            <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-4">
              <Shield size={40} color="#ffffff" />
            </View>
            <Text className="text-3xl font-mblack text-white text-center mb-2">NamZoed</Text>
            <Text className="text-xl font-semibold text-white/90 text-center">Privacy Policy</Text>
          </View>
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white/10 p-4 mt-2">
            <Text className="text-sm text-white/90 text-center leading-5">
              NamZoed knows that you care how information about you is used and shared. We appreciate your trust that we will do so carefully and sensibly. Maintaining the Trust Fortress for our community is our highest priority.
            </Text>
          </View>
        </View>

        {/* Content Sections */}
        <View className="px-5 py-6">

          {/* Intro Alert */}
          <View
            style={{ borderTopRightRadius: 12, borderBottomRightRadius: 12, borderCurve: "continuous" }} className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 shadow-sm">
            <View className="flex-row items-start">
              <AlertCircle size={20} color="#f59e0b" style={{ marginTop: 2, marginRight: 12 }} />
              <Text className="text-sm text-amber-900 leading-5 flex-1 font-medium">
                By using NamZoed Services, you are consenting to the practices described in this Privacy Notice.
              </Text>
            </View>
          </View>

          {/* Section 1 — Applicability and Scope */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 items-center justify-center mr-4 shadow-md">
                <Users size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Section 1</Text>
                <Text className="text-xl font-mbold text-gray-900">Applicability & Scope</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <Text className="text-base text-gray-700 leading-6">
                This policy applies to all users of NamZoed, including individual buyers, sellers (Tshongpas), and service providers across the 20 Dzongkhags, The Gelephu Mindfulness City (GMC) and the world.
              </Text>
              <View className="border-l-2 border-primary/30 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Permissible Age</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Our services are intended for users aged 18 and older. If you are under 18, you may use NamZoed only with the involvement of a parent or guardian.
                </Text>
              </View>
              <View className="border-l-2 border-primary/30 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Consent</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Your continued use of the platform signifies acceptance of this policy.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 2 — Information We Collect */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 items-center justify-center mr-4 shadow-md">
                <Database size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Section 2</Text>
                <Text className="text-xl font-mbold text-gray-900">Information We Collect</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <Text className="text-base text-gray-700 leading-6 mb-2">
                We collect your personal information in order to provide and continually improve our products and services.
              </Text>

              {/* 2A */}
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-blue-50 p-4 border border-blue-200">
                <Text className="text-sm font-semibold text-blue-900 mb-2">A. Information You Give Us</Text>
                <Text className="text-sm text-blue-800 leading-5 mb-2">
                  We receive and store any information you provide, including:
                </Text>
                <View className="space-y-1">
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Identity & Verification (KYC):</Text> Full name, CID details, and business licenses.</Text>
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Contact Information:</Text> Mobile numbers, email addresses, and delivery addresses.</Text>
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Content:</Text> Product reviews, photographs/videos and voice recordings.</Text>
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Corporate/Financial:</Text> Bank account information for seller identity verification and payment settlement.</Text>
                </View>
              </View>

              {/* 2B */}
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-blue-50 p-4 border border-blue-200">
                <View className="flex-row items-center mb-2">
                  <Smartphone size={16} color="#1e40af" style={{ marginRight: 8 }} />
                  <Text className="text-sm font-semibold text-blue-900">B. Automatic Information</Text>
                </View>
                <Text className="text-sm text-blue-800 leading-5 mb-2">
                  We automatically collect information about your interaction with NamZoed:
                </Text>
                <View className="space-y-1">
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Usage Metrics:</Text> Products viewed, search queries, and page response times.</Text>
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Device Details:</Text> IP address, device log files, and Wi-Fi credentials (if synchronized).</Text>
                  <Text className="text-sm text-blue-800 leading-5">• <Text className="font-semibold">Location:</Text> Real-time GPS coordinates to facilitate local trade and exchange point logistics.</Text>
                </View>
              </View>

              {/* 2C */}
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-blue-50 p-4 border border-blue-200">
                <View className="flex-row items-center mb-2">
                  <MapPin size={16} color="#1e40af" style={{ marginRight: 8 }} />
                  <Text className="text-sm font-semibold text-blue-900">C. Information from Other Sources</Text>
                </View>
                <Text className="text-sm text-blue-800 leading-5">
                  We might receive updated delivery information from our carriers or verification data from
                  the authorities to ensure the authenticity of regional products.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 3 — How We Use Your Information */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 items-center justify-center mr-4 shadow-md">
                <Eye size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Section 3</Text>
                <Text className="text-xl font-mbold text-gray-900">How We Use Your Information</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <Text className="text-base text-gray-700 leading-6 mb-1">
                We use your personal information to operate, provide, and improve the NamZoed experience.
              </Text>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Purchase & Delivery</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Handling orders, processing payments, and facilitating Safe Exchange Point drop-offs.
                </Text>
              </View>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Recommendations & Personalization</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Identifying your preferences to suggest local Tshongpas or services that might interest you.
                </Text>
              </View>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Fraud Prevention & Credit Risk</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  We use personal information to prevent and detect fraud to protect the security of our customers and the NamZoed community.
                </Text>
              </View>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Comply with Legal Obligations</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Verifying seller identities to comply with Bhutanese trade and tax laws.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 4 — How We Share Your Information */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 items-center justify-center mr-4 shadow-md">
                <Share2 size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Section 4</Text>
                <Text className="text-xl font-mbold text-gray-900">How We Share Your Information</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-green-50 p-4 border border-green-200 mb-1">
                <Text className="text-sm font-semibold text-green-900 mb-2">Our Commitment</Text>
                <Text className="text-sm text-green-800 leading-5">
                  Information about our customers is a vital part of our business, and we are not in the business of selling your personal information to others.
                </Text>
              </View>
              <View className="border-l-2 border-green-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Third-Party Transactions</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  When you buy from a third-party seller or hire a service provider, we share the necessary information to complete that transaction.
                </Text>
              </View>
              <View className="border-l-2 border-green-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Service Providers</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  We employ other companies to perform functions like package delivery, data analysis, and payment processing. They have access to information needed to perform their functions but may not use it for other purposes.
                </Text>
              </View>
              <View className="border-l-2 border-green-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Protection of NamZoed & Others</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  We release account information when appropriate to comply with Bhutanese law and laws of relevant jurisdiction or to protect the safety of our users.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 5 — Security: The Trust Fortress */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 items-center justify-center mr-4 shadow-md">
                <Lock size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Section 5</Text>
                <Text className="text-xl font-mbold text-gray-900">Security: The Trust Fortress</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <Text className="text-base text-gray-700 leading-6 mb-1">
                We design our systems with your security and privacy in mind.
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-red-50 p-3 border border-red-200">
                <Text className="text-sm font-semibold text-red-900 mb-1">Transmission Security</Text>
                <Text className="text-sm text-red-800 leading-5">
                  We use encryption protocols (SSL/TLS) to protect your data during transmission.
                </Text>
              </View>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-red-50 p-3 border border-red-200">
                <Text className="text-sm font-semibold text-red-900 mb-1">Payment Standards</Text>
                <Text className="text-sm text-red-800 leading-5">
                  We follow the Payment Card Industry Data Security Standard (PCI DSS) when handling card data.
                </Text>
              </View>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-red-50 p-3 border border-red-200">
                <Text className="text-sm font-semibold text-red-900 mb-1">Identity Verification</Text>
                <Text className="text-sm text-red-800 leading-5">
                  Our procedures mean that we may ask to verify your identity before we disclose personal information to you.
                </Text>
              </View>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-red-50 p-3 border border-red-200">
                <Text className="text-sm font-semibold text-red-900 mb-1">User Responsibility</Text>
                <Text className="text-sm text-red-800 leading-5">
                  It is important for you to protect against unauthorized access to your password. We recommend signing off when finished using a shared device.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 6 — Your Choices and Access */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 items-center justify-center mr-4 shadow-md">
                <Settings size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Section 6</Text>
                <Text className="text-xl font-mbold text-gray-900">Your Choices & Access</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <Text className="text-base text-gray-700 leading-6 mb-1">
                NamZoed provides you with significant control over your data:
              </Text>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Access to Data</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You can access your products, services, order history, name, address, and payment options in the "My Account" section.
                </Text>
              </View>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Updating Information</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  When you update data, we usually keep a copy of the prior version for our records.
                </Text>
              </View>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Communication Preferences</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You can choose not to receive emails or in-app notifications by adjusting your notification settings.
                </Text>
              </View>
              <View
                style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">Deletion</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  To the extent required by law, you may request the deletion of your personal information.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 7 — Conditions of Use */}
          <View
            style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 items-center justify-center mr-4 shadow-md">
                <FileText size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-1">Section 7</Text>
                <Text className="text-xl font-mbold text-gray-900">Conditions of Use & Revisions</Text>
              </View>
            </View>
            <View className="pl-16">
              <Text className="text-sm text-gray-700 leading-6">
                If you choose to use NamZoed, any dispute over privacy is subject to this Notice and our Conditions
                of Use. Our business changes constantly, and our Privacy Notice will change also. Unless stated
                otherwise, our current Privacy Notice applies to all information that we have about you and your account.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View
            style={{ borderRadius: 24, borderCurve: "continuous" }} className="bg-primary p-6 mt-4 shadow-lg">
            <View className="items-center mb-3">
              <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mb-3">
                <BadgeCheck size={32} color="#ffffff" />
              </View>
              <Text className="text-lg font-mbold text-white text-center mb-2">
                Your Privacy Matters
              </Text>
            </View>
            <Text className="text-sm text-white/90 text-center leading-5">
              As Bhutan's and the world's "Everything in One" platform, maintaining the Trust Fortress for our community is our highest priority. Thank you for trusting NamZoed.
            </Text>
          </View>

          {/* Last Updated */}
          <View className="mt-6 mb-2">
            <Text className="text-xs text-gray-400 text-center">
              Last Updated: March 2026
            </Text>
            <Text className="text-xs text-gray-400 text-center mt-1">
              Version 1.0
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
