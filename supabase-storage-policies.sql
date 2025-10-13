-- Storage policies for post-images bucket

-- First, drop any existing policies
DROP POLICY IF EXISTS "Anyone can view post images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update post images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete post images" ON storage.objects;

-- Drop old policies that might exist
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;

-- Allow anyone to view/download images
CREATE POLICY "Anyone can view post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

-- Allow anyone to upload images (no authentication required)
CREATE POLICY "Anyone can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-images');

-- Allow anyone to update images
CREATE POLICY "Anyone can update post images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'post-images')
WITH CHECK (bucket_id = 'post-images');

-- Allow anyone to delete images
CREATE POLICY "Anyone can delete post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'post-images');
