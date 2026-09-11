/**
 * The tagged-product card, shrunk to what a grid tile can carry.
 *
 * The full card (`TaggedProductsCard`) is a 46pt thumbnail, a name, the
 * seller and a price — right for the top of a post, and far too much for a
 * tile roughly 175pt wide, where it would take more height than the caption
 * and push the picture off the card. So this is the same information at
 * tile scale: a small thumbnail, the name, the price, and a count when
 * there is more than one.
 *
 * It exists because a post that is *about something for sale* should say so
 * before you open it. Without this the grid gave no hint at all, and the
 * whole point of allowing anyone to tag anyone's product (§ Tagged
 * products) is that the seller reaches an audience — which they only do if
 * the tag is visible where people are actually browsing.
 *
 * **It is a link, not a decoration.** Tapping it opens the product rather
 * than the post: somebody who taps a price wants the thing, and the picture
 * around it is already the way into the post.
 *
 * It is the one thing on a tile allowed an accent. Everything else in the
 * grid is grey on white by design (§ Colour), so a hairline of the brand
 * blue and the faintest wash behind it is enough to lift the strip off the
 * card without turning the waterfall into a row of coloured boxes — and it
 * runs wider than the caption above it, out to the tile's own edges, so it
 * reads as a band across the card rather than another line of text.
 */

import { useProductPeek } from "@/contexts/ProductPeekContext";
import type { TaggedProduct } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { taggedItemPrice } from "@/utils/price";
import { Image } from "expo-image";
import { ShoppingBag } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { taggedItemHref } from "@/components/post/TaggedProductsCard";

const PRIMARY = "#094569";
/** A hairline of the brand blue, and a wash of it — not a filled pill. The
 *  strip has to be found at a glance in a scrolling grid and still be the
 *  quietest thing on the card next to the photograph. */
const EDGE = "rgba(9, 69, 105, 0.35)";
const TINT = "#F1F6F9";
const THUMB = 26;

export default function TaggedProductStrip({
  products,
  style,
}: {
  products?: TaggedProduct[] | null;
  style?: object;
}) {
  const router = useAppRouter();
  const peek = useProductPeek();
  const items = products ?? [];
  if (items.length === 0) return null;

  const lead = items[0];
  const extra = items.length - 1;
  const price = taggedItemPrice(lead);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      // A tag is usually a glance, not a journey: it previews in a sheet
      // over the grid (contexts/ProductPeekContext.tsx) and pulls up into
      // the full screen if there is more to know. Services do the same now
      // that they have a screen of the same shape to grow into.
      onPress={() => peek.open(lead.id, lead.kind === "service" ? "service" : "product")}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          // Wider than the text above it: the tile pads its body by 9, and
          // pulling back 5 of that on each side runs the band nearly to the
          // card's edges without touching them.
          marginHorizontal: -5,
          backgroundColor: TINT,
          borderRadius: 8,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: EDGE,
          paddingHorizontal: 6,
          paddingVertical: 5,
          marginTop: 8,
        },
        style,
      ]}
    >
      {lead.image ? (
        <Image
          source={{ uri: lead.image }}
          style={{ width: THUMB, height: THUMB, borderRadius: 5 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: 5,
            borderCurve: "continuous",
            backgroundColor: "#E5E7EB",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShoppingBag size={13} color="#9CA3AF" strokeWidth={1.8} />
        </View>
      )}

      {/* The name gives way before the price does: a price is the shorter
          and the more decisive of the two, and a name truncated at a tile's
          width still says what kind of thing it is. */}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          marginLeft: 6,
          fontSize: 11.5,
          fontWeight: "600",
          color: "#374151",
        }}
      >
        {lead.name}
      </Text>

      {price ? (
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: "700",
            color: PRIMARY,
            marginLeft: 5,
          }}
        >
          {price}
        </Text>
      ) : null}

      {extra > 0 && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: "#9CA3AF",
            marginLeft: 5,
          }}
        >
          +{extra}
        </Text>
      )}
    </TouchableOpacity>
  );
}
