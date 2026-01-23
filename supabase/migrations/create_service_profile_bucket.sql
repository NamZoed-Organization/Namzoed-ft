-- Create service-profile storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-profile', 'service-profile', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own service profile images
CREATE POLICY "Users can upload their own service profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-profile' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Allow authenticated users to update their own service profile images
CREATE POLICY "Users can update their own service profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'service-profile')
WITH CHECK (bucket_id = 'service-profile');

-- Allow authenticated users to delete their own service profile images
CREATE POLICY "Users can delete their own service profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'service-profile');

-- Allow public read access to service profile images
CREATE POLICY "Public can view service profile images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'service-profile');
