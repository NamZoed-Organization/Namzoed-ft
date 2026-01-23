-- Enable public access to service-license bucket for viewing images

-- First, ensure the bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'service-license';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for license images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload license images" ON storage.objects;

-- Allow anyone to view (SELECT) license images
CREATE POLICY "Public read access for license images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-license');

-- Allow authenticated users to upload their license images
CREATE POLICY "Authenticated users can upload license images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-license'
  AND (storage.foldername(name))[1] = 'licenses'
);

-- Allow authenticated users to update/replace their own license images
CREATE POLICY "Authenticated users can update license images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'service-license')
WITH CHECK (bucket_id = 'service-license');
