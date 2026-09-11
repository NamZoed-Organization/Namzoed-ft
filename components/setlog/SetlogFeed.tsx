/**
 * The Setlog tab's body: what you have recorded, newest first.
 *
 * A card per clip, full width of the group inset, playing. A grid of
 * thumbnails would be the wrong shape for two-second videos — there is no
 * still frame worth choosing out of two seconds, and a wall of frozen
 * frames reads as an archive rather than a day. So each card plays its own
 * clip, muted and looping, and carries the same stamp it was recorded
 * under: the clock in the middle, the title beneath it.
 *
 * **Only what you can see plays.** The tab passes a set of ids from its
 * `onViewableItemsChanged`, and a card off that list renders a still poster
 * rather than a second video decoder. Ten simultaneous players is how a
 * feed like this stops scrolling.
 *
 * `components/dev/SetlogPreview.tsx` renders the same components on
 * fixtures, so the layout can be judged without a day's worth of recording.
 */

import ClipStamp, { OVER_MEDIA } from "@/components/setlog/ClipStamp";
import Mascot from "@/components/ui/Mascot";
import { CONVERSATION_GROUP_RADIUS } from "@/components/messages/ConversationRow";
import { MODAL_RADIUS } from "@/constants/theme";
import {
  CAPTURE_MODES,
  formatDay,
  type SetlogFeedItem,
} from "@/lib/setlogService";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Play,
  Plus,
  Share2,
  SlidersHorizontal,
  UserRound,
} from "lucide-react-native";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const SETLOG_GROUP_INSET = 16;
/** Landscape, because that is the frame this camera records by default. */
const CARD_RATIO = 16 / 9;

// ── Rows ────────────────────────────────────────────────────────────────

/**
 * Which day the cards below are from — centred, underlined, and the way to
 * change it.
 *
 * A caption on the list rather than a control over the tab, which is why it
 * heads the cards instead of sitting in a fixed row above them: it names
 * what you are about to scroll through, and scrolls away with it. The rule
 * is drawn rather than `textDecorationLine`, so it keeps the weight and the
 * spacing the rest of the app's underlines have (§ Tabs and pills).
 *
 * The chevron is what says it can be changed at all. Underlined type reads
 * as a heading, and a heading is not something anybody taps — so a day
 * other than today was a thing you had to already know was there.
 */
export function FeedDayLabel({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        alignSelf: "center",
        alignItems: "center",
        paddingTop: 2,
        paddingBottom: 14,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
          {label}
        </Text>
        <ChevronDown size={15} color="#111827" strokeWidth={2.2} />
      </View>
      {/* The rule runs under the chevron too — it underlines the control,
          not the word. */}
      <View
        style={{
          alignSelf: "stretch",
          marginTop: 3,
          height: 1.5,
          borderRadius: 1,
          borderCurve: "continuous",
          backgroundColor: "#111827",
        }}
      />
    </TouchableOpacity>
  );
}

/**
 * The three occasional things, in one white group under the cards
 * (§ Groups and rows). Three separate cards stacked is the "card per item"
 * shape § People lists rules out, and these are rows, not items.
 */
