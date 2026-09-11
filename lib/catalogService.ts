/**
 * Catalog Service
 *
 * Reads and writes for the catalog foundation added in
 * supabase/migrations/20260905140000_catalog_foundation.sql: the category
 * tree, the metadata-driven attribute registry, and product variants with
 * their inventory and prices.
 *
 * Deliberately separate from lib/productsService.ts, which continues to own
 * `products` exactly as it does today. Nothing here is required to list,
 * fetch or display a product — a listing with no variants and no attributes
 * is still a complete listing, and every existing one is precisely that. This
 * is the layer a richer product form and detail page are built on, added
 * without asking the current ones to change.
 */

import { supabase } from "@/lib/supabase";

// ─── Categories ─────────────────────────────────────────────────────────

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  /** Top-level slugs match `products.category` exactly; children are
   *  "parent/child" so "accessories" under Fashion and under Electronics
   *  don't collide. */
  slug: string;
  path: string;
  depth: number;
  isLeaf: boolean;
  sortOrder: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

function toCategory(row: any): Category {
  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    name: row.name,
    slug: row.slug,
    path: row.path,
    depth: row.depth,
    isLeaf: row.is_leaf,
    sortOrder: row.sort_order,
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("depth")
    .order("sort_order");
  if (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
  return (data ?? []).map(toCategory);
}

/** The whole tree in one round trip — it's ~60 rows, so fetching it flat and
 *  assembling here beats a query per level. */
export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const flat = await fetchCategories();
  const byId = new Map<string, CategoryNode>();
  flat.forEach((c) => byId.set(c.id, { ...c, children: [] }));

  const roots: CategoryNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return toCategory(data);
}

// ─── Attributes ─────────────────────────────────────────────────────────

export type AttributeDataType =
  | "string"
  | "number"
  | "enum"
  | "boolean"
  | "multiselect"
  | "date"
  | "dimension";

export type AttributeRequirement = "required" | "recommended" | "optional";

export interface CategoryAttribute {
  attributeDefId: string;
  code: string;
  label: string;
  labelDz: string | null;
  dataType: AttributeDataType;
  unit: string | null;
  requirement: AttributeRequirement;
  /** True when this attribute multiplies into SKUs (size, colour) rather
   *  than merely describing the product (material, brand). */
  isVariantForming: boolean;
  isFilterable: boolean;
  sortOrder: number;
  /** Set when the attribute comes from an ancestor category rather than
   *  this one — useful for showing a seller where a field came from. */
  inheritedFrom: string | null;
}

/**
 * What a seller form should ask for in this category: its own attributes
 * plus everything inheritable from its ancestors, already ordered
 * required → recommended → optional.
 *
 * Resolved in Postgres (`category_effective_attributes`) rather than here,
 * because the inheritance walk is a path query and doing it client-side
 * would mean fetching the whole binding table to answer one question.
 */
export async function fetchCategoryAttributes(
  categoryId: string,
): Promise<CategoryAttribute[]> {
  const { data, error } = await supabase.rpc("category_effective_attributes", {
    target_category_id: categoryId,
  });
  if (error) {
    console.error("Failed to fetch category attributes:", error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    attributeDefId: row.attribute_def_id,
    code: row.code,
    label: row.label_en,
    labelDz: row.label_dz ?? null,
    dataType: row.data_type,
    unit: row.unit ?? null,
    requirement: row.requirement,
    isVariantForming: row.is_variant_forming,
    isFilterable: row.is_filterable,
    sortOrder: row.sort_order,
    inheritedFrom: row.inherited_from ?? null,
  }));
}

export interface AttributeOption {
  valueCode: string;
  label: string;
  labelDz: string | null;
  sortOrder: number;
}

/** The controlled vocabulary for an enum/multiselect attribute. */
export async function fetchAttributeOptions(
  attributeDefId: string,
): Promise<AttributeOption[]> {
  const { data, error } = await supabase
    .from("attribute_values")
    .select("value_code,label_en,label_dz,sort_order")
    .eq("attribute_def_id", attributeDefId)
    .order("sort_order");
  if (error) {
    console.error("Failed to fetch attribute options:", error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    valueCode: row.value_code,
    label: row.label_en,
    labelDz: row.label_dz ?? null,
    sortOrder: row.sort_order,
  }));
}

