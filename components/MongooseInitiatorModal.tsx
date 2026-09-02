/**
 * MongooseInitiatorModal
 * Step-by-step sheet that lets the initiator:
 *   1. Choose their role (Seller = pickup / Buyer = delivery)
 *   2. Confirm their current GPS location (or pick on map)
 *   3. Set a preferred date & time
 * Then builds an invite JSON payload and calls `onInviteSent` so the
 * parent chat screen can send it as a `mongoose_invite` message.
 */
import SingleLocationPicker, {
    PickedLocation,
} from "@/components/location/SingleLocationPicker";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Role = "seller" | "buyer";
type Step = "role" | "location" | "datetime";
type PopupAction = {
  label: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Name of the chat partner — shown in copy like "Waiting for John to confirm" */
  chatPartnerName: string;
  currentUserName: string;
  currentUserId: string;
  /** Called with the JSON-serialised invite payload.
   *  The parent is responsible for actually inserting the message. */
  onInviteSent: (inviteContent: string) => void;
}

export default function MongooseInitiatorModal({
  visible,
  onClose,
  chatPartnerName,
  currentUserName,
  currentUserId,
  onInviteSent,
}: Props) {
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date());
  const [bookingTime, setBookingTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "warning" | "error";
    title: string;
    message: string;
    actions?: PopupAction[];
  }>({ visible: false, type: "warning", title: "", message: "", actions: undefined });
  const showPopup = (
    type: "warning" | "error",
    title: string,
    message: string,
    actions?: PopupAction[],
  ) => setPopup({ visible: true, type, title, message, actions });

  const fetchedRef = useRef(false);

  // Auto-fetch GPS the moment the location step appears (only once per open)
  useEffect(() => {
    if (step === "location" && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchGPS();
    }
  }, [step]);

  const reset = () => {
    setStep("role");
    setRole(null);
    setLocation(null);
    setBookingDate(new Date());
    setBookingTime(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setSubmitting(false);
    fetchedRef.current = false;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const fetchGPS = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showPopup(
          "warning",
          "Location Permission Needed",
          "Enable location permission in Settings to auto-fill your location.",
          [
            { label: "Not now", style: "cancel" },
            {
              label: "Open Settings",
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        setLocationLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // Reverse geocode via Nominatim
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=17`,
          { headers: { "User-Agent": "NamzoedApp/1.0" } },
        );
        const data = await resp.json();
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address: data?.display_name ?? undefined,
        });
      } catch {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch {
      showPopup("error", "Location Error", "Could not get your current location. Please pick it manually.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSend = () => {
    if (!role || !location) return;
    setSubmitting(true);

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

    const inviteData = {
      status: "awaiting_response",
      bookingRequestId: null as string | null,
      initiatorRole: role,
      responderRole: role === "seller" ? "buyer" : "seller",
      initiatorId: currentUserId,
      initiatorName: currentUserName,
      date: formattedDate,
      time: formattedTime,
      initiatorLatitude: location.latitude,
      initiatorLongitude: location.longitude,
      initiatorAddress:
        location.address ??
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
    };

    onInviteSent(JSON.stringify(inviteData));
    reset();
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (t: Date) =>
    t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        visible={visible && !showMapPicker}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderCurve: "continuous",
              maxHeight: "88%",
              overflow: "hidden",
            }}
          >
            {/* Handle bar */}
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  borderCurve: "continuous",
                  backgroundColor: "#d1d5db",
                }}
              />
            </View>

            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingBottom: 14,
                paddingTop: 6,
                borderBottomWidth: 1,
                borderBottomColor: "#f3f4f6",
              }}
            >
              {step !== "role" && (
                <TouchableOpacity
                  onPress={() =>
                    setStep(step === "datetime" ? "location" : "role")
                  }
                  style={{ marginRight: 12 }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="arrow-back" size={22} color="#374151" />
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 20 }}>🦡</Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: "#111827",
                    marginLeft: 8,
                  }}
                >
                  Book Mongoose Delivery
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 20,
                paddingVertical: 10,
                gap: 6,
              }}
            >
              {(["role", "location", "datetime"] as Step[]).map((s, i) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    borderCurve: "continuous",
                    backgroundColor:
                      ["role", "location", "datetime"].indexOf(step) >= i
                        ? "#2563eb"
                        : "#e5e7eb",
                  }}
                />
              ))}
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Step 1: Role ─────────────────── */}
              {step === "role" && (
                <View style={{ paddingTop: 8 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      color: "#374151",
                      marginBottom: 18,
                      lineHeight: 22,
                    }}
                  >
                    Are you the{" "}
                    <Text style={{ fontWeight: "700" }}>seller</Text> or the{" "}
                    <Text style={{ fontWeight: "700" }}>buyer</Text> in this
                    delivery?
                  </Text>

                  {/* Seller card */}
                  <Pressable
                    onPress={() => {
                      setRole("seller");
                      setStep("location");
                    }}
                    style={({ pressed }) => ({
                      borderWidth: 2,
                      borderColor: role === "seller" ? "#16a34a" : "#e5e7eb",
                      borderRadius: 16,
                      borderCurve: "continuous",
                      padding: 18,
                      marginBottom: 12,
                      backgroundColor: pressed ? "#f0fdf4" : "white",
                      flexDirection: "row",
                      alignItems: "center",
                    })}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        borderCurve: "continuous",
                        backgroundColor: "#dcfce7",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                      }}
                    >
                      <Text style={{ fontSize: 26 }}>📦</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        I'm the Seller
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#6b7280",
                          marginTop: 3,
                          lineHeight: 18,
                        }}
                      >
                        My location is the{" "}
                        <Text style={{ fontWeight: "600", color: "#16a34a" }}>
                          pickup point
                        </Text>
                        {"\n"}
                        {chatPartnerName} will be the buyer (delivery)
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9ca3af"
                    />
                  </Pressable>

                  {/* Buyer card */}
                  <Pressable
                    onPress={() => {
                      setRole("buyer");
                      setStep("location");
                    }}
                    style={({ pressed }) => ({
                      borderWidth: 2,
                      borderColor: role === "buyer" ? "#2563eb" : "#e5e7eb",
                      borderRadius: 16,
                      borderCurve: "continuous",
                      padding: 18,
                      backgroundColor: pressed ? "#eff6ff" : "white",
                      flexDirection: "row",
                      alignItems: "center",
                    })}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        borderCurve: "continuous",
                        backgroundColor: "#dbeafe",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                      }}
                    >
                      <Text style={{ fontSize: 26 }}>🛍️</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        I'm the Buyer
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#6b7280",
                          marginTop: 3,
                          lineHeight: 18,
                        }}
                      >
                        My location is the{" "}
                        <Text style={{ fontWeight: "600", color: "#2563eb" }}>
                          delivery point
                        </Text>
                        {"\n"}
                        {chatPartnerName} will be the seller (pickup)
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9ca3af"
                    />
                  </Pressable>
                </View>
              )}

              {/* ── Step 2: Location ─────────────── */}
              {step === "location" && (
                <View style={{ paddingTop: 8 }}>
                  {/* Role reminder chip */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      backgroundColor:
                        role === "seller" ? "#dcfce7" : "#dbeafe",
                      borderRadius: 20,
                      borderCurve: "continuous",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ fontSize: 15, marginRight: 6 }}>
                      {role === "seller" ? "📦" : "🛍️"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: role === "seller" ? "#15803d" : "#1d4ed8",
                      }}
                    >
                      {role === "seller"
                        ? "Your pickup location"
                        : "Your delivery location"}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 15,
                      color: "#374151",
                      marginBottom: 16,
                      lineHeight: 22,
                    }}
                  >
                    Your current location has been auto-detected. You can
                    confirm it or pick a different spot on the map.
                  </Text>

                  {locationLoading ? (
                    <View
                      style={{ alignItems: "center", paddingVertical: 28 }}
                    >
                      <CircularLoader size="large" color="#2563eb" />
                      <Text
                        style={{
                          color: "#6b7280",
                          marginTop: 10,
                          fontSize: 14,
                        }}
                      >
                        Detecting your location…
                      </Text>
                    </View>
                  ) : location ? (
                    <>
                      {/* Location card */}
                      <View
                        style={{
                          borderWidth: 1.5,
                          borderColor:
                            role === "seller" ? "#86efac" : "#93c5fd",
                          borderRadius: 14,
                          borderCurve: "continuous",
                          padding: 14,
                          backgroundColor:
                            role === "seller" ? "#f0fdf4" : "#eff6ff",
                          marginBottom: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                          }}
                        >
                          <Ionicons
                            name="location"
                            size={20}
                            color={role === "seller" ? "#16a34a" : "#2563eb"}
                          />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color:
                                  role === "seller" ? "#15803d" : "#1d4ed8",
                                marginBottom: 2,
                              }}
                            >
                              {role === "seller"
                                ? "Pickup Location"
                                : "Delivery Location"}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                color: "#374151",
                                lineHeight: 18,
                              }}
                            >
                              {location.address ??
                                `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Change location */}
                      <TouchableOpacity
                        onPress={() => setShowMapPicker(true)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1.5,
                          borderColor: "#d1d5db",
                          borderRadius: 12,
                          borderCurve: "continuous",
                          paddingVertical: 12,
                          marginBottom: 24,
                        }}
                      >
                        <Ionicons
                          name="map-outline"
                          size={18}
                          color="#6b7280"
                        />
                        <Text
                          style={{
                            marginLeft: 8,
                            fontSize: 14,
                            color: "#374151",
                            fontWeight: "500",
                          }}
                        >
                          Change location on map
                        </Text>
                      </TouchableOpacity>

                      <Pressable
                        onPress={() => setStep("datetime")}
                        style={{
                          backgroundColor: "#2563eb",
                          borderRadius: 14,
                          borderCurve: "continuous",
                          paddingVertical: 15,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "white",
                            fontSize: 16,
                            fontWeight: "700",
                          }}
                        >
                          Use This Location →
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowMapPicker(true)}
                      style={{
                        borderWidth: 2,
                        borderStyle: "dashed",
                        borderColor: "#2563eb",
                        borderRadius: 14,
                        borderCurve: "continuous",
                        paddingVertical: 28,
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name="map" size={32} color="#2563eb" />
                      <Text
                        style={{
                          marginTop: 10,
                          fontSize: 15,
                          fontWeight: "600",
                          color: "#2563eb",
                        }}
                      >
                        Pick Location on Map
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 4,
                        }}
                      >
                        GPS not available
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ── Step 3: Date / Time ───────────── */}
              {step === "datetime" && (
                <View style={{ paddingTop: 8 }}>
                  {/* Summary chips */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginBottom: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor:
                          role === "seller" ? "#dcfce7" : "#dbeafe",
                        borderRadius: 20,
                        borderCurve: "continuous",
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ fontSize: 14, marginRight: 4 }}>
                        {role === "seller" ? "📦" : "🛍️"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color:
                            role === "seller" ? "#15803d" : "#1d4ed8",
                        }}
                      >
                        {role === "seller" ? "Seller" : "Buyer"} ·{" "}
                        {location?.address?.split(",")[0] ?? "Your location"}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: 15,
                      color: "#374151",
                      marginBottom: 18,
                      lineHeight: 22,
                    }}
                  >
                    When do you need the delivery?
                  </Text>

                  {/* Date picker */}
                  <View style={{ marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#6b7280",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Date
                    </Text>
                    <Pressable
                      onPress={() => setShowDatePicker(true)}
                      style={{
                        borderWidth: 1.5,
                        borderColor: "#d1d5db",
                        borderRadius: 12,
                        borderCurve: "continuous",
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#f9fafb",
                      }}
                    >
                      <Text
                        style={{ fontSize: 15, color: "#111827" }}
                      >
                        {formatDate(bookingDate)}
                      </Text>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#9ca3af"
                      />
                    </Pressable>
                    {showDatePicker && (
                      <DateTimePicker
                        value={bookingDate}
                        mode="date"
                        display={
                          Platform.OS === "ios" ? "spinner" : "default"
                        }
                        minimumDate={new Date()}
                        onChange={(_, d) => {
                          setShowDatePicker(Platform.OS === "ios");
                          if (d) setBookingDate(d);
                        }}
                      />
                    )}
                  </View>

                  {/* Time picker */}
                  <View style={{ marginBottom: 28 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#6b7280",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Time
                    </Text>
                    <Pressable
                      onPress={() => setShowTimePicker(true)}
                      style={{
                        borderWidth: 1.5,
                        borderColor: "#d1d5db",
                        borderRadius: 12,
                        borderCurve: "continuous",
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#f9fafb",
                      }}
                    >
                      <Text
                        style={{ fontSize: 15, color: "#111827" }}
                      >
                        {formatTime(bookingTime)}
                      </Text>
                      <Ionicons name="time-outline" size={20} color="#9ca3af" />
                    </Pressable>
                    {showTimePicker && (
                      <DateTimePicker
                        value={bookingTime}
                        mode="time"
                        display={
                          Platform.OS === "ios" ? "spinner" : "default"
                        }
                        is24Hour={false}
                        onChange={(_, t) => {
                          setShowTimePicker(Platform.OS === "ios");
                          if (t) setBookingTime(t);
                        }}
                      />
                    )}
                  </View>

                  {/* Send button */}
                  <Pressable
                    onPress={handleSend}
                    disabled={submitting}
                    style={{
                      backgroundColor: submitting ? "#93c5fd" : "#2563eb",
                      borderRadius: 14,
                      borderCurve: "continuous",
                      paddingVertical: 15,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                    }}
                  >
                    {submitting ? (
                      <CircularLoader color="white" />
                    ) : (
                      <>
                        <Text
                          style={{
                            color: "white",
                            fontSize: 16,
                            fontWeight: "700",
                          }}
                        >
                          Send Delivery Invite to {chatPartnerName}
                        </Text>
                        <Text style={{ marginLeft: 6, fontSize: 18 }}>🦡</Text>
                      </>
                    )}
                  </Pressable>

                  <Text
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      textAlign: "center",
                      marginTop: 10,
                    }}
                  >
                    {chatPartnerName} will confirm their location to complete
                    the booking.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Map picker for overriding GPS */}
      <SingleLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => {
          setLocation(loc);
          setShowMapPicker(false);
        }}
        initialLocation={location}
        title={
          role === "seller" ? "Set Pickup Location" : "Set Delivery Location"
        }
      />
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
