-- Feed framing: portrait (4:5), square, landscape (16:9), or mixed (per-asset ratios)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_display jsonb DEFAULT NULL;

COMMENT ON COLUMN posts.media_display IS
  '{"mode":"portrait"|"square"|"landscape"|"mixed","ratios":[w/h,...]} optional ratios for mixed, same order as images[]';
