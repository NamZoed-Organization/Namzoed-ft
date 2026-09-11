/**
 * ConversationRow
 *
 * One conversation in the messages list, built to § People lists: 44pt
 * avatar, name at 15.5 semibold `#111`, one secondary line at 15 `#9CA3AF`,
 * `px-4 py-3`, and a hairline inset to where the text starts between rows.
 *
 * What it replaces: a 56pt circle holding a white initial on brand navy, a
 * 15/13 type pair, and a full-width `#e5e7eb` rule under every row. Three
 * things the standard names — the initials tile was per-user colour by
 * another name, and a full-width rule is what makes a list read as a stack
 * of unrelated things rather than one list.
 *
 * The group's corners live here rather than on a wrapper because the list
 * is a FlatList: only the first and last rows round, and each row clips its
 * own swipe actions. `components/ui/PeopleGroup.tsx` is the same shape for
 * a list short enough to render in one View.
 *
 * Presentational — it takes strings and calls back. Time formatting, draft
 * lookup and unread counting all belong to the screen.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { BellOff, UserRound } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export const CONVERSATION_AVATAR = 44;
/** Hairline inset to where the row's text starts (§ Separators). */
export const CONVERSATION_SEPARATOR_INSET = 16 + CONVERSATION_AVATAR + 12;
export const CONVERSATION_GROUP_RADIUS = 18;
/** Unread is the one mark the brand colour carries on this screen. */
const UNREAD = "#094569";

export interface ConversationRowProps {
  name: string;
  avatarUrl?: string | null;
  /** Already formatted — "12:04", "Yesterday", "Mar 3". */
  time?: string | null;
  /** Last message, already flattened to one line. */
  preview: string;
  /** An unsent draft outranks the last message, and says so. */
  draft?: string | null;
  unreadCount?: number;
  muted?: boolean;
  first?: boolean;
  last?: boolean;
}

export default function ConversationRow({
  name,
  avatarUrl,
  time,
  preview,
  draft,
  unreadCount = 0,
  muted,
  first,
  last,
}: ConversationRowProps) {
  const unread = unreadCount > 0;

  return (
    <View
      style={{
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
            marginLeft: CONVERSATION_SEPARATOR_INSET,
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
            width: CONVERSATION_AVATAR,
            height: CONVERSATION_AVATAR,
            borderRadius: CONVERSATION_AVATAR / 2,
            borderCurve: "continuous",
            backgroundColor: avatarUrl ? "#E5E7EB" : "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {avatarUrl ? (
            <ProgressiveImage
              uri={avatarUrl}
              style={{ width: "100%", height: "100%" }}
              showProgress={false}
              recyclingKey={avatarUrl}
            />
          ) : (
            <UserRound size={20} color="#9CA3AF" strokeWidth={1.8} />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 15.5, fontWeight: "600", color: "#111" }}
            >
              {name}
            </Text>
            {muted && (
              <BellOff size={13} color="#9CA3AF" strokeWidth={1.8} style={{ marginLeft: 6 }} />
            )}
            {time ? (
              <Text style={{ marginLeft: 8, fontSize: 13, color: "#9CA3AF" }}>{time}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 15,
                // Unread darkens the preview rather than colouring it —
                // hierarchy comes from weight and size, not colour (§ Type).
                color: unread ? "#111" : "#9CA3AF",
                fontWeight: unread ? "600" : "400",
              }}
            >
              {draft ? (
                <>
                  <Text style={{ color: "#DC2626", fontWeight: "600" }}>Draft: </Text>
                  {draft}
                </>
              ) : (
                preview
              )}
            </Text>

            {/* A dot, not a number, up to 9 — the count is not the point,
                and a numeral at this size is a smaller target for the eye
                than the dot it sits in. */}
            {unread &&
              (unreadCount <= 9 ? (
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 4.5,
                    borderCurve: "continuous",
                    backgroundColor: UNREAD,
                    marginLeft: 8,
                  }}
                />
              ) : (
                <View
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    borderCurve: "continuous",
                    backgroundColor: UNREAD,
                    paddingHorizontal: 5,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>9+</Text>
                </View>
              ))}
          </View>
        </View>
      </View>
    </View>
  );
}
