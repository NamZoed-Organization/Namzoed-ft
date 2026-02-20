/**
 * MongooseInviteCard
 * Renders the in-chat booking invite card for messages with
 * `message_type = 'mongoose_invite'`.
 *
 * Shows three states:
 *  • awaiting_response (sender)    – "Waiting for [name] to confirm…"
 *  • awaiting_response (receiver)  – "Tap to confirm your location" CTA
 *  • confirmed                     – "Booking confirmed · Track delivery"
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export interface MongooseInviteData {
  status: "awaiting_response" | "confirmed";
  bookingRequestId: string | null;
  initiatorRole: "seller" | "buyer";
  responderRole: "seller" | "buyer";
  initiatorId: string;
  initiatorName: string;
  date: string;
  time: string;
  initiatorLatitude: number;
  initiatorLongitude: number;
  initiatorAddress: string;
}

interface Props {
  messageId: string;
  rawContent: string;
  /** true if the current user sent this message (i.e. is the initiator) */
  isCurrentUser: boolean;
  chatPartnerName: string;
  /** Called when the receiver taps "Confirm your location" */
  onTapToRespond: (messageId: string, data: MongooseInviteData) => void;
  /** Called when either user taps "Track delivery" on a confirmed booking */
  onTrack: (bookingId: string) => void;
}

export function parseMongooseInvite(raw: string): MongooseInviteData | null {
  try {
    return JSON.parse(raw) as MongooseInviteData;
  } catch {
    return null;
  }
}

const SELLER_COLOR = "#15803d";
const BUYER_COLOR = "#1d4ed8";
const SELLER_BG = "#dcfce7";
const BUYER_BG = "#dbeafe";

export default function MongooseInviteCard({
  messageId,
  rawContent,
  isCurrentUser,
  chatPartnerName,
  onTapToRespond,
  onTrack,
}: Props) {
  const data = parseMongooseInvite(rawContent);

  if (!data) {
    return (
      <View
        style={{
          backgroundColor: "#f3f4f6",
          borderRadius: 14,
          padding: 12,
          maxWidth: 280,
        }}
      >
        <Text style={{ color: "#9ca3af", fontSize: 13 }}>
          🦡 Mongoose delivery request (unsupported format)
        </Text>
      </View>
    );
  }

  const roleColor =
    data.initiatorRole === "seller" ? SELLER_COLOR : BUYER_COLOR;
  const roleBg = data.initiatorRole === "seller" ? SELLER_BG : BUYER_BG;
  const roleEmoji = data.initiatorRole === "seller" ? "📦" : "🛍️";
  const roleLabel =
    data.initiatorRole === "seller" ? "Seller (Pickup)" : "Buyer (Delivery)";

  const responderRoleEmoji = data.responderRole === "seller" ? "📦" : "🛍️";
  const responderRoleLabel =
    data.responderRole === "seller" ? "Seller (Pickup)" : "Buyer (Delivery)";

  const isConfirmed = data.status === "confirmed";

  // Abbreviated address for the card (first two comma-separated parts)
  const shortAddress = data.initiatorAddress
    ? data.initiatorAddress.split(",").slice(0, 2).join(",").trim()
    : `${data.initiatorLatitude.toFixed(4)}, ${data.initiatorLongitude.toFixed(4)}`;

  return (
    <View
      style={{
        width: 274,
        borderRadius: 18,
        backgroundColor: "white",
        borderWidth: 1.5,
        borderColor: isConfirmed ? "#86efac" : "#e5e7eb",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* ── Header stripe ───────────────────────────────── */}
      <View
        style={{
          backgroundColor: isConfirmed ? "#f0fdf4" : "#f8faff",
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: isConfirmed ? "#bbf7d0" : "#e5e7eb",
        }}
      >
        <Text style={{ fontSize: 20 }}>🦡</Text>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
            Mongoose Delivery Request
          </Text>
          {isConfirmed && (
            <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "600" }}>
              ✅ Booking confirmed
            </Text>
          )}
        </View>
      </View>

      {/* ── Body ─────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
        {/* Initiator role + location */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={{
              backgroundColor: roleBg,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
              flexDirection: "row",
              alignItems: "center",
              marginRight: 8,
            }}
          >
            <Text style={{ fontSize: 13 }}>{roleEmoji}</Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: roleColor,
                marginLeft: 4,
              }}
            >
              {isCurrentUser ? "You" : data.initiatorName} · {roleLabel}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 7,
          }}
        >
          <Ionicons name="location" size={14} color="#6b7280" style={{ marginTop: 1 }} />
          <Text
            style={{
              marginLeft: 5,
              fontSize: 12,
              color: "#374151",
              flex: 1,
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            {shortAddress}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Ionicons name="calendar-outline" size={13} color="#6b7280" />
          <Text
            style={{ marginLeft: 5, fontSize: 12, color: "#374151" }}
          >
            {data.date} · {data.time}
          </Text>
        </View>

        {/* Responder role pill */}
        {!isConfirmed && (
          <View
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <Text
              style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}
            >
              {isCurrentUser ? chatPartnerName : "Your"} role
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={{ fontSize: 14 }}>{responderRoleEmoji}</Text>
              <Text
                style={{
                  marginLeft: 5,
                  fontSize: 12,
                  fontWeight: "700",
                  color: data.responderRole === "seller" ? SELLER_COLOR : BUYER_COLOR,
                }}
              >
                {responderRoleLabel}
              </Text>
              <Text style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>
                · location needed
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Footer / CTA ─────────────────────────────────── */}
      {isConfirmed ? (
        // Confirmed — show track button
        <TouchableOpacity
          onPress={() =>
            data.bookingRequestId && onTrack(data.bookingRequestId)
          }
          disabled={!data.bookingRequestId}
          style={{
            margin: 10,
            backgroundColor: "#16a34a",
            borderRadius: 12,
            paddingVertical: 11,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="navigate" size={16} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 13,
              fontWeight: "700",
              marginLeft: 6,
            }}
          >
            Check Status & Track
          </Text>
        </TouchableOpacity>
      ) : isCurrentUser ? (
        // Sender — waiting status
        <View
          style={{
            margin: 10,
            backgroundColor: "#f9fafb",
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="time-outline" size={16} color="#9ca3af" />
          <Text
            style={{
              color: "#6b7280",
              fontSize: 12,
              marginLeft: 6,
              flex: 1,
            }}
          >
            Waiting for {chatPartnerName} to confirm their location…
          </Text>
        </View>
      ) : (
        // Receiver — tap to respond
        <TouchableOpacity
          onPress={() => onTapToRespond(messageId, data)}
          style={{
            margin: 10,
            backgroundColor: "#2563eb",
            borderRadius: 12,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="location-outline" size={17} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 13,
              fontWeight: "700",
              marginLeft: 7,
            }}
          >
            Confirm Your Location
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="rgba(255,255,255,0.7)"
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
