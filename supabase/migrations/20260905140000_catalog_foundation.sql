-- ─── Catalog foundation ─────────────────────────────────────────────────
-- Stage 1 of the multi-vendor marketplace design (see the ecommerce product
-- requirements doc): a real category tree, metadata-driven category
-- attributes, variants/inventory/prices, and seller ratings kept separate
-- from product ratings — all hung off the work profile the app already
-- has, not a new store entity (see section 1).
--
-- STRICTLY ADDITIVE. Nothing here drops, renames or rewrites anything that
-- already exists:
--   * products keeps every column it has, including `category` as the text
--     slug the app reads today. `category_id` is added beside it and
--     backfilled; the slug stays authoritative until the app moves over.
--   * product_reviews keeps its shape; the new columns are nullable or
--     defaulted, so existing rows stay valid and existing inserts still work.
--   * the existing recalc_product_rating trigger is untouched — the Bayesian
--     column below is GENERATED from columns that trigger already maintains,
--     so there is no second source of truth and no trigger to keep in sync.
--
-- Keys are UUID rather than the reference DDL's BIGSERIAL, to match
-- products.id and profiles.id as they already are.

-- ─── 1. The store is the work profile ──────────────────────────────────
-- There is deliberately NO `stores` table. `service_providers` already is
-- the seller's business identity: one row per profile (auto-created at
-- signup, see 20260325120000), carrying the license document and the
-- `verification_status` that the license review sets.
--
-- Adding a second table would give the app two answers to "is this a
-- verified seller", and the two would drift the first time one was updated
-- without the other. So everything below keys off service_providers.id, and
-- "has a shop" means exactly one thing: verification_status = 'verified'.

-- ─── 2. Category tree ───────────────────────────────────────────────────
-- Adjacency list + materialized path, per the doc's recommendation for a
-- small, rarely-restructured tree: `parent_id` for editing, `path` for
-- "everything under this node" without a recursive CTE.

CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  UUID        REFERENCES public.categories(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  -- Unique across the whole tree, and for top-level rows deliberately equal
  -- to the slug products.category already stores, so the backfill below is a
  -- plain join and the app can migrate one screen at a time.
  slug       TEXT        UNIQUE NOT NULL,
  path       TEXT        NOT NULL,
  depth      INT         NOT NULL DEFAULT 0,
  is_leaf    BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_path   ON public.categories (path text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories (parent_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_can_read_categories" ON public.categories;
CREATE POLICY "anyone_can_read_categories"
  ON public.categories FOR SELECT USING (true);

-- ─── 3. Attribute registry ──────────────────────────────────────────────
-- Metadata-driven: an attribute is a row, not a column. Adding "switch type"
-- to keyboards is an INSERT, and no existing listing changes.

CREATE TABLE IF NOT EXISTS public.attribute_defs (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT    UNIQUE NOT NULL,
  label_en           TEXT    NOT NULL,
  label_dz           TEXT,
  data_type          TEXT    NOT NULL
                     CHECK (data_type IN ('string','number','enum','boolean',
                                          'multiselect','date','dimension')),
  unit               TEXT,
  is_variant_forming BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable      BOOLEAN NOT NULL DEFAULT FALSE,
  is_searchable      BOOLEAN NOT NULL DEFAULT FALSE,
  is_displayed       BOOLEAN NOT NULL DEFAULT TRUE,
  validation_rule    JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Controlled vocabularies, so "colour" can't be spelled six ways.
CREATE TABLE IF NOT EXISTS public.attribute_values (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_def_id UUID NOT NULL REFERENCES public.attribute_defs(id) ON DELETE CASCADE,
  value_code       TEXT NOT NULL,
  label_en         TEXT NOT NULL,
  label_dz         TEXT,
  sort_order       INT  NOT NULL DEFAULT 0,
  UNIQUE (attribute_def_id, value_code)
);

-- Which attributes a category asks for, and how insistently.
CREATE TABLE IF NOT EXISTS public.category_attributes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  attribute_def_id UUID NOT NULL REFERENCES public.attribute_defs(id) ON DELETE CASCADE,
  requirement      TEXT NOT NULL DEFAULT 'optional'
                   CHECK (requirement IN ('required','recommended','optional')),
  -- Bound on a parent and inherited by everything under it, resolved by
  -- walking the materialized path.
  is_inherited     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INT     NOT NULL DEFAULT 0,
  UNIQUE (category_id, attribute_def_id)
);

CREATE INDEX IF NOT EXISTS idx_category_attributes_cat ON public.category_attributes (category_id);

ALTER TABLE public.attribute_defs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_values    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_attribute_defs" ON public.attribute_defs;
CREATE POLICY "anyone_can_read_attribute_defs"
  ON public.attribute_defs FOR SELECT USING (true);
DROP POLICY IF EXISTS "anyone_can_read_attribute_values" ON public.attribute_values;
CREATE POLICY "anyone_can_read_attribute_values"
  ON public.attribute_values FOR SELECT USING (true);
DROP POLICY IF EXISTS "anyone_can_read_category_attributes" ON public.category_attributes;
CREATE POLICY "anyone_can_read_category_attributes"
  ON public.category_attributes FOR SELECT USING (true);

-- ─── 4. Products: new columns beside the old ones ───────────────────────
-- All nullable. Every existing row stays valid, every existing INSERT still
-- works, and the app keeps reading `category` until it's ready not to.

-- The seller's work profile. Every profile has one; only a verified one is
-- a shop (see section 1).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS provider_id  UUID REFERENCES public.service_providers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id  UUID REFERENCES public.categories(id) ON DELETE SET NULL;
-- Category-specific attributes. JSONB rather than EAV: filtering
-- "color=blue AND size=large" is one containment query against one GIN
-- index, instead of a self-join per condition.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS attributes   JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand        TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gtin         TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition    TEXT NOT NULL DEFAULT 'new'
  CONSTRAINT products_condition_check CHECK (condition IN ('new','used','refurbished'));
-- Deliberately defaulted to 'active', NOT 'draft': every product already in
-- the table is live, and defaulting to draft would hide the lot of them.
-- The draft → pending_review → active flow applies to what's created next.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active'
  CONSTRAINT products_status_check CHECK (status IN ('draft','pending_review','active','rejected','archived'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS country_of_origin TEXT;
-- The optional canonical layer the doc describes for cross-seller
-- comparison. Nothing populates it yet; it exists so adding it later isn't a
-- migration of live listings.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS canonical_product_id UUID;

CREATE INDEX IF NOT EXISTS idx_products_attributes  ON public.products USING gin (attributes jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_provider_id ON public.products (provider_id);
CREATE INDEX IF NOT EXISTS idx_products_status      ON public.products (status);

-- Bayesian shrunk rating, so a single 5-star review can't outrank 4.8 over a
-- thousand. GENERATED rather than trigger-maintained precisely so it can
-- never drift from average_rating/review_count, and so the existing
-- recalc_product_rating trigger needs no edit at all.
--
--   (C·m + avg·n) / (C + n)   with m = 4.0 (assumed site mean), C = 10
--
-- m and C are constants rather than a live global average because a
-- generated column must be immutable. Revisit both once there's enough
-- review volume to measure the real mean.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bayesian_rating NUMERIC(4,3)
  GENERATED ALWAYS AS (
    ROUND(((10 * 4.0) + (COALESCE(average_rating, 0) * COALESCE(review_count, 0)))
          / (10 + COALESCE(review_count, 0)), 3)
  ) STORED;

-- ─── 5. Variants, inventory, prices ─────────────────────────────────────
-- A product with no variants keeps working exactly as it does today: price
-- and stock stay on products, and these tables stay empty for it. They are
-- the path for listings that genuinely need SKUs, not a rewrite of the ones
-- that don't.

CREATE TABLE IF NOT EXISTS public.product_variants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku           TEXT,
  -- The variant-forming attribute values for this SKU: {"color":"red","size":"XL"}
  option_values JSONB       NOT NULL DEFAULT '{}'::jsonb,
  barcode       TEXT,
  images        TEXT[]      NOT NULL DEFAULT '{}',
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_options ON public.product_variants USING gin (option_values jsonb_path_ops);

CREATE TABLE IF NOT EXISTS public.product_inventory (
  variant_id    UUID PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity      INT NOT NULL DEFAULT 0,
  -- Held by carts/orders that haven't completed. Available = quantity - reserved.
  reserved      INT NOT NULL DEFAULT 0,
  reorder_level INT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_prices (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID          NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  currency    TEXT          NOT NULL DEFAULT 'BTN',
  base_price  NUMERIC(12,2) NOT NULL,
  sale_price  NUMERIC(12,2),
  sale_starts TIMESTAMPTZ,
  sale_ends   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_prices_variant ON public.product_prices (variant_id);

CREATE TABLE IF NOT EXISTS public.product_shipping_attrs (
  variant_id UUID PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
  weight_g   INT,
  length_mm  INT,
  width_mm   INT,
  height_mm  INT,
  fragile    BOOLEAN NOT NULL DEFAULT FALSE,
  hazmat     BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.product_variants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_shipping_attrs  ENABLE ROW LEVEL SECURITY;

-- Read is public (a shopper has to see SKUs and prices); writes are the
-- owning seller's only, established by walking back to products.user_id.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_variants','product_inventory','product_prices','product_shipping_attrs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anyone_can_read_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "anyone_can_read_%1$s" ON public.%1$I FOR SELECT USING (true)', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "seller_writes_own_variants" ON public.product_variants;
CREATE POLICY "seller_writes_own_variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p
                 WHERE p.id = product_id AND p.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p
                      WHERE p.id = product_id AND p.user_id = (SELECT auth.uid())));

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_inventory','product_prices','product_shipping_attrs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "seller_writes_own_%1$s" ON public.%1$I', t);
    EXECUTE format($f$
      CREATE POLICY "seller_writes_own_%1$s" ON public.%1$I FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.product_variants v
                     JOIN public.products p ON p.id = v.product_id
                     WHERE v.id = variant_id AND p.user_id = (SELECT auth.uid())))
      WITH CHECK (EXISTS (SELECT 1 FROM public.product_variants v
                          JOIN public.products p ON p.id = v.product_id
                          WHERE v.id = variant_id AND p.user_id = (SELECT auth.uid())))
    $f$, t);
  END LOOP;
END $$;

-- ─── 6. Reviews: product vs seller, kept apart ──────────────────────────
-- The central design point of the requirements doc: a seller shouldn't be
-- punished for a manufacturer's bad product, and a good product shouldn't be
-- dragged down by one seller's slow delivery. So product_reviews stays about
-- the item, and seller ratings are a separate table about the shop.

-- Additive columns on the existing table. Defaults chosen so every row
-- already in it stays exactly as valid as it was.
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS title             TEXT;
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS order_id          UUID;
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS helpful_count     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS status            TEXT    NOT NULL DEFAULT 'published'
  CONSTRAINT product_reviews_status_check CHECK (status IN ('published','pending','hidden','removed'));

CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews (product_id, status);

-- Helpful votes as rows, not a counter the client increments: one vote per
-- person per review, and the count is derived rather than asserted.
CREATE TABLE IF NOT EXISTS public.product_review_helpful (
  review_id  UUID        NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

ALTER TABLE public.product_review_helpful ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_review_helpful" ON public.product_review_helpful;
CREATE POLICY "anyone_can_read_review_helpful"
  ON public.product_review_helpful FOR SELECT USING (true);
DROP POLICY IF EXISTS "user_manages_own_helpful_vote" ON public.product_review_helpful;
CREATE POLICY "user_manages_own_helpful_vote"
  ON public.product_review_helpful FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.recalc_review_helpful_count()
RETURNS TRIGGER AS $$
DECLARE target UUID := COALESCE(NEW.review_id, OLD.review_id);
BEGIN
  UPDATE public.product_reviews
     SET helpful_count = (SELECT count(*) FROM public.product_review_helpful WHERE review_id = target)
   WHERE id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_review_helpful_count ON public.product_review_helpful;
CREATE TRIGGER trg_review_helpful_count
  AFTER INSERT OR DELETE ON public.product_review_helpful
  FOR EACH ROW EXECUTE FUNCTION public.recalc_review_helpful_count();

-- Seller ratings — subjective, three-dimensional, the Taobao DSR shape.
-- Separate from product_reviews on purpose (see above).
CREATE TABLE IF NOT EXISTS public.seller_ratings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID        NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  buyer_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id     UUID,
  as_described SMALLINT    CHECK (as_described BETWEEN 1 AND 5),
  service      SMALLINT    CHECK (service      BETWEEN 1 AND 5),
  delivery     SMALLINT    CHECK (delivery     BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One rating per order. NULLS NOT DISTINCT matters here: order_id is null
  -- until there is an orders table, and under the default rule every null
  -- counts as distinct, so a buyer could rate the same shop unboundedly.
  -- This makes it fall back to one per buyer per store, the anti-spam floor.
  CONSTRAINT seller_ratings_unique_per_order UNIQUE NULLS NOT DISTINCT (provider_id, buyer_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_ratings_provider ON public.seller_ratings (provider_id, created_at DESC);

ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_can_read_seller_ratings" ON public.seller_ratings;
CREATE POLICY "anyone_can_read_seller_ratings"
  ON public.seller_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "buyer_writes_own_seller_rating" ON public.seller_ratings;
CREATE POLICY "buyer_writes_own_seller_rating"
  ON public.seller_ratings FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = buyer_id)
  WITH CHECK ((SELECT auth.uid()) = buyer_id);

-- Seller metrics — objective, computed, and the thing that should actually
-- gate badges. Stars are gameable; a cancellation rate is not. Written by a
-- scheduled job, never by the client, which is why there is no write policy.
CREATE TABLE IF NOT EXISTS public.seller_metrics (
  provider_id           UUID PRIMARY KEY REFERENCES public.service_providers(id) ON DELETE CASCADE,
  on_time_dispatch_rate NUMERIC(5,2),
  cancellation_rate     NUMERIC(5,2),
  return_rate           NUMERIC(5,2),
  order_defect_rate     NUMERIC(5,2),
  avg_response_hours    NUMERIC(6,2),
  orders_in_window      INT NOT NULL DEFAULT 0,
  window_days           INT NOT NULL DEFAULT 90,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_can_read_seller_metrics" ON public.seller_metrics;
CREATE POLICY "anyone_can_read_seller_metrics"
  ON public.seller_metrics FOR SELECT USING (true);

-- Store rating summary: the three DSR dimensions averaged over a trailing
-- window, recomputed on read. Taobao uses six months; this takes a parameter
-- so the window is a decision, not a hardcode.
CREATE OR REPLACE FUNCTION public.provider_rating_summary(
  target_provider_id UUID,
  window_days INT DEFAULT 180
)
RETURNS TABLE (
  as_described NUMERIC,
  service      NUMERIC,
  delivery     NUMERIC,
  rating_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ROUND(AVG(r.as_described)::numeric, 2),
         ROUND(AVG(r.service)::numeric, 2),
         ROUND(AVG(r.delivery)::numeric, 2),
         count(*)
    FROM public.seller_ratings r
   WHERE r.provider_id = target_provider_id
     AND r.created_at >= now() - make_interval(days => GREATEST(window_days, 1));
$$;

GRANT EXECUTE ON FUNCTION public.provider_rating_summary(UUID, INT) TO anon, authenticated;

-- The star distribution a product page needs. Baymard's finding is that
-- shoppers lean on the distribution more than on individual reviews, and
-- that most sites don't show one — so it's a first-class query, not a
-- client-side reduce over a page of reviews.
CREATE OR REPLACE FUNCTION public.product_rating_distribution(target_product_id UUID)
RETURNS TABLE (rating SMALLINT, review_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.rating::smallint,
         count(r.id)
    FROM generate_series(1, 5) AS s(rating)
    LEFT JOIN public.product_reviews r
      ON r.rating = s.rating
     AND r.product_id = target_product_id
     AND r.status = 'published'
   GROUP BY s.rating
   ORDER BY s.rating DESC;
$$;

GRANT EXECUTE ON FUNCTION public.product_rating_distribution(UUID) TO anon, authenticated;

-- ─── 7. Seed the category tree ──────────────────────────────────────────
-- The same eight top-level categories and their subcategories the app
-- already hardcodes in data/categories.ts, with the top-level slugs kept
-- IDENTICAL to what products.category stores. That's what makes the backfill
-- below a plain join instead of a mapping table nobody will maintain.

INSERT INTO public.categories (parent_id, name, slug, path, depth, is_leaf, sort_order)
VALUES
  (NULL, 'Fashion & Jewelry',            'fashion-and-jewelry',            'fashion-and-jewelry',            0, FALSE, 1),
  (NULL, 'Gifts, Books, Flowers & Arts', 'gifts-books-flowers-and-arts',   'gifts-books-flowers-and-arts',   0, FALSE, 2),
  (NULL, 'Beauty',                       'beauty',                         'beauty',                         0, FALSE, 3),
  (NULL, 'Electronics',                  'electronics',                    'electronics',                    0, FALSE, 4),
  (NULL, 'Food',                         'food',                           'food',                           0, FALSE, 5),
  (NULL, 'Home & Living',                'home-and-living',                'home-and-living',                0, FALSE, 6),
  (NULL, 'Real Estate & Properties',     'real-estate-and-properties',     'real-estate-and-properties',     0, FALSE, 7),
  (NULL, 'Kids & Toys',                  'kids-and-toys',                  'kids-and-toys',                  0, FALSE, 8)
ON CONFLICT (slug) DO NOTHING;

-- Subcategories, derived from the same source. Child slug is
-- "<parent>/<child>" so it can't collide across parents ("accessories"
-- exists under both Fashion and Electronics).
DO $$
DECLARE
  parent_slug TEXT;
  child_name  TEXT;
  children    TEXT[];
  parent      public.categories%ROWTYPE;
  idx         INT;
BEGIN
  FOR parent_slug, children IN
    SELECT * FROM (VALUES
      ('fashion-and-jewelry',          ARRAY['kids','mens','womens','unisex','shoes','slippers','traditional wear','jewelry','accessories']),
      ('gifts-books-flowers-and-arts', ARRAY['flowers & bouquets','gift hampers','books & stationery','paintings & prints','handicrafts','candles & decor']),
      ('beauty',                       ARRAY['skincare','haircare','makeup','fragrance','tools','wellness']),
      ('electronics',                  ARRAY['mobiles','laptops','audio','cameras','accessories','smart devices']),
      ('food',                         ARRAY['groceries','snacks','local produce','organic','packaged food','spices','beverages']),
      ('home-and-living',              ARRAY['furniture','kitchenware','home decor','bedding','storage','lighting','cleaning supplies']),
      ('real-estate-and-properties',   ARRAY['land','houses','apartments','commercial spaces','office spaces','shops & storefronts','rental properties']),
      ('kids-and-toys',                ARRAY['toys','games','clothes','educational','baby essentials'])
    ) AS t(slug, children)
  LOOP
    SELECT * INTO parent FROM public.categories WHERE slug = parent_slug;
    CONTINUE WHEN parent.id IS NULL;

    idx := 0;
    FOREACH child_name IN ARRAY children LOOP
      idx := idx + 1;
      INSERT INTO public.categories (parent_id, name, slug, path, depth, is_leaf, sort_order)
      VALUES (
        parent.id,
        initcap(child_name),
        parent_slug || '/' || replace(replace(child_name, ' & ', '-and-'), ' ', '-'),
        parent.path || '/' || replace(replace(child_name, ' & ', '-and-'), ' ', '-'),
        1, TRUE, idx
      )
      ON CONFLICT (slug) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ─── 8. Seed a starter attribute registry ───────────────────────────────
-- Deliberately small. The doc's own advice is to keep the required set to
-- 5–8 fields, because artisans and farmers will not fill in forty — and an
-- attribute nobody fills is worse than one that doesn't exist, since it
-- teaches sellers the form is ignorable.

INSERT INTO public.attribute_defs (code, label_en, data_type, unit, is_variant_forming, is_filterable, is_searchable)
VALUES
  ('color',          'Colour',           'enum',        NULL,  TRUE,  TRUE,  FALSE),
  ('size',           'Size',             'enum',        NULL,  TRUE,  TRUE,  FALSE),
  ('material',       'Material',         'string',      NULL,  FALSE, TRUE,  TRUE),
  ('gender',         'Gender',           'enum',        NULL,  FALSE, TRUE,  FALSE),
  ('age_group',      'Age group',        'enum',        NULL,  FALSE, TRUE,  FALSE),
  ('net_weight',     'Net weight',       'dimension',   'g',   FALSE, FALSE, FALSE),
  ('net_volume',     'Net volume',       'dimension',   'ml',  FALSE, FALSE, FALSE),
  ('ingredients',    'Ingredients',      'string',      NULL,  FALSE, FALSE, TRUE),
  ('allergens',      'Allergens',        'multiselect', NULL,  FALSE, TRUE,  FALSE),
  ('expiry_date',    'Best before',      'date',        NULL,  FALSE, FALSE, FALSE),
  ('storage',        'Storage',          'string',      NULL,  FALSE, FALSE, FALSE),
  ('model',          'Model',            'string',      NULL,  FALSE, TRUE,  TRUE),
  ('connectivity',   'Connectivity',     'enum',        NULL,  FALSE, TRUE,  FALSE),
  ('storage_capacity','Storage capacity','enum',        NULL,  TRUE,  TRUE,  FALSE),
  ('dimensions',     'Dimensions',       'dimension',   'mm',  FALSE, FALSE, FALSE),
  ('skin_hair_type', 'Skin / hair type', 'enum',        NULL,  FALSE, TRUE,  FALSE),
  ('metal_purity',   'Metal purity',     'string',      NULL,  FALSE, TRUE,  FALSE),
  ('artisan_name',   'Made by',          'string',      NULL,  FALSE, FALSE, TRUE),
  ('technique',      'Technique',        'string',      NULL,  FALSE, FALSE, TRUE),
  ('dzongkhag_origin','Dzongkhag of origin','enum',     NULL,  FALSE, TRUE,  FALSE),
  ('unit_of_sale',   'Unit of sale',     'enum',        NULL,  FALSE, FALSE, FALSE),
  ('organic',        'Organic',          'boolean',     NULL,  FALSE, TRUE,  FALSE),
  ('safety_cert',    'Safety certification','string',   NULL,  FALSE, FALSE, FALSE),
  ('warranty_months','Warranty',         'number',      'months', FALSE, FALSE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- The nine FDA majors, as the doc specifies.
INSERT INTO public.attribute_values (attribute_def_id, value_code, label_en, sort_order)
SELECT d.id, v.code, v.label, v.ord
  FROM public.attribute_defs d
  CROSS JOIN (VALUES
    ('milk','Milk',1), ('eggs','Eggs',2), ('tree_nuts','Tree nuts',3),
    ('peanuts','Peanuts',4), ('shellfish','Shellfish',5), ('fish','Fish',6),
    ('soy','Soy',7), ('wheat','Wheat',8), ('sesame','Sesame',9)
  ) AS v(code, label, ord)
 WHERE d.code = 'allergens'
ON CONFLICT (attribute_def_id, value_code) DO NOTHING;

INSERT INTO public.attribute_values (attribute_def_id, value_code, label_en, sort_order)
SELECT d.id, v.code, v.label, v.ord
  FROM public.attribute_defs d
  CROSS JOIN (VALUES
    ('male','Male',1), ('female','Female',2), ('unisex','Unisex',3)
  ) AS v(code, label, ord)
 WHERE d.code = 'gender'
ON CONFLICT (attribute_def_id, value_code) DO NOTHING;

INSERT INTO public.attribute_values (attribute_def_id, value_code, label_en, sort_order)
SELECT d.id, v.code, v.label, v.ord
  FROM public.attribute_defs d
  CROSS JOIN (VALUES
    ('adult','Adult',1), ('kids','Kids',2), ('infant','Infant',3),
    ('toddler','Toddler',4), ('newborn','Newborn',5)
  ) AS v(code, label, ord)
 WHERE d.code = 'age_group'
ON CONFLICT (attribute_def_id, value_code) DO NOTHING;

-- Bind attributes to the categories that exist in this app. Bound on the
-- top-level node with is_inherited, so every child picks them up by path
-- and a new subcategory needs no new bindings.
INSERT INTO public.category_attributes (category_id, attribute_def_id, requirement, sort_order)
SELECT c.id, d.id, b.requirement, b.ord
  FROM (VALUES
    ('fashion-and-jewelry',        'color',      'required',    1),
    ('fashion-and-jewelry',        'size',       'required',    2),
    ('fashion-and-jewelry',        'material',   'recommended', 3),
    ('fashion-and-jewelry',        'gender',     'required',    4),
    ('fashion-and-jewelry',        'age_group',  'recommended', 5),
    ('fashion-and-jewelry',        'metal_purity','optional',   6),
    ('beauty',                     'net_volume', 'required',    1),
    ('beauty',                     'ingredients','required',    2),
    ('beauty',                     'skin_hair_type','required', 3),
    ('beauty',                     'expiry_date','recommended', 4),
    ('electronics',                'model',      'required',    1),
    ('electronics',                'connectivity','recommended',2),
    ('electronics',                'color',      'recommended', 3),
    ('electronics',                'storage_capacity','optional',4),
    ('electronics',                'warranty_months','optional',5),
    ('food',                       'net_weight', 'required',    1),
    ('food',                       'ingredients','required',    2),
    ('food',                       'allergens',  'required',    3),
    ('food',                       'expiry_date','required',    4),
    ('food',                       'storage',    'recommended', 5),
    ('food',                       'organic',    'optional',    6),
    ('home-and-living',            'dimensions', 'required',    1),
    ('home-and-living',            'material',   'required',    2),
    ('home-and-living',            'color',      'recommended', 3),
    ('kids-and-toys',              'age_group',  'required',    1),
    ('kids-and-toys',              'material',   'required',    2),
    ('kids-and-toys',              'safety_cert','recommended', 3),
    ('kids-and-toys',              'color',      'optional',    4),
    ('gifts-books-flowers-and-arts','material',  'recommended', 1),
    ('gifts-books-flowers-and-arts','artisan_name','recommended',2),
    ('gifts-books-flowers-and-arts','technique', 'optional',    3),
    ('gifts-books-flowers-and-arts','dzongkhag_origin','optional',4)
  ) AS b(cat_slug, attr_code, requirement, ord)
  JOIN public.categories     c ON c.slug = b.cat_slug
  JOIN public.attribute_defs d ON d.code = b.attr_code
ON CONFLICT (category_id, attribute_def_id) DO NOTHING;

-- ─── 9. Effective attributes for a category ─────────────────────────────
-- Resolves what a seller form should ask for: everything bound to this
-- category, plus everything marked inheritable on any ancestor, walked via
-- the materialized path. A child's own binding wins over an inherited one,
-- so a subcategory can promote an attribute to required without redefining
-- the rest.
CREATE OR REPLACE FUNCTION public.category_effective_attributes(target_category_id UUID)
RETURNS TABLE (
  attribute_def_id   UUID,
  code               TEXT,
  label_en           TEXT,
  label_dz           TEXT,
  data_type          TEXT,
  unit               TEXT,
  requirement        TEXT,
  is_variant_forming BOOLEAN,
  is_filterable      BOOLEAN,
  sort_order         INT,
  inherited_from     UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT id, path FROM public.categories WHERE id = target_category_id
  ),
  -- Every node from the root down to the target: the target's own row, plus
  -- any category whose path is a prefix of it.
  lineage AS (
    SELECT c.id, c.depth
      FROM public.categories c, target t
     WHERE c.id = t.id
        OR t.path LIKE c.path || '/%'
  ),
  resolved AS (
    SELECT ca.attribute_def_id,
           ca.requirement,
           ca.sort_order,
           ca.category_id,
           ROW_NUMBER() OVER (
             PARTITION BY ca.attribute_def_id
             -- Deepest binding wins, so the closest category to the leaf is
             -- the one whose requirement applies.
             ORDER BY l.depth DESC
           ) AS rank
      FROM public.category_attributes ca
      JOIN lineage l ON l.id = ca.category_id
     WHERE ca.category_id = target_category_id OR ca.is_inherited
  )
  SELECT d.id, d.code, d.label_en, d.label_dz, d.data_type, d.unit,
         r.requirement, d.is_variant_forming, d.is_filterable, r.sort_order,
         NULLIF(r.category_id, target_category_id)
    FROM resolved r
    JOIN public.attribute_defs d ON d.id = r.attribute_def_id
   WHERE r.rank = 1
   ORDER BY CASE r.requirement
              WHEN 'required'    THEN 0
              WHEN 'recommended' THEN 1
              ELSE 2
            END,
            r.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.category_effective_attributes(UUID) TO anon, authenticated;

-- ─── 10. Backfill ───────────────────────────────────────────────────────
-- The part that has to be harmless. Every statement below only fills in the
-- new columns; none of them touches a column the app already reads.

-- Link every product to its seller's work profile. Every profile already has
-- one (auto-created at signup), so this reaches all of them — verified or
-- not. Being linked is not a claim that the seller is a shop; verification
-- is, and that lives on the provider row.
UPDATE public.products pr
   SET provider_id = sp.id
  FROM public.service_providers sp
 WHERE sp.user_id = pr.user_id
   AND pr.provider_id IS NULL;

-- category_id from the slug the row already carries. Products whose
-- `category` doesn't match a seeded slug simply keep category_id NULL —
-- they are not touched, not reassigned, and not hidden.
UPDATE public.products pr
   SET category_id = c.id
  FROM public.categories c
 WHERE c.slug = pr.category
   AND pr.category_id IS NULL;

-- ─── 11. Shopping is verified-only, from here on ────────────────────────
-- The shopping catalogue is for sellers with a real shop and a business
-- license; unverified people selling their own used things belong in the
-- `marketplace` table, which is what it is for.
--
-- Enforced BEFORE INSERT and nowhere else, which is precisely what
-- grandfathers everything already listed: existing rows are never
-- re-validated, so no seller loses a listing the day this ships. Only the
-- next one they try to create is gated.
--
-- In the database rather than only in the app, because a rule that decides
-- who may sell has to hold for any client — an old app build included.
CREATE OR REPLACE FUNCTION public.enforce_verified_seller_for_products()
RETURNS TRIGGER AS $$
DECLARE
  provider public.service_providers%ROWTYPE;
BEGIN
  SELECT * INTO provider
    FROM public.service_providers
   WHERE user_id = NEW.user_id;

  IF provider.id IS NULL OR COALESCE(provider.verification_status, 'not_verified') <> 'verified' THEN
    RAISE EXCEPTION 'Only verified sellers can list products. Verify your work profile, or list this in the marketplace instead.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.provider_id := provider.id;

  -- Same as before: keep category_id in step with the slug, so a client that
  -- only knows about the slug still produces rows correct in both.
  IF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.category_id FROM public.categories WHERE slug = NEW.category;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ensure_store_for_product ON public.products;
DROP TRIGGER IF EXISTS trg_enforce_verified_seller ON public.products;
CREATE TRIGGER trg_enforce_verified_seller
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_seller_for_products();

-- A metrics row per verified seller, so the app can read one without a null
-- check. Values stay NULL until something computes them — NULL meaning "not
-- yet measured", which a product page must show as such rather than as 0%.
INSERT INTO public.seller_metrics (provider_id)
SELECT id FROM public.service_providers
 WHERE verification_status = 'verified'
ON CONFLICT (provider_id) DO NOTHING;
