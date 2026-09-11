/**
 * One hour of a log, played through.
 *
 * Each member's two seconds in turn, oldest first, with the recorder's name
 * and a progress bar per clip — the day vlog Setlog auto-assembles, watched
 * an hour at a time. Tap the right half for the next clip, the left half to
 * go back, anywhere else to close.
 *
 * There is nothing to react with and no counter of any kind on this screen.
 * A log's whole promise is that watching a friend's day costs them nothing
 * and scores them nothing.
 *
 * Clips play from the copy on this phone when there is one and from a
 * signed URL when there is not — `resolveClipUrls` in
 * `lib/setlogMediaCache.ts` decides, and a clip you recorded yourself is
 * always the former.
 */

import { resolveClipUrls } from "@/lib/setlogMediaCache";
import {
  CAPTURE_MODES,
  formatHour,
  type SetlogClip,
  type SetlogMember,
  type SetlogSlot,
} from "@/lib/setlogService";
import { useVideoPlayer, VideoView } from "expo-video";
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SlotPlayerProps {
  /** The clips to play, or null when nothing is open. */
  slot: SetlogSlot | null;
  members: Map<string, SetlogMember>;
  currentUserId: string | null;
  onClose: () => void;
  /** Replaces the hour under the name — for a run of clips that is not one
   *  hour, such as a whole day's reel. One player either way: a second one
   *  would drift from this in a week. */
  title?: string;
}

export default function SlotPlayer({
  slot,
  members,
  currentUserId,
  onClose,
  title,
}: SlotPlayerProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  /**
   * The index, mirrored where it can be read without a state updater.
   *
   * Reaching the end closes the player, and closing is the *parent's*
   * state. Deciding that inside a `setIndex(i => ...)` callback meant
   * calling the parent's setter from inside a render — React's "cannot
   * update a component while rendering a different component". The ref is
   * what lets the decision happen in the event handler, where it belongs.
   */
  const indexRef = useRef(0);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState(false);

  const clips = useMemo(() => slot?.clips ?? [], [slot]);
  const clip = clips[index];
  const uri = clip ? urls[clip.storagePath] : undefined;

  useEffect(() => {
    if (!slot) return;
    indexRef.current = 0;
    setIndex(0);
    setSigning(true);
    resolveClipUrls(slot.clips)
      .then(setUrls)
      .catch((e) => console.error("Error signing setlog clips:", e))
      .finally(() => setSigning(false));
  }, [slot]);

  const isPhoto = clip?.mediaType === "photo";
  /** One clip on its own loops until it is dismissed. Closing after two
   *  seconds is right for an hour played through; for a clip somebody
   *  deliberately opened it is the screen shutting in their face. */
  const single = clips.length === 1;

  const player = useVideoPlayer(uri && !isPhoto ? { uri } : null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  const advance = useCallback(() => {
    const next = indexRef.current + 1;
    if (next >= clips.length) {
      onClose();
      return;
    }
    indexRef.current = next;
    setIndex(next);
  }, [clips.length, onClose]);

  const goBack = useCallback(() => {
    const prev = Math.max(0, indexRef.current - 1);
    indexRef.current = prev;
    setIndex(prev);
  }, []);

  useEffect(() => {
    if (!uri || isPhoto) return;
    // A timelapse is thirty real seconds shown fast, and a jumpcut ten shown
    // at double — nothing re-encodes on the device, so the mode's speed-up
    // lives here, at the only place the clip is ever watched.
    player.playbackRate = CAPTURE_MODES[clip.captureMode]?.rate ?? 1;
    player.loop = single;
    player.play();
  }, [uri, isPhoto, player, clip?.captureMode, single]);

  // A clip ending is the signal to move on — nobody is going to reach for a
  // next button eleven times. A photo has no end, so it gets a beat of its
  // own: long enough to look at, short enough to keep the hour moving.
  useEffect(() => {
    // A single photo stays up until it is dismissed, for the same reason a
    // single clip loops.
    if (!isPhoto || !uri || single) return;
    const t = setTimeout(advance, 3000);
    return () => clearTimeout(t);
  }, [isPhoto, uri, index, advance, single]);

  useEffect(() => {
    if (single) return;
    const sub = player.addListener("playToEnd", advance);
    return () => sub.remove();
  }, [player, advance, single]);

  if (!slot) return null;

  const member = clip ? members.get(clip.userId) : undefined;
  const name = !clip
    ? ""
    : clip.userId === currentUserId
      ? "You"
      : (member?.name ?? "Unknown");

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" />

        {uri ? (
          isPhoto ? (
            <Image
              source={{ uri }}
              style={{ flex: 1 }}
              resizeMode="cover"
            />
          ) : (
            <VideoView
              player={player}
              style={{ flex: 1 }}
              nativeControls={false}
              contentFit="cover"
            />
          )
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {signing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
                This clip couldn&apos;t be loaded.
              </Text>
            )}
          </View>
        )}

        {/* Tap halves. Rendered before the chrome so the close button and
            the progress bar sit above them and stay tappable. */}
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row" }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={goBack}
          />
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={advance}
          />
        </View>

        {/* The title the recorder wrote over their two seconds, in the
            same place they wrote it (§ Setlog). Absent on an untitled
            clip rather than replaced by a placeholder — most clips are
            untitled, and a screen of "Untitled" is worse than a screen of
            video. */}
        {clip?.title ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 28,
              right: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "600",
                color: "#fff",
                textAlign: "center",
                textShadowColor: "rgba(0,0,0,0.35)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 12,
              }}
            >
              {clip.title}
            </Text>
          </View>
        ) : null}

        {/* One segment per clip, filled up to the one playing — the day's
            shape at a glance, and the only counter here. */}
        <View
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 12,
            right: 12,
            flexDirection: "row",
            gap: 4,
          }}
          pointerEvents="none"
        >
          {clips.map((c, i) => (
            <View
              key={c.id}
              style={{
                flex: 1,
                height: 2,
                borderRadius: 1,
                borderCurve: "continuous",
                backgroundColor:
                  i <= index ? "#fff" : "rgba(255,255,255,0.28)",
              }}
            />
          ))}
        </View>

        <View
          style={{
            position: "absolute",
            top: insets.top + 22,
            left: 12,
            right: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }} pointerEvents="none">
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>
              {name}
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
              {title ?? formatHour(slot.hour)}
              {/* Shown, never punished: a late clip is still the day. */}
              {clip?.isLate ? " · added late" : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
            <X size={26} color="#fff" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}
