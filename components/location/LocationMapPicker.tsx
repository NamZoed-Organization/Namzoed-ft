import MapPinMarker from "@/components/maps/MapPinMarker";
import PopupMessage from "@/components/ui/PopupMessage";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Pressable,
    Text,
    View,
} from "react-native";
import { Platform } from "react-native";
import { androidMapProvider } from "@/utils/mapProvider";
import MapView from "react-native-maps";

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
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [popup, setPopup] = useState<{visible: boolean; type: 'success'|'warning'|'white'; title: string; message: string}>({visible: false, type: 'white', title: '', message: ''});
  const showPopup = (type: 'success'|'warning'|'white', title: string, message: string) => setPopup({visible: true, type, title, message});

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
      showPopup("white", "Pickup Set", "Green pin placed! Now tap to set the delivery location.");
    }
    // If pickup is set but delivery isn't, set delivery (blue pin)
    else if (!deliveryLocation) {
      setDeliveryLocation({
        latitude,
        longitude,
        address,
      });
      showPopup("white", "Delivery Set", "Blue pin placed! Both locations are now set.");
    }
    // If both are set, user needs to reset first
    else {
      showPopup("white", "Locations Ready", "Use 'Reset Locations' to select new locations.");
    }
  };

  const applyPinDrag = async (
    kind: "pickup" | "delivery",
    latitude: number,
    longitude: number,
  ) => {
    const address = await getAddressFromCoordinates(latitude, longitude);
    if (kind === "pickup") {
      setPickupLocation({ latitude, longitude, address });
    } else {
      setDeliveryLocation({ latitude, longitude, address });
    }
  };

  const handleConfirm = () => {
    if (!pickupLocation || !deliveryLocation) {
      showPopup("warning", "Locations Missing", "Please set both pickup and delivery locations on the map.");
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
        {/* Avoid overflow-hidden with MapView on Android (grey map + logo only). */}
        <View className="flex-1 bg-white mt-12 rounded-t-3xl">
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
          <View
            className="flex-1 relative"
            style={
              Platform.OS === "android"
                ? {
                    minHeight: Math.max(280, Dimensions.get("window").height * 0.38),
                  }
                : undefined
            }
            collapsable={false}
          >
            <MapView
              key={Platform.OS === "android" ? `loc-${visible}` : "loc-map"}
              provider={androidMapProvider()}
              mapType={mapType}
              style={{ flex: 1 }}
              initialRegion={defaultRegion}
              onPress={handleMapPress}
              onLongPress={handleMapPress}
              moveOnMarkerPress={false}
              toolbarEnabled={false}
              showsUserLocation
              showsMyLocationButton
            >
              {pickupLocation && (
                <MapPinMarker
                  coordinate={{
                    latitude: pickupLocation.latitude,
                    longitude: pickupLocation.longitude,
                  }}
                  preset="pickup"
                  size={44}
                  title="Pickup (seller)"
                  description={pickupLocation.address || "Drag pin or tap map"}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    void applyPinDrag("pickup", latitude, longitude);
                  }}
                />
              )}

              {deliveryLocation && (
                <MapPinMarker
                  coordinate={{
                    latitude: deliveryLocation.latitude,
                    longitude: deliveryLocation.longitude,
                  }}
                  preset="delivery"
                  size={44}
                  title="Delivery (buyer)"
                  description={deliveryLocation.address || "Drag pin or tap map"}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    void applyPinDrag("delivery", latitude, longitude);
                  }}
                />
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
        <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
          <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
        </Modal>
      </View>
    </Modal>
  );
}
