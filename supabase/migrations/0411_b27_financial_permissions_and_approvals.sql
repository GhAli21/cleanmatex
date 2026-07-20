-- =============================================================================
-- 0411_b27_financial_permissions_and_approvals.sql
-- B27 — Financial Permissions and Approvals (Order Fin Remediation Remediation_Work_Packages)
--
-- Context: the authoritative audit (§43) found 12 financial actions either
-- completely ungated or riding an overly-broad existing code. Re-verifying
-- against the LIVE remote DB (not just a grep of local migration files) found
-- the codebase is in better shape than the audit implied — several of the 12
-- already have a seeded, role-mapped permission code; the real remaining gaps
-- are narrower. Per item:
--   1. Price override        → pricing:override ALREADY seeded on remote
--                               (operator, super_admin, tenant_admin) — but
--                               that seed was never captured in a checked-in
--                               migration (drift: found only in a throwaway
--                               SQL snippet). This migration now backfills the
--                               permission + its original 3 role grants
--                               idempotently (no-op on remote, fixes any
--                               fresh/rebuilt DB) before ADDING the broader
--                               role set the owner requested (admin,
--                               branch_manager, cashier, receptionist,
--                               supervisor), matching orders:create.
--   2. Manual-discount        → orders:discount ALREADY seeded+broadly granted
--      threshold                (dormant/unused in code — out of scope to wire
--                               here, see B27 Completion evidence). This
--                               migration adds a NEW, not-yet-wired
--                               orders:discount_threshold_override reserved
--                               for a future amount-based threshold feature.
--   3. Manual charge          → NOT built (B18). NEW orders:manual_charge seeded
--                               as an inert placeholder.
--   4. Cash variance approval → cash_drawer:approve_variance already CHECKED in
--                               code (B16 approveSessionVariance) but never
--                               seeded — genuinely missing. Seeded here.
--   5. Wallet/gift-card       → gift_cards:adjust ALREADY covers gift cards.
--      admin adjustment         Wallet had NO code at all — NEW
--                               stored_value:issue_wallet_credit seeded (wired
--                               into topUpWallet in this same package).
--   6. Credit issue           → stored_value:issue_credit_note ALREADY seeded;
--                               the gap was the UI's server action never
--                               checking it (fixed in code, no new code needed).
--   7. Payment cancel/fail    → payments:cancel ALREADY seeded+granted. No gap.
--   8. Order reopen           → NEW orders:rebill_authorize seeded — activates
--      (REFUND_AND_REBILL)      the D003 v2 REFUND_AND_REBILL path B01 has been
--                               hardcoded-rejecting since it shipped (wired in
--                               this same package).
--   9. Post-settlement edit   → NOT built (B12). NEW orders:post_settlement_edit
--                               seeded as an inert placeholder.
--  10. Journal reversal       → erp_lite_gl:reverse ALREADY seeded+granted. No gap
--                               (the reverse() function itself doesn't exist yet —
--                               that's B13/B10's job, not a permission gap).
--  11. Backdated/closed-period→ erp_lite_periods:reopen ALREADY seeded+granted.
--      adjustment               No gap (B24 will design the actual mechanism).
--  12. Rate override         → NOT built (B26 umbrella). NEW orders:rate_override
--                               seeded as an inert placeholder.
--
-- Work package: docs/features/Order_Fin/Remediation_Work_Packages/B27_Financial_Permissions_And_Approvals.md
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. New permission codes
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('cash_drawer:approve_variance', 'Approve Cash Drawer Variance', 'اعتماد فرق صندوق النقد',
   'actions', 'Optionally approve a cash drawer session closed with a variance beyond the configured threshold (audit trail only — closing never requires it)',
   'اعتماد اختياري لجلسة صندوق نقد أُغلقت بفارق يتجاوز الحد المُهيَّأ (لأغراض التدقيق فقط — الإغلاق لا يتطلبه)',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('stored_value:issue_wallet_credit', 'Issue Wallet Credit (Admin Adjustment)', 'منح رصيد محفظة (تعديل إداري)',
   'actions', 'Manually credit a customer wallet from the back office, without a corresponding payment',
   'إضافة رصيد لمحفظة العميل يدويًا من الواجهة الإدارية دون دفعة مقابلة',
   'StoredValue', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:rebill_authorize', 'Authorize Refund-and-Rebill (Order Reopen)', 'اعتماد الاسترداد وإعادة الفوترة (إعادة فتح الطلب)',
   'actions', 'Authorize an explicit REFUND_AND_REBILL refund, which reopens the order''s outstanding balance by the refunded amount',
   'اعتماد عملية استرداد صريحة من نوع الاسترداد وإعادة الفوترة، والتي تعيد فتح الرصيد المستحق للطلب بمقدار المبلغ المسترد',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:manual_charge', 'Add Manual Order Charge', 'إضافة رسم يدوي للطلب',
   'actions', 'Add an ad-hoc charge line to an order outside the standard settlement flow',
   'إضافة بند رسم غير معتاد للطلب خارج مسار التسوية القياسي',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:post_settlement_edit', 'Edit Order After Settlement', 'تعديل الطلب بعد التسوية',
   'actions', 'Edit an order''s financial facts after it has already been settled/paid',
   'تعديل البيانات المالية للطلب بعد أن تمت تسويته أو دفعه بالكامل',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:rate_override', 'Override Rate (FX / Gateway / Tax)', 'تجاوز السعر (صرف / بوابة دفع / ضريبة)',
   'actions', 'Override a system-resolved rate (exchange rate, gateway rate, or similar) for a specific transaction',
   'تجاوز سعر يحدده النظام (سعر صرف أو سعر بوابة دفع أو ما شابه) لمعاملة محددة',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:discount_threshold_override', 'Approve Manual Discount Above Threshold', 'اعتماد خصم يدوي يتجاوز الحد المسموح',
   'actions', 'Approve a manual discount that exceeds the tenant''s configured threshold (reserved — no threshold config exists yet)',
   'اعتماد خصم يدوي يتجاوز الحد المُهيَّأ للمستأجر (محجوز — لا يوجد إعداد حدي بعد)',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status;

-- -----------------------------------------------------------------------------
-- 2. Role grants for the new codes (idempotent — NOT EXISTS guard)
-- -----------------------------------------------------------------------------

-- cash_drawer:approve_variance — supervisory/finance tier (matches reconciliation:view)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('accountant', 'admin', 'branch_manager', 'finance_manager', 'super_admin', 'tenant_admin')
  AND p.code = 'cash_drawer:approve_variance'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- stored_value:issue_wallet_credit — matches the existing stored_value:issue_advance tier exactly
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'finance_manager', 'super_admin', 'tenant_admin', 'accountant')
  AND p.code = 'stored_value:issue_wallet_credit'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- orders:rebill_authorize — matches the existing orders:refunds_manual_exception tier
-- (D003 v2 treats REFUND_AND_REBILL as similarly sensitive to MANUAL_EXCEPTION)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'receptionist', 'cashier')
  AND p.code = 'orders:rebill_authorize'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- orders:manual_charge / orders:discount_threshold_override — supervisory tier
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'branch_manager', 'finance_manager', 'super_admin', 'tenant_admin')
  AND p.code IN ('orders:manual_charge', 'orders:discount_threshold_override')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- orders:post_settlement_edit / orders:rate_override — finance-owner tier (no branch_manager)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'finance_manager', 'super_admin', 'tenant_admin')
  AND p.code IN ('orders:post_settlement_edit', 'orders:rate_override')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 3. Backfill pricing:override (drift fix — remote had it, no migration did).
