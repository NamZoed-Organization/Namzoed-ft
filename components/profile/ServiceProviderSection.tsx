import {
  CheckCircle2,
  Edit3,
  FileText,
  MoreVertical,
  Upload,
  Wrench,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ProviderServiceWithDetails } from "@/lib/servicesService";
import Animated, { FadeInRight, FadeOutLeft, Layout } from "react-native-reanimated";

interface ServiceProviderSectionProps {
  loadingServiceProvider: boolean;
  isEditingProvider: boolean;
  providerImageUri: string | null;
  verificationStatus: "verified" | "not_verified" | "pending";
  providerFormData: {
    businessName: string;
    email: string;
    phone: string;
    bio: string;
  };
  licenseImageUrl: string | null;
  uploadingLicense: boolean;
  providerServices: ProviderServiceWithDetails[];
  loadingProviderServices: boolean;
  isServiceSelectionMode: boolean;
  selectedServiceIds: string[];
  onToggleEditProvider: () => void;
  onSaveProviderProfile: () => void;
  onShowProviderAvatarMenu: () => void;
  onEditProviderProfile: () => void;
  setProviderFormData: (data: any) => void;
  onUploadLicense: () => void;
  onShowLicenseMenu: () => void;
  onServiceLongPress: (serviceId: string) => void;
  onToggleServiceSelection: (serviceId: string) => void;
  onToggleStatus: (serviceId: string, status: boolean) => void;
  onEditService: (service: ProviderServiceWithDetails) => void;
  onNavigateToService: (serviceId: string) => void;
}

