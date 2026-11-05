-- ================================================================
-- LABEL PRINTING CONFIG (Human-Friendly Codes P4, decisions A-46..A-49)
--
-- Replaces the earlier 0685 draft that added five sys_tenant_settings_cd
-- rows (never applied). Label printing is now configured in two typed
-- config tables and is available to every tenant: there is NO
-- `label_printing` feature-flag check anywhere (A-47).
--
--   sys_label_printing_cf  platform defaults, one row per label type
--   org_label_printing_cf  tenant overrides (branch_id NULL = tenant-wide)
--                          and branch overrides (branch_id set).
--                          Every value column is nullable: NULL = inherit.
--   fn_label_printing_resolve(tenant, branch)
--                          per column: branch -> tenant -> system.
--
-- Label types and the columns that apply to each (others must be NULL):
--   ORDER_LABEL  size_code [4x6in, 80mm, 58mm, A6], show_qr,
--                show_customer_name, copies
--   PIECE_TAG    size_code [58x30mm, 50x25mm, 80x40mm], show_qr, copies
--   RECEIPT      show_order_barcode (CODE128 of the order number)
--
-- show_order_barcode keeps one ceiling: the resolver returns it as false
-- while the `human_codes_scan_labels` flag is off for the tenant (that flag
-- also gates the scan UI). The configured value is returned separately.
--
-- Consumers:
--   lib/services/labels/label-printing-config.service.ts (resolve + admin CRUD)
--   lib/services/labels/label-data.service.ts (GET /api/v1/orders/[id]/label-data)
--   app/api/v1/settings/label-printing/route.ts (settings screen)
--   app/dashboard/settings/labels (screen), app/dashboard/ready/[id]/print/[type]
--
-- Also adds the Settings > Labels & Tags navigation row (settings_labels).
-- Idempotent: re-running keeps tenant overrides; system rows are upserted
-- only for the seed columns.
-- Created     : 2026-10-31
-- Created by  : system_admin
-- Migration   : 0685_add_settings_label_printing.sql
-- Plan        : docs/features/Human_Friendly_Codes/ (P4, T4.4, A-46..A-49)
-- ================================================================

BEGIN;

-- ================================================================
-- STEP 1: VALIDATE PREREQUISITES
-- ================================================================
DO $$
DECLARE
  v_old INTEGER;
BEGIN
  IF to_regclass('public.org_tenants_mst') IS NULL THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: org_tenants_mst missing';
  END IF;
  IF to_regclass('public.org_branches_mst') IS NULL THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: org_branches_mst missing';
  END IF;
  -- The composite branch FK needs a unique key on (id, tenant_org_id).
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.org_branches_mst'::regclass
      AND c.contype IN ('p', 'u')
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(c.conkey) k
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
          = ARRAY['id', 'tenant_org_id']
  ) THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: org_branches_mst has no unique key on (id, tenant_org_id)';
  END IF;
  IF to_regprocedure('public.current_tenant_id()') IS NULL THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: public.current_tenant_id() missing';
  END IF;
  IF to_regprocedure('public.trg_set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: public.trg_set_updated_at() missing';
  END IF;
  IF to_regclass('public.sys_components_cd') IS NULL THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: sys_components_cd missing';
  END IF;
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'LABEL_PRINTING_PRECHECK: PostgreSQL 15+ required (UNIQUE NULLS NOT DISTINCT)';
  END IF;

  -- The superseded draft of this migration used settings rows. If a copy of
  -- it was ever applied, say so; the rows are left alone (nothing reads them).
  IF to_regclass('public.sys_tenant_settings_cd') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*) FROM public.sys_tenant_settings_cd
      WHERE setting_code IN ('LABEL_ORDER_SIZE', 'LABEL_PIECE_TAG_SIZE', 'LABEL_PIECE_TAG_QR',
                             'LABEL_SHOW_CUSTOMER_NAME', 'RECEIPT_ORDER_CODE128')
    $q$ INTO v_old;
    IF v_old > 0 THEN
      RAISE NOTICE 'LABEL_PRINTING_PRECHECK: % old draft label setting(s) found in sys_tenant_settings_cd; nothing reads them now, remove separately', v_old;
    END IF;
  END IF;
END $$;

