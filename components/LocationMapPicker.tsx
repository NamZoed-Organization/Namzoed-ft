import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    Text,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface LocationMapPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationsSelected: (pickup: Location, delivery: Location) => void;
  initialPickupLocation?: Location | null;
  initialDeliveryLocation?: Location | null;
}

export default function LocationMapPicker({
  visible,
  onClose,
  onLocationsSelected,
  initialPickupLocation,
  initialDeliveryLocation,
}: LocationMapPickerProps) {
  // Default location (Thimphu, Bhutan)
  const defaultRegion = {
    latitude: 27.4728,
    longitude: 89.6393,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const [pickupLocation, setPickupLocation] = useState<Location | null>(
    initialPickupLocation || null
  );
  const [deliveryLocation, setDeliveryLocation] = useState<Location | null>(
    initialDeliveryLocation || null
  );
  const [mapRegion, setMapRegion] = useState(defaultRegion);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

  // Get address from coordinates using reverse geocoding
  const getAddressFromCoordinates = async (
    latitude: number,
    longitude: number
  ): Promise<string> => {
    try {
      setLoadingAddress(true);
      // Using OpenStreetMap Nominatim API for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'NamzoedApp/1.0'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      }
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error("Error getting address:", error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    // Get address for the tapped location
    const address = await getAddressFromCoordinates(latitude, longitude);

    // If no pickup location set, set pickup first (green pin)
    if (!pickupLocation) {
      setPickupLocation({
        latitude,
        longitude,
        address,
      });
      Alert.alert(
        "Pickup Location Set",
        "Green pin placed! Now tap to set the delivery location (blue pin).",
        [{ text: "OK" }]
      );
    }
    // If pickup is set but delivery isn't, set delivery (blue pin)
    else if (!deliveryLocation) {
      setDeliveryLocation({
        latitude,
        longitude,
        address,
      });
      Alert.alert(
        "Delivery Location Set",
        "Blue pin placed! Both locations are now set. You can tap 'Confirm Locations' or reset to change them.",
        [{ text: "OK" }]
      );
    }
    // If both are set, user needs to reset first
    else {
      Alert.alert(
        "Both Locations Set",
        "Please use 'Reset Locations' button to select new locations.",
        [{ text: "OK" }]
      );
    }
  };

  const handleConfirm = () => {
    if (!pickupLocation || !deliveryLocation) {
      Alert.alert(
        "Missing Locations",
        "Please mark both pickup (green pin) and delivery (blue pin) locations on the map.",
        [{ text: "OK" }]
      );
      return;
    }

    onLocationsSelected(pickupLocation, deliveryLocation);
    handleClose();
  };

  const handleReset = () => {
    setPickupLocation(null);
    setDeliveryLocation(null);
  };

  const handleClose = () => {
    // Keep the locations if they were set
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-white mt-12 rounded-t-3xl overflow-hidden">
          {/* Header */}
          <View className="bg-white border-b border-gray-200 p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-gray-900">
                Select Locations
              </Text>
              <Pressable
                onPress={handleClose}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#374151" />
              </Pressable>
            </View>

            {/* Instructions */}
            <View className="bg-blue-50 p-3 rounded-lg mb-2">
              <Text className="text-sm text-blue-900 font-medium mb-1">
                📍 How to mark locations:
              </Text>
              <Text className="text-xs text-blue-800">
                1. Tap on the map to place <Text className="font-bold text-green-700">green pin</Text> (pickup location - seller)
              </Text>
              <Text className="text-xs text-blue-800">
                2. Tap again to place <Text className="font-bold text-blue-700">blue pin</Text> (delivery location - buyer)
              </Text>
            </View>

            {/* Status indicators */}
            <View className="flex-row gap-2">
              <View
                className={`flex-1 p-2 rounded-lg ${
                  pickupLocation ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-3 h-3 rounded-full mr-2 ${
                      pickupLocation ? "bg-green-600" : "bg-gray-400"
                    }`}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      pickupLocation ? "text-green-900" : "text-gray-600"
                    }`}
                  >
                    Pickup {pickupLocation ? "✓" : ""}
                  </Text>
                </View>
              </View>

              <View
                className={`flex-1 p-2 rounded-lg ${
                  deliveryLocation ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-3 h-3 rounded-full mr-2 ${
                      deliveryLocation ? "bg-blue-600" : "bg-gray-400"
                    }`}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      deliveryLocation ? "text-blue-900" : "text-gray-600"
                    }`}
                  >
                    Delivery {deliveryLocation ? "✓" : ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* Map Type Toggle */}
            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={() => setMapType('standard')}
                className={`flex-1 py-2 px-3 rounded-lg border ${mapType === 'standard' ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-300'}`}
              >
                <Text className={`text-xs font-medium text-center ${mapType === 'standard' ? 'text-blue-700' : 'text-gray-600'}`}>
                  Standard
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMapType('satellite')}
                className={`flex-1 py-2 px-3 rounded-lg border ${mapType === 'satellite' ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-300'}`}
              >
                <Text className={`text-xs font-medium text-center ${mapType === 'satellite' ? 'text-blue-700' : 'text-gray-600'}`}>
                  Satellite
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMapType('hybrid')}
                className={`flex-1 py-2 px-3 rounded-lg border ${mapType === 'hybrid' ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-300'}`}
              >
                <Text className={`text-xs font-medium text-center ${mapType === 'hybrid' ? 'text-blue-700' : 'text-gray-600'}`}>
                  Hybrid
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Map */}
          <View className="flex-1 relative">
            <MapView
              provider={PROVIDER_GOOGLE}
              mapType={mapType}
              style={{ flex: 1 }}
              region={mapRegion}
              onRegionChangeComplete={setMapRegion}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton
            >
              {/* Green marker for pickup location (seller) */}
              {pickupLocation && (
                <Marker
                  coordinate={{
                    latitude: pickupLocation.latitude,
                    longitude: pickupLocation.longitude,
                  }}
                  pinColor="green"
                  title="Pickup Location (Seller)"
                  description={pickupLocation.address || "Tap to set pickup point"}
                >
                  <View className="items-center">
                    <View className="bg-green-600 w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg">
                      <Ionicons name="location" size={24} color="white" />
                    </View>
                    <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-green-600 -mt-1" />
                  </View>
                </Marker>
              )}

              {/* Blue marker for delivery location (buyer) */}
              {deliveryLocation && (
                <Marker
                  coordinate={{
                    latitude: deliveryLocation.latitude,
                    longitude: deliveryLocation.longitude,
                  }}
                  pinColor="blue"
                  title="Delivery Location (Buyer)"
                  description={deliveryLocation.address || "Tap to set delivery point"}
                >
                  <View className="items-center">
                    <View className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg">
                      <Ionicons name="location" size={24} color="white" />
                    </View>
                    <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-600 -mt-1" />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Loading indicator */}
            {loadingAddress && (
              <View className="absolute top-4 left-0 right-0 items-center">
                <View className="bg-white px-4 py-2 rounded-full shadow-lg flex-row items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text className="ml-2 text-sm text-gray-700">
                    Getting address...
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="bg-white border-t border-gray-200 p-4">
            {/* Location addresses */}
            {(pickupLocation || deliveryLocation) && (
              <View className="mb-3 space-y-2">
                {pickupLocation && (
                  <View className="bg-green-50 p-3 rounded-lg">
                    <Text className="text-xs font-semibold text-green-900 mb-1">
                      🟢 PICKUP (Seller Location)
                    </Text>
                    <Text className="text-xs text-green-800 leading-4">
                      {pickupLocation.address || "Loading address..."}
                    </Text>
                  </View>
                )}
                {deliveryLocation && (
                  <View className="bg-blue-50 p-3 rounded-lg">
                    <Text className="text-xs font-semibold text-blue-900 mb-1">
                      🔵 DELIVERY (Buyer Location)
                    </Text>
                    <Text className="text-xs text-blue-800 leading-4">
                      {deliveryLocation.address || "Loading address..."}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View className="flex-row gap-3">
              {/* Reset Button */}
              {(pickupLocation || deliveryLocation) && (
                <Pressable
                  onPress={handleReset}
                  className="flex-1 bg-gray-200 py-3 rounded-lg items-center"
                >
                  <Text className="text-gray-900 font-semibold text-base">
                    Reset Locations
                  </Text>
                </Pressable>
              )}

              {/* Confirm Button */}
              <Pressable
                onPress={handleConfirm}
                disabled={!pickupLocation || !deliveryLocation}
                className={`flex-1 py-3 rounded-lg items-center ${
                  pickupLocation && deliveryLocation
                    ? "bg-green-600"
                    : "bg-gray-300"
                }`}
              >
                <Text className="text-white font-semibold text-base">
                  Confirm Locations
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
