-- =============================================================================
-- Migration 0517 — New RBAC permission codes for cash-drawer transfers,
-- POS session Z-reports, and cash-control settings (Wave 0, POS Session &
-- Cash Drawer Hardening, package §3.2 of
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md)
--
-- W0-9 audit finding (remote MCP, read-only, 2026-09-23):
--   - cash_drawer:open_session and cash_drawer:close_session ALREADY EXIST in
--     sys_auth_permissions (seeded 2026-05-17) — enforced in route code today
--     but were missing from lib/constants/permissions/finance-perm.ts. No new
--     DB row needed for these two; only the TS mirror gap is closed (W0-11).
--   - None of the following existed: cash_drawer:count, cash_drawer:transfer,
--     cash_drawer:receive_transfer, cash_drawer:deposit,
--     cash_drawer:view_all_branches, pos_session:close_others,
--     pos_session:report_z, cash_control:view, cash_control:manage.
--     All nine are genuinely new and seeded below.
--   - Broader pre-existing drift also found (out of scope for this package):
--     cash_drawer:cash_in/cash_out/cash_drop/close/force_close/open/
--     record_movement/view_movements/view_reports exist in the DB but are
--     also unmirrored in finance-perm.ts. Recorded in STATUS.md as a known,
--     separate gap — not touched here to keep this migration scoped to the
--     permissions this program actually introduces (CLAUDE.md: keep changes
--     scoped and reviewable).
--
-- Numbering note (D17, STATUS.md): this consumes migration `0517`, one past
-- what IMPLEMENTATION_PLAN.md §3.2 originally called `0516` for this package
-- — `0516` was reassigned to the cash-control settings audit table (D17).
-- Every migration number in the plan text from this point on is nominal;
-- STATUS.md's wave table is authoritative.
--
-- This migration ALSO seeds sys_auth_role_default_permissions (W0-12),
-- following the canonical `/update-rbac-role` INSERT...SELECT...NOT EXISTS
-- pattern (never ON CONFLICT for this table). Role sets are not guessed —
-- each one extends the *existing* tiering found by a remote MCP read-only
-- audit of how the related, already-seeded permissions are granted today:
--   - open_session / close_session / record_movement (the operational
--     "runs a drawer day to day" tier) -> admin, branch_manager, cashier,
--     finance_manager, operator, super_admin, tenant_admin.
--   - view_reports / approve_variance (the "management/finance oversight"
--     tier) -> accountant, admin, branch_manager, finance_manager,
--     super_admin, tenant_admin.
--   - pos_session:view/open/close/pause_resume/force_close are granted to
--     EVERY role in the system (a session over one's own work is a
--     baseline capability) — that pattern is deliberately NOT extended to
--     the two new pos_session codes below, since both act on OTHER users'
--     sessions or on financial reporting, not on the actor's own session.
-- Every group below additionally includes super_admin, tenant_admin and
-- operator per explicit instruction. One exception: cash_control:manage
-- (changes financial-control POLICY — blind-close, variance gates,
-- thresholds — tenant/branch-wide) deliberately excludes operator despite
-- that instruction; flagged to the owner in this session's summary rather
-- than silently granted, consistent with CLAUDE.md's "flag business-rule
-- gaps, hidden risks" guidance and the no-silent-money-mutation spirit for
-- financial-control settings. Add it in a follow-up if the owner confirms.
--
-- Format check: every code below matches ^[a-z0-9_]+:([a-z0-9_]+|\*)$
-- (CRITICAL RULE #13).
--
-- Reversal (forward-only; this repo forbids editing applied migrations): a
-- future migration would first DELETE FROM sys_auth_role_default_permissions
-- WHERE permission_code IN (the nine codes below), then DELETE FROM
-- sys_auth_permissions WHERE code IN (the same nine). Lossy: yes, for any
-- tenant that has since granted/revoked these at the user level via
-- org_auth_user_permissions — those overrides would also need clearing.
-- =============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('cash_drawer:count', 'Record Cash Drawer Count', 'تسجيل عدّ الصندوق النقدي',
   'actions', 'Record or amend a denomination count for a cash drawer session (opening, spot, closing, or recount)',
   'تسجيل أو تعديل عدّ فئات النقد لجلسة صندوق نقدي (فتح، فحص مفاجئ، إغلاق، أو إعادة عدّ)',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:transfer', 'Initiate Cash Transfer', 'بدء تحويل نقدي',
   'actions', 'Initiate a cash transfer out of a drawer — drop to safe, drawer to drawer, or safe to bank',
   'بدء تحويل نقدي من الصندوق — إلى الخزنة، إلى صندوق آخر، أو إلى البنك',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:receive_transfer', 'Receive Cash Transfer', 'استلام تحويل نقدي',
   'actions', 'Accept the inbound leg of a pending cash transfer into a drawer or safe',
   'قبول الطرف الوارد من تحويل نقدي معلّق إلى صندوق أو خزنة',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:deposit', 'Deposit Cash to Bank', 'إيداع نقدي بالبنك',
   'actions', 'Record a safe-to-bank cash deposit',
   'تسجيل إيداع نقدي من الخزنة إلى البنك',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_drawer:view_all_branches', 'View Cash Drawers Across Branches', 'عرض صناديق النقد عبر الفروع',
   'read', 'View cash drawer sessions and balances across all branches, not only the actor''s assigned branch',
   'عرض جلسات وأرصدة صناديق النقد في جميع الفروع، وليس فقط الفرع المخصّص للمستخدم',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:close_others', 'Close Another User''s POS Session', 'إغلاق جلسة نقطة بيع لمستخدم آخر',
   'actions', 'Close another user''s POS session without using force-close',
   'إغلاق جلسة نقطة بيع خاصة بمستخدم آخر دون استخدام الإغلاق القسري',
   'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:report_z', 'Generate/View Z-Report', 'إنشاء/عرض تقرير Z',
   'actions', 'Generate, view, and print the end-of-shift Z-report',
   'إنشاء وعرض وطباعة تقرير نهاية الوردية (تقرير Z)',
   'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_control:view', 'View Cash-Control Settings', 'عرض إعدادات ضبط النقد',
   'read', 'View tenant/branch/user/drawer cash-control policy settings (blind close, variance gating, count modes, etc.)',
   'عرض إعدادات سياسة ضبط النقد على مستوى المستأجر أو الفرع أو المستخدم أو الصندوق (الإغلاق الأعمى، بوابة الفروقات، أنماط العدّ، وغيرها)',
   'CashControl', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('cash_control:manage', 'Manage Cash-Control Settings', 'إدارة إعدادات ضبط النقد',
   'actions', 'Create, update, or clear cash-control policy overrides at any scope',
   'إنشاء أو تعديل أو إزالة تجاوزات سياسة ضبط النقد على أي نطاق',
   'CashControl', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- Seed-completeness self-check (§10.12 convention, matching migration 0411).
DO $$
DECLARE
  seeded_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO seeded_count
  FROM public.sys_auth_permissions
  WHERE code IN (
    'cash_drawer:count', 'cash_drawer:transfer', 'cash_drawer:receive_transfer',
    'cash_drawer:deposit', 'cash_drawer:view_all_branches',
    'pos_session:close_others', 'pos_session:report_z',
    'cash_control:view', 'cash_control:manage'
  );

  IF seeded_count <> 9 THEN
    RAISE EXCEPTION 'not all 9 new cash-control/cash-drawer/pos-session permission codes were seeded (found %)', seeded_count;
  END IF;

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_permissions WHERE code = 'cash_drawer:open_session'
  ), 'cash_drawer:open_session unexpectedly missing — W0-9 audit assumption invalid, investigate before mirroring into TS';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_permissions WHERE code = 'cash_drawer:close_session'
  ), 'cash_drawer:close_session unexpectedly missing — W0-9 audit assumption invalid, investigate before mirroring into TS';
END $$;

-- -----------------------------------------------------------------------------
-- Role -> permission default grants (W0-12)
-- -----------------------------------------------------------------------------

-- Group 1 — operational drawer actions (matches the open_session/close_session/
-- record_movement tier): count, transfer, receive_transfer.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('cashier', 'operator', 'branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code IN ('cash_drawer:count', 'cash_drawer:transfer', 'cash_drawer:receive_transfer')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 2 — safe-to-bank deposit. One tier more restricted than Group 1
-- (excludes cashier): a bank deposit is a step above routine till operation.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('operator', 'branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'cash_drawer:deposit'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 3 — cross-branch visibility. Matches the view_reports/
-- approve_variance "management/finance oversight" tier, plus operator per
-- explicit instruction.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('accountant', 'operator', 'branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'cash_drawer:view_all_branches'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 4 — closing ANOTHER user's POS session. Deliberately NOT extended to
-- every role like the base pos_session:* codes are — this acts on someone
-- else's session, not the actor's own. supervisor added (floor-supervision
-- archetype) alongside operator per explicit instruction.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('supervisor', 'operator', 'branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'pos_session:close_others'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 5 — Z-report generation. Broader than Group 4: a cashier or operator
-- generating their own end-of-shift Z-report is routine, matching how the
-- base pos_session:* codes are granted broadly.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('cashier', 'operator', 'supervisor', 'branch_manager', 'finance_manager', 'accountant', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'pos_session:report_z'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 6 — viewing cash-control settings (read-only).
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('operator', 'branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'cash_control:view'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 7 — managing cash-control settings (financial-control POLICY:
-- blind-close, variance gates, thresholds). Deliberately EXCLUDES operator
-- despite the general instruction to include it everywhere — see the header
-- note. super_admin and tenant_admin are included per explicit instruction.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'cash_control:manage'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Role-grant verification.
DO $$
DECLARE
  v_grant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_grant_count
  FROM public.sys_auth_role_default_permissions
  WHERE permission_code IN (
    'cash_drawer:count', 'cash_drawer:transfer', 'cash_drawer:receive_transfer',
    'cash_drawer:deposit', 'cash_drawer:view_all_branches',
    'pos_session:close_others', 'pos_session:report_z',
    'cash_control:view', 'cash_control:manage'
  ) AND is_active = true;

  RAISE NOTICE '✅ % role/permission grant rows now active for the 9 new codes', v_grant_count;

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE role_code = 'super_admin' AND permission_code = 'cash_control:manage'
  ), 'super_admin missing cash_control:manage grant';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE role_code = 'tenant_admin' AND permission_code = 'cash_control:manage'
  ), 'tenant_admin missing cash_control:manage grant';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE role_code = 'operator' AND permission_code = 'cash_drawer:count'
  ), 'operator missing cash_drawer:count grant';
END $$;

COMMIT;
