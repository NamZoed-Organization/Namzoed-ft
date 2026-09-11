/**
 * A day's photos as one square.
 *
 * The nine-split grid the format is known for, filled in the order the
 * photos were taken — reading order is chronological order, so the square
 * is a day rather than an arrangement. Each cell keeps the stamp the camera
 * put on it, centred, at the size the cell allows — `ClipStamp`, the same
 * component the feed card and the reel's panes use.
 *
 * It is laid out at the size it will be exported at rather than at the size
 * it is previewed at, because `captureRef` flattens what is on screen: a
 * collage laid out to fit a phone and then scaled up is a blurry collage.
 * The preview scales the whole thing down with a transform instead, so what
 * you look at and what you get are the same pixels.
 *
 * The grid is the editor's to set. `collageColumns` is only the opening
 * suggestion — one photo is not a grid, four want a 2×2, more keep the
 * 3-wide rhythm — and `rows` caps how much of the day fits, because a
 * collage someone is going to post has a shape they want more than it has
 * every photo they took.
 */

import ClipStamp from "@/components/setlog/ClipStamp";
import type { SetlogClip } from "@/lib/setlogService";
import { formatDay } from "@/lib/setlogService";
import React from "react";
import { Image, Text, View } from "react-native";

/** The exported square, in points. `captureRef` multiplies by the device's
 *  pixel ratio, so this lands at 2–3× on any modern phone. */
export const COLLAGE_SIZE = 540;
const PADDING = 14;
const GAP = 6;
const FOOTER_H = 34;

/** The rendered height for a given grid, so a caller scaling this down can
 *  reserve the right space — a scaled child still lays out at full size. */
export const collageHeight = (count: number, columns: number, rows: number) => {
  const shown = Math.min(count, columns * rows);
  const usedRows = Math.max(1, Math.ceil(shown / columns));
  const inner = COLLAGE_SIZE - PADDING * 2;
  const cell = Math.floor((inner - GAP * (columns - 1)) / columns);
  return usedRows * cell + (usedRows - 1) * GAP + PADDING * 2 + FOOTER_H;
};

export const collageColumns = (count: number): number => {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
};

export default function DayCollage({
  day,
  photos,
  columns: columnsProp,
  rows: rowsProp,
  background = "#111827",
  showStamp = true,
  watermark = true,
}: {
  day: string;
  photos: (SetlogClip & { url: string | null })[];
  /** Omitted, the count decides — see `collageColumns`. */
  columns?: number;
  /** Omitted, every photo fits. Set, the grid is capped at rows×columns. */
  rows?: number;
  background?: string;
  /** The clock and title on each cell. Off, the photos speak for
   *  themselves — which is a reasonable thing to want and a terrible
   *  default, since the stamp is what makes a grid a day. */
  showStamp?: boolean;
  watermark?: boolean;
}) {
  // The footer's type has to survive both a dark ground and a light one.
  const light = background === "#FFFFFF" || background === "#F5F5F5";
  const ink = light ? "#111827" : "#fff";
  const quiet = light ? "#9CA3AF" : "rgba(255,255,255,0.55)";
  const columns = columnsProp ?? collageColumns(photos.length);
  const rows = rowsProp ?? Math.max(1, Math.ceil(photos.length / columns));
  // What actually fits in the chosen grid. The editor says how many are
  // left out; silently dropping them would be the collage lying about the
  // day.
  const shown = photos.slice(0, columns * rows);
  const inner = COLLAGE_SIZE - PADDING * 2;
  const cell = Math.floor((inner - GAP * (columns - 1)) / columns);
  // The grid keeps square cells and grows downwards; the square crops to
  // whatever the rows come to, so three photos do not sit in a third of a
  // canvas with two thirds of nothing under them.
  const usedRows = Math.max(1, Math.ceil(shown.length / columns));
  const gridH = usedRows * cell + (usedRows - 1) * GAP;

  return (
    <View
      style={{
        width: COLLAGE_SIZE,
        height: gridH + PADDING * 2 + FOOTER_H,
        backgroundColor: background,
        padding: PADDING,
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
        {shown.map((photo) => (
          <View
            key={photo.id}
            style={{
              width: cell,
              height: cell,
              borderRadius: 8,
              overflow: "hidden",
              backgroundColor: "#1F2937",
            }}
          >
            {photo.url ? (
              <Image
                source={{ uri: photo.url }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : null}
            {showStamp && (
              <ClipStamp
                createdAt={photo.createdAt}
                title={photo.title}
                size={cell}
                inset={6}
              />
            )}
          </View>
        ))}
      </View>

      {/* The date along the foot, and the mark only if it was asked for —
          a watermark nobody chose is an advert for the app rather than a
          day, which is why it is a toggle and not a fixture. */}
      <View
        style={{
          height: FOOTER_H,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: ink }}>
          {formatDay(day)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 13, color: quiet }}>
            {shown.length} {shown.length === 1 ? "moment" : "moments"}
          </Text>
          {watermark && (
            <Image
              source={require("@/assets/images/logo.png")}
              style={{ width: 18, height: 18, opacity: light ? 0.7 : 0.85 }}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
    </View>
  );
}
