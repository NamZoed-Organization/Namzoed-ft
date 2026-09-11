/**
 * The thing a post is about, when the post is about something for sale.
 *
 * A post can tag any product or service in the app — not only the poster's
 * own (§ Tagged products) — so this card's job is to make that link
 * unmissable and to credit whoever is actually selling it. It sits at the
 * top of the post, above the author row, because it is the *subject* of the
 * post rather than a footnote to it: RedNote puts the linked goods where the
 * eye lands first, and the tag pills this app had before were a caption you
 * had to go looking for.
 *
 * One card, not five. Up to five things can be tagged; the first is the one
 * anybody acts on, and the rest are a count that opens the full list —
 * five stacked cards would push the post itself off the screen.
 */

import { useProductPeek } from "@/contexts/ProductPeekContext";
import type { TaggedProduct } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { taggedItemPrice } from "@/utils/price";
import { Image } from "expo-image";
import { ChevronRight, ShoppingBag } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const PRIMARY = "#094569";
const THUMB = 46;

export function taggedItemHref(item: TaggedProduct) {
  return item.kind === "service"
    ? `/(users)/servicedetail/${item.id}`
    : `/(users)/product/${item.id}`;
}

export default function TaggedProductsCard({
  products,
  /** Opens the full list — the same sheet the tag pills opened. */
  onMore,
  style,
}: {
  products?: TaggedProduct[] | null;
  onMore?: () => void;
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
    <View style={[{ paddingHorizontal: 12, paddingTop: 10 }, style]}>
      <TouchableOpacity
        activeOpacity={0.85}
        // Previewed over the post rather than navigated to — nobody should
        // lose their place in a post to check a price, or to see who does
        // the work.
        onPress={() => peek.open(lead.id, lead.kind === "service" ? "service" : "product")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#F5F5F5",
          borderRadius: 12,
          borderCurve: "continuous",
          padding: 8,
        }}
      >
        {lead.image ? (
          <Image
            source={{ uri: lead.image }}
            style={{ width: THUMB, height: THUMB, borderRadius: 8 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: 8,
              borderCurve: "continuous",
              backgroundColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShoppingBag size={18} color="#9CA3AF" strokeWidth={1.8} />
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{ fontSize: 14.5, fontWeight: "600", color: "#111" }}
            numberOfLines={1}
          >
            {lead.name}
          </Text>
          {/* Whose it is. The point of letting anyone tag anything is that
              the seller gets the audience — a card that did not name them
              would read as the poster's own shop. */}
          <Text style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 1 }} numberOfLines={1}>
            {lead.owner_name
              ? lead.kind === "service"
                ? `Service by ${lead.owner_name}`
                : `Sold by ${lead.owner_name}`
              : lead.kind === "service"
                ? "Service"
                : "Product"}
          </Text>
        </View>

        {price ? (
          <Text style={{ fontSize: 14, fontWeight: "700", color: PRIMARY, marginLeft: 8 }}>
            {price}
          </Text>
        ) : null}
        <ChevronRight size={18} color="#C7C7CC" style={{ marginLeft: 2 }} />
      </TouchableOpacity>

      {extra > 0 && (
        <TouchableOpacity
          onPress={onMore}
          activeOpacity={0.7}
          style={{ alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 2 }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: PRIMARY }}>
            {`+${extra} more tagged ${extra === 1 ? "item" : "items"}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
