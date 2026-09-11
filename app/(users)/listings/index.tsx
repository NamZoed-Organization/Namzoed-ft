/**
 * Everything you have put up for sale, in one screen.
 *
 * The destination for the "+" menu's Product, the Marketplace tab's empty
 * state, both profiles' Products tabs and the hamburger menu. It replaced a
 * blurred "premium header" over pill tabs and shadowed cards — a screen that
 * looked like a different app than the one around it — and is now the app's
 * own grammar: grey ground, white groups at radius 18, hairline separators,
 * plain text tabs with a 24×2 underline, and the one action in the header.
 *
 * **Which half you land on is decided by whether you have a shop.**
 * `canListProducts` — a verified work profile — is the only rule. With one
 * you open on Products, without one on Marketplace, because that is the
 * surface built for selling your own used things. The Products tab is never
 * hidden from people without a shop: it explains what a shop is, which is
 * the difference between a locked door and a signpost.
 *
 * **A row is a thing you own, so a hold selects it.** Deleting is the only
 * destructive act here and it lives behind a hold and a confirmation, never
 * behind a swipe that a scroll can trigger by accident.
 */

import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import EditMarketplaceModal from "@/components/modals/EditMarketplaceModal";
import EditProductModal from "@/components/modals/EditProductModal";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import VerifyToSellNotice from "@/components/VerifyToSellNotice";
import { MODAL_RADIUS } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { fetchUserMarketplaceItems, MarketplaceItem } from "@/lib/postMarketPlace";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { canListProducts } from "@/lib/sellerService";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GROUP_INSET = 12;
const THUMB = 54;
const ACCENT = "#0369A1";

/** Two, because those are the two things you can *put up*. Saved things are
 *  somebody else's listings kept for later — a different job, and it already
 *  has a home in Settings › Saved Posts. */
type Tab = "products" | "marketplace";

const TABS: { key: Tab; label: string }[] = [
  { key: "products", label: "Products" },
  { key: "marketplace", label: "Marketplace" },
];

/** One row's worth of any of the three kinds, so the list has one shape. */
interface Row {
  id: string;
  title: string;
  image?: string;
  secondary: string;
  trailing?: string;
  onOpen: () => void;
}

