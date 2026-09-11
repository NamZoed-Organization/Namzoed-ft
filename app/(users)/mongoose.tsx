/**
 * Mongoose delivery
 *
 * The list of delivery riders, whether each is free, and where your own
 * booking stands. This was the second tab on the Messages screen until
 * Setlog took that slot; it is reached from the drawer now
 * (`components/modals/HamburgerMenu.tsx`), which is where the app's other
 * standalone destinations live.
 *
 * Nothing about the rows changed in the move: one white group on the grey,
 * one action per row and only the live one, availability as words rather
 * than coloured chips (§ People lists, § Icons).
 */

import BookMongooseModal from "@/components/BookMongooseModal";
import TrackMongooseModal from "@/components/modals/TrackMongooseModal";
import { CONVERSATION_GROUP_RADIUS } from "@/components/messages/ConversationRow";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import EdgeSwipeBack from "@/components/ui/EdgeSwipeBack";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { Bike, ChevronLeft, Navigation } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  InteractionManager,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 16;

const EMPTY_TEXT = {
  fontSize: 16,
  lineHeight: 22,
  color: "#9CA3AF",
  textAlign: "center",
  paddingHorizontal: 24,
  paddingTop: 32,
} as const;

export default function MongooseScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();

  const [mongooseUsers, setMongooseUsers] = useState<any[]>([]);
  const [isLoadingMongoose, setIsLoadingMongoose] = useState(false);
  const [mongooseBookings, setMongooseBookings] = useState<any[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedBookingForTracking, setSelectedBookingForTracking] =
    useState<any>(null);
  const bookingsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Riders are profiles whose email starts with the Mongoose service address.
  const fetchMongooseUsers = useCallback(async () => {
    setIsLoadingMongoose(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", "mongoose@gmail.com%")
        .order("name", { ascending: true });
      if (error) throw error;
      setMongooseUsers(data || []);
    } catch (e) {
      console.error("Error fetching mongoose users:", e);
      setMongooseUsers([]);
    } finally {
      setIsLoadingMongoose(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchMongooseUsers();
    });
    return () => task.cancel();
  }, [fetchMongooseUsers]);

  // Every booking, not just this user's: whether a rider is free depends on
  // whoever booked them, which may well be somebody else.
  const fetchMongooseBookings = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMongooseBookings(data || []);
    } catch (e) {
      console.error("Error fetching mongoose bookings:", e);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchMongooseBookings();
    });
    return () => task.cancel();
  }, [currentUser?.id, fetchMongooseBookings]);

  // Live booking updates, with an 8s poll as the fallback when the realtime
  // channel can't be established.
  useEffect(() => {
    if (!currentUser?.id) return;
    let isSubscribed = true;

    const channel = supabase
      .channel(`all_bookings_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_requests" },
        (payload) => {
          if (!isSubscribed) return;
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const next = payload.new as any;
            setMongooseBookings((prev) =>
              [next, ...prev.filter((b) => b.id !== next.id)].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const gone = payload.old as any;
            setMongooseBookings((prev) => prev.filter((b) => b.id !== gone.id));
          }
        },
      )
      .subscribe((status) => {
        if (!isSubscribed) return;
        if (status === "SUBSCRIBED") {
          if (bookingsPollRef.current) {
            clearInterval(bookingsPollRef.current);
            bookingsPollRef.current = null;
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!bookingsPollRef.current) {
            bookingsPollRef.current = setInterval(() => {
              if (isSubscribed) fetchMongooseBookings();
            }, 8000);
          }
        }
      });

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
      if (bookingsPollRef.current) {
        clearInterval(bookingsPollRef.current);
        bookingsPollRef.current = null;
      }
    };
  }, [currentUser?.id, fetchMongooseBookings]);

  const renderMongooseUserItem = ({
    item: user,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const userName =
      user.name || user.username || user.full_name || "Mongoose User";
    const userEmail = user.email || "No email";

    const userBooking = mongooseBookings
      .filter(
        (b) => b.mongoose_email === userEmail && b.user_id === currentUser?.id,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

    const isBusy = mongooseBookings.some(
      (b) => b.mongoose_email === userEmail && b.status === "accepted",
    );

    const hasLocationData =
      userBooking?.pickup_latitude && userBooking?.delivery_latitude;

    // The row's one secondary line. Availability and your own booking are
    // the two things worth knowing here, and both are text — the four
    // coloured status chips this replaced were per-item colour coding
    // (§ Icons) carrying information the words already carry.
    const bookingLabel: Record<string, string> = {
      pending: "Your booking is pending",
      accepted: "Your booking was accepted",
      rejected: "Your booking was declined",
      completed: "Your booking was delivered",
    };
    const secondary = userBooking
      ? bookingLabel[userBooking.status] || userEmail
      : isBusy
        ? "On a delivery"
        : "Available";

    // One action per row, and only the live one. "Booked" and "Done" were
    // buttons that did nothing.
    let action: React.ReactNode = null;
    if (userBooking?.status === "accepted" && hasLocationData) {
      action = (
        <TouchableOpacity
          onPress={() => {
            setSelectedBookingForTracking(userBooking);
            setShowTrackingModal(true);
          }}
          activeOpacity={0.75}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 999,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            paddingVertical: 7,
            backgroundColor: "#0369A1",
          }}
        >
          <Navigation size={14} color="#fff" strokeWidth={1.8} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>Track</Text>
        </TouchableOpacity>
      );
    } else if (!userBooking) {
      action = (
        <TouchableOpacity
          onPress={() => !isBusy && setShowBookingModal(true)}
          disabled={isBusy}
          activeOpacity={0.75}
          style={{
            borderRadius: 999,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            paddingVertical: 7,
            backgroundColor: isBusy ? "#F5F5F5" : "#0369A1",
          }}
        >
          <Text
            style={{ fontSize: 13, fontWeight: "600", color: isBusy ? "#9CA3AF" : "#fff" }}
          >
            Book
          </Text>
        </TouchableOpacity>
      );
    }

    const first = index === 0;
    const last = index === mongooseUsers.length - 1;

    return (
      <View
        style={{
          marginHorizontal: GROUP_INSET,
          backgroundColor: "#fff",
          borderTopLeftRadius: first ? CONVERSATION_GROUP_RADIUS : 0,
          borderTopRightRadius: first ? CONVERSATION_GROUP_RADIUS : 0,
          borderBottomLeftRadius: last ? CONVERSATION_GROUP_RADIUS : 0,
          borderBottomRightRadius: last ? CONVERSATION_GROUP_RADIUS : 0,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        {!first && (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: "#f0f0f0",
              marginLeft: 16 + 44 + 12,
            }}
          />
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderCurve: "continuous",
              backgroundColor: "#F5F5F5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bike size={20} color="#9CA3AF" strokeWidth={1.8} />
          </View>

          <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}
            >
              {userName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
              {secondary}
            </Text>
          </View>

          {action}
        </View>
      </View>
    );
  };

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
      <View
        style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}
      >
        <StatusBar barStyle="dark-content" />

        {/* § Header — chevron, centred title, a spacer where the one text
            action would go. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 2,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>
              Mongoose
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          data={mongooseUsers}
          renderItem={renderMongooseUserItem}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={EMPTY_TEXT}>
              {isLoadingMongoose
                ? "Loading…"
                : "No delivery support is set up yet."}
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />

        <BookMongooseModal
          visible={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            fetchMongooseBookings();
          }}
        />

        {selectedBookingForTracking && (
          <TrackMongooseModal
            visible={showTrackingModal}
            onClose={() => {
              setShowTrackingModal(false);
              setSelectedBookingForTracking(null);
            }}
            booking={selectedBookingForTracking}
          />
        )}
      </View>
    </EdgeSwipeBack>
  );
}
