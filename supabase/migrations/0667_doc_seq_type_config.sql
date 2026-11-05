--
-- Migration 0667_doc_seq_type_config.sql
-- Human-Friendly Codes, P1 (DB engine), migration 2 of 7.
--
-- Purpose: the single registry of every human-facing document number / code in the platform.
--   sys_doc_seq_category_cd      CATALOG / MASTER_DATA / TRANSACTION
--   sys_doc_seq_manage_level_cd  GENERAL (shared engine) / DOMAIN (own generator) / MANUAL / NONE
--   fn_doc_seq_full_size()       IMMUTABLE helper; created BEFORE the table because a generated column calls it
--   sys_doc_seq_type_cd          one row per document type (51 rows, approved 2026-10-30)
--
-- Prefix model (approved 2026-10-30, plan section 20.2):
--   prefix       the printed prefix (may be empty or shared by DOMAIN types, e.g. INV, CN, CMX).
--   type_prefix  reserved 3-5 capital letters, NOT NULL and UNIQUE across all rows; the stable key used in scan
--                payloads (CMX1:<type_prefix>:<code>), logs and screens. For GENERAL rows type_prefix = prefix.
--   Target and printed-prefix uniqueness among GENERAL rows are partial unique indexes (INVENTORY S11/S18).
-- DOMAIN-first: ORDER and STORE_CREDIT_NOTE are seeded as DOMAIN (today's truth). The P2 order-number and the
-- P5 store-credit migrations switch them to GENERAL in the same transaction that seeds counters and adds triggers,
-- so vw_doc_seq_consistency has 0 ERROR rows after every phase.
--
-- Affected: sys_doc_seq_category_cd, sys_doc_seq_manage_level_cd, sys_doc_seq_type_cd (new); fn_doc_seq_full_size,
--           fn_doc_seq_type_guard (new functions).
-- Related:  migration sys_platform_scope_modules (scope, module and sub-system FKs).
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.2.
-- APPLY ORDER: 2 of 7 in P1. Requires sys_platform_scope_modules. Next: hq_general_config.
-- ROLLBACK PLAN (forward-only repo; write a new migration), reverse order, RESTRICT:
--   DROP TABLE public.sys_doc_seq_type_cd RESTRICT; DROP FUNCTION public.fn_doc_seq_type_guard() RESTRICT;
--   DROP FUNCTION public.fn_doc_seq_full_size(text,text,text,smallint) RESTRICT;
--   DROP TABLE public.sys_doc_seq_manage_level_cd RESTRICT; DROP TABLE public.sys_doc_seq_category_cd RESTRICT;
--   (fails safely while doc_seq_counters / later migrations reference them; roll those back first)
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1. Lookups ------------------------------------------------------------
CREATE TABLE public.sys_doc_seq_category_cd (
  category_code TEXT    NOT NULL,                    -- Stored value (exact case).
  name          TEXT    NOT NULL,                    -- English display name.
  name2         TEXT,                                -- Arabic display name.
  description   TEXT,                                -- English description.
  description2  TEXT,                                -- Arabic description.
  display_order INTEGER NOT NULL DEFAULT 0,          -- Order in pick lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_doc_seq_category_cd PRIMARY KEY (category_code),
  CONSTRAINT ck_doc_seq_cat_code CHECK (category_code ~ '^[A-Z][A-Z0-9_]{1,29}$')
);
COMMENT ON TABLE public.sys_doc_seq_category_cd IS 'Kind of document a sequence numbers. Admin-extensible lookup.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.category_code IS 'Stored value (exact case). Mirrored in TS constants.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.display_order IS 'Order in pick lists.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_doc_seq_category_cd.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_doc_seq_cat_code ON public.sys_doc_seq_category_cd IS 'Codes are UPPER_SNAKE, 2-30 chars.';
ALTER TABLE public.sys_doc_seq_category_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_seq_cat_read ON public.sys_doc_seq_category_cd
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);
COMMENT ON POLICY doc_seq_cat_read ON public.sys_doc_seq_category_cd IS 'Signed-in users may read live, active rows; there is no write policy (writes are service_role only).';
REVOKE ALL ON TABLE public.sys_doc_seq_category_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.sys_doc_seq_category_cd FROM authenticated;
GRANT SELECT ON TABLE public.sys_doc_seq_category_cd TO authenticated;
GRANT ALL ON TABLE public.sys_doc_seq_category_cd TO service_role;
CREATE TRIGGER trg_doc_seq_cat_upd
  BEFORE UPDATE ON public.sys_doc_seq_category_cd
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_doc_seq_cat_upd ON public.sys_doc_seq_category_cd IS 'Sets updated_at on every update.';
INSERT INTO public.sys_doc_seq_category_cd (category_code, name, name2, description, display_order, created_by, created_info) VALUES
  ('CATALOG', 'Catalog', 'كتالوج', 'Catalog definitions (rarely numbered).', 10, 'migration', 'doc_seq_type_config'),
  ('MASTER_DATA', 'Master data', 'بيانات رئيسية', 'Long-lived records: customers, products, suppliers, accounts.', 20, 'migration', 'doc_seq_type_config'),
  ('TRANSACTION', 'Transaction', 'معاملة', 'Business events: orders, invoices, vouchers, sessions.', 30, 'migration', 'doc_seq_type_config');

CREATE TABLE public.sys_doc_seq_manage_level_cd (
  manage_level_code TEXT    NOT NULL,                    -- Stored value (exact case).
  name          TEXT    NOT NULL,                    -- English display name.
  name2         TEXT,                                -- Arabic display name.
  description   TEXT,                                -- English description.
  description2  TEXT,                                -- Arabic description.
  display_order INTEGER NOT NULL DEFAULT 0,          -- Order in pick lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_doc_seq_manage_level_cd PRIMARY KEY (manage_level_code),
  CONSTRAINT ck_doc_seq_lvl_code CHECK (manage_level_code ~ '^[A-Z][A-Z0-9_]{1,29}$')
);
COMMENT ON TABLE public.sys_doc_seq_manage_level_cd IS 'Who generates a document number. Fixed set.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.manage_level_code IS 'Stored value (exact case). Mirrored in TS constants.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.display_order IS 'Order in pick lists.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_doc_seq_manage_level_cd.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_doc_seq_lvl_code ON public.sys_doc_seq_manage_level_cd IS 'Codes are UPPER_SNAKE, 2-30 chars.';
ALTER TABLE public.sys_doc_seq_manage_level_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_seq_lvl_read ON public.sys_doc_seq_manage_level_cd
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);
COMMENT ON POLICY doc_seq_lvl_read ON public.sys_doc_seq_manage_level_cd IS 'Signed-in users may read live, active rows; there is no write policy (writes are service_role only).';
REVOKE ALL ON TABLE public.sys_doc_seq_manage_level_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.sys_doc_seq_manage_level_cd FROM authenticated;
GRANT SELECT ON TABLE public.sys_doc_seq_manage_level_cd TO authenticated;
GRANT ALL ON TABLE public.sys_doc_seq_manage_level_cd TO service_role;
CREATE TRIGGER trg_doc_seq_lvl_upd
  BEFORE UPDATE ON public.sys_doc_seq_manage_level_cd
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_doc_seq_lvl_upd ON public.sys_doc_seq_manage_level_cd IS 'Sets updated_at on every update.';
INSERT INTO public.sys_doc_seq_manage_level_cd (manage_level_code, name, name2, description, display_order, created_by, created_info) VALUES
  ('GENERAL', 'Shared engine', 'المحرك العام', 'Generated by fn_doc_seq_next and the assign trigger; counters in *_doc_seq_mst.', 10, 'migration', 'doc_seq_type_config'),
  ('DOMAIN', 'Domain generator', 'مولد خاص بالمجال', 'Generated by the named domain function or service (managed_by_object).', 20, 'migration', 'doc_seq_type_config'),
  ('MANUAL', 'Manual', 'يدوي', 'Typed by a user; the platform only validates it.', 30, 'migration', 'doc_seq_type_config'),
  ('NONE', 'Not generated', 'غير مولد', 'Documented only; nothing generates it.', 40, 'migration', 'doc_seq_type_config');

