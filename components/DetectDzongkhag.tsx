import { useDzongkhag } from "@/contexts/DzongkhagContext";
import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
import { BlurView } from "expo-blur";
import { MapPin, RefreshCw, Settings, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from "react-native-maps";

export default function DetectDzongkhag() {
  const {
    name: dzongkhag,
    loading,
    accessDenied,
    location,
    refresh,
  } = useDzongkhag();
  const { currentUser } = useUser();
  const [dotCount, setDotCount] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const mapRef = useRef<MapView>(null);
  const dzongkhagChangeTimerRef = useRef<any>(null);

  // Helper function to calculate distance between two coordinates
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate nearest dzongkhag from coordinates
  const calculateDzongkhag = (lat: number, lon: number): string => {
    let nearest = dzongkhagCenters[0];
    let minDist = Infinity;

    for (const dz of dzongkhagCenters) {
      const d = getDistance(lat, lon, dz.lat, dz.lon);
      if (d < minDist) {
        minDist = d;
        nearest = dz;
      }
    }

    let detectedName = nearest.name;
    if (detectedName === "Phuentsholing") detectedName = "Chhukha";
    if (detectedName === "Gelephu") detectedName = "Sarpang";

    return detectedName;
  };

  // Handle dot animation for loading state
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => setDotCount((prev) => (prev + 1) % 4), 400);
    } else {
      setDotCount(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Update map region when current location changes
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  }, [currentLocation]);

  // Trigger location detection when modal opens (if no saved location)
  useEffect(() => {
    if (showOverlay && !location && !loading) {
      refresh(); // Detect coordinates
    }
  }, [showOverlay, location, loading, refresh]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dzongkhagChangeTimerRef.current) {
        clearTimeout(dzongkhagChangeTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* HEADER BUTTON: Shows stored name immediately, no "Auto-detect" */}
      <TouchableOpacity
        onPress={() => setShowOverlay(true)}
        activeOpacity={0.7}
        className="flex-row items-center justify-end py-2"
      >
        <View className="flex-row items-center">
          <MapPin size={16} color={accessDenied ? "#ef4444" : "#4b5563"} />
          <Text
            className={`text-sm ml-1 font-medium ${
              accessDenied ? "text-red-500" : "text-gray-600"
            }`}
          >
            {loading
              ? `Detecting${".".repeat(dotCount)}`
              : dzongkhag ?? "Location off"}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showOverlay}
        onRequestClose={() => setShowOverlay(false)}
      >
        <BlurView intensity={120} tint="light" style={StyleSheet.absoluteFill}>
          <View className="flex-1 justify-start items-center mt-20 px-6">
            {/* TOP FLOATING BUTTONS */}
            <View className="flex-row items-center justify-center mb-6 gap-x-6">
              <TouchableOpacity
                onPress={refresh}
                disabled={loading}
                className="bg-white rounded-full p-4 shadow-xl border border-gray-100"
              >
                <RefreshCw size={24} color={loading ? "#9ca3af" : "#3b82f6"} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowOverlay(false)}
                className="bg-white rounded-full p-4 shadow-xl border border-gray-100"
              >
                <X size={24} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {/* MAIN SOLID MODAL */}
            <View
              className="bg-white w-full rounded-[40px] overflow-hidden shadow-2xl border border-gray-50"
              style={{ height: 600 }}
            >
              {/* MAP VIEW - 90% */}
              <View style={{ height: "90%" }} className="w-full bg-gray-200">
                {location || currentLocation || loading ? (
                  <MapView
                    ref={mapRef}
                    provider={
                      Platform.OS === "android"
                        ? PROVIDER_GOOGLE
                        : PROVIDER_DEFAULT
                    }
                    style={{ flex: 1 }}
                    showsUserLocation={true}
                    followsUserLocation={true}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    showsScale={true}
                    region={currentLocation ? {
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    } : undefined}
                    initialRegion={{
                      latitude: currentLocation?.latitude || location?.latitude || 27.4728,
                      longitude: currentLocation?.longitude || location?.longitude || 89.6393,
                      latitudeDelta: 0.5,
                      longitudeDelta: 0.5,
                    }}
                    onUserLocationChange={(event) => {
                      if (event.nativeEvent.coordinate) {
                        const { latitude, longitude } = event.nativeEvent.coordinate;
                        const newLocation = { latitude, longitude };

                        // Update avatar marker position immediately
                        setCurrentLocation(newLocation);

                        // Calculate dzongkhag from current GPS coordinates
                        const currentDzongkhag = calculateDzongkhag(latitude, longitude);

                        // Compare with saved dzongkhag
                        if (currentDzongkhag !== dzongkhag) {
                          // Dzongkhag has changed - start debounce timer
                          if (dzongkhagChangeTimerRef.current) {
                            clearTimeout(dzongkhagChangeTimerRef.current);
                          }

                          dzongkhagChangeTimerRef.current = setTimeout(() => {
                            // After 15 seconds of stable change, trigger database update
                            console.log(`Dzongkhag changed: ${dzongkhag} → ${currentDzongkhag}`);
                            refresh(); // This will update database with new location + dzongkhag
                          }, 15000);
                        } else {
                          // Same dzongkhag - clear any pending timer
                          if (dzongkhagChangeTimerRef.current) {
                            clearTimeout(dzongkhagChangeTimerRef.current);
                            dzongkhagChangeTimerRef.current = null;
                          }
                        }
                      }
                    }}
                  >
                    {currentLocation && (
                      <Marker
                        coordinate={{
                          latitude: currentLocation.latitude,
                          longitude: currentLocation.longitude,
                        }}
                        title={dzongkhag || "Your Location"}
                        description="Current detected location"
                      >
                        <View style={styles.markerContainer}>
                          <View style={styles.pinBackground}>
                            <View style={styles.profileContainer}>
                              {currentUser?.avatar_url ? (
                                <Image
                                  source={{ uri: currentUser.avatar_url }}
                                  style={styles.profileImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.defaultAvatar}>
                                  <Text style={styles.avatarText}>
                                    {currentUser?.name?.charAt(0).toUpperCase() ||
                                      "?"}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.markerPointer} />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-gray-500 text-center">
                      No location available
                    </Text>
                  </View>
                )}
              </View>

              {/* DZONGKHAG DISPLAY - 10% */}
              <View
                style={{ height: "10%" }}
                className="justify-center items-center px-4"
              >
                {accessDenied ? (
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openSettings();
                      setShowOverlay(false);
                    }}
                    className="flex-row items-center"
                  >
                    <Settings size={16} color="#ef4444" />
                    <Text className="text-red-500 font-semibold ml-2">
                      Enable Location
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-lg font-bold text-gray-900 text-center">
                    {loading
                      ? `Detecting${".".repeat(dotCount)}`
                      : dzongkhag || "Unknown Area"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinBackground: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  profileContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  defaultAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3b82f6",
  },
  markerPointer: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 15,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#3b82f6",
    marginTop: -2,
  },
});
