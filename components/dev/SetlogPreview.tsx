/**
 * Setlog on fixtures.
 *
 * Both halves of the feature need a day's worth of data before they look
 * like anything — a log list with nobody in it says nothing about how a
 * busy log reads, and the day grid is entirely about which hours are full.
 * So the real components render here against invented clips: the feed's
 * cards and rows for the Messages tab's second tab, `SetlogDayGrid` for
 * the log screen. The cards have no video behind them here — a fixture
 * cannot conjure a signed clip URL — so what this checks is the geometry,
 * the stamp and the by-line, which is what the layout is made of.
 *
 * States worth checking: an hour you haven't recorded yet (the accent tile
 * and the Record pill), an hour you have, a log with nothing in it today,
 * and no logs at all.
 */

import SetlogCalendar, { monthKey } from "@/components/setlog/SetlogCalendar";
import SquadLogs from "@/components/setlog/SquadLogs";
import SetlogDayGrid from "@/components/setlog/SetlogDayGrid";
import {
  FeedDayLabel,
  FeedFooter,
  SetlogClipCard,
  SetlogEmptyCard,
  SETLOG_GROUP_INSET,
} from "@/components/setlog/SetlogFeed";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import {
  formatDay,
  formatHour,
  localDay,
  type SetlogFeedItem,
  type SetlogSlot,
  type SquadLogSummary,
} from "@/lib/setlogService";
import SetlogNavBar, {
  SETLOG_NAV_HEIGHT,
} from "@/components/setlog/SetlogNavBar";
import { __setClockOverride } from "@/lib/timeFormat";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 16;
const SCREEN_W = Dimensions.get("window").width;
const ME = "u-me";
const HOUR = 15; // A fixed afternoon, so the fixture reads the same all day.

const MEMBERS = [
  { userId: ME, name: "You", avatarUrl: null, role: "owner" as const },
  { userId: "u-2", name: "Karma Dorji", avatarUrl: null, role: "member" as const },
  { userId: "u-3", name: "Sonam Wangmo", avatarUrl: null, role: "member" as const },
  { userId: "u-4", name: "Tashi Penjor", avatarUrl: null, role: "member" as const },
  { userId: "u-5", name: "Pema Lhamo", avatarUrl: null, role: "member" as const },
  { userId: "u-6", name: "Ugyen Tshering", avatarUrl: null, role: "member" as const },
];

const clip = (
  hour: number,
  userId: string,
  opts: { isLate?: boolean; title?: string } = {},
) => ({
  id: `${hour}-${userId}`,
  setlogId: "log-1",
  userId,
  day: localDay(),
  slotHour: hour,
  storagePath: `log-1/${userId}/${hour}.mp4`,
  durationMs: 2000,
  isLate: opts.isLate ?? false,
  title: opts.title ?? null,
  mediaType: "video" as const,
  captureMode: "2s" as const,
  videoQuality: "720p" as const,
  // Stamped at its own hour rather than at "now", so five cards do not all
  // read the same time.
  createdAt: (() => {
    const d = new Date();
    d.setHours(hour, (hour * 7) % 60, 0, 0);
    return d.toISOString();
  })(),
});

/** A day with a gap in it, a late clip, and an hour nobody caught. */
const dayWith = (recordedNow: boolean): SetlogSlot[] =>
  Array.from({ length: 24 }, (_, hour) => {
    const isCurrent = hour === HOUR;
    let clips: SetlogSlot["clips"] = [];
    // A mix on purpose: titled and untitled, since most clips are
    // untitled and the tiles have to read either way.
    if (hour === 9)
      clips = [
        clip(9, ME, { title: "Bus was late again" }),
        clip(9, "u-2"),
        clip(9, "u-3"),
      ];
    if (hour === 10) clips = [clip(10, "u-2")];
    if (hour === 12)
      clips = [
        clip(12, ME, { title: "Ema datshi" }),
        clip(12, "u-2"),
        clip(12, "u-4"),
        clip(12, "u-5"),
        clip(12, "u-6"),
      ];
    if (hour === 13) clips = [clip(13, "u-3", { isLate: true, title: "Missed it" })];
    if (hour === 14) clips = [clip(14, ME), clip(14, "u-6")];
    if (isCurrent)
      clips = recordedNow
        ? [clip(HOUR, ME, { title: "Walking back" }), clip(HOUR, "u-2")]
        : [clip(HOUR, "u-2")];
    return { hour, clips };
  });

/** The feed, as it reads with a mix of titled and untitled clips, one
 *  photo, one somebody else's, and one marked late. */
