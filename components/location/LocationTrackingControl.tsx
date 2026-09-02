import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Linking,
    Modal,
    Pressable,
    Switch,
    Text,
    View,
} from "react-native";

/** Heartbeat: still refresh in traffic when movement is tiny. */
const DRIVER_TRACK_MIN_INTERVAL_MS = 8000;
/** Skip redundant DB writes when GPS jitters but driver hasn’t really moved. */
const DRIVER_TRACK_MIN_MOVE_M = 25;

function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface LocationTrackingControlProps {
  bookingId: string;
  bookingUserName: string;
  onClose?: () => void;
}

type PopupAction = {
  label: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export default function LocationTrackingControl({
  bookingId,
  bookingUserName,
  onClose,
}: LocationTrackingControlProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastDbPushRef = useRef<{
    t: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
    actions?: PopupAction[];
  }>({ visible: false, type: "white", title: "", message: "", actions: undefined });
  const showPopup = (
    type: "success" | "warning" | "error" | "white",
    title: string,
    message: string,
    actions?: PopupAction[],
  ) => setPopup({ visible: true, type, title, message, actions });

  useEffect(() => {
    // Check if tracking is already active for this booking
    checkTrackingStatus();

    return () => {
      // Cleanup on unmount
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [bookingId]);

  const checkTrackingStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('mongoose_locations')
        .select('*')
        .eq('booking_id', bookingId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        // Check if last update was within the last 5 minutes (still active)
        const lastUpdate = new Date(data.updated_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (lastUpdate > fiveMinutesAgo) {
          setIsTracking(true);
          setCurrentLocation({
            latitude: data.latitude,
            longitude: data.longitude,
          });
          setLastUpdateTime(data.updated_at);
        }
      }
    } catch (error) {
      console.error('Error checking tracking status:', error);
    }
  };

  const startLocationTracking = async () => {
    try {
      // Request location permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        showPopup(
          'warning',
          'Location Permission Needed',
          'Enable location permission in Settings to share your live location.',
          [
            { label: 'Not now', style: 'cancel' },
            {
              label: 'Open Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      // Get current location first
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Save initial location — buyers/sellers only see updates if this succeeds (RLS + accepted booking).
      const synced = await updateLocationInDatabase(
        location.coords.latitude,
        location.coords.longitude
      );
      if (!synced) {
        showPopup(
          'error',
          'Could not share location',
          'Your position was not saved. Check you are signed in as Mongoose and the booking is accepted, then try again.',
        );
        return;
      }

      const lat0 = location.coords.latitude;
      const lng0 = location.coords.longitude;
      lastDbPushRef.current = { t: Date.now(), lat: lat0, lng: lng0 };

      setCurrentLocation({
        latitude: lat0,
        longitude: lng0,
      });
      setLastUpdateTime(new Date().toISOString());

      // OS hints: ~8s or ~20m — we still throttle DB writes so buyers get “moved or heartbeat” updates.
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: DRIVER_TRACK_MIN_INTERVAL_MS,
          distanceInterval: 20,
        },
        async (newLocation) => {
          const lat = newLocation.coords.latitude;
          const lng = newLocation.coords.longitude;
          setCurrentLocation({ latitude: lat, longitude: lng });
          setLastUpdateTime(new Date().toISOString());

          const now = Date.now();
          const prev = lastDbPushRef.current;
          if (prev) {
            const elapsed = now - prev.t;
            const moved = metersBetween(
              { latitude: prev.lat, longitude: prev.lng },
              { latitude: lat, longitude: lng },
            );
            if (
              elapsed < DRIVER_TRACK_MIN_INTERVAL_MS &&
              moved < DRIVER_TRACK_MIN_MOVE_M
            ) {
              return;
            }
          }

          const prevSnap = lastDbPushRef.current;
          lastDbPushRef.current = { t: now, lat, lng };
          const ok = await updateLocationInDatabase(lat, lng);
          if (!ok) {
            lastDbPushRef.current = prevSnap;
          }
        }
      );

      locationSubscription.current = subscription;
      setIsTracking(true);
      
      showPopup('white', 'Tracking On', `Your location is now being shared for ${bookingUserName}'s delivery.`);
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      showPopup('error', 'Tracking Failed', `Could not start location tracking: ${error}`);
    }
  };

  const stopLocationTracking = () => {
    Alert.alert(
      'Stop Tracking',
      'Are you sure you want to stop sharing your location? The customer will no longer see your real-time location.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            if (locationSubscription.current) {
              locationSubscription.current.remove();
              locationSubscription.current = null;
            }
            lastDbPushRef.current = null;
            setIsTracking(false);
            setCurrentLocation(null);
            showPopup('white', 'Tracking Off', 'Location sharing has been disabled.');
          },
        },
      ]
    );
  };

  const updateLocationInDatabase = async (
    latitude: number,
    longitude: number,
  ): Promise<boolean> => {
    try {
      const { data: existingData } = await supabase
        .from('mongoose_locations')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1)
        .maybeSingle();

      if (existingData) {
        const { error: updateError } = await supabase
          .from('mongoose_locations')
          .update({
            latitude,
            longitude,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingData.id)
          .select();

        if (updateError) {
          console.error('❌ Error updating location:', updateError);
          if (__DEV__) {
            console.warn('[mongoose_locations]', updateError.code, updateError.message);
          }
          return false;
        }
        return true;
      }

      const { error: insertError } = await supabase
        .from('mongoose_locations')
        .insert({
          booking_id: bookingId,
          latitude,
          longitude,
        })
        .select();

      if (insertError) {
        console.error('❌ Error inserting location:', insertError);
        if (__DEV__) {
          console.warn('[mongoose_locations]', insertError.code, insertError.message);
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error updating location in database:', error);
      return false;
    }
  };

  const handleToggle = (value: boolean) => {
    if (value) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <>
      <Pressable
        style={{ borderRadius: 8, borderCurve: "continuous" }}
        onPress={() => setShowModal(true)}
        className="bg-orange-500 px-4 py-2 flex-row items-center"
      >
        <Ionicons name={isTracking ? "navigate" : "navigate-outline"} size={18} color="white" />
        <Text className="text-white font-semibold ml-2">
          {isTracking ? "Tracking Active" : "Start Tracking"}
        </Text>
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="bg-white p-6">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900">
                  Location Tracking
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  {`For ${bookingUserName}'s delivery`}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowModal(false)}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#374151" />
              </Pressable>
            </View>

            {/* Tracking Toggle */}
            <View
              style={{ borderRadius: 8, borderCurve: "continuous" }} className="bg-orange-50 border-2 border-orange-200 p-4 mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text className="text-base font-semibold text-gray-900 mb-1">
                    Share Live Location
                  </Text>
                  <Text className="text-sm text-gray-600">
                    Customer can track your location in real-time
                  </Text>
                </View>
                <Switch
                  value={isTracking}
                  onValueChange={handleToggle}
                  trackColor={{ false: '#d1d5db', true: '#fb923c' }}
                  thumbColor={isTracking ? '#ea580c' : '#f3f4f6'}
                />
              </View>
            </View>

            {/* Status Info */}
            {isTracking && currentLocation && (
              <View
                style={{ borderRadius: 8, borderCurve: "continuous" }} className="bg-green-50 border border-green-200 p-4 mb-4">
                <View className="flex-row items-center mb-2">
                  <View className="bg-green-500 w-3 h-3 rounded-full mr-2" />
                  <Text className="text-sm font-semibold text-green-900">
                    Tracking Active
                  </Text>
                </View>
                <Text className="text-xs text-gray-600 mb-1">
                  Latitude: {currentLocation.latitude.toFixed(6)}
                </Text>
                <Text className="text-xs text-gray-600 mb-1">
                  Longitude: {currentLocation.longitude.toFixed(6)}
                </Text>
                {lastUpdateTime && (
                  <Text className="text-xs text-gray-500 mt-2">
                    Last updated: {formatTime(lastUpdateTime)}
                  </Text>
                )}
              </View>
            )}

            {!isTracking && (
              <View
                style={{ borderRadius: 8, borderCurve: "continuous" }} className="bg-gray-50 border border-gray-200 p-4 mb-4">
                <Text className="text-sm text-gray-600 text-center">
                  Tracking is currently disabled. Enable it to share your location with the customer.
                </Text>
              </View>
            )}

            {/* Info */}
            <View
              style={{ borderRadius: 8, borderCurve: "continuous" }} className="bg-blue-50 p-4">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#2563eb" />
                <View className="flex-1 ml-2">
                  <Text className="text-xs text-blue-900 font-medium mb-1">
                    How it works:
                  </Text>
                  <Text className="text-xs text-blue-800">
                    • Your location updates about every 8 seconds or when you move 20+ meters{'\n'}
                    • Customer sees your live location on their map{'\n'}
                    • Tracking continues in the background{'\n'}
                    • Turn off when delivery is complete
                  </Text>
                </View>
              </View>
            </View>

            {/* Close Button */}
            <Pressable
              style={{ borderRadius: 8, borderCurve: "continuous" }}
              onPress={() => setShowModal(false)}
              className="bg-gray-200 py-3 items-center mt-6"
            >
              <Text className="text-gray-900 font-semibold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          actions={popup.actions}
          onHide={() => setPopup(p => ({ ...p, visible: false, actions: undefined }))}
        />
      </Modal>
    </>
  );
}
