-- ==================================================================
-- Migration: 0384_nav_fin_reconciliation_reports.sql
-- Purpose : D-09 — register the new "Reconciliation" reports screen in the
--           navigation tree (sys_components_cd) under the existing "reports"
--           parent. Frontend dual-write counterpart: web-admin/config/
--           navigation.ts (child key `reports_reconciliation`).
--
--           Route: /dashboard/reports/reconciliation — four read-only
--           reconciliation reports (unallocated excess / customer stored-value
--           liability, B2B statement payment, overpayment disposition, cash
--           drawer movement).
--
-- Permission: REUSES the existing `finance_reports:view` permission (seeded by
--           0295_financial_navigation). Per the D-09 access decision (2026-06-20)
--           reconciliation reports are gated by the same permission as the other
--           financial reports — so this migration seeds NO new permission and NO
--           role-default rows. Nav entry only.
--
-- Safety  : additive, idempotent (ON CONFLICT DO UPDATE). No data change, no
--           destructive SQL. Mirrors 0295's `reports_financial` row shape.
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

-- ── reports → Reconciliation ─────────────────────────────────────────────────
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'reports_reconciliation', 'reports',
  'Reconciliation', 'التسوية',
  'Reconciliation reports: unallocated excess, B2B statements, overpayment dispositions, and cash drawer movements',
  'تقارير التسوية: الفائض غير المخصص وكشوفات الشركات وتسويات المدفوعات الزائدة وحركات صندوق النقد',
  '/dashboard/reports/reconciliation', 'Scale',
  1, 51,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","viewer"]'::jsonb,
  'finance_reports:view', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- Resolve parent_comp_id for the new child from its parent_comp_code.
UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'reports_reconciliation'
  AND c.parent_comp_code = 'reports'
  AND p.comp_code = 'reports'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- Ensure the parent is flagged as a node (it already has children, but keep
-- the invariant explicit and idempotent).
UPDATE public.sys_components_cd
SET is_leaf = false
WHERE comp_code = 'reports';

COMMIT;

-- ------------------------------------------------------------------
-- Rollback (RESTRICT only — no CASCADE):
--   BEGIN;
--     DELETE FROM public.sys_components_cd WHERE comp_code = 'reports_reconciliation';
--   COMMIT;
-- ==================================================================