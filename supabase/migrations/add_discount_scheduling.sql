-- ============================================================================
-- Automatic Discount Scheduling using DATABASE VIEW (Real-time calculation)
-- ============================================================================
-- This view calculates discount status at query time, ensuring 100% accuracy
-- No background jobs or triggers needed - always shows current state

CREATE OR REPLACE VIEW products_with_discounts AS
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

-- Add helpful comment
COMMENT ON VIEW products_with_discounts IS
  'Products with real-time discount calculations. Use this view for all product queries to get accurate discount status and pricing.';

-- Optional: Create index for better performance on discount queries
-- (Only needed if you have many products with discounts)
CREATE INDEX IF NOT EXISTS idx_products_discount_fields
ON products (discount_started_at, discount_duration_hrs, is_discount_active)
WHERE discount_started_at IS NOT NULL;

-- Grant SELECT permission to authenticated users (adjust based on your RLS policies)
GRANT SELECT ON products_with_discounts TO authenticated;
GRANT SELECT ON products_with_discounts TO anon;
