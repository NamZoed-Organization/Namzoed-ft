/**
 * A generated avatar, animated where the style animates.
 *
 * DiceBear's animated styles carry CSS `@keyframes` inside the SVG itself
 * (see `lib/dicebear.ts`). Neither `react-native-svg` nor `expo-image` runs
 * CSS, so both draw the first frame and stop — the only thing in the app
 * that will actually play one is a real rendering engine, so an animated
 * avatar is drawn in a `WebView` and everything else is drawn as the plain
 * raster `<Image>` the rest of the app already uses.
 *
 * **That choice is per avatar, not per screen**, and it is why this
 * component is for the one large avatar on a profile and the picker's
 * preview — not for a list. A WebView per row is a web page per row; the
 * feed, the inbox and every people list keep reading `avatar_url`, which is
 * a PNG precisely so they never have to know any of this exists.
 *
 * The still frame is drawn underneath the WebView and stays there: the web
 * view is transparent and takes a moment to load, and an avatar that starts
 * as a hole in the layout is worse than one that starts still.
 */

import { dicebearSvgUrl, isAnimatedStyle, type AvatarAnimation } from "@/lib/dicebear";
import { Image } from "expo-image";
import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

/** The page the WebView renders: the avatar, edge to edge, on nothing.
 *  `object-fit: contain` rather than a stretched `<img>` — DiceBear's
 *  viewBox is square, but a style with a scene can carry padding. */
const page = (svgUrl: string) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;height:100%}
  img{width:100%;height:100%;object-fit:contain;display:block}
</style></head>
<body><img src="${svgUrl}" alt=""></body></html>`;

export default function GeneratedAvatar({
  seed,
  style: styleId,
  animation = "none",
  size,
  /** A real photo, when the profile has one — this component then just
   *  draws it, so a caller does not need two branches of its own. */
  photoUrl,
  radius,
}: {
  seed: string;
  style?: string | null;
  animation?: AvatarAnimation;
  size: number;
  photoUrl?: string | null;
  /** Defaults to a circle, which is what an avatar is everywhere here. */
  radius?: number;
}) {
  const borderRadius = radius ?? size / 2;
  const generated = !photoUrl && !!styleId;
  const plays = generated && isAnimatedStyle(styleId) && animation !== "none";
  const stillUrl = generated
    ? dicebearSvgUrl(styleId!, seed, "none")
    : photoUrl || undefined;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: "#F5F5F5",
      }}
    >
      {stillUrl ? (
        <Image
          source={{ uri: stillUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : null}

      {plays ? (
        // The wrapper is what refuses touches — nothing in here is
        // interactive, and a web view swallowing the press meant for the
        // avatar beneath it is the one way this component could break a
        // screen it is only supposed to decorate.
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <WebView
            source={{ html: page(dicebearSvgUrl(styleId!, seed, animation)) }}
            style={{ flex: 1, backgroundColor: "transparent" }}
            scrollEnabled={false}
            originWhitelist={["*"]}
            javaScriptEnabled={false}
            androidLayerType="hardware"
            setBuiltInZoomControls={false}
            overScrollMode="never"
          />
        </View>
      ) : null}
    </View>
  );
}
