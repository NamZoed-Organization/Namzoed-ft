import LocationTrackingControl from "@/components/location/LocationTrackingControl";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { isMongooseUser, MONGOOSE_EMAIL } from "@/utils/roleCheck";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

interface BookingRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  booking_date: string;
  booking_time: string;
  status: string;
  message?: string;
  created_at: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_address?: string;
}

export default function MongooseDashboard() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState(true);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedBookingForMap, setSelectedBookingForMap] =
    useState<BookingRequest | null>(null);
  const [mapType, setMapType] = useState<"standard" | "satellite" | "hybrid">(
    "standard",
  );
  const debounceTimerRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);

  // Load availability status from database (memoized)
  const loadAvailabilityStatus = useCallback(async () => {
    try {
      // Check if there are any accepted bookings - if yes, mongoose is not available
      const { data: acceptedBookings, error } = await supabase
        .from("booking_requests")
        .select("id")
        .eq("mongoose_email", MONGOOSE_EMAIL)
        .eq("status", "accepted")
        .limit(1);

      if (error) {
        console.error("Error checking availability:", error);
      } else {
        // If there are accepted bookings, mongoose is busy (not available)
        const available = !acceptedBookings || acceptedBookings.length === 0;
        console.log(
          "📊 Mongoose availability status:",
          available ? "AVAILABLE" : "IN PROGRESS",
        );
        setIsAvailable(available);
      }
    } catch (error) {
      console.error("Error loading availability status:", error);
    }
  }, []);

  // Load booking requests from database (memoized)
  const loadBookingRequests = useCallback(async () => {
    try {
      // Check if booking_requests table exists
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("mongoose_email", MONGOOSE_EMAIL)
        .order("created_at", { ascending: false });

      if (error) {
        // Table doesn't exist yet - just log and continue
        if (
          error.code === "PGRST205" ||
          error.message.includes("could not find")
        ) {
          console.log(
            "Info: booking_requests table not created yet. Run the migration first.",
          );
          setBookingRequests([]);
        } else {
          console.error("Error loading bookings:", error);
        }
      } else {
        console.log("Fresh data from database:", data?.length || 0, "bookings");
        setBookingRequests(data || []);
      }
    } catch (error) {
      console.error("Error loading booking requests:", error);
      setBookingRequests([]);
    }
  }, []);

  // Load availability status and booking requests
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadAvailabilityStatus(), loadBookingRequests()]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [loadAvailabilityStatus, loadBookingRequests]);

  // Protected route check - only run once on mount
  useEffect(() => {
    const checkAccess = async () => {
      if (!currentUser || !isMongooseUser(currentUser.email)) {
        Alert.alert(
          "Access Denied",
          "You don't have permission to access this page.",
        );
        router.replace("/(users)");
      } else if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        await loadData();
      }
    };
    checkAccess();
  }, [currentUser, loadData, router]);
  // Real-time subscription for booking changes (with debouncing)
  useEffect(() => {
    if (!currentUser || !isMongooseUser(currentUser.email)) return;

    console.log("🔔 Setting up real-time subscription for mongoose dashboard");

    const channel = supabase
      .channel("mongoose_dashboard_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_requests",
          filter: `mongoose_email=eq.${MONGOOSE_EMAIL}`,
        },
        (payload) => {
          console.log("📨 Booking changed in real-time:", payload.eventType);

          // Debounce the refresh to prevent rapid consecutive updates
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            console.log("🔄 Refreshing data after debounce...");
            loadBookingRequests();
            loadAvailabilityStatus();
          }, 1000); // Wait 1 second before updating
        },
      )
      .subscribe();

    return () => {
      console.log("🔕 Cleaning up real-time subscription");
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentUser, loadBookingRequests, loadAvailabilityStatus]);

  // Toggle availability status
  const toggleAvailability = async (value: boolean) => {
    try {
      setUpdatingStatus(true);

      // Availability is now automatically determined by accepted bookings
      // User cannot manually toggle if there are accepted bookings
      const { data: acceptedBookings } = await supabase
        .from("booking_requests")
        .select("id")
        .eq("mongoose_email", MONGOOSE_EMAIL)
        .eq("status", "accepted")
        .limit(1);

      if (acceptedBookings && acceptedBookings.length > 0 && !value) {
        Alert.alert(
          "Cannot Change Status",
          "You have accepted bookings. Please complete them first by marking them as done.",
        );
      } else {
        setIsAvailable(value);
        Alert.alert(
          "Info",
          "Availability is automatically managed based on accepted bookings.",
        );
      }
    } catch (error) {
      console.error("Error updating availability:", error);
      Alert.alert("Error", "Failed to update availability status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle booking request action
  const handleBookingAction = async (
    bookingId: string,
    action: "accept" | "reject",
  ) => {
    try {
      const { error } = await supabase
        .from("booking_requests")
        .update({ status: action === "accept" ? "accepted" : "rejected" })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating booking:", error);
        Alert.alert("Error", "Failed to update booking request");
      } else {
        Alert.alert(
          "Success",
          `Booking ${action === "accept" ? "accepted" : "rejected"} successfully`,
        );

        // Real-time update: Immediately update availability status
        if (action === "accept") {
          setIsAvailable(false);
          console.log("🔴 Mongoose now IN PROGRESS");
        }

        await loadBookingRequests();
      }
    } catch (error) {
      console.error("Error handling booking action:", error);
    }
  };

  // Handle completing an accepted booking
  const handleCompleteBooking = async (bookingId: string, userName: string) => {
    Alert.alert(
      "Mark as Done",
      `Complete the booking with ${userName}? This will allow them to book again.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Done",
          onPress: async () => {
            try {
              console.log("Attempting to delete booking:", bookingId);

              const { data, error } = await supabase
                .from("booking_requests")
                .delete()
                .eq("id", bookingId)
                .select();

              console.log("Delete response - data:", data, "error:", error);

              if (error) {
                console.error("Error completing booking:", error);
                Alert.alert(
                  "Error",
                  `Failed to complete booking: ${error.message}\nCode: ${error.code}`,
                );
              } else if (!data || data.length === 0) {
                // No rows were deleted - likely RLS policy issue
                console.error(
                  "No rows deleted - possible RLS policy restriction",
                );
                Alert.alert(
                  "Permission Error",
                  "Unable to delete booking. This is likely a database permission issue (RLS policy). Please check your Supabase RLS policies for the booking_requests table.",
                );
              } else {
                console.log(
                  "Booking deleted successfully:",
                  data.length,
                  "row(s)",
                );

                // Reload booking requests first
                console.log("Reloading booking requests...");
                await loadBookingRequests();

                // Check if there are any more accepted bookings
                await loadAvailabilityStatus();
                console.log("🟢 Mongoose availability status updated");

                Alert.alert("Success", "Booking completed successfully");
              }
            } catch (error: any) {
              console.error("Error completing booking:", error);
              Alert.alert(
                "Error",
                `An unexpected error occurred: ${error?.message || "Unknown error"}`,
              );
            }
          },
        },
      ],
    );
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Handle logout
  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            await AsyncStorage.removeItem("currentUser");
            router.replace("/login");
          } catch (error) {
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  const renderBookingItem = ({ item }: { item: BookingRequest }) => (
    <View className="bg-white p-4 mb-3 rounded-lg border border-gray-200 shadow-sm">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {item.user_name}
          </Text>
          <Text className="text-sm text-gray-600">{item.user_email}</Text>
          {item.user_phone && (
            <Text className="text-sm text-gray-600">{item.user_phone}</Text>
          )}
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            item.status === "pending"
              ? "bg-yellow-100"
              : item.status === "accepted"
                ? "bg-green-100"
                : "bg-red-100"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              item.status === "pending"
                ? "text-yellow-800"
                : item.status === "accepted"
                  ? "text-green-800"
                  : "text-red-800"
            }`}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View className="mt-2 mb-3">
        <Text className="text-sm text-gray-700">
          <Text className="font-medium">Date:</Text> {item.booking_date}
        </Text>
        <Text className="text-sm text-gray-700">
          <Text className="font-medium">Time:</Text> {item.booking_time}
        </Text>
        {item.message && (
          <Text className="text-sm text-gray-700 mt-1">
            <Text className="font-medium">Message:</Text> {item.message}
          </Text>
        )}
      </View>

      {/* Location Information */}
      {item.pickup_latitude &&
        item.pickup_longitude &&
        item.delivery_latitude &&
        item.delivery_longitude && (
          <View className="mb-3">
            <Pressable
              onPress={() => setSelectedBookingForMap(item)}
              className="bg-blue-50 border border-blue-200 p-3 rounded-lg"
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Ionicons name="map" size={20} color="#2563eb" />
                  <Text className="ml-2 text-sm font-semibold text-blue-900">
                    Delivery Route
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#2563eb" />
              </View>

              {/* Pickup Location */}
              <View className="bg-green-50 p-2 rounded mb-1">
                <View className="flex-row items-center mb-1">
                  <View className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                  <Text className="text-xs font-bold text-green-900">
                    PICKUP (Seller)
                  </Text>
                </View>
                <Text className="text-xs text-green-800 ml-4">
                  {item.pickup_address ||
                    `${item.pickup_latitude.toFixed(6)}, ${item.pickup_longitude.toFixed(6)}`}
                </Text>
              </View>

              {/* Delivery Location */}
              <View className="bg-blue-50 p-2 rounded">
                <View className="flex-row items-center mb-1">
                  <View className="w-2 h-2 bg-blue-600 rounded-full mr-2" />
                  <Text className="text-xs font-bold text-blue-900">
                    DELIVERY (Buyer)
                  </Text>
                </View>
                <Text className="text-xs text-blue-800 ml-4">
                  {item.delivery_address ||
                    `${item.delivery_latitude.toFixed(6)}, ${item.delivery_longitude.toFixed(6)}`}
                </Text>
              </View>

              <Text className="text-xs text-blue-600 text-center mt-2">
                Tap to view on map
              </Text>
            </Pressable>
          </View>
        )}

      {item.status === "pending" && (
        <View className="flex-row space-x-3">
          <Pressable
            onPress={() => handleBookingAction(item.id, "accept")}
            style={{ backgroundColor: "#094569" }}
            className="flex-1 py-3 rounded-lg items-center"
          >
            {">"}
            <Text className="text-white font-semibold">Accept</Text>
          </Pressable>
          <Pressable
            onPress={() => handleBookingAction(item.id, "reject")}
            className="flex-1 bg-red-600 py-3 rounded-lg items-center"
          >
            <Text className="text-white font-semibold">Reject</Text>
          </Pressable>
        </View>
      )}

      {item.status === "accepted" && (
        <View className="space-y-2">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <LocationTrackingControl
                bookingId={item.id}
                bookingUserName={item.user_name}
              />
            </View>
            <Pressable
              onPress={() => handleCompleteBooking(item.id, item.user_name)}
              style={{ backgroundColor: "#16A34A" }}
              className="flex-1 py-3 rounded-lg items-center flex-row justify-center"
            >
              <Ionicons name="checkmark-done" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {item.status === "rejected" && (
        <View className="flex-row space-x-3">
          <Pressable
            onPress={() => handleBookingAction(item.id, "accept")}
            style={{ backgroundColor: "#094569" }}
            className="flex-1 py-3 rounded-lg items-center flex-row justify-center"
          >
            <Ionicons name="refresh" size={18} color="white" />
            <Text className="text-white font-semibold ml-2">Accept</Text>
          </Pressable>
          <Pressable
            onPress={() => handleCompleteBooking(item.id, item.user_name)}
            className="flex-1 bg-red-600 py-3 rounded-lg items-center flex-row justify-center"
          >
            <Ionicons name="trash" size={18} color="white" />
            <Text className="text-white font-semibold ml-2">Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {loading ? (
        <View className="flex-1 bg-white justify-center items-center">
          <ActivityIndicator size="large" color="#094569" />
          <Text className="mt-4 text-gray-600">Loading dashboard...</Text>
        </View>
      ) : (
        <>
          {/* Header */}
          <View
            style={{ backgroundColor: "#094569" }}
            className="pt-12 pb-6 px-4"
          >
            <View className="flex-row justify-between items-center">
              <Text className="text-2xl font-bold text-white">
                Mongoose Dashboard
              </Text>
              <Pressable
                onPress={handleLogout}
                className="bg-white/20 p-2 rounded-full"
              >
                <Ionicons name="log-out-outline" size={24} color="white" />
              </Pressable>
            </View>
            <Text className="text-white/90 mt-1">
              Welcome, {currentUser?.name || "Mongoose"}
            </Text>
          </View>

          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{ padding: 16 }}
          >
            {/* Availability Status Card */}
            <View className="bg-white p-5 rounded-lg shadow-sm mb-4">
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900 mb-1">
                    Availability Status
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {isAvailable
                      ? "You are currently accepting bookings"
                      : "You are not accepting bookings"}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  {updatingStatus && (
                    <ActivityIndicator
                      size="small"
                      color="#094569"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Switch
                    value={isAvailable}
                    onValueChange={toggleAvailability}
                    trackColor={{ false: "#d1d5db", true: "#6ba3c7" }}
                    thumbColor={isAvailable ? "#094569" : "#f3f4f6"}
                    disabled={updatingStatus}
                  />
                </View>
              </View>
              <View
                style={isAvailable ? { backgroundColor: "#e6f0f5" } : undefined}
                className={`mt-3 p-3 rounded-lg ${!isAvailable ? "bg-gray-50" : ""}`}
              >
                <Text
                  style={isAvailable ? { color: "#094569" } : undefined}
                  className={`text-center font-medium ${!isAvailable ? "text-gray-700" : ""}`}
                >
                  {isAvailable ? "✓ Available for Bookings" : "✗ Not Available"}
                </Text>
              </View>
            </View>

            {/* Booking Requests Section */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-xl font-bold text-gray-900">
                  Booking Requests
                </Text>
                <View
                  style={{ backgroundColor: "#e6f0f5" }}
                  className="px-3 py-1 rounded-full"
                >
                  <Text style={{ color: "#094569" }} className="font-semibold">
                    {bookingRequests.length}
                  </Text>
                </View>
              </View>

              {bookingRequests.length === 0 ? (
                <View className="bg-white p-8 rounded-lg items-center">
                  <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                  <Text className="text-gray-500 mt-3 text-center">
                    No booking requests yet
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={bookingRequests}
                  renderItem={renderBookingItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          </ScrollView>

          {/* Map Modal */}
          <Modal
            visible={!!selectedBookingForMap}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedBookingForMap(null)}
          >
            <View className="flex-1 bg-black/50">
              <View className="flex-1 bg-white mt-12 rounded-t-3xl overflow-hidden">
                {/* Modal Header */}
                <View className="bg-white border-b border-gray-200 p-4">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-xl font-bold text-gray-900">
                        Delivery Route
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {selectedBookingForMap?.user_name}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setSelectedBookingForMap(null)}
                      className="bg-gray-100 p-2 rounded-full"
                    >
                      <Ionicons name="close" size={24} color="#374151" />
                    </Pressable>
                  </View>

                  {/* Legend */}
                  <View className="flex-row gap-3 mt-3">
                    <View className="flex-row items-center">
                      <View className="w-3 h-3 bg-green-600 rounded-full mr-2" />
                      <Text className="text-xs text-gray-700">
                        Pickup (Seller)
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <View className="w-3 h-3 bg-blue-600 rounded-full mr-2" />
                      <Text className="text-xs text-gray-700">
                        Delivery (Buyer)
                      </Text>
                    </View>
                  </View>

                  {/* Map Type Toggle */}
                  <View className="flex-row gap-2 mt-3">
                    <Pressable
                      onPress={() => setMapType("standard")}
                      className={`flex-1 py-2 rounded-lg ${
                        mapType === "standard" ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold text-center ${
                          mapType === "standard"
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        Standard
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMapType("satellite")}
                      className={`flex-1 py-2 rounded-lg ${
                        mapType === "satellite" ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold text-center ${
                          mapType === "satellite"
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        Satellite
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMapType("hybrid")}
                      className={`flex-1 py-2 rounded-lg ${
                        mapType === "hybrid" ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold text-center ${
                          mapType === "hybrid" ? "text-white" : "text-gray-700"
                        }`}
                      >
                        Hybrid
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Map */}
                {selectedBookingForMap &&
                  selectedBookingForMap.pickup_latitude &&
                  selectedBookingForMap.pickup_longitude &&
                  selectedBookingForMap.delivery_latitude &&
                  selectedBookingForMap.delivery_longitude && (
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      mapType={mapType}
                      style={{ flex: 1 }}
                      initialRegion={{
                        latitude:
                          (selectedBookingForMap.pickup_latitude +
                            selectedBookingForMap.delivery_latitude) /
                          2,
                        longitude:
                          (selectedBookingForMap.pickup_longitude +
                            selectedBookingForMap.delivery_longitude) /
                          2,
                        latitudeDelta:
                          Math.abs(
                            selectedBookingForMap.pickup_latitude -
                              selectedBookingForMap.delivery_latitude,
                          ) * 2 || 0.05,
                        longitudeDelta:
                          Math.abs(
                            selectedBookingForMap.pickup_longitude -
                              selectedBookingForMap.delivery_longitude,
                          ) * 2 || 0.05,
                      }}
                      showsUserLocation
                      showsMyLocationButton
                    >
                      {/* Green Marker - Pickup Location */}
                      <Marker
                        coordinate={{
                          latitude: selectedBookingForMap.pickup_latitude,
                          longitude: selectedBookingForMap.pickup_longitude,
                        }}
                        title="Pickup Location (Seller)"
                        description={
                          selectedBookingForMap.pickup_address ||
                          "Seller location"
                        }
                      >
                        <View className="items-center">
                          <View className="bg-green-600 w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg">
                            <Ionicons name="location" size={24} color="white" />
                          </View>
                          <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-green-600 -mt-1" />
                        </View>
                      </Marker>

                      {/* Blue Marker - Delivery Location */}
                      <Marker
                        coordinate={{
                          latitude: selectedBookingForMap.delivery_latitude,
                          longitude: selectedBookingForMap.delivery_longitude,
                        }}
                        title="Delivery Location (Buyer)"
                        description={
                          selectedBookingForMap.delivery_address ||
                          "Buyer location"
                        }
                      >
                        <View className="items-center">
                          <View className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center border-4 border-white shadow-lg">
                            <Ionicons name="location" size={24} color="white" />
                          </View>
                          <View className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-600 -mt-1" />
                        </View>
                      </Marker>
                    </MapView>
                  )}

                {/* Location Details */}
                <View className="bg-white border-t border-gray-200 p-4">
                  <View className="space-y-2">
                    {/* Pickup */}
                    <View className="bg-green-50 border border-green-200 p-3 rounded-lg">
                      <View className="flex-row items-center mb-1">
                        <View className="w-3 h-3 bg-green-600 rounded-full mr-2" />
                        <Text className="text-xs font-bold text-green-900">
                          PICKUP LOCATION (Seller)
                        </Text>
                      </View>
                      <Text className="text-xs text-green-800 ml-5">
                        {selectedBookingForMap?.pickup_address ||
                          `${selectedBookingForMap?.pickup_latitude?.toFixed(6)}, ${selectedBookingForMap?.pickup_longitude?.toFixed(6)}`}
                      </Text>
                    </View>

                    {/* Delivery */}
                    <View className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <View className="flex-row items-center mb-1">
                        <View className="w-3 h-3 bg-blue-600 rounded-full mr-2" />
                        <Text className="text-xs font-bold text-blue-900">
                          DELIVERY LOCATION (Buyer)
                        </Text>
                      </View>
                      <Text className="text-xs text-blue-800 ml-5">
                        {selectedBookingForMap?.delivery_address ||
                          `${selectedBookingForMap?.delivery_latitude?.toFixed(6)}, ${selectedBookingForMap?.delivery_longitude?.toFixed(6)}`}
                      </Text>
                    </View>
                  </View>

                  {/* Booking Details */}
                  <View className="mt-3 bg-gray-50 p-3 rounded-lg">
                    <Text className="text-xs text-gray-600">
                      <Text className="font-semibold">Date:</Text>{" "}
                      {selectedBookingForMap?.booking_date}
                    </Text>
                    <Text className="text-xs text-gray-600">
                      <Text className="font-semibold">Time:</Text>{" "}
                      {selectedBookingForMap?.booking_time}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}