-- ================================================================
-- STEP 2: SYSTEM DEFAULTS  sys_label_printing_cf
-- ================================================================
CREATE TABLE IF NOT EXISTS public.sys_label_printing_cf (
  label_type          TEXT        NOT NULL,
  name                TEXT        NOT NULL,
  name2               TEXT,
  size_code           TEXT,
  show_qr             BOOLEAN,
  show_customer_name  BOOLEAN,
  show_order_barcode  BOOLEAN,
  copies              SMALLINT,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  rec_status          SMALLINT    NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  updated_count       INTEGER     DEFAULT 0,
  CONSTRAINT pk_sys_label_printing_cf PRIMARY KEY (label_type),
  CONSTRAINT chk_sys_lblp_type CHECK (label_type IN ('ORDER_LABEL', 'PIECE_TAG', 'RECEIPT')),
  CONSTRAINT chk_sys_lblp_copies CHECK (copies IS NULL OR copies BETWEEN 1 AND 10),
  -- Defaults must be complete for the columns that apply to the type, NULL for the rest.
  CONSTRAINT chk_sys_lblp_shape CHECK (
    (label_type = 'ORDER_LABEL'
       AND size_code IN ('4x6in', '80mm', '58mm', 'A6')
       AND show_qr IS NOT NULL AND show_customer_name IS NOT NULL AND copies IS NOT NULL
       AND show_order_barcode IS NULL)
    OR (label_type = 'PIECE_TAG'
       AND size_code IN ('58x30mm', '50x25mm', '80x40mm')
       AND show_qr IS NOT NULL AND copies IS NOT NULL
       AND show_customer_name IS NULL AND show_order_barcode IS NULL)
    OR (label_type = 'RECEIPT'
       AND show_order_barcode IS NOT NULL
       AND size_code IS NULL AND show_qr IS NULL AND show_customer_name IS NULL AND copies IS NULL)
  )
);

COMMENT ON TABLE  public.sys_label_printing_cf IS 'Platform default label-printing options, one row per label type (HFC P4, A-46). Tenants override in org_label_printing_cf.';
COMMENT ON COLUMN public.sys_label_printing_cf.label_type IS 'ORDER_LABEL | PIECE_TAG | RECEIPT.';
COMMENT ON COLUMN public.sys_label_printing_cf.name IS 'Display name (EN).';
COMMENT ON COLUMN public.sys_label_printing_cf.name2 IS 'Display name (AR).';
COMMENT ON COLUMN public.sys_label_printing_cf.size_code IS 'Paper size. ORDER_LABEL: 4x6in/80mm/58mm/A6; PIECE_TAG: 58x30mm/50x25mm/80x40mm; RECEIPT: NULL.';
COMMENT ON COLUMN public.sys_label_printing_cf.show_qr IS 'Print the QR code (ORDER_LABEL, PIECE_TAG).';
COMMENT ON COLUMN public.sys_label_printing_cf.show_customer_name IS 'Print the short customer name (ORDER_LABEL only).';
COMMENT ON COLUMN public.sys_label_printing_cf.show_order_barcode IS 'Print a CODE128 barcode of the order number (RECEIPT only). Capped by the human_codes_scan_labels flag.';
COMMENT ON COLUMN public.sys_label_printing_cf.copies IS 'Copies per print, 1-10 (ORDER_LABEL: per order; PIECE_TAG: per piece).';
COMMENT ON COLUMN public.sys_label_printing_cf.is_active IS 'Soft-disable flag.';
COMMENT ON COLUMN public.sys_label_printing_cf.rec_status IS '1 = active record.';
COMMENT ON COLUMN public.sys_label_printing_cf.rec_order IS 'Display order.';
COMMENT ON COLUMN public.sys_label_printing_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.sys_label_printing_cf.created_at IS 'Created timestamp.';
COMMENT ON COLUMN public.sys_label_printing_cf.created_by IS 'Created by (user id or system).';
COMMENT ON COLUMN public.sys_label_printing_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_label_printing_cf.updated_at IS 'Last update timestamp (trigger).';
COMMENT ON COLUMN public.sys_label_printing_cf.updated_by IS 'Updated by.';
COMMENT ON COLUMN public.sys_label_printing_cf.updated_info IS 'Update context.';
COMMENT ON COLUMN public.sys_label_printing_cf.updated_count IS 'Number of updates (trigger).';

-- Seed. ON CONFLICT keeps an HQ-edited default (only names/order are refreshed).
INSERT INTO public.sys_label_printing_cf
  (label_type, name, name2, size_code, show_qr, show_customer_name, show_order_barcode, copies, rec_order, created_by, created_info)
