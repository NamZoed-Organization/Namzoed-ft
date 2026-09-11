/**
 * Turning a description of edits into a file, in three stages.
 *
 * Geometry, colour and overlays are three different machines and they run
 * in that order for a reason: crop before filtering means the vignette
 * lands on the picture you kept rather than the one you threw away, and
 * flattening the words last means they are never resampled by a later
 * stage.
 *
 *   1. **Geometry** — `expo-image-manipulator`, natively and losslessly:
 *      quarter turns, flip, the straighten angle, then the crop.
 *   2. **Colour** — one GL pass at full size (`renderColorPass`), the same
 *      shader the preview uses.
 *   3. **Overlays** — words, stickers and ink flattened with `captureRef`
 *      over an off-screen copy of the result, at export width.
 *
 * **Every stage is skipped when it would be a no-op**, which matters more
 * than it sounds: a picture nobody edited comes back as the file that was
 * picked, byte for byte, rather than as a re-encoded copy one JPEG
 * generation worse. Most posted pictures are untouched, and re-compressing
 * all of them to support the few that aren't is the kind of tax nobody sees
 * and everybody pays.
 *
 * Pins are deliberately not here. A tag pinned to a jacket is data the feed
 * draws over the picture — tappable, priced live, removable later — so
 * burning it in would turn a shopping post into a photograph of one.
 */

import { renderColorPass } from "@/components/create/media/FilteredImage";
import {
  hasColor,
  hasGeometry,
  hasOverlays,
  inscribedRect,
  isUntouched,
  resolveColor,
  type ImageEdit,
} from "@/lib/mediaEdit";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";
import { captureRef } from "react-native-view-shot";

/** What the longest side of an exported picture is allowed to be. Big
 *  enough to fill a phone screen at 3× and stay sharp when zoomed; small
 *  enough that a post with ten pictures is not a 40MB upload. */
export const EXPORT_MAX_SIDE = 1440;

export const measure = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      // A picture whose size cannot be read still exports; the geometry
      // stage simply has nothing to be proportional to.
      () => resolve({ width: 0, height: 0 }),
    );
  });

/**
 * Stage one, in the order the editor's own controls read: turn, flip,
 * straighten, crop.
 *
 * The straighten is a free rotation, which leaves transparent wedges at the
 * corners, so it is immediately followed by a centre crop to the largest
 * upright rectangle that still fits (`inscribedRect`) — the alternative is
 * publishing pictures with white triangles in them.
 */
const applyGeometry = async (uri: string, edit: ImageEdit): Promise<string> => {
  const actions: ImageManipulator.Action[] = [];
  if (edit.rotate !== 0) actions.push({ rotate: edit.rotate });
  if (edit.flipH) actions.push({ flip: ImageManipulator.FlipType.Horizontal });

  let current = uri;
  if (actions.length > 0) {
    const out = await ImageManipulator.manipulateAsync(current, actions, {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    current = out.uri;
  }

  if (edit.straighten !== 0) {
    const before = await measure(current);
    const rotated = await ImageManipulator.manipulateAsync(
      current,
      [{ rotate: edit.straighten }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
    );
    const keep = inscribedRect(before.width, before.height, edit.straighten);
    if (keep.width > 0 && keep.height > 0) {
      const cropped = await ImageManipulator.manipulateAsync(
        rotated.uri,
        [
          {
            crop: {
              originX: Math.max(0, (rotated.width - keep.width) / 2),
              originY: Math.max(0, (rotated.height - keep.height) / 2),
              width: Math.min(rotated.width, keep.width),
              height: Math.min(rotated.height, keep.height),
            },
          },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      current = cropped.uri;
    } else {
      current = rotated.uri;
    }
  }

  if (edit.crop) {
    const size = await measure(current);
    if (size.width > 0) {
      const out = await ImageManipulator.manipulateAsync(
        current,
        [
          {
            crop: {
              originX: Math.round(edit.crop.x * size.width),
              originY: Math.round(edit.crop.y * size.height),
              width: Math.max(1, Math.round(edit.crop.width * size.width)),
              height: Math.max(1, Math.round(edit.crop.height * size.height)),
            },
          },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      current = out.uri;
    }
  }

  return current;
};

/**
 * Stages one and two. The overlay pass needs a mounted view, so it is not
 * here — see `flattenOverlays`, which the editor calls with its own
 * off-screen host.
 */
export const renderPixels = async (
  uri: string,
  edit: ImageEdit,
): Promise<string> => {
  if (!hasGeometry(edit) && !hasColor(edit)) return uri;

  let current = uri;
  if (hasGeometry(edit)) current = await applyGeometry(current, edit);

  if (hasColor(edit)) {
    const { adjust, tint, tintAmount } = resolveColor(edit);
    current = await renderColorPass(
      current,
      { adjust, tint, tintAmount, intensity: 1 },
      EXPORT_MAX_SIDE,
    );
  }

  return current;
};

/**
 * Stage three: flatten whatever is drawn on top.
 *
 * `captureRef` photographs a *mounted* view, so the caller keeps an
 * off-screen host at export size and hands its ref here once the picture
 * inside it has actually painted. A capture taken a frame early flattens a
 * grey rectangle — the same trap the Setlog collage documents.
 */
export const flattenOverlays = async (host: any): Promise<string> =>
  captureRef(host, { format: "jpg", quality: 0.92, result: "tmpfile" });

/** Whether stage three has anything to do — the editor uses this to decide
 *  whether to mount the off-screen host at all. */
export const needsFlatten = (edit: ImageEdit): boolean => hasOverlays(edit);

export { isUntouched };
