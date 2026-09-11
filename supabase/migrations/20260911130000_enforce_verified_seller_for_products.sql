-- ─── Shopping is verified-sellers-only ──────────────────────────────────
--
-- Section 11 of 20260905140000_catalog_foundation.sql, kept out of the
-- transition migration on purpose.
--
-- READ THIS BEFORE RUNNING IT. As of 2026-09-11 the numbers are:
--
--   * 106 distinct people currently have rows in `products`
--   * 42 service_providers have verification_status = 'verified'
--
-- So switching this on stops roughly 64 existing sellers from creating
-- their next listing. Their current listings are untouched — the check is
-- BEFORE INSERT and nothing re-validates existing rows — but the next time
-- they try to add one they get the error below instead.
--
-- That is the intended design (the shopping catalogue is for licensed
-- shops; unverified people selling their own used things belong in
-- `marketplace`), and it is still a decision about 64 real accounts rather
-- than a schema repair. Run it when the verification queue has caught up,
-- or when you have told those sellers.
--
-- In the database rather than only in the app, because a rule about who may
-- sell has to hold for any client, including an old app build.

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

  IF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.category_id FROM public.categories WHERE slug = NEW.category;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replaces trg_set_product_provider from the transition migration: this one
-- does everything that one did, and refuses the insert on top.
--
-- It deliberately does NOT drop `trg_ensure_store_for_product`. That trigger
-- is what keeps products.store_id populated — every one of the 180 existing
-- rows has a value, so the column is almost certainly NOT NULL — and
-- removing it here would turn "verified sellers only" into "nobody can list
-- anything". Retire it in its own change, once store_id itself is going.
DROP TRIGGER IF EXISTS trg_set_product_provider   ON public.products;
DROP TRIGGER IF EXISTS trg_enforce_verified_seller ON public.products;
CREATE TRIGGER trg_enforce_verified_seller
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_seller_for_products();
