-- Segregates a seller's products between their main (personal) profile and
-- their work (service-provider) profile. Every profile already has exactly
-- one service_providers row (see 20260325120000_add_service_provider_profile_and_trigger.sql),
-- keyed 1:1 by user_id, so there's no need for a separate foreign key here —
-- a simple boolean on the product itself is enough: false (default) = shows
-- under the owner's main profile "Products" tab, true = shows under their
-- Work profile's product list instead. Existing products all default to
-- false, so nothing already listed moves anywhere.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_work_listing BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_user_work_listing
ON public.products (user_id, is_work_listing);

-- products_with_discounts is a `SELECT *` view over products — Postgres
-- freezes a view's column list at creation time, so it does NOT pick up new
-- columns on the base table automatically; it has to be re-run. This is the
-- same definition as add_feed_randomization_and_boost.sql, verbatim (only
-- re-run so its `*` now also covers is_work_listing) — deliberately not
-- "cleaned up" or reformatted, to avoid any risk of silently changing the
-- discount math while touching this.
DROP VIEW IF EXISTS products_with_discounts;

CREATE VIEW products_with_discounts AS
SELECT
  -- All original product columns
  *,

  -- Calculate if discount is expired (boolean)
  -- Returns true if current time is past the discount end time
  (
    discount_started_at IS NOT NULL
    AND discount_duration_hrs IS NOT NULL
    AND NOW() > (discount_started_at + (discount_duration_hrs * INTERVAL '1 hour'))
  ) AS is_expired,

  -- Calculate if discount is currently active (boolean)
  -- Returns true if:
  --   1. Discount is turned on (is_discount_active = true)
  --   2. Current time is after start time
  --   3. Current time is before end time (not expired)
  (
    is_discount_active = true
    AND discount_started_at IS NOT NULL
    AND discount_duration_hrs IS NOT NULL
    AND NOW() >= discount_started_at
    AND NOW() <= (discount_started_at + (discount_duration_hrs * INTERVAL '1 hour'))
  ) AS is_currently_active,

  -- Calculate the actual price to show (numeric, rounded to 2 decimal places)
  -- If discount is active and not expired: apply discount
  -- Otherwise: show original price
  CASE
    WHEN is_discount_active = true
      AND discount_started_at IS NOT NULL
      AND discount_duration_hrs IS NOT NULL
      AND NOW() >= discount_started_at
      AND NOW() <= (discount_started_at + (discount_duration_hrs * INTERVAL '1 hour'))
      AND discount_percent > 0
    THEN ROUND((price * (1 - (discount_percent / 100.0))), 2)
    ELSE price
  END AS current_price,

  -- Calculate discount end time (for showing countdown timer)
  (discount_started_at + (discount_duration_hrs * INTERVAL '1 hour')) AS discount_ends_at

FROM products;

GRANT SELECT ON products_with_discounts TO authenticated;
GRANT SELECT ON products_with_discounts TO anon;