VALUES
  ('ORDER_LABEL', 'Order label', 'ملصق الطلب',     '4x6in',   true,  true, NULL, 1,    1, 'system_admin', 'migration 0685'),
  ('PIECE_TAG',   'Piece tag',   'بطاقة القطعة',   '58x30mm', false, NULL, NULL, 1,    2, 'system_admin', 'migration 0685'),
  ('RECEIPT',     'Receipt',     'الإيصال',        NULL,      NULL,  NULL, true, NULL, 3, 'system_admin', 'migration 0685')
ON CONFLICT (label_type) DO UPDATE
  SET name = EXCLUDED.name, name2 = EXCLUDED.name2, rec_order = EXCLUDED.rec_order;

-- ================================================================
-- STEP 3: TENANT / BRANCH OVERRIDES  org_label_printing_cf
-- ================================================================
CREATE TABLE IF NOT EXISTS public.org_label_printing_cf (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id       UUID        NOT NULL,
  label_type          TEXT        NOT NULL,
  branch_id           UUID,
  size_code           TEXT,
  show_qr             BOOLEAN,
  show_customer_name  BOOLEAN,
  show_order_barcode  BOOLEAN,
  copies              SMALLINT,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  rec_status          SMALLINT    NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  updated_count       INTEGER     DEFAULT 0,
  CONSTRAINT pk_org_label_printing_cf PRIMARY KEY (id),
  CONSTRAINT fk_org_lblp_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_lblp_type FOREIGN KEY (label_type)
    REFERENCES public.sys_label_printing_cf(label_type),
  -- CASCADE (not SET NULL): nulling branch_id would collide with the tenant-wide row.
  CONSTRAINT fk_org_lblp_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT uq_org_lblp_scope UNIQUE NULLS NOT DISTINCT (tenant_org_id, label_type, branch_id),
  CONSTRAINT chk_org_lblp_copies CHECK (copies IS NULL OR copies BETWEEN 1 AND 10),
  -- Overrides may leave any column NULL (inherit) but may not set a column that does not apply.
  CONSTRAINT chk_org_lblp_shape CHECK (
    (label_type = 'ORDER_LABEL'
       AND (size_code IS NULL OR size_code IN ('4x6in', '80mm', '58mm', 'A6'))
       AND show_order_barcode IS NULL)
    OR (label_type = 'PIECE_TAG'
       AND (size_code IS NULL OR size_code IN ('58x30mm', '50x25mm', '80x40mm'))
       AND show_customer_name IS NULL AND show_order_barcode IS NULL)
    OR (label_type = 'RECEIPT'
       AND size_code IS NULL AND show_qr IS NULL AND show_customer_name IS NULL AND copies IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_org_lblp_tenant_branch
  ON public.org_label_printing_cf (tenant_org_id, branch_id);

COMMENT ON TABLE  public.org_label_printing_cf IS 'Tenant (branch_id NULL) and branch overrides of sys_label_printing_cf. NULL value columns inherit (branch -> tenant -> system). HFC P4, A-46.';
COMMENT ON COLUMN public.org_label_printing_cf.id IS 'Primary key.';
COMMENT ON COLUMN public.org_label_printing_cf.tenant_org_id IS 'Owning tenant (RLS key).';
COMMENT ON COLUMN public.org_label_printing_cf.label_type IS 'ORDER_LABEL | PIECE_TAG | RECEIPT (FK sys_label_printing_cf).';
COMMENT ON COLUMN public.org_label_printing_cf.branch_id IS 'NULL = tenant-wide override; set = override for that branch only.';
COMMENT ON COLUMN public.org_label_printing_cf.size_code IS 'Paper size override; NULL = inherit.';
COMMENT ON COLUMN public.org_label_printing_cf.show_qr IS 'QR override; NULL = inherit.';
COMMENT ON COLUMN public.org_label_printing_cf.show_customer_name IS 'Customer-name override (ORDER_LABEL); NULL = inherit.';
COMMENT ON COLUMN public.org_label_printing_cf.show_order_barcode IS 'Receipt barcode override (RECEIPT); NULL = inherit. Still capped by human_codes_scan_labels.';
COMMENT ON COLUMN public.org_label_printing_cf.copies IS 'Copies override 1-10; NULL = inherit.';
COMMENT ON COLUMN public.org_label_printing_cf.is_active IS 'Inactive rows are ignored by the resolver.';
COMMENT ON COLUMN public.org_label_printing_cf.rec_status IS '1 = active record.';
COMMENT ON COLUMN public.org_label_printing_cf.rec_order IS 'Display order.';
COMMENT ON COLUMN public.org_label_printing_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.org_label_printing_cf.created_at IS 'Created timestamp.';
COMMENT ON COLUMN public.org_label_printing_cf.created_by IS 'Created by (user id).';
COMMENT ON COLUMN public.org_label_printing_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN public.org_label_printing_cf.updated_at IS 'Last update timestamp (trigger).';
COMMENT ON COLUMN public.org_label_printing_cf.updated_by IS 'Updated by (user id).';
COMMENT ON COLUMN public.org_label_printing_cf.updated_info IS 'Update context.';
COMMENT ON COLUMN public.org_label_printing_cf.updated_count IS 'Number of updates (trigger).';

-- ================================================================
-- STEP 4: AUDIT TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_label_printing_cf_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_count := COALESCE(OLD.updated_count, 0) + 1;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_label_printing_cf_touch() IS 'BEFORE UPDATE: sets updated_at and increments updated_count on the label-printing config tables.';

DROP TRIGGER IF EXISTS trg_sys_label_printing_cf_touch ON public.sys_label_printing_cf;
CREATE TRIGGER trg_sys_label_printing_cf_touch
  BEFORE UPDATE ON public.sys_label_printing_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_label_printing_cf_touch();

DROP TRIGGER IF EXISTS trg_org_label_printing_cf_touch ON public.org_label_printing_cf;
CREATE TRIGGER trg_org_label_printing_cf_touch
  BEFORE UPDATE ON public.org_label_printing_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_label_printing_cf_touch();

-- ================================================================
-- STEP 5: RLS + GRANTS
-- ================================================================
ALTER TABLE public.sys_label_printing_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_sys_label_printing_cf_read ON public.sys_label_printing_cf;
CREATE POLICY pol_sys_label_printing_cf_read ON public.sys_label_printing_cf
  FOR SELECT TO authenticated
  USING (is_active AND rec_status = 1);

REVOKE ALL ON public.sys_label_printing_cf FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sys_label_printing_cf FROM authenticated;
GRANT SELECT ON public.sys_label_printing_cf TO authenticated;
GRANT ALL ON public.sys_label_printing_cf TO service_role;

ALTER TABLE public.org_label_printing_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_org_label_printing_cf_tenant ON public.org_label_printing_cf;
CREATE POLICY pol_org_label_printing_cf_tenant ON public.org_label_printing_cf
  FOR ALL TO authenticated
  USING (tenant_org_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_org_id = (SELECT public.current_tenant_id()));

REVOKE ALL ON public.org_label_printing_cf FROM PUBLIC, anon;
REVOKE TRUNCATE ON public.org_label_printing_cf FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_label_printing_cf TO authenticated;
GRANT ALL ON public.org_label_printing_cf TO service_role;

-- ================================================================
-- STEP 6: RESOLVER  fn_label_printing_resolve(tenant, branch)
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_label_printing_resolve(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  label_type                    TEXT,
  size_code                     TEXT,
  show_qr                       BOOLEAN,
  show_customer_name            BOOLEAN,
  show_order_barcode            BOOLEAN,
  copies                        SMALLINT,
  show_order_barcode_configured BOOLEAN,
  value_sources                 JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_role      TEXT;
  v_scan_flag BOOLEAN := false;
  v_flag      JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'LABEL_PRINTING_TENANT_REQUIRED' USING ERRCODE = '22004';
  END IF;

  v_role := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  IF v_role = 'authenticated' THEN
    IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
      RAISE EXCEPTION 'LABEL_PRINTING_TENANT_MISMATCH' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role NOT IN ('', 'service_role') THEN
    RAISE EXCEPTION 'LABEL_PRINTING_ROLE_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  -- Receipt-barcode ceiling. Any failure (function missing, bad value) = off.
  BEGIN
    SELECT f.value INTO v_flag
    FROM public.hq_ff_get_effective_value(p_tenant_id, 'human_codes_scan_labels') f
    LIMIT 1;
    v_scan_flag := v_flag IS NOT NULL
      AND v_flag::text NOT IN ('false', '0', '""', 'null');
  EXCEPTION WHEN OTHERS THEN
    v_scan_flag := false;
  END;

  RETURN QUERY
  SELECT
    s.label_type,
    COALESCE(b.size_code, t.size_code, s.size_code),
    COALESCE(b.show_qr, t.show_qr, s.show_qr),
    COALESCE(b.show_customer_name, t.show_customer_name, s.show_customer_name),
    CASE WHEN s.label_type = 'RECEIPT'
         THEN v_scan_flag AND COALESCE(b.show_order_barcode, t.show_order_barcode, s.show_order_barcode, false)
    END,
    COALESCE(b.copies, t.copies, s.copies),
    COALESCE(b.show_order_barcode, t.show_order_barcode, s.show_order_barcode),
    jsonb_strip_nulls(jsonb_build_object(
      'size_code', CASE WHEN s.size_code IS NULL THEN NULL
                        WHEN b.size_code IS NOT NULL THEN 'BRANCH'
                        WHEN t.size_code IS NOT NULL THEN 'TENANT' ELSE 'SYSTEM' END,
      'show_qr', CASE WHEN s.show_qr IS NULL THEN NULL
                      WHEN b.show_qr IS NOT NULL THEN 'BRANCH'
                      WHEN t.show_qr IS NOT NULL THEN 'TENANT' ELSE 'SYSTEM' END,
      'show_customer_name', CASE WHEN s.show_customer_name IS NULL THEN NULL
                                 WHEN b.show_customer_name IS NOT NULL THEN 'BRANCH'
                                 WHEN t.show_customer_name IS NOT NULL THEN 'TENANT' ELSE 'SYSTEM' END,
      'show_order_barcode', CASE WHEN s.label_type <> 'RECEIPT' THEN NULL
                                 WHEN NOT v_scan_flag THEN 'FEATURE_FLAG'
                                 WHEN b.show_order_barcode IS NOT NULL THEN 'BRANCH'
                                 WHEN t.show_order_barcode IS NOT NULL THEN 'TENANT' ELSE 'SYSTEM' END,
      'copies', CASE WHEN s.copies IS NULL THEN NULL
                     WHEN b.copies IS NOT NULL THEN 'BRANCH'
                     WHEN t.copies IS NOT NULL THEN 'TENANT' ELSE 'SYSTEM' END
    ))
  FROM public.sys_label_printing_cf s
  LEFT JOIN public.org_label_printing_cf t
    ON t.tenant_org_id = p_tenant_id AND t.label_type = s.label_type
   AND t.branch_id IS NULL AND t.is_active AND t.rec_status = 1
  LEFT JOIN public.org_label_printing_cf b
    ON p_branch_id IS NOT NULL
   AND b.tenant_org_id = p_tenant_id AND b.label_type = s.label_type
   AND b.branch_id = p_branch_id AND b.is_active AND b.rec_status = 1
  WHERE s.is_active AND s.rec_status = 1
  ORDER BY s.rec_order NULLS LAST, s.label_type;
END;
$$;

COMMENT ON FUNCTION public.fn_label_printing_resolve(UUID, UUID) IS
  'Effective label-printing options per label type for a tenant and optional branch: per column branch -> tenant -> system. RECEIPT show_order_barcode is false while the human_codes_scan_labels flag is off (configured value in show_order_barcode_configured). value_sources names the level that supplied each value. HFC P4, A-46.';

REVOKE ALL ON FUNCTION public.fn_label_printing_resolve(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_label_printing_resolve(UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_label_printing_cf_touch() FROM PUBLIC, anon;

-- ================================================================
-- STEP 7: NAVIGATION  Settings > Labels & Tags (CLAUDE.md rule 10)
-- ================================================================
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, comp_path, comp_icon,
  main_permission_code, display_order, comp_level, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, permissions, feature_flag,
  badge, rec_status, created_info
) VALUES (
  'settings_labels',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings', 'Labels & Tags', 'الملصقات والبطاقات',
  '/dashboard/settings/labels', 'Tag',
  'settings:read', 62, 1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  NULL, 1,
  'Migration 0685 - label printing options (order label, piece tag, receipt). Read: settings:read; save: settings:update. No feature flag.'
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  comp_level           = EXCLUDED.comp_level,
  is_leaf              = TRUE,
  is_navigable         = TRUE,
  is_active            = TRUE,
  roles                = EXCLUDED.roles,
  feature_flag         = EXCLUDED.feature_flag,
  updated_at           = CURRENT_TIMESTAMP;

COMMIT;
