-- ==================================================================
-- Migration: 0276_nav_rename_billing_to_internal_finance.sql
-- Purpose:   Rename 'billing' navigation section from
--            "Invoices & Payments" to "Internal Finance Operations"
-- Project:   cleanmatex
-- Notes:
--   - Label-only rename. Children, roles, paths, permissions unchanged.
--   - Mirrors the label change in web-admin/config/navigation.ts.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

UPDATE public.sys_components_cd
SET
  label        = 'Internal Finance Operations',
  label2       = 'العمليات المالية الداخلية',
  description  = 'Internal finance operations section',
  description2 = 'قسم العمليات المالية الداخلية',
  updated_at   = CURRENT_TIMESTAMP
WHERE comp_code = 'billing';

COMMIT;
