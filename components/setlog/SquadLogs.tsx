/**
 * Squad Logs — the rooms you are in, not a feed of what is in them.
 *
 * This half of the tab is deliberately **not** the shape of Your Logs. Your
 * own log is a stream of clips, because the only question it answers is
 * "what did today look like". A squad is a *place with people in it*, and
 * the questions are which squad, who is in it, and whether today is
 * running — none of which a wall of two-second videos answers. The clips
 * are one tap away, in the log's own day, which is where an hour with five
 * people in it can be read as an hour rather than as five separate cards.
 *
 * **Joining comes first, and creating second.** A squad you make alone is
 * an empty room; a code from a friend is a squad that already has a day in
 * it. So the empty state is a join card in the shape of a clip card, with
 * Create as a quiet row beneath — never two equal buttons, which would put
 * the lonelier of the two answers on the same footing as the one that
 * works.
 *
 * `components/dev/SetlogPreview.tsx` renders every state on fixtures.
 */

import { CONVERSATION_GROUP_RADIUS } from "@/components/messages/ConversationRow";
import { SetlogAvatar } from "@/components/setlog/SetlogDayGrid";
import { SETLOG_GROUP_INSET } from "@/components/setlog/SetlogFeed";
import { MODAL_RADIUS } from "@/constants/theme";
import {
  setlogDisplayName,
  type SquadLogSummary,
} from "@/lib/setlogService";
import { ChevronRight, KeyRound, Plus, SlidersHorizontal } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** Landscape, so the join card stands exactly where a clip card would. */
const CARD_RATIO = 16 / 9;
/** Four faces, then a count — a twelfth avatar is a smudge, not a person. */
const FACES_SHOWN = 4;
const FACE = 26;

// ── The faces ───────────────────────────────────────────────────────────

/** Who is in the squad, overlapped in joining order. The ring is the row's
 *  own white, so the stack reads as a stack rather than as a smear. */
