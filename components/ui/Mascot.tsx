/**
 * The mongoose — the app's own face, in eight moods.
 *
 * One component and one map, because `require` needs a literal path and a
 * map scattered across screens is how the same picture ends up at three
 * different sizes with two different spellings. (The file for `surprised`
 * is `suprised.png` on disk; that is hidden here, once, rather than being
 * copied into every call site.)
 *
 * **Where it belongs**: teaching and waiting. It fronts every tutorial card
 * because a guide with a face is what makes a walkthrough feel played
 * rather than read, and it sleeps on an empty day in Setlog because a day
 * nobody has recorded is not an error to apologise for. It has no place on
 * a working screen, a form, or anything the user is in the middle of — a
 * mascot that turns up in the way of the task is a mascot people learn to
 * resent.
 *
 * The art is not one aspect ratio — asleep it is wide, standing it is tall
 * — so it is always drawn `contain` inside a square box. Sizing by width
 * alone would make the sleeping one twice the visual weight of the rest.
 */

import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

export type MascotMood =
  /** Not a mood: the mongoose ascended, for a feature that is becoming
   *  something bigger rather than merely missing. */
  | "super"
  | "normal"
  | "angry"
  | "confused"
  | "excited"
  | "sad"
  | "sleepy"
  | "superexcited"
  | "surprised";

/**
 * Relative, not `@/`: the alias is a tsconfig path that Metro applies to
 * source but not reliably to assets, and an unresolvable asset is a bundling
 * failure rather than a missing picture. A relative require needs no
 * resolver configuration at all.
 */
const ART: Record<MascotMood, any> = {
  super: require("../../assets/mascot/supermong.png"),
  normal: require("../../assets/mascot/normal.png"),
  angry: require("../../assets/mascot/angry.png"),
  confused: require("../../assets/mascot/confused.png"),
  excited: require("../../assets/mascot/excited.png"),
  sad: require("../../assets/mascot/sad.png"),
  sleepy: require("../../assets/mascot/sleepy.png"),
  superexcited: require("../../assets/mascot/superexcited.png"),
  surprised: require("../../assets/mascot/suprised.png"),
};

export default function Mascot({
  mood = "normal",
  size = 48,
  style,
}: {
  mood?: MascotMood;
  /** The side of the square it is drawn inside, not its own width. */
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={ART[mood]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      // Decorative in every use so far — the words beside it always say the
      // same thing, and a screen reader announcing "picture of a mongoose"
      // between a title and its body is noise.
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
