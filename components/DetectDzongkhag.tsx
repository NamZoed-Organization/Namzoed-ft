import { useDzongkhag } from "@/contexts/DzongkhagContext";
import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
import { androidMapProvider } from "@/utils/mapProvider";
import { clamp, useResponsive } from "@/utils/responsive";
import { BlurView } from "expo-blur";
import { MapPin, RefreshCw, Settings, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

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
  const isMountedRef = useRef(true);
  const dzongkhagChangeTimerRef = useRef<any>(null);
  const { ms, vs, wp, hp } = useResponsive();
  const triggerPaddingY = clamp(vs(8), 6, 12);
  const triggerIconSize = clamp(ms(20), 18, 24);
  const labelGap = clamp(ms(6), 4, 8);
  const labelFontSize = clamp(ms(11), 9, 12);
  const overlayTopMargin = clamp(vs(70), 52, 90);
  const overlayPaddingX = clamp(wp(6), 16, 28);
  const floatingButtonPadding = clamp(ms(14), 12, 18);
  const floatingButtonIconSize = clamp(ms(24), 20, 28);
  const floatingButtonsGap = clamp(ms(24), 16, 28);
  const floatingButtonsMarginBottom = clamp(vs(24), 18, 30);
  const modalHeight = clamp(hp(74), 460, 700);
  const mapSectionHeight = Math.round(modalHeight * 0.9);
  const footerSectionHeight = modalHeight - mapSectionHeight;
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
    };
  }, []);

  const handleLocationPress = () => {
    setShowOverlay(true);
  };

  return (
    <>
      {/* HEADER BUTTON: icon-only by default; first tap shows name, second tap opens modal */}
      <TouchableOpacity
        onPress={handleLocationPress}
        activeOpacity={0.7}
        className="flex-row items-center justify-end"
        style={{ paddingVertical: triggerPaddingY }}
      >
        <View className="flex-row items-center">
          <MapPin
            size={triggerIconSize}
            color={accessDenied ? "#ef4444" : "#4b5563"}
          />
          <View style={{ marginLeft: labelGap }}>
            <Text
              numberOfLines={1}
              className={`text-sm font-medium ${
                accessDenied ? "text-red-500" : "text-gray-600"
              }`}
              style={{ fontSize: labelFontSize }}
            >
              {loading
                ? `Detecting${"." .repeat(dotCount)}`
                : dzongkhag ?? "Location off"}
            </Text>
          </View>
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

            {/* MAIN SOLID MODAL — overflow-hidden breaks Google Map tiles on Android */}
            <View
              className="bg-white w-full shadow-2xl border border-gray-50"
              style={{
                height: modalHeight,
                borderRadius: modalRadius,
                ...Platform.select({
                  android: { overflow: "visible" },
                  default: { overflow: "hidden" },
                }),
              }}
            >
              {/* MAP VIEW - 90% (explicit height: % height is unreliable for MapView on Android) */}
              <View
                style={{
                  height: mapSectionHeight,
                  width: "100%",
                  backgroundColor: "#e5e7eb",
                  minHeight:
                    Platform.OS === "android"
                      ? Math.max(320, Dimensions.get("window").height * 0.45)
                      : undefined,
                }}
                className="w-full"
                collapsable={false}
              >
                {location || currentLocation || loading ? (
                  <MapView
                    key={
                      Platform.OS === "android"
                        ? showOverlay
                          ? "dz-map-visible"
                          : "dz-map-hidden"
                        : "dz-map"
                    }
                    ref={mapRef}
                    provider={
                      Platform.OS === "android"
                        ? androidMapProvider()
                        : PROVIDER_DEFAULT
                    }
                    style={{ flex: 1 }}
                    showsUserLocation={true}
                    followsUserLocation={false}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    showsScale={true}
                    toolbarEnabled={false}
                    moveOnMarkerPress={false}
                    initialRegion={{
                      latitude:
                        currentLocation?.latitude ||
                        location?.latitude ||
                        27.4728,
                      longitude:
                        currentLocation?.longitude ||
                        location?.longitude ||
                        89.6393,
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
                        anchor={{ x: 0.5, y: 1 }}
                        title={dzongkhag || "Your Location"}
                        description="Current detected location"
                      >
                        <View style={styles.markerContainer}>
                          <View style={styles.markerShadow}>
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

              {/* DZONGKHAG DISPLAY */}
              <View
                className="justify-center items-center bg-white"
                style={{
                  height: footerSectionHeight,
                  paddingHorizontal: modalBottomPaddingX,
                  borderBottomLeftRadius: modalRadius,
                  borderBottomRightRadius: modalRadius,
                }}
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
  markerShadow: {
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  pinBackground: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#094569",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
  },
  defaultAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    backgroundColor: "#EDE9E2",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#094569",
  },
  markerPointer: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#094569",
    marginTop: -3,
  },
});
