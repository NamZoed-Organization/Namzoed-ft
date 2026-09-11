/**
 * The thing you are about to send about, sitting in the composer.
 *
 * Arriving in a chat from a share sheet or a ContextDrop "Contact
 * Author" / "Message Seller" drop attaches the post, product, listing or
 * profile you came from to the next message. That attachment used to be a
 * 40pt thumbnail and one clipped line, which is smaller than the thing it
 * describes is anywhere else in the app — and it left the composer saying
 * *that* you had brought something along without saying *what*. Since the
 * card that lands in the conversation is the full one (image, byline,
 * caption, date, price), the preview of it should be recognisably the same
 * card: same kind label, same title weight, same byline wording, same price
 * line — a preview that summarises differently to the thing it previews is
 * a second design to keep in step, and it drifts.
 *
 * It is horizontal where the sent card is vertical, and that is the one
 * deliberate difference: the sent card owns its whole bubble, while this
 * one is borrowing height from the message you are writing. 76pt of image
 * beside four lines of text is as much as the composer can give up without
 * the text field becoming the smaller half of it.
 *
 * **The composer grows into it rather than jumping.** The card's own height
 * is measured once and then animated, so the pill opens like a drawer from
 * the composer row's edge instead of the input field teleporting up the
 * screen — and it closes the same way when the attachment is removed, which
 * is why this component keeps rendering its last attachment while
 * collapsing (`renderMeta` below) rather than unmounting the instant the
 * parent's state clears.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const PRIMARY = "#094569";
/** Out on the same curve the app's other reveals use; back a little
 *  quicker, since a thing being removed should not be dwelt on. */
const OPEN_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) };
const CLOSE_TIMING = { duration: 180, easing: Easing.in(Easing.cubic) };
const IMAGE_SIZE = 76;

export type SharedContextMeta = {
  id: string;
  title: string;
  price?: string;
  imageUrl?: string;
  source?: "product" | "marketplace" | "post" | "profile";
  /** Post caption / product description / profile bio — the card's body text. */
  caption?: string;
  /** ISO date string — post/listing creation date. */
  date?: string;
  /** Free-text location — currently only populated for posts. */
  location?: string;
  /** Author / seller / profile handle. */
  username?: string;
  isVerified?: boolean;
};

/** What a kind of attachment is called, what stands in for it when it has
 *  no picture, and what tapping it says it will do. Shared with the sent
 *  card in the conversation, so a shared post is called a post in the
 *  composer and a post in the bubble — the two used to disagree ("Shared
 *  marketplace item" against "Marketplace") for no reason but being written
 *  twice. */
export const sharedContextKind = (source?: SharedContextMeta["source"]) =>
  source === "profile"
    ? { label: "Profile", icon: "person-circle-outline" as const, cta: "View Profile" }
    : source === "post"
      ? { label: "Post", icon: "image-outline" as const, cta: "Go to Post" }
      : source === "marketplace"
        ? { label: "Marketplace", icon: "storefront-outline" as const, cta: "View Listing" }
        : { label: "Product", icon: "pricetag-outline" as const, cta: "View Product" };

