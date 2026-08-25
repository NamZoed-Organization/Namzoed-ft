/**
 * MongooseInviteCard
 * Renders the in-chat booking invite for `message_type = 'mongoose_invite'`.
 *
 * Flow (with live `booking_requests` status):
 *  • awaiting partner — waiting for the other user to confirm location
 *  • awaiting Mongoose — booking submitted, pending until Mongoose accepts
 *  • track — Mongoose accepted; "Check status & track" is shown
 *  • delivered — booking completed
 *  • declined / cancelled — terminal states
 */
import { useBookingRequestStatus } from "@/hooks/useBookingRequestStatus";
import { Ionicons } from "@expo/vector-icons";
import {
  CheckCircle2,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import CircularLoader from "@/components/ui/CircularLoader";

export interface MongooseInviteData {
  status:
    | "awaiting_response"
    | "awaiting_mongoose"
    | "mongoose_accepted"
    | "delivered"
    | "confirmed"
    | "cancelled";
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
  initiatorPhone?: string | null;
}

interface Props {
  messageId: string;
  rawContent: string;
  /** true if the current user sent this message (i.e. is the initiator) */
  isCurrentUser: boolean;
  chatPartnerName: string;
  /** Called when the receiver taps "Confirm your location" */
  onTapToRespond: (messageId: string, data: MongooseInviteData) => void;
  /** Called when either user taps "Track" once Mongoose has accepted */
  onTrack: (bookingId: string) => void;
  /** Called when the initiator cancels a pending (awaiting_response) request */
  onCancel?: (messageId: string) => void;
}

export function parseMongooseInvite(raw: string): MongooseInviteData | null {
  try {
    return JSON.parse(raw) as MongooseInviteData;
  } catch {
    return null;
  }
}

const SELLER_COLOR = "#b45309";
const BUYER_COLOR = "#1d4ed8";
const SELLER_BG = "#fef3c7";
const BUYER_BG = "#dbeafe";

type CardPhase =
  | "awaiting_partner"
  | "awaiting_mongoose"
  | "track"
  | "delivered"
  | "declined"
  | "cancelled";

export default function MongooseInviteCard({
  messageId,
  rawContent,
  isCurrentUser,
  chatPartnerName,
  onTapToRespond,
  onTrack,
  onCancel,
}: Props) {
  const data = parseMongooseInvite(rawContent);

  const { status: liveStatus, loading: liveLoading } = useBookingRequestStatus(
    data?.bookingRequestId ?? null,
  );

  const phase: CardPhase = useMemo(() => {
    if (!data) return "awaiting_partner";
    if (data.status === "cancelled") return "cancelled";
    if (!data.bookingRequestId) return "awaiting_partner";
    if (liveStatus === "accepted") return "track";
    if (liveStatus === "completed") return "delivered";
    if (liveStatus === "rejected") return "declined";
    if (liveStatus === "pending") return "awaiting_mongoose";
    if (liveLoading) return "awaiting_mongoose";
    return "awaiting_mongoose";
  }, [data, liveStatus, liveLoading]);

  if (!data) {
    return (
      <View
        style={{
          backgroundColor: "#f3f4f6",
          borderRadius: 14,
          padding: 12,
          maxWidth: 280,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Truck size={14} color="#9ca3af" strokeWidth={1.75} />
        <Text style={{ color: "#9ca3af", fontSize: 13 }}>
          Mongoose delivery request (unsupported format)
        </Text>
      </View>
    );
  }

  const roleColor =
    data.initiatorRole === "seller" ? SELLER_COLOR : BUYER_COLOR;
  const roleBg = data.initiatorRole === "seller" ? SELLER_BG : BUYER_BG;
  const RoleIcon = data.initiatorRole === "seller" ? Package : ShoppingBag;
  const roleLabel =
    data.initiatorRole === "seller" ? "Seller (Pickup)" : "Buyer (Delivery)";

  const ResponderRoleIcon =
    data.responderRole === "seller" ? Package : ShoppingBag;
  const responderRoleColor =
    data.responderRole === "seller" ? SELLER_COLOR : BUYER_COLOR;
  const responderRoleLabel =
    data.responderRole === "seller" ? "Seller (Pickup)" : "Buyer (Delivery)";

  const isCancelled = phase === "cancelled";
  const isActiveDelivery = phase === "track" || phase === "delivered";
  const isAwaitingMongoose = phase === "awaiting_mongoose";

  const borderAccent =
    isCancelled ? "#e5e7eb" : isActiveDelivery ? "#bfdbfe" : isAwaitingMongoose ? "#fde68a" : "#e5e7eb";

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
        borderColor: borderAccent,
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
          backgroundColor: isCancelled
            ? "#f9fafb"
            : isActiveDelivery
              ? "#eff6ff"
              : isAwaitingMongoose
                ? "#fffbeb"
                : "#f8faff",
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: borderAccent,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: isCancelled
              ? "#e5e7eb"
              : isActiveDelivery
                ? "#dbeafe"
                : isAwaitingMongoose
                  ? "#fef3c7"
                  : "#e0e7ef",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Truck
            size={17}
            color={
              isCancelled
                ? "#9ca3af"
                : isActiveDelivery
                  ? "#1d4ed8"
                  : isAwaitingMongoose
                    ? "#b45309"
                    : "#374151"
            }
            strokeWidth={1.75}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
            Mongoose Delivery
          </Text>
          {phase === "track" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 1,
              }}
            >
              <CheckCircle2 size={11} color="#1d4ed8" strokeWidth={2} />
              <Text
                style={{ fontSize: 11, color: "#1d4ed8", fontWeight: "600" }}
              >
                Mongoose accepted — on the way
              </Text>
            </View>
          )}
          {phase === "delivered" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 1,
              }}
            >
              <CheckCircle2 size={11} color="#15803d" strokeWidth={2} />
              <Text
                style={{ fontSize: 11, color: "#15803d", fontWeight: "600" }}
              >
                Product delivered
              </Text>
            </View>
          )}
          {phase === "awaiting_mongoose" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 1,
              }}
            >
              {liveLoading ? (
                <CircularLoader size="small" color="#b45309" />
              ) : (
                <Ionicons name="time-outline" size={12} color="#b45309" />
              )}
              <Text
                style={{ fontSize: 11, color: "#92400e", fontWeight: "600" }}
              >
                Waiting for Mongoose to confirm…
              </Text>
            </View>
          )}
          {phase === "declined" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 1,
              }}
            >
              <XCircle size={11} color="#9ca3af" strokeWidth={2} />
              <Text
                style={{ fontSize: 11, color: "#6b7280", fontWeight: "600" }}
              >
                Mongoose declined this booking
              </Text>
            </View>
          )}
          {isCancelled && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 1,
              }}
            >
              <XCircle size={11} color="#9ca3af" strokeWidth={2} />
              <Text
                style={{ fontSize: 11, color: "#9ca3af", fontWeight: "600" }}
              >
                Request cancelled
              </Text>
            </View>
          )}
          {phase === "awaiting_partner" && (
            <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
              Delivery request
            </Text>
          )}
        </View>
      </View>

      {/* ── Body ─────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
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
            <RoleIcon size={13} color={roleColor} strokeWidth={2} />
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
          <Ionicons
            name="location"
            size={14}
            color="#6b7280"
            style={{ marginTop: 1 }}
          />
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
          <Text style={{ marginLeft: 5, fontSize: 12, color: "#374151" }}>
            {data.date} · {data.time}
          </Text>
        </View>

        {!data.bookingRequestId && (
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
            <Text style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
              {isCurrentUser ? chatPartnerName : "Your"} role
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ResponderRoleIcon
                size={13}
                color={responderRoleColor}
                strokeWidth={2}
              />
              <Text
                style={{
                  marginLeft: 5,
                  fontSize: 12,
                  fontWeight: "700",
                  color: responderRoleColor,
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
      {phase === "track" ? (
        <TouchableOpacity
          onPress={() =>
            data.bookingRequestId && onTrack(data.bookingRequestId)
          }
          disabled={!data.bookingRequestId}
          style={{
            margin: 10,
            backgroundColor: "#094569",
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
      ) : phase === "delivered" ? (
        <View
          style={{
            margin: 10,
            backgroundColor: "#ecfdf5",
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#a7f3d0",
          }}
        >
          <CheckCircle2 size={16} color="#15803d" strokeWidth={2} />
          <Text style={{ color: "#166534", fontSize: 12, marginLeft: 6, flex: 1 }}>
            This delivery is complete. Thank you for using Mongoose.
          </Text>
        </View>
      ) : phase === "awaiting_mongoose" ? (
        <View
          style={{
            margin: 10,
            backgroundColor: "#fffbeb",
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#fde68a",
          }}
        >
          <Ionicons name="hourglass-outline" size={16} color="#b45309" />
          <Text style={{ color: "#92400e", fontSize: 12, marginLeft: 6, flex: 1 }}>
            Request sent to Mongoose. You’ll get a message when they accept and
            you can track the driver.
          </Text>
        </View>
      ) : phase === "declined" ? (
        <View
          style={{
            margin: 10,
            backgroundColor: "#f3f4f6",
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <XCircle size={16} color="#9ca3af" strokeWidth={1.75} />
          <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: 6, flex: 1 }}>
            Mongoose wasn’t able to take this request. You can try again later.
          </Text>
        </View>
      ) : isCancelled ? (
        <View
          style={{
            margin: 10,
            backgroundColor: "#f3f4f6",
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <XCircle size={16} color="#9ca3af" strokeWidth={1.75} />
          <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: 6, flex: 1 }}>
            {isCurrentUser
              ? "You cancelled this request."
              : "This request was cancelled."}
          </Text>
        </View>
      ) : isCurrentUser ? (
        <View style={{ margin: 10, gap: 8 }}>
          <View
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="time-outline" size={16} color="#9ca3af" />
            <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: 6, flex: 1 }}>
              Waiting for {chatPartnerName} to confirm their location…
            </Text>
          </View>
          {onCancel && (
            <TouchableOpacity
              onPress={() => onCancel(messageId)}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
              activeOpacity={0.75}
            >
              <XCircle size={16} color="#6b7280" strokeWidth={1.75} />
              <Text
                style={{
                  color: "#374151",
                  fontSize: 12,
                  fontWeight: "600",
                  marginLeft: 6,
                }}
              >
                Cancel Request
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
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