--    Values copied verbatim from the live remote row. No-op wherever the
--    permission/grants already exist (remote); fixes fresh/rebuilt DBs (local).
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES (
  'pricing:override', 'Override Price', 'تجاوز السعر',
  'actions', 'Override price in new order page', 'تجاوز السعر في صفحة الطلب الجديد',
  'Pricing', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('operator', 'super_admin', 'tenant_admin')
  AND p.code = 'pricing:override'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 4. Broaden pricing:override role grants (owner directive: match orders:create's
--    full role set so nobody who could override prices loses the ability once
--    the fail-open bug in addOrderItems is fixed in this same package). Additive
--    only — the existing operator/super_admin/tenant_admin grants are untouched.
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'branch_manager', 'cashier', 'receptionist', 'supervisor', 'operator')
  AND p.code = 'pricing:override'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 5. Verify
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM public.sys_auth_permissions WHERE code IN (
    'cash_drawer:approve_variance', 'stored_value:issue_wallet_credit', 'orders:rebill_authorize',
    'orders:manual_charge', 'orders:post_settlement_edit', 'orders:rate_override',
    'orders:discount_threshold_override'
  )) = 7, 'not all 7 new B27 permission codes were seeded';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE permission_code = 'cash_drawer:approve_variance' AND role_code = 'finance_manager'
  ), 'cash_drawer:approve_variance not granted to finance_manager';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE permission_code = 'orders:rebill_authorize' AND role_code = 'tenant_admin'
  ), 'orders:rebill_authorize not granted to tenant_admin';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE permission_code = 'pricing:override' AND role_code = 'admin'
  ), 'pricing:override was not broadened to admin';

  -- Existing pre-B27 grants must survive untouched.
  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE permission_code = 'pricing:override' AND role_code = 'operator'
  ), 'pre-existing pricing:override grant for operator was lost';
END;
$$;

COMMIT;
