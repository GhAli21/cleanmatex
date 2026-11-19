-- =============================================================================
-- Migration: 0776_org_tenant_extra_config_cf.sql
-- Purpose:   Per-Organization extra configuration overrides referencing
--            sys_tenant_extra_config_cf, plus Settings navigation seed.
--            Every query/write explicitly includes tenant_org_id; RLS provides
--            defense-in-depth read isolation via (SELECT current_tenant_id()).
-- Affected:  public.org_tenant_extra_config_cf (new table),
--            public.sys_components_cd (new child row settings_extra_config).
-- Plan:      docs/features/UI_Design_System_Enhace/PLAN_PR-08.md (Task 6.2).
-- Security:  Uses existing seeded RBAC codes settings:read and settings:update
--            (0035_rbac_seed_system_data.sql) matching Settings sibling routes.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Per-Organization overrides of global extra UI/formatting defaults.
CREATE TABLE IF NOT EXISTS public.org_tenant_extra_config_cf (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id  UUID        NOT NULL,
  config_key     TEXT        NOT NULL,
  config_value   TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  CONSTRAINT pk_org_tnt_extra_cfg_cf PRIMARY KEY (id),
  CONSTRAINT uq_otec_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT fk_otec_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE RESTRICT,
  CONSTRAINT fk_otec_sys_key FOREIGN KEY (config_key)
    REFERENCES public.sys_tenant_extra_config_cf (config_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_otec_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_otec_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

-- At most one active override per (tenant_org_id, config_key).
CREATE UNIQUE INDEX IF NOT EXISTS uq_otec_tnt_key
  ON public.org_tenant_extra_config_cf (tenant_org_id, config_key)
  WHERE rec_status = 1 AND is_active;

-- Fast tenant-first config list queries and catalog impact checks.
CREATE INDEX IF NOT EXISTS idx_otec_tnt_list
  ON public.org_tenant_extra_config_cf (tenant_org_id, rec_status, config_key);
CREATE INDEX IF NOT EXISTS idx_otec_sys_key
  ON public.org_tenant_extra_config_cf (config_key);

-- Complete PostgreSQL metadata comments.
COMMENT ON TABLE  public.org_tenant_extra_config_cf IS 'Per-Organization overrides for sys_tenant_extra_config_cf formatting, table density, and POS ergonomics.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.id IS 'Override row UUID primary key.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.tenant_org_id IS 'Owning Organization UUID (explicit tenant filter required on every query).';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.config_key IS 'Foreign key to sys_tenant_extra_config_cf.config_key.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.config_value IS 'Serialized override value validated server-side against sys_tenant_extra_config_cf schema.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.created_at IS 'When the override row was created.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.created_by IS 'User or actor that created the override.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.created_info IS 'Creation context (screen, API route, migration).';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.updated_at IS 'When the override was last updated (set by trigger).';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.updated_by IS 'User or actor that last updated the override.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.updated_count IS 'Monotonic update counter (incremented by trigger).';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.deleted_at IS 'When the override was soft-deleted (reset to system default).';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.deleted_by IS 'User or actor that reset/deleted the override.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.rec_status IS 'Record status: 1 active, 0 soft-deleted, 2 archived.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.rec_order IS 'Optional custom display ordering.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.rec_notes IS 'Optional notes about the Organization override.';
COMMENT ON COLUMN public.org_tenant_extra_config_cf.is_active IS 'True when this override is currently active.';
COMMENT ON CONSTRAINT pk_org_tnt_extra_cfg_cf ON public.org_tenant_extra_config_cf IS 'Primary key on id.';
COMMENT ON CONSTRAINT uq_otec_id_tenant ON public.org_tenant_extra_config_cf IS 'Prisma-safe composite unique key matching (id, tenant_org_id) convention.';
COMMENT ON CONSTRAINT fk_otec_tenant ON public.org_tenant_extra_config_cf IS 'References org_tenants_mst(id); restricts hard deletion of Organization with overrides.';
COMMENT ON CONSTRAINT fk_otec_sys_key ON public.org_tenant_extra_config_cf IS 'Ensures config_key exists in sys_tenant_extra_config_cf catalog.';
COMMENT ON CONSTRAINT ck_otec_rec_status ON public.org_tenant_extra_config_cf IS 'Standard CleanMateX rec_status values (0, 1, 2).';
COMMENT ON CONSTRAINT ck_otec_deleted_inactive ON public.org_tenant_extra_config_cf IS 'Guarantees soft-deleted or archived overrides cannot remain is_active = true.';
COMMENT ON INDEX public.uq_otec_tnt_key IS 'At most one live active override per Organization and config_key.';
COMMENT ON INDEX public.idx_otec_tnt_list IS 'Tenant-first index covering active/historical overrides per Organization.';
COMMENT ON INDEX public.idx_otec_sys_key IS 'Supports catalog impact checks when HQ disables or inspects a key.';

-- Audit trigger.
DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_tenant_extra_config_cf;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_tenant_extra_config_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_tenant_extra_config_cf IS 'Keeps updated_at and updated_count current.';

-- Row-Level Security (scalar-wrapped current_tenant_id() evaluated once per statement)
-- and explicit grants matching 0753_org_tenant_ui_theme.sql.
ALTER TABLE public.org_tenant_extra_config_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_otec_tenant_select ON public.org_tenant_extra_config_cf;
CREATE POLICY rls_otec_tenant_select ON public.org_tenant_extra_config_cf
  FOR SELECT TO authenticated
  USING (tenant_org_id = (SELECT current_tenant_id()));
COMMENT ON POLICY rls_otec_tenant_select ON public.org_tenant_extra_config_cf IS 'Signed-in users may read overrides for their own Organization only; mutations go through server services with explicit tenant_org_id and RBAC.';

REVOKE ALL ON public.org_tenant_extra_config_cf FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.org_tenant_extra_config_cf TO authenticated;
GRANT ALL ON public.org_tenant_extra_config_cf TO service_role;

-- ─── Navigation: Settings > Display & Extra Config (dual-write with navigation.ts) ──
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, comp_path, comp_icon,
  main_permission_code, display_order, comp_level, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, permissions, feature_flag,
  badge, rec_status, created_info
) VALUES (
  'settings_extra_config',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings',
  'Display & Formatting',
  'العرض وتنسيق الأرقام',
  '/dashboard/settings/extra-config',
  'SlidersHorizontal',
  'settings:read',
  63,
  1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin"]'::jsonb,
  '["settings:read"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'Migration 0776 - Extra Tenant Configuration screen (/dashboard/settings/extra-config). Read: settings:read; save/reset: settings:update.'
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
  permissions          = EXCLUDED.permissions,
  feature_flag         = EXCLUDED.feature_flag,
  updated_at           = CURRENT_TIMESTAMP;

COMMIT;