export default function ServiceProviderSection({
  loadingServiceProvider,
  isEditingProvider,
  providerImageUri,
  verificationStatus,
  providerFormData,
  licenseImageUrl,
  uploadingLicense,
  providerServices,
  loadingProviderServices,
  isServiceSelectionMode,
  selectedServiceIds,
  onToggleEditProvider,
  onSaveProviderProfile,
  onShowProviderAvatarMenu,
  onEditProviderProfile,
  setProviderFormData,
  onUploadLicense,
  onShowLicenseMenu,
  onServiceLongPress,
  onToggleServiceSelection,
  onToggleStatus,
  onEditService,
  onNavigateToService,
}: ServiceProviderSectionProps) {
  if (loadingServiceProvider) {
    return (
      <ActivityIndicator size="large" color="#094569" className="py-12" />
    );
  }

  return (
    <View className="px-4 py-6">
      {/* Service Provider Header */}
      <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        {/* Top Bar with Title and Menu Button */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-xl font-mbold text-gray-900">
            Service Provider Profile
          </Text>

          {isEditingProvider ? (
            <View className="flex-row gap-2">
              <TouchableOpacity
                className="bg-primary rounded-full px-4 py-2 items-center"
                onPress={onSaveProviderProfile}
              >
                <Text className="text-white font-msemibold text-sm">Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-gray-100 rounded-full px-4 py-2 items-center"
                onPress={onToggleEditProvider}
              >
                <Text className="text-gray-700 font-msemibold text-sm">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                className="flex-row items-center gap-1 bg-primary rounded-full px-4 py-2"
                onPress={onToggleEditProvider}
              >
                <Edit3 size={14} className="text-white" />
                <Text className="text-white font-msemibold text-sm">Edit</Text>
              </TouchableOpacity>
              {providerImageUri && (
                <TouchableOpacity
                  onPress={onShowProviderAvatarMenu}
                  className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
                >
                  <MoreVertical size={20} className="text-gray-700" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Avatar Section */}
        <View className="items-center mb-6">
          <View className="relative mb-4">
            <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center overflow-hidden">
              {providerImageUri ? (
                <Image
                  source={{ uri: providerImageUri }}
                  className="w-24 h-24 rounded-full"
                  resizeMode="cover"
                />
              ) : (
                <Wrench size={40} className="text-gray-400" />
              )}
            </View>
            {/* Verified Badge */}
            {verificationStatus === "verified" && (
              <View className="absolute top-0 right-0 w-9 h-9 bg-blue-500 rounded-full items-center justify-center border-3 border-white shadow-lg">
                <CheckCircle2 size={20} color="white" fill="white" />
              </View>
            )}
            {!providerImageUri && (
              <TouchableOpacity
                onPress={onEditProviderProfile}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
              >
                <Edit3 size={16} className="text-white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form Fields */}
        <View className="space-y-4">
          {/* Business Name */}
          <View className="mb-4">
            <Text className="text-sm font-msemibold text-gray-700 mb-2">
              Business Name
            </Text>
            {isEditingProvider ? (
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 text-base font-regular text-gray-900 border border-gray-200"
                placeholder="Enter business name"
                placeholderTextColor="#9CA3AF"
                value={providerFormData.businessName}
                onChangeText={(text) =>
                  setProviderFormData({
                    ...providerFormData,
                    businessName: text,
                  })
                }
              />
            ) : (
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Text className="text-base font-regular text-gray-400 italic">
                  Not set
                </Text>
              </View>
            )}
          </View>

          {/* Email & Phone */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-msemibold text-gray-700 mb-2">
                Email
              </Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                <Text
                  className="text-base font-regular text-gray-900"
                  numberOfLines={1}
                >
                  {providerFormData.email || "Not set"}
                </Text>
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-sm font-msemibold text-gray-700 mb-2">
                Phone
              </Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                <Text
                  className="text-base font-regular text-gray-900"
                  numberOfLines={1}
                >
                  {providerFormData.phone || "Not set"}
                </Text>
              </View>
            </View>
          </View>

          {/* Business Bio */}
          <View className="mb-4">
            <Text className="text-sm font-msemibold text-gray-700 mb-2">
              Business Bio
            </Text>
            {isEditingProvider ? (
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 text-base font-regular text-gray-900 border border-gray-200"
                placeholder="Tell us about your business"
                placeholderTextColor="#9CA3AF"
                value={providerFormData.bio}
                onChangeText={(text) =>
                  setProviderFormData({
                    ...providerFormData,
                    bio: text,
                  })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 100 }}
              />
            ) : (
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Text className="text-base font-regular text-gray-900">
                  {providerFormData.bio || (
                    <Text className="italic text-gray-400">Not set</Text>
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* License Verification Section */}
      <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <FileText size={20} className="text-primary mr-2" />
            <Text className="text-lg font-mbold text-gray-900">
              License Verification
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!uploadingLicense && verificationStatus !== "not_verified" && (
              <View
                className={`px-3 py-1 rounded-full ${
                  verificationStatus === "verified"
                    ? "bg-green-100"
                    : "bg-yellow-100"
                }`}
              >
                <Text
                  className={`text-xs font-msemibold ${
                    verificationStatus === "verified"
                      ? "text-green-700"
                      : "text-yellow-700"
                  }`}
                >
                  {verificationStatus === "verified"
                    ? "Verified"
                    : "Pending Verification"}
                </Text>
              </View>
            )}
            {licenseImageUrl && !uploadingLicense && (
              <TouchableOpacity
                onPress={onShowLicenseMenu}
                className="w-8 h-8 items-center justify-center"
              >
                <MoreVertical size={20} className="text-gray-700" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text className="text-sm text-gray-500 mb-4">
          {uploadingLicense
            ? "Uploading license document..."
            : verificationStatus === "verified"
              ? "Your license has been verified."
              : verificationStatus === "pending"
                ? "Your license is pending verification by our team."
                : "Upload your business license or identification document for verification."}
        </Text>

        {uploadingLicense ? (
          <View className="flex-row items-center justify-center py-3">
            <ActivityIndicator size="small" color="#094569" />
            <Text className="text-primary font-msemibold ml-3">
              Processing document...
            </Text>
          </View>
        ) : !licenseImageUrl ? (
          <TouchableOpacity
            onPress={onUploadLicense}
            className="flex-row items-center justify-center bg-primary rounded-xl py-3 px-4"
          >
            <Upload size={18} className="text-white mr-2" />
            <Text className="text-white font-msemibold">Upload License</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Your Services Section */}
      <View className="bg-white rounded-2xl p-6 shadow-sm">
        <Text className="text-lg font-mbold text-gray-900 mb-2">
          Your Services
        </Text>
        <Text className="text-sm text-gray-500 mb-4">
          {providerServices.length > 0
            ? `You have ${providerServices.length} service${providerServices.length > 1 ? "s" : ""} listed`
            : "Services you offer will appear here"}
        </Text>

        {loadingProviderServices ? (
          <ActivityIndicator size="large" color="#094569" className="py-8" />
        ) : providerServices.length > 0 ? (
          <View className="space-y-3">
            {providerServices.map((service) => (
              <Animated.View
                key={service.id}
                entering={FadeInRight}
                exiting={FadeOutLeft}
                layout={Layout.springify()}
                className="mb-3"
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => onServiceLongPress(service.id)}
                  onPress={() =>
                    isServiceSelectionMode
                      ? onToggleServiceSelection(service.id)
                      : onNavigateToService(service.id)
                  }
                  className={`bg-white rounded-[24px] p-3 shadow-sm border-2 ${
                    selectedServiceIds.includes(service.id)
                      ? "border-primary bg-blue-50/50"
                      : "border-transparent"
                  }`}
                >
                  <View className="flex-row">
                    {/* Service Image */}
                    <View className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 relative">
                      {service.images && service.images.length > 0 ? (
                        <Image
                          source={{ uri: service.images[0] }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                          <Wrench size={32} className="text-gray-400" />
                        </View>
                      )}

                      {/* Selection Checkmark */}
                      {selectedServiceIds.includes(service.id) && (
                        <View className="absolute inset-0 bg-primary/30 items-center justify-center">
                          <CheckCircle2 color="white" size={28} strokeWidth={3} />
                        </View>
                      )}
                    </View>

                    {/* Service Info */}
                    <View className="flex-1 ml-4">
                      <Text
                        className="text-base font-mbold text-gray-900"
                        numberOfLines={1}
                      >
                        {service.name}
                      </Text>

                      {service.service_categories && (
                        <Text className="text-xs font-regular text-primary mb-1">
                          {service.service_categories.name}
                        </Text>
                      )}

                      <Text
                        className="text-sm font-regular text-gray-600"
                        numberOfLines={2}
                      >
                        {service.description}
                      </Text>
                    </View>

                    {/* Action Controls */}
                    {!isServiceSelectionMode && (
                      <View className="items-center justify-between ml-2">
                        {/* Toggle Switch */}
                        <View className="items-center mb-2">
                          <Switch
                            value={service.status}
                            onValueChange={(value) =>
                              onToggleStatus(service.id, value)
                            }
                            trackColor={{
                              false: "#D1D5DB",
                              true: "#10B981",
                            }}
                            thumbColor={service.status ? "#059669" : "#F3F4F6"}
                            ios_backgroundColor="#D1D5DB"
                          />
                          <Text
                            className={`text-[10px] font-msemibold mt-1 ${
                              service.status ? "text-green-700" : "text-gray-500"
                            }`}
                          >
                            {service.status ? "Active" : "Inactive"}
                          </Text>
                        </View>

                        {/* Edit Button */}
                        <TouchableOpacity
                          onPress={() => onEditService(service)}
                          className="w-9 h-9 bg-gray-50 items-center justify-center rounded-full border border-gray-100"
                        >
                          <Edit3 size={16} color="#4B5563" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View className="items-center justify-center py-8 bg-gray-50 rounded-xl">
            <Wrench size={48} className="text-gray-400 mb-4" />
            <Text className="text-base text-gray-500">
              No services listed yet
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
