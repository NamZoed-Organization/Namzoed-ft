/**
 * "This looks like a listing" — offered while the caption is being written.
 *
 * A post selling something scrolls past once and is gone. The same thing as
 * a product or a marketplace listing has a price, a category and a place,
 * and stays findable. So when the words say selling (lib/sellingIntent.ts),
 * the composer offers the two surfaces built for it instead — and says which
 * phrase gave it away, so a wrong guess can be argued with rather than just
 * appearing.
 *
 * **Which one leads depends on who is asking.** A verified shop is offered
 * Shopping first, because that is what a shop is for. Everyone else is
 * offered the marketplace first and told what verification would add — the
 * same order, and for the same reason, as `VerifyToSellNotice`: most people
 * who reach for "sell" want the marketplace and do not know there is a
 * distinction (§ Shopping vs marketplace).
 *
 * It is dismissible and stays dismissed for the draft. A suggestion that
 * comes back after being refused is not a suggestion.
 */

import { marketplaceKindLabel, type SellingIntent } from "@/lib/sellingIntent";
import { ShoppingBag, Store, Tag, X } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const PRIMARY = "#094569";

function Choice({
  icon,
  title,
  detail,
  filled,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: filled ? PRIMARY : "#fff",
        borderRadius: 12,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: filled ? "rgba(255,255,255,0.18)" : "#F5F5F5",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text
          style={{
            fontSize: 14.5,
            fontWeight: "600",
            color: filled ? "#fff" : "#111",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12.5,
            color: filled ? "rgba(255,255,255,0.75)" : "#9CA3AF",
            marginTop: 1,
          }}
        >
          {detail}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function SellingIntentSuggestion({
  intent,
  /** Null while it is still being checked — the shop choice waits rather
   *  than flashing an offer at somebody who turns out not to have one. */
  canListProducts,
  onListProduct,
  onListMarketplace,
  onExplainVerification,
  onDismiss,
}: {
  intent: SellingIntent;
  canListProducts: boolean | null;
  onListProduct: () => void;
  onListMarketplace: () => void;
  onExplainVerification: () => void;
  onDismiss: () => void;
}) {
  const verified = canListProducts === true;

  return (
    <View
      style={{
        backgroundColor: "#F5F5F5",
        borderRadius: 14,
        borderCurve: "continuous",
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Tag size={16} color={PRIMARY} strokeWidth={1.8} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#111" }}>
            Selling something?
          </Text>
          {/* Naming the phrase is what makes this a suggestion rather than a
              guess the writer has to reverse-engineer. */}
          <Text style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2, lineHeight: 17 }}>
            {`“${intent.matched}” reads like ${marketplaceKindLabel(intent.marketplaceKind)}. A post scrolls past; a listing keeps its price and stays findable.`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: 6 }}
        >
          <X size={15} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {verified ? (
        <>
          <Choice
            filled
            icon={<ShoppingBag size={16} color="#fff" strokeWidth={1.8} />}
            title="List as a product"
            detail="Your shop front, with a price and orders"
            onPress={onListProduct}
          />
          <Choice
            icon={<Store size={16} color="#111" strokeWidth={1.8} />}
            title="Post in the marketplace"
            detail="Second hand, rent, swap, free or a vacancy"
            onPress={onListMarketplace}
          />
        </>
      ) : (
        <>
          <Choice
            filled
            icon={<Store size={16} color="#fff" strokeWidth={1.8} />}
            title="Post in the marketplace"
            detail="Open to everyone — no verification needed"
            onPress={onListMarketplace}
          />
          <Choice
            icon={<ShoppingBag size={16} color="#111" strokeWidth={1.8} />}
            title="Selling as a shop?"
            detail="A verified work profile opens the Shopping catalogue"
            onPress={onExplainVerification}
          />
        </>
      )}

      {/* The post itself is never taken away: carrying on writing is always
          an option, and it is the one that needs no button. */}
      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 10 }}>
        Or keep writing — this stays a post.
      </Text>
    </View>
  );
}
