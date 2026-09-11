/**
 * Everything a post can be tagged with.
 *
 * Tagging used to be limited to your own products, which made it a
 * merchandising tool for people who already had a shop. Anyone can now tag
 * any product or service in the app, because a post about somebody's shop is
 * worth more to that shop than a post by it — the seller gets an audience
 * they do not have to own, and the poster gets to point at the thing they
 * are talking about. Nothing about that requires the two to be the same
 * person.
 *
 * Products and services are two tables with different shapes (a service has
 * no price), so this normalises both into the one row the picker shows and
 * the one shape `TaggedProduct` stores.
 */

import { supabase } from "./supabase";

export type TaggableKind = "product" | "service";

export interface TaggableItem {
  id: string;
  kind: TaggableKind;
  name: string;
  image?: string;
  /** Services have none. */
  price?: number;
  currentPrice?: number;
  discountActive?: boolean;
  discountPercent?: number;
  ownerId?: string;
  /** The seller or provider, as shown on the card. */
  ownerName?: string;
  /** Category or provider line, for the picker row's second line. */
  subtitle?: string;
}

/** How many of each kind a query returns. The picker interleaves them, so
 *  this is half a screenful each rather than a page of one. */
const PER_KIND = 12;

const first = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const productRow = (row: any): TaggableItem => {
  const seller = first<any>(row.profiles);
  return {
    id: String(row.id),
    kind: "product",
    name: String(row.name ?? "Untitled"),
    image: row.images?.[0],
    price: typeof row.price === "number" ? row.price : undefined,
    currentPrice:
      typeof row.current_price === "number" ? row.current_price : undefined,
    discountActive: !!row.is_currently_active,
    discountPercent: row.discount_percent ?? undefined,
    ownerId: seller?.id ? String(seller.id) : undefined,
    ownerName: seller?.name ?? undefined,
    subtitle: seller?.name ? `Sold by ${seller.name}` : row.category ?? undefined,
  };
};

const serviceRow = (row: any): TaggableItem => {
  const provider = first<any>(row.service_providers);
  const providerProfile = first<any>(provider?.profiles);
  const name = provider?.name || providerProfile?.name;
  return {
    id: String(row.id),
    kind: "service",
    name: String(row.name ?? "Untitled"),
    image: row.images?.[0],
    ownerId: provider?.user_id ? String(provider.user_id) : undefined,
    ownerName: name ?? undefined,
    subtitle: name ? `By ${name}` : first<any>(row.service_categories)?.name,
  };
};

const PRODUCT_COLUMNS = `
  id, name, price, images, category, current_price, is_currently_active,
  discount_percent, profiles:user_id ( id, name )
`;

const SERVICE_COLUMNS = `
  id, name, images, status,
  service_categories ( name ),
  service_providers ( user_id, name, profiles ( name ) )
`;

/**
 * Products and services matching `query`, newest first when it is empty.
 *
 * An empty query is not an empty list: somebody who opens the picker to tag
 * a thing they just saw should not have to know its name to find it, so the
 * blank state is the newest of both kinds.
 */
export const searchTaggableItems = async (
  query: string,
): Promise<TaggableItem[]> => {
  const term = query.trim();
  // % and _ are wildcards in ilike, and a search for "50%" that matches
  // everything is worse than one that matches nothing.
  const escaped = term.replace(/[%_\\]/g, (c) => `\\${c}`);

  let products = supabase
    .from("products_with_discounts")
    .select(PRODUCT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(PER_KIND);
  let services = supabase
    .from("provider_services")
    .select(SERVICE_COLUMNS)
    .eq("status", true)
    .order("created_at", { ascending: false })
    .limit(PER_KIND);

  if (term) {
    products = products.ilike("name", `%${escaped}%`);
    services = services.ilike("name", `%${escaped}%`);
  }

  const [productRes, serviceRes] = await Promise.all([products, services]);
  if (productRes.error) throw productRes.error;
  if (serviceRes.error) throw serviceRes.error;

  // Interleaved rather than products-then-services: a list that always
  // opens on one kind reads as though the other is an afterthought.
  const mappedProducts = (productRes.data ?? []).map(productRow);
  const mappedServices = (serviceRes.data ?? []).map(serviceRow);
  const out: TaggableItem[] = [];
  for (let i = 0; i < Math.max(mappedProducts.length, mappedServices.length); i++) {
    if (mappedProducts[i]) out.push(mappedProducts[i]);
    if (mappedServices[i]) out.push(mappedServices[i]);
  }
  return out;
};
