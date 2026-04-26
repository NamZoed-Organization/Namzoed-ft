/**
 * MongooseResponderModal
 * The modal shown to the chat partner (receiver) when they tap the
 * "Confirm Your Location" CTA on a MongooseInviteCard.
 *
 * • Shows what the initiator set up (role, location, date/time)
 * • Auto-fetches the responder's GPS (with map-override option)
 * • On confirm → inserts into `booking_requests` + calls onConfirmed(bookingRequestId)
 */
import { MongooseInviteData } from "@/components/MongooseInviteCard";
import SingleLocationPicker, {
    PickedLocation,
} from "@/components/location/SingleLocationPicker";
import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { sendSMS } from "@/services/smsService";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  inviteData: MongooseInviteData;
  /** The message DB id — used by the parent to update message content */
  messageId: string;
  /** Responder's profile info */
  responderName: string;
  responderId: string;
  responderEmail?: string;
  /** Called after booking_request inserted successfully */
  onConfirmed: (bookingRequestId: string, responderLocation: PickedLocation) => void;
}

const SELLER_COLOR = "#15803d";
const BUYER_COLOR = "#1d4ed8";
type PopupAction = {
  label: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export default function MongooseResponderModal({
  visible,
  onClose,
  inviteData,
  messageId,
  responderName,
  responderId,
  responderEmail,
  onConfirmed,
}: Props) {
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fetchedRef = useRef(false);
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

  // Auto-fetch GPS each time the modal opens
  useEffect(() => {
    if (visible && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchGPS();
    }
    if (!visible) {
      fetchedRef.current = false;
      setLocation(null);
    }
  }, [visible]);

  const fetchGPS = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showPopup(
          "warning",
          "Location Permission Needed",
          "Enable location permission in Settings to auto-detect your location.",
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
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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
      showPopup("error", "Location Error", "Could not get your location. Please pick it manually.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!location) return;
    setSubmitting(true);

    // Map roles to pickup/delivery:
    //  – Seller's location = pickup
    //  – Buyer's location  = delivery
    const initiatorIsSeller = inviteData.initiatorRole === "seller";

    const pickupLat = initiatorIsSeller
      ? inviteData.initiatorLatitude
      : location.latitude;
    const pickupLng = initiatorIsSeller
      ? inviteData.initiatorLongitude
      : location.longitude;
    const pickupAddr = initiatorIsSeller
      ? inviteData.initiatorAddress
      : (location.address ?? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);

    const deliveryLat = initiatorIsSeller
      ? location.latitude
      : inviteData.initiatorLatitude;
    const deliveryLng = initiatorIsSeller
      ? location.longitude
      : inviteData.initiatorLongitude;
    const deliveryAddr = initiatorIsSeller
      ? (location.address ?? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`)
      : inviteData.initiatorAddress;

    try {
      const [{ data: initP }, { data: respP }] = await Promise.all([
        supabase
          .from("profiles")
          .select("phone")
          .eq("id", inviteData.initiatorId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("phone")
          .eq("id", responderId)
          .maybeSingle(),
      ]);

      const initiatorPhone =
        (initP?.phone && String(initP.phone).trim()) || null;
      const responderPhone =
        (respP?.phone && String(respP.phone).trim()) || null;

      const sellerPhone = initiatorIsSeller
        ? initiatorPhone
        : responderPhone;
      const buyerPhone = initiatorIsSeller
        ? responderPhone
        : initiatorPhone;

      const { data: booking, error } = await supabase
        .from("booking_requests")
        .insert([
          {
            user_id: responderId,
            user_name: responderName,
            user_email: responderEmail ?? "",
            user_phone: responderPhone,
            buyer_phone: buyerPhone,
            seller_phone: sellerPhone,
            mongoose_email: "mongoose@gmail.com",
            booking_date: inviteData.date,
            booking_time: inviteData.time,
            message: JSON.stringify({
              initiatorId: inviteData.initiatorId,
              responderId,
              initiatorRole: inviteData.initiatorRole,
              initiatedFromChat: true,
            }),
            status: "pending",
            pickup_latitude: pickupLat,
            pickup_longitude: pickupLng,
            pickup_address: pickupAddr,
            delivery_latitude: deliveryLat,
            delivery_longitude: deliveryLng,
            delivery_address: deliveryAddr,
          },
        ])
        .select("id")
        .single();

      if (error || !booking) {
        console.error("Booking insert error:", error);
        showPopup("error", "Booking Failed", "Failed to submit the booking. Please try again.");
        setSubmitting(false);
        return;
      }

      // Notify Mongoose service via SMS that a booking has been confirmed by both parties
      sendSMS({
        phone: "77756460",
        message:
          `New Mongoose booking!\n` +
          `Date: ${inviteData.date} at ${inviteData.time}\n` +
          `Pickup: ${pickupAddr}\n` +
          `Delivery: ${deliveryAddr}\n` +
          `Booking ID: ${booking.id}`,
      }).then((ok) => {
        if (!ok) console.warn("[MongooseResponderModal] SMS to Mongoose failed silently");
      }).catch((e) => console.error("[MongooseResponderModal] SMS error:", e));

      onConfirmed(booking.id, location);
    } catch (err) {
      console.error("Unexpected booking error:", err);
      showPopup("error", "Something Went Wrong", "An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  const myRoleEmoji = inviteData.responderRole === "seller" ? "📦" : "🛍️";
  const myRoleLabel =
    inviteData.responderRole === "seller"
      ? "Seller — Pickup Point"
      : "Buyer — Delivery Point";
  const myRoleColor =
    inviteData.responderRole === "seller" ? SELLER_COLOR : BUYER_COLOR;
  const myRoleBg =
    inviteData.responderRole === "seller" ? "#dcfce7" : "#dbeafe";

  const theirRoleEmoji = inviteData.initiatorRole === "seller" ? "📦" : "🛍️";

  const initiatorShortAddr = inviteData.initiatorAddress
    .split(",")
    .slice(0, 2)
    .join(",")
    .trim();

  const shortAddr = (loc: PickedLocation) =>
    loc.address
      ? loc.address.split(",").slice(0, 2).join(",").trim()
      : `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;

  return (
    <>
      <Modal
        visible={visible && !showMapPicker}
        animationType="slide"
        transparent
        onRequestClose={onClose}
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
              maxHeight: "90%",
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
              <Text style={{ fontSize: 22, marginRight: 8 }}>🦡</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  Complete Delivery Booking
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
                  {inviteData.initiatorName} wants to arrange a delivery
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ height: 16 }} />

              {/* ── Booking summary ─────────────────── */}
              <View
                style={{
                  backgroundColor: "#f8faff",
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#e0e7ff",
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 10,
                  }}
                >
                  Booking Details
                </Text>

                {/* Date/time */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color="#6b7280"
                  />
                  <Text
                    style={{ marginLeft: 7, fontSize: 14, color: "#374151" }}
                  >
                    {inviteData.date} at {inviteData.time}
                  </Text>
                </View>

                {/* Their role + location */}
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start" }}
                >
                  <Text style={{ fontSize: 16, marginRight: 6, marginTop: 1 }}>
                    {theirRoleEmoji}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      {inviteData.initiatorName} (
                      {inviteData.initiatorRole === "seller"
                        ? "Seller · Pickup"
                        : "Buyer · Delivery"}
                      )
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        lineHeight: 17,
                        marginTop: 1,
                      }}
                      numberOfLines={2}
                    >
                      📍 {initiatorShortAddr}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── Your role ───────────────────────── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: myRoleBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 22, marginRight: 10 }}>
                  {myRoleEmoji}
                </Text>
                <View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: myRoleColor,
                    }}
                  >
                    Your role: {myRoleLabel}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      marginTop: 2,
                    }}
                  >
                    Confirm your location below
                  </Text>
                </View>
              </View>

              {/* ── Location section ────────────────── */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#374151",
                  marginBottom: 10,
                }}
              >
                Your Location
              </Text>

              {locationLoading ? (
                <View
                  style={{ alignItems: "center", paddingVertical: 24 }}
                >
                  <ActivityIndicator size="large" color="#2563eb" />
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
                  <View
                    style={{
                      borderWidth: 1.5,
                      borderColor: myRoleColor === SELLER_COLOR ? "#86efac" : "#93c5fd",
                      borderRadius: 13,
                      padding: 13,
                      backgroundColor: myRoleBg,
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "flex-start" }}
                    >
                      <Ionicons name="location" size={18} color={myRoleColor} />
                      <Text
                        style={{
                          marginLeft: 7,
                          fontSize: 13,
                          color: "#374151",
                          flex: 1,
                          lineHeight: 18,
                        }}
                      >
                        {shortAddr(location)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setShowMapPicker(true)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1.5,
                      borderColor: "#d1d5db",
                      borderRadius: 12,
                      paddingVertical: 11,
                      marginBottom: 22,
                    }}
                  >
                    <Ionicons name="map-outline" size={17} color="#6b7280" />
                    <Text
                      style={{
                        marginLeft: 7,
                        fontSize: 14,
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Change location on map
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowMapPicker(true)}
                  style={{
                    borderWidth: 2,
                    borderStyle: "dashed",
                    borderColor: "#2563eb",
                    borderRadius: 14,
                    paddingVertical: 26,
                    alignItems: "center",
                    marginBottom: 22,
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
                    Pick Your Location on Map
                  </Text>
                </TouchableOpacity>
              )}

              {/* ── Confirm button ───────────────────── */}
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={!location || submitting}
                style={{
                  backgroundColor:
                    !location || submitting ? "#9ca3af" : "#16a34a",
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "700",
                        marginLeft: 8,
                      }}
                    >
                      Confirm & Book Mongoose
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  textAlign: "center",
                  marginTop: 10,
                  lineHeight: 17,
                }}
              >
                This will submit a booking request to Mongoose.{"\n"}You will be
                notified once it is accepted.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Map picker */}
      <SingleLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => {
          setLocation(loc);
          setShowMapPicker(false);
        }}
        initialLocation={location}
        title={
          inviteData.responderRole === "seller"
            ? "Set Pickup Location"
            : "Set Delivery Location"
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
