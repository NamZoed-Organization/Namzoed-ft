/**
 * "This looks like you are selling something."
 *
 * A post that says "selling my Alto, Nu 250,000, call me" is a listing
 * somebody typed into the wrong box. It scrolls past once and is gone; the
 * same thing as a product or a marketplace listing has a price, a category,
 * a place, and stays findable — and the app already has two surfaces built
 * for exactly that (§ Shopping vs marketplace). So the composer reads the
 * caption as it is written and offers to move it.
 *
 * **A suggestion, never a redirect.** Plenty of posts mention money and are
 * not listings, so a wrong guess has to cost nothing but a glance. Nothing
 * blocks, nothing is rewritten, and the card goes away when dismissed.
 *
 * **It only fires on the seller's own words.** Two things have to be true:
 * a phrase that means selling, or a price *and* a phrase that means
 * "contact me about it". A number alone is a receipt, a recipe or a
 * complaint about the cost of onions.
 */

export type MarketplaceKind =
  | "second_hand"
  | "rent"
  | "swap"
  | "free"
  | "job_vacancy";

export interface SellingIntent {
  confidence: "high" | "medium";
  /** Which marketplace kind the words point at, when they point at one. */
  marketplaceKind: MarketplaceKind;
  /** The phrase that set it off. The card shows it, so the suggestion can
   *  be argued with rather than just appearing. */
  matched: string;
}

/** Selling, plainly said. Any of these on their own is enough. */
const SALE_PHRASES = [
  "for sale", "on sale", "selling", "sell my", "want to sell", "wts",
  "up for sale", "urgent sale", "negotiable", "fixed price", "best price",
  "brand new", "slightly used", "second hand", "secondhand", "gently used",
  "in stock", "order now", "dm for price", "pm for price", "inbox for price",
  "price fixed", "reasonable price", "cash on delivery", "home delivery",
  "free delivery",
];

/** Softer commerce words — only count beside a price. */
const CONTACT_WORDS = [
  "contact", "call me", "whatsapp", "dm", "inbox", "interested",
  "available", "delivery", "order", "book now", "limited stock",
];

/** Phrases that mean a *specific* marketplace kind, and beat the generic
 *  "selling" read — someone renting a room is not selling it. */
const KIND_PHRASES: { kind: MarketplaceKind; phrases: string[] }[] = [
  {
    kind: "job_vacancy",
    phrases: ["hiring", "vacancy", "vacancies", "job opening", "now recruiting",
              "recruitment", "apply now", "we are looking for", "staff wanted",
              "salary"],
  },
  {
    kind: "rent",
    phrases: ["for rent", "on rent", "rent out", "renting", "to let",
              "for lease", "monthly rent", "tenant"],
  },
  {
    kind: "swap",
    phrases: ["swap", "exchange for", "trade for", "barter"],
  },
  {
    kind: "free",
    phrases: ["free to take", "giving away", "for free", "free of cost",
              "no charge"],
  },
];

/** Words that mean the opposite, or mean somebody else is selling. A post
 *  saying "not for sale" must not be told to go and list it. */
const NEGATIONS = [
  "not for sale", "sold out", "sold already", "no longer available",
  "looking to buy", "want to buy", "wtb", "anyone selling", "where can i buy",
  "who sells",
];

/** Nu 25,000 / nu.25000 / 25000 nu / 25k — enough shapes to catch a price
 *  without catching a year or a phone number. */
const PRICE_PATTERNS = [
  /\bnu\.?\s?\d{2,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?\b/i,
  /\b\d{2,3}(?:[,\s]?\d{3})+\s?(?:nu|ngultrum)\b/i,
  /\b\d{1,4}\s?k\b\s?(?:only|nu|ngultrum)?/i,
  /\bngultrum\b/i,
  /\bprice\s*[:\-]/i,
];

const hasPhrase = (haystack: string, phrase: string) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
};

/**
 * What the caption looks like it is trying to do, or null for the ordinary
 * case of a post that is just a post.
 */
export const detectSellingIntent = (text: string): SellingIntent | null => {
  const haystack = ` ${(text ?? "").toLowerCase()} `;
  if (haystack.trim().length < 8) return null;

  // Someone saying their thing is *not* for sale is the clearest possible
  // signal to stay out of the way.
  if (NEGATIONS.some((n) => hasPhrase(haystack, n))) return null;

  // A named kind wins: "for rent" is a rent listing, not a sale.
  for (const { kind, phrases } of KIND_PHRASES) {
    const hit = phrases.find((p) => hasPhrase(haystack, p));
    if (hit) return { confidence: "high", marketplaceKind: kind, matched: hit };
  }

  const salePhrase = SALE_PHRASES.find((p) => hasPhrase(haystack, p));
  if (salePhrase) {
    return {
      confidence: "high",
      marketplaceKind: "second_hand",
      matched: salePhrase,
    };
  }

  // A price on its own proves nothing. A price next to "contact me" does.
  const hasPrice = PRICE_PATTERNS.some((re) => re.test(haystack));
  const contactWord = CONTACT_WORDS.find((w) => hasPhrase(haystack, w));
  if (hasPrice && contactWord) {
    return {
      confidence: "medium",
      marketplaceKind: "second_hand",
      matched: contactWord,
    };
  }

  return null;
};

/** How the card names the destination it is proposing. */
export const marketplaceKindLabel = (kind: MarketplaceKind): string =>
  kind === "job_vacancy"
    ? "a job vacancy"
    : kind === "rent"
      ? "a rental listing"
      : kind === "swap"
        ? "a swap"
        : kind === "free"
          ? "a free listing"
          : "a marketplace listing";
