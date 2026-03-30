-- Optional location on feed posts (display name + optional coordinates)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision;

COMMENT ON COLUMN public.posts.location_name IS 'Human-readable place shown on the post (manual or reverse-geocoded)';
COMMENT ON COLUMN public.posts.location_lat IS 'Optional latitude when location came from device';
COMMENT ON COLUMN public.posts.location_lng IS 'Optional longitude when location came from device';
