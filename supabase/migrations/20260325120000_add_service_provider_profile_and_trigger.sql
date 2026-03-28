-- Make service provider profile fields compatible with optional identification
-- and ensure every profile has a matching service_providers row.

ALTER TABLE public.service_providers
ALTER COLUMN identification DROP NOT NULL;

ALTER TABLE public.service_providers
ADD COLUMN IF NOT EXISTS profile_url text;

-- Backfill any missing provider rows for existing profiles.
INSERT INTO public.service_providers (user_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_providers sp
  WHERE sp.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create a service_provider row for each new profile.
CREATE OR REPLACE FUNCTION public.create_service_provider_for_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.service_providers (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_service_provider_for_new_user();

-- Ensure the service-license bucket is public and policies are idempotent.
UPDATE storage.buckets
SET public = true
WHERE id = 'service-license';

DROP POLICY IF EXISTS "Users can upload license images" ON storage.objects;
DROP POLICY IF EXISTS "license images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for license images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload license images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update license images" ON storage.objects;

CREATE POLICY "Users can upload license images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-license'
  AND (storage.foldername(name))[1] = 'licenses'
);

CREATE POLICY "Public read access for license images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-license');
