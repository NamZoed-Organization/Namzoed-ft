-- SQL Migration: Feed randomization + Post Boost — fairness/boost columns
-- Run this in your Supabase SQL Editor
--
-- See /feed-randomization-and-boost-algorithm.md for the full algorithm this
-- supports (client-side weighted sampling without replacement, computed
-- once per screen-mount — see lib/feedRanking.ts). This migration only adds
-- the four tracking columns + a batched impression-increment RPC, on all
-- four content tables the algorithm now covers: posts, products,
-- marketplace, provider_services.
--
-- impressions_shown / last_shown_at feed the fairness weight
-- (weight = 1 / (impressions_shown + 1)); boost_started_at / boost_expires_at
-- gate the separate boost-slot pool (boost_expires_at > now() = active).

-- ── posts ────────────────────────────────────────────────────────────
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS impressions_shown INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_boost_expires_at ON posts(boost_expires_at) WHERE boost_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION increment_impressions_posts(ids UUID[])
RETURNS VOID AS $$
  UPDATE posts SET impressions_shown = impressions_shown + 1, last_shown_at = now()
  WHERE id = ANY(ids);
$$ LANGUAGE sql;

-- ── products ─────────────────────────────────────────────────────────
ALTER TABLE products
ADD COLUMN IF NOT EXISTS impressions_shown INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_boost_expires_at ON products(boost_expires_at) WHERE boost_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION increment_impressions_products(ids UUID[])
RETURNS VOID AS $$
  UPDATE products SET impressions_shown = impressions_shown + 1, last_shown_at = now()
  WHERE id = ANY(ids);
$$ LANGUAGE sql;

-- products_with_discounts is a `SELECT *` view over products — Postgres
-- freezes a view's column list at creation time, so it does NOT pick up
-- new columns on the base table automatically; it has to be re-run. This is
-- the exact original definition from add_discount_scheduling.sql, verbatim
-- (only re-run so its `*` now also covers the four new columns above) —
-- deliberately not "cleaned up" or reformatted, to avoid any risk of
-- silently changing the discount math while touching this.
-- CREATE OR REPLACE VIEW can only append new output columns at the end;
-- since the ALTER TABLE above added columns to the underlying `products`
-- table, `SELECT *` now shifts every column after them, which Postgres
-- rejects as a rename. Drop and recreate instead. Nothing hard-depends on
-- this view (search_products_fuzzy in create_fuzzy_search_functions.sql
-- references it, but that function is plpgsql, so Postgres doesn't track
-- a dependency — it just needs the view to exist again by the time it runs).
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

-- ── marketplace ──────────────────────────────────────────────────────
ALTER TABLE marketplace
ADD COLUMN IF NOT EXISTS impressions_shown INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_marketplace_boost_expires_at ON marketplace(boost_expires_at) WHERE boost_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION increment_impressions_marketplace(ids UUID[])
RETURNS VOID AS $$
  UPDATE marketplace SET impressions_shown = impressions_shown + 1, last_shown_at = now()
  WHERE id = ANY(ids);
$$ LANGUAGE sql;

-- ── provider_services ────────────────────────────────────────────────
ALTER TABLE provider_services
ADD COLUMN IF NOT EXISTS impressions_shown INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_provider_services_boost_expires_at ON provider_services(boost_expires_at) WHERE boost_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION increment_impressions_provider_services(ids UUID[])
RETURNS VOID AS $$
  UPDATE provider_services SET impressions_shown = impressions_shown + 1, last_shown_at = now()
  WHERE id = ANY(ids);
$$ LANGUAGE sql;

-- Done! All four tables now carry fairness/boost tracking columns, and each
-- has a batched RPC (increment_impressions_<table>(uuid[])) the client
-- calls once per served page rather than one request per item.
