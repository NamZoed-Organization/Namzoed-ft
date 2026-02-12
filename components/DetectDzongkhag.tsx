import { useDzongkhag } from "@/contexts/DzongkhagContext";
import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
import { clamp, useResponsive } from "@/utils/responsive";
import { BlurView } from "expo-blur";
import { MapPin, RefreshCw, Settings, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
  const [isLocationLabelExpanded, setIsLocationLabelExpanded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const mapRef = useRef<MapView>(null);
  const isMountedRef = useRef(true);
  const dzongkhagChangeTimerRef = useRef<any>(null);
  const locationLabelAnim = useRef(new Animated.Value(0)).current;
  const hideLocationLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { ms, vs, wp, hp } = useResponsive();
  const triggerPaddingY = clamp(vs(8), 6, 12);
  const triggerIconSize = clamp(ms(20), 18, 24);
  const labelGap = clamp(ms(6), 4, 8);
  const labelMaxWidth = clamp(wp(28), 96, 150);
  const labelFontSize = clamp(ms(14), 12, 16);
  const overlayTopMargin = clamp(vs(70), 52, 90);
  const overlayPaddingX = clamp(wp(6), 16, 28);
  const floatingButtonPadding = clamp(ms(14), 12, 18);
  const floatingButtonIconSize = clamp(ms(24), 20, 28);
  const floatingButtonsGap = clamp(ms(24), 16, 28);
  const floatingButtonsMarginBottom = clamp(vs(24), 18, 30);
  const modalHeight = clamp(hp(74), 460, 700);
  const modalRadius = clamp(ms(40), 28, 46);
  const modalBottomPaddingX = clamp(wp(4), 12, 20);
  const dzongkhagTextSize = clamp(ms(18), 16, 22);
  const enableLocationTextSize = clamp(ms(14), 13, 17);
  const enableLocationGap = clamp(ms(8), 6, 10);

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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        if (!isMountedRef.current) return;
        setDotCount((prev) => (prev + 1) % 4);
      }, 400);
    } else {
      if (isMountedRef.current) setDotCount(0);
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
      if (hideLocationLabelTimerRef.current) {
        clearTimeout(hideLocationLabelTimerRef.current);
      }
    };
  }, []);

  const animateLocationLabel = (show: boolean) => {
    Animated.timing(locationLabelAnim, {
      toValue: show ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const handleHeaderLocationPress = () => {
    if (isLocationLabelExpanded) {
      if (hideLocationLabelTimerRef.current) {
        clearTimeout(hideLocationLabelTimerRef.current);
        hideLocationLabelTimerRef.current = null;
      }
      animateLocationLabel(false);
      setIsLocationLabelExpanded(false);
      setShowOverlay(true);
      return;
    }

    animateLocationLabel(true);
    setIsLocationLabelExpanded(true);
    if (hideLocationLabelTimerRef.current) {
      clearTimeout(hideLocationLabelTimerRef.current);
    }
    hideLocationLabelTimerRef.current = setTimeout(() => {
      animateLocationLabel(false);
      if (isMountedRef.current) {
        setIsLocationLabelExpanded(false);
      }
      hideLocationLabelTimerRef.current = null;
    }, 2200);
  };

  return (
    <>
      {/* HEADER BUTTON: Shows stored name immediately, no "Auto-detect" */}
      <TouchableOpacity
        onPress={handleHeaderLocationPress}
        onLongPress={() => setShowOverlay(true)}
        activeOpacity={0.7}
        className="flex-row items-center justify-end"
        style={{ paddingVertical: triggerPaddingY }}
      >
        <View className="flex-row items-center">
          <MapPin
            size={triggerIconSize}
            color={accessDenied ? "#ef4444" : "#4b5563"}
          />
          <Animated.View
            style={{
              marginLeft: locationLabelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, labelGap],
              }),
              maxWidth: locationLabelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, labelMaxWidth],
              }),
              opacity: locationLabelAnim,
            }}
          >
            <Text
              numberOfLines={1}
              className={`text-sm font-medium ${
                accessDenied ? "text-red-500" : "text-gray-600"
              }`}
              style={{ fontSize: labelFontSize }}
            >
              {loading
                ? `Detecting${".".repeat(dotCount)}`
                : dzongkhag ?? "Location off"}
            </Text>
          </Animated.View>
        </View>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showOverlay}
        onRequestClose={() => setShowOverlay(false)}
      >
        <BlurView intensity={120} tint="light" style={StyleSheet.absoluteFill}>
          <View
            className="flex-1 justify-start items-center"
            style={{ marginTop: overlayTopMargin, paddingHorizontal: overlayPaddingX }}
          >
            {/* TOP FLOATING BUTTONS */}
            <View
              className="flex-row items-center justify-center"
              style={{
                marginBottom: floatingButtonsMarginBottom,
                columnGap: floatingButtonsGap,
              }}
            >
              <TouchableOpacity
                onPress={refresh}
                disabled={loading}
                className="bg-white rounded-full shadow-xl border border-gray-100"
                style={{ padding: floatingButtonPadding }}
              >
                <RefreshCw
                  size={floatingButtonIconSize}
                  color={loading ? "#9ca3af" : "#3b82f6"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowOverlay(false)}
                className="bg-white rounded-full shadow-xl border border-gray-100"
                style={{ padding: floatingButtonPadding }}
              >
                <X size={floatingButtonIconSize} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {/* MAIN SOLID MODAL */}
            <View
              className="bg-white w-full overflow-hidden shadow-2xl border border-gray-50"
              style={{ height: modalHeight, borderRadius: modalRadius }}
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
                        if (isMountedRef.current) {
                          setCurrentLocation(newLocation);
                        }

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
                className="justify-center items-center"
                style={{ height: "10%", paddingHorizontal: modalBottomPaddingX }}
              >
                {accessDenied ? (
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openSettings();
                      setShowOverlay(false);
                    }}
                    className="flex-row items-center"
                    style={{ columnGap: enableLocationGap }}
                  >
                    <Settings size={clamp(ms(16), 14, 20)} color="#ef4444" />
                    <Text
                      className="text-red-500 font-semibold"
                      style={{ fontSize: enableLocationTextSize }}
                    >
                      Enable Location
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    className="font-bold text-gray-900 text-center"
                    style={{ fontSize: dzongkhagTextSize }}
                  >
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
