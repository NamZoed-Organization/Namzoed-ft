/**
 * A day's photos as one picture, in the shape it is going to be posted in.
 *
 * **Nothing is cropped.** It was a nine-split grid of square cells drawn
 * with `resizeMode="cover"`, which is a decision to cut the top and bottom
 * off every portrait photo and the sides off every landscape one — and on a
 * phone that is nearly all of them. The crop lands wherever the subject
 * happens not to be, so a day out came back with people's heads missing and
 * nothing in the editor could fix it. Every photo is now drawn at its own
 * aspect ratio, exactly, and the arrangement bends around them:
 * `lib/collageLayout.ts` cuts them into rows, gives everything in a row a
 * common height, and fits the block to the frame. The square grid was a
 * shape imposed on the photos; this is the photos deciding the shape.
 *
 * **Two frames, because there are two places this goes.** Portrait 4:5 is
 * the feed shape — the tallest a picture can be on Instagram before it is
 * cropped for you, which is the whole point — and landscape 3:2 is the
 * photographic one, for a day that was mostly wide. They are the same
 * layout at different proportions, not two designs.
 *
 * **Edge to edge, and the caption sits on top of the photos.** It used to
 * hold the block inside a 22pt margin with a 40pt band under it for the
 * date, and centre whatever was left over as a mat — so a collage arrived as
 * a small picture in a large field of background. It now fills the frame:
 * the rows span it, the block is stretched to its height, and the date, the
 * count and the mark are drawn over the bottom of the photographs behind a
 * short scrim.
 *
 * The cost is a crop, and it is worth stating plainly because this file used
 * to promise the opposite. Filling a fixed frame with photographs of
 * whatever shape the phone happened to be held in cannot be done without
 * losing some of them — that is geometry, not a shortcoming of the layout.
 * What the layout can do is make the loss as small as possible and share it
 * out evenly, and it does both: the arrangement is picked to need the least
 * stretch, every cell is then cropped by exactly the same proportion, and
 * past `MAX_CROP` it stops and leaves a band rather than destroy a photo
 * (`lib/collageLayout.ts`).
 *
 * Each cell keeps the stamp the camera put on it — `ClipStamp`, the same
 * component the feed card and the reel's panes use.
 *
 * It is laid out at the size it will be exported at rather than the size it
 * is previewed at, because `captureRef` flattens what is on screen: a
 * collage laid out to fit a phone and then scaled up is a blurry collage.
 * The preview scales the whole thing down with a transform instead, so what
 * you look at and what you get are the same pixels.
 */

import ClipStamp from "@/components/setlog/ClipStamp";
import { layoutCollage, safeAspect } from "@/lib/collageLayout";
import { LinearGradient } from "expo-linear-gradient";
import type { SetlogClip } from "@/lib/setlogService";
import { formatDay } from "@/lib/setlogService";
import React, { useMemo } from "react";
import { Image, Text, View } from "react-native";

export type CollageFormat = "portrait" | "landscape";

/** In points. `captureRef` multiplies by the device's pixel ratio, so these
 *  land at 1080×1350 and 1440×960 on a 2× phone and half again on a 3×. */
export const COLLAGE_FORMATS: Record<
  CollageFormat,
  { width: number; height: number; label: string; note: string }
> = {
  portrait: {
    width: 540,
    height: 675,
    label: "Portrait",
    note: "4:5 — the tallest a feed post can be",
  },
  landscape: {
    width: 720,
    height: 480,
    label: "Landscape",
    note: "3:2 — the photographic shape",
  },
};

/** No outer margin at all: the photographs run to the edge of the file.
 *  The gap between cells stays, as a thin rule of the background colour —
 *  that is what separates one photo from the next now that nothing else
 *  does. */
const GAP = 4;
/** Square corners, because a rounded one at the frame's edge leaves a wedge
 *  of background in each corner of the export, which reads as a mistake
 *  rather than as a radius. */
const RADIUS = 0;
/** The strip the caption sits over — not a band that takes space from the
 *  photos, just the part of them it is drawn on. */
const CAPTION_H = 76;

export const collageSize = (format: CollageFormat) => COLLAGE_FORMATS[format];

