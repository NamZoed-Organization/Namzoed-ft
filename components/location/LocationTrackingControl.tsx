import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    Switch,
    Text,
    View,
} from "react-native";

interface LocationTrackingControlProps {
  bookingId: string;
  bookingUserName: string;
  onClose?: () => void;
}

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
        .single();

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
      console.log('🚀 Starting location tracking for booking:', bookingId);
      
      // Request location permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.log('❌ Location permission denied');
        Alert.alert(
          'Permission Required',
          'Location permission is needed to track your location for deliveries.'
        );
        return;
      }

      console.log('✅ Location permission granted, getting current position...');
      
      // Get current location first
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      console.log('📍 Current position:', location.coords);

      // Save initial location
      await updateLocationInDatabase(
        location.coords.latitude,
        location.coords.longitude
      );

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setLastUpdateTime(new Date().toISOString());

      console.log('👁️ Setting up location watcher...');
      
      // Start watching location updates (every 30 seconds or when moved 50 meters)
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 50, // Or when moved 50 meters
        },
        async (newLocation) => {
          console.log('🔄 New location update:', newLocation.coords);
          setCurrentLocation({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          });
          
          const now = new Date().toISOString();
          setLastUpdateTime(now);

          // Update database
          await updateLocationInDatabase(
            newLocation.coords.latitude,
            newLocation.coords.longitude
          );
        }
      );

      locationSubscription.current = subscription;
      setIsTracking(true);
      
      console.log('✅ Location tracking started successfully');
      
      Alert.alert(
        'Tracking Started',
        `Location tracking is now active for ${bookingUserName}'s delivery. The customer can see your location in real-time.`
      );
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      Alert.alert('Error', `Failed to start location tracking: ${error}`);
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
            setIsTracking(false);
            setCurrentLocation(null);
            Alert.alert('Tracking Stopped', 'Location sharing has been disabled.');
          },
        },
      ]
    );
  };

  const updateLocationInDatabase = async (latitude: number, longitude: number) => {
    try {
      console.log('📍 Updating mongoose location:', { bookingId, latitude, longitude });
      
      // First, try to update existing location
      const { data: existingData, error: fetchError } = await supabase
        .from('mongoose_locations')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1)
        .single();

      if (existingData) {
        // Update existing record
        console.log('✏️ Updating existing location record:', existingData.id);
        const { data: updateData, error: updateError } = await supabase
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
        } else {
          console.log('✅ Location updated successfully:', updateData);
        }
      } else {
        // Insert new record
        console.log('➕ Inserting new location record');
        const { data: insertData, error: insertError } = await supabase
          .from('mongoose_locations')
          .insert({
            booking_id: bookingId,
            latitude,
            longitude,
          })
          .select();

        if (insertError) {
          console.error('❌ Error inserting location:', insertError);
          Alert.alert(
            'Database Error',
            `Failed to save location: ${insertError.message}\n\nPlease ensure the mongoose_locations table exists and RLS policies are configured.`
          );
        } else {
          console.log('✅ Location inserted successfully:', insertData);
        }
      }
    } catch (error) {
      console.error('❌ Error updating location in database:', error);
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
        onPress={() => setShowModal(true)}
        className="bg-orange-500 px-4 py-2 rounded-lg flex-row items-center"
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
          <View className="bg-white rounded-t-3xl p-6">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900">
                  Location Tracking
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  For {bookingUserName}'s delivery
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
            <View className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-4">
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
              <View className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
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
              <View className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <Text className="text-sm text-gray-600 text-center">
                  Tracking is currently disabled. Enable it to share your location with the customer.
                </Text>
              </View>
            )}

            {/* Info */}
            <View className="bg-blue-50 rounded-lg p-4">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#2563eb" />
                <View className="flex-1 ml-2">
                  <Text className="text-xs text-blue-900 font-medium mb-1">
                    How it works:
                  </Text>
                  <Text className="text-xs text-blue-800">
                    • Your location updates every 30 seconds or when you move 50+ meters{'\n'}
                    • Customer sees your live location on their map{'\n'}
                    • Tracking continues in the background{'\n'}
                    • Turn off when delivery is complete
                  </Text>
                </View>
              </View>
            </View>

            {/* Close Button */}
            <Pressable
              onPress={() => setShowModal(false)}
              className="bg-gray-200 py-3 rounded-lg items-center mt-6"
            >
              <Text className="text-gray-900 font-semibold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