const FEED: SetlogFeedItem[] = [
  {
    ...clip(HOUR, ME, { title: "Walking back from the office" }),
    authorName: "You",
    authorAvatarUrl: null,
    isMine: true,
    logName: null,
    logIsPersonal: true,
    url: null,
  },
  {
    ...clip(14, "u-2"),
    authorName: "Karma Dorji",
    authorAvatarUrl: null,
    isMine: false,
    logName: "Bhutan Crew",
    logIsPersonal: false,
    url: null,
  },
  {
    ...clip(13, ME, { title: "Ema datshi again" }),
    authorName: "You",
    authorAvatarUrl: null,
    isMine: true,
    logName: null,
    logIsPersonal: true,
    url: null,
  },
  {
    ...clip(11, "u-3", { isLate: true, title: "Missed the hour" }),
    authorName: "Sonam Wangmo",
    authorAvatarUrl: null,
    isMine: false,
    logName: "Bhutan Crew",
    logIsPersonal: false,
    url: null,
  },
  {
    ...clip(9, ME),
    authorName: "You",
    authorAvatarUrl: null,
    isMine: true,
    logName: null,
    logIsPersonal: true,
    url: null,
  },
];

/**
 * A month with gaps in it — the only thing the calendar's marks have to
 * read as. Every third day and a run of four, so a busy stretch and a
 * quiet one are both on screen at once.
 */
const markedIn = (month: string): Set<string> => {
  const at = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
  // Nothing is recorded in the future, so the fixture does not invent it
  // either — a marked day nobody could have reached would be checking a
  // state the real calendar can never be in.
  return new Set(
    [2, 3, 4, 5, 9, 12, 15, 16, 21, 24, 27].map(at).filter((d) => d <= localDay()),
  );
};

/**
 * Three squads that read differently: one with today running, one that has
 * not started, and one nobody else has joined yet — the three lines the row
 * can print, which is the only thing there is to judge here.
 */
const SQUADS: SquadLogSummary[] = [
  {
    id: "log-1",
    name: "Bhutan Crew",
    ownerId: "u-2",
    inviteCode: "K7M2QP",
    memberCap: 12,
    members: MEMBERS.slice(0, 6).map((m) => ({ ...m })),
    todayCount: 7,
    todayRecorders: 4,
  },
  {
    id: "log-2",
    name: "Thimphu runners",
    ownerId: ME,
    inviteCode: "R4T9BX",
    memberCap: 12,
    members: MEMBERS.slice(0, 3).map((m) => ({ ...m })),
    todayCount: 0,
    todayRecorders: 0,
  },
  {
    id: "log-3",
    name: null,
    ownerId: ME,
    inviteCode: "Z1Q8WD",
    memberCap: 12,
    members: [MEMBERS[0]],
    todayCount: 0,
    todayRecorders: 0,
  },
];

type View_ =
  | "list"
  | "empty"
  | "day-open"
  | "day-recorded"
  | "calendar"
  | "squad"
  | "squad-empty";

