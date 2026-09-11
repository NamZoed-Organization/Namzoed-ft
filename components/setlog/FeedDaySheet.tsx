/**
 * Which day the Setlog feed is showing.
 *
 * Three answers in one sheet: today, any single day off a calendar, or all
 * of it. They are one decision — "how far back am I looking" — so they are
 * one sheet rather than a filter row plus a date picker hidden behind it.
 *
 * A day is `YYYY-MM-DD` in the recorder's own local time, matching the
 * `day` column, and `null` means no filter at all. Collapsing "today" into
 * "the day that today is" keeps one value on the wire instead of a mode and
 * a date that can disagree.
 *
 * The calendar is `SetlogCalendar`, this app's own, and not the platform
 * picker it replaced: the days worth going back to are the days with
 * something in them, and only this app knows which those are — a native
 * picker draws every day alike. Marks are loaded a month at a time, for the
 * scope the feed is showing, so the calendar and the feed under it can
 * never disagree about whose clips count.
 */

import BottomSheetModal from "@/components/modals/BottomSheetModal";
import SetlogCalendar from "@/components/setlog/SetlogCalendar";
import {
  listLoggedDays,
  localDay,
  monthOf,
  peekLoggedDays,
  type FeedScope,
} from "@/lib/setlogService";
import * as Haptics from "expo-haptics";
import { CalendarDays, Check, Infinity as InfinityIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface FeedDaySheetProps {
  visible: boolean;
  onClose: () => void;
  /** `null` is all time. */
  day: string | null;
  onChange: (day: string | null) => void;
  /** Whose clips the feed is showing, so the marks match it. */
  scope?: FeedScope;
  /** Whose calendar it is. */
  userId?: string | null;
}

function Row({
  icon,
  label,
  selected,
  onPress,
  first,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      {!first && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 16 + 28,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: "#f0f0f0",
          }}
        />
      )}
      <View style={{ width: 28 }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 17, fontWeight: "500", color: "#111" }}>
        {label}
      </Text>
      {selected && <Check size={19} color="#0369A1" strokeWidth={2.2} />}
    </TouchableOpacity>
  );
}

export default function FeedDaySheet({
  visible,
  onClose,
  day,
  onChange,
  scope = "mine",
  userId,
}: FeedDaySheetProps) {
  const today = localDay();
  const [showCalendar, setShowCalendar] = useState(false);
  const [month, setMonth] = useState(() => monthOf(day ?? today));
  const [markedDays, setMarkedDays] = useState<Set<string>>(new Set());

  // The calendar opens on the month of the day being shown, not on whatever
  // month was last looked at — the sheet is a caption on the feed, and the
  // feed has moved on since.
  useEffect(() => {
    if (!visible) return;
    setMonth(monthOf(day ?? today));
    // Opened on a day that came off the calendar, the calendar is what you
    // want to see — with that day already on it.
    setShowCalendar(day != null && day !== today);
  }, [visible, day, today]);

  /**
   * The month's marks: whatever is already in hand first — so a month
   * looked at before opens with its marks already on rather than painting
   * them a moment later — then the answer from the server.
   */
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setMarkedDays(new Set(peekLoggedDays(userId, month, scope) ?? []));
    listLoggedDays(userId, month, scope)
      .then((days) => {
        if (alive) setMarkedDays(new Set(days));
      })
      // A month whose marks fail to load is a plain calendar, not a broken
      // sheet: picking a day still works.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, month, scope, userId]);

  const pick = (next: string | null) => {
    Haptics.selectionAsync();
    onChange(next);
    setShowCalendar(false);
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="82%">
      {(close) => (
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 4,
              paddingBottom: 14,
            }}
          >
            <TouchableOpacity onPress={close} style={{ padding: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: "500", color: "#6B7280" }}>
                Cancel
              </Text>
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
                Show
              </Text>
            </View>
            <View style={{ width: 56 }} />
          </View>

          {/* The sheet's cap is a percentage of the screen, and nothing
              inside it scrolls on its own — so on a short phone a month
              would simply be cut off. The rows scroll with it rather than
              the calendar scrolling inside the sheet, which would be a
              second scroll surface for the sake of six rows. */}
          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {/* One white group on the grey (§ Groups and rows). */}
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 18,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              <Row
                first
                icon={<CalendarDays size={20} color="#111" strokeWidth={1.8} />}
                label="Today"
                selected={day === today}
                onPress={() => pick(today)}
              />
              <Row
                icon={<CalendarDays size={20} color="#111" strokeWidth={1.8} />}
                label="A day…"
                selected={day != null && day !== today}
                onPress={() => setShowCalendar((v) => !v)}
              />
              <Row
                icon={<InfinityIcon size={20} color="#111" strokeWidth={1.8} />}
                label="All time"
                selected={day == null}
                onPress={() => pick(null)}
              />
            </View>

            {showCalendar && (
              <View style={{ marginTop: 14 }}>
                <SetlogCalendar
                  month={month}
                  selected={day}
                  markedDays={markedDays}
                  onMonthChange={setMonth}
                  onSelect={pick}
                />
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </BottomSheetModal>
  );
}