export default function ListingsScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const userId = currentUser?.id ? String(currentUser.id) : null;

  const [tab, setTab] = useState<Tab>(
    section === "marketplace" ? "marketplace" : "products",
  );
  const [canSell, setCanSell] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editListing, setEditListing] = useState<MarketplaceItem | null>(null);
  const [showVerify, setShowVerify] = useState(false);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "success", title: "", message: "" });

  // ── Data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [productRows, listingRows] = await Promise.all([
        fetchUserProducts(userId),
        fetchUserMarketplaceItems(userId),
      ]);
      setProducts(productRows ?? []);
      setListings(listingRows ?? []);
    } catch (e) {
      console.error("[listings] load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    canListProducts(userId)
      .then((allowed) => {
        setCanSell(allowed);
        // Only moves away from Products when no tab was asked for: somebody
        // who tapped "Products" stays there and reads why it is empty.
        if (!allowed && !section) setTab("marketplace");
      })
      .catch(() => setCanSell(false));
  }, [section, userId]);

  // Coming back from a form, the thing just listed has to be in the list.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // ── Rows ──────────────────────────────────────────────────────────────

  const rows: Row[] = useMemo(() => {
    if (tab === "products")
      return products.map((p) => ({
        id: p.id,
        title: p.name,
        image: p.images?.[0],
        secondary: p.category ?? "Product",
        trailing: `Nu. ${Number(p.price ?? 0).toLocaleString()}`,
        onOpen: () => setEditProduct(p),
      }));
    if (tab === "marketplace")
      return listings.map((m) => ({
        id: m.id,
        title: m.title,
        image: m.images?.[0],
        secondary: MARKET_LABEL[m.type] ?? "Listing",
        trailing:
          m.type === "free" || !m.price
            ? "Free"
            : `Nu. ${Number(m.price).toLocaleString()}`,
        onOpen: () => setEditListing(m),
      }));
    return [];
  }, [listings, products, tab]);

  const selecting = selected.length > 0;

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const remove = async () => {
    const table = tab === "products" ? "products" : "marketplace";
    const { error } = await supabase.from(table).delete().in("id", selected);
    setConfirming(false);
    if (error) {
      setPopup({
        visible: true,
        type: "error",
        title: "Couldn't delete",
        message: error.message,
      });
      return;
    }
    if (tab === "products") setProducts((p) => p.filter((i) => !selected.includes(i.id)));
    if (tab === "marketplace") setListings((m) => m.filter((i) => !selected.includes(i.id)));
    setSelected([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /** The header's one action, and what it means on each tab. */
  const startNew = () => {
    if (tab === "marketplace") {
      router.push("/(users)/listings/new-marketplace" as any);
      return;
    }
    // Said before the form rather than after it — the database refuses an
    // unverified seller's product either way.
    if (canSell) router.push("/(users)/listings/new-product" as any);
    else setShowVerify(true);
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

      {/* § Header — chevron, centred title, at most one text action. In
          selection the action becomes Cancel, because leaving the selection
          is the only thing anybody wants from the top of the screen then. */}
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <TouchableOpacity onPress={() => router.back()} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          pointerEvents="none"
          className="items-center justify-center"
        >
          <Text className="text-[17px] font-semibold text-gray-900">
            {selecting ? `${selected.length} selected` : "Listings"}
          </Text>
        </View>
        {selecting ? (
          <TouchableOpacity onPress={() => setSelected([])} className="py-1">
            <Text className="text-[17px] font-medium" style={{ color: "#6B7280" }}>
              Cancel
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startNew} className="py-1">
            <Text className="text-[17px] font-medium" style={{ color: ACCENT }}>
              New
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* § Tabs and pills — plain text, a 24×2 underline, never chips. */}
      <View style={{ flexDirection: "row", gap: 18, paddingHorizontal: 16, paddingBottom: 10 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => {
                setTab(t.key);
                setSelected([]);
              }}
              activeOpacity={0.8}
              style={{ alignItems: "center" }}
            >
              <Text
                style={{
                  fontSize: on ? 17 : 15,
                  fontWeight: on ? "700" : "500",
                  color: on ? "#111827" : "#9CA3AF",
                }}
              >
                {t.label}
              </Text>
              <View
                style={{
                  marginTop: 4,
                  width: 24,
                  height: 2,
                  borderRadius: 1,
                  borderCurve: "continuous",
                  backgroundColor: on ? "#111827" : "transparent",
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GROUP_INSET,
            paddingBottom: insets.bottom + (selecting ? 96 : 24),
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#094569"
            />
          }
        >
          {rows.length === 0 ? (
            <EmptyState
              tab={tab}
              canSell={canSell}
              onAct={tab === "products" && canSell === false ? () => setShowVerify(true) : startNew}
            />
          ) : (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 18,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              {rows.map((row, i) => (
                <ListingRow
                  key={row.id}
                  row={row}
                  first={i === 0}
                  selected={selected.includes(row.id)}
                  selecting={selecting}
                  onPress={() => (selecting ? toggle(row.id) : row.onOpen())}
                  onLongPress={() => toggle(row.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Deleting is the one destructive act here, so it sits in its own bar
          rather than in the header where a mis-tap lives. */}
      {selecting && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 12) + 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setConfirming(true)}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#DC2626",
              borderRadius: MODAL_RADIUS,
              borderCurve: "continuous",
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Trash2 size={18} color="#fff" strokeWidth={2} />
            <Text style={{ color: "#fff", fontSize: 15.5, fontWeight: "700" }}>
              Delete {selected.length}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Named by what is going — taking a product down and taking a
          listing down are not quite the same act either. */}
      <DeleteConfirmationModal
        visible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        postContent={`${selected.length} ${tab === "products" ? "product" : "listing"}${selected.length === 1 ? "" : "s"}`}
      />

      <VerifyToSellNotice visible={showVerify} onClose={() => setShowVerify(false)} />

      {/* Editing keeps its existing forms for now — a row opens the one
          that belongs to its kind. */}
      {editProduct && userId && (
        <EditProductModal
          isVisible
          product={editProduct}
          userId={userId}
          onClose={() => setEditProduct(null)}
          onSuccess={() => {
            setEditProduct(null);
            load();
          }}
        />
      )}

      {editListing && userId && (
        <EditMarketplaceModal
          isVisible
          item={editListing}
          userId={userId}
          onClose={() => setEditListing(null)}
          onSuccess={() => {
            setEditListing(null);
            load();
          }}
        />
      )}
    </View>
  );
}

const MARKET_LABEL: Record<string, string> = {
  rent: "For rent",
  swap: "Swap",
  second_hand: "Second hand",
  free: "Free",
  job_vacancy: "Job vacancy",
};

// ── Pieces ──────────────────────────────────────────────────────────────

function ListingRow({
  row,
  first,
  selected,
  selecting,
  onPress,
  onLongPress,
}: {
  row: Row;
  first: boolean;
  selected: boolean;
  selecting: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: selected ? "#EFF6FB" : "#fff",
      }}
    >
      {!first && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 16 + THUMB + 12,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: "#f0f0f0",
          }}
        />
      )}

      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: 10,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {row.image ? (
          <ProgressiveImage
            uri={row.image}
            style={{ width: "100%", height: "100%" }}
            showProgress={false}
            recyclingKey={row.id}
          />
        ) : (
          <Package size={20} color="#9CA3AF" strokeWidth={1.8} />
        )}
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
          {row.title}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
          {row.secondary}
        </Text>
      </View>

      {row.trailing && (
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#094569", marginLeft: 8 }}>
          {row.trailing}
        </Text>
      )}

      {selecting ? (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderCurve: "continuous",
            marginLeft: 10,
            borderWidth: 2,
            borderColor: selected ? ACCENT : "#D1D5DB",
            backgroundColor: selected ? ACCENT : "transparent",
          }}
        />
      ) : (
        <ChevronRight size={18} color="#C7C7CC" style={{ marginLeft: 8 }} />
      )}
    </TouchableOpacity>
  );
}

/** An empty tab is where somebody has arrived to *do* something, so it
 *  offers that — except Products without a shop, where what has to be
 *  explained is not "add one" but what a shop is. */
function EmptyState({
  tab,
  canSell,
  onAct,
}: {
  tab: Tab;
  canSell: boolean | null;
  onAct: () => void;
}) {
  const unverified = tab === "products" && canSell === false;
  const Icon = unverified ? Store : ShoppingBag;

  const title = unverified
    ? "Shopping is for verified shops"
    : tab === "products"
      ? "No products yet"
      : "Nothing listed yet";

  const body = unverified
    ? "Verify your work profile to list on the catalogue — or sell it on the marketplace, which is what that is for."
    : tab === "products"
      ? "Your catalogue is empty. Add the first thing you sell."
      : "Sell something you already own — a phone, a sofa, one of anything.";

  return (
    <View style={{ alignItems: "center", paddingTop: 72, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderCurve: "continuous",
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Icon size={24} color="#9CA3AF" strokeWidth={1.8} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827", textAlign: "center" }}>
        {title}
      </Text>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 21,
          color: "#9CA3AF",
          textAlign: "center",
          marginTop: 6,
        }}
      >
        {body}
      </Text>
      <TouchableOpacity
        onPress={onAct}
        activeOpacity={0.85}
        style={{
          marginTop: 18,
          backgroundColor: "#094569",
          paddingHorizontal: 20,
          paddingVertical: 11,
          borderRadius: 999,
          borderCurve: "continuous",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
          {unverified ? "See how" : tab === "products" ? "New product" : "New listing"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
