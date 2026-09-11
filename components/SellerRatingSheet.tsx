/**
 * SellerRatingSheet
 *
 * The write path for `seller_ratings` — the business's own reputation, as
 * opposed to any one product's.
 *
 * The read side of this (BusinessProfileHeader, ShopReviews,
 * SellerCredibilityCard) was built before anything wrote a row, so every
 * business profile said "No ratings yet" permanently. This is the half that
 * was missing: three questions about trading with a business, asked once the
 * buyer has already said something about the item.
 *
 * It asks the three DSR dimensions rather than one star, because that is what
 * the table holds and what the profile shows — collapsing them to a single
 * number here would mean inventing the split again on read. Every dimension
 * is optional: a buyer who has an opinion about the service and none about
 * delivery leaves delivery blank, and the summary averages whichever were
 * answered. Blank is stored as null, never as zero.
 *
 * Wording follows the kind of business (RATING_DIMENSION_LABELS): "Delivery"
 * is the wrong word for a carpenter, "Timeliness" the wrong word for a parcel.
 *
 * Shell is `BottomSheetModal` per UI_STANDARD § Sheets — handle, independent
 * backdrop fade, drag-to-dismiss on the handle, `avoidKeyboard` for the note.
 */

import BottomSheetModal from "@/components/modals/BottomSheetModal";
import CircularLoader from "@/components/ui/CircularLoader";
import StarPicker from "@/components/ui/StarPicker";
import { MODAL_RADIUS } from "@/constants/theme";
import {
  fetchMySellerRating,
  RATING_DIMENSION_LABELS,
  submitSellerRating,
  type BusinessKind,
  type MySellerRating,
} from "@/lib/sellerService";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

export interface SellerRatingSheetProps {
  visible: boolean;
  onClose: () => void;
  /** service_providers.id — what the rating keys off. */
  providerId: string;
  buyerId: string;
  businessName: string;
  kind: BusinessKind;
  /** Told the overall this buyer just left, so a caller can update in place
   *  rather than refetch. */
  onSubmitted?: (overall: number) => void;
  /** Dev only: stands in for both round trips, so the fixture-driven preview
   *  in Dev Components can exercise the real sheet without a work profile
   *  behind it and without writing a row. Same convention as
   *  BusinessProfileHeader's `previewRatings`. */
  preview?: { existing: MySellerRating | null };
}

export default function SellerRatingSheet({
  visible,
  onClose,
  providerId,
  buyerId,
  businessName,
  kind,
  onSubmitted,
  preview,
}: SellerRatingSheetProps) {
  const insets = useSafeAreaInsets();
  const labels = RATING_DIMENSION_LABELS[kind];

  const [asDescribed, setAsDescribed] = useState(0);
  const [service, setService] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Whether this buyer already had a row — changes the verb on the button,
  // which is the only honest way to tell somebody they are editing rather
  // than adding a second rating.
  const [editing, setEditing] = useState(false);

  // Held in a ref, not a dependency: callers pass a fresh object literal each
  // render, and depending on its identity re-ran this effect on every render
  // — resetting the stars the moment one was tapped.
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const isPreview = !!preview;

  // Loads on every open rather than once: a buyer can rate from a product
  // page and then open the same sheet from a service page, and the second one
  // must show what the first one left.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const apply = (mine: MySellerRating | null) => {
      setAsDescribed(mine?.asDescribed ?? 0);
      setService(mine?.service ?? 0);
      setDelivery(mine?.delivery ?? 0);
      setComment(mine?.comment ?? "");
      setEditing(mine != null);
      setLoading(false);
    };

    if (isPreview) {
      apply(previewRef.current?.existing ?? null);
      return;
    }
    if (!providerId || !buyerId) return;

    setLoading(true);
    (async () => {
      const mine = await fetchMySellerRating(providerId, buyerId);
      if (!cancelled) apply(mine);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, providerId, buyerId, isPreview]);

  const answered = [asDescribed, service, delivery].filter((n) => n > 0);
  const canSubmit = answered.length > 0 && !saving && !loading;

  const handleSubmit = async (close: () => void) => {
    if (!canSubmit) return;
    const overall =
      Math.round((answered.reduce((a, b) => a + b, 0) / answered.length) * 10) / 10;

    if (isPreview) {
      onSubmitted?.(overall);
      close();
      return;
    }

    setSaving(true);
    const ok = await submitSellerRating({
      providerId,
      buyerId,
      // Zero means "not answered" in this sheet and must never reach a column
      // that only accepts 1-5 — and a stored 0 would drag the average down as
      // if the buyer had rated it badly.
      asDescribed: asDescribed || null,
      service: service || null,
      delivery: delivery || null,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (!ok) return;
    onSubmitted?.(overall);
    close();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="80%" avoidKeyboard>
      {(close) => (
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}
        >
          <Text style={{ fontSize: 19, fontWeight: "700", color: "#111" }}>
            Rate {businessName}
          </Text>
          {/* Says what this is NOT, because the buyer has usually just rated
              the item and would otherwise read this as the same question
              twice. The separation is the whole point of the table. */}
          <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4, lineHeight: 19 }}>
            {kind === "service"
              ? "How was working with them? This is about the provider, not the service listing."
              : "How was buying from them? This is about the seller, not the item."}
          </Text>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <CircularLoader size="small" color={PRIMARY} />
            </View>
          ) : (
            <>
              <View style={{ marginTop: 18, gap: 14 }}>
                <Dimension
                  label={labels.asDescribed}
                  value={asDescribed}
                  onChange={setAsDescribed}
                />
                <Dimension label={labels.service} value={service} onChange={setService} />
                <Dimension label={labels.delivery} value={delivery} onChange={setDelivery} />
              </View>

              {/* Optional, and said so — a required comment is how a rating
                  flow gets abandoned halfway. */}
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add a note (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                style={{
                  marginTop: 18,
                  minHeight: 82,
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                  backgroundColor: "#F5F5F5",
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 15,
                  color: "#111",
                  textAlignVertical: "top",
                }}
              />

              <TouchableOpacity
                onPress={() => handleSubmit(close)}
                disabled={!canSubmit}
                activeOpacity={0.85}
                style={{
                  marginTop: 16,
                  backgroundColor: canSubmit ? PRIMARY : "#E5E7EB",
                  borderRadius: 999,
                  borderCurve: "continuous",
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                {saving ? (
                  <CircularLoader size="small" color="#fff" />
                ) : (
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontWeight: "700",
                      color: canSubmit ? "#fff" : "#9CA3AF",
                    }}
                  >
                    {editing ? "Update rating" : "Submit rating"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* The floor on spam, stated rather than discovered: one rating
                  per person per business until there are orders to attach
                  them to. */}
              <Text
                style={{
                  fontSize: 11.5,
                  color: "#9CA3AF",
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                You can leave one rating per business, and change it any time.
              </Text>
            </>
          )}
        </View>
      )}
    </BottomSheetModal>
  );
}

function Dimension({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          color: "#374151",
          fontWeight: "500",
          // iOS and Android measure this line differently enough that the
          // star rows drift out of a column without a floor on the label.
          paddingRight: 12,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <StarPicker
        value={value}
        onChange={onChange}
        size={Platform.OS === "ios" ? 27 : 26}
        gap={6}
        align="flex-start"
      />
    </View>
  );
}
