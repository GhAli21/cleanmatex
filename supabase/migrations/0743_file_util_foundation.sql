-- =============================================================================
-- Migration: 0743_file_util_foundation.sql
-- Purpose:   File Util foundation: one shared, domain-agnostic store for files
--            (images, PDF, documents) attached to any tenant record.
--            1. sys_file_bucket_cd   — storage buckets as data (TENANT / HQ scope).
--            2. sys_file_category_cd — one row per use (ORDER_PHOTO, TENANT_LOGO, ...)
--                                      with its bucket and upload rules.
--            2b. sys_file_purpose_cd — slots inside a category (MAIN, FOR_ORDER,
--                                      BACKSIDE, ...) so each screen picks its files.
--            3. org_file_mst         — one row per stored file (object key, never a URL).
--            4. Storage buckets tenants-cmx-files (private) and tenants-cmx-public
--               (public read). No client storage policies: only the server
--               (signed upload URLs, service role) writes or reads objects.
-- Affected:  sys_file_bucket_cd, sys_file_category_cd, sys_file_purpose_cd, org_file_mst,
--            storage.buckets
-- Related:   0451 (delivery POD private evidence — same object key pattern)
-- Plan:      docs/features/File_Util/PLAN.md (Phase 1)
--
-- Additive only. Existing buckets (product-images, delivery-pod-evidence) and
-- their policies are not touched here; product-images is fixed in Phase 5.
-- =============================================================================

BEGIN;

-- ─── 1. Buckets ────────────────────────────────────────────────────────────

