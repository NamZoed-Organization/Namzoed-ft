/**
 * Which sections a business profile shows, decided by what kind of business
 * it is.
 *
 * This is the same class-attribute model the catalog uses one level up: there
 * a category decides which *attributes* a product asks for, here it decides
 * which *sections* a business shows. In both cases the answer is data, so
 * adding "Restaurants get a Menu tab" is an edit to this table rather than a
 * release.
 *
 * It replaced deriving the tabs from what a business happened to have listed.
 * That worked for visitors — a taxi driver with no products showed no
 * Products tab — but never for the owner, who was always shown both so they
 * had somewhere to add the first item. Which is exactly wrong for a business
 * that will never have products.
 */

export type BusinessSection =
  | "products"
  | "services"
  | "menu"
  | "fares"
  | "portfolio"
  | "reviews";

export const SECTION_LABELS: Record<BusinessSection, string> = {
  products: "Products",
  services: "Services",
  menu: "Menu",
  fares: "Fares",
  portfolio: "Portfolio",
  reviews: "Reviews",
};

/**
 * Keyed by the slugs already in data/servicecategory.ts — the vocabulary the
 * app has, not a new one.
 *
 * Only types whose shape genuinely differs are listed. Everything else takes
 * the default, because an entry that merely repeats the default is a line
 * someone has to keep in step for no benefit.
 */
const SECTIONS_BY_TYPE: Partial<Record<string, BusinessSection[]>> = {
  // Sells rides, not things. A Products tab here is noise for the owner and
  // a dead end for the visitor.
  "taxi-services": ["fares", "reviews"],
  "porter-services": ["fares", "reviews"],
  "car-services": ["services", "reviews"],

  // Sells prepared food: a menu, which is a product list that behaves
  // differently enough to deserve its own name.
  "restaurants-fastfoods": ["menu", "reviews"],
  "cafe-bakery": ["menu", "reviews"],

  // Stocked goods.
  "groceries": ["products", "reviews"],

  // Work you can show: past jobs matter more than a catalogue.
  "repair-maintenance": ["services", "portfolio", "reviews"],
  "beauty-health": ["services", "portfolio", "reviews"],
  "it-creative": ["services", "portfolio", "reviews"],

  // Booked, not browsed.
  "hotels": ["services", "reviews"],
  "homestays": ["services", "reviews"],
  "travel-leisure": ["services", "reviews"],
  "real-estate": ["services", "reviews"],
  "professional-services": ["services", "reviews"],
  "consultancy-education": ["services", "reviews"],
  "government-services": ["services", "reviews"],
};

/**
 * A business with no type set gets both content sections — the honest
 * fallback, since we don't know which it needs and hiding one could hide
 * everything it has.
 */
export const DEFAULT_SECTIONS: BusinessSection[] = ["products", "services", "reviews"];

export function sectionsFor(categorySlug?: string | null): BusinessSection[] {
  return (categorySlug && SECTIONS_BY_TYPE[categorySlug]) || DEFAULT_SECTIONS;
}

/** Reviews is in every set, so a business with no ratings still says so. */
export function businessTabs(categorySlug?: string | null) {
  return sectionsFor(categorySlug).map((key) => ({ key, label: SECTION_LABELS[key] }));
}
