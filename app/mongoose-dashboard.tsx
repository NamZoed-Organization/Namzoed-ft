import LocationTrackingControl from "@/components/location/LocationTrackingControl";
import CircularLoader from "@/components/ui/CircularLoader";
import MongooseWorkerNavBar, {
  MONGOOSE_WORKER_NAV_BAR_HEIGHT,
} from "@/components/ui/MongooseWorkerNavBar";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { isMongooseUser, MONGOOSE_EMAIL } from "@/utils/roleCheck";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppRouter } from "@/utils/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Switch,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapPinMarker from "@/components/maps/MapPinMarker";
import { androidMapProvider } from "@/utils/mapProvider";
import MapView, { Polyline } from "react-native-maps";
import { fetchDrivingRoute } from "@/utils/drivingRoute";
import {
  openGoogleDrivingDirections,
  openIosDrivingDirectionsWithMapChoice,
} from "@/utils/openDrivingTurnByTurn";
import { openPhoneDialer } from "@/utils/phoneDial";

/** NamZoed brand (namzoed.com/brand) */
const NZ = {
  ink: "#1C1614",
  cream: "#FDFAF5",
  stone: "#888280",
  pearl: "#EDE9E2",
  navy: "#094569",
} as const;

interface BookingRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  buyer_phone?: string | null;
  seller_phone?: string | null;
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

/** Stored in `message` for chat mongoose bookings — never show raw JSON to drivers. */
const INTERNAL_BOOKING_MESSAGE_KEYS = new Set([
  "initiatorId",
  "responderId",
  "initiatorRole",
  "initiatedFromChat",
  "bookingRequestId",
  "status",
]);

function isInternalChatBookingMetadata(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as object);
  if (keys.length === 0) return false;
  return keys.every((k) => INTERNAL_BOOKING_MESSAGE_KEYS.has(k));
}

/**
 * Plain user note (Book Mongoose flow). Chat bookings store JSON in `message` for the app only —
 * drivers should not see that; returns null so the Message row is hidden.
 */
function messageLineForDriver(raw: string | undefined | null): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  try {
    const parsed: unknown = JSON.parse(s);
    if (isInternalChatBookingMetadata(parsed)) {
      return null;
    }
  } catch {
    /* plain text from user */
  }
  return s;
}

/** Buyer + seller profile ids for chat-originated bookings (from `message` JSON). */
function parseChatPartiesFromBooking(booking: {
  user_id: string;
  message?: string | null;
}): { buyerId: string; sellerId: string | null } | null {
  try {
    const meta = JSON.parse(booking.message ?? "");
    if (!meta?.initiatedFromChat) return null;
    if (meta.initiatorRole === "seller") {
      return {
        sellerId: meta.initiatorId ?? null,
        buyerId: meta.responderId ?? booking.user_id,
      };
    }
    return {
      sellerId: meta.responderId ?? null,
      buyerId: meta.initiatorId ?? booking.user_id,
    };
  } catch {
    return null;
  }
}

