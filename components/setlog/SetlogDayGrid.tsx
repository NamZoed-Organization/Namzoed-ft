/**
 * A log's day as a grid — the members' faces, then one tile per hour.
 *
 * Presentational on purpose: `app/(users)/setlog/[id].tsx` binds it to the
 * database and `components/dev/SetlogPreview.tsx` binds it to fixtures, so
 * the layout can be judged without first living an afternoon inside a log.
 * Two copies of a grid drift; one copy with two callers cannot.
 *
 * The grid is the nine-split collage the app is known for. It draws only
 * hours that have something in them plus the hour now open — twenty-four
 * cells of empty grey would read as a day you had failed at rather than a
 * day in progress.
 */

import { formatHour, type SetlogMember, type SetlogSlot } from "@/lib/setlogService";
import { MODAL_RADIUS } from "@/constants/theme";
import { Camera, UserRound } from "lucide-react-native";
import React, { useMemo } from "react";
import { Dimensions, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

export const SETLOG_GRID_INSET = 16;
const COLUMNS = 3;
const GRID_GAP = 8;
const CELL = Math.floor(
  (Dimensions.get("window").width -
    SETLOG_GRID_INSET * 2 -
    GRID_GAP * (COLUMNS - 1)) /
    COLUMNS,
);

const EMPTY_TEXT = {
  fontSize: 16,
  lineHeight: 22,
  color: "#9CA3AF",
  textAlign: "center",
  paddingHorizontal: 24,
  paddingTop: 32,
} as const;

/** A member's face, or the standard's `UserRound` when there isn't one. */
export function SetlogAvatar({
  member,
  size,
}: {
  member?: SetlogMember;
  size: number;
}) {
  if (member?.avatarUrl) {
    return (
      <Image
        source={{ uri: member.avatarUrl }}
        // No `borderCurve`: RN's ImageStyle doesn't carry it, and a full
        // circle has no corner for it to smooth anyway.
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#F5F5F5",
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderCurve: "continuous",
        backgroundColor: "#F5F5F5",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <UserRound size={size * 0.5} color="#9CA3AF" strokeWidth={1.8} />
    </View>
  );
}

interface SetlogDayGridProps {
  slots: SetlogSlot[];
  members: SetlogMember[];
  currentUserId: string | null;
  /** The hour the prompt is open on. */
  currentHour: number;
  onRecord: (hour: number) => void;
  onOpen: (slot: SetlogSlot) => void;
  loading?: boolean;
}

export default function SetlogDayGrid({
  slots,
  members,
  currentUserId,
  currentHour,
  onRecord,
  onOpen,
  loading = false,
}: SetlogDayGridProps) {
  const memberById = useMemo(() => {
    const m = new Map<string, SetlogMember>();
    for (const member of members) m.set(member.userId, member);
    return m;
  }, [members]);

  const visibleSlots = useMemo(
    () => slots.filter((s) => s.clips.length > 0 || s.hour === currentHour),
    [slots, currentHour],
  );

  /** The hour's title, if anyone in it wrote one — the recorder's own
   *  first, since it is their tile as much as anyone's. */
  const titleFor = (slot: SetlogSlot): string | null =>
    slot.clips.find((c) => c.userId === currentUserId && c.title)?.title ??
    slot.clips.find((c) => c.title)?.title ??
    null;

  const iRecordedNow = !!slots
    .find((s) => s.hour === currentHour)
    ?.clips.some((c) => c.userId === currentUserId);

  return (
    <>
      {/* Who is in the log — one horizontally-scrolling row of faces, as
          the frequent-contacts strip is. No label: the faces say what they
          are. */}
      {members.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SETLOG_GRID_INSET,
            gap: 14,
            paddingBottom: 16,
          }}
        >
          {members.map((m) => (
            <View key={m.userId} style={{ alignItems: "center", width: 56 }}>
              <SetlogAvatar member={m} size={44} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: "#6B7280", marginTop: 5, maxWidth: 56 }}
              >
                {m.userId === currentUserId ? "You" : m.name.split(" ")[0]}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {loading ? null : visibleSlots.length === 0 ? (
        <Text style={EMPTY_TEXT}>Nothing recorded today yet.</Text>
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: GRID_GAP,
            paddingHorizontal: SETLOG_GRID_INSET,
          }}
        >
          {visibleSlots.map((s) => {
            const open = s.hour === currentHour;
            const mine = s.clips.some((c) => c.userId === currentUserId);
            const recordable = open && !mine;
            const filled = s.clips.length > 0;

            return (
              <TouchableOpacity
                key={s.hour}
                activeOpacity={0.8}
                disabled={!recordable && !filled}
                onPress={() => (recordable ? onRecord(s.hour) : onOpen(s))}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  padding: 10,
                  justifyContent: "space-between",
                  // The open, unrecorded hour is the one thing here you can
                  // still act on, so it is the only tile in the accent.
                  backgroundColor: recordable
                    ? "#0369A1"
                    : filled
                      ? "#111827"
                      : "#fff",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: filled || recordable ? "#fff" : "#9CA3AF",
                    }}
                  >
                    {formatHour(s.hour)}
                  </Text>
                  {recordable && <Camera size={15} color="#fff" strokeWidth={1.8} />}
                </View>

                {recordable ? (
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
                    Record 2s
                  </Text>
                ) : filled ? (
                  <View>
                    {/* Whatever the first recorder called the hour. Two
                        lines at most: the tile is a way in, not a caption. */}
                    {titleFor(s) ? (
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 12.5,
                          fontWeight: "600",
                          color: "#fff",
                          marginBottom: 6,
                        }}
                      >
                        {titleFor(s)}
                      </Text>
                    ) : null}
                    {/* Overlapped faces rather than a number: who is in the
                        hour is the thing worth seeing, and the count is
                        underneath for anyone who wants it. */}
                    <View style={{ flexDirection: "row" }}>
                      {s.clips.slice(0, 4).map((c, i) => (
                        <View key={c.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                          <SetlogAvatar member={memberById.get(c.userId)} size={22} />
                        </View>
                      ))}
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.7)",
                        marginTop: 6,
                      }}
                    >
                      {s.clips.length} of {members.length}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Waiting</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* The hour is what a clip is filed under, never a quota — so once
          you have recorded it, the line under the grid is the way to record
          it again rather than a notice that you are finished. Tapping the
          tile opens what is already there, which is why this is here. */}
      {!loading && iRecordedNow && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onRecord(currentHour)}
          style={{ paddingTop: 20, alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#0369A1" }}>
            Add another to {formatHour(currentHour)}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}