export const formatSharedCardDate = (iso?: string): string => {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function ComposerContextCard({
  meta,
  onOpen,
  onRemove,
  onTransitionStart,
  onTransitionEnd,
}: {
  /** null once the attachment is cleared — the card collapses, then goes. */
  meta: SharedContextMeta | null;
  onOpen: (meta: SharedContextMeta) => void;
  onRemove: () => void;
  /** The composer's own height is about to change every frame; see the
   *  measurement guards at the call site. */
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}) {
  // Kept through the collapse so the card does not vanish a frame before
  // the space it was in does.
  const [renderMeta, setRenderMeta] = useState<SharedContextMeta | null>(meta);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  const reveal = useSharedValue(0);
  const onTransitionEndRef = useRef(onTransitionEnd);
  onTransitionEndRef.current = onTransitionEnd;

  useEffect(() => {
    if (meta) setRenderMeta(meta);
  }, [meta]);

  const settle = useCallback((opened: boolean) => {
    if (!opened) setRenderMeta(null);
    onTransitionEndRef.current?.();
  }, []);

  useEffect(() => {
    // Nothing to animate to until the card has been laid out once.
    if (!contentHeight) return;
    const open = !!meta;
    onTransitionStart?.();
    const timing = open ? OPEN_TIMING : CLOSE_TIMING;
    reveal.value = withTiming(open ? 1 : 0, timing);
    height.value = withTiming(open ? contentHeight : 0, timing, (finished) => {
      "worklet";
      if (finished) runOnJS(settle)(open);
    });
    // onTransitionStart is a stable callback at the call site; re-running
    // this on a new identity would restart the animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, contentHeight, settle]);

  const wrapperStyle = useAnimatedStyle(() => ({ height: height.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 10 }],
  }));

  const kind = sharedContextKind(renderMeta?.source);
  const dateLabel = formatSharedCardDate(renderMeta?.date);
  const byline = renderMeta?.username
    ? renderMeta.source === "product" || renderMeta.source === "marketplace"
      ? `Sold by ${renderMeta.username}`
      : `@${renderMeta.username}`
    : "";

  return (
    <Reanimated.View style={[{ overflow: "hidden" }, wrapperStyle]}>
      {/* Anchored to the bottom and measured there, so the card is revealed
          upward out of the composer row rather than the wrapper's growth
          being driven by the very thing it is animating. */}
      <Reanimated.View
        style={[
          { position: "absolute", left: 0, right: 0, bottom: 0 },
          contentStyle,
        ]}
        onLayout={(e) => {
          const measured = Math.round(e.nativeEvent.layout.height);
          if (measured > 0 && Math.abs(measured - contentHeight) > 1) {
            setContentHeight(measured);
          }
        }}
      >
        {renderMeta ? (
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
            <Pressable
              onPress={() => onOpen(renderMeta)}
              style={{
                flexDirection: "row",
                borderRadius: 14,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                backgroundColor: "#fff",
                padding: 8,
              }}
            >
              {renderMeta.imageUrl ? (
                <Image
                  source={{ uri: renderMeta.imageUrl }}
                  style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: IMAGE_SIZE,
                    height: IMAGE_SIZE,
                    borderRadius: 10,
                    borderCurve: "continuous",
                    backgroundColor: "#F3F4F6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={kind.icon} size={30} color="#9CA3AF" />
                </View>
              )}

              <View style={{ flex: 1, marginLeft: 10, paddingRight: 26 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: PRIMARY,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {kind.label}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: "#111827", flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {renderMeta.title}
                  </Text>
                  {renderMeta.isVerified ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={PRIMARY}
                      style={{ marginLeft: 4 }}
                    />
                  ) : null}
                </View>

                {byline ? (
                  <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }} numberOfLines={1}>
                    {byline}
                  </Text>
                ) : null}

                {renderMeta.caption ? (
                  <Text
                    style={{ fontSize: 13, lineHeight: 18, color: "#6B7280", marginTop: 2 }}
                    numberOfLines={2}
                  >
                    {renderMeta.caption}
                  </Text>
                ) : null}

                {/* The occasional facts, on one line — a row each for price,
                    date and place would make the composer taller than the
                    message being written. */}
                {(renderMeta.source !== "profile" && renderMeta.price) ||
                dateLabel ||
                renderMeta.location ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 4,
                      gap: 10,
                    }}
                  >
                    {renderMeta.source !== "profile" && renderMeta.price ? (
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: PRIMARY }}>
                        Nu. {renderMeta.price}
                      </Text>
                    ) : null}
                    {dateLabel ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="calendar-outline" size={11} color="#9CA3AF" />
                        <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{dateLabel}</Text>
                      </View>
                    ) : null}
                    {renderMeta.location ? (
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 }}
                      >
                        <Ionicons name="location-outline" size={11} color="#9CA3AF" />
                        <Text style={{ fontSize: 11, color: "#9CA3AF" }} numberOfLines={1}>
                          {renderMeta.location}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Out of the text's way in the corner, not in the row with
                  it — the card is four lines now, and a close button
                  vertically centred against four lines lands beside
                  whichever one happens to be in the middle. */}
              <Pressable
                onPress={onRemove}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={14} color="#6B7280" />
              </Pressable>
            </Pressable>
          </View>
        ) : null}
      </Reanimated.View>
    </Reanimated.View>
  );
}