const VIEWS: { key: View_; label: string }[] = [
  { key: "list", label: "Your Logs" },
  { key: "empty", label: "Nothing yet" },
  { key: "calendar", label: "Day picker" },
  { key: "squad", label: "Squad Logs" },
  { key: "squad-empty", label: "Squad — none yet" },
  { key: "day-open", label: "Day — this hour open" },
  { key: "day-recorded", label: "Day — this hour done" },
];

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderCurve: "continuous",
        marginRight: 8,
        backgroundColor: active ? "#094569" : "#fff",
      }}
    >
      <Text
        style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : "#6B7280" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface SetlogPreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function SetlogPreview({ visible, onClose }: SetlogPreviewProps) {
  // A forced clock is a fixture, not a setting — it goes when the preview
  // does, or the rest of the app keeps a decision made in Dev Components.
  useEffect(() => {
    if (!visible) __setClockOverride(null);
  }, [visible]);
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>("list");
  const isDay = view === "day-open" || view === "day-recorded";
  const [month, setMonth] = useState(() => monthKey(new Date()));
  /** `null` is whatever this phone says; the other two force it. */
  const [clock, setClock] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(localDay());

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
        {/* The day screen has the standard header; the list is a tab root,
            which has none — its tab row is its chrome, so the preview shows
            that instead. The chevron is the preview's own way out either
            way, not part of either design. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 2,
            paddingBottom: isDay ? 12 : 4,
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
          {isDay && (
            <>
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
                  Bhutan Crew
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "500",
                  color: "#0369A1",
                  paddingHorizontal: 4,
                }}
              >
                Invite
              </Text>
            </>
          )}
          {!isDay && <View style={{ width: 32 }} />}
        </View>

        {!isDay && (
          <View
            style={{
              flexDirection: "row",
              gap: 18,
              paddingHorizontal: GROUP_INSET,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            {["Messages", "Setlog"].map((t, i) => (
              <View key={t} style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: i === 1 ? 17 : 15,
                    fontWeight: i === 1 ? "700" : "500",
                    color: i === 1 ? "#111827" : "#9CA3AF",
                  }}
                >
                  {t}
                </Text>
                <View
                  style={{
                    marginTop: 4,
                    width: 24,
                    height: 2,
                    borderRadius: 1,
                    borderCurve: "continuous",
                    backgroundColor: i === 1 ? "#111827" : "transparent",
                  }}
                />
              </View>
            ))}
          </View>
        )}

        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + SETLOG_NAV_HEIGHT + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {view === "squad" || view === "squad-empty" ? (
            // The other half of the tab, and deliberately not the feed's
            // shape: rooms, with joining ahead of starting one.
            <SquadLogs
              logs={view === "squad" ? SQUADS : []}
              loading={false}
              width={SCREEN_W - SETLOG_GROUP_INSET * 2}
              onOpen={() => setView("day-open")}
              onJoin={() => {}}
              onCreate={() => {}}
              onSettings={() => {}}
            />
          ) : view === "calendar" ? (
            // The calendar as it sits in the day sheet, on a month with
            // marks in it — what a native picker cannot draw, and the whole
            // reason this one is ours.
            <View style={{ paddingHorizontal: GROUP_INSET }}>
              <FeedDayLabel
                label={picked ? formatDay(picked) : "All time"}
                onPress={() => {}}
              />
              <SetlogCalendar
                month={month}
                selected={picked}
                markedDays={markedIn(month)}
                onMonthChange={setMonth}
                onSelect={setPicked}
              />
            </View>
          ) : isDay ? (
            <SetlogDayGrid
              slots={dayWith(view === "day-recorded")}
              members={MEMBERS}
              currentUserId={ME}
              currentHour={HOUR}
              onRecord={() => {}}
              onOpen={() => {}}
            />
          ) : (
            <>
              <FeedDayLabel label="Today" onPress={() => {}} />
              {view === "empty" ? (
                <SetlogEmptyCard
                  width={SCREEN_W - SETLOG_GROUP_INSET * 2}
                  message="Nothing today yet. Two seconds is enough, and the day puts itself together."
                  onPress={() => {}}
                />
              ) : (
                FEED.map((item) => (
                  <SetlogClipCard
                    key={item.id}
                    clip={item}
                    width={SCREEN_W - SETLOG_GROUP_INSET * 2}
                    playing={false}
                    onPress={() => {}}
                    onLongPress={() => setView("day-open")}
                  />
                ))
              )}
              <FeedFooter
                exportLabel={view === "empty" ? undefined : "Today"}
                onExport={() => {}}
                onSettings={() => {}}
                onJoin={() => {}}
              />
            </>
          )}
        </ScrollView>

        {/* Setlog's own bar, which is part of the design — the fixture
            switches below it are not. */}
        {!isDay && (
          <SetlogNavBar
            active={view === "squad" || view === "squad-empty" ? "squad" : "mine"}
            onSelect={(key) => setView(key === "squad" ? "squad" : "list")}
            onCamera={() => {}}
          />
        )}

        {/* Fixture switches, pinned to the bottom — not part of the design. */}
        <View
          style={{
            paddingHorizontal: GROUP_INSET,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            backgroundColor: "#EDEDED",
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {VIEWS.map((v) => (
              <Toggle
                key={v.key}
                label={v.label}
                active={view === v.key}
                onPress={() => setView(v.key)}
              />
            ))}
          </ScrollView>
          {/* Every clock in Setlog follows the phone's own convention
              (lib/timeFormat.ts), which means half of these layouts are
              only ever seen by half of the people testing them: "15:00" is
              two characters wider than "3pm" and it is the day grid's tiles
              that pay for it. This forces either, without going to
              Settings and restarting. */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
            <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Clock</Text>
            <Toggle
              label="12h"
              active={clock === false}
              onPress={() => {
                __setClockOverride(false);
                setClock(false);
              }}
            />
            <Toggle
              label="24h"
              active={clock === true}
              onPress={() => {
                __setClockOverride(true);
                setClock(true);
              }}
            />
            <Toggle
              label="This phone"
              active={clock === null}
              onPress={() => {
                __setClockOverride(null);
                setClock(null);
              }}
            />
          </View>

          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
            Fixtures — the open hour is pinned to {formatHour(HOUR)} so the
            preview reads the same whatever time you open it.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