/**
 * Which required attributes a draft is still missing. Returns attribute
 * codes, so a form can mark the fields rather than show one vague error.
 */
export function missingRequiredAttributes(
  attributes: Record<string, unknown>,
  schema: CategoryAttribute[],
): string[] {
  return schema
    .filter((a) => a.requirement === "required")
    .filter((a) => {
      const value = attributes?.[a.code];
      if (value === undefined || value === null) return true;
      if (typeof value === "string") return value.trim().length === 0;
      if (Array.isArray(value)) return value.length === 0;
      return false;
    })
    .map((a) => a.code);
}

// ─── Variants, inventory, prices ────────────────────────────────────────

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string | null;
  /** The variant-forming values for this SKU: { color: "red", size: "XL" }. */
  optionValues: Record<string, string>;
  barcode: string | null;
  images: string[];
  sortOrder: number;
  quantity: number;
  reserved: number;
  /** quantity - reserved: what a shopper can actually buy right now. */
  available: number;
  basePrice: number | null;
  salePrice: number | null;
  currency: string;
}

/**
 * A product's SKUs. An empty array is the normal case and not an error:
 * price and stock live on `products` for listings that don't need variants,
 * which is all of the existing ones.
 */
export async function fetchProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `id, product_id, sku, option_values, barcode, images, sort_order,
       product_inventory ( quantity, reserved ),
       product_prices ( currency, base_price, sale_price, sale_starts, sale_ends )`,
    )
    .eq("product_id", productId)
    .order("sort_order");

  if (error) {
    console.error("Failed to fetch product variants:", error);
    return [];
  }

  const now = Date.now();
  return (data ?? []).map((row: any) => {
    const inventory = row.product_inventory ?? {};
    // Most recent price row wins, and a sale only counts while its window is
    // open — an expired sale_price must not quietly stay the price.
    const prices: any[] = Array.isArray(row.product_prices) ? row.product_prices : [];
    const price = prices[prices.length - 1] ?? null;
    const saleLive =
      price?.sale_price != null &&
      (!price.sale_starts || Date.parse(price.sale_starts) <= now) &&
      (!price.sale_ends || Date.parse(price.sale_ends) >= now);

    const quantity = inventory.quantity ?? 0;
    const reserved = inventory.reserved ?? 0;

    return {
      id: row.id,
      productId: row.product_id,
      sku: row.sku ?? null,
      optionValues: row.option_values ?? {},
      barcode: row.barcode ?? null,
      images: row.images ?? [],
      sortOrder: row.sort_order ?? 0,
      quantity,
      reserved,
      available: Math.max(0, quantity - reserved),
      basePrice: price?.base_price ?? null,
      salePrice: saleLive ? price.sale_price : null,
      currency: price?.currency ?? "BTN",
    };
  });
}

export async function createProductVariant(input: {
  productId: string;
  optionValues: Record<string, string>;
  sku?: string | null;
  barcode?: string | null;
  images?: string[];
  quantity?: number;
  basePrice?: number;
  salePrice?: number | null;
  currency?: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: input.productId,
      sku: input.sku ?? null,
      option_values: input.optionValues,
      barcode: input.barcode ?? null,
      images: input.images ?? [],
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create variant:", error);
    return null;
  }

  // Inventory and price are separate rows rather than columns on the variant
  // because they change on different schedules and by different actors — a
  // restock isn't a price change, and neither should rewrite the SKU.
  await supabase
    .from("product_inventory")
    .upsert({ variant_id: data.id, quantity: input.quantity ?? 0 });

  if (input.basePrice != null) {
    await supabase.from("product_prices").insert({
      variant_id: data.id,
      currency: input.currency ?? "BTN",
      base_price: input.basePrice,
      sale_price: input.salePrice ?? null,
    });
  }

  return data.id;
}

export async function setVariantStock(
  variantId: string,
  quantity: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("product_inventory")
    .upsert({ variant_id: variantId, quantity, updated_at: new Date().toISOString() });
  if (error) {
    console.error("Failed to set stock:", error);
    return false;
  }
  return true;
}
