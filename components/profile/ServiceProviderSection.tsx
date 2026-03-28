import {
  Camera,
  CheckCircle2,
  Verified,
  Edit3,
  FileText,
  MoreVertical,
  Plus,
  Upload,
  Wrench,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Switch,
  Text,
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
    contact: string;
    emailActive: boolean;
    contactActive: boolean;
    bio: string;
  };
  licenseImageUrl: string | null;
  uploadingLicense: boolean;
  providerServices: ProviderServiceWithDetails[];
  loadingProviderServices: boolean;
  isServiceSelectionMode: boolean;
  selectedServiceIds: string[];
  onEditWork: () => void;
  onViewProviderImage: () => void;
  onShowProviderAvatarMenu: () => void;
  onEditProviderProfile: () => void;
  onUploadLicense: () => void;
  onShowLicenseMenu: () => void;
  onServiceLongPress: (serviceId: string) => void;
  onToggleServiceSelection: (serviceId: string) => void;
  onToggleStatus: (serviceId: string, status: boolean) => void;
  onEditService: (service: ProviderServiceWithDetails) => void;
  onNavigateToService: (serviceId: string) => void;
  onAddService: () => void;
}

export default function ServiceProviderSection({
  loadingServiceProvider,
  providerImageUri,
  verificationStatus,
  providerFormData,
  licenseImageUrl,
  uploadingLicense,
  providerServices,
  loadingProviderServices,
  isServiceSelectionMode,
  selectedServiceIds,
  onEditWork,
  onViewProviderImage,
  onShowProviderAvatarMenu,
  onEditProviderProfile,
  onUploadLicense,
  onShowLicenseMenu,
  onServiceLongPress,
  onToggleServiceSelection,
  onToggleStatus,
  onEditService,
  onNavigateToService,
  onAddService,
}: ServiceProviderSectionProps) {
  if (loadingServiceProvider) {
    return (
      <ActivityIndicator size="large" color="#094569" className="py-12" />
    );
  }

  return (
    <View className="px-4 py-6">

      {/* ── PROFILE HEADER CARD ── */}
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">

        {/* Top row: info left, avatar right */}
        <View className="flex-row items-start">

          {/* Left: name and bio */}
          <View className="flex-1 pr-4">
            <View className="flex-row items-center gap-1.5 mb-0.5">
              <Text
                className="text-lg font-mbold text-gray-900 flex-shrink"
                numberOfLines={2}
              >
                {providerFormData.businessName || "Business Name"}
              </Text>
              {verificationStatus === "verified" && (
                <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                  <Verified size={11} color="#094569" />
                  <Text className="text-[10px] font-msemibold text-[#094569] leading-none">Verified</Text>
                </View>
              )}
            </View>

            {/* Bio */}
            {providerFormData.bio ? (
              <Text
                className="text-sm font-regular text-gray-500"
                numberOfLines={3}
              >
                {providerFormData.bio}
              </Text>
            ) : (
              <Text className="text-sm font-regular text-gray-400 italic">
                No bio set
              </Text>
            )}
          </View>

          {/* Right: avatar */}
          <View className="relative">
            <TouchableOpacity
              onPress={providerImageUri ? onViewProviderImage : onShowProviderAvatarMenu}
              onLongPress={onShowProviderAvatarMenu}
              className="w-[86px] h-[86px] rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100"
            >
              {providerImageUri ? (
                <Image
                  source={{ uri: providerImageUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-gray-100">
                  <Wrench size={34} strokeWidth={1.5} color="#9ca3af" />
                </View>
              )}
            </TouchableOpacity>

            {/* Camera button */}
            <TouchableOpacity
              onPress={providerImageUri ? onShowProviderAvatarMenu : onEditProviderProfile}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-white items-center justify-center"
            >
              <Camera size={12} strokeWidth={1.5} color="white" />
            </TouchableOpacity>

          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-2 mt-4">
          <TouchableOpacity
            onPress={onEditWork}
            className="flex-1 py-[9px] rounded-lg flex-row items-center justify-center bg-gray-100 border border-gray-300"
          >
            <Edit3 size={13} color="#1f2937" style={{ marginRight: 5 }} />
            <Text className="text-sm font-semibold text-gray-800">Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAddService}
            className="flex-1 py-[9px] rounded-lg flex-row items-center justify-center bg-primary"
          >
            <Plus size={13} color="white" style={{ marginRight: 5 }} />
            <Text className="text-sm font-semibold text-white">Add Service</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LICENSE VERIFICATION ── */}
      <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <FileText size={20} color="#094569" style={{ marginRight: 8 }} />
            <Text className="text-lg font-mbold text-gray-900">
              License Verification
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!uploadingLicense && verificationStatus === "verified" && (
              <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                <Verified size={11} color="#094569" />
                <Text className="text-[10px] font-msemibold text-[#094569] leading-none">Verified</Text>
              </View>
            )}
            {!uploadingLicense && verificationStatus === "pending" && (
              <View className="flex-row items-center bg-yellow-50 border border-yellow-400 rounded-full px-2 py-0.5 gap-1">
                <FileText size={11} color="#ca8a04" strokeWidth={2.5} />
                <Text className="text-[10px] font-msemibold text-yellow-700 leading-none">Pending</Text>
              </View>
            )}
            {licenseImageUrl && !uploadingLicense && (
              <TouchableOpacity
                onPress={onShowLicenseMenu}
                className="w-8 h-8 items-center justify-center"
              >
                <MoreVertical size={20} color="#374151" />
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
            <Upload size={18} color="white" style={{ marginRight: 8 }} />
            <Text className="text-white font-msemibold">Upload License</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── YOUR SERVICES ── */}
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
                    <View className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 relative">
                      {service.images && service.images.length > 0 ? (
                        <Image
                          source={{ uri: service.images[0] }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                          <Wrench size={32} color="#9ca3af" />
                        </View>
                      )}
                      {selectedServiceIds.includes(service.id) && (
                        <View className="absolute inset-0 bg-primary/30 items-center justify-center">
                          <CheckCircle2 color="white" size={28} strokeWidth={3} />
                        </View>
                      )}
                    </View>

                    <View className="flex-1 ml-4">
                      <Text className="text-base font-mbold text-gray-900" numberOfLines={1}>
                        {service.name}
                      </Text>
                      {service.service_categories && (
                        <Text className="text-xs font-regular text-primary mb-1">
                          {service.service_categories.name}
                        </Text>
                      )}
                      <Text className="text-sm font-regular text-gray-600" numberOfLines={2}>
                        {service.description}
                      </Text>
                    </View>

                    {!isServiceSelectionMode && (
                      <View className="items-center justify-between ml-2">
                        <View className="items-center mb-2">
                          <Switch
                            value={service.status}
                            onValueChange={(value) => onToggleStatus(service.id, value)}
                            trackColor={{ false: "#D1D5DB", true: "#10B981" }}
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
            <Wrench size={48} color="#9ca3af" />
            <Text className="text-base text-gray-500 mt-4">No services listed yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}
