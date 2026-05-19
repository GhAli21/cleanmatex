-- ==================================================================
-- Migration: 0306_internal_fin_route_paths.sql
-- Purpose:   Align Internal Finance navigation component paths with
--            the renamed web-admin route folder `app/dashboard/internal_fin`.
-- Project:   cleanmatex
-- Notes:
--   - DUAL-WRITE counterpart to `web-admin/config/navigation.ts`.
--   - Updates `sys_components_cd.comp_path` only; labels, roles, and permissions
--     remain unchanged in this migration.
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

UPDATE public.sys_components_cd
SET
  comp_path = CASE comp_code
    WHEN 'billing' THEN '/dashboard/internal_fin'
    WHEN 'billing_invoices' THEN '/dashboard/internal_fin/invoices'
    WHEN 'billing_vouchers' THEN '/dashboard/internal_fin/vouchers'
    WHEN 'billing_payments' THEN '/dashboard/internal_fin/payments'
    WHEN 'billing_cashup' THEN '/dashboard/internal_fin/cashup'
    WHEN 'billing_cash_drawers' THEN '/dashboard/internal_fin/cash-drawers'
    WHEN 'billing_refunds' THEN '/dashboard/internal_fin/refunds'
    WHEN 'billing_reconciliation' THEN '/dashboard/internal_fin/reconciliation'
    WHEN 'finance_vouchers' THEN '/dashboard/internal_fin/vouchers'
    WHEN 'finance_vouchers_new' THEN '/dashboard/internal_fin/vouchers/new'
    WHEN 'finance_vouchers_reports' THEN '/dashboard/internal_fin/vouchers/reports'
    ELSE comp_path
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE comp_code IN (
  'billing',
  'billing_invoices',
  'billing_vouchers',
  'billing_payments',
  'billing_cashup',
  'billing_cash_drawers',
  'billing_refunds',
  'billing_reconciliation',
  'finance_vouchers',
  'finance_vouchers_new',
  'finance_vouchers_reports'
);

COMMIT;
