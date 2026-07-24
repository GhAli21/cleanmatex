-- =============================================================================
-- 0424_b06_erp_order_to_cash_event_wiring.sql
-- B6 — ERP Order-to-Cash Event Wiring
-- (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose:
--   1. Flip the 5 already-live PAYMENT_RECEIVED / REFUND_ISSUED /
--      ORDER_SETTLED_CASH/CARD/WALLET auto-post policies from BLOCKING to
--      NON_BLOCKING. These were seeded BLOCKING in migration 0182 (before
--      any runtime caller existed) and published live in migration 0196.
--      D007's failure-coupling rule ("ERP posting failure must not delete
--      or roll back the operational voucher") requires NON_BLOCKING now
--      that this migration's application code adds real callers — a
--      misconfigured GL account mapping must never hard-fail a customer's
--      actual payment or refund. Owner-confirmed decision (2026-07-24).
--   2. Seed 4 new usage codes (chart-of-accounts placeholders each tenant
--      maps to a real ledger account): GIFT_CARD_LIABILITY,
--      CUSTOMER_ADVANCE_LIABILITY, BREAKAGE_INCOME, VOID_RECOVERY.
--   3. Seed 7 new event codes + mapping rules + NON_BLOCKING auto-post
--      policies for the gift-card lifecycle (5 of 6 — GIFT_CARD_BONUS_GRANTED
--      excluded: no bonus-granting business function exists anywhere in the
--      codebase to trigger it, confirmed by full repo grep; wiring a
--      dispatcher with no caller would be dead governance data) and the
--      stored-value funding liability events (WALLET_TOPPED_UP,
--      CUSTOMER_ADVANCE_RECEIVED — D008's 5th funding artifact, deferred
--      from B3 to this package).
--   4. Activate all new mapping rules + policy rows under the existing
--      PUBLISHED ERP_LITE_V1_CORE v1 package (migration 0196 already
--      published the package itself; new rows added under it still start
--      DRAFT/DRAFT per the 0181/0182 pattern and need their own activation
--      step since 0196 already ran once and will not re-run).
--
-- Decisions: D007 (BVM/ERP-Lite boundaries, failure coupling — APPROVED
--            Expert), D008 (stored-value funding treatment — five-artifact
--            rule, funding is a liability never revenue — APPROVED Expert),
--            D012 (revenue recognition — breakage income only on a real
--            legal-extinguishment event, never proportional estimation —
--            APPROVED Expert, consumed here only for GIFT_CARD_EXPIRED's
--            Dr/Cr shape; the recognition engine itself is B25).
-- Dependencies:
--   0180_erp_lite_phase2_event_usage.sql       — sys_fin_evt_cd / usage code pattern
--   0181_erp_lite_phase2_gov_rules.sql         — mapping rule pattern, PAYMENT_METHOD_MAP resolver
--   0182_erp_lite_phase2_auto_post_policy.sql  — auto-post policy pattern
--   0196_erp_lite_default_gov_live.sql         — publishes the ERP_LITE_V1_CORE v1 package this migration adds rows under
-- Work packages:
--   docs/features/Order_Fin/Remediation_Work_Packages/B06_ERP_Order_To_Cash_Event_Wiring.md
--
-- WHY this migration is safe:
--   • New usage/event/rule/policy rows are additive — no existing rows deleted.
--   • The BLOCKING→NON_BLOCKING flip only relaxes enforcement (a posting
--     failure becomes an exception instead of a hard block) — it can never
--     newly reject a transaction that previously succeeded.
--   • All INSERTs use ON CONFLICT DO UPDATE / DO NOTHING (idempotent, re-runnable).
--   • Every tenant still needs its own sys_fin_org_acc_map_dtl account
--     mapping for the new usage codes before a real GL account resolves —
--     until then, dispatches correctly land in org_fin_post_exc_tr as
--     ACCOUNT_NOT_FOUND/USAGE_MAPPING_NOT_FOUND exceptions (NON_BLOCKING,
--     no operational impact) rather than posting to the wrong account.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Flip 5 already-live policies from BLOCKING to NON_BLOCKING
-- -----------------------------------------------------------------------------

UPDATE public.sys_fin_auto_post_mst ap
SET
  blocking_mode = 'NON_BLOCKING',
  required_success = false,
  failure_action_code = 'FINANCE_EXCEPTION',
  notes = notes || ' [B6 2026-07-24: relaxed from BLOCKING — D007 failure coupling, now that a runtime caller exists.]',
  notes2 = notes2 || ' [B6 2026-07-24: تم التخفيف من BLOCKING إلى NON_BLOCKING بعد ربط المستدعي الفعلي.]',
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0424 — B6 BLOCKING to NON_BLOCKING relax'
FROM public.sys_fin_gov_pkg_mst p, public.sys_fin_evt_cd e
WHERE ap.pkg_id = p.pkg_id
  AND ap.evt_id = e.evt_id
  AND p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
  AND e.evt_code IN ('PAYMENT_RECEIVED', 'REFUND_ISSUED', 'ORDER_SETTLED_CASH', 'ORDER_SETTLED_CARD', 'ORDER_SETTLED_WALLET')
  AND ap.blocking_mode = 'BLOCKING';

-- -----------------------------------------------------------------------------
-- 2. New usage codes (chart-of-accounts placeholders)
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_fin_usage_code_cd (
  usage_code, primary_acc_type_id, name, name2, description, description2,
  normal_balance, phase_code, is_required_v1, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  seed.usage_code, t.acc_type_id, seed.name, seed.name2, seed.description, seed.description2,
  seed.normal_balance, 'V1', seed.is_required_v1, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1
FROM (
  VALUES
    ('GIFT_CARD_LIABILITY', 'LIABILITY', 'Gift Card Liability', 'التزام بطاقات الهدايا', 'Usage code for unredeemed gift-card balance liability accounts.', 'رمز استخدام لحسابات التزام أرصدة بطاقات الهدايا غير المستردة.', 'CREDIT', false, 130),
    ('CUSTOMER_ADVANCE_LIABILITY', 'LIABILITY', 'Customer Advance Liability', 'التزام دفعات مقدمة من العملاء', 'Usage code for order-specific customer advance liability accounts.', 'رمز استخدام لحسابات التزام الدفعات المقدمة الخاصة بطلب معين.', 'CREDIT', false, 140),
    ('BREAKAGE_INCOME', 'REVENUE', 'Breakage Income', 'إيراد الأرصدة الساقطة', 'Usage code for income recognized when a stored-value balance legally extinguishes (expiry), never from proportional estimation.', 'رمز استخدام للإيراد المعترف به عند سقوط رصيد قيمة مخزنة قانونياً (انتهاء الصلاحية)، وليس من تقدير تناسبي.', 'CREDIT', false, 150),
    ('VOID_RECOVERY', 'REVENUE', 'Void Recovery', 'استرداد الإلغاء', 'Usage code for income recognized when a gift-card balance is voided by an administrative action.', 'رمز استخدام للإيراد المعترف به عند إلغاء رصيد بطاقة هدايا بإجراء إداري.', 'CREDIT', false, 160)
) AS seed(usage_code, acc_type_code, name, name2, description, description2, normal_balance, is_required_v1, rec_order)
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code) DO UPDATE SET
  primary_acc_type_id = EXCLUDED.primary_acc_type_id,
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  normal_balance = EXCLUDED.normal_balance, phase_code = EXCLUDED.phase_code,
  is_required_v1 = EXCLUDED.is_required_v1, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0424';

INSERT INTO public.sys_fin_usage_type_dtl (
  usage_code_id, acc_type_id, is_primary, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  uc.usage_code_id, t.acc_type_id, true, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1
FROM (
  VALUES
    ('GIFT_CARD_LIABILITY', 'LIABILITY', 130),
    ('CUSTOMER_ADVANCE_LIABILITY', 'LIABILITY', 140),
    ('BREAKAGE_INCOME', 'REVENUE', 150),
    ('VOID_RECOVERY', 'REVENUE', 160)
) AS seed(usage_code, acc_type_code, rec_order)
JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code_id, acc_type_id) DO UPDATE SET
  is_primary = EXCLUDED.is_primary, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0424';

-- -----------------------------------------------------------------------------
-- 3. New event codes
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_fin_evt_cd (
  evt_code, name, name2, description, description2, phase_code, is_locked, rec_order,
  created_at, created_by, created_info, is_active, rec_status
) VALUES
  ('GIFT_CARD_SOLD', 'Gift Card Sold', 'تم بيع بطاقة هدايا', 'ERP-Lite v1 event for a funded gift-card sale (D008 funding liability).', 'حدث ERP-Lite v1 لبيع بطاقة هدايا ممولة (التزام تمويل D008).', 'V1', true, 100, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1),
  ('GIFT_CARD_REDEEMED', 'Gift Card Redeemed', 'تم استخدام بطاقة الهدايا', 'ERP-Lite v1 event for a gift-card redemption against an order.', 'حدث ERP-Lite v1 لاستخدام بطاقة هدايا مقابل طلب.', 'V1', true, 110, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1),
  ('GIFT_CARD_EXPIRED', 'Gift Card Expired', 'انتهت صلاحية بطاقة الهدايا', 'ERP-Lite v1 event for legal extinguishment of an expired gift-card balance (breakage income, D012).', 'حدث ERP-Lite v1 لسقوط رصيد بطاقة هدايا منتهية الصلاحية قانونياً (إيراد الأرصدة الساقطة، D012).', 'V1', true, 120, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1),
  ('GIFT_CARD_REFUNDED', 'Gift Card Refunded', 'تم استرداد بطاقة الهدايا', 'ERP-Lite v1 event for a gift-card redemption reversal.', 'حدث ERP-Lite v1 لعكس استخدام بطاقة هدايا.', 'V1', true, 130, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1),
  ('GIFT_CARD_VOIDED', 'Gift Card Voided', 'تم إلغاء بطاقة الهدايا', 'ERP-Lite v1 event for an administrative gift-card void (balance recovery).', 'حدث ERP-Lite v1 لإلغاء بطاقة هدايا إدارياً (استرداد الرصيد).', 'V1', true, 140, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1),
  ('WALLET_TOPPED_UP', 'Wallet Topped Up', 'تمت تعبئة المحفظة', 'ERP-Lite v1 event for a funded wallet top-up (D008 funding liability).', 'حدث ERP-Lite v1 لتعبئة محفظة ممولة (التزام تمويل D008).', 'V1', true, 150, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1),
  ('CUSTOMER_ADVANCE_RECEIVED', 'Customer Advance Received', 'تم استلام دفعة مقدمة من العميل', 'ERP-Lite v1 event for a funded customer advance receipt (D008 funding liability).', 'حدث ERP-Lite v1 لاستلام دفعة مقدمة ممولة من العميل (التزام تمويل D008).', 'V1', true, 160, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1)
ON CONFLICT (evt_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code, is_locked = EXCLUDED.is_locked, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0424';

-- -----------------------------------------------------------------------------
-- 4. Mapping rules (headers)
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_fin_map_rule_mst (
  pkg_id, evt_id, rule_code, version_no, name, name2, description, description2,
  priority_no, condition_json, is_fallback, stop_on_match, status_code, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, seed.rule_code, 1, seed.name, seed.name2, seed.description, seed.description2,
  seed.priority_no, '{}'::jsonb, true, true, 'DRAFT', seed.priority_no,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1
FROM (
  VALUES
    ('GIFT_CARD_SOLD_V1', 'GIFT_CARD_SOLD', 'Gift card sold v1', 'بيع بطاقة هدايا v1', 'B6 v1 rule for funded gift-card sale posting.', 'قاعدة B6 v1 لقيود بيع بطاقة الهدايا الممولة.', 100),
    ('GIFT_CARD_REDEEMED_V1', 'GIFT_CARD_REDEEMED', 'Gift card redeemed v1', 'استخدام بطاقة هدايا v1', 'B6 v1 rule for gift-card redemption posting.', 'قاعدة B6 v1 لقيود استخدام بطاقة الهدايا.', 110),
    ('GIFT_CARD_EXPIRED_V1', 'GIFT_CARD_EXPIRED', 'Gift card expired v1', 'انتهاء صلاحية بطاقة هدايا v1', 'B6 v1 rule for gift-card legal-extinguishment breakage posting.', 'قاعدة B6 v1 لقيود سقوط رصيد بطاقة الهدايا قانونياً.', 120),
    ('GIFT_CARD_REFUNDED_V1', 'GIFT_CARD_REFUNDED', 'Gift card refunded v1', 'استرداد بطاقة هدايا v1', 'B6 v1 rule for gift-card redemption-reversal posting.', 'قاعدة B6 v1 لقيود عكس استخدام بطاقة الهدايا.', 130),
    ('GIFT_CARD_VOIDED_V1', 'GIFT_CARD_VOIDED', 'Gift card voided v1', 'إلغاء بطاقة هدايا v1', 'B6 v1 rule for administrative gift-card void posting.', 'قاعدة B6 v1 لقيود إلغاء بطاقة الهدايا إدارياً.', 140),
    ('WALLET_TOPPED_UP_V1', 'WALLET_TOPPED_UP', 'Wallet topped up v1', 'تعبئة محفظة v1', 'B6 v1 rule for funded wallet top-up posting.', 'قاعدة B6 v1 لقيود تعبئة المحفظة الممولة.', 150),
    ('CUSTOMER_ADVANCE_RECEIVED_V1', 'CUSTOMER_ADVANCE_RECEIVED', 'Customer advance received v1', 'استلام دفعة مقدمة v1', 'B6 v1 rule for funded customer advance receipt posting.', 'قاعدة B6 v1 لقيود استلام الدفعة المقدمة الممولة.', 160)
) AS seed(rule_code, evt_code, name, name2, description, description2, priority_no)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, rule_code) DO UPDATE SET
  evt_id = EXCLUDED.evt_id, name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  priority_no = EXCLUDED.priority_no, condition_json = EXCLUDED.condition_json,
  is_fallback = EXCLUDED.is_fallback, stop_on_match = EXCLUDED.stop_on_match,
  rec_order = EXCLUDED.rec_order, is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0424';

-- -----------------------------------------------------------------------------
-- 5. Mapping rules (Dr/Cr lines)
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_fin_map_rule_dtl (
  rule_id, line_no, entry_side, usage_code_id, resolver_id, amount_source_code,
  line_type_code, condition_json, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  r.rule_id, seed.line_no, seed.entry_side, uc.usage_code_id, res.resolver_id, seed.amount_source_code,
  seed.line_type_code, '{}'::jsonb, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1
FROM (
  VALUES
    -- GIFT_CARD_SOLD: DR Cash/Clearing (per tender method), CR Gift Card Liability
    ('GIFT_CARD_SOLD_V1', 10, 'DR', NULL, 'PAYMENT_METHOD_MAP', 'gross_amount', 'MAIN', 10),
    ('GIFT_CARD_SOLD_V1', 20, 'CR', 'GIFT_CARD_LIABILITY', NULL, 'gross_amount', 'MAIN', 20),
    -- GIFT_CARD_REDEEMED: DR Gift Card Liability, CR AR/Invoice Settlement
    ('GIFT_CARD_REDEEMED_V1', 10, 'DR', 'GIFT_CARD_LIABILITY', NULL, 'gross_amount', 'MAIN', 10),
    ('GIFT_CARD_REDEEMED_V1', 20, 'CR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', 20),
    -- GIFT_CARD_EXPIRED: DR Gift Card Liability, CR Breakage Income
    ('GIFT_CARD_EXPIRED_V1', 10, 'DR', 'GIFT_CARD_LIABILITY', NULL, 'gross_amount', 'MAIN', 10),
    ('GIFT_CARD_EXPIRED_V1', 20, 'CR', 'BREAKAGE_INCOME', NULL, 'gross_amount', 'MAIN', 20),
    -- GIFT_CARD_REFUNDED: DR AR/Invoice Settlement, CR Gift Card Liability
    ('GIFT_CARD_REFUNDED_V1', 10, 'DR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', 10),
    ('GIFT_CARD_REFUNDED_V1', 20, 'CR', 'GIFT_CARD_LIABILITY', NULL, 'gross_amount', 'MAIN', 20),
    -- GIFT_CARD_VOIDED: DR Gift Card Liability, CR Void Recovery
    ('GIFT_CARD_VOIDED_V1', 10, 'DR', 'GIFT_CARD_LIABILITY', NULL, 'gross_amount', 'MAIN', 10),
    ('GIFT_CARD_VOIDED_V1', 20, 'CR', 'VOID_RECOVERY', NULL, 'gross_amount', 'MAIN', 20),
    -- WALLET_TOPPED_UP: DR Cash/Clearing (per tender method), CR Wallet Liability
    ('WALLET_TOPPED_UP_V1', 10, 'DR', NULL, 'PAYMENT_METHOD_MAP', 'gross_amount', 'MAIN', 10),
    ('WALLET_TOPPED_UP_V1', 20, 'CR', 'WALLET_CLEARING', NULL, 'gross_amount', 'MAIN', 20),
    -- CUSTOMER_ADVANCE_RECEIVED: DR Cash/Clearing (per tender method), CR Customer Advance Liability
    ('CUSTOMER_ADVANCE_RECEIVED_V1', 10, 'DR', NULL, 'PAYMENT_METHOD_MAP', 'gross_amount', 'MAIN', 10),
    ('CUSTOMER_ADVANCE_RECEIVED_V1', 20, 'CR', 'CUSTOMER_ADVANCE_LIABILITY', NULL, 'gross_amount', 'MAIN', 20)
) AS seed(rule_code, line_no, entry_side, usage_code, acct_resolver_code, amount_source_code, line_type_code, rec_order)
JOIN public.sys_fin_map_rule_mst r ON r.rule_code = seed.rule_code
LEFT JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
LEFT JOIN public.sys_fin_resolver_cd res ON res.resolver_code = seed.acct_resolver_code
ON CONFLICT (rule_id, line_no) DO UPDATE SET
  usage_code_id = EXCLUDED.usage_code_id, resolver_id = EXCLUDED.resolver_id,
  amount_source_code = EXCLUDED.amount_source_code, line_type_code = EXCLUDED.line_type_code,
  condition_json = EXCLUDED.condition_json, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0424';

-- -----------------------------------------------------------------------------
-- 6. Auto-post policies — all 7 new events NON_BLOCKING from day one
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_fin_auto_post_mst (
  pkg_id, evt_id, policy_ver, is_enabled, blocking_mode, required_success,
  retry_allowed, repost_allowed, status_code, failure_action_code, notes, notes2, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, 1, true, 'NON_BLOCKING', false, true, true, 'DRAFT', 'FINANCE_EXCEPTION',
  seed.notes, seed.notes2, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0424', true, 1
FROM (
  VALUES
    ('GIFT_CARD_SOLD', 'Allow gift-card sale but enter finance exception queue if liability posting fails.', 'اسمح ببيع بطاقة الهدايا مع إدخالها في قائمة استثناءات المالية عند فشل ترحيل الالتزام.', 100),
    ('GIFT_CARD_REDEEMED', 'Allow gift-card redemption but enter finance exception queue if posting fails.', 'اسمح باستخدام بطاقة الهدايا مع إدخالها في قائمة استثناءات المالية عند فشل الترحيل.', 110),
    ('GIFT_CARD_EXPIRED', 'Allow gift-card expiry but enter finance exception queue if breakage posting fails.', 'اسمح بانتهاء صلاحية بطاقة الهدايا مع إدخالها في قائمة استثناءات المالية عند فشل ترحيل الأرصدة الساقطة.', 120),
    ('GIFT_CARD_REFUNDED', 'Allow gift-card refund but enter finance exception queue if posting fails.', 'اسمح باسترداد بطاقة الهدايا مع إدخالها في قائمة استثناءات المالية عند فشل الترحيل.', 130),
    ('GIFT_CARD_VOIDED', 'Allow gift-card void but enter finance exception queue if posting fails.', 'اسمح بإلغاء بطاقة الهدايا مع إدخالها في قائمة استثناءات المالية عند فشل الترحيل.', 140),
    ('WALLET_TOPPED_UP', 'Allow wallet top-up but enter finance exception queue if liability posting fails.', 'اسمح بتعبئة المحفظة مع إدخالها في قائمة استثناءات المالية عند فشل ترحيل الالتزام.', 150),
    ('CUSTOMER_ADVANCE_RECEIVED', 'Allow customer advance receipt but enter finance exception queue if liability posting fails.', 'اسمح باستلام الدفعة المقدمة مع إدخالها في قائمة استثناءات المالية عند فشل ترحيل الالتزام.', 160)
) AS seed(evt_code, notes, notes2, rec_order)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, evt_id, policy_ver) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, blocking_mode = EXCLUDED.blocking_mode,
  required_success = EXCLUDED.required_success, retry_allowed = EXCLUDED.retry_allowed,
  repost_allowed = EXCLUDED.repost_allowed, failure_action_code = EXCLUDED.failure_action_code,
  notes = EXCLUDED.notes, notes2 = EXCLUDED.notes2, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0424';

-- -----------------------------------------------------------------------------
-- 7. Activate the new mapping rules + policies (mirrors migration 0196 —
--    the package itself is already PUBLISHED; only these new rows need it)
-- -----------------------------------------------------------------------------

UPDATE public.sys_fin_map_rule_mst r
SET status_code = 'ACTIVE', updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
    updated_info = 'Migration 0424 — activate B6 rules'
FROM public.sys_fin_evt_cd e
WHERE r.evt_id = e.evt_id
  AND e.evt_code IN (
    'GIFT_CARD_SOLD', 'GIFT_CARD_REDEEMED', 'GIFT_CARD_EXPIRED', 'GIFT_CARD_REFUNDED', 'GIFT_CARD_VOIDED',
    'WALLET_TOPPED_UP', 'CUSTOMER_ADVANCE_RECEIVED'
  )
  AND r.status_code = 'DRAFT';

UPDATE public.sys_fin_auto_post_mst ap
SET status_code = 'ACTIVE', effective_from = COALESCE(ap.effective_from, CURRENT_DATE),
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
    updated_info = 'Migration 0424 — activate B6 policies'
FROM public.sys_fin_evt_cd e
WHERE ap.evt_id = e.evt_id
  AND e.evt_code IN (
    'GIFT_CARD_SOLD', 'GIFT_CARD_REDEEMED', 'GIFT_CARD_EXPIRED', 'GIFT_CARD_REFUNDED', 'GIFT_CARD_VOIDED',
    'WALLET_TOPPED_UP', 'CUSTOMER_ADVANCE_RECEIVED'
  )
  AND ap.status_code = 'DRAFT';

-- -----------------------------------------------------------------------------
-- 8. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_fin_auto_post_mst ap
  JOIN public.sys_fin_evt_cd e ON e.evt_id = ap.evt_id
  WHERE e.evt_code IN ('PAYMENT_RECEIVED', 'REFUND_ISSUED', 'ORDER_SETTLED_CASH', 'ORDER_SETTLED_CARD', 'ORDER_SETTLED_WALLET')
    AND ap.blocking_mode = 'NON_BLOCKING';
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'B6: expected 5 policies flipped to NON_BLOCKING, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_usage_code_cd
  WHERE usage_code IN ('GIFT_CARD_LIABILITY', 'CUSTOMER_ADVANCE_LIABILITY', 'BREAKAGE_INCOME', 'VOID_RECOVERY');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'B6: expected 4 new usage codes, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_evt_cd
  WHERE evt_code IN (
    'GIFT_CARD_SOLD', 'GIFT_CARD_REDEEMED', 'GIFT_CARD_EXPIRED', 'GIFT_CARD_REFUNDED', 'GIFT_CARD_VOIDED',
    'WALLET_TOPPED_UP', 'CUSTOMER_ADVANCE_RECEIVED'
  );
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'B6: expected 7 new event codes, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_map_rule_mst r
  JOIN public.sys_fin_evt_cd e ON e.evt_id = r.evt_id
  WHERE e.evt_code IN (
    'GIFT_CARD_SOLD', 'GIFT_CARD_REDEEMED', 'GIFT_CARD_EXPIRED', 'GIFT_CARD_REFUNDED', 'GIFT_CARD_VOIDED',
    'WALLET_TOPPED_UP', 'CUSTOMER_ADVANCE_RECEIVED'
  ) AND r.status_code = 'ACTIVE';
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'B6: expected 7 new mapping rules ACTIVE, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_auto_post_mst ap
  JOIN public.sys_fin_evt_cd e ON e.evt_id = ap.evt_id
  WHERE e.evt_code IN (
    'GIFT_CARD_SOLD', 'GIFT_CARD_REDEEMED', 'GIFT_CARD_EXPIRED', 'GIFT_CARD_REFUNDED', 'GIFT_CARD_VOIDED',
    'WALLET_TOPPED_UP', 'CUSTOMER_ADVANCE_RECEIVED'
  ) AND ap.status_code = 'ACTIVE' AND ap.blocking_mode = 'NON_BLOCKING';
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'B6: expected 7 new auto-post policies ACTIVE/NON_BLOCKING, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_map_rule_dtl d
  JOIN public.sys_fin_map_rule_mst r ON r.rule_id = d.rule_id
  WHERE r.rule_code IN (
    'GIFT_CARD_SOLD_V1', 'GIFT_CARD_REDEEMED_V1', 'GIFT_CARD_EXPIRED_V1', 'GIFT_CARD_REFUNDED_V1',
    'GIFT_CARD_VOIDED_V1', 'WALLET_TOPPED_UP_V1', 'CUSTOMER_ADVANCE_RECEIVED_V1'
  );
  IF v_count <> 14 THEN
    RAISE EXCEPTION 'B6: expected 14 mapping-rule Dr/Cr lines (7 rules x 2 lines), found %', v_count;
  END IF;

  RAISE NOTICE '✓ Migration 0424 validation passed';
  RAISE NOTICE '  - 5 existing policies (PAYMENT_RECEIVED/REFUND_ISSUED/ORDER_SETTLED_*) flipped to NON_BLOCKING';
  RAISE NOTICE '  - 4 new usage codes seeded (GIFT_CARD_LIABILITY, CUSTOMER_ADVANCE_LIABILITY, BREAKAGE_INCOME, VOID_RECOVERY)';
  RAISE NOTICE '  - 7 new event codes + mapping rules + NON_BLOCKING policies seeded and ACTIVE';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. No Prisma schema change — this migration only inserts/updates rows in
--    existing ERP-Lite governance tables (sys_fin_usage_code_cd,
--    sys_fin_usage_type_dtl, sys_fin_evt_cd, sys_fin_map_rule_mst/dtl,
--    sys_fin_auto_post_mst), all already modeled in prisma/schema.prisma
--    from earlier ERP-Lite phases. `npx prisma generate` not required.
-- 2. Each tenant with ERP-Lite enabled (`erp_lite_enabled` feature flag)
--    still needs its own sys_fin_org_acc_map_dtl mapping for the 4 new
--    usage codes (GIFT_CARD_LIABILITY, CUSTOMER_ADVANCE_LIABILITY,
--    BREAKAGE_INCOME, VOID_RECOVERY) before these events post to a real
--    account — until mapped, dispatches land as NON_BLOCKING exceptions in
--    org_fin_post_exc_tr (ACCOUNT_NOT_FOUND / USAGE_MAPPING_NOT_FOUND),
--    with zero impact on the sale/refund/funding transaction itself.
-- 3. New application-code callers live in: order-payment-wiring.handler.ts,
--    order-credit-application-wiring.handler.ts (WALLET branch only),
--    payment-transition.service.ts (VERIFY — deferred payment-received
--    post), order-refund.service.ts (processRefund tail),
--    stored-value-funding.service.ts (finalizeStoredValueFundingIfReady),
--    gift-card-service.ts (redeemGiftCardTx/refundGiftCardTx/voidGiftCard/
--    expireGiftCard). All NON_BLOCKING — see erp-lite-auto-post.util.ts's
--    logAutoPostOutcome for the shared non-throwing outcome logger.
-- 4. To rollback: revert the 5 policies' blocking_mode/required_success/
--    failure_action_code to their 0182 BLOCKING values, set the 7 new
--    mapping rules + auto-post policies back to DRAFT (or delete them —
--    additive, safe), delete the 4 new usage_type_dtl + usage_code_cd rows,
--    delete the 7 new sys_fin_evt_cd rows. Application code continues to
--    work with any of these rolled back — a missing/DRAFT policy just
--    means the dispatcher returns `status: 'skipped'` (POLICY_NOT_FOUND /
--    POLICY_DISABLED), which the NON_BLOCKING call sites already treat as
--    a routine, logged no-op.
-- =============================================================================