function Faces({ members }: { members: SquadLogSummary["members"] }) {
  const shown = members.slice(0, FACES_SHOWN);
  const rest = members.length - shown.length;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((m, i) => (
        <View
          key={m.userId}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            borderRadius: (FACE + 4) / 2,
            borderCurve: "continuous",
            backgroundColor: "#fff",
            padding: 2,
          }}
        >
          <SetlogAvatar member={m} size={FACE} />
        </View>
      ))}
      {rest > 0 && (
        <View
          style={{
            marginLeft: -8,
            width: FACE + 4,
            height: FACE + 4,
            borderRadius: (FACE + 4) / 2,
            borderCurve: "continuous",
            backgroundColor: "#F0F0F0",
            borderWidth: 2,
            borderColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B7280" }}>
            +{rest}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── One squad ───────────────────────────────────────────────────────────

/**
 * A squad as a row: the faces, its name, and whether today is running.
 *
 * The only number here is how many people recorded today, and it is about
 * participation rather than popularity — the same line the day grid draws
 * under an hour (§ Setlog). No unread badge, no ordering by anything but
 * whether the day has started.
 */
export function SquadLogRow({
  log,
  first,
  last,
  onPress,
}: {
  log: SquadLogSummary;
  first?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const people = log.members.length;
  const secondary =
    log.todayRecorders > 0
      ? `${log.todayRecorders} of ${people} recorded today`
      : people > 1
        ? `${people} people · nothing today yet`
        : "Just you so far · invite someone";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopLeftRadius: first ? CONVERSATION_GROUP_RADIUS : 0,
        borderTopRightRadius: first ? CONVERSATION_GROUP_RADIUS : 0,
        borderBottomLeftRadius: last ? CONVERSATION_GROUP_RADIUS : 0,
        borderBottomRightRadius: last ? CONVERSATION_GROUP_RADIUS : 0,
        borderCurve: "continuous",
      }}
    >
      {!first && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 16,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: "#f0f0f0",
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}
        >
          {setlogDisplayName({ name: log.name, isPersonal: false })}
        </Text>
        <Text style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
          {secondary}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Faces members={log.members} />
        </View>
      </View>
      <ChevronRight size={18} color="#C7C7CC" style={{ marginLeft: 12 }} />
    </TouchableOpacity>
  );
}

// ── Getting in ──────────────────────────────────────────────────────────

/**
 * The card that stands where the first squad would.
 *
 * The clip card's own geometry — same width, same 16:9, same inset and
 * radius — drawn as an outline, exactly as `SetlogEmptyCard` does for an
 * empty day, so an empty Squad tab reads as *the shape of a squad you
 * haven't joined* rather than as a screen that failed to load. The whole
 * card is the tap, and what it opens is the code field: a six-character
 * code is the only way into somebody's log, so it is the only thing this
 * card can honestly offer.
 */
export function SquadJoinCard({
  width,
  onPress,
  loading,
}: {
  width: number;
  onPress: () => void;
  loading?: boolean;
}) {
  const height = Math.round(width / CARD_RATIO);

  return (
    <TouchableOpacity
      activeOpacity={loading ? 1 : 0.7}
      onPress={onPress}
      disabled={loading}
      style={{
        width,
        height,
        marginHorizontal: SETLOG_GROUP_INSET,
        marginBottom: 14,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderColor: "#E5E7EB",
        borderStyle: "dashed",
        backgroundColor: "#F9FAFB",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
      }}
    >
      {!loading && (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderCurve: "continuous",
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <KeyRound size={22} color="#6B7280" strokeWidth={1.8} />
        </View>
      )}
      <Text
        style={{
          fontSize: 15,
          lineHeight: 21,
          color: "#9CA3AF",
          textAlign: "center",
        }}
      >
        {loading
          ? "Loading…"
          : "Join a squad with a code. Six characters, from a friend — up to 12 of you in one."}
      </Text>
    </TouchableOpacity>
  );
}

// ── The quiet rows ──────────────────────────────────────────────────────

/**
 * What is left over, in one white group under the list (§ Groups and rows).
 *
 * Join leads it, because a squad with somebody already in it is the one
 * worth being in; starting one of your own is the row under it, for when
 * nobody has sent you a code. Recording is not here at all — the camera is
 * in the nav bar, and it records into the squad you open, not into a list.
 */
export function SquadFooter({
  onJoin,
  onCreate,
  onSettings,
  /** The join row is redundant while the join card is the whole screen. */
  showJoin = true,
}: {
  onJoin: () => void;
  onCreate: () => void;
  onSettings: () => void;
  showJoin?: boolean;
}) {
  const rows = [
    ...(showJoin
      ? [
          {
            key: "join",
            icon: <KeyRound size={20} color="#9CA3AF" strokeWidth={1.8} />,
            label: "Join with a code",
            secondary: "Six characters, from a friend",
            onPress: onJoin,
          },
        ]
      : []),
    {
      key: "create",
      icon: <Plus size={20} color="#9CA3AF" strokeWidth={1.8} />,
      label: "Start a squad",
      secondary: "You'll get a code to send them",
      onPress: onCreate,
    },
    {
      key: "settings",
      icon: <SlidersHorizontal size={20} color="#9CA3AF" strokeWidth={1.8} />,
      label: "Setlog settings",
      secondary: "Hourly prompt, and what the camera opens on",
      onPress: onSettings,
    },
  ];

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: CONVERSATION_GROUP_RADIUS,
        borderCurve: "continuous",
        overflow: "hidden",
        marginHorizontal: SETLOG_GROUP_INSET,
        marginTop: 14,
      }}
    >
      {rows.map((row, i) => (
        <TouchableOpacity
          key={row.key}
          activeOpacity={0.7}
          onPress={row.onPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          {i > 0 && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 16 + 44 + 12,
                right: 0,
                height: StyleSheet.hairlineWidth,
                backgroundColor: "#f0f0f0",
              }}
            />
          )}
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
            {row.icon}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
              {row.label}
            </Text>
            <Text style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
              {row.secondary}
            </Text>
          </View>
          <ChevronRight size={18} color="#C7C7CC" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── The list ────────────────────────────────────────────────────────────

/**
 * The whole Squad half: the squads, or the way into one.
 *
 * Presentational on purpose — it takes the rows and the four things that
 * can be pressed, so the same component renders the real list and the
 * fixtures.
 */
export default function SquadLogs({
  logs,
  loading,
  width,
  onOpen,
  onJoin,
  onCreate,
  onSettings,
}: {
  logs: SquadLogSummary[];
  loading: boolean;
  /** The clip card's width, so the join card lands on the same lines. */
  width: number;
  onOpen: (setlogId: string) => void;
  onJoin: () => void;
  onCreate: () => void;
  onSettings: () => void;
}) {
  const empty = logs.length === 0;

  return (
    <View>
      {empty ? (
        <SquadJoinCard width={width} onPress={onJoin} loading={loading} />
      ) : (
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: CONVERSATION_GROUP_RADIUS,
            borderCurve: "continuous",
            overflow: "hidden",
            marginHorizontal: SETLOG_GROUP_INSET,
          }}
        >
          {logs.map((log, i) => (
            <SquadLogRow
              key={log.id}
              log={log}
              first={i === 0}
              last={i === logs.length - 1}
              onPress={() => onOpen(log.id)}
            />
          ))}
        </View>
      )}

      {/* Nothing to offer under a card that is itself still loading. */}
      {!(empty && loading) && (
        <SquadFooter
          showJoin={!empty}
          onJoin={onJoin}
          onCreate={onCreate}
          onSettings={onSettings}
        />
      )}
    </View>
  );
}
