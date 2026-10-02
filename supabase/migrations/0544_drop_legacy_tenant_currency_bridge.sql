-- Migration 0544: drop the legacy org_tenants_mst.currency -> org_currency_cf
-- bridge trigger (fn_tenant_ccy_to_orgcur / trg_tenant_ccy_to_orgcur),
-- created in 0532 with its own comment: "Remove once no legacy writer
-- remains." Follow-up to the Currency Setup & FX program closure
-- (cleanmatexsaas implementation_plan_04_hq_fx.md §10.4 / cleanmatex
-- Tenant_Currency_FX implementation_plan_01.md §0.4), per owner go-ahead.
--
-- Audit performed before writing this migration (2026-10-02), grepping both
-- repos' application code (not docs/types) for any write to
-- org_tenants_mst.currency:
--   - platform-api TenantsService.create() sets `currency` on the initial
--     org_tenants_mst INSERT, then immediately calls
--     TenantCurrencyProvisioningService.createBaseCurrency() (idempotent
--     upsert) to create the org_currency_cf row explicitly. This is the only
--     writer, and it no longer depends on the bridge: the explicit call
--     covers the same job the trigger used to do opportunistically.
--   - TenantsService.update() changes currency via changeBaseCurrency()
--     (writes org_currency_cf; the forward mirror trg_orgcur_sync_tenant_ccy
--     propagates to org_tenants_mst.currency) — never writes
--     org_tenants_mst.currency directly.
--   - No other service, script, or migration in either repo updates
--     org_tenants_mst.currency directly.
--
-- KEPT: fn_orgcur_mirror_tenant / trg_orgcur_sync_tenant_ccy (the forward
-- mirror, org_currency_cf -> org_tenants_mst.currency) — org_tenants_mst.
-- currency itself is kept per the plan, this only drops the reverse bridge.
-- KEPT: fn_orgcur_base_lock / trg_orgcur_base_lock (C6 base-currency lock).
--
-- Reversible by re-running the CREATE FUNCTION/TRIGGER block from 0532 if
-- ever needed; not expected.

BEGIN;

DROP TRIGGER IF EXISTS trg_tenant_ccy_to_orgcur ON public.org_tenants_mst;
DROP FUNCTION IF EXISTS public.fn_tenant_ccy_to_orgcur() RESTRICT;

COMMIT;
