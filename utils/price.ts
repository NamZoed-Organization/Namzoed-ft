/**
 * Price formatting.
 *
 * `compactPrice` shortens anything of five digits or more — a full
 * "Nu. 1,250,000" doesn't fit in a 46pt thumbnail overlay, and truncating it
 * mid-number is worse than rounding it. Under five digits it stays exact,
 * because "Nu. 8,500" fits and a shopper reading "8.5K" for it would rightly
 * wonder what was being hidden.
 */

const UNITS = [
  { value: 1_000_000_000, suffix: "B" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "K" },
] as const;

/** Digits kept after the point, e.g. 1.25M — enough to distinguish
 *  1.2M from 1.3M without turning the overlay into a paragraph. */
const PRECISION = 2;

export function compactPrice(value: number, currency = "Nu."): string {
  if (!Number.isFinite(value)) return `${currency} —`;
  const abs = Math.abs(value);

  // Four digits or fewer: exact, with thousands separators.
  if (abs < 10_000) return `${currency} ${value.toLocaleString()}`;

  for (const unit of UNITS) {
    if (abs >= unit.value) {
      const scaled = value / unit.value;
      // Trailing zeros dropped: 1.50M reads as false precision, 1.5M doesn't.
      const text = parseFloat(scaled.toFixed(PRECISION)).toString();
      return `${currency} ${text}${unit.suffix}`;
    }
  }

  return `${currency} ${value.toLocaleString()}`;
}

/**
 * What a tagged item's price line says.
 *
 * A service has no price — it is quoted, not listed — so it says so rather
 * than printing "Nu. 0", which reads as free. Everything else prints the
 * live price, discount applied.
 */
export function taggedItemPrice(item: {
  price?: number;
  current_price?: number;
  kind?: "product" | "service";
}): string | null {
  const value = item.current_price ?? item.price;
  if (item.kind === "service" || typeof value !== "number") return null;
  return `Nu. ${value.toLocaleString()}`;
}
