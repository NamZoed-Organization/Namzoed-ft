// Path: app/(users)/providerdetail/[id].tsx
import TopNavbar from "@/components/ui/TopNavbar";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getServiceProviderById } from "../../../data/services";

interface ServiceOffering {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  phone: string;
  images: string[];
  description: string;
  location: string;
  available: boolean;
  services: ServiceOffering[];
  rating?: number;
  reviewCount?: number;
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      const foundProvider = getServiceProviderById(id);
      setProvider(foundProvider || null);
    }
  }, [id]);

  const handleCallPress = () => {
    if (provider?.phone) {
      Alert.alert(
        "Call Provider",
        `Call ${provider.name} at ${provider.phone}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Call",
            onPress: () => Linking.openURL(`tel:${provider.phone}`),
          },
        ]
      );
    }
  };

  const handleBookService = (service: ServiceOffering) => {
    Alert.alert(
      "Book Service",
      `Book "${service.name}" with ${provider?.name}?\nPrice: Nu. ${service.price}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Book Now",
          onPress: () => {
            // Navigate to booking screen or handle booking logic
            Alert.alert("Success", "Booking request sent successfully!");
          },
        },
      ]
    );
  };

  const renderServiceCard = ({ item }: { item: ServiceOffering }) => (
    <View className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-msemibold text-gray-900 flex-1">
          {item.name}
        </Text>
        <Text className="text-xl font-mbold text-primary">
          Nu. {item.price}
        </Text>
      </View>

      {item.description && (
        <Text className="text-sm font-regular text-gray-500 mb-3">
          {item.description}
        </Text>
      )}

      <TouchableOpacity
        className="bg-primary rounded-lg py-3 px-4 items-center"
        onPress={() => handleBookService(item)}
        activeOpacity={0.8}
      >
        <Text className="text-white font-msemibold">Book Now</Text>
      </TouchableOpacity>
    </View>
  );

  const renderImageItem = ({
    item,
    index,
  }: {
    item: string;
    index: number;
  }) => (
    <TouchableOpacity
      onPress={() => setSelectedImageIndex(index)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item }}
        className={`w-16 h-16 rounded-lg mr-3 ${
          selectedImageIndex === index ? "border-2 border-primary" : ""
        }`}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  if (!provider) {
    return (
      <View className="flex-1 bg-background">
        <TopNavbar />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-mbold text-gray-700">
            Provider Not Found
          </Text>
          <Text className="text-sm font-regular text-gray-500 text-center mt-2">
            The requested service provider could not be found.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Image Section */}
        <View className="bg-white">
          <Image
            source={{ uri: provider.images[selectedImageIndex] }}
            className="w-full h-64"
            resizeMode="cover"
          />

          {/* Image Thumbnails */}
          {provider.images.length > 1 && (
            <View className="px-4 py-3">
              <FlatList
                data={provider.images}
                renderItem={renderImageItem}
                keyExtractor={(item, index) => `${item}-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}
        </View>

        {/* Provider Info Section */}
        <View className="bg-white border-b border-gray-100 px-4 py-6">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <Text className="text-2xl font-mbold text-gray-900 mb-2">
                {provider.name}
              </Text>
              <Text className="text-base font-medium text-primary mb-2">
                {provider.category}
              </Text>
              <Text className="text-sm font-regular text-gray-600 mb-3">
                📍 {provider.location}
              </Text>
            </View>

            <View
              className={`px-3 py-2 rounded-full ${
                provider.available ? "bg-green-100" : "bg-red-100"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  provider.available ? "text-green-600" : "text-red-600"
                }`}
              >
                {provider.available ? "✓ Available" : "✗ Unavailable"}
              </Text>
            </View>
          </View>

          {/* Rating */}
          {provider.rating && (
            <View className="flex-row items-center mb-4">
              <View className="flex-row items-center bg-yellow-50 px-3 py-2 rounded-lg">
                <Text className="text-lg">⭐</Text>
                <Text className="text-lg font-mbold text-gray-900 ml-1">
                  {provider.rating}
                </Text>
                <Text className="text-sm font-regular text-gray-500 ml-2">
                  ({provider.reviewCount} reviews)
                </Text>
              </View>
            </View>
          )}

          {/* Description */}
          <Text className="text-base font-regular text-gray-700 leading-6">
            {provider.description}
          </Text>
        </View>

        {/* Contact Section */}
        <View className="bg-white border-b border-gray-100 px-4 py-4">
          <Text className="text-lg font-msemibold text-gray-900 mb-3">
            Contact Information
          </Text>

          <TouchableOpacity
            className="flex-row items-center bg-primary/10 rounded-lg p-4"
            onPress={handleCallPress}
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-4">
              <Text className="text-white text-xl">📞</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-msemibold text-gray-900">
                {provider.phone}
              </Text>
              <Text className="text-sm font-regular text-gray-500">
                Tap to call
              </Text>
            </View>
            <Text className="text-primary font-bold text-lg">›</Text>
          </TouchableOpacity>
        </View>

        {/* Services Section */}
        <View className="px-4 py-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-msemibold text-gray-900">
              Services Available
            </Text>
            <Text className="text-sm font-regular text-gray-500">
              {provider.services.length} services
            </Text>
          </View>

          <FlatList
            data={provider.services}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Floating Action Buttons */}
      <View className="absolute bottom-6 left-4 right-4 flex-row space-x-3">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-xl py-4 items-center"
          onPress={handleCallPress}
          activeOpacity={0.8}
        >
          <Text className="text-white font-msemibold text-base">
            📞 Call Now
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 bg-primary rounded-xl py-4 items-center"
          onPress={() => {
            if (provider.services.length > 0) {
              handleBookService(provider.services[0]);
            }
          }}
          activeOpacity={0.8}
        >
          <Text className="text-white font-msemibold text-base">
            📅 Quick Book
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
