-- ─── Catalog foundation: stores → service_providers ─────────────────────
--
-- WHY THIS FILE EXISTS
--
-- 20260905140000_catalog_foundation.sql was applied to production on
-- 2026-09-05 in an earlier form — the one built around a `stores` table —
-- and was then rewritten in place to key off `service_providers` (see its
-- section 1: "There is deliberately NO `stores` table"). The rewrite was
-- committed on 2026-09-11 and cannot run:
--
--   * `seller_ratings` and `seller_metrics` already exist, carrying
--     `store_id`. `CREATE TABLE IF NOT EXISTS` does nothing at all for
--     them — it does not reconcile columns — so the `provider_id` in the
--     new definition is never created.
--   * The next statement naming that column,
--     `CREATE INDEX ... ON public.seller_ratings (provider_id, ...)`,
--     fails with 42703 "column provider_id does not exist".
--   * The SQL editor runs the file as one transaction, so that rolls back
--     everything — including the `ALTER TABLE products ADD COLUMN
--     provider_id` that succeeded higher up. Hence products.provider_id is
--     still missing however many times the file is re-run.
--
-- This is not a skipped migration. It is one whose history was rewritten
-- after it shipped, and the two halves have to be reconciled forward.
--
-- THE THING THE APP IS WAITING ON
--
-- `lib/sellerService.ts` already writes ratings keyed on provider_id and
-- with no store_id at all:
--
--     supabase.from("seller_ratings").upsert(
--       { provider_id, buyer_id, order_id, ... },
--       { onConflict: "provider_id,buyer_id,order_id" })
--
-- Against the schema as it stands that fails twice over — no such column,
-- and `store_id` NOT NULL. Section 3 is what makes that call work, and it
-- is the reason this migration is worth running today rather than when the
-- rest of the catalogue lands.
--
-- WHAT IT DOES NOT DO
--
-- Nothing is dropped and no data is deleted. `stores` (106 rows) and
-- `products.store_id` stay exactly as they are.
--
-- It also leaves **the existing BEFORE INSERT trigger on products alone**.
-- The previous version of this file replaced `trg_ensure_store_for_product`
-- outright, which would have been a live-fire change: that trigger is what
-- keeps `products.store_id` populated (all 180 rows have one, so the column
-- is almost certainly NOT NULL), and dropping it would break product
-- creation for anybody without a store row. The provider_id trigger below
-- is added *beside* it instead, and only touches columns that one doesn't.
--
-- The verified-seller gate from section 11 of the original is NOT here: see
-- 20260911130000_enforce_verified_seller_for_products.sql, which refuses
-- new listings from 64 of the 106 people currently selling and so is a
-- decision rather than a repair.

-- ─── 1. The columns the rewrite expects ─────────────────────────────────
-- The step `CREATE TABLE IF NOT EXISTS` could not do for tables that
-- already existed.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL;

ALTER TABLE public.seller_ratings
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE;

ALTER TABLE public.seller_metrics
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE;

-- ─── 2. Backfill ────────────────────────────────────────────────────────

-- Products go straight from the seller to their work profile, as the
-- rewrite's own section 10 does — no dependency on `stores`, so this stays
-- correct after that table is eventually dropped.
UPDATE public.products pr
   SET provider_id = sp.id
  FROM public.service_providers sp
 WHERE sp.user_id = pr.user_id
   AND pr.provider_id IS NULL;

-- seller_metrics is the one place that has to go through `stores`: its rows
-- are keyed by store and there is no other route back to a person.
-- 106 stores across 106 distinct owners, so this is one-to-one.
UPDATE public.seller_metrics sm
   SET provider_id = sp.id
  FROM public.stores s
  JOIN public.service_providers sp ON sp.user_id = s.owner_id
 WHERE s.id = sm.store_id
   AND sm.provider_id IS NULL;

-- seller_ratings is empty, so there is nothing to carry over.

-- ─── 3. Let a rating be written without a store ─────────────────────────
-- The app's upsert sends no store_id. While that column is NOT NULL every
-- rating submission dies with 23502 — the same error this migration itself
-- hit on its first run. Relaxing a NOT NULL is not destructive and touches
-- no existing row.
ALTER TABLE public.seller_ratings ALTER COLUMN store_id DROP NOT NULL;

-- ─── 4. Constraints and indexes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_provider_id    ON public.products (provider_id);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_provider ON public.seller_ratings (provider_id, created_at DESC);

