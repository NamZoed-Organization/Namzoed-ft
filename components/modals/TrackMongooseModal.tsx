import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    Text,
    View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

type LatLng = { latitude: number; longitude: number };

/** Fetch a road-following route from OSRM (free, no API key). Falls back to straight line. */
async function fetchOSRMRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length > 0) {
      return data.routes[0].geometry.coordinates.map(
        ([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon }),
      );
    }
  } catch (e) {
  }
  return [from, to];
}

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
  const [routeToPickup, setRouteToPickup] = useState<LatLng[]>([]);
  const [routePickupToDelivery, setRoutePickupToDelivery] = useState<LatLng[]>([]);
  const mapRef = useRef<MapView>(null);

  const pickup: LatLng = {
    latitude: booking.pickup_latitude,
    longitude: booking.pickup_longitude,
  };
  const delivery: LatLng = {
    latitude: booking.delivery_latitude,
    longitude: booking.delivery_longitude,
  };

  // Fetch the static pickup→delivery road route once when the modal opens
  useEffect(() => {
    if (!visible) return;
    fetchOSRMRoute(pickup, delivery).then(setRoutePickupToDelivery);
  }, [visible, booking.id]);

  // Re-fetch mongoose→pickup road route whenever mongoose moves
  useEffect(() => {
    if (!mongooseLocation) return;
    const mongoosePt: LatLng = {
      latitude: mongooseLocation.latitude,
      longitude: mongooseLocation.longitude,
    };
    fetchOSRMRoute(mongoosePt, pickup).then(setRouteToPickup);
  }, [mongooseLocation]);

  // Real-time location subscription + initial fetch
  useEffect(() => {
    if (!visible) return;
    fetchMongooseLocation();

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
          if (payload.new) {
            setMongooseLocation({
              latitude: (payload.new as any).latitude,
              longitude: (payload.new as any).longitude,
              timestamp: (payload.new as any).updated_at,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, booking.id]);

  const fetchMongooseLocation = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('mongoose_locations')
        .select('*')
        .eq('booking_id', booking.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setMongooseLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.updated_at,
        });
      } else {
        setMongooseLocation(null);
      }
    } catch {
      setMongooseLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const getMapRegion = () => {
    const pts: LatLng[] = [pickup, delivery];
    if (mongooseLocation) {
      pts.push({ latitude: mongooseLocation.latitude, longitude: mongooseLocation.longitude });
    }
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.02),
    };
  };

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            marginTop: 48,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}
        >
          {/* ── Header ──────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: 'white',
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: '700', color: '#111827' }}>
                  Track Mongoose
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Live delivery tracking
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{ backgroundColor: '#f3f4f6', padding: 8, borderRadius: 20 }}
              >
                <Ionicons name="close" size={22} color="#374151" />
              </Pressable>
            </View>

            {/* Date badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f0f9ff',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                alignSelf: 'flex-start',
                marginBottom: 10,
              }}
            >
              <Ionicons name="calendar-outline" size={13} color="#0369a1" />
              <Text style={{ fontSize: 12, color: '#0369a1', fontWeight: '500', marginLeft: 5 }}>
                {booking.booking_date} · {booking.booking_time}
              </Text>
            </View>

            {/* Legend */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#16a34a', marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Pickup</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#1d4ed8', marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Delivery</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#f97316', marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Mongoose</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 16, height: 3, backgroundColor: '#f97316', borderRadius: 2, marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Live route</Text>
              </View>
            </View>
          </View>

          {/* ── Map ─────────────────────────────────────────── */}
          <View style={{ flex: 1, position: 'relative' }}>
            {loading ? (
              <View
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}
              >
                <ActivityIndicator size="large" color="#094569" />
                <Text style={{ color: '#6b7280', marginTop: 12 }}>Loading location...</Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={{ flex: 1 }}
                region={getMapRegion()}
                showsUserLocation
                showsMyLocationButton
              >
                {/* Pickup marker — green */}
                <Marker
                  coordinate={pickup}
                  title="Pickup Location"
                  description={booking.pickup_address}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#16a34a',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3,
                      borderColor: 'white',
                    }}
                  >
                    <Ionicons name="arrow-up-circle" size={20} color="white" />
                  </View>
                </Marker>

                {/* Delivery marker — blue */}
                <Marker
                  coordinate={delivery}
                  title="Delivery Location"
                  description={booking.delivery_address}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#1d4ed8',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3,
                      borderColor: 'white',
                    }}
                  >
                    <Ionicons name="flag" size={18} color="white" />
                  </View>
                </Marker>

                {/* Mongoose marker — orange bike */}
                {mongooseLocation && (
                  <Marker
                    coordinate={{
                      latitude: mongooseLocation.latitude,
                      longitude: mongooseLocation.longitude,
                    }}
                    title="Mongoose"
                    description={`Updated: ${formatTimestamp(mongooseLocation.timestamp)}`}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#f97316',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: 'white',
                      }}
                    >
                      <Ionicons name="bicycle" size={22} color="white" />
                    </View>
                  </Marker>
                )}

                {/* Road route: mongoose → pickup (orange solid) */}
                {routeToPickup.length > 1 && (
                  <Polyline
                    coordinates={routeToPickup}
                    strokeColor="#f97316"
                    strokeWidth={4}
                  />
                )}

                {/* Road route: pickup → delivery (blue dashed) */}
                {routePickupToDelivery.length > 1 && (
                  <Polyline
                    coordinates={routePickupToDelivery}
                    strokeColor="#1d4ed8"
                    strokeWidth={3}
                    lineDashPattern={[8, 5]}
                  />
                )}
              </MapView>
            )}

            {/* Status card overlaid on bottom of map */}
            {!loading && (
              <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
                {mongooseLocation ? (
                  <View
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 12,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.12,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#f97316',
                        marginRight: 10,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                        Mongoose is on the way
                      </Text>
                      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        Updated {formatTimestamp(mongooseLocation.timestamp)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={fetchMongooseLocation}
                      style={{
                        backgroundColor: '#f0f9ff',
                        padding: 8,
                        borderRadius: 8,
                        marginLeft: 8,
                      }}
                    >
                      <Ionicons name="refresh" size={18} color="#0369a1" />
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: '#fffbeb',
                      borderWidth: 1.5,
                      borderColor: '#fcd34d',
                      borderRadius: 12,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="time-outline" size={20} color="#d97706" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400e' }}>
                        Waiting for mongoose…
                      </Text>
                      <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                        Mongoose hasn't started sharing location yet
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Address panel ───────────────────────────────── */}
          <View
            style={{
              backgroundColor: 'white',
              borderTopWidth: 1,
              borderTopColor: '#e5e7eb',
              padding: 14,
              gap: 8,
            }}
          >
            <View
              style={{
                backgroundColor: '#f0fdf4',
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#bbf7d0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a', marginRight: 7 }} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#14532d', letterSpacing: 0.5 }}>
                  PICKUP
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#166534', marginLeft: 14 }}>
                {booking.pickup_address ||
                  `${booking.pickup_latitude.toFixed(5)}, ${booking.pickup_longitude.toFixed(5)}`}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: '#eff6ff',
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#bfdbfe',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#1d4ed8', marginRight: 7 }} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e3a8a', letterSpacing: 0.5 }}>
                  DELIVERY
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#1e40af', marginLeft: 14 }}>
                {booking.delivery_address ||
                  `${booking.delivery_latitude.toFixed(5)}, ${booking.delivery_longitude.toFixed(5)}`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

