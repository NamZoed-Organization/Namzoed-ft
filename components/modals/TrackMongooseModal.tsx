import MapPinMarker from "@/components/maps/MapPinMarker";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    Text,
    View,
} from "react-native";
import { androidMapProvider } from "@/utils/mapProvider";
import MapView, { Polyline } from "react-native-maps";
import {
  fetchDrivingRoute,
  type LatLng,
} from "@/utils/drivingRoute";

/** Fallback poll if Realtime misses an update; align ~with driver heartbeat (see LocationTrackingControl). */
const TRACK_LOCATION_POLL_MS = 8000;

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

function parseMapCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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
  const routeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickup: LatLng = useMemo(
    () => ({
      latitude: booking.pickup_latitude,
      longitude: booking.pickup_longitude,
    }),
    [booking.pickup_latitude, booking.pickup_longitude],
  );
  const delivery: LatLng = useMemo(
    () => ({
      latitude: booking.delivery_latitude,
      longitude: booking.delivery_longitude,
    }),
    [booking.delivery_latitude, booking.delivery_longitude],
  );

  const initialRegion = useMemo(() => {
    const lats = [pickup.latitude, delivery.latitude];
    const lngs = [pickup.longitude, delivery.longitude];
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.02),
    };
  }, [pickup, delivery]);

  const fetchMongooseLocation = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const { data, error } = await supabase
          .from("mongoose_locations")
          .select("*")
          .eq("booking_id", booking.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          if (__DEV__) {
            console.warn(
              "[TrackMongoose] mongoose_locations fetch failed:",
              error.code,
              error.message,
            );
          }
          if (!silent) setMongooseLocation(null);
        } else if (data) {
          const lat = parseMapCoord(data.latitude);
          const lng = parseMapCoord(data.longitude);
          if (lat == null || lng == null) {
            if (!silent) setMongooseLocation(null);
          } else {
            setMongooseLocation((prev) => {
              if (
                prev &&
                prev.latitude === lat &&
                prev.longitude === lng
              ) {
                return prev;
              }
              return {
                latitude: lat,
                longitude: lng,
                timestamp: data.updated_at,
              };
            });
          }
        } else if (!silent) {
          setMongooseLocation(null);
        }
      } catch {
        if (!silent) setMongooseLocation(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [booking.id],
  );

  useEffect(() => {
    if (!visible) return;
    fetchDrivingRoute(pickup, delivery).then(setRoutePickupToDelivery);
  }, [visible, booking.id, pickup, delivery]);

  useEffect(() => {
    if (!visible || !mongooseLocation) return;
    if (routeDebounceRef.current) clearTimeout(routeDebounceRef.current);
    routeDebounceRef.current = setTimeout(() => {
      routeDebounceRef.current = null;
      fetchDrivingRoute(
        {
          latitude: mongooseLocation.latitude,
          longitude: mongooseLocation.longitude,
        },
        pickup,
      ).then(setRouteToPickup);
    }, 2500);
    return () => {
      if (routeDebounceRef.current) {
        clearTimeout(routeDebounceRef.current);
        routeDebounceRef.current = null;
      }
    };
    // Lat/lng deps only: full mongooseLocation would reset debounce on timestamp-only churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    visible,
    mongooseLocation?.latitude,
    mongooseLocation?.longitude,
    pickup,
  ]);

  useEffect(() => {
    if (!visible) return;

    void fetchMongooseLocation(false);

    const poll = setInterval(() => {
      void fetchMongooseLocation(true);
    }, TRACK_LOCATION_POLL_MS);

    const channel = supabase
      .channel(`mongoose_location_track:${booking.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mongoose_locations",
          filter: `booking_id=eq.${booking.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;
          const lat = parseMapCoord(row.latitude);
          const lng = parseMapCoord(row.longitude);
          if (lat == null || lng == null) return;
          setMongooseLocation((prev) => {
            if (
              prev &&
              prev.latitude === lat &&
              prev.longitude === lng
            ) {
              return prev;
            }
            return {
              latitude: lat,
              longitude: lng,
              timestamp:
                typeof row.updated_at === "string"
                  ? row.updated_at
                  : new Date().toISOString(),
            };
          });
        },
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [visible, booking.id, fetchMongooseLocation]);

  useEffect(() => {
    if (!visible || loading) return;
    const coords: LatLng[] = [pickup, delivery];
    if (mongooseLocation) {
      coords.push({
        latitude: mongooseLocation.latitude,
        longitude: mongooseLocation.longitude,
      });
    }
    const id = requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 90, right: 44, bottom: 200, left: 44 },
        animated: mongooseLocation != null,
      });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng scalars track driver moves without object churn
  }, [
    visible,
    loading,
    mongooseLocation?.latitude,
    mongooseLocation?.longitude,
    pickup,
    delivery,
  ]);

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
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#1C1614', marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Pickup</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#094569', marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Delivery</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#EA580C', marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Mongoose</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 16, height: 3, backgroundColor: '#EA580C', borderRadius: 2, marginRight: 5 }} />
                <Text style={{ fontSize: 11, color: '#374151' }}>Live route</Text>
              </View>
            </View>
          </View>

          {/* ── Map ─────────────────────────────────────────── */}
          <View
            style={{ flex: 1, position: 'relative' }}
            collapsable={false}
          >
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
                provider={androidMapProvider()}
                style={
                  Platform.OS === 'android'
                    ? {
                        flex: 1,
                        minHeight: Math.max(
                          320,
                          Dimensions.get('window').height * 0.38,
                        ),
                      }
                    : { flex: 1, minHeight: 280 }
                }
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton
              >
                <MapPinMarker
                  coordinate={pickup}
                  preset="pickup"
                  size={44}
                  title="Pickup location"
                  description={booking.pickup_address}
                />
                <MapPinMarker
                  coordinate={delivery}
                  preset="delivery"
                  size={44}
                  title="Delivery location"
                  description={booking.delivery_address}
                />
                {mongooseLocation && (
                  <MapPinMarker
                    key="mongoose-driver"
                    coordinate={{
                      latitude: mongooseLocation.latitude,
                      longitude: mongooseLocation.longitude,
                    }}
                    preset="driver"
                    size={48}
                    title="Mongoose"
                    description={`Updated: ${formatTimestamp(mongooseLocation.timestamp)}`}
                    tracksViewChanges={false}
                  />
                )}

                {/* Road route: mongoose → pickup (orange solid) */}
                {routeToPickup.length > 1 && (
                  <Polyline
                    coordinates={routeToPickup}
                    strokeColor="#f97316"
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={false}
                  />
                )}

                {/* Road route: pickup → delivery (blue dashed) */}
                {routePickupToDelivery.length > 1 && (
                  <Polyline
                    coordinates={routePickupToDelivery}
                    strokeColor="#1d4ed8"
                    strokeWidth={3}
                    lineDashPattern={[8, 5]}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={false}
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
                      onPress={() => void fetchMongooseLocation(false)}
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
                        Mongoose has not started sharing location yet
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

