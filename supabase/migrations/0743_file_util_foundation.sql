-- =============================================================================
-- Migration: 0743_file_util_foundation.sql
-- Purpose:   File Util foundation: one shared, domain-agnostic store for files
--            (images, PDF, documents, video) attached to any organization record.
--            Lookups (FK targets, fully seeded):
--              sys_file_owner_scope_cd, sys_file_media_kind_cd,
--              sys_file_preview_mode_cd, sys_file_status_cd,
--              sys_file_source_cd (screen/channel a file was uploaded from),
--              sys_file_ref_type_cd (order sub-record a file is about).
--            Setup:
--              sys_file_mime_types_cd  — file types: active allow list, known
--                                        inactive types, and a deny list.
--              sys_file_bucket_cd      — storage buckets as data.
--              sys_file_category_cd    — one row per owning record kind
--                                        (ORDER_FILE, CUSTOMER_FILE, ...).
--              sys_file_purpose_cd     — what a file is for within its category
--                                        (BEFORE_IMAGE, DELIVERY_PROOF, SIGNATURE ...).
--              sys_file_purpose_mime_dtl — allowed types per purpose.
--            Data:
--              org_file_mst            — one row per stored file (object key,
--                                        never a URL) with upload context.
--            Storage buckets tenants-cmx-files (private), tenants-cmx-public
--            (public read). No client storage policies: only the server
--            (signed upload URLs, service role) touches objects.
-- Affected:  the tables above, storage.buckets
-- Related:   0451 (delivery POD private evidence — same object key pattern)
-- Plan:      docs/features/File_Util/PLAN.md (Phase 1)
--
-- Additive only. Existing buckets (product-images, delivery-pod-evidence) and
-- their policies are not touched here.
-- =============================================================================

BEGIN;

-- ─── 1. Lookups ────────────────────────────────────────────────────────────

