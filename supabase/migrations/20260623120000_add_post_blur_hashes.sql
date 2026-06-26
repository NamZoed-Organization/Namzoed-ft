-- Progressive image loading (Instagram-style): store a BlurHash per post image.
-- `blur_hashes` is a JSON array aligned by index with `posts.images`, e.g.
--   images:      ["https://…/a.jpg", "https://…/b.jpg"]
--   blur_hashes: ["LEHV6nWB2yk8pyo…",  "L6Pj0^jE.AyE_3t7…"]
-- Entries may be null when a hash couldn't be generated; the client falls back
-- to a solid placeholder in that case.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS blur_hashes jsonb;

COMMENT ON COLUMN public.posts.blur_hashes IS
  'BlurHash strings aligned by index with posts.images, for progressive image loading.';