-- Storage buckets known to File Util. A row here does not create the bucket;
-- the migration that adds a row also inserts it into storage.buckets.
CREATE TABLE IF NOT EXISTS public.sys_file_bucket_cd (
  bucket_code        TEXT        NOT NULL,
  storage_bucket_id  TEXT        NOT NULL,
  owner_scope    TEXT        NOT NULL,
  is_public      BOOLEAN     NOT NULL DEFAULT false,
  name           TEXT        NOT NULL,
  name2          TEXT        NULL,
  description    TEXT        NULL,
  description2   TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT        NULL,
  created_info   TEXT        NULL,
  updated_at     TIMESTAMPTZ NULL,
  updated_by     TEXT        NULL,
  updated_info   TEXT        NULL,
  updated_count  INTEGER     NOT NULL DEFAULT 0,
  deleted_at     TIMESTAMPTZ NULL,
  deleted_by     TEXT        NULL,
  deleted_info   TEXT        NULL,
  rec_status     SMALLINT    NOT NULL DEFAULT 1,
  rec_order      INTEGER     NULL,
  rec_notes      TEXT        NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_bucket PRIMARY KEY (bucket_code),
  CONSTRAINT ck_sfb_scope CHECK (owner_scope IN ('TENANT', 'HQ')),
  CONSTRAINT uq_sfb_storage_id UNIQUE (storage_bucket_id),
  CONSTRAINT ck_sfb_code CHECK (bucket_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfb_storage_id CHECK (storage_bucket_id ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  CONSTRAINT ck_sfb_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_bucket_cd IS 'Storage buckets used by File Util. Bucket choice is data: each file category points to one bucket, so code never hard-codes a bucket id. TENANT buckets hold organization files under {tenant_org_id}/; HQ buckets hold platform files (HQ table and access rules added when HQ needs them).';
COMMENT ON COLUMN public.sys_file_bucket_cd.bucket_code IS 'Stable File Util bucket code (UPPER_SNAKE) referenced by categories and files; never changes even if the storage bucket is renamed.';
COMMENT ON COLUMN public.sys_file_bucket_cd.storage_bucket_id IS 'Real Supabase Storage bucket id (storage.buckets.id). No FK because Supabase owns the storage schema; the File Util service checks the bucket exists.';
COMMENT ON COLUMN public.sys_file_bucket_cd.owner_scope IS 'TENANT = organization files, first path folder is tenant_org_id (enforced by the File Util service and ck_ofm_key_path); HQ = platform (SaaS Backoffice) files, not tenant-scoped.';
COMMENT ON COLUMN public.sys_file_bucket_cd.is_public IS 'True = objects are readable by anyone with the public URL (logos, product images on receipts). False = read only through short-lived signed URLs. Must match storage.buckets.public.';
COMMENT ON COLUMN public.sys_file_bucket_cd.name IS 'English bucket label.';
COMMENT ON COLUMN public.sys_file_bucket_cd.name2 IS 'Arabic bucket label.';
COMMENT ON COLUMN public.sys_file_bucket_cd.description IS 'English note on what the bucket holds.';
COMMENT ON COLUMN public.sys_file_bucket_cd.description2 IS 'Arabic note on what the bucket holds.';
COMMENT ON COLUMN public.sys_file_bucket_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_bucket_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_bucket_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_bucket_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_bucket_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_bucket_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_bucket_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_bucket_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_bucket_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_bucket_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_bucket_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_bucket_cd.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.sys_file_bucket_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_bucket_cd.is_active IS 'False = the File Util service issues no new upload URLs for this bucket; existing files stay readable.';
COMMENT ON CONSTRAINT pk_sys_file_bucket ON public.sys_file_bucket_cd IS 'One row per storage bucket.';
COMMENT ON CONSTRAINT ck_sfb_scope ON public.sys_file_bucket_cd IS 'Known owner scopes only.';
COMMENT ON CONSTRAINT uq_sfb_storage_id ON public.sys_file_bucket_cd IS 'One code per storage bucket.';
COMMENT ON CONSTRAINT ck_sfb_code ON public.sys_file_bucket_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfb_storage_id ON public.sys_file_bucket_cd IS 'Valid Supabase bucket id format.';
COMMENT ON CONSTRAINT ck_sfb_rec_status ON public.sys_file_bucket_cd IS 'Standard record status values.';

-- ─── 2. Categories ─────────────────────────────────────────────────────────

-- One row per use of files. Upload rules live here so limits change by data,
-- not by deploy. The app maps each category to the owning domain's permission.
CREATE TABLE IF NOT EXISTS public.sys_file_category_cd (
  category_code         TEXT        NOT NULL,
  bucket_code           TEXT        NOT NULL,
  allowed_mime_types    TEXT[]      NOT NULL,
  max_size_bytes        BIGINT      NOT NULL,
  max_files_per_entity  INTEGER     NULL,
  image_max_dimension   INTEGER     NULL,
  name                  TEXT        NOT NULL,
  name2                 TEXT        NULL,
  description           TEXT        NULL,
  description2          TEXT        NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            TEXT        NULL,
  created_info          TEXT        NULL,
  updated_at            TIMESTAMPTZ NULL,
  updated_by            TEXT        NULL,
  updated_info          TEXT        NULL,
  updated_count         INTEGER     NOT NULL DEFAULT 0,
  deleted_at            TIMESTAMPTZ NULL,
  deleted_by            TEXT        NULL,
  deleted_info          TEXT        NULL,
  rec_status            SMALLINT    NOT NULL DEFAULT 1,
  rec_order             INTEGER     NULL,
  rec_notes             TEXT        NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_category PRIMARY KEY (category_code),
  CONSTRAINT fk_sfc_bucket FOREIGN KEY (bucket_code) REFERENCES public.sys_file_bucket_cd (bucket_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sfc_code CHECK (category_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfc_mime CHECK (
    cardinality(allowed_mime_types) > 0
    AND NOT ('image/svg+xml' = ANY (allowed_mime_types))
    AND NOT ('text/html' = ANY (allowed_mime_types))
  ),
  CONSTRAINT ck_sfc_max_size CHECK (max_size_bytes > 0),
  CONSTRAINT ck_sfc_max_files CHECK (max_files_per_entity IS NULL OR max_files_per_entity > 0),
  CONSTRAINT ck_sfc_img_dim CHECK (image_max_dimension IS NULL OR image_max_dimension BETWEEN 64 AND 8192),
  CONSTRAINT ck_sfc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_category_cd IS 'File categories: one row per use (ORDER_PHOTO, PRODUCT_IMAGE, TENANT_LOGO, ...). Holds the bucket and the upload rules checked by the File Util service before issuing an upload URL. Codes are mirrored in web-admin lib/constants/file-categories.ts.';
COMMENT ON COLUMN public.sys_file_category_cd.category_code IS 'Stable category code (UPPER_SNAKE); stored on every file row.';
COMMENT ON COLUMN public.sys_file_category_cd.bucket_code IS 'Bucket new files of this category go to. Changing it affects new uploads only; existing files keep their own bucket_code.';
COMMENT ON COLUMN public.sys_file_category_cd.allowed_mime_types IS 'MIME types accepted for upload. The service also checks magic bytes, so a renamed file is rejected. SVG and HTML are never allowed (script risk).';
COMMENT ON COLUMN public.sys_file_category_cd.max_size_bytes IS 'Largest accepted file in bytes, after browser downscaling.';
COMMENT ON COLUMN public.sys_file_category_cd.max_files_per_entity IS 'Most READY files one record may hold across all purposes of the category; NULL = no limit. Per-purpose limits are in sys_file_purpose_cd.max_files.';
COMMENT ON COLUMN public.sys_file_category_cd.image_max_dimension IS 'Longest image side in pixels the browser downscales to before upload; NULL = keep original size. Ignored for non-image files.';
COMMENT ON COLUMN public.sys_file_category_cd.name IS 'English category label.';
COMMENT ON COLUMN public.sys_file_category_cd.name2 IS 'Arabic category label.';
COMMENT ON COLUMN public.sys_file_category_cd.description IS 'English note on where the category is used.';
COMMENT ON COLUMN public.sys_file_category_cd.description2 IS 'Arabic note on where the category is used.';
COMMENT ON COLUMN public.sys_file_category_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_category_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_category_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_category_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_category_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_category_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_category_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_category_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_category_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_category_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_category_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_category_cd.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.sys_file_category_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_category_cd.is_active IS 'False = no new uploads in this category; existing files stay readable.';
COMMENT ON CONSTRAINT pk_sys_file_category ON public.sys_file_category_cd IS 'One row per category code.';
COMMENT ON CONSTRAINT fk_sfc_bucket ON public.sys_file_category_cd IS 'Category points to a known bucket; a bucket in use cannot be deleted.';
COMMENT ON CONSTRAINT ck_sfc_code ON public.sys_file_category_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfc_mime ON public.sys_file_category_cd IS 'At least one type; SVG and HTML banned because browsers can run script in them.';
COMMENT ON CONSTRAINT ck_sfc_max_size ON public.sys_file_category_cd IS 'Size limit must be positive.';
COMMENT ON CONSTRAINT ck_sfc_max_files ON public.sys_file_category_cd IS 'NULL (no limit) or a positive count.';
COMMENT ON CONSTRAINT ck_sfc_img_dim ON public.sys_file_category_cd IS 'Sane downscale target range in pixels.';
COMMENT ON CONSTRAINT ck_sfc_rec_status ON public.sys_file_category_cd IS 'Standard record status values.';

-- ─── 2b. Purposes ──────────────────────────────────────────────────────────

-- Slots inside a category: what a file is for on its record (product MAIN,
-- FOR_ORDER, BACKSIDE, GALLERY; order INTAKE, DAMAGE, ...). Every file has
-- exactly one purpose, so each screen asks for just the purposes it shows
-- (order screen: FOR_ORDER; product screen: all). Not part of the object key,
-- so changing a file's purpose never moves the stored object.
CREATE TABLE IF NOT EXISTS public.sys_file_purpose_cd (
  category_code    TEXT        NOT NULL,
  purpose_code     TEXT        NOT NULL,
  max_files        INTEGER     NULL,
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  name             TEXT        NOT NULL,
  name2            TEXT        NULL,
  description      TEXT        NULL,
  description2     TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENpublic.sys_file_purpose_cdTIMESTAMP,
  created_by       TEXT        NULL,
  created_info     TEXT        NULL,
  updated_at       TIMESTAMPTZ NULL,
  updated_by       TEXT        NULL,
  updated_info     TEXT        NULL,
  updated_count    INTEGER     NOT NULL DEFAULT 0,
  deleted_at       TIMESTAMPTZ NULL,
  deleted_by       TEXT        NULL,
  deleted_info     TEXT        NULL,
  rec_status       SMALLINT    NOT NULL DEFAULT 1,
  rec_order        INTEGER     NULL,
  rec_notes        TEXT        NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_purpose PRIMARY KEY (category_code, purpose_code),
  CONSTRAINT fk_sfp_category FOREIGN KEY (category_code) REFERENCES public.sys_file_category_cd (category_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sfp_code CHECK (purpose_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfp_max_files CHECK (max_files IS NULL OR max_files > 0),
  CONSTRAINT ck_sfp_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_purpose_cd IS 'File purposes: named slots inside a file category (PRODUCpublic.sys_file_purpose_cdIMAGE: MAIN, FOR_ORDER, BACKSIDE, GALLERY). Every file has one purpose; screens list files by category plus the purposes they need. New purposes are rows, not code. Codes mirrored in web-admin lib/constants/file-categories.ts.';
COMMENT ON COLUMN public.sys_file_purpose_cd.category_code IS 'Category this purpose belongs to; purpose codes are unique only within their category.';
COMMENT ON COLUMN public.sys_file_purpose_cd.purpose_code IS 'Stable purpose code (UPPER_SNAKE); stored on every file row.';
COMMENT ON COLUMN public.sys_file_purpose_cd.max_files IS 'Most READY files one record may hold for this purpose; NULL = only the category total applies. 1 = single slot: a new upload replaces the old file.';
COMMENT ON COLUMN public.sys_file_purpose_cd.is_default IS 'Purpose used when an upload names none; exactly one per category.';
COMMENT ON COLUMN public.sys_file_purpose_cd.name IS 'English purpose label.';
COMMENT ON COLUMN public.sys_file_purpose_cd.name2 IS 'Arabic purpose label.';
COMMENT ON COLUMN public.sys_file_purpose_cd.description IS 'English note on where files of this purpose are shown.';
COMMENT ON COLUMN public.sys_file_purpose_cd.description2 IS 'Arabic note on where files of this purpose are shown.';
COMMENT ON COLUMN public.sys_file_purpose_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_purpose_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_purpose_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_purpose_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_purpose_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_purpose_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_purpose_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_purpose_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_purpose_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_purpose_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_purpose_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_purpose_cd.rec_order IS 'Display order of the purpose within its category (tabs, sections, upload picker).';
COMMENT ON COLUMN public.sys_file_purpose_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_purpose_cd.is_active IS 'False = no new files with this purpose; existing files stay readable.';
COMMENT ON CONSTRAINT pk_sys_file_purpose ON public.sys_file_purpose_cd IS 'Purpose code is unique within its category; column order matches fk_ofm_purpose.';
COMMENT ON CONSTRAINT fk_sfp_category ON public.sys_file_purpose_cd IS 'Purpose belongs to a known category; a category with purposes cannot be deleted.';
COMMENT ON CONSTRAINT ck_sfp_code ON public.sys_file_purpose_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfp_max_files ON public.sys_file_purpose_cd IS 'NULL (category total only) or a positive count.';
COMMENT ON CONSTRAINT ck_sfp_rec_status ON public.sys_file_purpose_cd IS 'Standard record status values.';

-- At most one default purpose per category (the seed guarantees at least one).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sfp_default ON public.sys_file_purpose_cd (category_code) WHERE is_default;
COMMENT ON INDEX public.uq_sfp_default IS 'Only one default purpose per category.';

-- Reference tables: readable by signed-in users (the UI needs limits before
-- upload), writable only by service_role (migrations and HQ).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_file_bucket_cd', 'sys_file_category_cd', 'sys_file_purpose_cd'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'read_all_' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'read_all_' || t, t);
    EXECUTE format('COMMENT ON POLICY %I ON public.%I IS %L', 'read_all_' || t, t,
                   'Global reference data: any signed-in user may read; no tenant writes.');
    -- Read-only for app users; service_role keeps full access for migrations and HQ.
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t,
                   'Keeps updated_at and updated_count current.');
  END LOOP;
END $$;

-- ─── 3. Files ──────────────────────────────────────────────────────────────

-- One row per stored file. Holds the object key, never a URL: URLs are signed
-- on demand (private) or built from the key (public). Lifecycle:
-- PENDING (upload URL issued) -> READY (object verified) -> DELETED (soft delete;
-- the cleanup job removes the object and sets purged_at).
CREATE TABLE IF NOT EXISTS public.org_file_mst (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id     UUID        NOT NULL,
  category_code     TEXT        NOT NULL,
  purpose_code      TEXT        NOT NULL,
  entity_id         UUID        NOT NULL,
  bucket_code       TEXT        NOT NULL,
  object_key        TEXT        NOT NULL,
  thumb_object_key  TEXT        NULL,
  original_name     TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  size_bytes        BIGINT      NOT NULL,
  sha256_hex        TEXT        NULL,
  width             INTEGER     NULL,
  height            INTEGER     NULL,
  status            TEXT        NOT NULL DEFAULT 'PENDING',
  ready_at          TIMESTAMPTZ NULL,
  purged_at         TIMESTAMPTZ NULL,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  caption           TEXT        NULL,
  caption2          TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT        NULL,
  created_info      TEXT        NULL,
  updated_at        TIMESTAMPTZ NULL,
  updated_by        TEXT        NULL,
  updated_info      TEXT        NULL,
  updated_count     INTEGER     NOT NULL DEFAULT 0,
  deleted_at        TIMESTAMPTZ NULL,
  deleted_by        TEXT        NULL,
  deleted_info      TEXT        NULL,
  rec_status        SMALLINT    NOT NULL DEFAULT 1,
  rec_order         INTEGER     NULL,
  rec_notes         TEXT        NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_file_mst PRIMARY KEY (id),
  CONSTRAINT uq_ofm_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofm_object UNIQUE (bucket_code, object_key),
  CONSTRAINT fk_ofm_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_category FOREIGN KEY (category_code) REFERENCES public.sys_file_category_cd (category_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_purpose FOREIGN KEY (category_code, purpose_code) REFERENCES public.sys_file_purpose_cd (category_code, purpose_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_bucket FOREIGN KEY (bucket_code) REFERENCES public.sys_file_bucket_cd (bucket_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ofm_status CHECK (status IN ('PENDING', 'READY', 'DELETED')),
  CONSTRAINT ck_ofm_key_path CHECK (starts_with(object_key, tenant_org_id::TEXT || '/' || category_code || '/' || entity_id::TEXT || '/')),
  CONSTRAINT ck_ofm_thumb_path CHECK (thumb_object_key IS NULL OR starts_with(thumb_object_key, tenant_org_id::TEXT || '/' || category_code || '/' || entity_id::TEXT || '/')),
  CONSTRAINT ck_ofm_size CHECK (size_bytes > 0),
  CONSTRAINT ck_ofm_sha256 CHECK (sha256_hex IS NULL OR sha256_hex ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_ofm_dims CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0)),
  CONSTRAINT ck_ofm_ready CHECK (status = 'PENDING' OR (sha256_hex IS NOT NULL AND ready_at IS NOT NULL) OR (status = 'DELETED' AND ready_at IS NULL)),
  CONSTRAINT ck_ofm_deleted CHECK ((status = 'DELETED') = (deleted_at IS NOT NULL)),
  CONSTRAINT ck_ofm_purged CHECK (purged_at IS NULL OR status = 'DELETED'),
  CONSTRAINT ck_ofm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_file_mst IS 'Files stored by File Util for any organization record (order, product, customer, ...). One row per file; the owning record is (category_code, entity_id). Object key only, never a URL. Tenant-scoped with RLS.';
COMMENT ON COLUMN public.org_file_mst.id IS 'File id; also the file name part of the object key.';
COMMENT ON COLUMN public.org_file_mst.tenant_org_id IS 'Organization that owns the file; equals the first folder of object_key.';
COMMENT ON COLUMN public.org_file_mst.purpose_code IS 'Slot of the file within its category (MAIN, FOR_ORDER, BACKSIDE, ...); screens filter by it. Can be changed without moving the object.';
COMMENT ON COLUMN public.org_file_mst.category_code IS 'What the file is for (ORDER_PHOTO, TENANT_LOGO, ...); decides rules and the permission needed to read or change it.';
COMMENT ON COLUMN public.org_file_mst.entity_id IS 'Id of the owning record in the table the category belongs to (order id, product id, tenant id for the logo, ...). Not a FK because the target table depends on the category; the service checks it exists in this organization before upload.';
COMMENT ON COLUMN public.org_file_mst.bucket_code IS 'Bucket code (sys_file_bucket_cd) the object was written to, copied from the category at upload so later category changes never lose existing files.';
COMMENT ON COLUMN public.org_file_mst.object_key IS 'Storage object key: {tenant_org_id}/{category_code}/{entity_id}/{id}.{ext}. Made by the server; the user file name is never part of it. Never changes, so caches can be long-lived.';
COMMENT ON COLUMN public.org_file_mst.thumb_object_key IS 'Object key of the browser-made thumbnail in the same bucket and folder ({id}_thumb.webp); NULL for non-images or when no thumbnail was made.';
COMMENT ON COLUMN public.org_file_mst.original_name IS 'File name as chosen by the user, for display and download only.';
COMMENT ON COLUMN public.org_file_mst.mime_type IS 'MIME type, confirmed by magic bytes at completion.';
COMMENT ON COLUMN public.org_file_mst.size_bytes IS 'Size in bytes: declared at upload request, replaced by the real stored size at completion. Summed over READY rows for the storage quota.';
COMMENT ON COLUMN public.org_file_mst.sha256_hex IS 'SHA-256 of the stored bytes, lowercase hex; set at completion. Proves integrity and finds duplicates.';
COMMENT ON COLUMN public.org_file_mst.width IS 'Image width in pixels after downscaling; NULL for non-images.';
COMMENT ON COLUMN public.org_file_mst.height IS 'Image height in pixels after downscaling; NULL for non-images.';
COMMENT ON COLUMN public.org_file_mst.status IS 'PENDING = upload URL issued, object not verified (cleanup removes after 24 h); READY = verified and visible; DELETED = soft-deleted, object purged by the cleanup job.';
COMMENT ON COLUMN public.org_file_mst.ready_at IS 'When the object was verified and the file became READY; NULL for files deleted before completion.';
COMMENT ON COLUMN public.org_file_mst.purged_at IS 'When the cleanup job removed the storage objects of a DELETED file; NULL = objects may still exist. Row is kept for audit.';
COMMENT ON COLUMN public.org_file_mst.sort_order IS 'Display order among the files of one record; lower first.';
COMMENT ON COLUMN public.org_file_mst.caption IS 'Optional caption (English or the user''s primary language).';
COMMENT ON COLUMN public.org_file_mst.caption2 IS 'Optional caption in the second language (Arabic).';
COMMENT ON COLUMN public.org_file_mst.created_at IS 'When the upload was requested.';
COMMENT ON COLUMN public.org_file_mst.created_by IS 'User who requested the upload.';
COMMENT ON COLUMN public.org_file_mst.created_info IS 'Creation context (screen, API route, job).';
COMMENT ON COLUMN public.org_file_mst.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_file_mst.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_file_mst.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_file_mst.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_file_mst.deleted_at IS 'When the file was deleted; set exactly when status is DELETED.';
COMMENT ON COLUMN public.org_file_mst.deleted_by IS 'Who deleted the file.';
COMMENT ON COLUMN public.org_file_mst.deleted_info IS 'Delete context (screen, replaced by new upload, cleanup of abandoned upload).';
COMMENT ON COLUMN public.org_file_mst.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived. File lifecycle is in status; this follows it (0 when DELETED).';
COMMENT ON COLUMN public.org_file_mst.rec_order IS 'Optional manual sort order (sort_order is the display order).';
COMMENT ON COLUMN public.org_file_mst.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.org_file_mst.is_active IS 'Standard active flag; false when DELETED.';
COMMENT ON CONSTRAINT pk_org_file_mst ON public.org_file_mst IS 'File id.';
COMMENT ON CONSTRAINT uq_ofm_tenant_id ON public.org_file_mst IS 'Lets future child tables use a tenant-first composite FK (tenant_org_id, file_id).';
COMMENT ON CONSTRAINT uq_ofm_object ON public.org_file_mst IS 'One row per storage object.';
COMMENT ON CONSTRAINT fk_ofm_tenant ON public.org_file_mst IS 'File belongs to an existing organization; organizations with files cannot be hard-deleted.';
COMMENT ON CONSTRAINT fk_ofm_category ON public.org_file_mst IS 'File has a known category; a category in use cannot be deleted.';
COMMENT ON CONSTRAINT fk_ofm_purpose ON public.org_file_mst IS 'Purpose exists in the file''s own category; same column order as pk_sys_file_purpose.';
COMMENT ON CONSTRAINT fk_ofm_bucket ON public.org_file_mst IS 'File lives in a known bucket; a bucket in use cannot be deleted.';
COMMENT ON CONSTRAINT ck_ofm_status ON public.org_file_mst IS 'Known lifecycle states only.';
COMMENT ON CONSTRAINT ck_ofm_key_path ON public.org_file_mst IS 'Object key lives under {tenant_org_id}/{category_code}/{entity_id}/, so a row can never point into another organization''s or record''s folder.';
COMMENT ON CONSTRAINT ck_ofm_thumb_path ON public.org_file_mst IS 'Thumbnail lives in the same record folder as the file.';
COMMENT ON CONSTRAINT ck_ofm_size ON public.org_file_mst IS 'Empty files are rejected.';
COMMENT ON CONSTRAINT ck_ofm_sha256 ON public.org_file_mst IS 'SHA-256 as 64 lowercase hex characters.';
COMMENT ON CONSTRAINT ck_ofm_dims ON public.org_file_mst IS 'Image dimensions are positive when known.';
COMMENT ON CONSTRAINT ck_ofm_ready ON public.org_file_mst IS 'A file that reached READY always has its hash and ready time; only a never-completed upload may be DELETED without them.';
COMMENT ON CONSTRAINT ck_ofm_deleted ON public.org_file_mst IS 'deleted_at is set exactly for DELETED files.';
COMMENT ON CONSTRAINT ck_ofm_purged ON public.org_file_mst IS 'Only deleted files can have their objects purged.';
COMMENT ON CONSTRAINT ck_ofm_rec_status ON public.org_file_mst IS 'Standard record status values.';

-- Lists the visible files of one record in display order (gallery, attachments).
CREATE INDEX IF NOT EXISTS idx_ofm_entity
  ON public.org_file_mst (tenant_org_id, category_code, entity_id, purpose_code, sort_order)
  WHERE status = 'READY';
COMMENT ON INDEX public.idx_ofm_entity IS 'Files of one or many records, optionally filtered by purpose, in display order; READY rows only.';

-- Quota: sums READY bytes per organization without touching the heap.
CREATE INDEX IF NOT EXISTS idx_ofm_quota
  ON public.org_file_mst (tenant_org_id) INCLUDE (size_bytes)
  WHERE status = 'READY';
COMMENT ON INDEX public.idx_ofm_quota IS 'Index-only SUM(size_bytes) for the storage quota check and usage tracking.';

-- Cleanup job: abandoned uploads older than 24 hours.
CREATE INDEX IF NOT EXISTS idx_ofm_pending
  ON public.org_file_mst (created_at)
  WHERE status = 'PENDING';
COMMENT ON INDEX public.idx_ofm_pending IS 'Cleanup job scan for PENDING uploads past their age limit (cross-tenant, service role).';

-- Cleanup job: deleted files whose objects still exist.
CREATE INDEX IF NOT EXISTS idx_ofm_purge
  ON public.org_file_mst (deleted_at)
  WHERE status = 'DELETED' AND purged_at IS NULL;
COMMENT ON INDEX public.idx_ofm_purge IS 'Cleanup job scan for DELETED files not yet purged from storage (cross-tenant, service role).';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_file_mst;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_file_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_file_mst IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.org_file_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_file_mst ON public.org_file_mst;
-- Read-only tenant isolation. All writes go through the File Util service
-- (service role, explicit tenant_org_id in every query), which enforces
-- category permission, entity ownership, quota and the lifecycle rules.
CREATE POLICY tenant_isolation_org_file_mst ON public.org_file_mst
  FOR SELECT TO authenticated
  USING (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY tenant_isolation_org_file_mst ON public.org_file_mst IS 'Signed-in users may read file rows of their own organization only; no direct writes.';
-- Browser sessions never write file rows directly; service_role keeps full access.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.org_file_mst FROM authenticated, anon;
REVOKE ALL ON public.org_file_mst FROM anon;
GRANT SELECT ON public.org_file_mst TO authenticated;
GRANT ALL ON public.org_file_mst TO service_role;

-- ─── 4. Seed buckets and categories ────────────────────────────────────────

INSERT INTO public.sys_file_bucket_cd
  (bucket_code, storage_bucket_id, owner_scope, is_public, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('TENANT_FILES',  'tenants-cmx-files',  'TENANT', false, 'Organization files',        'ملفات المنشأة',
   'Private organization files; read through 5-minute signed URLs.',  'ملفات المنشأة الخاصة؛ تُقرأ عبر روابط موقّعة صالحة 5 دقائق.', 1, 'system', '0743_file_util_foundation'),
  ('TENANT_PUBLIC', 'tenants-cmx-public', 'TENANT', true,  'Organization public files', 'ملفات المنشأة العامة',
   'Public organization files shown on receipts and customer pages (logo, product images).', 'ملفات عامة تظهر في الإيصالات وصفحات العملاء (الشعار، صور المنتجات).', 2, 'system', '0743_file_util_foundation')
ON CONFLICT (bucket_code) DO NOTHING;

-- Limits: photos are downscaled in the browser to 2048 px (logos 1024 px),
-- so 10 MB is a safety ceiling, not the expected size.
INSERT INTO public.sys_file_category_cd
  (category_code, bucket_code, allowed_mime_types, max_size_bytes, max_files_per_entity, image_max_dimension,
   name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('ORDER_PHOTO', 'TENANT_FILES', ARRAY['image/jpeg', 'image/png', 'image/webp'], 10485760, 20, 2048,
   'Order photo', 'صورة الطلب', 'Photos of items taken at intake or during processing.', 'صور القطع عند الاستلام أو أثناء المعالجة.', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_ATTACHMENT', 'TENANT_FILES', ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 20971520, 20, 2048,
   'Order attachment', 'مرفق الطلب', 'Documents attached to an order (PDF or image).', 'مستندات مرفقة بالطلب (PDF أو صورة).', 20, 'system', '0743_file_util_foundation'),
  ('ORDER_ISSUE_PHOTO', 'TENANT_FILES', ARRAY['image/jpeg', 'image/png', 'image/webp'], 10485760, 10, 2048,
   'Order issue photo', 'صورة مشكلة الطلب', 'Evidence photos for a reported order issue.', 'صور توثّق مشكلة مُبلّغ عنها في الطلب.', 30, 'system', '0743_file_util_foundation'),
  ('ASM_EXCEPTION_PHOTO', 'TENANT_FILES', ARRAY['image/jpeg', 'image/png', 'image/webp'], 10485760, 10, 2048,
   'Assembly exception photo', 'صورة استثناء التجميع', 'Photos of an assembly exception.', 'صور استثناء أثناء التجميع.', 40, 'system', '0743_file_util_foundation'),
  ('QA_PHOTO', 'TENANT_FILES', ARRAY['image/jpeg', 'image/png', 'image/webp'], 10485760, 10, 2048,
   'Quality check photo', 'صورة فحص الجودة', 'Photos taken during a quality check.', 'صور مأخوذة أثناء فحص الجودة.', 50, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_AVATAR', 'TENANT_FILES', ARRAY['image/jpeg', 'image/png', 'image/webp'], 2097152, 1, 512,
   'Customer photo', 'صورة العميل', 'Profile photo of a customer.', 'الصورة الشخصية للعميل.', 60, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'TENANT_PUBLIC', ARRAY['image/jpeg', 'image/png', 'image/webp'], 5242880, 20, 1024,
   'Product image', 'صورة المنتج', 'Image of a product or service, shown on the catalog and receipts.', 'صورة المنتج أو الخدمة، تظهر في الكتالوج والإيصالات.', 70, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'TENANT_PUBLIC', ARRAY['image/jpeg', 'image/png', 'image/webp'], 2097152, 2, 1024,
   'Organization logo', 'شعار المنشأة', 'Logo printed on receipts and shown in the app header.', 'الشعار المطبوع على الإيصالات والظاهر في رأس التطبيق.', 80, 'system', '0743_file_util_foundation')
ON CONFLICT (category_code) DO NOTHING;

-- Purposes. Each category has exactly one default. Single slots (max_files = 1)
-- are replaced by a new upload. "MAIN is used when missing" fallbacks are
-- applied by the File Util service, not stored.
INSERT INTO public.sys_file_purpose_cd
  (category_code, purpose_code, max_files, is_default, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('ORDER_PHOTO', 'INTAKE', NULL, true, 'At intake', 'عند الاستلام', 'Item condition when received.', 'حالة القطعة عند الاستلام.', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_PHOTO', 'DAMAGE', NULL, false, 'Damage', 'تلف', 'Existing damage found on an item.', 'تلف موجود في القطعة.', 20, 'system', '0743_file_util_foundation'),
  ('ORDER_PHOTO', 'STAIN', NULL, false, 'Stain', 'بقعة', 'Stains to treat or that may not come out.', 'بقع للمعالجة أو قد لا تزول.', 30, 'system', '0743_file_util_foundation'),
  ('ORDER_PHOTO', 'AFTER_CLEANING', NULL, false, 'After cleaning', 'بعد التنظيف', 'Item condition when ready.', 'حالة القطعة عند الجاهزية.', 40, 'system', '0743_file_util_foundation'),
  ('ORDER_ATTACHMENT', 'GENERAL', NULL, true, 'Attachment', 'مرفق', 'Any document attached to the order.', 'أي مستند مرفق بالطلب.', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_ISSUE_PHOTO', 'GENERAL', NULL, true, 'Issue photo', 'صورة المشكلة', 'Evidence for the issue.', 'دليل على المشكلة.', 10, 'system', '0743_file_util_foundation'),
  ('ASM_EXCEPTION_PHOTO', 'GENERAL', NULL, true, 'Exception photo', 'صورة الاستثناء', 'Evidence for the exception.', 'دليل على الاستثناء.', 10, 'system', '0743_file_util_foundation'),
  ('QA_PHOTO', 'GENERAL', NULL, true, 'Quality photo', 'صورة الجودة', 'Photo taken during the check.', 'صورة أثناء الفحص.', 10, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_AVATAR', 'MAIN', 1, true, 'Profile photo', 'الصورة الشخصية', 'Customer profile photo.', 'الصورة الشخصية للعميل.', 10, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'MAIN', 1, true, 'Main image', 'الصورة الرئيسية', 'Shown in the catalog and product lists.', 'تظهر في الكتالوج وقوائم المنتجات.', 10, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'FOR_ORDER', 1, false, 'Order image', 'صورة الطلب', 'Shown on the new-order screen and receipts; MAIN is used when missing.', 'تظهر في شاشة الطلب الجديد والإيصالات؛ تُستخدم الرئيسية عند غيابها.', 20, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'BACKSIDE', 1, false, 'Back side', 'الجهة الخلفية', 'Back view of the item.', 'المنظر الخلفي للقطعة.', 30, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'GALLERY', NULL, false, 'Gallery', 'معرض الصور', 'Extra images shown on the product screen.', 'صور إضافية تظهر في شاشة المنتج.', 40, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'MAIN', 1, true, 'Logo', 'الشعار', 'Logo in the app header, documents and emails.', 'الشعار في رأس التطبيق والمستندات والبريد.', 10, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'RECEIPT', 1, false, 'Receipt logo', 'شعار الإيصال', 'Black-and-white logo for thermal receipt printers; MAIN is used when missing.', 'شعار بالأبيض والأسود لطابعات الإيصالات الحرارية؛ يُستخدم الرئيسي عند غيابه.', 20, 'system', '0743_file_util_foundation')
ON CONFLICT (category_code, purpose_code) DO NOTHING;

-- ─── 5. Storage buckets ───────────────────────────────────────────────────

-- Bucket-level ceiling and MIME list are a second gate behind the per-category
-- rules: the largest category limit and the union of category types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('tenants-cmx-files',  'tenants-cmx-files',  false, 20971520,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('tenants-cmx-public', 'tenants-cmx-public', true,  5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage.objects policies for these buckets, on purpose. Only server code
-- touches objects: uploads go through signed upload URLs issued by the File Util
-- service after its permission, category and quota checks; reads of the private
-- bucket go through 5-minute signed URLs issued after the category's read
-- permission check; deletes run as service_role (cleanup job). A browser
-- session therefore cannot list, read, overwrite or delete objects directly,
-- not even inside its own organization folder. The public bucket is readable
-- anonymously only through its public URL (unguessable keys under the
-- {tenant_org_id}/ folder).
COMMIT;
