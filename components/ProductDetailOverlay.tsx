/**
 * ProductDetailOverlay
 *
 * Tapping a product tile in a grid morphs that card into the full
 * product-detail view (and swiping right morphs it back down into the grid)
 * instead of navigating to /product/[id] with a plain slide.
 *
 * The morph, the crossfade and the edge-swipe-back gesture all live in
 * `components/ui/GrowIntoScreenOverlay.tsx` now — shared with the service
 * overlay, which needs exactly the same behaviour. What is left here is
 * everything specific to a product: where its hero settles, the "message
 * the seller" drop target, and the content itself.
 *
 * /product/[id] is untouched and still works for deep links and shares —
 * this is only the grid-tap path.
 */

import ProductDetailContent, {
  PRODUCT_HERO_HEIGHT,
  useProductContactSellerTarget,
} from "@/components/ProductDetailContent";
import GrowIntoScreenOverlay, {
  type SourceRect,
} from "@/components/ui/GrowIntoScreenOverlay";
import { useUser } from "@/contexts/UserContext";
import { ProductWithUser } from "@/lib/productsService";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProductDetailOverlayProps {
  visible: boolean;
  onClose: () => void;
  product: ProductWithUser | null;
  /** On-screen rect of the tapped grid card, measured just before opening. */
  sourceRect?: SourceRect | null;
}

export default function ProductDetailOverlay({
  visible,
  onClose,
  product,
  sourceRect,
}: ProductDetailOverlayProps) {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const target = useProductContactSellerTarget(product, currentUser?.id);

  return (
    <GrowIntoScreenOverlay
      visible={visible}
      onClose={onClose}
      sourceRect={sourceRect}
      heroUri={product?.images?.[0]}
      // The hero grows to where ProductDetailContent's own carousel actually
      // sits (below its floating header, at its fixed 4:5 ratio) — not to
      // fullscreen — so the crossfade into the real content is a same-size
      // swap.
      mediaTop={insets.top + 56}
      mediaHeight={PRODUCT_HERO_HEIGHT}
      target={target}
    >
      {({ commitClose }) =>
        product ? (
          <ProductDetailContent
            product={product}
            onBack={() => commitClose()}
            onNavigateAway={(navigate) => commitClose(navigate)}
          />
        ) : null
      }
    </GrowIntoScreenOverlay>
  );
}
