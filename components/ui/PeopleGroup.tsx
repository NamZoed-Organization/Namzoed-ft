/**
 * PeopleGroup
 *
 * § People lists, as one component: a section label, then one white group
 * on the grey with only its ends rounded and a hairline inset to where the
 * text starts between every pair of rows.
 *
 * Add Friends stacks three of these — follow requests, connect requests
 * waiting on you, connect requests waiting on them — and Messages uses a
 * fourth for message requests. They are the same list showing different
 * facts, so they are one implementation rather than four. Hand-maintained
 * copies drift (one gets the busy loader, another keeps the old pill
 * padding), and the drift is invisible until someone scrolls past two of
 * them at once.
 *
 * It renders every row in a plain View, so it is for a list you can see the
 * end of — requests, participants, members. A list that can run to hundreds
 * (the conversation list) needs a FlatList and does its own group corners
 * per item; `components/modals/FollowRequestsOverlay.tsx` is that shape.
 *
 * Presentational and dumb on purpose: it renders rows and calls back. Every
 * decision about what a row says or which pills it carries belongs to the
 * adapter above it (`ConnectRequestList`, `FollowRequestList`, the message
 * requests list in `app/(users)/(tabs)/messages.tsx`).
 */

import CircularLoader from "@/components/ui/CircularLoader";
import { Image } from "expo-image";
import { UserRound } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const AVATAR = 44;
/** Hairline inset to where the row's text starts (§ Separators). */
const SEPARATOR_INSET = 16 + AVATAR + 12;
const GROUP_RADIUS = 18;

export interface PeopleGroupAction {
  label: string;
  /** `action` is the filled `#0369A1` pill; `quiet` is `#F5F5F5` with
   *  `#111`, for the lesser of two actions and for a state that has already
   *  happened. A white or outlined button disappears against the row. */
  tone: "action" | "quiet";
  /** Absent makes it a static badge rather than a button. */
  onPress?: () => void;
}

export interface PeopleGroupRow {
  key: string;
  name: string;
  avatarUrl?: string | null;
  /** The one line under the name. Always says where this person stands —
   *  that is the only thing anybody opens one of these lists to find out. */
  secondary: string;
  actions: PeopleGroupAction[];
  /** A call is in flight — the pills go to a loader. */
  busy?: boolean;
  /** Marked rather than removed: 0.5, with an Undo among the actions. */
  dimmed?: boolean;
  onPress?: () => void;
}

function Pill({ label, tone, onPress }: PeopleGroupAction) {
  const filled = tone === "action";
  const body = (
    <View
      style={{
        borderRadius: 999,
        borderCurve: "continuous",
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: filled ? "#0369A1" : "#F5F5F5",
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: filled ? "#fff" : "#111" }}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      {body}
    </TouchableOpacity>
  );
}

interface PeopleGroupProps {
  /** § Type — section label, 13 semibold grey, sentence case. */
  label: string;
  rows: PeopleGroupRow[];
}

export default function PeopleGroup({ label, rows }: PeopleGroupProps) {
  if (rows.length === 0) return null;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: "#6B7280",
          marginBottom: 8,
          paddingHorizontal: 4,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: GROUP_RADIUS,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        {rows.map((row, index) => (
          <View key={row.key}>
            {index > 0 && (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: "#f0f0f0",
                  marginLeft: SEPARATOR_INSET,
                }}
              />
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={row.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                opacity: row.dimmed ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: AVATAR,
                  height: AVATAR,
                  borderRadius: AVATAR / 2,
                  borderCurve: "continuous",
                  backgroundColor: row.avatarUrl ? "#E5E7EB" : "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {row.avatarUrl ? (
                  <Image
                    source={{ uri: row.avatarUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <UserRound size={20} color="#9CA3AF" strokeWidth={1.8} />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}
                >
                  {row.name}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
                  {row.secondary}
                </Text>
              </View>

              {row.busy ? (
                <View style={{ paddingHorizontal: 14 }}>
                  <CircularLoader size="small" color="#094569" />
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {row.actions.map((action) => (
                    <Pill key={action.label} {...action} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}