function normalizeBookingStatus(status: string | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

type MongooseBookingSection = {
  key: string;
  title: string;
  hint?: string;
  data: BookingRequest[];
  compact: boolean;
};

/** Pending + in progress first; completed, rejected, and unknown status are compact archive rows. */
function buildMongooseBookingSections(
  requests: BookingRequest[],
): MongooseBookingSection[] {
  const pending: BookingRequest[] = [];
  const inProgress: BookingRequest[] = [];
  const completed: BookingRequest[] = [];
  const rejected: BookingRequest[] = [];
  const other: BookingRequest[] = [];

  for (const b of requests) {
    const st = normalizeBookingStatus(b.status);
    if (st === "pending") pending.push(b);
    else if (st === "accepted") inProgress.push(b);
    else if (st === "completed") completed.push(b);
    else if (st === "rejected") rejected.push(b);
    else other.push(b);
  }

  const byCreatedDesc = (a: BookingRequest, b: BookingRequest) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const byCreatedAsc = (a: BookingRequest, b: BookingRequest) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  pending.sort(byCreatedAsc);
  inProgress.sort(byCreatedDesc);
  completed.sort(byCreatedDesc);
  rejected.sort(byCreatedDesc);
  other.sort(byCreatedDesc);

  const sections: MongooseBookingSection[] = [];
  if (pending.length) {
    sections.push({
      key: "pending",
      title: "Pending",
      hint: "Needs your accept or reject",
      data: pending,
      compact: false,
    });
  }
  if (inProgress.length) {
    sections.push({
      key: "in_progress",
      title: "In progress",
      hint: "Current delivery",
      data: inProgress,
      compact: false,
    });
  }
  if (completed.length) {
    sections.push({
      key: "completed",
      title: "Completed",
      hint: "Past deliveries",
      data: completed,
      compact: true,
    });
  }
  if (rejected.length) {
    sections.push({
      key: "rejected",
      title: "Rejected",
      hint: "Declined requests",
      data: rejected,
      compact: true,
    });
  }
  if (other.length) {
    sections.push({
      key: "other",
      title: "Other",
      hint: "Bookings with an unexpected status",
      data: other,
      compact: true,
    });
  }
  return sections;
}

export default function MongooseDashboard() {
  const { currentUser, isLoading: userContextLoading } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
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
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const [popup, setPopup] = useState<{visible: boolean; type: 'success'|'warning'|'error'|'white'; title: string; message: string}>({visible: false, type: 'white', title: '', message: ''});
  const showPopup = (type: 'success'|'warning'|'error'|'white', title: string, message: string) => setPopup({visible: true, type, title, message});

  const promptMongooseDirections = useCallback(
    (b: BookingRequest | null) => {
      if (
        !b?.pickup_latitude ||
        !b?.pickup_longitude ||
        !b?.delivery_latitude ||
        !b?.delivery_longitude
      ) {
        showPopup(
          "warning",
          "Missing locations",
          "This booking needs pickup and delivery coordinates for directions.",
        );
        return;
      }
      Alert.alert(
        "Get directions",
        "Open turn-by-turn driving directions in your maps app. Where are you going?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Pickup (seller)",
            onPress: async () => {
              const result = await openIosDrivingDirectionsWithMapChoice(
                b.pickup_latitude!,
                b.pickup_longitude!,
              );
              if (result === "failed") {
                showPopup(
                  "error",
                  "Could not open maps",
                  Platform.OS === "ios"
                    ? "Try the other maps app, or install Google Maps from the App Store."
                    : "Install Google Maps and try again.",
                );
              }
            },
          },
          {
            text: "Delivery (buyer)",
            onPress: async () => {
              const result = await openIosDrivingDirectionsWithMapChoice(
                b.delivery_latitude!,
                b.delivery_longitude!,
              );
              if (result === "failed") {
                showPopup(
                  "error",
                  "Could not open maps",
                  Platform.OS === "ios"
                    ? "Try the other maps app, or install Google Maps from the App Store."
                    : "Install Google Maps and try again.",
                );
              }
            },
          },
        ],
      );
    },
    [showPopup],
  );

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
          setBookingRequests([]);
        } else {
          console.error("Error loading bookings:", error);
        }
      } else {
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

  // Wait for UserContext (AsyncStorage) before gating — avoids false "denied" on cold start.
  useEffect(() => {
    if (userContextLoading) return;

    const checkAccess = async () => {
      if (!currentUser || !isMongooseUser(currentUser.email)) {
        showPopup('warning', 'Access Denied', "You don't have permission to access this page.");
        router.replace("/(users)/(tabs)");
      } else if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        await loadData();
      }
    };
    void checkAccess();
  }, [currentUser, userContextLoading, loadData, router]);
  // Real-time subscription for booking changes (with debouncing)
  useEffect(() => {
    if (!currentUser || !isMongooseUser(currentUser.email)) return;

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
          // Debounce the refresh to prevent rapid consecutive updates
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            loadBookingRequests();
            loadAvailabilityStatus();
          }, 1000); // Wait 1 second before updating
        },
      )
      .subscribe();

    return () => {
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
        showPopup('warning', 'Cannot Change Status', 'You have accepted bookings. Please complete them first by marking them as done.');
      } else {
        setIsAvailable(value);
        showPopup('white', 'Availability Info', 'Availability is automatically managed based on accepted bookings.');
      }
    } catch (error) {
      console.error("Error updating availability:", error);
      showPopup('error', 'Update Failed', 'Failed to update availability status.');
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
        showPopup('error', 'Update Failed', 'Failed to update booking request.');
      } else {
        showPopup('success', 'Booking Updated', `Booking ${action === "accept" ? "accepted" : "rejected"} successfully.`);

        const booking = bookingRequests.find((b) => b.id === bookingId);

        if (action === "accept") {
          setIsAvailable(false);
          if (booking && currentUser?.id) {
            const parties = parseChatPartiesFromBooking(booking);
            if (parties) {
              const acceptedNotice =
                "Mongoose has accepted your delivery and is on the way. Use Check status & track on your booking card to follow the driver.";
              const rows: {
                sender_id: string;
                receiver_id: string;
                content: string;
                is_read: boolean;
              }[] = [
                {
                  sender_id: currentUser.id,
                  receiver_id: parties.buyerId,
                  content: acceptedNotice,
                  is_read: false,
                },
              ];
              if (
                parties.sellerId &&
                parties.sellerId !== parties.buyerId &&
                parties.sellerId !== currentUser.id
              ) {
                rows.push({
                  sender_id: currentUser.id,
                  receiver_id: parties.sellerId,
                  content: acceptedNotice,
                  is_read: false,
                });
              }
              const { error: msgErr } = await supabase
                .from("messages")
                .insert(rows);
              if (msgErr) {
                console.warn("Chat notify (accept):", msgErr.message);
              }
            }
          }
        } else if (action === "reject" && booking && currentUser?.id) {
          const parties = parseChatPartiesFromBooking(booking);
          if (parties) {
            const declinedNotice =
              "Mongoose wasn’t able to take this delivery request. You can try booking again later.";
            const rows: {
              sender_id: string;
              receiver_id: string;
              content: string;
              is_read: boolean;
            }[] = [
              {
                sender_id: currentUser.id,
                receiver_id: parties.buyerId,
                content: declinedNotice,
                is_read: false,
              },
            ];
            if (
              parties.sellerId &&
              parties.sellerId !== parties.buyerId &&
              parties.sellerId !== currentUser.id
            ) {
              rows.push({
                sender_id: currentUser.id,
                receiver_id: parties.sellerId,
                content: declinedNotice,
                is_read: false,
              });
            }
            const { error: msgErr } = await supabase.from("messages").insert(rows);
            if (msgErr) {
              console.warn("Chat notify (reject):", msgErr.message);
            }
          }
        }

        await loadBookingRequests();
      }
    } catch (error) {
      console.error("Error handling booking action:", error);
    }
  };

  // Handle completing an accepted booking
  const handleCompleteBooking = async (bookingId: string, userName: string) => {
    // Find the booking to get the user_id for the delivery-done chat message
    const booking = bookingRequests.find((b) => b.id === bookingId);

    Alert.alert(
      "Mark as Done",
      `Mark delivery for ${userName} as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Done",
          onPress: async () => {
            try {
              // 1. Update booking status to "completed" (not delete)
              const { error: updateError } = await supabase
                .from("booking_requests")
                .update({ status: "completed" })
                .eq("id", bookingId);

              if (updateError) {
                console.error("Error completing booking:", updateError);
                showPopup('error', 'Completion Failed', `Failed: ${updateError.message}`);
                return;
              }

              // 2. Notify buyer (+ seller for chat bookings)
              if (booking?.user_id && currentUser?.id) {
                const parties = parseChatPartiesFromBooking(booking);
                const buyerId = parties?.buyerId ?? booking.user_id;
                const sellerId = parties?.sellerId ?? null;

                const notifications: {
                  sender_id: string;
                  receiver_id: string;
                  content: string;
                  is_read: boolean;
                }[] = [
                  {
                    sender_id: currentUser.id,
                    receiver_id: buyerId,
                    content:
                      "Your product has been delivered. Thank you for using Mongoose.",
                    is_read: false,
                  },
                ];

                if (
                  sellerId &&
                  sellerId !== buyerId &&
                  sellerId !== currentUser.id
                ) {
                  notifications.push({
                    sender_id: currentUser.id,
                    receiver_id: sellerId,
                    content:
                      "The buyer’s order has been delivered. Mongoose has completed this delivery.",
                    is_read: false,
                  });
                }

                const { error: msgError } = await supabase
                  .from("messages")
                  .insert(notifications);

                if (!msgError) {
                  console.log(
                    `Delivery-done messages sent to ${notifications.length} recipient(s)`,
                  );
                }
              }

              // 3. Refresh local state
              await Promise.all([loadBookingRequests(), loadAvailabilityStatus()]);
              showPopup('success', 'Delivery Complete', `Booking for ${userName} has been marked as delivered.`);
            } catch (error: any) {
              console.error("Error completing booking:", error);
              showPopup('error', 'Something Went Wrong', error?.message || 'An unexpected error occurred.');
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

  useEffect(() => {
    const b = selectedBookingForMap;
    if (
      !b?.pickup_latitude ||
      !b?.pickup_longitude ||
      !b?.delivery_latitude ||
      !b?.delivery_longitude
    ) {
      setRouteCoordinates([]);
      setRouteLoading(false);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    fetchDrivingRoute(
      {
        latitude: b.pickup_latitude,
        longitude: b.pickup_longitude,
      },
      {
        latitude: b.delivery_latitude,
        longitude: b.delivery_longitude,
      },
    ).then((coords) => {
      if (!cancelled) {
        setRouteCoordinates(coords);
        setRouteLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedBookingForMap]);

  useEffect(() => {
    if (routeCoordinates.length < 2 || !selectedBookingForMap) return;
    const id = requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 72, right: 36, bottom: 100, left: 36 },
        animated: true,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [routeCoordinates, selectedBookingForMap]);

  const bookingSections = useMemo(
    () => buildMongooseBookingSections(bookingRequests),
    [bookingRequests],
  );

  const prioritySummary = useMemo(() => {
    let pending = 0;
    let active = 0;
    for (const b of bookingRequests) {
      const s = normalizeBookingStatus(b.status);
      if (s === "pending") pending += 1;
      else if (s === "accepted") active += 1;
    }
    return { pending, active };
  }, [bookingRequests]);

  const statusPillStyle = (status: string) => {
    const base = { backgroundColor: NZ.pearl } as const;
    if (status === "accepted") {
      return { ...base, borderWidth: 1, borderColor: NZ.navy };
    }
    if (status === "rejected") {
      return { ...base, borderWidth: 1, borderColor: NZ.stone };
    }
    if (status === "completed") {
      return { ...base, borderWidth: 1, borderColor: NZ.ink };
    }
    return base;
  };

  const statusLabelColor = (status: string) => {
    if (status === "accepted") return NZ.navy;
    if (status === "rejected" || status === "completed") return NZ.stone;
    return NZ.ink;
  };

  const renderBookingCard = (item: BookingRequest, compact: boolean) => (
    <View
      style={{
        backgroundColor: NZ.cream,
        borderWidth: 1,
        borderColor: NZ.pearl,
        padding: compact ? 10 : 16,
        marginBottom: compact ? 8 : 12,
        borderRadius: compact ? 8 : 8,
        borderCurve: "continuous",
      }}
    >
      <View
        className="flex-row justify-between items-start"
        style={{ marginBottom: compact ? 6 : 8 }}
      >
        <View className="flex-1" style={{ paddingRight: 8 }}>
          <Text
            style={{
              color: NZ.ink,
              fontSize: compact ? 14 : 16,
              fontWeight: "600",
            }}
          >
            {item.user_name}
          </Text>
          <Text
            style={{ color: NZ.stone, fontSize: compact ? 11 : 14 }}
            numberOfLines={compact ? 1 : undefined}
            ellipsizeMode="tail"
          >
            {item.user_email}
          </Text>
          {!compact &&
            ((item.seller_phone || item.buyer_phone) ? (
              <View style={{ marginTop: 6, gap: 4 }}>
                {item.seller_phone ? (
                  <Pressable
                    onPress={() => void openPhoneDialer(item.seller_phone)}
                    hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                    accessibilityRole="link"
                    accessibilityLabel={`Call seller ${item.seller_phone}`}
                  >
                    <Text style={{ color: NZ.navy }} className="text-sm">
                      <Text style={{ color: NZ.stone }}>Seller (pickup): </Text>
                      {item.seller_phone}
                    </Text>
                  </Pressable>
                ) : null}
                {item.buyer_phone ? (
                  <Pressable
                    onPress={() => void openPhoneDialer(item.buyer_phone)}
                    hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                    accessibilityRole="link"
                    accessibilityLabel={`Call buyer ${item.buyer_phone}`}
                  >
                    <Text style={{ color: NZ.navy }} className="text-sm">
                      <Text style={{ color: NZ.stone }}>Buyer (delivery): </Text>
                      {item.buyer_phone}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : item.user_phone ? (
              <Pressable
                onPress={() => void openPhoneDialer(item.user_phone)}
                hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                className="mt-1"
                accessibilityRole="link"
                accessibilityLabel={`Call ${item.user_phone}`}
              >
                <Text style={{ color: NZ.navy }} className="text-sm">
                  <Text style={{ color: NZ.stone }}>Phone: </Text>
                  {item.user_phone}
                </Text>
              </Pressable>
            ) : null)}
          {compact && (item.seller_phone || item.buyer_phone || item.user_phone) ? (
            <View style={{ marginTop: 6, gap: 6 }}>
              {item.seller_phone ? (
                <Pressable
                  onPress={() => void openPhoneDialer(item.seller_phone)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="link"
                  accessibilityLabel={`Call seller ${item.seller_phone}`}
                >
                  <Text style={{ color: NZ.stone, fontSize: 10 }}>
                    Seller (pickup)
                  </Text>
                  <Text style={{ color: NZ.navy, fontSize: 12, fontWeight: "600" }}>
                    {item.seller_phone}
                  </Text>
                </Pressable>
              ) : null}
              {item.buyer_phone ? (
                <Pressable
                  onPress={() => void openPhoneDialer(item.buyer_phone)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="link"
                  accessibilityLabel={`Call buyer ${item.buyer_phone}`}
                >
                  <Text style={{ color: NZ.stone, fontSize: 10 }}>
                    Buyer (delivery)
                  </Text>
                  <Text style={{ color: NZ.navy, fontSize: 12, fontWeight: "600" }}>
                    {item.buyer_phone}
                  </Text>
                </Pressable>
              ) : null}
              {!item.seller_phone && !item.buyer_phone && item.user_phone ? (
                <Pressable
                  onPress={() => void openPhoneDialer(item.user_phone)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${item.user_phone}`}
                >
                  <Text style={{ color: NZ.stone, fontSize: 10 }}>Phone</Text>
                  <Text style={{ color: NZ.navy, fontSize: 12, fontWeight: "600" }}>
                    {item.user_phone}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        <View
          style={{
            paddingHorizontal: compact ? 6 : 10,
            paddingVertical: compact ? 2 : 4,
            borderRadius: 999,
            borderCurve: "continuous",
            ...statusPillStyle(item.status),
          }}
        >
          <Text
            style={{
              color: statusLabelColor(item.status),
              fontSize: compact ? 9 : 12,
              fontWeight: "600",
              letterSpacing: 0.3,
            }}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ marginBottom: compact ? 6 : 12 }}>
        {compact ? (
          <Text style={{ color: NZ.stone, fontSize: 11 }}>
            {item.booking_date} · {item.booking_time}
          </Text>
        ) : (
          <>
            <Text style={{ color: NZ.ink }} className="text-sm">
              <Text className="font-medium">Date:</Text> {item.booking_date}
            </Text>
            <Text style={{ color: NZ.ink }} className="text-sm">
              <Text className="font-medium">Time:</Text> {item.booking_time}
            </Text>
          </>
        )}
        {(() => {
          const line = messageLineForDriver(item.message);
          if (!line) return null;
          return (
            <Text
              style={{ color: NZ.ink, fontSize: compact ? 11 : 14, marginTop: 4 }}
              numberOfLines={compact ? 2 : undefined}
              ellipsizeMode="tail"
            >
              {!compact ? (
                <>
                  <Text className="font-medium">Message:</Text> {line}
                </>
              ) : (
                line
              )}
            </Text>
          );
        })()}
      </View>

      {item.pickup_latitude &&
        item.pickup_longitude &&
        item.delivery_latitude &&
        item.delivery_longitude &&
        (compact ? (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Pressable
              onPress={() => setSelectedBookingForMap(item)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: NZ.pearl,
                borderWidth: 1,
                borderColor: NZ.navy,
                paddingVertical: 8,
                borderRadius: 8,
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="map" size={16} color={NZ.navy} />
              <Text style={{ color: NZ.ink, fontSize: 12, fontWeight: "600" }}>
                Route
              </Text>
            </Pressable>
            <Pressable
              onPress={() => promptMongooseDirections(item)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: NZ.navy,
                paddingVertical: 8,
                borderRadius: 8,
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                Directions
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginBottom: 12 }}>
            <Pressable
              onPress={() => setSelectedBookingForMap(item)}
              style={{
                backgroundColor: NZ.pearl,
                borderWidth: 1,
                borderColor: NZ.navy,
                padding: 12,
                borderRadius: 8,
                borderCurve: "continuous",
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Ionicons name="map" size={20} color={NZ.navy} />
                  <Text
                    style={{ color: NZ.ink }}
                    className="ml-2 text-sm font-semibold"
                  >
                    Delivery route
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={NZ.navy} />
              </View>

              <View
                style={{
                  backgroundColor: NZ.cream,
                  padding: 8,
                  borderRadius: 6,
                  borderCurve: "continuous",
                  marginBottom: 4,
                }}
              >
                <View className="flex-row items-center mb-1">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      borderCurve: "continuous",
                      backgroundColor: NZ.ink,
                      marginRight: 8,
                    }}
                  />
                  <Text
                    style={{ color: NZ.ink }}
                    className="text-xs font-bold tracking-wide"
                  >
                    PICKUP (SELLER)
                  </Text>
                </View>
                <Text style={{ color: NZ.stone }} className="text-xs ml-4">
                  {item.pickup_address ||
                    `${item.pickup_latitude.toFixed(6)}, ${item.pickup_longitude.toFixed(6)}`}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: NZ.cream,
                  padding: 8,
                  borderRadius: 6,
                  borderCurve: "continuous",
                }}
              >
                <View className="flex-row items-center mb-1">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      borderCurve: "continuous",
                      backgroundColor: NZ.navy,
                      marginRight: 8,
                    }}
                  />
                  <Text
                    style={{ color: NZ.ink }}
                    className="text-xs font-bold tracking-wide"
                  >
                    DELIVERY (BUYER)
                  </Text>
                </View>
                <Text style={{ color: NZ.stone }} className="text-xs ml-4">
                  {item.delivery_address ||
                    `${item.delivery_latitude.toFixed(6)}, ${item.delivery_longitude.toFixed(6)}`}
                </Text>
              </View>

              <Text
                style={{ color: NZ.navy }}
                className="text-xs text-center mt-2 font-medium"
              >
                Tap to view on map
              </Text>
            </Pressable>
            <Pressable
              onPress={() => promptMongooseDirections(item)}
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: NZ.navy,
                paddingVertical: 12,
                borderRadius: 8,
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={{ color: "#fff" }} className="font-semibold">
                Get directions
              </Text>
            </Pressable>
          </View>
        ))}

      {normalizeBookingStatus(item.status) === "pending" && (
        <View style={{ flexDirection: "row", gap: compact ? 8 : 12 }}>
          <Pressable
            onPress={() => handleBookingAction(item.id, "accept")}
            style={{
              backgroundColor: NZ.navy,
              flex: 1,
              paddingVertical: compact ? 9 : 12,
              borderRadius: 8,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: compact ? 13 : 16 }}>
              Accept
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleBookingAction(item.id, "reject")}
            style={{
              borderWidth: 1.5,
              borderColor: NZ.ink,
              backgroundColor: NZ.cream,
              flex: 1,
              paddingVertical: compact ? 9 : 12,
              borderRadius: 8,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: NZ.ink, fontWeight: "600", fontSize: compact ? 13 : 16 }}>
              Reject
            </Text>
          </Pressable>
        </View>
      )}

      {normalizeBookingStatus(item.status) === "accepted" && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <LocationTrackingControl
                bookingId={item.id}
                bookingUserName={item.user_name}
              />
            </View>
            <Pressable
              onPress={() => handleCompleteBooking(item.id, item.user_name)}
              style={{
                backgroundColor: NZ.navy,
                flex: 1,
                paddingVertical: compact ? 9 : 12,
                borderRadius: 8,
                borderCurve: "continuous",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons name="checkmark-done" size={compact ? 18 : 20} color="white" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: compact ? 13 : 16 }}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {normalizeBookingStatus(item.status) === "rejected" && (
        <View style={{ flexDirection: "row", gap: compact ? 8 : 12 }}>
          <Pressable
            onPress={() => handleBookingAction(item.id, "accept")}
            style={{
              backgroundColor: NZ.navy,
              flex: 1,
              paddingVertical: compact ? 9 : 12,
              borderRadius: 8,
              borderCurve: "continuous",
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="refresh" size={compact ? 16 : 18} color="white" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: compact ? 13 : 16 }}>
              Accept
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleCompleteBooking(item.id, item.user_name)}
            style={{
              borderWidth: 1.5,
              borderColor: NZ.ink,
              backgroundColor: NZ.cream,
              flex: 1,
              paddingVertical: compact ? 9 : 12,
              borderRadius: 8,
              borderCurve: "continuous",
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="trash-outline" size={compact ? 16 : 18} color={NZ.ink} />
            <Text style={{ color: NZ.ink, fontWeight: "600", fontSize: compact ? 13 : 16 }}>
              Delete
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: NZ.cream }}>
      <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
      {loading ? (
        <View
          style={{ flex: 1, backgroundColor: NZ.cream, justifyContent: "center", alignItems: "center" }}
        >
          <CircularLoader size="large" color={NZ.navy} />
          <Text style={{ color: NZ.stone, marginTop: 16 }} className="text-base">
            Loading dashboard
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              paddingTop: 48,
              paddingBottom: 20,
              paddingHorizontal: 16,
              backgroundColor: NZ.cream,
              borderBottomWidth: 1,
              borderBottomColor: NZ.pearl,
            }}
          >
            <View className="flex-row justify-between items-center">
              <Text style={{ color: NZ.ink }} className="text-2xl font-bold">
                Mongoose dashboard
              </Text>
              <Pressable
                onPress={handleLogout}
                style={{
                  backgroundColor: NZ.pearl,
                  padding: 10,
                  borderRadius: 999,
                  borderCurve: "continuous",
                }}
              >
                <Ionicons name="log-out-outline" size={22} color={NZ.navy} />
              </Pressable>
            </View>
            <Text style={{ color: NZ.stone, marginTop: 6 }} className="text-sm">
              {currentUser?.name || "Mongoose"}
            </Text>
          </View>

          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={NZ.navy}
                colors={[NZ.navy]}
              />
            }
            contentContainerStyle={{
              padding: 16,
              paddingBottom:
                16 + insets.bottom + MONGOOSE_WORKER_NAV_BAR_HEIGHT + 12,
            }}
          >
            <View
              style={{
                backgroundColor: NZ.cream,
                borderWidth: 1,
                borderColor: NZ.pearl,
                padding: 20,
                borderRadius: 8,
                borderCurve: "continuous",
                marginBottom: 16,
              }}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 pr-2">
                  <Text style={{ color: NZ.ink }} className="text-lg font-semibold mb-1">
                    Availability
                  </Text>
                  <Text style={{ color: NZ.stone }} className="text-sm">
                    {isAvailable
                      ? "You are accepting new booking requests."
                      : "You are not accepting new requests."}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  {updatingStatus && (
                    <CircularLoader
                      size="small"
                      color={NZ.navy}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Switch
                    value={isAvailable}
                    onValueChange={toggleAvailability}
                    trackColor={{ false: NZ.pearl, true: "#c5d6e0" }}
                    thumbColor={isAvailable ? NZ.navy : "#f8f8f8"}
                    disabled={updatingStatus}
                  />
                </View>
              </View>
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  borderCurve: "continuous",
                  backgroundColor: isAvailable ? NZ.pearl : NZ.cream,
                  borderWidth: 1,
                  borderColor: isAvailable ? NZ.navy : NZ.pearl,
                }}
              >
                <Text
                  style={{ color: isAvailable ? NZ.navy : NZ.stone }}
                  className="text-center font-medium text-sm"
                >
                  {isAvailable
                    ? "Available for bookings"
                    : "Not available"}
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text style={{ color: NZ.ink }} className="text-xl font-bold">
                  Booking requests
                </Text>
                <View
                  style={{
                    backgroundColor: NZ.pearl,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: NZ.navy,
                  }}
                >
                  <Text style={{ color: NZ.navy }} className="font-semibold text-sm">
                    {bookingRequests.length}
                  </Text>
                </View>
              </View>

              {bookingRequests.length === 0 ? (
                <View
                  style={{
                    backgroundColor: NZ.cream,
                    borderWidth: 1,
                    borderColor: NZ.pearl,
                    padding: 32,
                    borderRadius: 8,
                    borderCurve: "continuous",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="calendar-outline" size={44} color={NZ.stone} />
                  <Text style={{ color: NZ.stone }} className="mt-3 text-center text-sm">
                    No booking requests yet.
                  </Text>
                </View>
              ) : (
                <>
                  {(prioritySummary.pending > 0 ||
                    prioritySummary.active > 0) && (
                    <Text
                      style={{
                        color: NZ.navy,
                        fontSize: 12,
                        marginBottom: 10,
                        fontWeight: "600",
                      }}
                    >
                      {[
                        prioritySummary.pending > 0
                          ? `${prioritySummary.pending} pending`
                          : null,
                        prioritySummary.active > 0
                          ? `${prioritySummary.active} in progress`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                  {bookingSections.map((section, si) => (
                    <React.Fragment key={section.key}>
                      <View
                        style={{
                          marginTop: si === 0 ? 0 : 18,
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: NZ.ink,
                            fontSize: section.compact ? 13 : 16,
                            fontWeight: "700",
                          }}
                        >
                          {section.title}
                          <Text
                            style={{
                              color: NZ.stone,
                              fontWeight: "500",
                              fontSize: section.compact ? 11 : 13,
                            }}
                          >
                            {" "}
                            ({section.data.length})
                          </Text>
                        </Text>
                        {section.hint ? (
                          <Text
                            style={{
                              color: NZ.stone,
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            {section.hint}
                          </Text>
                        ) : null}
                      </View>
                      {section.data.map((item) => (
                        <React.Fragment key={item.id}>
                          {renderBookingCard(item, section.compact)}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </>
              )}
            </View>
          </ScrollView>

          <MongooseWorkerNavBar />

          {/* Map Modal */}
          <Modal
            visible={!!selectedBookingForMap}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedBookingForMap(null)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(28, 22, 20, 0.45)" }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: NZ.cream,
                  marginTop: 48,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  borderCurve: "continuous",
                }}
              >
                <View
                  style={{
                    backgroundColor: NZ.cream,
                    borderBottomWidth: 1,
                    borderBottomColor: NZ.pearl,
                    padding: 16,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderCurve: "continuous",
                  }}
                >
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text style={{ color: NZ.ink }} className="text-xl font-bold">
                        Delivery route
                      </Text>
                      <Text style={{ color: NZ.stone }} className="text-sm">
                        {selectedBookingForMap?.user_name}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setSelectedBookingForMap(null)}
                      style={{
                        backgroundColor: NZ.pearl,
                        padding: 8,
                        borderRadius: 999,
                        borderCurve: "continuous",
                      }}
                    >
                      <Ionicons name="close" size={24} color={NZ.ink} />
                    </Pressable>
                  </View>

                  <View className="flex-row flex-wrap gap-4 mt-3">
                    <View className="flex-row items-center">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          borderCurve: "continuous",
                          backgroundColor: NZ.ink,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ color: NZ.ink }} className="text-xs">
                        Pickup (seller)
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          borderCurve: "continuous",
                          backgroundColor: NZ.navy,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ color: NZ.ink }} className="text-xs">
                        Delivery (buyer)
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2 mt-3">
                    {(["standard", "satellite", "hybrid"] as const).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setMapType(t)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderCurve: "continuous",
                          backgroundColor: mapType === t ? NZ.navy : NZ.pearl,
                        }}
                      >
                        <Text
                          style={{
                            color: mapType === t ? "#fff" : NZ.ink,
                          }}
                          className="text-xs font-semibold text-center capitalize"
                        >
                          {t}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={() =>
                      promptMongooseDirections(selectedBookingForMap)
                    }
                    style={{
                      marginTop: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: NZ.navy,
                      paddingVertical: 12,
                      borderRadius: 8,
                      borderCurve: "continuous",
                    }}
                  >
                    <Ionicons name="navigate" size={18} color="#fff" />
                    <Text style={{ color: "#fff" }} className="font-semibold">
                      Get directions
                    </Text>
                  </Pressable>
                </View>

                {selectedBookingForMap &&
                  selectedBookingForMap.pickup_latitude &&
                  selectedBookingForMap.pickup_longitude &&
                  selectedBookingForMap.delivery_latitude &&
                  selectedBookingForMap.delivery_longitude && (
                    <View
                      style={{
                        flex: 1,
                        minHeight:
                          Platform.OS === "android"
                            ? Math.max(320, Dimensions.get("window").height * 0.38)
                            : 280,
                      }}
                      collapsable={false}
                    >
                      {routeLoading && (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 2,
                            paddingVertical: 10,
                            alignItems: "center",
                          }}
                          pointerEvents="none"
                        >
                          <View
                            style={{
                              backgroundColor: "rgba(253,250,245,0.92)",
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 8,
                              borderCurve: "continuous",
                              borderWidth: 1,
                              borderColor: NZ.pearl,
                            }}
                          >
                            <Text style={{ color: NZ.stone, fontSize: 12 }}>
                              Loading driving route…
                            </Text>
                          </View>
                        </View>
                      )}
                      <MapView
                        ref={mapRef}
                        provider={androidMapProvider()}
                        mapType={mapType}
                        style={{ flex: 1, width: "100%" }}
                        toolbarEnabled={false}
                        moveOnMarkerPress={false}
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
                            ) *
                              2 || 0.05,
                          longitudeDelta:
                            Math.abs(
                              selectedBookingForMap.pickup_longitude -
                                selectedBookingForMap.delivery_longitude,
                            ) *
                              2 || 0.05,
                        }}
                        showsUserLocation
                        showsMyLocationButton
                      >
                        {routeCoordinates.length > 1 && (
                          <Polyline
                            coordinates={routeCoordinates}
                            strokeColor={NZ.navy}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                            geodesic={false}
                          />
                        )}
                      <MapPinMarker
                        coordinate={{
                          latitude: selectedBookingForMap.pickup_latitude,
                          longitude: selectedBookingForMap.pickup_longitude,
                        }}
                        preset="pickup"
                        size={46}
                        title="Pickup (seller)"
                        description={
                          selectedBookingForMap.pickup_address ||
                          "Seller location"
                        }
                      />
                      <MapPinMarker
                        coordinate={{
                          latitude: selectedBookingForMap.delivery_latitude,
                          longitude: selectedBookingForMap.delivery_longitude,
                        }}
                        preset="delivery"
                        size={46}
                        title="Delivery (buyer)"
                        description={
                          selectedBookingForMap.delivery_address ||
                          "Buyer location"
                        }
                      />
                    </MapView>
                    </View>
                  )}

                <View
                  style={{
                    backgroundColor: NZ.cream,
                    borderTopWidth: 1,
                    borderTopColor: NZ.pearl,
                    padding: 16,
                  }}
                >
                  <View style={{ gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: NZ.pearl,
                        borderWidth: 1,
                        borderColor: NZ.ink,
                        padding: 12,
                        borderRadius: 8,
                        borderCurve: "continuous",
                      }}
                    >
                      <View className="flex-row items-center mb-1">
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            borderCurve: "continuous",
                            backgroundColor: NZ.ink,
                            marginRight: 8,
                          }}
                        />
                        <Text style={{ color: NZ.ink }} className="text-xs font-bold tracking-wide">
                          PICKUP (SELLER)
                        </Text>
                      </View>
                      <Text style={{ color: NZ.stone }} className="text-xs ml-5">
                        {selectedBookingForMap?.pickup_address ||
                          `${selectedBookingForMap?.pickup_latitude?.toFixed(6)}, ${selectedBookingForMap?.pickup_longitude?.toFixed(6)}`}
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: NZ.pearl,
                        borderWidth: 1,
                        borderColor: NZ.navy,
                        padding: 12,
                        borderRadius: 8,
                        borderCurve: "continuous",
                      }}
                    >
                      <View className="flex-row items-center mb-1">
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            borderCurve: "continuous",
                            backgroundColor: NZ.navy,
                            marginRight: 8,
                          }}
                        />
                        <Text style={{ color: NZ.ink }} className="text-xs font-bold tracking-wide">
                          DELIVERY (BUYER)
                        </Text>
                      </View>
                      <Text style={{ color: NZ.stone }} className="text-xs ml-5">
                        {selectedBookingForMap?.delivery_address ||
                          `${selectedBookingForMap?.delivery_latitude?.toFixed(6)}, ${selectedBookingForMap?.delivery_longitude?.toFixed(6)}`}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      marginTop: 12,
                      backgroundColor: NZ.pearl,
                      padding: 12,
                      borderRadius: 8,
                      borderCurve: "continuous",
                    }}
                  >
                    <Text style={{ color: NZ.stone }} className="text-xs">
                      <Text style={{ color: NZ.ink }} className="font-semibold">
                        Date:
                      </Text>{" "}
                      {selectedBookingForMap?.booking_date}
                    </Text>
                    <Text style={{ color: NZ.stone }} className="text-xs mt-1">
                      <Text style={{ color: NZ.ink }} className="font-semibold">
                        Time:
                      </Text>{" "}
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
