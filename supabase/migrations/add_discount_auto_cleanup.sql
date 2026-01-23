-- ============================================================================
-- Automatic Discount Cleanup - Disable expired discounts
-- ============================================================================
-- This function automatically sets is_discount_active = false for expired discounts

-- Function to disable expired discounts
CREATE OR REPLACE FUNCTION cleanup_expired_discounts()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update all products where discount is active but has expired
  UPDATE products
  SET is_discount_active = false
  WHERE is_discount_active = true
    AND discount_started_at IS NOT NULL
    AND discount_duration_hrs IS NOT NULL
    AND NOW() > (discount_started_at + (discount_duration_hrs * INTERVAL '1 hour'));

  -- Get count of updated rows
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION cleanup_expired_discounts() IS
  'Disables expired discounts by setting is_discount_active = false. Returns count of updated products.';

-- Optional: Create a trigger that runs the cleanup before fetching products
-- This ensures expired discounts are always disabled when viewing products
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_discounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up expired discounts before any SELECT operation
  PERFORM cleanup_expired_discounts();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger on the products table that runs cleanup before SELECT
-- Note: PostgreSQL doesn't support BEFORE SELECT triggers directly,
-- so we'll use a different approach with AFTER UPDATE/INSERT instead
CREATE OR REPLACE FUNCTION auto_disable_if_expired()
RETURNS TRIGGER AS $$
BEGIN
  -- If discount is being set as active, check if it's already expired
  IF NEW.is_discount_active = true
     AND NEW.discount_started_at IS NOT NULL
     AND NEW.discount_duration_hrs IS NOT NULL
     AND NOW() > (NEW.discount_started_at + (NEW.discount_duration_hrs * INTERVAL '1 hour'))
  THEN
    -- Don't allow enabling an already-expired discount
    NEW.is_discount_active = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that prevents enabling expired discounts
DROP TRIGGER IF EXISTS prevent_expired_discount_activation ON products;
CREATE TRIGGER prevent_expired_discount_activation
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_disable_if_expired();

-- ============================================================================
-- Automatic Scheduled Cleanup using pg_cron
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run every minute
-- This will automatically disable expired discounts in the background
SELECT cron.schedule(
  'cleanup-expired-discounts',  -- job name
  '* * * * *',                   -- every minute (cron format)
  $$SELECT cleanup_expired_discounts();$$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'PostgreSQL job scheduler - used to auto-cleanup expired discounts';

-- Run initial cleanup
SELECT cleanup_expired_discounts() as cleaned_count;
