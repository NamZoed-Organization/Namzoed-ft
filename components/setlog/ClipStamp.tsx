/**
 * The stamp a clip carries: the clock it was taken at, and the title
 * written over it afterwards.
 *
 * One component, because this is the same mark in four places — the camera
 * that puts it there, the feed card, the reel's panes, and the collage's
 * cells — and it had already drifted: the collage was drawing it in a
 * corner while everything else centred it, so a photo looked like it had
 * been captioned by a different app than the one that took it.
 *
 * **It is always centred**, at the size the camera put it: the clock large,
 * the title directly beneath. Position is not a per-surface decision, it is
 * what the stamp *is*.
 *
 * `size` is the height of whatever it sits on, and the type scales to it —
 * a collage cell three across cannot carry a 52pt clock, and shrinking it
 * by hand per surface is how the last drift started.
 */

import { formatClockTime } from "@/lib/timeFormat";
import React from "react";
import { Text, View } from "react-native";

/** Legible over a bright sky and a dark room alike, without dropping a
 *  scrim over the whole frame. */
export const OVER_MEDIA = {
  color: "#fff",
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 10,
} as const;

/**
 * The clock as it was stamped, read back off the clip's own timestamp.
 *
 * Rendered in this phone's own convention rather than the one it was
 * recorded in: a stamp is read as *the time*, and somebody who runs their
 * phone on 24-hour should not have half the app disagreeing with their
 * lock screen. The instant is what was recorded; how it prints is a local
 * preference (`lib/timeFormat.ts`).
 */
export const clipClock = (createdAt: string): string =>
  formatClockTime(new Date(createdAt));

export default function ClipStamp({
  createdAt,
  title,
  size,
  inset = 10,
}: {
  createdAt: string;
  title?: string | null;
  /** The height of the surface this sits on; the type scales to it. */
  size: number;
  inset?: number;
}) {
  const clockSize = Math.max(11, Math.round(size * 0.11));
  const titleSize = Math.max(9, Math.round(size * 0.055));

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: inset,
        right: inset,
        alignItems: "center",
        justifyContent: "center",
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          fontSize: clockSize,
          fontWeight: "700",
          letterSpacing: -0.5,
          ...OVER_MEDIA,
        }}
      >
        {clipClock(createdAt)}
      </Text>
      {title ? (
        <Text
          numberOfLines={2}
          style={{
            marginTop: Math.max(2, Math.round(size * 0.012)),
            fontSize: titleSize,
            fontWeight: "600",
            textAlign: "center",
            ...OVER_MEDIA,
          }}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
