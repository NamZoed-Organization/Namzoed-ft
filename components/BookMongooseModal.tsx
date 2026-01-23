import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import LocationMapPicker from "./location/LocationMapPicker";

interface BookMongooseModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BookMongooseModal({
  visible,
  onClose,
}: BookMongooseModalProps) {
  const { currentUser } = useUser();
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date());
  const [bookingTime, setBookingTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [message, setMessage] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      checkAvailability();
    }
  }, [visible]);

  const checkAvailability = async () => {
    try {
      setLoading(true);
      // Check mongoose availability from AsyncStorage
      const storedStatus = await AsyncStorage.getItem("mongoose_availability");
      if (storedStatus !== null) {
        setIsAvailable(JSON.parse(storedStatus));
      } else {
        setIsAvailable(true); // Default to available
      }
    } catch (error) {
      console.error("Error checking availability:", error);
      setIsAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!bookingDate || !bookingTime) {
      Alert.alert(
        "Missing Information",
        "Please fill in the date and time for your booking.",
      );
      return;
    }

    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to book.");
      return;
    }

    try {
      setSubmitting(true);

      // Get the authenticated user's ID from Supabase session
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        console.error("Authentication error:", authError);
        Alert.alert(
          "Error",
          "Unable to verify your authentication. Please log in again.",
        );
        setSubmitting(false);
        return;
      }

      // Format date and time for storage
      const formattedDate = bookingDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const formattedTime = bookingTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const bookingData = {
        user_id: authUser.id, // Use authenticated user's ID from Supabase auth
        user_name: currentUser.name || "Unknown",
        user_email: currentUser.email || authUser.email,
        user_phone: currentUser.phone || null,
        mongoose_email: "mongoose@gmail.com",
        booking_date: formattedDate,
        booking_time: formattedTime,
        message: message.trim() || null,
        status: "pending",
        pickup_latitude: pickupLocation?.latitude || null,
        pickup_longitude: pickupLocation?.longitude || null,
        pickup_address: pickupLocation?.address || null,
        delivery_latitude: deliveryLocation?.latitude || null,
        delivery_longitude: deliveryLocation?.longitude || null,
        delivery_address: deliveryLocation?.address || null,
      };

      const { error } = await supabase
        .from("booking_requests")
        .insert([bookingData]);

      if (error) {
        console.error("Booking error:", error);
        if (
          error.code === "PGRST205" ||
          error.message.includes("could not find")
        ) {
          Alert.alert(
            "Setup Required",
            "The booking system is not fully configured yet. Please contact the administrator to run the database migration.",
          );
        } else {
          Alert.alert(
            "Error",
            "Failed to submit booking request. Please try again.",
          );
        }
      } else {
        Alert.alert(
          "Booking Submitted!",
          "Your booking request has been sent to Mongoose. You will be notified once it's reviewed.",
          [{ text: "OK", onPress: handleClose }],
        );
      }
    } catch (error) {
      console.error("Booking submission error:", error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setBookingDate(new Date());
    setBookingTime(new Date());
    setMessage("");
    setShowDatePicker(false);
    setShowTimePicker(false);
    setPickupLocation(null);
    setDeliveryLocation(null);
    onClose();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setBookingDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === "ios");
    if (selectedTime) {
      setBookingTime(selectedTime);
    }
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDisplayTime = (time: Date) => {
    return time.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: "90%" }}>
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">
              Book Mongoose
            </Text>
            <Pressable
              onPress={handleClose}
              className="bg-gray-100 p-2 rounded-full"
              disabled={submitting}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </Pressable>
          </View>

          <ScrollView className="px-5 py-4">
            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#10b981" />
                <Text className="text-gray-600 mt-3">
                  Checking availability...
                </Text>
              </View>
            ) : !isAvailable ? (
              <View className="items-center py-8">
                <View className="bg-red-100 p-4 rounded-full mb-4">
                  <Ionicons name="close-circle" size={48} color="#dc2626" />
                </View>
                <Text className="text-xl font-bold text-gray-900 mb-2">
                  Not Available
                </Text>
                <Text className="text-gray-600 text-center">
                  Mongoose is not currently accepting bookings. Please check
                  back later.
                </Text>
              </View>
            ) : (
              <>
                {/* Availability Status */}
                <View className="bg-green-50 p-4 rounded-lg mb-6 flex-row items-center">
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  <Text className="ml-3 text-green-800 font-medium flex-1">
                    Mongoose is available for bookings
                  </Text>
                </View>

                {/* Booking Form */}
                <View className="space-y-4">
                  {/* Date Input */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Preferred Date *
                    </Text>
                    <Pressable
                      onPress={() => setShowDatePicker(true)}
                      disabled={submitting}
                      className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between bg-white"
                    >
                      <Text className="text-base text-gray-800">
                        {formatDisplayDate(bookingDate)}
                      </Text>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#6b7280"
                      />
                    </Pressable>
                    {showDatePicker && (
                      <DateTimePicker
                        value={bookingDate}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={onDateChange}
                        minimumDate={new Date()}
                      />
                    )}
                  </View>

                  {/* Time Input */}
                  <View className="mt-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Preferred Time *
                    </Text>
                    <Pressable
                      onPress={() => setShowTimePicker(true)}
                      disabled={submitting}
                      className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between bg-white"
                    >
                      <Text className="text-base text-gray-800">
                        {formatDisplayTime(bookingTime)}
                      </Text>
                      <Ionicons name="time-outline" size={20} color="#6b7280" />
                    </Pressable>
                    {showTimePicker && (
                      <DateTimePicker
                        value={bookingTime}
                        mode="time"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={onTimeChange}
                        is24Hour={false}
                      />
                    )}
                  </View>

                  {/* Message Input */}
                  <View className="mt-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Additional Message (Optional)
                    </Text>
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Any special requests or details..."
                      multiline
                      numberOfLines={4}
                      className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                      style={{ textAlignVertical: "top" }}
                      editable={!submitting}
                    />
                  </View>

                  {/* Location Selection */}
                  <View className="mt-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Pickup & Delivery Locations *
                    </Text>
                    <Pressable
                      onPress={() => setShowMapPicker(true)}
                      disabled={submitting}
                      className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50"
                    >
                      <View className="flex-row items-center justify-center">
                        <Ionicons name="map" size={24} color="#10b981" />
                        <Text className="ml-3 text-base font-medium text-green-700">
                          {pickupLocation && deliveryLocation
                            ? "Edit Locations on Map"
                            : "Mark Locations on Map"}
                        </Text>
                      </View>
                      {(!pickupLocation || !deliveryLocation) && (
                        <Text className="text-xs text-gray-600 text-center mt-2">
                          Tap to select pickup and delivery locations
                        </Text>
                      )}
                    </Pressable>

                    {/* Display selected locations */}
                    {(pickupLocation || deliveryLocation) && (
                      <View className="mt-3 space-y-2">
                        {pickupLocation && (
                          <View className="bg-green-50 border border-green-200 p-3 rounded-lg">
                            <View className="flex-row items-center mb-1">
                              <View className="w-3 h-3 bg-green-600 rounded-full mr-2" />
                              <Text className="text-xs font-bold text-green-900">
                                PICKUP LOCATION (Seller)
                              </Text>
                            </View>
                            <Text className="text-xs text-green-800 ml-5">
                              {pickupLocation.address ||
                                `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                            </Text>
                          </View>
                        )}
                        {deliveryLocation && (
                          <View className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                            <View className="flex-row items-center mb-1">
                              <View className="w-3 h-3 bg-blue-600 rounded-full mr-2" />
                              <Text className="text-xs font-bold text-blue-900">
                                DELIVERY LOCATION (Buyer)
                              </Text>
                            </View>
                            <Text className="text-xs text-blue-800 ml-5">
                              {deliveryLocation.address ||
                                `${deliveryLocation.latitude.toFixed(6)}, ${deliveryLocation.longitude.toFixed(6)}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Validation message */}
                    {(!pickupLocation || !deliveryLocation) && (
                      <View className="mt-2 flex-row items-start">
                        <Ionicons
                          name="information-circle"
                          size={16}
                          color="#ef4444"
                        />
                        <Text className="ml-1 text-xs text-red-600 flex-1">
                          Both pickup and delivery locations are required for
                          booking
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* User Info Display */}
                  <View className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Your Contact Information
                    </Text>
                    <Text className="text-sm text-gray-600">
                      Name: {currentUser?.name || "N/A"}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      Email: {currentUser?.email || "N/A"}
                    </Text>
                    {currentUser?.phone ? (
                      <Text className="text-sm text-gray-600">
                        Phone: {currentUser?.phone}
                      </Text>
                    ) : null}
                  </View>

                  {/* Submit Button */}
                  <Pressable
                    onPress={handleSubmit}
                    disabled={
                      submitting ||
                      !bookingDate ||
                      !bookingTime ||
                      !pickupLocation ||
                      !deliveryLocation
                    }
                    className={`mt-6 py-4 rounded-lg items-center ${
                      submitting ||
                      !bookingDate ||
                      !bookingTime ||
                      !pickupLocation ||
                      !deliveryLocation
                        ? "bg-gray-300"
                        : "bg-green-600"
                    }`}
                  >
                    {submitting ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-semibold text-base">
                        Submit Booking Request
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Location Map Picker Modal */}
      <LocationMapPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationsSelected={(pickup, delivery) => {
          setPickupLocation(pickup);
          setDeliveryLocation(delivery);
          setShowMapPicker(false);
        }}
        initialPickupLocation={pickupLocation}
        initialDeliveryLocation={deliveryLocation}
      />
    </Modal>
  );
}
