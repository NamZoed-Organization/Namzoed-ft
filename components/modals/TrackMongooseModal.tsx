import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

interface TrackMongooseModalProps {
  visible: boolean;
  onClose: () => void;
  booking: {
    id: string;
    pickup_latitude: number;
    pickup_longitude: number;
    pickup_address?: string;
    delivery_latitude: number;
    delivery_longitude: number;
    delivery_address?: string;
    booking_date: string;
    booking_time: string;
  };
}

interface MongooseLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export default function TrackMongooseModal({
  visible,
  onClose,
  booking,
}: TrackMongooseModalProps) {
  const [mongooseLocation, setMongooseLocation] = useState<MongooseLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [mapRegion, setMapRegion] = useState({
    latitude: booking.pickup_latitude,
    longitude: booking.pickup_longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    if (!visible) return;

    console.log('🗺️ TrackMongooseModal opened for booking:', booking.id);

    // Fetch initial mongoose location
    fetchMongooseLocation();

    // Subscribe to real-time location updates
    console.log('📡 Subscribing to mongoose location updates...');
    const channel = supabase
      .channel(`mongoose_location:${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mongoose_locations',
          filter: `booking_id=eq.${booking.id}`,
        },
        (payload) => {
          console.log('🔔 Mongoose location update received:', payload);
          if (payload.new) {
            const newLocation = {
              latitude: (payload.new as any).latitude,
              longitude: (payload.new as any).longitude,
              timestamp: (payload.new as any).updated_at,
            };
            console.log('📍 Setting new mongoose location:', newLocation);
            setMongooseLocation(newLocation);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from mongoose location updates');
      supabase.removeChannel(channel);
    };
  }, [visible, booking.id]);

  const fetchMongooseLocation = async () => {
    try {
      console.log('🔍 Fetching mongoose location for booking:', booking.id);
      setLoading(true);
      const { data, error } = await supabase
        .from('mongoose_locations')
        .select('*')
        .eq('booking_id', booking.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log('⚠️ No mongoose location found yet:', error.message);
        // Don't set a default location - wait for actual GPS data
        setMongooseLocation(null);
      } else if (data) {
        console.log('✅ Mongoose location found:', data);
        setMongooseLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.updated_at,
        });
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMapRegion = () => {
    if (!mongooseLocation) return mapRegion;

    // Calculate center point between mongoose, pickup, and delivery
    const latitudes = [
      mongooseLocation.latitude,
      booking.pickup_latitude,
      booking.delivery_latitude,
    ];
    const longitudes = [
      mongooseLocation.longitude,
      booking.pickup_longitude,
      booking.delivery_longitude,
    ];

    const centerLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
    const centerLng = longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length;

    const maxLat = Math.max(...latitudes);
    const minLat = Math.min(...latitudes);
    const maxLng = Math.max(...longitudes);
    const minLng = Math.min(...longitudes);

    const latDelta = (maxLat - minLat) * 1.5; // Add 50% padding
    const lngDelta = (maxLng - minLng) * 1.5;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.02), // Minimum delta
      longitudeDelta: Math.max(lngDelta, 0.02),
    };
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-white mt-12 rounded-t-3xl overflow-hidden">
          {/* Header */}
          <View className="bg-white border-b border-gray-200 p-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900">
                  Track Mongoose
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  Live location tracking
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#374151" />
              </Pressable>
            </View>

            {/* Booking info */}
            <View className="bg-blue-50 p-3 rounded-lg">
              <View className="flex-row items-center">
                <Ionicons name="calendar" size={16} color="#1e40af" />
                <Text className="text-sm text-blue-900 font-medium ml-2">
                  {booking.booking_date} at {booking.booking_time}
                </Text>
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
            {loading ? (
              <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#10b981" />
                <Text className="text-gray-600 mt-3">Loading location...</Text>
              </View>
            ) : (
              <MapView
                provider={PROVIDER_GOOGLE}
                mapType={mapType}
                style={{ flex: 1 }}
                region={getMapRegion()}
                showsUserLocation
                showsMyLocationButton
              >
                {/* Pickup location (green pin) */}
                <Marker
                  coordinate={{
                    latitude: booking.pickup_latitude,
                    longitude: booking.pickup_longitude,
                  }}
                  title="Pickup Location"
                  description={booking.pickup_address}
                >
                  <View className="items-center">
                    <View className="bg-green-600 w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg">
                      <Ionicons name="location" size={24} color="white" />
                    </View>
                    <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-green-600 -mt-1" />
                  </View>
                </Marker>

                {/* Delivery location (blue pin) */}
                <Marker
                  coordinate={{
                    latitude: booking.delivery_latitude,
                    longitude: booking.delivery_longitude,
                  }}
                  title="Delivery Location"
                  description={booking.delivery_address}
                >
                  <View className="items-center">
                    <View className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg">
                      <Ionicons name="location" size={24} color="white" />
                    </View>
                    <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-600 -mt-1" />
                  </View>
                </Marker>

                {/* Mongoose current location (animated orange pin) */}
                {mongooseLocation && (
                  <Marker
                    coordinate={{
                      latitude: mongooseLocation.latitude,
                      longitude: mongooseLocation.longitude,
                    }}
                    title="Mongoose Location"
                    description={`Last updated: ${formatTimestamp(mongooseLocation.timestamp)}`}
                  >
                    <View className="items-center">
                      <View className="bg-orange-500 w-12 h-12 rounded-full items-center justify-center border-4 border-white shadow-lg">
                        <Text className="text-2xl">🦡</Text>
                      </View>
                      <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-orange-500 -mt-1" />
                    </View>
                  </Marker>
                )}

                {/* Route line from pickup to delivery */}
                <Polyline
                  coordinates={[
                    { latitude: booking.pickup_latitude, longitude: booking.pickup_longitude },
                    { latitude: booking.delivery_latitude, longitude: booking.delivery_longitude },
                  ]}
                  strokeColor="#9ca3af"
                  strokeWidth={3}
                  lineDashPattern={[10, 5]}
                />
              </MapView>
            )}

            {/* Location status indicator */}
            {!loading && (
              <View className="absolute bottom-4 left-4 right-4">
                {mongooseLocation ? (
                  <View className="bg-white rounded-lg shadow-lg p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-orange-500 w-3 h-3 rounded-full animate-pulse mr-2" />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-gray-900">
                            Mongoose is on the way
                          </Text>
                          <Text className="text-xs text-gray-600 mt-0.5">
                            Last updated: {formatTimestamp(mongooseLocation.timestamp)}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={fetchMongooseLocation}
                        className="bg-green-100 p-2 rounded-full ml-2"
                      >
                        <Ionicons name="refresh" size={20} color="#059669" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                    <View className="flex-row items-center">
                      <Ionicons name="information-circle" size={24} color="#d97706" />
                      <View className="flex-1 ml-3">
                        <Text className="text-sm font-semibold text-amber-900">
                          Waiting for mongoose location...
                        </Text>
                        <Text className="text-xs text-amber-700 mt-1">
                          Mongoose hasn't started sharing location yet
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Location Info */}
          <View className="bg-white border-t border-gray-200 p-4">
            <View className="space-y-2">
              <View className="bg-green-50 p-3 rounded-lg">
                <View className="flex-row items-center mb-1">
                  <View className="w-3 h-3 bg-green-600 rounded-full mr-2" />
                  <Text className="text-xs font-bold text-green-900">
                    PICKUP LOCATION
                  </Text>
                </View>
                <Text className="text-xs text-green-800 ml-5">
                  {booking.pickup_address || `${booking.pickup_latitude.toFixed(6)}, ${booking.pickup_longitude.toFixed(6)}`}
                </Text>
              </View>

              <View className="bg-blue-50 p-3 rounded-lg">
                <View className="flex-row items-center mb-1">
                  <View className="w-3 h-3 bg-blue-600 rounded-full mr-2" />
                  <Text className="text-xs font-bold text-blue-900">
                    DELIVERY LOCATION
                  </Text>
                </View>
                <Text className="text-xs text-blue-800 ml-5">
                  {booking.delivery_address || `${booking.delivery_latitude.toFixed(6)}, ${booking.delivery_longitude.toFixed(6)}`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
