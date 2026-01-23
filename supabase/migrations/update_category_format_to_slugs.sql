-- Migration: Update category names to slug format
-- This updates existing products to use URL-friendly category names

-- Update products with "kids & toys" to "kids-and-toys"
UPDATE products
SET category = 'kids-and-toys'
WHERE category = 'kids & toys';

-- Update products with "home & living" to "home-and-living"
UPDATE products
SET category = 'home-and-living'
WHERE category = 'home & living';

-- Verify the updates
SELECT
  category,
  COUNT(*) as product_count
FROM products
GROUP BY category
ORDER BY category;
