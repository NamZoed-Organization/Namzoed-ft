/**
 * The month you pick a past day out of, with the days you recorded marked.
 *
 * This is the app's own calendar rather than `DateTimePicker`, and the
 * reason is the mark: a native picker draws the days a phone knows about
 * and nothing this app knows about, so every day in it looks alike and the
 * one thing worth knowing — *which days have anything in them* — cannot be
 * shown. A day with a log carries the Namzoed mark under its number, which
 * is the same thing the shutter does inside the camera's ring: it says
 * whose recording it was.
 *
 * Drawing it also ends the platform split it replaced. The native picker is
 * a squat wheel on one platform and a dialog owned by the activity window
 * on the other — which is why the Android one had to be opened imperatively
 * to keep it from landing *behind* the sheet — and this is one calendar,
 * in the sheet, identical on both.
 *
 * The month on screen is the caller's state, so it can fetch that month's
 * marks; `components/dev/SetlogPreview.tsx` renders it on fixtures.
 */

import { localDay } from "@/lib/setlogService";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useMemo } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

/** Sunday first, initials only — a seven-column grid has no room for more,
 *  and the row is a ruler rather than something to read. */
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const CELL_HEIGHT = 46;
const DISC = 32;
/** Small enough to read as a mark on the day rather than a second glyph
 *  competing with its number. */
const MARK = 13;

const ACCENT = "#094569";

/** "2026-09" → the first of that month, at local midnight. */
const monthStart = (month: string): Date => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1);
};

export const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The month `delta` months from this one — `Date` normalises the year. */
export const shiftMonth = (month: string, delta: number): string => {
  const d = monthStart(month);
  d.setMonth(d.getMonth() + delta);
  return monthKey(d);
};

export default function SetlogCalendar({
  month,
  selected,
  markedDays,
  onMonthChange,
  onSelect,
}: {
  /** `YYYY-MM`, the month on screen. */
  month: string;
  /** `YYYY-MM-DD`, or `null` when no single day is being shown. */
  selected: string | null;
  /** The days of this month that have clips in them. */
  markedDays: Set<string>;
  onMonthChange: (month: string) => void;
  onSelect: (day: string) => void;
}) {
  const today = localDay();
  const thisMonth = today.slice(0, 7);

  /** The cells of the grid: leading blanks so the first lands on its
   *  weekday, then the days. Trailing blanks are unnecessary — the last row
   *  simply ends. */
  const cells = useMemo(() => {
    const start = monthStart(month);
    const daysInMonth = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    const lead: (string | null)[] = Array.from(
      { length: start.getDay() },
      () => null,
    );
    return [
      ...lead,
      ...Array.from(
        { length: daysInMonth },
        (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
      ),
    ];
  }, [month]);

  const title = monthStart(month).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Nothing was recorded in the future, so the calendar does not walk into
  // months that can only come back empty.
  const canGoForward = month < thisMonth;

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        borderCurve: "continuous",
        overflow: "hidden",
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 10,
      }}
    >
      {/* Which month, and the way to the ones either side. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 6,
          paddingVertical: 8,
        }}
      >
        <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => onMonthChange(shiftMonth(month, -1))}
            hitSlop={8}
            style={{ padding: 6 }}
          >
            <ChevronLeft size={20} color="#111" strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.6}
            disabled={!canGoForward}
            onPress={() => onMonthChange(shiftMonth(month, 1))}
            hitSlop={8}
            style={{ padding: 6, opacity: canGoForward ? 1 : 0.25 }}
          >
            <ChevronRight size={20} color="#111" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", paddingBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#9CA3AF" }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((day, i) => {
          if (!day) {
            return <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, height: CELL_HEIGHT }} />;
          }
          const isSelected = day === selected;
          const isToday = day === today;
          const isFuture = day > today;
          const marked = markedDays.has(day);

          return (
            <TouchableOpacity
              key={day}
              activeOpacity={0.7}
              disabled={isFuture}
              onPress={() => onSelect(day)}
              style={{
                width: `${100 / 7}%`,
                height: CELL_HEIGHT,
                alignItems: "center",
                justifyContent: "flex-start",
                paddingTop: 1,
              }}
            >
              <View
                style={{
                  width: DISC,
                  height: DISC,
                  borderRadius: DISC / 2,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? ACCENT : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected || isToday ? "700" : "500",
                    color: isSelected
                      ? "#fff"
                      : isFuture
                        ? "#D1D5DB"
                        : isToday
                          ? ACCENT
                          : "#111",
                  }}
                >
                  {Number(day.slice(8))}
                </Text>
              </View>
              {/* The mark sits under the number rather than behind it: a day
                  is a number first, and a logo the number had to be read
                  through would cost more than it says. The row keeps its
                  height either way, so a month of marks and a month without
                  are the same grid. */}
              <View style={{ height: MARK, marginTop: 1, justifyContent: "center" }}>
                {marked && (
                  <Image
                    source={require("@/assets/images/logo.png")}
                    style={{ width: MARK, height: MARK }}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
