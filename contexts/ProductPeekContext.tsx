/**
 * One product preview, opened from wherever a tag is.
 *
 * A tag on a product *or a service* appears in three places — the strip on a
 * grid tile, the card at the top of a post, and a pin on the picture itself
 * — and all three want the same thing to happen. Mounting a sheet inside each of them would
 * put one per card in a scrolling feed; this keeps a single sheet at the root
 * and gives the three of them an id to hand it.
 *
 * `open` degrades to a plain navigation when there is no provider above the
 * caller (a component rendered in isolation, a screen outside this tree), so
 * a tag is never a dead tap.
 */

import ProductPeekSheet, {
  type PeekKind,
} from "@/components/product/ProductPeekSheet";
import { useAppRouter } from "@/utils/navigation";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ProductPeekValue {
  /** Bring up the preview for a product or service id. */
  open: (id: string, kind?: PeekKind) => void;
  close: () => void;
}

const ProductPeekContext = createContext<ProductPeekValue | null>(null);

export function ProductPeekProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenItem] = useState<{ id: string; kind: PeekKind } | null>(
    null,
  );

  const value = useMemo<ProductPeekValue>(
    () => ({
      open: (id: string, kind: PeekKind = "product") => setOpenItem({ id, kind }),
      close: () => setOpenItem(null),
    }),
    [],
  );

  return (
    <ProductPeekContext.Provider value={value}>
      {children}
      <ProductPeekSheet
        productId={open?.id ?? null}
        kind={open?.kind}
        onClose={() => setOpenItem(null)}
      />
    </ProductPeekContext.Provider>
  );
}

export function useProductPeek(): ProductPeekValue {
  const ctx = useContext(ProductPeekContext);
  const router = useAppRouter();

  const fallback = useCallback(
    (id: string, kind: PeekKind = "product") =>
      router.push(
        (kind === "service"
          ? `/(users)/servicedetail/${id}`
          : `/(users)/product/${id}`) as any,
      ),
    [router],
  );

  return ctx ?? { open: fallback, close: () => {} };
}
