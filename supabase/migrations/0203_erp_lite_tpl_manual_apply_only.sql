-- ==================================================================
-- Migration: 0203_erp_lite_tpl_manual_apply_only.sql
-- Purpose: Remove automatic ERP-Lite template materialization from
--          tenant creation and enforce explicit HQ-driven provisioning
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Keeps template resolution and apply functions available
--   - Drops the org_tenants_mst after-insert trigger path
--   - Makes the operational model explicit: HQ must validate and apply
--     templates from cleanmatexsaas, not from tenant creation side effects
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_seed_fin_tpl_tnt ON public.org_tenants_mst;

DROP FUNCTION IF EXISTS public.fn_seed_fin_tpl_tnt();

COMMENT ON FUNCTION public.resolve_fin_tpl_for_tnt(UUID) IS
  'Resolve the effective published ERP-Lite template package for a tenant using explicit assignment, sys_main_business_type_cd, and fallback rules. This function is resolution-only and does not perform automatic provisioning.';

COMMENT ON FUNCTION public.apply_fin_tpl_for_tnt(UUID, UUID, VARCHAR) IS
  'Explicit HQ-invoked ERP-Lite template materialization function. It must be called from approved provisioning flows and must never run automatically from org_tenants_mst insert events.';

COMMIT;
