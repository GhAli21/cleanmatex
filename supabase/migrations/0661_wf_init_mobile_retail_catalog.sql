-- =============================================================================
-- 0661_wf_init_mobile_retail_catalog.sql
--
-- Purpose: register the Initial-rule catalog code INIT_MOBILE_RETAIL so HQ (the
-- SaaS Backoffice) can add it to workflow profile versions.
--
-- Owner rule (2026-10-30): a retail-only order from the customer mobile app may
-- be paid later (PAY_ON_COLLECTION). It must start as `ready`, never handed
-- over (`delivered` / `closed`), so the pickup and delivery collection gates hold
-- it until the balance is collected. Counter retail (POS, staff, kiosk) keeps
-- starting `delivered` and is paid at the counter.
--
-- Today no live profile has a customer-app retail rule, so such an order falls to
-- INIT_DEFAULT (`intake`). The tenant app refuses any profile that would start an
-- unpaid retail order handed over (RETAIL_PAY_LATER_STARTS_HANDED_OVER).
--
-- Scope: catalog row only. Published profile versions are immutable
-- (sys_wf_prof_cfg_guard); HQ adds this rule to a new draft version of each
-- profile (create preset RETAIL_SOLD) and publishes it.
-- =============================================================================

BEGIN;

-- Customer-app retail → ready. Priority 35 sits before the other customer-app
-- rules (40–57); those are all is_retail = false, so the order only matters for
-- readability. The catalog references existing codes: `customer_mobile_app` in
-- sys_order_sources_cd, `ready` in sys_wf_statuses_cd (FK).
INSERT INTO public.sys_wf_initial_rules_cd (
  rule_code, order_source_code, order_type_id, is_retail, initial_status,
  priority, name, name2, is_active
) VALUES (
  'INIT_MOBILE_RETAIL',
  'customer_mobile_app',
  NULL,
  true,
  'ready',
  35,
  'Customer mobile retail → ready (paid on collection)',
  'تطبيق العميل تجزئة → جاهز (الدفع عند الاستلام)',
  true
)
ON CONFLICT (rule_code) DO UPDATE SET
  order_source_code = EXCLUDED.order_source_code,
  order_type_id = EXCLUDED.order_type_id,
  is_retail = EXCLUDED.is_retail,
  initial_status = EXCLUDED.initial_status,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = EXCLUDED.is_active;

COMMIT;