DO $$
BEGIN
  -- Empty table, so NOT NULL costs nothing to assert.
  IF NOT EXISTS (SELECT 1 FROM public.seller_ratings) THEN
    ALTER TABLE public.seller_ratings ALTER COLUMN provider_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'seller_ratings is no longer empty; provider_id left nullable. Backfill it, then SET NOT NULL by hand.';
  END IF;

  -- The constraint the app's onConflict names. NULLS NOT DISTINCT matters:
  -- order_id is null until there is an orders table, and under the default
  -- rule every null counts as distinct, so a buyer could rate the same shop
  -- unboundedly.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.seller_ratings'::regclass
       AND conname  = 'seller_ratings_unique_per_order'
  ) THEN
    ALTER TABLE public.seller_ratings
      ADD CONSTRAINT seller_ratings_unique_per_order
      UNIQUE NULLS NOT DISTINCT (provider_id, buyer_id, order_id);
  END IF;
END $$;

-- ─── 5. Re-key seller_metrics onto the provider ─────────────────────────
-- Its primary key is `store_id`, which is why seeding a provider-only row
-- failed with 23502: a null cannot go in a PK column. Moving the key is the
-- actual transition, and it is safe here only because the backfill above
-- reached every row and stores are one-per-owner — both re-checked below
-- rather than assumed. If either fails this is skipped with a notice and
-- the table keeps working exactly as it does now (the app only reads it).
DO $$
DECLARE
  unmapped INT;
  dupes    INT;
  pk_name  TEXT;
BEGIN
  SELECT count(*) INTO unmapped FROM public.seller_metrics WHERE provider_id IS NULL;
  SELECT count(*) INTO dupes FROM (
    SELECT provider_id FROM public.seller_metrics
     WHERE provider_id IS NOT NULL
     GROUP BY provider_id HAVING count(*) > 1
  ) d;

  IF unmapped > 0 OR dupes > 0 THEN
    RAISE NOTICE
      'seller_metrics not re-keyed: % row(s) have no provider_id, % provider(s) appear more than once. The table is unchanged and still keyed by store_id.',
      unmapped, dupes;
  ELSE
    SELECT conname INTO pk_name
      FROM pg_constraint
     WHERE conrelid = 'public.seller_metrics'::regclass AND contype = 'p';

    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.seller_metrics DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE public.seller_metrics ALTER COLUMN store_id DROP NOT NULL;
    ALTER TABLE public.seller_metrics ALTER COLUMN provider_id SET NOT NULL;
    ALTER TABLE public.seller_metrics ADD PRIMARY KEY (provider_id);
  END IF;
END $$;

-- ─── 6. The function that could never be created ────────────────────────
-- Identical to the rewrite's, and creatable only now: it reads
-- seller_ratings.provider_id, which did not exist until section 1.

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

-- ─── 7. Keep provider_id filled on new products ─────────────────────────
-- Without this the backfill is a one-off that quietly stops being true.
--
-- Added beside whatever BEFORE INSERT trigger products already has, not in
-- place of it: `store_id` and store creation remain that trigger's job, and
-- this one only fills columns it does not touch. Postgres fires per-row
-- triggers in name order, and `trg_ensure_store_for_product` sorts before
-- `trg_set_product_provider`, so the existing one still runs first.
CREATE OR REPLACE FUNCTION public.set_product_provider()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.provider_id IS NULL THEN
    SELECT id INTO NEW.provider_id
      FROM public.service_providers
     WHERE user_id = NEW.user_id;
  END IF;

  IF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.category_id FROM public.categories WHERE slug = NEW.category;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_product_provider ON public.products;
CREATE TRIGGER trg_set_product_provider
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_provider();

-- ─── 8. A metrics row per verified seller ───────────────────────────────
-- Only once section 5 actually moved the key; until then there is no unique
-- constraint for ON CONFLICT to match and store_id is still NOT NULL, which
-- is exactly what made this statement fail before.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.seller_metrics'::regclass
       AND contype  = 'p'
       AND conkey   = ARRAY[(SELECT attnum FROM pg_attribute
                              WHERE attrelid = 'public.seller_metrics'::regclass
                                AND attname  = 'provider_id')]
  ) THEN
    INSERT INTO public.seller_metrics (provider_id)
    SELECT id FROM public.service_providers
     WHERE verification_status = 'verified'
    ON CONFLICT (provider_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'seller_metrics still keyed by store_id; skipping the per-provider seed.';
  END IF;
END $$;