export function FeedFooter({
  exportLabel,
  onExport,
  onSettings,
  onJoin,
}: {
  /** Absent when the day being shown has nothing to export. */
  exportLabel?: string;
  onExport: () => void;
  onSettings: () => void;
  onJoin: () => void;
}) {
  const rows: {
    key: string;
    icon: React.ReactNode;
    label: string;
    secondary: string;
    onPress: () => void;
  }[] = [
    ...(exportLabel
      ? [
          {
            key: "export",
            icon: <Share2 size={20} color="#9CA3AF" strokeWidth={1.8} />,
            label: `Export ${exportLabel.toLowerCase()}`,
            secondary: "The reel, and a collage of the photos",
            onPress: onExport,
          },
        ]
      : []),
    {
      key: "settings",
      icon: <SlidersHorizontal size={20} color="#9CA3AF" strokeWidth={1.8} />,
      label: "Setlog settings",
      secondary: "Hourly prompt, and what the camera opens on",
      onPress: onSettings,
    },
    {
      key: "join",
      icon: <KeyRound size={20} color="#9CA3AF" strokeWidth={1.8} />,
      label: "Join with a code",
      secondary: "Six characters, from a friend",
      onPress: onJoin,
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

// ── The card ────────────────────────────────────────────────────────────

/** The clip itself. Split out so the player is created only for a card
 *  that is actually going to play — a hook cannot be skipped, so the
 *  decision has to be made by the parent. */
function ClipVideo({ uri, rate }: { uri: string; rate: number }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    // Muted: a feed that makes noise as it scrolls past is a feed people
    // scroll past once. Sound belongs to the full-screen player.
    p.muted = true;
    p.playbackRate = rate;
  });
  React.useEffect(() => {
    player.play();
  }, [player]);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

export function SetlogClipCard({
  clip,
  width,
  playing,
  onPress,
  onLongPress,
}: {
  clip: SetlogFeedItem;
  width: number;
  /** Whether this card is on screen enough to be worth a decoder. */
  playing: boolean;
  /** A tap plays the clip full screen — what a card of a video offers. */
  onPress: () => void;
  /** A hold opens the log it belongs to. The day grid is a different view
   *  of a different thing, and it should not be what a tap lands on. */
  onLongPress?: () => void;
}) {
  const height = Math.round(width / CARD_RATIO);
  const isPhoto = clip.mediaType === "photo";
  const rate = CAPTURE_MODES[clip.captureMode]?.rate ?? 1;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={{
        width,
        height,
        marginHorizontal: SETLOG_GROUP_INSET,
        marginBottom: 14,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: "#111827",
      }}
    >
      {clip.url ? (
        isPhoto ? (
          <Image
            source={{ uri: clip.url }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : playing ? (
          <ClipVideo uri={clip.url} rate={rate} />
        ) : (
          // Off screen: the ground and the stamp, no decoder. The card keeps
          // its geometry either way, so scrolling back does not re-lay-out.
          <View style={{ width: "100%", height: "100%" }} />
        )
      ) : (
        <View
          style={{
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
            This clip couldn&apos;t be loaded.
          </Text>
        </View>
      )}

      {/* The stamp it was recorded under, in the middle where it was put —
          the same component the reel's panes and the collage's cells use. */}
      <ClipStamp
        createdAt={clip.createdAt}
        title={clip.title}
        size={height}
        inset={20}
      />

      {/* Whose it is and when. Bottom-left, out of the stamp's way. */}
      <View
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
        }}
        pointerEvents="none"
      >
        {!clip.isMine &&
          (clip.authorAvatarUrl ? (
            <Image
              source={{ uri: clip.authorAvatarUrl }}
              style={{ width: 22, height: 22, borderRadius: 11 }}
            />
          ) : (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserRound size={13} color="#fff" strokeWidth={1.8} />
            </View>
          ))}
        <Text style={{ fontSize: 13, fontWeight: "600", ...OVER_MEDIA }}>
          {clip.isMine ? formatDay(clip.day) : `${clip.authorName} · ${formatDay(clip.day)}`}
          {clip.isLate ? " · late" : ""}
        </Text>
      </View>

      {/* A paused card says so, rather than looking like a clip that failed
          to start. */}
      {!isPhoto && !playing && clip.url && (
        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            width: 26,
            height: 26,
            borderRadius: 13,
            borderCurve: "continuous",
            backgroundColor: "rgba(17,24,39,0.45)",
            alignItems: "center",
            justifyContent: "center",
          }}
          pointerEvents="none"
        >
          <Play size={13} color="#fff" strokeWidth={2} fill="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── The empty card ──────────────────────────────────────────────────────

/**
 * What stands where the first card would be, when there is nothing to show.
 *
 * A line of grey text on a white screen says the tab is broken as readily as
 * it says the day is empty. This is the clip card's own geometry — same
 * width, same 16:9, same inset and radius — drawn as an outline instead of
 * a picture, so the empty day is visibly *the shape of a day with one clip
 * in it* and the difference is only that it hasn't been recorded. A plus in
 * the middle, the reason beneath it, and the whole card is the tap: the
 * camera it opens is the same one in the nav bar (§ Setlog), which is why
 * this is a placeholder for the missing clip and not a second camera row —
 * it is gone the moment anything exists.
 *
 * The mongoose sleeps between the plus and the sentence, and that is the
 * whole tone of the feature: a day with nothing in it is a quiet day, not a
 * failure to keep a streak. It is absent while the answer is still loading,
 * along with the plus — there is nothing to be asleep about until the day
 * has actually come back empty.
 */
export function SetlogEmptyCard({
  message,
  width,
  onPress,
}: {
  message: string;
  width: number;
  /** Absent while loading, when there is nothing to offer yet. */
  onPress?: () => void;
}) {
  const height = Math.round(width / CARD_RATIO);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
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
      {onPress && (
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
            // Tight, because the plus, the mongoose and the sentence all
            // have to sit inside a 16:9 card on a small phone.
            marginBottom: 8,
          }}
        >
          <Plus size={24} color="#6B7280" strokeWidth={2} />
        </View>
      )}
      {onPress && <Mascot mood="sleepy" size={46} style={{ marginBottom: 6 }} />}
      <Text
        style={{
          fontSize: 15,
          lineHeight: 21,
          color: "#9CA3AF",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </TouchableOpacity>
  );
}
