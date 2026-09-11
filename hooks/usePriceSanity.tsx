/**
 * Wiring a listing form to the price check (lib/priceSanity.ts).
 *
 * Two things, so a form gets both halves without repeating either: the
 * advisory under the field while typing, and one confirmation on submit when
 * the price is still out of range by the time somebody posts.
 *
 * **The confirmation never refuses.** "Post anyway" is a real answer and it
 * is the one on the right, where a thumb lands — the seller knows more about
 * their own thing than a keyword table does, and a form that argues with
 * somebody selling a scrap car for Nu 15,000 is a form they stop using. What
 * it buys is the accidental Nu 100 car, which is a typo nobody meant.
 */

import DialogCard from "@/components/ui/DialogCard";
import { checkPrice, type PriceContext } from "@/lib/priceSanity";
import React, { useCallback, useMemo, useRef, useState } from "react";

export function usePriceSanity({
  text,
  price,
  context = "sale",
  /** False for a listing where a price means nothing — free, swap. */
  enabled = true,
}: {
  text: string;
  price: number;
  context?: PriceContext;
  enabled?: boolean;
}) {
  const check = useMemo(
    () =>
      enabled
        ? checkPrice({ text, price, context })
        : { band: null, verdict: "unknown" as const, message: null },
    [enabled, text, price, context],
  );

  const [asking, setAsking] = useState(false);
  const proceedRef = useRef<(() => void) | null>(null);

  /** Wrap a submit handler: `onPress={() => guard(handleSubmit)}`. */
  const guard = useCallback(
    (proceed: () => void) => {
      if (!check.message) {
        proceed();
        return;
      }
      proceedRef.current = proceed;
      setAsking(true);
    },
    [check.message],
  );

  const dialog = (
    <DialogCard
      visible={asking}
      title="Check the price"
      message={check.message ?? ""}
      onDismiss={() => setAsking(false)}
      actions={[
        {
          label: "Change price",
          style: "cancel",
          onPress: () => setAsking(false),
        },
        {
          label: "Post anyway",
          onPress: () => {
            const proceed = proceedRef.current;
            proceedRef.current = null;
            setAsking(false);
            proceed?.();
          },
        },
      ]}
    />
  );

  return { check, guard, dialog };
}
