-- =============================================================================
-- Migration: 0765_file_util_type_size_limits.sql
-- Program:   File Util — Phase 7 (HQ File Setup), owner decision 2026-11-19:
--            the allowed file size is set by HQ per media kind and per file type.
-- Purpose:
--   1. sys_file_media_kind_cd.max_size_bytes — largest file of that kind (required).
--   2. sys_file_mime_types_cd.max_size_bytes — optional override for one file type;
--      NULL means "use the kind's limit".
--   Upload rule (web-admin file-util.service.ts): the effective limit of a file is the
--   SMALLER of its type limit (type override, else kind) and its place limit (purpose
--   override, else category). Kind/type limits are technical (a video is bigger than a
--   photo); category/purpose limits are business context (a logo stays small).
--   Seeds are at or above every current category/purpose limit (largest today: 10 MB,
--   ITEM_VIDEO 50 MB), so no upload that works today is refused after this migration.
-- Target tables: public.sys_file_media_kind_cd, public.sys_file_mime_types_cd
--   (2 columns, 2 CHECK constraints, seed values; no data removed).
-- Rollback: ALTER TABLE ... DROP COLUMN max_size_bytes on both tables (constraints drop with them).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Media kind limit ────────────────────────────────────────────────────

ALTER TABLE public.sys_file_media_kind_cd
  ADD COLUMN IF NOT EXISTS max_size_bytes BIGINT;

-- Seed every kind before the NOT NULL. Kinds never allowed (WEB, EXECUTABLE, OTHER) still get a
-- small value so the column is total; their types can never be allowed (ck_sfmt_never_allow).
UPDATE public.sys_file_media_kind_cd AS k
   SET max_size_bytes = v.bytes,
       updated_at = now(), updated_by = 'migration_0765', updated_info = '0765 file type size limits',
       updated_count = COALESCE(k.updated_count, 0) + 1
  FROM (VALUES
    ('IMAGE',        10485760),   -- 10 MB
    ('PDF',          20971520),   -- 20 MB
    ('DOCUMENT',     20971520),   -- 20 MB
    ('SPREADSHEET',  20971520),   -- 20 MB
    ('PRESENTATION', 52428800),   -- 50 MB
    ('TEXT',         10485760),   -- 10 MB
    ('ARCHIVE',      52428800),   -- 50 MB
    ('AUDIO',        20971520),   -- 20 MB
    ('VIDEO',        104857600),  -- 100 MB
    ('WEB',          1048576),    -- 1 MB (never allowed)
    ('EXECUTABLE',   1048576),    -- 1 MB (never allowed)
    ('OTHER',        1048576)     -- 1 MB
  ) AS v(code, bytes)
 WHERE k.kind_code = v.code
   AND k.max_size_bytes IS NULL;

-- A kind added after 0743 and not listed above gets the image limit rather than failing NOT NULL.
UPDATE public.sys_file_media_kind_cd
   SET max_size_bytes = 10485760, updated_at = now(), updated_by = 'migration_0765', updated_info = '0765 default size'
 WHERE max_size_bytes IS NULL;

ALTER TABLE public.sys_file_media_kind_cd
  ALTER COLUMN max_size_bytes SET NOT NULL;

-- 1 byte .. 1 GB (the HQ screen caps there too; the storage service refuses bigger uploads).
ALTER TABLE public.sys_file_media_kind_cd
  ADD CONSTRAINT ck_sfmk_max_size CHECK (max_size_bytes > 0 AND max_size_bytes <= 1073741824);

COMMENT ON COLUMN public.sys_file_media_kind_cd.max_size_bytes IS
  'Largest allowed file of this media kind, in bytes (1 B..1 GB). A file type may lower or raise it with sys_file_mime_types_cd.max_size_bytes. The effective upload limit is the smaller of the type limit and the purpose/category limit. Set by HQ File Setup.';
COMMENT ON CONSTRAINT ck_sfmk_max_size ON public.sys_file_media_kind_cd IS
  'Kind size limit is positive and at most 1 GB.';

-- ─── 2. File type override ──────────────────────────────────────────────────

ALTER TABLE public.sys_file_mime_types_cd
  ADD COLUMN IF NOT EXISTS max_size_bytes BIGINT;

ALTER TABLE public.sys_file_mime_types_cd
  ADD CONSTRAINT ck_sfmt_max_size CHECK (max_size_bytes IS NULL OR (max_size_bytes > 0 AND max_size_bytes <= 1073741824));

COMMENT ON COLUMN public.sys_file_mime_types_cd.max_size_bytes IS
  'Optional size limit of this file type, in bytes (1 B..1 GB); NULL uses the limit of its media kind (sys_file_media_kind_cd.max_size_bytes). The effective upload limit is the smaller of this and the purpose/category limit. Set by HQ File Setup.';
COMMENT ON CONSTRAINT ck_sfmt_max_size ON public.sys_file_mime_types_cd IS
  'Type size override is empty or positive and at most 1 GB.';

COMMIT;
