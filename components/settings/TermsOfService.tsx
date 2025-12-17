import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, NativeScrollEvent, NativeSyntheticEvent, Platform } from 'react-native';
import { ArrowLeft, Shield, Users, Store, CreditCard, FileText, Scale, AlertCircle, XCircle, Gavel, RefreshCw, ShieldCheck, BadgeCheck } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

interface TermsOfServiceProps {
  onClose?: () => void;
}

export default function TermsOfService({ onClose }: TermsOfServiceProps) {
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
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Terms of Service</Text>
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
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Terms of Service</Text>
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
              <FileText size={40} color="#ffffff" />
            </View>
            <Text className="text-3xl font-mblack text-white text-center mb-2">NamZoed</Text>
            <Text className="text-xl font-semibold text-white/90 text-center">Terms of Service</Text>
          </View>
          <View className="bg-white/10 rounded-2xl p-4 mt-2">
            <Text className="text-sm text-white/90 text-center leading-5">
              Welcome to Bhutan's local commerce and services platform. Please read these terms carefully before using our services.
            </Text>
          </View>
        </View>

        {/* Content Sections */}
        <View className="px-5 py-6">

          {/* Intro Alert */}
          <View className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-4 mb-6 shadow-sm">
            <View className="flex-row items-start">
              <AlertCircle size={20} color="#f59e0b" className="mt-0.5 mr-3" />
              <Text className="text-sm text-amber-900 leading-5 flex-1 font-medium">
                By registering for an account, accessing, or using the App, you agree to be bound by these Terms.
                If you do not agree to these Terms, you may not use the NamZoed App.
              </Text>
            </View>
          </View>

          {/* Section 1 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 items-center justify-center mr-4 shadow-md">
                <Shield size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Section 1</Text>
                <Text className="text-xl font-mbold text-gray-900">Acceptance of Terms</Text>
              </View>
            </View>
            <View className="pl-16">
              <Text className="text-base text-gray-700 leading-6">
                By clicking "I Agree" or "Sign Up," you affirm that you have read, understood, and agreed to be legally
                bound by these Terms and the associated Privacy Policy.
              </Text>
            </View>
          </View>

          {/* Section 2 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 items-center justify-center mr-4 shadow-md">
                <Store size={24} color="#094569" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Section 2</Text>
                <Text className="text-xl font-mbold text-gray-900">The NamZoed Service</Text>
              </View>
            </View>
            <View className="pl-16 space-y-4">
              <Text className="text-base text-gray-700 leading-6 font-medium">
                NamZoed operates as a digital marketplace and directory service.
              </Text>

              <View className="bg-green-50 rounded-xl p-4 border border-green-200">
                <Text className="text-sm font-semibold text-green-900 mb-2">✓ Our Role:</Text>
                <Text className="text-sm text-green-800 leading-5">
                  NamZoed's primary function is to provide a platform that connects Buyers (seeking products
                  or services) and Sellers/Service Providers (listing products or services) within Bhutan.
                  We facilitate connection, communication, and listing.
                </Text>
              </View>

              <View className="bg-red-50 rounded-xl p-4 border border-red-200">
                <Text className="text-sm font-semibold text-red-900 mb-2">✗ Our Limitation:</Text>
                <Text className="text-sm text-red-800 leading-5">
                  NamZoed is not a traditional retailer, auctioneer, or service provider. We do not hold
                  inventory, set prices, execute final payments, or guarantee the quality or legality of items
                  or services listed. NamZoed is not a party to the actual transaction between Buyers and Sellers.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 3 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 items-center justify-center mr-4 shadow-md">
                <Users size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Section 3</Text>
                <Text className="text-xl font-mbold text-gray-900">Account & Security</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <View className="border-l-2 border-primary/30 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">3.1. Eligibility</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You must provide accurate, complete, and current information during registration.
                </Text>
              </View>
              <View className="border-l-2 border-primary/30 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">3.2. Security</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You are responsible for safeguarding your password and any activities or actions under
                  your account. You agree to notify NamZoed immediately if you suspect any unauthorized use
                  of your account.
                </Text>
              </View>
              <View className="border-l-2 border-primary/30 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">3.3. Single Account</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Users may maintain only one active account. Sellers may operate a business account
                  alongside a personal buyer account, provided all information is transparent and accurate.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 4 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 items-center justify-center mr-4 shadow-md">
                <BadgeCheck size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Section 4</Text>
                <Text className="text-xl font-mbold text-gray-900">Rules for All Users</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">4.1. Lawful Use</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You agree to use the App only for lawful purposes. You must not list, purchase, or
                  exchange any item or service that violates any law of the Kingdom of Bhutan or your
                  relevant jurisdiction.
                </Text>
              </View>
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">4.2. Respectful Conduct</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  All communications on the App (including chat and live streams) must be respectful, honest,
                  and professional. Harassment, abuse, discriminatory, or offensive language is strictly prohibited.
                </Text>
              </View>
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <Text className="text-sm font-semibold text-gray-800 mb-1">4.3. No Fraud</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You shall not manipulate the platform, pricing, listing descriptions, or reviews, or
                  engage in any fraudulent activity.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 5 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 items-center justify-center mr-4 shadow-md">
                <ShieldCheck size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Section 5</Text>
                <Text className="text-xl font-mbold text-gray-900">Rules for Sellers</Text>
                <Text className="text-xs text-gray-500 italic mt-1">(Tshongpas)</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">5.1. Accurate Listings</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Listings must accurately and clearly describe the item or service, including its condition,
                  price, and location. Photos must be of the actual product or represent the service offered.
                </Text>
              </View>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">5.2. Legality of Goods</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Sellers are solely responsible for ensuring that all listed products are legal, not
                  counterfeit, and safe for sale and use. Prohibited items include (but are not limited to)
                  - illegal drugs, stolen goods, weapons, pornography, and items infringing on intellectual
                  property rights.
                </Text>
              </View>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">5.3. Transaction Obligation</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  If a transaction is agreed upon, the Seller must fulfill the order or service as described
                  in the listing and within the agreed timeline.
                </Text>
              </View>
              <View className="border-l-2 border-purple-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">5.4. Taxes and Fees</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  Sellers are solely responsible for all taxes, fees, and regulatory requirements associated
                  with the sale of their goods and services in Bhutan. NamZoed is not responsible for filing
                  or calculating these liabilities.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 6 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 items-center justify-center mr-4 shadow-md">
                <CreditCard size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Section 6</Text>
                <Text className="text-xl font-mbold text-gray-900">Payments & Exchange</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <View className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <Text className="text-sm font-semibold text-blue-900 mb-1">6.1. Payment</Text>
                <Text className="text-sm text-blue-800 leading-5">
                  NamZoed does not process the final payment for goods or services. Buyers and Sellers agree
                  on the payment method directly (e.g., cash on delivery, bank transfer, local payment apps).
                  NamZoed assumes no responsibility for payment disputes, failure to pay, or fraud related to payment.
                </Text>
              </View>
              <View className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <Text className="text-sm font-semibold text-blue-900 mb-1">6.2. Safe Exchange Points</Text>
                <Text className="text-sm text-blue-800 leading-5">
                  NamZoed encourages the use of designated Office of NamZoed locations for safe, verifiable
                  exchange of goods. Use of this service does not make NamZoed responsible for the item's
                  condition or quality, only for providing a supervised meeting space.
                </Text>
              </View>
              <View className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <Text className="text-sm font-semibold text-blue-900 mb-1">6.3. Disputes</Text>
                <Text className="text-sm text-blue-800 leading-5">
                  In the event of a dispute between a Buyer and Seller, both parties agree to first attempt
                  to resolve the issue amicably. NamZoed may, but is not obligated to, assist in mediation
                  at its sole discretion.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 7 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 items-center justify-center mr-4 shadow-md">
                <FileText size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Section 7</Text>
                <Text className="text-xl font-mbold text-gray-900">Intellectual Property</Text>
              </View>
            </View>
            <View className="pl-16 space-y-3">
              <View className="border-l-2 border-indigo-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">7.1. Your Content</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  You retain all ownership rights to the content you submit to the App (photos, listings,
                  messages). By submitting content, you grant NamZoed a worldwide, royalty-free license to use,
                  reproduce, modify, and display your content in connection with the operation and promotion
                  of the App.
                </Text>
              </View>
              <View className="border-l-2 border-indigo-300 pl-4 py-2">
                <Text className="text-sm font-semibold text-gray-800 mb-1">7.2. NamZoed IP</Text>
                <Text className="text-sm text-gray-700 leading-5">
                  All rights, title, and interest in and to the App (excluding user-provided content),
                  including its design, logo, functionality, and software, are the exclusive property of NamZoed.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 8 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 items-center justify-center mr-4 shadow-md">
                <AlertCircle size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Section 8</Text>
                <Text className="text-xl font-mbold text-gray-900">Limitation of Liability</Text>
              </View>
            </View>
            <View className="pl-16">
              <Text className="text-sm text-gray-700 leading-6">
                NamZoed is provided on an "as is" and "as available" basis. NamZoed shall not be liable for
                any direct, indirect, incidental, special, consequential, or punitive damages, including loss
                of profits, data, goodwill, or other intangible losses, resulting from (a) your access to or
                use of the App; (b) the conduct or content of any third party on the App; or (c) any items
                purchased or services obtained through the App.
              </Text>
            </View>
          </View>

          {/* Section 9 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 items-center justify-center mr-4 shadow-md">
                <XCircle size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Section 9</Text>
                <Text className="text-xl font-mbold text-gray-900">Termination</Text>
              </View>
            </View>
            <View className="pl-16">
              <Text className="text-sm text-gray-700 leading-6">
                NamZoed may terminate or suspend your account immediately, without prior notice or liability,
                for any offence, including without limitation if you breach the Terms. Upon termination, your
                right to use the App will immediately cease.
              </Text>
            </View>
          </View>

          {/* Section 10 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 items-center justify-center mr-4 shadow-md">
                <Gavel size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-1">Section 10</Text>
                <Text className="text-xl font-mbold text-gray-900">Governing Law</Text>
              </View>
            </View>
            <View className="pl-16">
              <Text className="text-sm text-gray-700 leading-6">
                These Terms shall be governed by and construed in accordance with the laws of the Kingdom of
                Bhutan and your relevant jurisdiction without regard to its conflict of law provisions.
              </Text>
            </View>
          </View>

          {/* Section 11 */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 items-center justify-center mr-4 shadow-md">
                <RefreshCw size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-pink-600 uppercase tracking-wider mb-1">Section 11</Text>
                <Text className="text-xl font-mbold text-gray-900">Changes to Terms</Text>
              </View>
            </View>
            <View className="pl-16">
              <Text className="text-sm text-gray-700 leading-6">
                NamZoed reserves the right, at its sole discretion, to modify or replace these Terms at any time.
                If a revision is material, we will provide at least 30 days' notice before any new terms take effect.
                By continuing to access or use our App after those revisions become effective, you agree to be
                bound by the revised terms.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View className="bg-primary rounded-3xl p-6 mt-4 shadow-lg">
            <View className="items-center mb-3">
              <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mb-3">
                <BadgeCheck size={32} color="#ffffff" />
              </View>
              <Text className="text-lg font-mbold text-white text-center mb-2">
                Thank you for choosing NamZoed!
              </Text>
            </View>
            <Text className="text-sm text-white/90 text-center leading-5">
              By clicking 'I Agree' below, you accept these Terms of Service and commit to being a responsible member of our community.
            </Text>
          </View>

          {/* Last Updated */}
          <View className="mt-6 mb-2">
            <Text className="text-xs text-gray-400 text-center">
              Last Updated: January 2025
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
