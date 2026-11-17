-- Migration: 0750_file_util_retire_product_images.sql
-- Feature: File Util, Phase 5 (docs/features/File_Util/PLAN.md, task 5.3).
--
-- Why: the old `product-images` bucket (0116) has storage.objects policies that let
-- ANY signed-in user of ANY tenant upload, overwrite or delete objects in it
-- (they check bucket_id only). Product images now live in File Util
-- (category PRODUCT_IMAGE, bucket `tenants-cmx-public`, server-issued signed
-- upload URLs only), and no code writes to `product-images` any more.
--
-- Why not DROP POLICY: storage.objects is owned by supabase_storage_admin and
-- the migration role (postgres) is not a member, so DROP POLICY would fail with
-- "must be owner of table objects". Instead this migration makes the bucket
-- refuse every upload at the Storage API, and stops serving it publicly.
-- The owner then deletes the (empty) bucket and its 4 policies in the Supabase
-- dashboard (Storage → product-images → Delete bucket; Storage → Policies).
--
-- Data: pre-launch demo data only (1 product image, checked 2026-11-17). Its
-- product_image URL is cleared, so no screen shows a broken image; the product
-- gets a new image through Catalog → product → Product Image (File Util).

BEGIN;

-- 1. Lock the bucket. The Storage API checks size and type on every upload and
--    overwrite (upsert), so a 1-byte limit plus a MIME type no client sends
--    refuses all writes, whatever the old INSERT/UPDATE policies allow.
--    public = false stops anonymous reads through /object/public/product-images/.
--    Only the lock columns change; lifecycle/versioning columns (guarded by the
--    storage.protect_bucket_control_* triggers) are untouched.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 1,
    allowed_mime_types = ARRAY['application/x-cmx-retired-bucket']::text[],
    updated_at = now()
WHERE id = 'product-images';

-- 2. Clear product URLs that point into the retired bucket. Cross-tenant on
--    purpose: a one-time data fix over every organization, matched by the
--    bucket's URL path, not a tenant-facing query.
UPDATE public.org_product_data_mst
SET product_image = NULL,
    updated_at = now(),
    updated_by = 'migration',
    updated_info = '0750_file_util_retire_product_images: product-images bucket retired; re-upload through File Util'
WHERE product_image LIKE '%/storage/v1/object/public/product-images/%';

COMMIT;