export default function DayCollage({
  day,
  photos,
  aspects,
  format = "portrait",
  background = "#111827",
  showStamp = true,
  watermark = true,
}: {
  day: string;
  photos: (SetlogClip & { url: string | null })[];
  /** Measured width ÷ height per clip id. Anything missing is treated as
   *  square — a photo drawn at the wrong ratio would be the one thing this
   *  component promises not to do, so the caller measures before it renders
   *  (see the editor) and this is only the floor under that. */
  aspects: Record<string, number>;
  format?: CollageFormat;
  background?: string;
  /** The clock and title on each cell. Off, the photos speak for
   *  themselves — which is a reasonable thing to want and a terrible
   *  default, since the stamp is what makes a grid a day. */
  showStamp?: boolean;
  watermark?: boolean;
}) {
  const frame = COLLAGE_FORMATS[format];
  // The caption is white over a scrim now, so it no longer has to survive a
  // light ground — but a cell still needs one of its own while its photo
  // loads, and on a white collage a near-black well reads as a hole rather
  // than as a photo coming.
  const light = background === "#FFFFFF" || background === "#F5F5F5";
  const well = light ? "#ECECEC" : "#1F2937";

  const inner = { width: frame.width, height: frame.height };

  const layout = useMemo(
    () =>
      layoutCollage(
        photos.map((p) => ({ id: p.id, aspect: safeAspect(aspects[p.id]) })),
        { width: inner.width, height: inner.height, gap: GAP },
      ),
    [photos, aspects, inner.width, inner.height],
  );

  // Normally zero — the block is the frame. It is only non-zero when the
  // layout refused to crop this far and left a band (see MAX_CROP), and then
  // the band is split evenly rather than pooling at the bottom.
  const offsetX = (inner.width - layout.blockWidth) / 2;
  const offsetY = (inner.height - layout.blockHeight) / 2;

  const byId = useMemo(
    () => new Map(photos.map((p) => [p.id, p])),
    [photos],
  );

  return (
    <View
      style={{
        width: frame.width,
        height: frame.height,
        backgroundColor: background,
      }}
    >
      <View style={{ width: inner.width, height: inner.height }}>
        {layout.items.map((cell) => {
          const photo = byId.get(cell.id);
          if (!photo) return null;
          return (
            <View
              key={cell.id}
              style={{
                position: "absolute",
                left: offsetX + cell.x,
                top: offsetY + cell.y,
                width: cell.width,
                height: cell.height,
                borderRadius: RADIUS,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: well,
              }}
            >
              {photo.url ? (
                <Image
                  source={{ uri: photo.url }}
                  style={{ width: "100%", height: "100%" }}
                  // The cell is already the photo's own shape, so this
                  // neither crops nor letterboxes — it is exact. `cover` is
                  // kept over `contain` only because a half-pixel rounding
                  // error should close a hairline seam rather than open one.
                  resizeMode="cover"
                />
              ) : null}
              {showStamp && (
                <ClipStamp
                  createdAt={photo.createdAt}
                  title={photo.title}
                  // The short side: a stamp scaled to a wide cell's width
                  // would overrun a shallow one's height.
                  size={Math.min(cell.width, cell.height)}
                  inset={6}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Over the photographs, not in a band of its own.
          A scrim rather than a solid strip: the picture underneath keeps
          going to the edge of the file, and the type stays readable over a
          bright sky or a dark room without a bar cutting the collage short.
          The mark is drawn only if it was asked for — a watermark nobody
          chose is an advert for the app rather than a day, which is why it
          is a toggle and not a fixture. */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: CAPTION_H,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingBottom: 14,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            letterSpacing: 0.2,
            color: "#fff",
            // The type is over a photograph now, so it carries its own
            // legibility rather than relying on the ground being light or
            // dark — the same trade ClipStamp makes over a clip.
            textShadowColor: "rgba(0,0,0,0.5)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 8,
          }}
        >
          {formatDay(day)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              textShadowColor: "rgba(0,0,0,0.5)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 8,
            }}
          >
            {photos.length} {photos.length === 1 ? "moment" : "moments"}
          </Text>
          {watermark && (
            <Image
              source={require("@/assets/images/logo.png")}
              style={{ width: 20, height: 20, opacity: 0.95 }}
              resizeMode="contain"
            />
          )}
        </View>
      </LinearGradient>
    </View>
  );
}
