/**
 * A log's day.
 *
 * The screen is the chrome and the data; the grid itself is
 * `components/setlog/SetlogDayGrid.tsx`, shared with the Dev Components
 * preview so the layout can be judged without first living an afternoon
 * inside a log.
 *
 * There is no like count, no follower count and no ordering by anything but
 * the clock. That is the product, not an omission: a log is for keeping up
 * with people, not for placing against them. The header's one text action
 * is Invite, because a log that nobody else is in does nothing.
 */

import SetlogDayGrid from "@/components/setlog/SetlogDayGrid";
import SlotPlayer from "@/components/setlog/SlotPlayer";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import EdgeSwipeBack from "@/components/ui/EdgeSwipeBack";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import {
  currentSlot,
  getDay,
  getMembers,
  getSetlog,
  localDay,
  resolveUserId,
  setlogDisplayName,
  type Setlog,
  type SetlogMember,
  type SetlogSlot,
} from "@/lib/setlogService";
import { useAppRouter } from "@/utils/navigation";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SetlogDayScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const setlogId = String(id);

  const [log, setLog] = useState<Setlog | null>(null);
  const [members, setMembers] = useState<SetlogMember[]>([]);
  const [slots, setSlots] = useState<SetlogSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [openSlot, setOpenSlot] = useState<SetlogSlot | null>(null);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "white", title: "", message: "" });

  const day = localDay();
  // Held in state, not read at render: the hour turning over is the whole
  // mechanic, and this screen is one people leave open. Checked once a
  // minute, and the state only changes on the turn, so it re-renders 24
  // times a day.
  const [now, setNow] = useState(() => currentSlot());
  useEffect(() => {
    const tick = setInterval(() => {
      const next = currentSlot();
      setNow((prev) =>
        prev.day === next.day && prev.hour === next.hour ? prev : next,
      );
    }, 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    resolveUserId(currentUser?.id).then(setUid);
  }, [currentUser?.id]);

  const load = useCallback(async () => {
    try {
      const [l, m, d] = await Promise.all([
        getSetlog(setlogId),
        getMembers(setlogId),
        getDay(setlogId, day),
      ]);
      setLog(l);
      setMembers(m);
      setSlots(d);
    } catch (e) {
      console.error("Error loading setlog day:", e);
    } finally {
      setLoading(false);
    }
  }, [setlogId, day]);

  // Refetched on focus rather than only on mount: the camera is a screen
  // pushed on top of this one, so the clip you just recorded arrives on the
  // way back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [now.hour, now.day, load]);

  const memberById = useMemo(() => {
    const m = new Map<string, SetlogMember>();
    for (const member of members) m.set(member.userId, member);
    return m;
  }, [members]);

  const copyInvite = async () => {
    if (!log) return;
    await Clipboard.setStringAsync(log.inviteCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPopup({
      visible: true,
      type: "success",
      title: "Code copied",
      message: `Send ${log.inviteCode} to whoever you want in this log. Up to ${log.memberCap} people.`,
    });
  };

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
      <View
        style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}
      >
        <StatusBar barStyle="dark-content" />

        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />

        {/* § Header — chevron, centred title, one text action. */}
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
            <Text
              numberOfLines={1}
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: "#111827",
                maxWidth: "60%",
              }}
            >
              {log ? setlogDisplayName(log) : "Log"}
            </Text>
          </View>
          <TouchableOpacity onPress={copyInvite} style={{ padding: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: "500", color: "#0369A1" }}>
              Invite
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <SetlogDayGrid
            slots={slots}
            members={members}
            currentUserId={uid}
            currentHour={now.hour}
            loading={loading}
            onRecord={(hour) =>
              router.push(`/(users)/setlog/capture?id=${setlogId}&hour=${hour}`)
            }
            onOpen={setOpenSlot}
          />
        </ScrollView>

        <SlotPlayer
          slot={openSlot}
          members={memberById}
          currentUserId={uid}
          onClose={() => setOpenSlot(null)}
        />
      </View>
    </EdgeSwipeBack>
  );
}