-- Who owns the files of a bucket.
CREATE TABLE IF NOT EXISTS public.sys_file_owner_scope_cd (
  scope_code             TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_owner_scope_cd PRIMARY KEY (scope_code),
  CONSTRAINT ck_sfos_code CHECK (scope_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfos_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_owner_scope_cd IS 'Owner scopes of storage buckets: TENANT (organization files, tenant folder) or HQ (platform files).';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.scope_code IS 'Scope code.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_owner_scope_cd.is_active IS 'False = value hidden from pickers; existing rows keep it.';
COMMENT ON CONSTRAINT pk_sys_file_owner_scope_cd ON public.sys_file_owner_scope_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_sfos_code ON public.sys_file_owner_scope_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfos_rec_status ON public.sys_file_owner_scope_cd IS 'Standard record status values.';

-- File families: icons, filters, image handling, safety floor.
CREATE TABLE IF NOT EXISTS public.sys_file_media_kind_cd (
  kind_code              TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_media_kind_cd PRIMARY KEY (kind_code),
  CONSTRAINT ck_sfmk_code CHECK (kind_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfmk_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_media_kind_cd IS 'Media kinds (families) of file types: IMAGE, PDF, DOCUMENT, VIDEO, ... WEB and EXECUTABLE kinds can never be uploaded (ck_sfmt_never_allow).';
COMMENT ON COLUMN public.sys_file_media_kind_cd.kind_code IS 'Kind code.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_media_kind_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_media_kind_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_media_kind_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_media_kind_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_media_kind_cd.is_active IS 'False = value hidden from pickers; existing rows keep it.';
COMMENT ON CONSTRAINT pk_sys_file_media_kind_cd ON public.sys_file_media_kind_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_sfmk_code ON public.sys_file_media_kind_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfmk_rec_status ON public.sys_file_media_kind_cd IS 'Standard record status values.';

-- How the viewer opens a file.
CREATE TABLE IF NOT EXISTS public.sys_file_preview_mode_cd (
  preview_code           TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_preview_mode_cd PRIMARY KEY (preview_code),
  CONSTRAINT ck_sfpm_code CHECK (preview_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfpm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_preview_mode_cd IS 'Preview modes: how the File Util viewer opens a file type (inline image, PDF viewer, player, or download only).';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.preview_code IS 'Preview mode code.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_preview_mode_cd.is_active IS 'False = value hidden from pickers; existing rows keep it.';
COMMENT ON CONSTRAINT pk_sys_file_preview_mode_cd ON public.sys_file_preview_mode_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_sfpm_code ON public.sys_file_preview_mode_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfpm_rec_status ON public.sys_file_preview_mode_cd IS 'Standard record status values.';

-- File lifecycle. Codes are fixed system values used by CHECKs and partial indexes on org_file_mst; labels may be edited, codes not.
CREATE TABLE IF NOT EXISTS public.sys_file_status_cd (
  status_code            TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_status_cd PRIMARY KEY (status_code),
  CONSTRAINT ck_sfst_code CHECK (status_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfst_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_status_cd IS 'File lifecycle states: PENDING, READY, DELETED. System codes referenced by org_file_mst constraints and indexes; do not add or rename.';
COMMENT ON COLUMN public.sys_file_status_cd.status_code IS 'Status code.';
COMMENT ON COLUMN public.sys_file_status_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_status_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_status_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_status_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_status_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_status_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_status_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_status_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_status_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_status_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_status_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_status_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_status_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_status_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_status_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_status_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_status_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_status_cd.is_active IS 'False = value hidden from pickers; existing rows keep it.';
COMMENT ON CONSTRAINT pk_sys_file_status_cd ON public.sys_file_status_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_sfst_code ON public.sys_file_status_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfst_rec_status ON public.sys_file_status_cd IS 'Standard record status values.';

-- Screen or channel a file was uploaded from (audit and filters).
CREATE TABLE IF NOT EXISTS public.sys_file_source_cd (
  source_code            TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_source_cd PRIMARY KEY (source_code),
  CONSTRAINT ck_sfsr_code CHECK (source_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfsr_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_source_cd IS 'Upload sources: the screen or channel a file was uploaded from (new order, delivery, mobile app, ...). Stored on every file for audit and filtering.';
COMMENT ON COLUMN public.sys_file_source_cd.source_code IS 'Source code.';
COMMENT ON COLUMN public.sys_file_source_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_source_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_source_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_source_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_source_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_source_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_source_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_source_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_source_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_source_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_source_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_source_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_source_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_source_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_source_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_source_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_source_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_source_cd.is_active IS 'False = value hidden from pickers; existing rows keep it.';
COMMENT ON CONSTRAINT pk_sys_file_source_cd ON public.sys_file_source_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_sfsr_code ON public.sys_file_source_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfsr_rec_status ON public.sys_file_source_cd IS 'Standard record status values.';

-- Kinds of sub-record a file can point at (piece, issue, delivery stop, ...).
CREATE TABLE IF NOT EXISTS public.sys_file_ref_type_cd (
  ref_type_code          TEXT        NOT NULL,
  table_name             TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_ref_type_cd PRIMARY KEY (ref_type_code),
  CONSTRAINT ck_sfrt_code CHECK (ref_type_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfrt_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_ref_type_cd IS 'Reference types: which kind of sub-record a file is about inside its owning record (order piece, order issue, delivery stop, ...). Not a FK target table per row; the service checks the referenced row exists in the same organization.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.ref_type_code IS 'Reference type code.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.table_name IS 'Table the referenced id belongs to (documentation and service lookup).';
COMMENT ON COLUMN public.sys_file_ref_type_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_ref_type_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_ref_type_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_ref_type_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_ref_type_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_ref_type_cd.is_active IS 'False = value hidden from pickers; existing rows keep it.';
COMMENT ON CONSTRAINT pk_sys_file_ref_type_cd ON public.sys_file_ref_type_cd IS 'One row per code.';
COMMENT ON CONSTRAINT ck_sfrt_code ON public.sys_file_ref_type_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfrt_rec_status ON public.sys_file_ref_type_cd IS 'Standard record status values.';

-- ─── 2. MIME types ──────────────────────────────────────────────────────────

-- Platform file types. is_allowed = security verdict (may ever be uploaded);
-- is_active = enabled now. Curated, not the IANA registry: every allowed type
-- must be verifiable by its first bytes in the File Util service.
CREATE TABLE IF NOT EXISTS public.sys_file_mime_types_cd (
  mime_type              TEXT        NOT NULL,
  kind_code              TEXT        NOT NULL,
  preview_code           TEXT        NOT NULL,
  extensions             TEXT[]      NOT NULL,
  is_allowed             BOOLEAN     NOT NULL DEFAULT false,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_mime_types PRIMARY KEY (mime_type),
  CONSTRAINT uq_sfmt_allowed UNIQUE (mime_type, is_allowed),
  CONSTRAINT fk_sfmt_kind FOREIGN KEY (kind_code) REFERENCES public.sys_file_media_kind_cd (kind_code) ON DELETE RESTRICT,
  CONSTRAINT fk_sfmt_preview FOREIGN KEY (preview_code) REFERENCES public.sys_file_preview_mode_cd (preview_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sfmt_mime CHECK (mime_type ~ '^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*$'),
  CONSTRAINT ck_sfmt_ext CHECK (cardinality(extensions) > 0 AND array_to_string(extensions, ' ') ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  CONSTRAINT ck_sfmt_active CHECK (is_allowed OR NOT is_active),
  CONSTRAINT ck_sfmt_never_allow CHECK (NOT is_allowed OR (kind_code NOT IN ('WEB', 'EXECUTABLE') AND mime_type !~ '(svg|html|javascript|ecmascript|macroenabled|octet-stream)' AND mime_type !~ '[/+]xml$')),
  CONSTRAINT ck_sfmt_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_mime_types_cd IS 'Platform file (MIME) types: kind, preview mode, extensions, whether it may ever be uploaded (is_allowed) and whether it is enabled now (is_active). Deny-list rows (is_allowed = false) can never be linked to a purpose. Managed by HQ.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.mime_type IS 'MIME type, lowercase (image/jpeg). Uploaded files are matched case-insensitively and stored lowercase.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.kind_code IS 'Media kind (sys_file_media_kind_cd).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.preview_code IS 'How the viewer opens it (sys_file_preview_mode_cd).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.extensions IS 'Extensions, lowercase without dot; the first is used in the object key. A file whose extension and content disagree is rejected.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.is_allowed IS 'Security verdict: true = may be accepted by purposes; false = deny list, never uploadable. Dangerous types can never be true (ck_sfmt_never_allow); cannot become false while a purpose uses the type (fk_sfpm_mime).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_mime_types_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_mime_types_cd.is_active IS 'False = type disabled now: no new uploads of it, hidden from HQ pickers; existing files stay readable.';
COMMENT ON CONSTRAINT pk_sys_file_mime_types ON public.sys_file_mime_types_cd IS 'One row per MIME type.';
COMMENT ON CONSTRAINT uq_sfmt_allowed ON public.sys_file_mime_types_cd IS 'Target of fk_sfpm_mime: lets the purpose link require is_allowed = true and blocks denying a type in use.';
COMMENT ON CONSTRAINT fk_sfmt_kind ON public.sys_file_mime_types_cd IS 'Known media kind.';
COMMENT ON CONSTRAINT fk_sfmt_preview ON public.sys_file_mime_types_cd IS 'Known preview mode.';
COMMENT ON CONSTRAINT ck_sfmt_mime ON public.sys_file_mime_types_cd IS 'Valid lowercase type/subtype (RFC 6838 characters).';
COMMENT ON CONSTRAINT ck_sfmt_ext ON public.sys_file_mime_types_cd IS 'At least one extension; lowercase letters and digits, no dot.';
COMMENT ON CONSTRAINT ck_sfmt_active ON public.sys_file_mime_types_cd IS 'A denied type cannot be active.';
COMMENT ON CONSTRAINT ck_sfmt_never_allow ON public.sys_file_mime_types_cd IS 'Security floor kept as a CHECK on purpose so no data edit can weaken it: markup a browser can run script from, executables, macro documents and unknown binary can never be allowed.';
COMMENT ON CONSTRAINT ck_sfmt_rec_status ON public.sys_file_mime_types_cd IS 'Standard record status values.';

-- ─── 3. Buckets ─────────────────────────────────────────────────────────────

-- Storage buckets as data. A row does not create the bucket; whoever adds a
-- row also creates it in storage (this migration, or the HQ create flow).
CREATE TABLE IF NOT EXISTS public.sys_file_bucket_cd (
  bucket_code            TEXT        NOT NULL,
  storage_bucket_id      TEXT        NOT NULL,
  scope_code             TEXT        NOT NULL,
  is_public              BOOLEAN     NOT NULL DEFAULT false,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_bucket PRIMARY KEY (bucket_code),
  CONSTRAINT uq_sfb_storage_id UNIQUE (storage_bucket_id),
  CONSTRAINT fk_sfb_scope FOREIGN KEY (scope_code) REFERENCES public.sys_file_owner_scope_cd (scope_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sfb_code CHECK (bucket_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfb_storage_id CHECK (storage_bucket_id ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  CONSTRAINT ck_sfb_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_bucket_cd IS 'Storage buckets used by File Util. Categories point to a bucket code, so code never hard-codes a bucket id. TENANT buckets hold organization files under {tenant_org_id}/; HQ buckets are added when HQ files are built.';
COMMENT ON COLUMN public.sys_file_bucket_cd.bucket_code IS 'Stable bucket code (UPPER_SNAKE) referenced by categories and files; never changes even if the storage bucket is renamed.';
COMMENT ON COLUMN public.sys_file_bucket_cd.storage_bucket_id IS 'Real Supabase Storage bucket id (storage.buckets.id). No FK because Supabase owns the storage schema; the File Util service checks it exists.';
COMMENT ON COLUMN public.sys_file_bucket_cd.scope_code IS 'Owner scope (sys_file_owner_scope_cd). TENANT = first path folder is tenant_org_id.';
COMMENT ON COLUMN public.sys_file_bucket_cd.is_public IS 'True = objects readable by anyone with the public URL; false = only through short-lived signed URLs. Must match storage.buckets.public.';
COMMENT ON COLUMN public.sys_file_bucket_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_bucket_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_bucket_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_bucket_cd.description2 IS 'Arabic description.';
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
COMMENT ON COLUMN public.sys_file_bucket_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_bucket_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_bucket_cd.is_active IS 'False = no new upload URLs for this bucket; existing files stay readable.';
COMMENT ON CONSTRAINT pk_sys_file_bucket ON public.sys_file_bucket_cd IS 'One row per bucket.';
COMMENT ON CONSTRAINT uq_sfb_storage_id ON public.sys_file_bucket_cd IS 'One code per storage bucket.';
COMMENT ON CONSTRAINT fk_sfb_scope ON public.sys_file_bucket_cd IS 'Known owner scope.';
COMMENT ON CONSTRAINT ck_sfb_code ON public.sys_file_bucket_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfb_storage_id ON public.sys_file_bucket_cd IS 'Valid Supabase bucket id format.';
COMMENT ON CONSTRAINT ck_sfb_rec_status ON public.sys_file_bucket_cd IS 'Standard record status values.';

-- ─── 4. Categories ──────────────────────────────────────────────────────────

-- One row per kind of owning record. The app maps each category to the owning
-- domain's read/write permission (ORDER_FILE -> orders permissions).
CREATE TABLE IF NOT EXISTS public.sys_file_category_cd (
  category_code          TEXT        NOT NULL,
  bucket_code            TEXT        NOT NULL,
  max_size_bytes         BIGINT      NOT NULL,
  max_files_per_entity   INTEGER     NULL,
  image_max_dimension    INTEGER     NULL,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_category PRIMARY KEY (category_code),
  CONSTRAINT fk_sfc_bucket FOREIGN KEY (bucket_code) REFERENCES public.sys_file_bucket_cd (bucket_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sfc_code CHECK (category_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfc_max_size CHECK (max_size_bytes > 0),
  CONSTRAINT ck_sfc_max_files CHECK (max_files_per_entity IS NULL OR max_files_per_entity > 0),
  CONSTRAINT ck_sfc_img_dim CHECK (image_max_dimension IS NULL OR image_max_dimension BETWEEN 64 AND 8192),
  CONSTRAINT ck_sfc_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_category_cd IS 'File categories: one row per kind of owning record (ORDER_FILE, CUSTOMER_FILE, PRODUCT_IMAGE, TENANT_LOGO). Holds the bucket and default limits; purposes refine them. Codes mirrored in web-admin lib/constants/file-categories.ts.';
COMMENT ON COLUMN public.sys_file_category_cd.category_code IS 'Stable category code (UPPER_SNAKE); stored on every file row and used as the second folder of the object key.';
COMMENT ON COLUMN public.sys_file_category_cd.bucket_code IS 'Bucket new files go to. Changing it affects new uploads only; files keep their own bucket_code.';
COMMENT ON COLUMN public.sys_file_category_cd.max_size_bytes IS 'Default largest file in bytes, after browser downscaling; a purpose may override it.';
COMMENT ON COLUMN public.sys_file_category_cd.max_files_per_entity IS 'Most READY files one record may hold across all purposes; NULL = no limit.';
COMMENT ON COLUMN public.sys_file_category_cd.image_max_dimension IS 'Longest image side in pixels the browser downscales to before upload; NULL = keep original. Ignored for non-images.';
COMMENT ON COLUMN public.sys_file_category_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_category_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_category_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_category_cd.description2 IS 'Arabic description.';
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
COMMENT ON COLUMN public.sys_file_category_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_category_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_category_cd.is_active IS 'False = no new uploads in this category; existing files stay readable.';
COMMENT ON CONSTRAINT pk_sys_file_category ON public.sys_file_category_cd IS 'One row per category.';
COMMENT ON CONSTRAINT fk_sfc_bucket ON public.sys_file_category_cd IS 'Known bucket; a bucket in use cannot be deleted.';
COMMENT ON CONSTRAINT ck_sfc_code ON public.sys_file_category_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfc_max_size ON public.sys_file_category_cd IS 'Size limit must be positive.';
COMMENT ON CONSTRAINT ck_sfc_max_files ON public.sys_file_category_cd IS 'NULL (no limit) or a positive count.';
COMMENT ON CONSTRAINT ck_sfc_img_dim ON public.sys_file_category_cd IS 'Sane downscale range in pixels.';
COMMENT ON CONSTRAINT ck_sfc_rec_status ON public.sys_file_category_cd IS 'Standard record status values.';

-- ─── 5. Purposes ────────────────────────────────────────────────────────────

-- What a file is for inside its category. The user picks it from a list when
-- uploading; screens show only the purposes they need. Not part of the object
-- key, so changing a file's purpose never moves the stored object.
CREATE TABLE IF NOT EXISTS public.sys_file_purpose_cd (
  category_code          TEXT        NOT NULL,
  purpose_code           TEXT        NOT NULL,
  max_files              INTEGER     NULL,
  max_size_bytes         BIGINT      NULL,
  is_default             BOOLEAN     NOT NULL DEFAULT false,
  name                   TEXT        NOT NULL,
  name2                  TEXT        NULL,
  description            TEXT        NULL,
  description2           TEXT        NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_purpose PRIMARY KEY (category_code, purpose_code),
  CONSTRAINT fk_sfp_category FOREIGN KEY (category_code) REFERENCES public.sys_file_category_cd (category_code) ON DELETE RESTRICT,
  CONSTRAINT ck_sfp_code CHECK (purpose_code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  CONSTRAINT ck_sfp_max_files CHECK (max_files IS NULL OR max_files > 0),
  CONSTRAINT ck_sfp_max_size CHECK (max_size_bytes IS NULL OR max_size_bytes > 0),
  CONSTRAINT ck_sfp_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_purpose_cd IS 'File purposes: what a file is for inside its category (ORDER_FILE: BEFORE_IMAGE, DELIVERY_PROOF, SIGNATURE, ...). Each purpose has its own allowed types (sys_file_purpose_mime_dtl) and optional limits. New purposes are rows, not code.';
COMMENT ON COLUMN public.sys_file_purpose_cd.category_code IS 'Category the purpose belongs to; purpose codes are unique only within a category.';
COMMENT ON COLUMN public.sys_file_purpose_cd.purpose_code IS 'Stable purpose code (UPPER_SNAKE); stored on every file row.';
COMMENT ON COLUMN public.sys_file_purpose_cd.max_files IS 'Most READY files one record may hold for this purpose; NULL = only the category total applies. 1 = single slot: a new upload replaces the old file.';
COMMENT ON COLUMN public.sys_file_purpose_cd.max_size_bytes IS 'Largest file for this purpose in bytes; NULL = category default (videos need more).';
COMMENT ON COLUMN public.sys_file_purpose_cd.is_default IS 'Preselected purpose when uploading; exactly one per category.';
COMMENT ON COLUMN public.sys_file_purpose_cd.name IS 'English label.';
COMMENT ON COLUMN public.sys_file_purpose_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN public.sys_file_purpose_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_file_purpose_cd.description2 IS 'Arabic description.';
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
COMMENT ON COLUMN public.sys_file_purpose_cd.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_purpose_cd.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_purpose_cd.is_active IS 'False = purpose no longer offered for new uploads; existing files keep it.';
COMMENT ON CONSTRAINT pk_sys_file_purpose ON public.sys_file_purpose_cd IS 'Purpose unique within its category; column order matches fk_ofm_purpose and fk_sfpm_purpose.';
COMMENT ON CONSTRAINT fk_sfp_category ON public.sys_file_purpose_cd IS 'Known category.';
COMMENT ON CONSTRAINT ck_sfp_code ON public.sys_file_purpose_cd IS 'UPPER_SNAKE code, mirrored exactly by the TypeScript constant.';
COMMENT ON CONSTRAINT ck_sfp_max_files ON public.sys_file_purpose_cd IS 'NULL or a positive count.';
COMMENT ON CONSTRAINT ck_sfp_max_size ON public.sys_file_purpose_cd IS 'NULL or a positive size.';
COMMENT ON CONSTRAINT ck_sfp_rec_status ON public.sys_file_purpose_cd IS 'Standard record status values.';

-- Only one default purpose per category (the seed provides one for each).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sfp_default ON public.sys_file_purpose_cd (category_code) WHERE is_default;
COMMENT ON INDEX public.uq_sfp_default IS 'Only one default purpose per category (the seed provides one for each).';

-- ─── 6. Allowed types per purpose ───────────────────────────────────────────

-- The FK includes is_allowed (always true here): a denied type cannot be
-- linked, and a used type cannot be switched to denied.
CREATE TABLE IF NOT EXISTS public.sys_file_purpose_mime_dtl (
  category_code          TEXT        NOT NULL,
  purpose_code           TEXT        NOT NULL,
  mime_type              TEXT        NOT NULL,
  is_allowed             BOOLEAN     NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_file_purpose_mime PRIMARY KEY (category_code, purpose_code, mime_type),
  CONSTRAINT fk_sfpm_purpose FOREIGN KEY (category_code, purpose_code) REFERENCES public.sys_file_purpose_cd (category_code, purpose_code) ON DELETE RESTRICT,
  CONSTRAINT fk_sfpm_mime FOREIGN KEY (mime_type, is_allowed) REFERENCES public.sys_file_mime_types_cd (mime_type, is_allowed) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_sfpm_allowed CHECK (is_allowed),
  CONSTRAINT ck_sfpm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.sys_file_purpose_mime_dtl IS 'MIME types each purpose accepts (signature: images only; customer document: PDF, Office, text, images). A purpose with no active row accepts nothing. The service also requires the type to be active and checks the files first bytes.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.category_code IS 'Category of the purpose.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.purpose_code IS 'Purpose that accepts the type.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.mime_type IS 'Accepted MIME type (sys_file_mime_types_cd).';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.is_allowed IS 'Always true; part of fk_sfpm_mime so only allowed types can be linked.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.sys_file_purpose_mime_dtl.is_active IS 'False = type temporarily not accepted for this purpose.';
COMMENT ON CONSTRAINT pk_sys_file_purpose_mime ON public.sys_file_purpose_mime_dtl IS 'A type is listed once per purpose.';
COMMENT ON CONSTRAINT fk_sfpm_purpose ON public.sys_file_purpose_mime_dtl IS 'Known purpose; same column order as pk_sys_file_purpose.';
COMMENT ON CONSTRAINT fk_sfpm_mime ON public.sys_file_purpose_mime_dtl IS 'Type exists and is allowed; ON UPDATE RESTRICT stops a used type from being denied. Column order matches uq_sfmt_allowed.';
COMMENT ON CONSTRAINT ck_sfpm_allowed ON public.sys_file_purpose_mime_dtl IS 'Pins is_allowed to true so the FK only matches allowed types.';
COMMENT ON CONSTRAINT ck_sfpm_rec_status ON public.sys_file_purpose_mime_dtl IS 'Standard record status values.';

-- Reference tables: readable by signed-in users (the UI needs lists and limits
-- before upload), writable only by service_role (migrations and HQ).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_file_owner_scope_cd',
                         'sys_file_media_kind_cd',
                         'sys_file_preview_mode_cd',
                         'sys_file_status_cd',
                         'sys_file_source_cd',
                         'sys_file_ref_type_cd',
                         'sys_file_mime_types_cd',
                         'sys_file_bucket_cd',
                         'sys_file_category_cd',
                         'sys_file_purpose_cd',
                         'sys_file_purpose_mime_dtl'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'read_all_' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'read_all_' || t, t);
    EXECUTE format('COMMENT ON POLICY %I ON public.%I IS %L', 'read_all_' || t, t,
                   'Global reference data: any signed-in user may read; no tenant writes.');
    -- Read-only for app users; service_role keeps full access for migrations and HQ.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_touch ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_audit_touch ON public.%I IS %L', t,
                   'Keeps updated_at and updated_count current.');
  END LOOP;
END $$;

-- ─── 7. Files ───────────────────────────────────────────────────────────────

-- One row per stored file, with where it came from (source screen, sub-record)
-- and the user note. Lifecycle PENDING -> READY -> DELETED (purged later).
CREATE TABLE IF NOT EXISTS public.org_file_mst (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id          UUID        NOT NULL,
  category_code          TEXT        NOT NULL,
  purpose_code           TEXT        NOT NULL,
  entity_id              UUID        NOT NULL,
  ref_type_code          TEXT        NULL,
  ref_id                 UUID        NULL,
  source_code            TEXT        NOT NULL,
  notes                  TEXT        NULL,
  bucket_code            TEXT        NOT NULL,
  object_key             TEXT        NOT NULL,
  thumb_object_key       TEXT        NULL,
  original_name          TEXT        NOT NULL,
  mime_type              TEXT        NOT NULL,
  size_bytes             BIGINT      NOT NULL,
  thumb_size_bytes       BIGINT      NULL,
  sha256_hex             TEXT        NULL,
  width                  INTEGER     NULL,
  height                 INTEGER     NULL,
  duration_ms            INTEGER     NULL,
  status_code            TEXT        NOT NULL DEFAULT 'PENDING',
  ready_at               TIMESTAMPTZ NULL,
  purged_at              TIMESTAMPTZ NULL,
  sort_order             INTEGER     NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             TEXT        NULL,
  created_info           TEXT        NULL,
  updated_at             TIMESTAMPTZ NULL,
  updated_by             TEXT        NULL,
  updated_info           TEXT        NULL,
  updated_count          INTEGER     NOT NULL DEFAULT 0,
  deleted_at             TIMESTAMPTZ NULL,
  deleted_by             TEXT        NULL,
  deleted_info           TEXT        NULL,
  rec_status             SMALLINT    NOT NULL DEFAULT 1,
  rec_order              INTEGER     NULL,
  rec_notes              TEXT        NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_file_mst PRIMARY KEY (id),
  CONSTRAINT uq_ofm_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofm_object UNIQUE (bucket_code, object_key),
  CONSTRAINT fk_ofm_tenant FOREIGN KEY (tenant_org_id) REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_purpose FOREIGN KEY (category_code, purpose_code) REFERENCES public.sys_file_purpose_cd (category_code, purpose_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_ref_type FOREIGN KEY (ref_type_code) REFERENCES public.sys_file_ref_type_cd (ref_type_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_source FOREIGN KEY (source_code) REFERENCES public.sys_file_source_cd (source_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_bucket FOREIGN KEY (bucket_code) REFERENCES public.sys_file_bucket_cd (bucket_code) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_mime FOREIGN KEY (mime_type) REFERENCES public.sys_file_mime_types_cd (mime_type) ON DELETE RESTRICT,
  CONSTRAINT fk_ofm_status FOREIGN KEY (status_code) REFERENCES public.sys_file_status_cd (status_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ofm_ref_pair CHECK ((ref_type_code IS NULL) = (ref_id IS NULL)),
  CONSTRAINT ck_ofm_key_path CHECK (starts_with(object_key, tenant_org_id::TEXT || '/' || category_code || '/' || entity_id::TEXT || '/')),
  CONSTRAINT ck_ofm_thumb_path CHECK (thumb_object_key IS NULL OR starts_with(thumb_object_key, tenant_org_id::TEXT || '/' || category_code || '/' || entity_id::TEXT || '/')),
  CONSTRAINT ck_ofm_size CHECK (size_bytes > 0 AND (thumb_size_bytes IS NULL OR thumb_size_bytes > 0)),
  CONSTRAINT ck_ofm_thumb_size CHECK (status_code = 'PENDING' OR (thumb_object_key IS NULL) = (thumb_size_bytes IS NULL)),
  CONSTRAINT ck_ofm_sha256 CHECK (sha256_hex IS NULL OR sha256_hex ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_ofm_dims CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0) AND (duration_ms IS NULL OR duration_ms >= 0)),
  CONSTRAINT ck_ofm_name CHECK (length(btrim(original_name)) BETWEEN 1 AND 255),
  CONSTRAINT ck_ofm_notes CHECK (notes IS NULL OR length(notes) <= 2000),
  CONSTRAINT ck_ofm_ready CHECK (status_code = 'PENDING' OR (sha256_hex IS NOT NULL AND ready_at IS NOT NULL) OR (status_code = 'DELETED' AND ready_at IS NULL)),
  CONSTRAINT ck_ofm_deleted CHECK ((status_code = 'DELETED') = (deleted_at IS NOT NULL)),
  CONSTRAINT ck_ofm_purged CHECK (purged_at IS NULL OR status_code = 'DELETED'),
  CONSTRAINT ck_ofm_rec_sync CHECK (rec_status = CASE WHEN status_code = 'DELETED' THEN 0 ELSE 1 END AND is_active = (status_code <> 'DELETED')),
  CONSTRAINT ck_ofm_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE  public.org_file_mst IS 'Files stored by File Util for any organization record. The owning record is (category_code, entity_id); purpose says what the file is for; source_code, ref_type_code/ref_id and notes say where and why it was uploaded. Object key only, never a URL. Tenant-scoped, read-only RLS; writes through the File Util service.';
COMMENT ON COLUMN public.org_file_mst.id IS 'File id; also the file name part of the object key.';
COMMENT ON COLUMN public.org_file_mst.tenant_org_id IS 'Organization that owns the file; first folder of object_key.';
COMMENT ON COLUMN public.org_file_mst.category_code IS 'Kind of owning record (ORDER_FILE, ...); decides bucket, limits and the permission to read or change it.';
COMMENT ON COLUMN public.org_file_mst.purpose_code IS 'What the file is for (BEFORE_IMAGE, DELIVERY_PROOF, ...); chosen by the user; screens filter by it. Can change without moving the object.';
COMMENT ON COLUMN public.org_file_mst.entity_id IS 'Id of the owning record (order id, customer id, product id, tenant id for the logo). Not a FK because the table depends on the category; the service checks it exists in this organization.';
COMMENT ON COLUMN public.org_file_mst.ref_type_code IS 'Kind of sub-record the file is about (ORDER_PIECE, DELIVERY_STOP, ...); NULL = the whole record.';
COMMENT ON COLUMN public.org_file_mst.ref_id IS 'Id of that sub-record (piece id, delivery stop id, ...); set together with ref_type_code. The service checks it belongs to the same record and organization.';
COMMENT ON COLUMN public.org_file_mst.source_code IS 'Screen or channel the file was uploaded from (ORDER_NEW, ORDER_DELIVERY, MOBILE_APP, ...).';
COMMENT ON COLUMN public.org_file_mst.notes IS 'Note typed by the user about the file; shown with it. User text, single language.';
COMMENT ON COLUMN public.org_file_mst.bucket_code IS 'Bucket the object was written to, copied from the category at upload so later category changes never lose files.';
COMMENT ON COLUMN public.org_file_mst.object_key IS 'Storage key {tenant_org_id}/{category_code}/{entity_id}/{id}.{ext}. Made by the server; the user file name is never part of it. Never changes, so caches can be long-lived.';
COMMENT ON COLUMN public.org_file_mst.thumb_object_key IS 'Browser-made thumbnail key in the same folder ({id}_thumb.webp); NULL for non-images or when none was made.';
COMMENT ON COLUMN public.org_file_mst.original_name IS 'File name as chosen by the user, for display and download only.';
COMMENT ON COLUMN public.org_file_mst.mime_type IS 'MIME type (sys_file_mime_types_cd), lowercase, confirmed by the files first bytes at completion.';
COMMENT ON COLUMN public.org_file_mst.size_bytes IS 'Main object size in bytes: declared at upload request, replaced by the stored size at completion. Quota = size_bytes + thumb_size_bytes over READY rows.';
COMMENT ON COLUMN public.org_file_mst.thumb_size_bytes IS 'Stored thumbnail size in bytes, set at completion; NULL without thumbnail.';
COMMENT ON COLUMN public.org_file_mst.sha256_hex IS 'SHA-256 of the stored bytes, lowercase hex; set at completion. Integrity and duplicate detection.';
COMMENT ON COLUMN public.org_file_mst.width IS 'Image or video width in pixels; NULL when unknown.';
COMMENT ON COLUMN public.org_file_mst.height IS 'Image or video height in pixels; NULL when unknown.';
COMMENT ON COLUMN public.org_file_mst.duration_ms IS 'Audio or video length in milliseconds; NULL for other kinds.';
COMMENT ON COLUMN public.org_file_mst.status_code IS 'Lifecycle (sys_file_status_cd): PENDING = upload URL issued; READY = verified and visible; DELETED = soft-deleted, object purged later.';
COMMENT ON COLUMN public.org_file_mst.ready_at IS 'When the file became READY; NULL for uploads deleted before completion.';
COMMENT ON COLUMN public.org_file_mst.purged_at IS 'When the cleanup job removed the storage objects of a DELETED file; row kept for audit.';
COMMENT ON COLUMN public.org_file_mst.sort_order IS 'Display order among the files of one record and purpose; lower first.';
COMMENT ON COLUMN public.org_file_mst.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_file_mst.created_by IS 'Who created the row.';
COMMENT ON COLUMN public.org_file_mst.created_info IS 'Creation context (screen, migration, job).';
COMMENT ON COLUMN public.org_file_mst.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_file_mst.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.org_file_mst.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_file_mst.updated_count IS 'Number of updates (incremented by trigger).';
COMMENT ON COLUMN public.org_file_mst.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_file_mst.deleted_by IS 'Who soft-deleted the row.';
COMMENT ON COLUMN public.org_file_mst.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_file_mst.rec_status IS 'Record status: 1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.org_file_mst.rec_order IS 'Display order (lower first).';
COMMENT ON COLUMN public.org_file_mst.rec_notes IS 'Free notes about the record.';
COMMENT ON COLUMN public.org_file_mst.is_active IS 'Standard active flag; false exactly when DELETED (ck_ofm_rec_sync).';
COMMENT ON CONSTRAINT pk_org_file_mst ON public.org_file_mst IS 'File id.';
COMMENT ON CONSTRAINT uq_ofm_tenant_id ON public.org_file_mst IS 'Target for tenant-first composite FKs from domain tables (e.g. product image_file_id).';
COMMENT ON CONSTRAINT uq_ofm_object ON public.org_file_mst IS 'One row per storage object.';
COMMENT ON CONSTRAINT fk_ofm_tenant ON public.org_file_mst IS 'Existing organization; one with files cannot be hard-deleted.';
COMMENT ON CONSTRAINT fk_ofm_purpose ON public.org_file_mst IS 'Purpose exists in the files own category (also proves the category exists). Same column order as pk_sys_file_purpose.';
COMMENT ON CONSTRAINT fk_ofm_ref_type ON public.org_file_mst IS 'Known reference type.';
COMMENT ON CONSTRAINT fk_ofm_source ON public.org_file_mst IS 'Known upload source.';
COMMENT ON CONSTRAINT fk_ofm_bucket ON public.org_file_mst IS 'Known bucket; a bucket in use cannot be deleted.';
COMMENT ON CONSTRAINT fk_ofm_mime ON public.org_file_mst IS 'Known type. Not tied to is_allowed: files stay valid if a type is later denied.';
COMMENT ON CONSTRAINT fk_ofm_status ON public.org_file_mst IS 'Known lifecycle state.';
COMMENT ON CONSTRAINT ck_ofm_ref_pair ON public.org_file_mst IS 'Reference type and id are set together or not at all.';
COMMENT ON CONSTRAINT ck_ofm_key_path ON public.org_file_mst IS 'Object key lives under {tenant_org_id}/{category_code}/{entity_id}/, so a row can never point into another organizations or records folder.';
COMMENT ON CONSTRAINT ck_ofm_thumb_path ON public.org_file_mst IS 'Thumbnail lives in the same record folder.';
COMMENT ON CONSTRAINT ck_ofm_size ON public.org_file_mst IS 'Empty files and thumbnails are rejected.';
COMMENT ON CONSTRAINT ck_ofm_thumb_size ON public.org_file_mst IS 'Once completed, a thumbnail key always has its size and the other way round, so the quota never misses one.';
COMMENT ON CONSTRAINT ck_ofm_sha256 ON public.org_file_mst IS 'SHA-256 as 64 lowercase hex characters.';
COMMENT ON CONSTRAINT ck_ofm_dims ON public.org_file_mst IS 'Dimensions positive and duration non-negative when known.';
COMMENT ON CONSTRAINT ck_ofm_name ON public.org_file_mst IS 'Display name not blank, at most 255 characters (common file system limit).';
COMMENT ON CONSTRAINT ck_ofm_notes ON public.org_file_mst IS 'User note at most 2000 characters.';
COMMENT ON CONSTRAINT ck_ofm_ready ON public.org_file_mst IS 'A file that reached READY always has its hash and ready time; only a never-completed upload may be DELETED without them.';
COMMENT ON CONSTRAINT ck_ofm_deleted ON public.org_file_mst IS 'deleted_at is set exactly for DELETED files.';
COMMENT ON CONSTRAINT ck_ofm_purged ON public.org_file_mst IS 'Only deleted files can be purged.';
COMMENT ON CONSTRAINT ck_ofm_rec_sync ON public.org_file_mst IS 'rec_status / is_active always agree with the status, so generic soft-delete filters and status filters give the same rows.';
COMMENT ON CONSTRAINT ck_ofm_rec_status ON public.org_file_mst IS 'Standard record status values.';

-- Files of one or many records, optionally filtered by purpose, in display order; READY rows only.
CREATE INDEX IF NOT EXISTS idx_ofm_entity ON public.org_file_mst (tenant_org_id, category_code, entity_id, purpose_code, sort_order) WHERE status_code = 'READY';
COMMENT ON INDEX public.idx_ofm_entity IS 'Files of one or many records, optionally filtered by purpose, in display order; READY rows only.';

-- Files about one sub-record (a piece, an issue, a delivery stop).
CREATE INDEX IF NOT EXISTS idx_ofm_ref ON public.org_file_mst (tenant_org_id, ref_type_code, ref_id) WHERE status_code = 'READY' AND ref_id IS NOT NULL;
COMMENT ON INDEX public.idx_ofm_ref IS 'Files about one sub-record (a piece, an issue, a delivery stop).';

-- Index-only SUM(size_bytes + thumb_size_bytes) for the storage quota and usage tracking.
CREATE INDEX IF NOT EXISTS idx_ofm_quota ON public.org_file_mst (tenant_org_id) INCLUDE (size_bytes, thumb_size_bytes) WHERE status_code = 'READY';
COMMENT ON INDEX public.idx_ofm_quota IS 'Index-only SUM(size_bytes + thumb_size_bytes) for the storage quota and usage tracking.';

-- Cleanup job: abandoned uploads past their age limit (cross-tenant, service role).
CREATE INDEX IF NOT EXISTS idx_ofm_pending ON public.org_file_mst (created_at) WHERE status_code = 'PENDING';
COMMENT ON INDEX public.idx_ofm_pending IS 'Cleanup job: abandoned uploads past their age limit (cross-tenant, service role).';

-- Cleanup job: deleted files whose objects still exist (cross-tenant, service role).
CREATE INDEX IF NOT EXISTS idx_ofm_purge ON public.org_file_mst (deleted_at) WHERE status_code = 'DELETED' AND purged_at IS NULL;
COMMENT ON INDEX public.idx_ofm_purge IS 'Cleanup job: deleted files whose objects still exist (cross-tenant, service role).';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_file_mst;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_file_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_file_mst IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.org_file_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_org_file_mst ON public.org_file_mst;
-- Read-only tenant isolation. All writes go through the File Util service
-- (service role, explicit tenant_org_id in every query), which enforces
-- permission, record ownership, allowed types, limits, quota and lifecycle.
CREATE POLICY tenant_isolation_org_file_mst ON public.org_file_mst
  FOR SELECT TO authenticated
  USING (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY tenant_isolation_org_file_mst ON public.org_file_mst IS 'Signed-in users may read file rows of their own organization only; no direct writes.';
-- Browser sessions never write file rows directly; service_role keeps full access.
REVOKE ALL ON public.org_file_mst FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.org_file_mst FROM authenticated;
GRANT SELECT ON public.org_file_mst TO authenticated;
GRANT ALL ON public.org_file_mst TO service_role;

-- ─── 8. Seed data ───────────────────────────────────────────────────────────

INSERT INTO public.sys_file_owner_scope_cd
  (scope_code, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('TENANT', 'Organization', 'المنشأة', 'Files of one organization, stored under {tenant_org_id}/ and listed in org_file_mst.', 'ملفات منشأة واحدة، مخزنة تحت مجلد المنشأة.', 10, 'system', '0743_file_util_foundation'),
  ('HQ', 'HQ (SaaS Backoffice)', 'إدارة المنصة', 'Platform files owned by HQ; own table and rules when built.', 'ملفات المنصة التابعة لإدارة المنصة.', 20, 'system', '0743_file_util_foundation')
ON CONFLICT (scope_code) DO NOTHING;

INSERT INTO public.sys_file_media_kind_cd
  (kind_code, name, name2, rec_order, created_by, created_info)
VALUES
  ('IMAGE', 'Image', 'صورة', 10, 'system', '0743_file_util_foundation'),
  ('PDF', 'PDF', 'PDF', 20, 'system', '0743_file_util_foundation'),
  ('DOCUMENT', 'Document', 'مستند', 30, 'system', '0743_file_util_foundation'),
  ('SPREADSHEET', 'Spreadsheet', 'جدول بيانات', 40, 'system', '0743_file_util_foundation'),
  ('PRESENTATION', 'Presentation', 'عرض تقديمي', 50, 'system', '0743_file_util_foundation'),
  ('TEXT', 'Text', 'نص', 60, 'system', '0743_file_util_foundation'),
  ('ARCHIVE', 'Archive', 'أرشيف', 70, 'system', '0743_file_util_foundation'),
  ('AUDIO', 'Audio', 'صوت', 80, 'system', '0743_file_util_foundation'),
  ('VIDEO', 'Video', 'فيديو', 90, 'system', '0743_file_util_foundation'),
  ('WEB', 'Web page / markup', 'صفحة ويب', 100, 'system', '0743_file_util_foundation'),
  ('EXECUTABLE', 'Program / script', 'برنامج أو نص برمجي', 110, 'system', '0743_file_util_foundation'),
  ('OTHER', 'Other', 'أخرى', 120, 'system', '0743_file_util_foundation')
ON CONFLICT (kind_code) DO NOTHING;

INSERT INTO public.sys_file_preview_mode_cd
  (preview_code, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('IMAGE', 'Show as image', 'عرض كصورة', 'Rendered inline with zoom.', 'تُعرض مباشرة مع التكبير.', 10, 'system', '0743_file_util_foundation'),
  ('PDF', 'Show in PDF viewer', 'عرض في عارض PDF', 'Opened in the browser PDF viewer.', 'تُفتح في عارض PDF في المتصفح.', 20, 'system', '0743_file_util_foundation'),
  ('AUDIO', 'Play audio', 'تشغيل الصوت', 'Played inline.', 'يُشغّل مباشرة.', 30, 'system', '0743_file_util_foundation'),
  ('VIDEO', 'Play video', 'تشغيل الفيديو', 'Played inline.', 'يُشغّل مباشرة.', 40, 'system', '0743_file_util_foundation'),
  ('DOWNLOAD', 'Download only', 'تنزيل فقط', 'Never rendered inline; served as an attachment.', 'لا يُعرض مباشرة؛ يُنزّل كملف.', 50, 'system', '0743_file_util_foundation')
ON CONFLICT (preview_code) DO NOTHING;

INSERT INTO public.sys_file_status_cd
  (status_code, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('PENDING', 'Uploading', 'قيد الرفع', 'Upload URL issued; object not yet verified. Removed by cleanup after 24 hours.', 'تم إصدار رابط الرفع ولم يتم التحقق من الملف بعد.', 10, 'system', '0743_file_util_foundation'),
  ('READY', 'Ready', 'جاهز', 'Object verified; visible to users.', 'تم التحقق من الملف وهو ظاهر للمستخدمين.', 20, 'system', '0743_file_util_foundation'),
  ('DELETED', 'Deleted', 'محذوف', 'Soft-deleted; storage object purged by the cleanup job.', 'محذوف؛ يُزال الملف من التخزين بمهمة التنظيف.', 30, 'system', '0743_file_util_foundation')
ON CONFLICT (status_code) DO NOTHING;

INSERT INTO public.sys_file_source_cd
  (source_code, name, name2, rec_order, created_by, created_info)
VALUES
  ('ORDER_NEW', 'New order', 'طلب جديد', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_EDIT', 'Edit order', 'تعديل الطلب', 20, 'system', '0743_file_util_foundation'),
  ('ORDER_DETAIL', 'Order details', 'تفاصيل الطلب', 30, 'system', '0743_file_util_foundation'),
  ('ORDER_PREPARATION', 'Preparation', 'التجهيز', 40, 'system', '0743_file_util_foundation'),
  ('ORDER_PROCESSING', 'Processing', 'المعالجة', 50, 'system', '0743_file_util_foundation'),
  ('ORDER_ASSEMBLY', 'Assembly', 'التجميع', 60, 'system', '0743_file_util_foundation'),
  ('ORDER_QA', 'Quality check', 'فحص الجودة', 70, 'system', '0743_file_util_foundation'),
  ('ORDER_READY', 'Ready for pickup', 'جاهز للاستلام', 80, 'system', '0743_file_util_foundation'),
  ('ORDER_DELIVERY', 'Delivery', 'التوصيل', 90, 'system', '0743_file_util_foundation'),
  ('ORDER_ISSUE', 'Order issue', 'مشكلة الطلب', 100, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_PROFILE', 'Customer profile', 'ملف العميل', 110, 'system', '0743_file_util_foundation'),
  ('PRODUCT_SETUP', 'Product setup', 'إعداد المنتجات', 120, 'system', '0743_file_util_foundation'),
  ('TENANT_SETTINGS', 'Organization settings', 'إعدادات المنشأة', 130, 'system', '0743_file_util_foundation'),
  ('MOBILE_APP', 'Mobile app', 'تطبيق الجوال', 140, 'system', '0743_file_util_foundation'),
  ('API', 'API', 'واجهة برمجية', 150, 'system', '0743_file_util_foundation'),
  ('SYSTEM', 'System (migration, job)', 'النظام (ترحيل، مهمة)', 160, 'system', '0743_file_util_foundation')
ON CONFLICT (source_code) DO NOTHING;

INSERT INTO public.sys_file_ref_type_cd
  (ref_type_code, table_name, name, name2, rec_order, created_by, created_info)
VALUES
  ('ORDER_ITEM', 'org_order_items_dtl', 'Order item', 'صنف الطلب', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_PIECE', 'org_order_item_pieces_dtl', 'Order piece', 'قطعة الطلب', 20, 'system', '0743_file_util_foundation'),
  ('ORDER_ISSUE', 'org_order_issues', 'Order issue', 'مشكلة الطلب', 30, 'system', '0743_file_util_foundation'),
  ('DELIVERY_STOP', 'org_dlv_stops_dtl', 'Delivery stop', 'محطة التوصيل', 40, 'system', '0743_file_util_foundation'),
  ('QA_DECISION', 'org_qa_decisions_tr', 'Quality decision', 'قرار الجودة', 50, 'system', '0743_file_util_foundation'),
  ('ASM_TASK', 'org_asm_tasks_mst', 'Assembly task', 'مهمة التجميع', 60, 'system', '0743_file_util_foundation'),
  ('ASM_EXCEPTION', 'org_asm_exceptions_tr', 'Assembly exception', 'استثناء التجميع', 70, 'system', '0743_file_util_foundation')
ON CONFLICT (ref_type_code) DO NOTHING;

-- File types: 14 active (owner list), safe-but-inactive types HQ can enable,
-- and the deny list (is_allowed = false).
INSERT INTO public.sys_file_mime_types_cd
  (mime_type, kind_code, preview_code, extensions, is_allowed, is_active, name, name2, description, rec_order, created_by, created_info)
VALUES
  ('image/jpeg', 'IMAGE', 'IMAGE', ARRAY['jpg', 'jpeg', 'jfif'], true, true, 'JPEG image', 'صورة JPEG', NULL, 10, 'system', '0743_file_util_foundation'),
  ('image/png', 'IMAGE', 'IMAGE', ARRAY['png'], true, true, 'PNG image', 'صورة PNG', NULL, 20, 'system', '0743_file_util_foundation'),
  ('image/webp', 'IMAGE', 'IMAGE', ARRAY['webp'], true, true, 'WebP image', 'صورة WebP', NULL, 30, 'system', '0743_file_util_foundation'),
  ('image/gif', 'IMAGE', 'IMAGE', ARRAY['gif'], true, true, 'GIF image', 'صورة GIF', NULL, 40, 'system', '0743_file_util_foundation'),
  ('image/heic', 'IMAGE', 'DOWNLOAD', ARRAY['heic'], true, true, 'HEIC image (iPhone)', 'صورة HEIC (آيفون)', 'Most browsers cannot show it; converted to JPEG in the browser before upload when possible.', 50, 'system', '0743_file_util_foundation'),
  ('image/heif', 'IMAGE', 'DOWNLOAD', ARRAY['heif'], true, true, 'HEIF image', 'صورة HEIF', 'Most browsers cannot show it; converted to JPEG in the browser before upload when possible.', 60, 'system', '0743_file_util_foundation'),
  ('application/pdf', 'PDF', 'PDF', ARRAY['pdf'], true, true, 'PDF document', 'مستند PDF', NULL, 70, 'system', '0743_file_util_foundation'),
  ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCUMENT', 'DOWNLOAD', ARRAY['docx'], true, true, 'Word document', 'مستند Word', NULL, 80, 'system', '0743_file_util_foundation'),
  ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'SPREADSHEET', 'DOWNLOAD', ARRAY['xlsx'], true, true, 'Excel workbook', 'مصنف Excel', NULL, 90, 'system', '0743_file_util_foundation'),
  ('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PRESENTATION', 'DOWNLOAD', ARRAY['pptx'], true, true, 'PowerPoint presentation', 'عرض PowerPoint', NULL, 100, 'system', '0743_file_util_foundation'),
  ('text/plain', 'TEXT', 'DOWNLOAD', ARRAY['txt'], true, true, 'Plain text', 'نص عادي', NULL, 110, 'system', '0743_file_util_foundation'),
  ('text/csv', 'TEXT', 'DOWNLOAD', ARRAY['csv'], true, true, 'CSV file', 'ملف CSV', 'Download only; spreadsheet formulas inside are not trusted.', 120, 'system', '0743_file_util_foundation'),
  ('video/mp4', 'VIDEO', 'VIDEO', ARRAY['mp4', 'm4v'], true, true, 'MP4 video', 'فيديو MP4', NULL, 130, 'system', '0743_file_util_foundation'),
  ('video/webm', 'VIDEO', 'VIDEO', ARRAY['webm'], true, true, 'WebM video', 'فيديو WebM', NULL, 140, 'system', '0743_file_util_foundation'),
  ('image/avif', 'IMAGE', 'IMAGE', ARRAY['avif'], true, false, 'AVIF image', 'صورة AVIF', NULL, 150, 'system', '0743_file_util_foundation'),
  ('image/bmp', 'IMAGE', 'IMAGE', ARRAY['bmp'], true, false, 'Bitmap image', 'صورة BMP', NULL, 160, 'system', '0743_file_util_foundation'),
  ('image/tiff', 'IMAGE', 'DOWNLOAD', ARRAY['tif', 'tiff'], true, false, 'TIFF image', 'صورة TIFF', 'Browsers cannot show it inline.', 170, 'system', '0743_file_util_foundation'),
  ('application/msword', 'DOCUMENT', 'DOWNLOAD', ARRAY['doc'], true, false, 'Word document (old)', 'مستند Word (قديم)', NULL, 180, 'system', '0743_file_util_foundation'),
  ('application/vnd.ms-excel', 'SPREADSHEET', 'DOWNLOAD', ARRAY['xls'], true, false, 'Excel workbook (old)', 'مصنف Excel (قديم)', NULL, 190, 'system', '0743_file_util_foundation'),
  ('application/vnd.ms-powerpoint', 'PRESENTATION', 'DOWNLOAD', ARRAY['ppt'], true, false, 'PowerPoint (old)', 'عرض PowerPoint (قديم)', NULL, 200, 'system', '0743_file_util_foundation'),
  ('application/vnd.oasis.opendocument.text', 'DOCUMENT', 'DOWNLOAD', ARRAY['odt'], true, false, 'OpenDocument text', 'مستند OpenDocument', NULL, 210, 'system', '0743_file_util_foundation'),
  ('application/vnd.oasis.opendocument.spreadsheet', 'SPREADSHEET', 'DOWNLOAD', ARRAY['ods'], true, false, 'OpenDocument spreadsheet', 'جدول OpenDocument', NULL, 220, 'system', '0743_file_util_foundation'),
  ('application/vnd.oasis.opendocument.presentation', 'PRESENTATION', 'DOWNLOAD', ARRAY['odp'], true, false, 'OpenDocument presentation', 'عرض OpenDocument', NULL, 230, 'system', '0743_file_util_foundation'),
  ('application/rtf', 'DOCUMENT', 'DOWNLOAD', ARRAY['rtf'], true, false, 'Rich text', 'نص منسق', NULL, 240, 'system', '0743_file_util_foundation'),
  ('application/zip', 'ARCHIVE', 'DOWNLOAD', ARRAY['zip'], true, false, 'ZIP archive', 'أرشيف ZIP', 'Contents are not scanned.', 250, 'system', '0743_file_util_foundation'),
  ('application/x-7z-compressed', 'ARCHIVE', 'DOWNLOAD', ARRAY['7z'], true, false, '7-Zip archive', 'أرشيف 7-Zip', 'Contents are not scanned.', 260, 'system', '0743_file_util_foundation'),
  ('application/gzip', 'ARCHIVE', 'DOWNLOAD', ARRAY['gz'], true, false, 'GZIP archive', 'أرشيف GZIP', 'Contents are not scanned.', 270, 'system', '0743_file_util_foundation'),
  ('application/vnd.rar', 'ARCHIVE', 'DOWNLOAD', ARRAY['rar'], true, false, 'RAR archive', 'أرشيف RAR', 'Contents are not scanned.', 280, 'system', '0743_file_util_foundation'),
  ('audio/mpeg', 'AUDIO', 'AUDIO', ARRAY['mp3'], true, false, 'MP3 audio', 'صوت MP3', NULL, 290, 'system', '0743_file_util_foundation'),
  ('audio/mp4', 'AUDIO', 'AUDIO', ARRAY['m4a'], true, false, 'M4A audio', 'صوت M4A', NULL, 300, 'system', '0743_file_util_foundation'),
  ('audio/ogg', 'AUDIO', 'AUDIO', ARRAY['ogg', 'oga'], true, false, 'OGG audio', 'صوت OGG', NULL, 310, 'system', '0743_file_util_foundation'),
  ('audio/wav', 'AUDIO', 'AUDIO', ARRAY['wav'], true, false, 'WAV audio', 'صوت WAV', NULL, 320, 'system', '0743_file_util_foundation'),
  ('audio/webm', 'AUDIO', 'AUDIO', ARRAY['weba'], true, false, 'WebM audio', 'صوت WebM', NULL, 330, 'system', '0743_file_util_foundation'),
  ('video/quicktime', 'VIDEO', 'DOWNLOAD', ARRAY['mov'], true, false, 'QuickTime video', 'فيديو QuickTime', 'Not all browsers can play it inline.', 340, 'system', '0743_file_util_foundation'),
  ('image/svg+xml', 'IMAGE', 'DOWNLOAD', ARRAY['svg', 'svgz'], false, false, 'SVG image', 'صورة SVG', 'Blocked: can contain script that runs in the browser.', 350, 'system', '0743_file_util_foundation'),
  ('text/html', 'WEB', 'DOWNLOAD', ARRAY['html', 'htm'], false, false, 'HTML page', 'صفحة HTML', 'Blocked: runs script in the browser.', 360, 'system', '0743_file_util_foundation'),
  ('application/xhtml+xml', 'WEB', 'DOWNLOAD', ARRAY['xhtml'], false, false, 'XHTML page', 'صفحة XHTML', 'Blocked: runs script in the browser.', 370, 'system', '0743_file_util_foundation'),
  ('application/xml', 'WEB', 'DOWNLOAD', ARRAY['xml'], false, false, 'XML document', 'مستند XML', 'Blocked: can run script or load external content.', 380, 'system', '0743_file_util_foundation'),
  ('text/xml', 'WEB', 'DOWNLOAD', ARRAY['xml'], false, false, 'XML document (text)', 'مستند XML نصي', 'Blocked: can run script or load external content.', 390, 'system', '0743_file_util_foundation'),
  ('text/javascript', 'EXECUTABLE', 'DOWNLOAD', ARRAY['js', 'mjs'], false, false, 'JavaScript', 'جافاسكربت', 'Blocked: program code.', 400, 'system', '0743_file_util_foundation'),
  ('application/javascript', 'EXECUTABLE', 'DOWNLOAD', ARRAY['js'], false, false, 'JavaScript (legacy type)', 'جافاسكربت (نوع قديم)', 'Blocked: program code.', 410, 'system', '0743_file_util_foundation'),
  ('application/x-msdownload', 'EXECUTABLE', 'DOWNLOAD', ARRAY['exe', 'dll'], false, false, 'Windows program', 'برنامج ويندوز', 'Blocked: program.', 420, 'system', '0743_file_util_foundation'),
  ('application/x-msi', 'EXECUTABLE', 'DOWNLOAD', ARRAY['msi'], false, false, 'Windows installer', 'مثبت ويندوز', 'Blocked: program.', 430, 'system', '0743_file_util_foundation'),
  ('application/x-msdos-program', 'EXECUTABLE', 'DOWNLOAD', ARRAY['bat', 'cmd', 'com'], false, false, 'Windows script', 'نص أوامر ويندوز', 'Blocked: program.', 440, 'system', '0743_file_util_foundation'),
  ('application/x-sh', 'EXECUTABLE', 'DOWNLOAD', ARRAY['sh'], false, false, 'Shell script', 'نص أوامر Shell', 'Blocked: program.', 450, 'system', '0743_file_util_foundation'),
  ('application/java-archive', 'EXECUTABLE', 'DOWNLOAD', ARRAY['jar'], false, false, 'Java program', 'برنامج جافا', 'Blocked: program.', 460, 'system', '0743_file_util_foundation'),
  ('application/vnd.android.package-archive', 'EXECUTABLE', 'DOWNLOAD', ARRAY['apk'], false, false, 'Android app', 'تطبيق أندرويد', 'Blocked: program.', 470, 'system', '0743_file_util_foundation'),
  ('application/x-httpd-php', 'EXECUTABLE', 'DOWNLOAD', ARRAY['php'], false, false, 'PHP script', 'نص PHP', 'Blocked: program code.', 480, 'system', '0743_file_util_foundation'),
  ('application/vnd.ms-word.document.macroenabled.12', 'DOCUMENT', 'DOWNLOAD', ARRAY['docm'], false, false, 'Word with macros', 'Word بوحدات ماكرو', 'Blocked: macros can run code.', 490, 'system', '0743_file_util_foundation'),
  ('application/vnd.ms-excel.sheet.macroenabled.12', 'SPREADSHEET', 'DOWNLOAD', ARRAY['xlsm'], false, false, 'Excel with macros', 'Excel بوحدات ماكرو', 'Blocked: macros can run code.', 500, 'system', '0743_file_util_foundation'),
  ('application/vnd.ms-powerpoint.presentation.macroenabled.12', 'PRESENTATION', 'DOWNLOAD', ARRAY['pptm'], false, false, 'PowerPoint with macros', 'PowerPoint بوحدات ماكرو', 'Blocked: macros can run code.', 510, 'system', '0743_file_util_foundation'),
  ('application/octet-stream', 'OTHER', 'DOWNLOAD', ARRAY['bin'], false, false, 'Unknown binary', 'ملف ثنائي غير معروف', 'Blocked: type cannot be verified.', 520, 'system', '0743_file_util_foundation')
ON CONFLICT (mime_type) DO NOTHING;

INSERT INTO public.sys_file_bucket_cd
  (bucket_code, storage_bucket_id, scope_code, is_public, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('TENANT_FILES', 'tenants-cmx-files', 'TENANT', false, 'Organization files', 'ملفات المنشأة', 'Private organization files; read through 5-minute signed URLs.', 'ملفات المنشأة الخاصة؛ تُقرأ عبر روابط موقّعة صالحة 5 دقائق.', 10, 'system', '0743_file_util_foundation'),
  ('TENANT_PUBLIC', 'tenants-cmx-public', 'TENANT', true, 'Organization public files', 'ملفات المنشأة العامة', 'Public files shown on receipts and customer pages (logo, product images).', 'ملفات عامة تظهر في الإيصالات وصفحات العملاء (الشعار، صور المنتجات).', 20, 'system', '0743_file_util_foundation')
ON CONFLICT (bucket_code) DO NOTHING;

-- Photos are downscaled in the browser (2048 px orders, 1024 px others), so
-- sizes are safety ceilings, not expected sizes.
INSERT INTO public.sys_file_category_cd
  (category_code, bucket_code, max_size_bytes, max_files_per_entity, image_max_dimension, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('ORDER_FILE', 'TENANT_FILES', 10485760, 100, 2048, 'Order files', 'ملفات الطلب', 'Photos, videos and documents of an order, from any order screen.', 'صور ومقاطع ومستندات الطلب من أي شاشة طلب.', 10, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'TENANT_FILES', 10485760, 20, 1024, 'Customer files', 'ملفات العميل', 'Customer photo and documents.', 'صورة العميل ومستنداته.', 20, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'TENANT_PUBLIC', 5242880, 20, 1024, 'Product images', 'صور المنتج', 'Images of a product or service, shown on the catalog and receipts.', 'صور المنتج أو الخدمة في الكتالوج والإيصالات.', 30, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'TENANT_PUBLIC', 2097152, 2, 1024, 'Organization logo', 'شعار المنشأة', 'Logo in the app header, documents and receipts.', 'الشعار في رأس التطبيق والمستندات والإيصالات.', 40, 'system', '0743_file_util_foundation')
ON CONFLICT (category_code) DO NOTHING;

-- Purposes; "MAIN is used when missing" fallbacks are applied by the service.
INSERT INTO public.sys_file_purpose_cd
  (category_code, purpose_code, max_files, max_size_bytes, is_default, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('ORDER_FILE', 'BEFORE_IMAGE', NULL, NULL, true, 'Before processing', 'قبل المعالجة', 'Item condition when received.', 'حالة القطعة عند الاستلام.', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'AFTER_IMAGE', NULL, NULL, false, 'After processing', 'بعد المعالجة', 'Item condition when ready.', 'حالة القطعة عند الجاهزية.', 20, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DAMAGE', NULL, NULL, false, 'Damage', 'تلف', 'Existing damage found on an item.', 'تلف موجود في القطعة.', 30, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'STAIN', NULL, NULL, false, 'Stain', 'بقعة', 'Stains to treat or that may not come out.', 'بقع للمعالجة أو قد لا تزول.', 40, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', NULL, NULL, false, 'Issue evidence', 'دليل المشكلة', 'Evidence for a reported order issue.', 'دليل على مشكلة مُبلّغ عنها في الطلب.', 50, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'QA_EVIDENCE', NULL, NULL, false, 'Quality check', 'فحص الجودة', 'Photos taken during a quality check.', 'صور أثناء فحص الجودة.', 60, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ASSEMBLY_EXCEPTION', NULL, NULL, false, 'Assembly exception', 'استثناء التجميع', 'Photos of an assembly exception.', 'صور استثناء أثناء التجميع.', 70, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DELIVERY_PROOF', NULL, NULL, false, 'Delivery proof', 'إثبات التسليم', 'Photo proving the order was delivered.', 'صورة تثبت تسليم الطلب.', 80, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'SIGNATURE', NULL, NULL, false, 'Signature', 'التوقيع', 'Customer signature captured on screen.', 'توقيع العميل على الشاشة.', 90, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ITEM_VIDEO', 5, 52428800, false, 'Item video', 'فيديو القطعة', 'Short video of an item (condition, defect).', 'فيديو قصير للقطعة (الحالة، العيب).', 100, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', NULL, NULL, false, 'Customer document', 'مستند العميل', 'Document provided by the customer (instructions, receipt).', 'مستند من العميل (تعليمات، إيصال).', 110, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', NULL, NULL, false, 'Other', 'أخرى', 'Any other order file.', 'أي ملف آخر للطلب.', 120, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'PHOTO', 1, 2097152, true, 'Profile photo', 'الصورة الشخصية', 'Customer profile photo.', 'الصورة الشخصية للعميل.', 130, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', NULL, NULL, false, 'ID document', 'مستند الهوية', 'Copy of an identity document.', 'نسخة من مستند الهوية.', 140, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', NULL, NULL, false, 'Other', 'أخرى', 'Any other customer file.', 'أي ملف آخر للعميل.', 150, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'MAIN', 1, NULL, true, 'Main image', 'الصورة الرئيسية', 'Shown in the catalog and product lists.', 'تظهر في الكتالوج وقوائم المنتجات.', 160, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'FOR_ORDER', 1, NULL, false, 'Order image', 'صورة الطلب', 'Shown on order screens and receipts; MAIN is used when missing.', 'تظهر في شاشات الطلب والإيصالات؛ تُستخدم الرئيسية عند غيابها.', 170, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'BACKSIDE', 1, NULL, false, 'Back side', 'الجهة الخلفية', 'Back view of the item.', 'المنظر الخلفي للقطعة.', 180, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'GALLERY', NULL, NULL, false, 'Gallery', 'معرض الصور', 'Extra images shown on the product screen.', 'صور إضافية في شاشة المنتج.', 190, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'MAIN', 1, NULL, true, 'Logo', 'الشعار', 'Logo in the app header, documents and emails.', 'الشعار في رأس التطبيق والمستندات والبريد.', 200, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'RECEIPT', 1, NULL, false, 'Receipt logo', 'شعار الإيصال', 'Black-and-white logo for thermal printers; MAIN is used when missing.', 'شعار بالأبيض والأسود للطابعات الحرارية؛ يُستخدم الرئيسي عند غيابه.', 210, 'system', '0743_file_util_foundation')
ON CONFLICT (category_code, purpose_code) DO NOTHING;

-- Allowed types per purpose. HEIC/HEIF (iPhone camera) accepted for photos;
-- public purposes accept only types every browser can show.
INSERT INTO public.sys_file_purpose_mime_dtl
  (category_code, purpose_code, mime_type, rec_order, created_by, created_info)
VALUES
  ('ORDER_FILE', 'BEFORE_IMAGE', 'image/jpeg', 10, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'BEFORE_IMAGE', 'image/png', 20, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'BEFORE_IMAGE', 'image/webp', 30, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'BEFORE_IMAGE', 'image/heic', 40, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'BEFORE_IMAGE', 'image/heif', 50, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'AFTER_IMAGE', 'image/jpeg', 60, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'AFTER_IMAGE', 'image/png', 70, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'AFTER_IMAGE', 'image/webp', 80, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'AFTER_IMAGE', 'image/heic', 90, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'AFTER_IMAGE', 'image/heif', 100, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DAMAGE', 'image/jpeg', 110, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DAMAGE', 'image/png', 120, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DAMAGE', 'image/webp', 130, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DAMAGE', 'image/heic', 140, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DAMAGE', 'image/heif', 150, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'STAIN', 'image/jpeg', 160, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'STAIN', 'image/png', 170, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'STAIN', 'image/webp', 180, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'STAIN', 'image/heic', 190, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'STAIN', 'image/heif', 200, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', 'image/jpeg', 210, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', 'image/png', 220, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', 'image/webp', 230, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', 'image/heic', 240, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', 'image/heif', 250, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ISSUE_EVIDENCE', 'application/pdf', 260, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'QA_EVIDENCE', 'image/jpeg', 270, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'QA_EVIDENCE', 'image/png', 280, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'QA_EVIDENCE', 'image/webp', 290, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'QA_EVIDENCE', 'image/heic', 300, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'QA_EVIDENCE', 'image/heif', 310, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ASSEMBLY_EXCEPTION', 'image/jpeg', 320, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ASSEMBLY_EXCEPTION', 'image/png', 330, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ASSEMBLY_EXCEPTION', 'image/webp', 340, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ASSEMBLY_EXCEPTION', 'image/heic', 350, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ASSEMBLY_EXCEPTION', 'image/heif', 360, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DELIVERY_PROOF', 'image/jpeg', 370, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DELIVERY_PROOF', 'image/png', 380, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DELIVERY_PROOF', 'image/webp', 390, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DELIVERY_PROOF', 'image/heic', 400, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'DELIVERY_PROOF', 'image/heif', 410, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'SIGNATURE', 'image/jpeg', 420, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'SIGNATURE', 'image/png', 430, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'SIGNATURE', 'image/webp', 440, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ITEM_VIDEO', 'video/mp4', 450, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'ITEM_VIDEO', 'video/webm', 460, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'image/jpeg', 470, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'image/png', 480, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'image/webp', 490, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'image/heic', 500, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'image/heif', 510, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'application/pdf', 520, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 530, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 540, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 550, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'text/plain', 560, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'CUSTOMER_DOCUMENT', 'text/csv', 570, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'image/jpeg', 580, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'image/png', 590, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'image/webp', 600, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'image/heic', 610, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'image/heif', 620, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'application/pdf', 630, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 640, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 650, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 660, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'text/plain', 670, 'system', '0743_file_util_foundation'),
  ('ORDER_FILE', 'OTHER', 'text/csv', 680, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'PHOTO', 'image/jpeg', 690, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'PHOTO', 'image/png', 700, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'PHOTO', 'image/webp', 710, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', 'image/jpeg', 720, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', 'image/png', 730, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', 'image/webp', 740, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', 'image/heic', 750, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', 'image/heif', 760, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'ID_DOCUMENT', 'application/pdf', 770, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'image/jpeg', 780, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'image/png', 790, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'image/webp', 800, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'image/heic', 810, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'image/heif', 820, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'application/pdf', 830, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 840, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 850, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 860, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'text/plain', 870, 'system', '0743_file_util_foundation'),
  ('CUSTOMER_FILE', 'OTHER', 'text/csv', 880, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'MAIN', 'image/jpeg', 890, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'MAIN', 'image/png', 900, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'MAIN', 'image/webp', 910, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'FOR_ORDER', 'image/jpeg', 920, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'FOR_ORDER', 'image/png', 930, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'FOR_ORDER', 'image/webp', 940, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'BACKSIDE', 'image/jpeg', 950, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'BACKSIDE', 'image/png', 960, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'BACKSIDE', 'image/webp', 970, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'GALLERY', 'image/jpeg', 980, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'GALLERY', 'image/png', 990, 'system', '0743_file_util_foundation'),
  ('PRODUCT_IMAGE', 'GALLERY', 'image/webp', 1000, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'MAIN', 'image/jpeg', 1010, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'MAIN', 'image/png', 1020, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'MAIN', 'image/webp', 1030, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'RECEIPT', 'image/jpeg', 1040, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'RECEIPT', 'image/png', 1050, 'system', '0743_file_util_foundation'),
  ('TENANT_LOGO', 'RECEIPT', 'image/webp', 1060, 'system', '0743_file_util_foundation')
ON CONFLICT (category_code, purpose_code, mime_type) DO NOTHING;

-- ─── 9. Storage buckets ─────────────────────────────────────────────────────

-- Bucket ceiling and type list are a second gate behind the purpose rules:
-- the largest purpose/category size and the union of linked types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('tenants-cmx-files', 'tenants-cmx-files', false, 52428800,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'video/mp4', 'video/webm', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv']),
  ('tenants-cmx-public', 'tenants-cmx-public', true, 5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage.objects policies for these buckets, on purpose. Only server code
-- touches objects: uploads through signed upload URLs issued after permission,
-- type, limit and quota checks; private reads through 5-minute signed URLs
-- issued after the category's read permission check; deletes as service_role
-- (cleanup job). A browser session cannot list, read, overwrite or delete
-- objects directly. The public bucket is readable only through each object's
-- public URL (unguessable keys under {tenant_org_id}/).

COMMIT;