-- 2. fn_doc_seq_full_size (must exist before sys_doc_seq_type_cd.full_size) ------------
CREATE FUNCTION public.fn_doc_seq_full_size(
  p_prefix    TEXT,
  p_separator TEXT,
  p_parts     TEXT,
  p_pad       SMALLINT
) RETURNS SMALLINT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  -- Printed length when every part has a fixed width; NULL when any part is variable (BR, PARENT, RAND, SEQ pad 0).
  SELECT CASE
           WHEN p_parts IS NULL THEN NULL
           WHEN bool_or(w IS NULL) THEN NULL
           ELSE (COALESCE(length(p_prefix), 0)
                 + CASE WHEN COALESCE(p_prefix, '') <> '' THEN COALESCE(length(p_separator), 0) ELSE 0 END
                 + sum(w)
                 + (count(*) - 1) * COALESCE(length(p_separator), 0))::SMALLINT
         END
  FROM (
    SELECT CASE tok
             WHEN 'YYYY' THEN 4 WHEN 'YY' THEN 2 WHEN 'YYYYMM' THEN 6 WHEN 'YYMM' THEN 4 WHEN 'YYYYMMDD' THEN 8
             WHEN 'SEQ' THEN NULLIF(p_pad, 0)
             ELSE NULL
           END AS w
    FROM unnest(string_to_array(p_parts, '-')) AS tok
  ) t
$$;
COMMENT ON FUNCTION public.fn_doc_seq_full_size(TEXT, TEXT, TEXT, SMALLINT) IS
  'Printed code length for a format: prefix + separator + fixed token widths (YYYY 4, YY 2, YYYYMM 6, YYMM 4, YYYYMMDD 8, SEQ = pad) + separators. NULL when a part is variable (BR, PARENT, RAND, or SEQ with pad 0). Used by the generated column sys_doc_seq_type_cd.full_size; SEQ grows past the pad, so this is the minimum length.';
