-- Migration: 0116_product_images_bucket.sql
-- Purpose: Create Supabase Storage bucket for product images (product_image field on org_product_data_mst)
-- Storage path convention: {tenantId}/{productId}/image.{ext}
-- Deterministic path — re-uploading overwrites the previous file

-- Create the product-images storage bucket (public, 5 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload product images
CREATE POLICY "product_images_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated users to update (overwrite) product images
CREATE POLICY "product_images_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete product images
CREATE POLICY "product_images_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow public read (bucket is public — required for product cards to display images)
CREATE POLICY "product_images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