REVOKE ALL ON FUNCTION public.fn_doc_seq_full_size(TEXT, TEXT, TEXT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_full_size(TEXT, TEXT, TEXT, SMALLINT) TO authenticated, service_role;

-- 3. sys_doc_seq_type_cd ----------------------------------------------------
CREATE TABLE public.sys_doc_seq_type_cd (
  doc_type_code         TEXT     NOT NULL,           -- Stored doc type value, e.g. ORDER.
  name                  TEXT     NOT NULL,           -- English display name.
  name2                 TEXT,                        -- Arabic display name.
  description           TEXT,                        -- English description.
  description2          TEXT,                        -- Arabic description.
  scope_code            TEXT     NOT NULL,           -- Who owns the numbered data (FK sys_saas_scope_cd).
  category_code         TEXT     NOT NULL,           -- FK sys_doc_seq_category_cd.
  module_code           TEXT     NOT NULL,           -- Owning module (FK with sub_system_code).
  sub_system_code       TEXT     NOT NULL,           -- Owning sub-system.
  target_table          TEXT     NOT NULL,           -- Table that stores the code.
  target_column         TEXT     NOT NULL,           -- Column that stores the code.
  is_unique             BOOLEAN  NOT NULL DEFAULT true,  -- Code must be unique within unique_with.
  unique_with           TEXT[],                      -- Columns that scope uniqueness, e.g. {tenant_org_id}.
  prefix                TEXT,                        -- Printed prefix (NULL = none / varies).
  type_prefix           TEXT     NOT NULL,           -- Reserved unique 3-5 letter key of the type.
  separator             TEXT     NOT NULL DEFAULT '-',  -- Printed separator between parts.
  parts_format          TEXT     NOT NULL,           -- Tokens joined by '-', e.g. YYYYMMDD-SEQ.
  how_many_parts        SMALLINT GENERATED ALWAYS AS (cardinality(string_to_array(parts_format, '-'))::SMALLINT) STORED,  -- Token count.
  seq_pad_length        SMALLINT NOT NULL DEFAULT 6,   -- Minimum SEQ width (grows, never truncates).
  full_size             SMALLINT GENERATED ALWAYS AS (public.fn_doc_seq_full_size(prefix, separator, parts_format, seq_pad_length)) STORED,  -- Minimum printed length.
  reset_policy          TEXT,                        -- When the counter restarts.
  manage_by_level       TEXT     NOT NULL,           -- FK sys_doc_seq_manage_level_cd.
  managed_by_object     TEXT,                        -- DOMAIN/MANUAL owner: function signature, table, or app:<path>.
  allow_tenant_override BOOLEAN  NOT NULL DEFAULT false,  -- Reserved, always false.
  strict_no_gaps        BOOLEAN  NOT NULL DEFAULT false,  -- Documented need for gap-free numbers.
  implement_description TEXT     NOT NULL,           -- How it works, step by step, for HQ support.
  display_order         INTEGER  NOT NULL DEFAULT 0, -- Order in lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_doc_seq_type_cd PRIMARY KEY (doc_type_code),
  CONSTRAINT ck_doc_seq_type_code CHECK (doc_type_code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT fk_doc_seq_type_scope FOREIGN KEY (scope_code)
    REFERENCES public.sys_saas_scope_cd (scope_code) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_seq_type_cat FOREIGN KEY (category_code)
    REFERENCES public.sys_doc_seq_category_cd (category_code) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_seq_type_level FOREIGN KEY (manage_by_level)
    REFERENCES public.sys_doc_seq_manage_level_cd (manage_level_code) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_seq_type_subsys FOREIGN KEY (module_code, sub_system_code)
    REFERENCES public.sys_module_sub_systems_cd (module_code, sub_system_code) ON DELETE RESTRICT,
  CONSTRAINT ck_doc_seq_target CHECK (target_table ~ '^[a-z][a-z0-9_]{0,62}$' AND target_column ~ '^[a-z][a-z0-9_]{0,62}$'),
  CONSTRAINT ck_doc_seq_separator CHECK (separator IN ('-', '/', '')),
  CONSTRAINT ck_doc_seq_parts CHECK (parts_format ~ '^((YYYY|YY|YYYYMM|YYMM|YYYYMMDD|BR|PARENT|RAND)-)*(SEQ|RAND|PARENT)$'),
  CONSTRAINT ck_doc_seq_pad CHECK (seq_pad_length BETWEEN 0 AND 12),
  CONSTRAINT ck_doc_seq_reset CHECK (reset_policy IS NULL OR reset_policy IN ('NEVER','YEARLY','MONTHLY','DAILY','FISCAL_YEAR','PER_PARENT')),
  CONSTRAINT ck_doc_seq_tprefix CHECK (type_prefix ~ '^[A-Z]{3,5}$'),
  CONSTRAINT uq_doc_seq_type_tprefix UNIQUE (type_prefix),
  CONSTRAINT ck_doc_seq_gen_tprefix CHECK (manage_by_level <> 'GENERAL' OR type_prefix = prefix),
  CONSTRAINT ck_doc_seq_general_shape CHECK (manage_by_level <> 'GENERAL' OR (
        prefix IS NOT NULL AND seq_pad_length >= 1
    AND parts_format ~ '^((YYYY|YY|YYYYMM|YYMM|YYYYMMDD|BR)-)*SEQ$'
    AND reset_policy IS NOT NULL AND reset_policy <> 'PER_PARENT'
    AND (reset_policy <> 'NEVER'   OR parts_format !~ '(YYYY|YY|YYMM|YYYYMM|YYYYMMDD)')
    AND (reset_policy NOT IN ('YEARLY','FISCAL_YEAR') OR parts_format ~ '(^|-)(YYYY|YY)(-|$)')
    AND (reset_policy <> 'MONTHLY' OR parts_format ~ '(^|-)(YYYYMM|YYMM)(-|$)')
    AND (reset_policy <> 'DAILY'   OR parts_format ~ '(^|-)YYYYMMDD(-|$)'))),
  CONSTRAINT ck_doc_seq_prefix CHECK (prefix IS NULL
        OR (manage_by_level =  'GENERAL' AND prefix ~ '^[A-Z]{3,5}$')
        OR (manage_by_level <> 'GENERAL' AND prefix ~ '^[A-Z][A-Z0-9-]{0,11}$')),
  CONSTRAINT ck_doc_seq_managed_obj CHECK (manage_by_level = 'GENERAL' OR managed_by_object IS NOT NULL),
  CONSTRAINT ck_doc_seq_unique_with CHECK (is_unique OR unique_with IS NULL),
  CONSTRAINT ck_doc_seq_override_off CHECK (allow_tenant_override = false),
  CONSTRAINT ck_doc_seq_impl_desc CHECK (btrim(implement_description) <> '')
);
CREATE UNIQUE INDEX uq_doc_seq_type_target ON public.sys_doc_seq_type_cd (target_table, target_column)
  WHERE manage_by_level = 'GENERAL';
CREATE UNIQUE INDEX uq_doc_seq_type_prefix ON public.sys_doc_seq_type_cd (prefix)
  WHERE manage_by_level = 'GENERAL' AND prefix IS NOT NULL;
-- Lookups by target use the PK (engine) or a scan of this small table (consistency view); no extra target index.
CREATE INDEX idx_doc_seq_type_subsys ON public.sys_doc_seq_type_cd (module_code, sub_system_code);

COMMENT ON TABLE public.sys_doc_seq_type_cd IS 'Registry of every human-facing document number / code: format, owner, target column and generator. GENERAL rows are generated by fn_doc_seq_next; DOMAIN rows document their own generator.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.doc_type_code IS 'Stored doc type value (exact case). Mirrored in lib/constants/doc-seq.ts.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.scope_code IS 'Who owns the numbered data: TENANT_ORG (per tenant counter), SYS or HQ (platform counter).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.category_code IS 'Kind of document (sys_doc_seq_category_cd).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.module_code IS 'Owning module; FK with sub_system_code to sys_module_sub_systems_cd.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.sub_system_code IS 'Owning sub-system.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.target_table IS 'Table that stores the code (public schema).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.target_column IS 'Column that stores the code.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.is_unique IS 'True when the code must be unique within unique_with (checked by vw_doc_seq_consistency).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.unique_with IS 'Columns that scope uniqueness, e.g. {tenant_org_id}; NULL = globally unique.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.prefix IS 'Printed prefix. NULL when none or when it varies. GENERAL: 3-5 capital letters, unique among GENERAL rows, equal to type_prefix. DOMAIN: may be shared (INV, CN, CMX).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.type_prefix IS 'Reserved 3-5 letter type key, unique across all rows. Used in scan payloads (CMX1:<type_prefix>:<code>), logs and screens. Immutable once set. Child codes keep their own value format.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.separator IS 'Printed separator between prefix and parts: ''-'', ''/'' or ''''.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.parts_format IS 'Tokens joined by ''-'': YYYY, YY, YYYYMM, YYMM, YYYYMMDD, BR, PARENT, RAND, SEQ. GENERAL rows end in SEQ and use only date/BR tokens before it.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.how_many_parts IS 'Generated: number of tokens in parts_format.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.seq_pad_length IS 'Minimum SEQ width; numbers grow past it and are never truncated. 0 = no padding.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.full_size IS 'Generated: minimum printed length (fn_doc_seq_full_size); NULL when a part is variable.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.reset_policy IS 'When the counter restarts: NEVER, YEARLY, MONTHLY, DAILY, FISCAL_YEAR (tenant fiscal start month), PER_PARENT.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.manage_by_level IS 'Who generates it: GENERAL (shared engine), DOMAIN (own generator), MANUAL, NONE.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.managed_by_object IS 'DOMAIN/MANUAL owner: a function signature (public.fn(uuid)), a table, or app:<repo path> for application code.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.allow_tenant_override IS 'Reserved; always false (tenants cannot change formats in this version).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.strict_no_gaps IS 'True when the business requires gap-free numbers (the engine does not promise this; documented need).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.implement_description IS 'How it works, step by step, for HQ support: generator, counter table and key, trigger, period rule, check SQL, and the reserved prefix meaning.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.display_order IS 'Order in lists.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.sys_doc_seq_type_cd.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_doc_seq_type_code ON public.sys_doc_seq_type_cd IS 'Doc type codes are UPPER_SNAKE, 2-30 chars.';
COMMENT ON CONSTRAINT fk_doc_seq_type_scope ON public.sys_doc_seq_type_cd IS 'Scope; RESTRICT.';
COMMENT ON CONSTRAINT fk_doc_seq_type_cat ON public.sys_doc_seq_type_cd IS 'Category; RESTRICT.';
COMMENT ON CONSTRAINT fk_doc_seq_type_level ON public.sys_doc_seq_type_cd IS 'Manage level; RESTRICT.';
COMMENT ON CONSTRAINT fk_doc_seq_type_subsys ON public.sys_doc_seq_type_cd IS 'Module and sub-system; RESTRICT.';
COMMENT ON CONSTRAINT ck_doc_seq_target ON public.sys_doc_seq_type_cd IS 'Target table/column are lower-case SQL identifiers.';
COMMENT ON CONSTRAINT ck_doc_seq_separator ON public.sys_doc_seq_type_cd IS 'Separator is ''-'', ''/'' or empty.';
COMMENT ON CONSTRAINT ck_doc_seq_parts ON public.sys_doc_seq_type_cd IS 'parts_format uses known tokens only and ends in SEQ, RAND or PARENT.';
COMMENT ON CONSTRAINT ck_doc_seq_pad ON public.sys_doc_seq_type_cd IS 'SEQ pad 0-12.';
COMMENT ON CONSTRAINT ck_doc_seq_reset ON public.sys_doc_seq_type_cd IS 'Known reset policies only.';
COMMENT ON CONSTRAINT ck_doc_seq_tprefix ON public.sys_doc_seq_type_cd IS 'type_prefix is 3-5 capital letters.';
COMMENT ON CONSTRAINT uq_doc_seq_type_tprefix ON public.sys_doc_seq_type_cd IS 'type_prefix is unique across all rows.';
COMMENT ON CONSTRAINT ck_doc_seq_gen_tprefix ON public.sys_doc_seq_type_cd IS 'GENERAL rows print their reserved prefix (type_prefix = prefix).';
COMMENT ON CONSTRAINT ck_doc_seq_general_shape ON public.sys_doc_seq_type_cd IS 'GENERAL rows: prefix set, pad >= 1, date tokens then SEQ, and the reset policy matches the date token.';
COMMENT ON CONSTRAINT ck_doc_seq_prefix ON public.sys_doc_seq_type_cd IS 'GENERAL prefix 3-5 capital letters; DOMAIN/MANUAL prefix up to 12 chars (capitals, digits, dash).';
COMMENT ON CONSTRAINT ck_doc_seq_managed_obj ON public.sys_doc_seq_type_cd IS 'Non-GENERAL rows must name their owner.';
COMMENT ON CONSTRAINT ck_doc_seq_unique_with ON public.sys_doc_seq_type_cd IS 'unique_with only when is_unique.';
COMMENT ON CONSTRAINT ck_doc_seq_override_off ON public.sys_doc_seq_type_cd IS 'Tenant override is reserved and off.';
COMMENT ON CONSTRAINT ck_doc_seq_impl_desc ON public.sys_doc_seq_type_cd IS 'implement_description is required.';
COMMENT ON INDEX public.uq_doc_seq_type_target IS 'One GENERAL row per target column (DOMAIN rows may share; the consistency view reports it).';
COMMENT ON INDEX public.uq_doc_seq_type_prefix IS 'Printed prefix unique among GENERAL rows.';
COMMENT ON INDEX public.idx_doc_seq_type_subsys IS 'Supports the sub-system FK and module filters.';

-- 4. Guard: type_prefix and doc_type_code never change once created ------------------
CREATE FUNCTION public.fn_doc_seq_type_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.type_prefix IS DISTINCT FROM OLD.type_prefix THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_PREFIX_IMMUTABLE: % (% -> %)', OLD.doc_type_code, OLD.type_prefix, NEW.type_prefix
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.doc_type_code IS DISTINCT FROM OLD.doc_type_code THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_CODE_IMMUTABLE: %', OLD.doc_type_code USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_type_guard() IS 'Blocks changes to doc_type_code and type_prefix: both are printed in scan payloads, logs and counters.';
REVOKE ALL ON FUNCTION public.fn_doc_seq_type_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_doc_seq_type_guard
  BEFORE UPDATE OF doc_type_code, type_prefix ON public.sys_doc_seq_type_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_doc_seq_type_guard();
COMMENT ON TRIGGER trg_doc_seq_type_guard ON public.sys_doc_seq_type_cd IS 'Keeps doc_type_code and type_prefix immutable.';

ALTER TABLE public.sys_doc_seq_type_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_seq_type_read ON public.sys_doc_seq_type_cd
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);
COMMENT ON POLICY doc_seq_type_read ON public.sys_doc_seq_type_cd IS 'Signed-in users may read live, active rows; there is no write policy (writes are service_role only).';
REVOKE ALL ON TABLE public.sys_doc_seq_type_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.sys_doc_seq_type_cd FROM authenticated;
GRANT SELECT ON TABLE public.sys_doc_seq_type_cd TO authenticated;
GRANT ALL ON TABLE public.sys_doc_seq_type_cd TO service_role;
CREATE TRIGGER trg_doc_seq_type_upd
  BEFORE UPDATE ON public.sys_doc_seq_type_cd
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_doc_seq_type_upd ON public.sys_doc_seq_type_cd IS 'Sets updated_at on every update.';

-- 5. Seed: 51 document types (approved 2026-10-30; plan section 20.2 / INVENTORY section 7) ----------
INSERT INTO public.sys_doc_seq_type_cd (doc_type_code, name, name2, description, scope_code, category_code, module_code, sub_system_code,
  target_table, target_column, is_unique, unique_with, prefix, type_prefix, separator, parts_format, seq_pad_length, reset_policy, manage_by_level, managed_by_object,
  implement_description, display_order, created_by, created_info) VALUES
  ('ORDER', 'Order number', 'رقم الطلب', 'Order number shown on receipts, labels and search.', 'TENANT_ORG', 'TRANSACTION', 'ORDERS', 'ORDER',
   'org_orders_mst', 'order_no', true, ARRAY['tenant_org_id']::TEXT[], 'ORD', 'ORD', '-', 'YYYYMMDD-SEQ', 4, 'DAILY', 'DOMAIN', 'public.generate_order_number(uuid)',
   'Today: public.generate_order_number(tenant) (0012) returns ORD-<CURRENT_DATE YYYYMMDD>-<MAX+1 LPAD 4>; called by web-admin lib/utils/order-number-generator.ts and legacy splitOrder. P2 (migration ord_order_no_engine) switches this row to GENERAL in the same transaction that seeds org_doc_seq_mst from existing data and adds trg_ord_no_assign / trg_ord_no_guard; then the engine fn_doc_seq_next(tenant,''ORDER'') owns it (tenant time zone day, row lock, pad grows). Sub-orders share the column: <root order_no>-S<n> via fn_ord_next_sub_order_no (P2). Check: SELECT order_no FROM org_orders_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix ORD: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ORD:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: ORD). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   10, 'migration', 'doc_seq_type_config'),
  ('ORDER_ITEM', 'Order item serial', 'رقم بند الطلب', 'Serial of an order line; parent is the order number.', 'TENANT_ORG', 'TRANSACTION', 'ORDERS', 'ORDER_ITEM',
   'org_order_items_dtl', 'order_item_srno', true, ARRAY['tenant_org_id']::TEXT[], NULL, 'ITM', '-', 'PARENT-SEQ', 0, 'PER_PARENT', 'DOMAIN', 'public.fn_next_order_item_srno(uuid,uuid)',
   'Child code: value is <order_no>-<n> with no printed prefix (prefix ITM is reserved only). Today the app sets it at INSERT (order-service.ts, order-change-structural-write.ts); trigger before_ins_set_order_item_srno -> trg_set_order_item_srno() -> fn_next_order_item_srno(tenant, order) (0015) fills it when empty but its regex is broken and returns ''001'' (INVENTORY S6). P3 (migration ord_item_srno_barcode) fixes the body, backfills, adds the UNIQUE and the immutability guard. Check: SELECT order_item_srno FROM org_order_items_dtl WHERE tenant_org_id = $1 AND order_id = $2; Reserved type prefix ITM: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ITM:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: none). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   20, 'migration', 'doc_seq_type_config'),
  ('ORDER_PIECE', 'Order piece code', 'رمز قطعة الطلب', 'Code of one physical piece of an order item.', 'TENANT_ORG', 'TRANSACTION', 'ORDERS', 'ORDER_PIECE',
   'org_order_item_pieces_dtl', 'piece_code', true, ARRAY['tenant_org_id']::TEXT[], NULL, 'PEC', '-', 'PARENT-SEQ', 0, 'PER_PARENT', 'DOMAIN', 'public.org_order_item_pieces_dtl',
   'Child code: value is <order_item_srno>-<piece_seq> with no printed prefix (prefix PEC is reserved only). Today piece_code is a GENERATED ALWAYS column built from UUIDs (0073), so managed_by_object names the table. P3 (migration ord_piece_code_human) drops the expression, backfills and adds trigger fn_ord_piece_code_set plus the guard. The external heat-seal tag lives in barcode. Check: SELECT piece_code, barcode FROM org_order_item_pieces_dtl WHERE tenant_org_id = $1 AND order_item_id = $2; Reserved type prefix PEC: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PEC:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: none). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   30, 'migration', 'doc_seq_type_config'),
  ('STORE_CREDIT_NOTE', 'Store credit note number', 'رقم إشعار رصيد المتجر', 'Store credit note issued to a customer.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'STORE_CREDIT',
   'org_credit_notes_mst', 'credit_note_no', true, ARRAY['tenant_org_id']::TEXT[], 'CN', 'SCN', '-', 'RAND-SEQ', 5, 'NEVER', 'DOMAIN', 'app:web-admin/lib/services/stored-value.service.ts',
   'Today: stored-value.service.ts (two call sites) builds CN-<first 8 chars of tenant id>-<COUNT+1 LPAD 5> (the RAND token here stands for that tenant fragment; race-prone). P5 (migration store_credit_note_engine) switches this row to GENERAL with printed prefix SCN, parts YYYY-SEQ pad 6 YEARLY, seeds org_doc_seq_mst and adds the assign/guard triggers; legacy CN- rows are kept. org_order_credit_apps_dtl.credit_note_no is a snapshot copy, not a generator. Check: SELECT credit_note_no FROM org_credit_notes_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix SCN: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:SCN:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CN). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   40, 'migration', 'doc_seq_type_config'),
  ('FIN_JOURNAL', 'Journal number', 'رقم القيد اليومي', 'ERP Lite journal entry number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'JOURNAL',
   'org_fin_journal_mst', 'journal_no', true, ARRAY['tenant_org_id']::TEXT[], NULL, 'JRL', '', 'SEQ', 6, 'NEVER', 'DOMAIN', 'public.fn_next_fin_doc_no(uuid,character varying)',
   'public.fn_next_fin_doc_no(tenant,''JOURNAL'') (0214, hardened in migration doc_seq_engine_fns) locks org_fin_doc_seq_mst(tenant_org_id, doc_type_code) FOR UPDATE, increments last_no and returns COALESCE(prefix,'''') || seq padded to padding_len (never truncated after hardening). Called by the ERP posting engine. Printed prefix is empty today; JRL is the reserved type prefix. Check: SELECT prefix, last_no, padding_len FROM org_fin_doc_seq_mst WHERE tenant_org_id = $1 AND doc_type_code = ''JOURNAL''; Reserved type prefix JRL: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:JRL:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: none). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   50, 'migration', 'doc_seq_type_config'),
  ('AR_INVOICE', 'AR invoice number', 'رقم فاتورة الذمم المدينة', 'Accounts-receivable invoice number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'AR',
   'org_invoice_mst', 'invoice_no', true, ARRAY['tenant_org_id']::TEXT[], 'ARI', 'ARI', '-', 'SEQ', 6, 'NEVER', 'DOMAIN', 'public.fn_next_fin_doc_no(uuid,character varying)',
   'public.fn_next_fin_doc_no(tenant,''AR_INV'') via nextArInvoiceNumber (ar-invoice.service.ts). Prefix ''ARI-'' lives in org_fin_doc_seq_mst (seeded for existing tenants by 0314); a missing row is auto-created with an empty prefix, so the prefix row must exist before first use. Check: SELECT prefix, last_no FROM org_fin_doc_seq_mst WHERE tenant_org_id = $1 AND doc_type_code = ''AR_INV''; Reserved type prefix ARI: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ARI:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: ARI). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   60, 'migration', 'doc_seq_type_config'),
  ('REFUND', 'Refund number', 'رقم الاسترداد', 'Order refund number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'REFUND',
   'org_order_refunds_dtl', 'refund_no', true, ARRAY['tenant_org_id']::TEXT[], 'REF', 'REF', '-', 'SEQ', 6, 'NEVER', 'DOMAIN', 'public.fn_next_fin_doc_no(uuid,character varying)',
   'public.fn_next_fin_doc_no(tenant,''REFUND'') (order-refund.service.ts). Prefix ''REF-'' in org_fin_doc_seq_mst (0387); a missing row is auto-created with an empty prefix, so the prefix row must exist before first use. Check: SELECT prefix, last_no FROM org_fin_doc_seq_mst WHERE tenant_org_id = $1 AND doc_type_code = ''REFUND''; Reserved type prefix REF: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:REF:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: REF). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   70, 'migration', 'doc_seq_type_config'),
  ('TAX_INVOICE', 'Tax invoice number', 'رقم الفاتورة الضريبية', 'Tax invoice number (tax document).', 'TENANT_ORG', 'TRANSACTION', 'TAX', 'TAX_DOC',
   'org_tax_documents_mst', 'document_no', true, ARRAY['tenant_org_id']::TEXT[], 'INV', 'INV', '-', 'YYYY-SEQ', 6, 'FISCAL_YEAR', 'DOMAIN', 'app:web-admin/lib/services/tax-document-sequence.service.ts',
   'allocateTaxDocumentSequence (tax-document-sequence.service.ts) takes a locked counter row in org_tax_doc_seq_counters per tenant, document type and fiscal year and returns INV-<FY>-<seq 6>. One target column is shared by the four tax document types. Check: SELECT * FROM org_tax_doc_seq_counters WHERE tenant_org_id = $1; Reserved type prefix INV: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:INV:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: INV). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   80, 'migration', 'doc_seq_type_config'),
  ('TAX_SIMPLIFIED', 'Simplified tax invoice number', 'رقم الفاتورة الضريبية المبسطة', 'Simplified tax invoice number (tax document).', 'TENANT_ORG', 'TRANSACTION', 'TAX', 'TAX_DOC',
   'org_tax_documents_mst', 'document_no', true, ARRAY['tenant_org_id']::TEXT[], 'SIM', 'SIM', '-', 'YYYY-SEQ', 6, 'FISCAL_YEAR', 'DOMAIN', 'app:web-admin/lib/services/tax-document-sequence.service.ts',
   'allocateTaxDocumentSequence (tax-document-sequence.service.ts) takes a locked counter row in org_tax_doc_seq_counters per tenant, document type and fiscal year and returns SIM-<FY>-<seq 6>. One target column is shared by the four tax document types. Check: SELECT * FROM org_tax_doc_seq_counters WHERE tenant_org_id = $1; Reserved type prefix SIM: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:SIM:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: SIM). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   90, 'migration', 'doc_seq_type_config'),
  ('TAX_CREDIT_NOTE', 'Tax credit note number', 'رقم الإشعار الدائن الضريبي', 'Tax credit note number (tax document).', 'TENANT_ORG', 'TRANSACTION', 'TAX', 'TAX_DOC',
   'org_tax_documents_mst', 'document_no', true, ARRAY['tenant_org_id']::TEXT[], 'CN', 'TCN', '-', 'YYYY-SEQ', 6, 'FISCAL_YEAR', 'DOMAIN', 'app:web-admin/lib/services/tax-document-sequence.service.ts',
   'allocateTaxDocumentSequence (tax-document-sequence.service.ts) takes a locked counter row in org_tax_doc_seq_counters per tenant, document type and fiscal year and returns CN-<FY>-<seq 6>. One target column is shared by the four tax document types. Check: SELECT * FROM org_tax_doc_seq_counters WHERE tenant_org_id = $1; Reserved type prefix TCN: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:TCN:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CN). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   100, 'migration', 'doc_seq_type_config'),
  ('TAX_DEBIT_NOTE', 'Tax debit note number', 'رقم الإشعار المدين الضريبي', 'Tax debit note number (tax document).', 'TENANT_ORG', 'TRANSACTION', 'TAX', 'TAX_DOC',
   'org_tax_documents_mst', 'document_no', true, ARRAY['tenant_org_id']::TEXT[], 'DN', 'TDN', '-', 'YYYY-SEQ', 6, 'FISCAL_YEAR', 'DOMAIN', 'app:web-admin/lib/services/tax-document-sequence.service.ts',
   'allocateTaxDocumentSequence (tax-document-sequence.service.ts) takes a locked counter row in org_tax_doc_seq_counters per tenant, document type and fiscal year and returns DN-<FY>-<seq 6>. One target column is shared by the four tax document types. Check: SELECT * FROM org_tax_doc_seq_counters WHERE tenant_org_id = $1; Reserved type prefix TDN: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:TDN:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: DN). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   110, 'migration', 'doc_seq_type_config'),
  ('RECEIPT_VOUCHER', 'Receipt voucher number', 'رقم سند القبض', 'Receipt voucher number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], 'RV', 'RCV', '-', 'YYYY-SEQ', 6, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-number.service.ts',
   'generateBizVoucherNo (voucher-number.service.ts) takes advisory lock bvm_voucher_no_<tenant>, reads the lexical MAX of RV-<server year>-% and returns RV-YYYY-<seq 6>. The column is shared with the other voucher types and the legacy generator (LEGACY_VOUCHER). Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''RV-%'' ORDER BY voucher_no DESC LIMIT 5; Reserved type prefix RCV: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:RCV:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: RV). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   120, 'migration', 'doc_seq_type_config'),
  ('PAYMENT_VOUCHER', 'Payment voucher number', 'رقم سند الصرف', 'Payment voucher number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], 'PV', 'PMV', '-', 'YYYY-SEQ', 6, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-number.service.ts',
   'generateBizVoucherNo (voucher-number.service.ts) takes advisory lock bvm_voucher_no_<tenant>, reads the lexical MAX of PV-<server year>-% and returns PV-YYYY-<seq 6>. The column is shared with the other voucher types and the legacy generator (LEGACY_VOUCHER). Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''PV-%'' ORDER BY voucher_no DESC LIMIT 5; Reserved type prefix PMV: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PMV:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: PV). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   130, 'migration', 'doc_seq_type_config'),
  ('REFUND_VOUCHER', 'Refund voucher number', 'رقم سند الاسترداد', 'Refund voucher number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], 'RF', 'RFV', '-', 'YYYY-SEQ', 6, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-number.service.ts',
   'generateBizVoucherNo (voucher-number.service.ts) takes advisory lock bvm_voucher_no_<tenant>, reads the lexical MAX of RF-<server year>-% and returns RF-YYYY-<seq 6>. The column is shared with the other voucher types and the legacy generator (LEGACY_VOUCHER). Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''RF-%'' ORDER BY voucher_no DESC LIMIT 5; Reserved type prefix RFV: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:RFV:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: RF). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   140, 'migration', 'doc_seq_type_config'),
  ('ADJUSTMENT_VOUCHER', 'Adjustment voucher number', 'رقم سند التسوية', 'Adjustment voucher number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], 'ADJ', 'ADJ', '-', 'YYYY-SEQ', 6, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-number.service.ts',
   'generateBizVoucherNo (voucher-number.service.ts) takes advisory lock bvm_voucher_no_<tenant>, reads the lexical MAX of ADJ-<server year>-% and returns ADJ-YYYY-<seq 6>. The column is shared with the other voucher types and the legacy generator (LEGACY_VOUCHER). Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''ADJ-%'' ORDER BY voucher_no DESC LIMIT 5; Reserved type prefix ADJ: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ADJ:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: ADJ). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   150, 'migration', 'doc_seq_type_config'),
  ('TRANSFER_VOUCHER', 'Transfer voucher number', 'رقم سند التحويل', 'Transfer voucher number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], 'TR', 'TRV', '-', 'YYYY-SEQ', 6, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-number.service.ts',
   'generateBizVoucherNo (voucher-number.service.ts) takes advisory lock bvm_voucher_no_<tenant>, reads the lexical MAX of TR-<server year>-% and returns TR-YYYY-<seq 6>. The column is shared with the other voucher types and the legacy generator (LEGACY_VOUCHER). Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''TR-%'' ORDER BY voucher_no DESC LIMIT 5; Reserved type prefix TRV: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:TRV:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: TR). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   160, 'migration', 'doc_seq_type_config'),
  ('VOUCHER_OTHER', 'Other voucher number', 'رقم سند آخر', 'Other voucher number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], 'VCH', 'VCH', '-', 'YYYY-SEQ', 6, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-number.service.ts',
   'generateBizVoucherNo (voucher-number.service.ts) takes advisory lock bvm_voucher_no_<tenant>, reads the lexical MAX of VCH-<server year>-% and returns VCH-YYYY-<seq 6>. The column is shared with the other voucher types and the legacy generator (LEGACY_VOUCHER). Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''VCH-%'' ORDER BY voucher_no DESC LIMIT 5; Reserved type prefix VCH: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:VCH:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: VCH). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   170, 'migration', 'doc_seq_type_config'),
  ('LEGACY_VOUCHER', 'Legacy voucher number', 'رقم السند القديم', 'Voucher numbers from the legacy generator.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'VOUCHER',
   'org_fin_vouchers_mst', 'voucher_no', true, ARRAY['tenant_org_id']::TEXT[], NULL, 'VCR', '-', 'YYYY-SEQ', 5, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/voucher-service.ts',
   'generateVoucherNo (voucher-service.ts, legacy) prints VCR-RCP, REF, CRN, VCR-PAY or VCR-ADJ + -YYYY-<seq 5> (lexical MAX, server year). Printed prefix varies, so it is NULL here; VCR is the reserved type prefix. Retire in P10. Check: SELECT voucher_no FROM org_fin_vouchers_mst WHERE tenant_org_id = $1 AND voucher_no LIKE ''VCR-%'' LIMIT 5; Reserved type prefix VCR: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:VCR:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: none). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   180, 'migration', 'doc_seq_type_config'),
  ('POS_SESSION', 'POS session number', 'رقم جلسة نقطة البيع', 'POS session number.', 'TENANT_ORG', 'TRANSACTION', 'POS', 'POS_SESSION',
   'org_pos_sessions_mst', 'session_no', true, ARRAY['tenant_org_id','branch_id']::TEXT[], 'POS', 'POS', '-', 'YYYYMMDD-RAND', 8, 'NEVER', 'DOMAIN', 'app:web-admin/lib/services/pos-session.service.ts',
   'pos-session.service.ts builds POS-<YYYYMMDD>-<8 random chars>; unique per tenant and branch. Check: SELECT session_no FROM org_pos_sessions_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix POS: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:POS:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: POS). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   190, 'migration', 'doc_seq_type_config'),
  ('POS_Z_REPORT', 'Z-report number', 'رقم تقرير Z', 'Z-report (shift close) number.', 'TENANT_ORG', 'TRANSACTION', 'POS', 'Z_REPORT',
   'org_pos_shift_z_rpt_tr', 'report_no', true, ARRAY['tenant_org_id']::TEXT[], 'Z', 'ZRP', '-', 'PARENT', 0, 'PER_PARENT', 'DOMAIN', 'app:web-admin/lib/services/pos-shift-report.service.ts',
   'pos-shift-report.service.ts builds Z-<session_no> (prefix constant in lib/constants/pos-shift-report.ts). Derived from the parent session; ZRP is the reserved type prefix. Check: SELECT report_no FROM org_pos_shift_z_rpt_tr WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix ZRP: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ZRP:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: Z). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   200, 'migration', 'doc_seq_type_config'),
  ('CASH_DRAWER_SESSION', 'Cash drawer session number', 'رقم جلسة درج النقد', 'Cash drawer session number.', 'TENANT_ORG', 'TRANSACTION', 'POS', 'CASH_DRAWER',
   'org_cash_drawer_sessions_mst', 'session_no', true, ARRAY['tenant_org_id']::TEXT[], 'SES', 'SES', '-', 'YYYYMMDD-SEQ', 4, 'DAILY', 'DOMAIN', 'public.generate_cash_drawer_sess_no(uuid)',
   'public.generate_cash_drawer_sess_no(tenant) (0519, grants and search_path hardened in migration doc_seq_engine_fns) takes advisory lock hashtext(tenant||date), reads MAX for SES-<CURRENT_DATE>-% and returns SES-YYYYMMDD-<seq 4>. Caller cash-drawer-session.service.ts ($queryRaw) must run it in the same transaction as the INSERT. Check: SELECT session_no FROM org_cash_drawer_sessions_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix SES: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:SES:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: SES). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   210, 'migration', 'doc_seq_type_config'),
  ('CASH_DRAWER_TRX', 'Cash drawer transaction number', 'رقم حركة درج النقد', 'Cash drawer transaction number.', 'TENANT_ORG', 'TRANSACTION', 'POS', 'CASH_DRAWER',
   'org_cash_drawer_trx_mst', 'trx_no', true, ARRAY['tenant_org_id']::TEXT[], 'CDT', 'CDT', '-', 'YYYYMMDD-SEQ', 4, 'DAILY', 'DOMAIN', 'public.generate_cash_drawer_trx_no(uuid)',
   'public.generate_cash_drawer_trx_no(tenant) (0527; service_role only) returns CDT-YYYYMMDD-<seq 4>. Check: SELECT trx_no FROM org_cash_drawer_trx_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix CDT: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:CDT:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CDT). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   220, 'migration', 'doc_seq_type_config'),
  ('CUSTOMER', 'Customer number', 'رقم العميل', 'Customer number.', 'SYS', 'MASTER_DATA', 'CRM', 'CUSTOMER',
   'sys_customers_mst', 'customer_number', true, NULL, 'CUST', 'CUST', '-', 'SEQ', 5, 'NEVER', 'DOMAIN', 'public.generate_customer_number(uuid)',
   'public.generate_customer_number(tenant) (0011) writes the global sys_customers_mst.customer_number, MAX+1 keyed by first_tenant_org_id, LPAD 5, no lock (race fix in P10). Caller customers.service.ts. Scope SYS because the table is global (CRM is a tenant module; the view only warns). Check: SELECT customer_number FROM sys_customers_mst ORDER BY created_at DESC LIMIT 5; Reserved type prefix CUST: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:CUST:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CUST). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   230, 'migration', 'doc_seq_type_config'),
  ('USER', 'User code', 'رمز المستخدم', 'Sign-in user code.', 'SYS', 'MASTER_DATA', 'CORE', 'USER',
   'org_users_mst', 'user_code', true, NULL, 'U', 'USR', '', 'SEQ', 6, 'NEVER', 'DOMAIN', 'public.fn_org_user_code_next()',
   'Column default public.fn_org_user_code_next() (0563) over the global sequence org_user_code_seq; prints U + 6 digits and skips manual codes. Platform-wide, so scope SYS even though the table has tenant_org_id (the view only warns). Check: SELECT last_value FROM org_user_code_seq; Reserved type prefix USR: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:USR:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: U). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   240, 'migration', 'doc_seq_type_config'),
  ('PRODUCT', 'Product code', 'رمز المنتج', 'Catalog product code.', 'TENANT_ORG', 'MASTER_DATA', 'CATALOG', 'PRODUCT',
   'org_product_data_mst', 'product_code', true, ARRAY['tenant_org_id']::TEXT[], 'PROD', 'PROD', '-', 'SEQ', 5, 'NEVER', 'DOMAIN', 'app:web-admin/lib/services/catalog.service.ts',
   'generateProductCode (catalog.service.ts) returns PROD-<lexical MAX + 1, pad 5>. Shares the column with STOCK_ITEM. Check: SELECT product_code FROM org_product_data_mst WHERE tenant_org_id = $1 AND product_code LIKE ''PROD-%'' ORDER BY product_code DESC LIMIT 5; Reserved type prefix PROD: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PROD:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: PROD). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   250, 'migration', 'doc_seq_type_config'),
  ('STOCK_ITEM', 'Stock item code', 'رمز صنف المخزون', 'Retail stock item code.', 'TENANT_ORG', 'MASTER_DATA', 'INVENTORY', 'STOCK_ITEM',
   'org_product_data_mst', 'product_code', true, ARRAY['tenant_org_id']::TEXT[], 'INV', 'SKU', '-', 'SEQ', 5, 'NEVER', 'DOMAIN', 'app:web-admin/lib/services/inventory-service.ts',
   'inventory-service.ts returns INV-<MAX+1 pad 5> over LIKE ''INV-%'' for retail items. Printed INV clashes with tax invoices; SKU is the reserved type prefix. Check: SELECT product_code FROM org_product_data_mst WHERE tenant_org_id = $1 AND product_code LIKE ''INV-%'' ORDER BY product_code DESC LIMIT 5; Reserved type prefix SKU: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:SKU:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: INV). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   260, 'migration', 'doc_seq_type_config'),
  ('GIFT_CARD', 'Gift card code', 'رمز بطاقة الهدية', 'Gift card code.', 'TENANT_ORG', 'MASTER_DATA', 'FIN', 'GIFT_CARD',
   'org_gift_cards_mst', 'gift_card_code', true, ARRAY['tenant_org_id']::TEXT[], 'CMX', 'GFT', '-', 'RAND-RAND-RAND', 4, 'NEVER', 'DOMAIN', 'app:web-admin/lib/services/gift-card-service.ts',
   'gift-card-service.ts returns CMX-XXXX-XXXX-XXXX (random). Printed CMX clashes with HQ lead codes; GFT is the reserved type prefix. Check: SELECT gift_card_code FROM org_gift_cards_mst WHERE tenant_org_id = $1 LIMIT 5; Reserved type prefix GFT: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:GFT:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CMX). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   270, 'migration', 'doc_seq_type_config'),
  ('DELIVERY_ROUTE', 'Delivery route number', 'رقم مسار التوصيل', 'Delivery route number.', 'TENANT_ORG', 'TRANSACTION', 'DELIVERY', 'ROUTE',
   'org_dlv_routes_mst', 'route_number', true, ARRAY['tenant_org_id']::TEXT[], 'RT', 'RTE', '-', 'YYYY-SEQ', 3, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/delivery/delivery-route-command.service.ts',
   'delivery-route-command.service.ts upserts counter org_dlv_route_seq_cf ... RETURNING and prints RT-YYYY-<seq 3, grows>. Check: SELECT * FROM org_dlv_route_seq_cf WHERE tenant_org_id = $1; Reserved type prefix RTE: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:RTE:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: RT). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   280, 'migration', 'doc_seq_type_config'),
  ('B2B_CONTRACT', 'B2B contract number', 'رقم عقد الأعمال', 'B2B contract number.', 'TENANT_ORG', 'MASTER_DATA', 'B2B', 'CONTRACT',
   'org_b2b_contracts_mst', 'contract_no', true, ARRAY['tenant_org_id']::TEXT[], 'CON', 'CON', '-', 'YYYYMM-SEQ', 4, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/b2b-contracts.service.ts',
   'b2b-contracts.service.ts returns CON-YYYYMM-<COUNT+1 pad 4>; a manual value is allowed. Check: SELECT contract_no FROM org_b2b_contracts_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix CON: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:CON:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CON). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   290, 'migration', 'doc_seq_type_config'),
  ('B2B_STATEMENT', 'B2B statement number', 'رقم كشف حساب الأعمال', 'B2B statement number.', 'TENANT_ORG', 'TRANSACTION', 'B2B', 'STATEMENT',
   'org_b2b_statements_mst', 'statement_no', true, ARRAY['tenant_org_id']::TEXT[], 'STMT', 'STMT', '-', 'YYYYMM-SEQ', 4, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/b2b-statements.service.ts',
   'b2b-statements.service.ts returns STMT-YYYYMM-<COUNT+1 pad 4>. Check: SELECT statement_no FROM org_b2b_statements_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix STMT: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:STMT:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: STMT). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   300, 'migration', 'doc_seq_type_config'),
  ('AR_DISPUTE', 'AR dispute number', 'رقم نزاع الذمم المدينة', 'AR dispute number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'AR_OPS',
   'org_ar_disputes_mst', 'dispute_no', true, ARRAY['tenant_org_id']::TEXT[], 'ARD', 'ARD', '-', 'RAND', 4, 'NEVER', 'DOMAIN', 'app:web-admin/lib/services/ar-dispute.service.ts',
   'ar-dispute.service.ts returns ARD-<UTC yyyymmddhhmmss>-<4 base36>. Check: SELECT dispute_no FROM org_ar_disputes_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix ARD: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ARD:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: ARD). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   310, 'migration', 'doc_seq_type_config'),
  ('AR_DUNNING_RUN', 'AR dunning run number', 'رقم دورة المطالبة', 'Dunning run number per customer.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'AR_OPS',
   'org_ar_dunning_runs_mst', 'run_no', true, ARRAY['tenant_org_id','customer_id']::TEXT[], NULL, 'DUN', '', 'SEQ', 0, 'PER_PARENT', 'DOMAIN', 'app:web-admin/lib/services/ar-dunning-ops.service.ts',
   'ar-dunning-ops.service.ts sets run_no = MAX+1 per customer (an integer, no printed prefix). DUN is the reserved type prefix. Check: SELECT customer_id, MAX(run_no) FROM org_ar_dunning_runs_mst WHERE tenant_org_id = $1 GROUP BY customer_id; Reserved type prefix DUN: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:DUN:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: none). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   320, 'migration', 'doc_seq_type_config'),
  ('AR_RECON_RUN', 'AR reconciliation run number', 'رقم دورة التسوية', 'Reconciliation run number.', 'TENANT_ORG', 'TRANSACTION', 'FIN', 'AR_OPS',
   'org_fin_recon_runs_mst', 'run_no', true, ARRAY['tenant_org_id']::TEXT[], 'RECON', 'RECON', '-', 'YYYY-SEQ', 3, 'YEARLY', 'DOMAIN', 'app:web-admin/lib/services/reconciliation.service.ts',
   'reconciliation.service.ts returns RECON-YYYY-<COUNT+1 pad 3>. Check: SELECT run_no FROM org_fin_recon_runs_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix RECON: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:RECON:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: RECON). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   330, 'migration', 'doc_seq_type_config'),
  ('ERP_EXPENSE', 'Expense number', 'رقم المصروف', 'ERP Lite expense number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'EXPENSE',
   'org_fin_exp_mst', 'expense_no', true, ARRAY['tenant_org_id']::TEXT[], 'EXP', 'EXP', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-expenses.service.ts',
   'erp-lite-expenses.service.ts returns EXP-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT expense_no FROM org_fin_exp_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix EXP: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:EXP:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: EXP). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   340, 'migration', 'doc_seq_type_config'),
  ('ERP_PETTY_CASHBOX', 'Petty cashbox code', 'رمز صندوق العهدة', 'ERP Lite petty cashbox code.', 'TENANT_ORG', 'MASTER_DATA', 'ERP', 'PETTY_CASH',
   'org_fin_cashbox_mst', 'cashbox_code', true, ARRAY['tenant_org_id']::TEXT[], 'PCB', 'PCB', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-expenses.service.ts',
   'erp-lite-expenses.service.ts returns PCB-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT cashbox_code FROM org_fin_cashbox_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix PCB: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PCB:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: PCB). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   350, 'migration', 'doc_seq_type_config'),
  ('ERP_PETTY_CASH_TXN', 'Petty cash transaction number', 'رقم حركة العهدة', 'ERP Lite petty cash transaction number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'PETTY_CASH',
   'org_fin_cash_txn_tr', 'txn_no', true, ARRAY['tenant_org_id']::TEXT[], 'PCT', 'PCT', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-expenses.service.ts',
   'erp-lite-expenses.service.ts returns PCT-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT txn_no FROM org_fin_cash_txn_tr WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix PCT: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PCT:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: PCT). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   360, 'migration', 'doc_seq_type_config'),
  ('ERP_PETTY_CASH_RECON', 'Petty cash reconciliation number', 'رقم تسوية العهدة', 'ERP Lite petty cash reconciliation number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'PETTY_CASH',
   'org_fin_cash_rec_mst', 'recon_no', true, ARRAY['tenant_org_id']::TEXT[], 'PCR', 'PCR', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-expenses.service.ts',
   'erp-lite-expenses.service.ts returns PCR-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT recon_no FROM org_fin_cash_rec_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix PCR: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PCR:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: PCR). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   370, 'migration', 'doc_seq_type_config'),
  ('ERP_SUPPLIER', 'Supplier code', 'رمز المورد', 'ERP Lite supplier code.', 'TENANT_ORG', 'MASTER_DATA', 'ERP', 'PROCUREMENT',
   'org_fin_supp_mst', 'supplier_code', true, ARRAY['tenant_org_id']::TEXT[], 'SUP', 'SUP', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns SUP-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT supplier_code FROM org_fin_supp_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix SUP: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:SUP:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: SUP). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   380, 'migration', 'doc_seq_type_config'),
  ('ERP_PO', 'Purchase order number', 'رقم أمر الشراء', 'ERP Lite purchase order number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'PROCUREMENT',
   'org_fin_po_mst', 'po_no', true, ARRAY['tenant_org_id']::TEXT[], 'PO', 'PUR', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns PO-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT po_no FROM org_fin_po_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix PUR: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:PUR:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: PO). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   390, 'migration', 'doc_seq_type_config'),
  ('ERP_AP_INVOICE', 'AP invoice number', 'رقم فاتورة المورد', 'ERP Lite aP invoice number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'AP',
   'org_fin_ap_inv_mst', 'ap_inv_no', true, ARRAY['tenant_org_id']::TEXT[], 'API', 'API', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns API-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT ap_inv_no FROM org_fin_ap_inv_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix API: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:API:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: API). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   400, 'migration', 'doc_seq_type_config'),
  ('ERP_AP_PAYMENT', 'AP payment number', 'رقم دفعة المورد', 'ERP Lite aP payment number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'AP',
   'org_fin_ap_pmt_mst', 'ap_pmt_no', true, ARRAY['tenant_org_id']::TEXT[], 'APP', 'APP', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns APP-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT ap_pmt_no FROM org_fin_ap_pmt_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix APP: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:APP:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: APP). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   410, 'migration', 'doc_seq_type_config'),
  ('ERP_BANK_ACCOUNT', 'Bank account code', 'رمز الحساب البنكي', 'ERP Lite bank account code.', 'TENANT_ORG', 'MASTER_DATA', 'ERP', 'BANK',
   'org_fin_bank_acct_mst', 'bank_code', true, ARRAY['tenant_org_id']::TEXT[], 'BNK', 'BNK', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns BNK-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT bank_code FROM org_fin_bank_acct_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix BNK: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:BNK:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: BNK). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   420, 'migration', 'doc_seq_type_config'),
  ('ERP_BANK_STATEMENT', 'Bank statement batch number', 'رقم دفعة كشف البنك', 'ERP Lite bank statement batch number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'BANK',
   'org_fin_bank_stmt_mst', 'import_batch_no', true, ARRAY['tenant_org_id']::TEXT[], 'BST', 'BST', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns BST-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT import_batch_no FROM org_fin_bank_stmt_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix BST: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:BST:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: BST). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   430, 'migration', 'doc_seq_type_config'),
  ('ERP_BANK_RECON', 'Bank reconciliation code', 'رمز تسوية البنك', 'ERP Lite bank reconciliation code.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'BANK',
   'org_fin_bank_recon_mst', 'recon_code', true, ARRAY['tenant_org_id']::TEXT[], 'BRC', 'BRC', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-v2.service.ts',
   'erp-lite-v2.service.ts returns BRC-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT recon_code FROM org_fin_bank_recon_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix BRC: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:BRC:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: BRC). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   440, 'migration', 'doc_seq_type_config'),
  ('ERP_ALLOC_RULE', 'Allocation rule code', 'رمز قاعدة التوزيع', 'ERP Lite allocation rule code.', 'TENANT_ORG', 'MASTER_DATA', 'ERP', 'ALLOCATION',
   'org_fin_alloc_rule_mst', 'rule_code', true, ARRAY['tenant_org_id']::TEXT[], 'ALR', 'ALR', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-phase10.service.ts',
   'erp-lite-phase10.service.ts returns ALR-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT rule_code FROM org_fin_alloc_rule_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix ALR: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:ALR:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: ALR). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   450, 'migration', 'doc_seq_type_config'),
  ('ERP_ALLOC_RUN', 'Allocation run number', 'رقم دورة التوزيع', 'ERP Lite allocation run number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'ALLOCATION',
   'org_fin_alloc_run_mst', 'run_no', true, ARRAY['tenant_org_id']::TEXT[], 'APR', 'APR', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-phase10.service.ts',
   'erp-lite-phase10.service.ts returns APR-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT run_no FROM org_fin_alloc_run_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix APR: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:APR:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: APR). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   460, 'migration', 'doc_seq_type_config'),
  ('ERP_COST_COMPONENT', 'Cost component code', 'رمز عنصر التكلفة', 'ERP Lite cost component code.', 'TENANT_ORG', 'MASTER_DATA', 'ERP', 'COSTING',
   'org_fin_cost_cmp_cd', 'comp_code', true, ARRAY['tenant_org_id']::TEXT[], 'CMP', 'CMP', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-phase10.service.ts',
   'erp-lite-phase10.service.ts returns CMP-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT comp_code FROM org_fin_cost_cmp_cd WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix CMP: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:CMP:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CMP). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   470, 'migration', 'doc_seq_type_config'),
  ('ERP_COST_RUN', 'Cost run number', 'رقم دورة التكلفة', 'ERP Lite cost run number.', 'TENANT_ORG', 'TRANSACTION', 'ERP', 'COSTING',
   'org_fin_cost_run_mst', 'run_no', true, ARRAY['tenant_org_id']::TEXT[], 'CRN', 'CRN', '-', 'YYYYMM-SEQ', 5, 'MONTHLY', 'DOMAIN', 'app:web-admin/lib/services/erp-lite-phase10.service.ts',
   'erp-lite-phase10.service.ts returns CRN-YYYYMM-<COUNT+1 pad 5> (UTC month; race-prone; engine migration in P10). Check: SELECT run_no FROM org_fin_cost_run_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix CRN: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:CRN:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CRN). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   480, 'migration', 'doc_seq_type_config'),
  ('HQ_SAAS_INVOICE', 'SaaS invoice number', 'رقم فاتورة المنصة', 'HQ SaaS billing invoice number.', 'HQ', 'TRANSACTION', 'HQ_BILLING', 'SAAS_INVOICE',
   'sys_bill_invoices_mst', 'invoice_no', true, NULL, 'INV', 'HQI', '-', 'YYYY-SEQ', 6, 'NEVER', 'DOMAIN', 'public.sys_bill_generate_invoice_number()',
   'public.sys_bill_generate_invoice_number() (0041) returns INV-<CURRENT_DATE YYYY>-<nextval(seq_invoice_number) pad 6>; the global sequence starts at 1000 and never resets (YYYY is printed only). Printed INV clashes with tax invoices; HQI is the reserved type prefix. The table carries tenant_org_id (the billed tenant) but the number is platform-wide (the view only warns). Check: SELECT last_value FROM seq_invoice_number; Reserved type prefix HQI: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:HQI:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: INV). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   490, 'migration', 'doc_seq_type_config'),
  ('HQ_MARKETING_LEAD', 'Marketing lead code', 'رمز العميل المحتمل', 'HQ marketing lead code.', 'HQ', 'MASTER_DATA', 'HQ_CRM', 'LEAD',
   'hq_crm_marketing_leads', 'lead_code', true, NULL, 'CMX', 'MLD', '-', 'YYYYMMDD-SEQ', 6, 'DAILY', 'DOMAIN', 'public.hq_crm_marketing_lead_code_next()',
   'public.hq_crm_marketing_lead_code_next() (0229) takes a per-day advisory lock, bumps counter hq_crm_marketing_lead_daily_seq and returns CMX-<UTC YYYYMMDD>-<seq 6>; the first code of a day is 32. Printed CMX clashes with gift cards; MLD is the reserved type prefix. Check: SELECT * FROM hq_crm_marketing_lead_daily_seq ORDER BY 1 DESC LIMIT 3; Reserved type prefix MLD: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:MLD:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: CMX). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   500, 'migration', 'doc_seq_type_config'),
  ('STOCK_TRANSACTION', 'Stock transaction number', 'رقم حركة المخزون', 'Inventory stock movement number.', 'TENANT_ORG', 'TRANSACTION', 'INVENTORY', 'STOCK_TRX',
   'org_inv_stock_tr', 'transaction_no', true, ARRAY['tenant_org_id']::TEXT[], 'STK', 'STK', '-', 'YYYYMMDD-SEQ', 4, 'DAILY', 'DOMAIN', 'app:web-admin/lib/services/inventory-service.ts',
   'Two writers print STK-<YYYYMMDD>-<seq 4>: inventory-service.ts (lexical MAX over STK-<today>-%) and DB function deduct_retail_stock_for_order (latest body 0111) when an order deducts retail stock. Race-prone; engine migration in P10. Check: SELECT transaction_no FROM org_inv_stock_tr WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; Reserved type prefix STK: the unique 3-5 letter key of this document type, used in scan payloads (CMX1:STK:<code>), logs and screens even when the printed prefix is shared or empty (printed prefix: STK). Child codes keep their own value format; the reserved prefix is not printed inside them.',
   510, 'migration', 'doc_seq_type_config');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.sys_doc_seq_type_cd) <> 51 THEN
    RAISE EXCEPTION 'doc_seq_type_config: seed count mismatch';
  END IF;
END $$;

COMMIT;
