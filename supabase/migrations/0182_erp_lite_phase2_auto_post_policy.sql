-- ==================================================================
-- Migration: 0182_erp_lite_phase2_auto_post_policy.sql
-- Purpose: Create ERP-Lite Phase 2 HQ auto-post policy table and approved v1 draft defaults
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 2 - HQ Governance Foundation
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_auto_post_mst (
  auto_post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pkg_id UUID NOT NULL,
  evt_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  blocking_mode VARCHAR(20) NOT NULL,
  required_success BOOLEAN NOT NULL DEFAULT true,
  retry_allowed BOOLEAN NOT NULL DEFAULT true,
  repost_allowed BOOLEAN NOT NULL DEFAULT true,
  failure_action_code VARCHAR(40) NOT NULL,
  notes TEXT,
  notes2 TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_sfap_pkg_evt UNIQUE (pkg_id, evt_id),
  CONSTRAINT fk_sfap_pkg FOREIGN KEY (pkg_id)
    REFERENCES public.sys_fin_gov_pkg_mst(pkg_id),
  CONSTRAINT fk_sfap_evt FOREIGN KEY (evt_id)
    REFERENCES public.sys_fin_evt_cd(evt_id),
  CONSTRAINT chk_sfap_mode CHECK (blocking_mode IN ('BLOCKING', 'NON_BLOCKING')),
  CONSTRAINT chk_sfap_act CHECK (failure_action_code IN ('BLOCK_TXN', 'FINANCE_EXCEPTION'))
);

CREATE INDEX IF NOT EXISTS idx_sfap_pkg_evt ON public.sys_fin_auto_post_mst(pkg_id, evt_id);
CREATE INDEX IF NOT EXISTS idx_sfap_mode ON public.sys_fin_auto_post_mst(blocking_mode, is_active);

INSERT INTO public.sys_fin_auto_post_mst (
  pkg_id,
  evt_id,
  is_enabled,
  blocking_mode,
  required_success,
  retry_allowed,
  repost_allowed,
  failure_action_code,
  notes,
  notes2,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
)
SELECT
  p.pkg_id,
  e.evt_id,
  true,
  seed.blocking_mode,
  seed.required_success,
  true,
  true,
  seed.failure_action_code,
  seed.notes,
  seed.notes2,
  seed.rec_order,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0182',
  true,
  1
FROM (
  VALUES
    ('ORDER_INVOICED', 'BLOCKING', true, 'BLOCK_TXN', 'Raise exception and block invoice completion when posting fails.', 'ارفع استثناء وامنع إكمال الفاتورة عند فشل الترحيل.', 10),
    ('ORDER_SETTLED_CASH', 'BLOCKING', true, 'BLOCK_TXN', 'Raise exception and block cash settlement when posting fails.', 'ارفع استثناء وامنع تسوية النقد عند فشل الترحيل.', 20),
    ('ORDER_SETTLED_CARD', 'BLOCKING', true, 'BLOCK_TXN', 'Raise exception and block card settlement when posting fails.', 'ارفع استثناء وامنع تسوية البطاقة عند فشل الترحيل.', 30),
    ('ORDER_SETTLED_WALLET', 'BLOCKING', true, 'BLOCK_TXN', 'Raise exception and block wallet settlement when posting fails.', 'ارفع استثناء وامنع تسوية المحفظة عند فشل الترحيل.', 40),
    ('PAYMENT_RECEIVED', 'BLOCKING', true, 'BLOCK_TXN', 'Raise exception and block payment receipt when posting fails.', 'ارفع استثناء وامنع استلام الدفعة عند فشل الترحيل.', 50),
    ('REFUND_ISSUED', 'BLOCKING', true, 'BLOCK_TXN', 'Raise exception and block refund completion when posting fails.', 'ارفع استثناء وامنع إكمال الاسترداد عند فشل الترحيل.', 60),
    ('EXPENSE_RECORDED', 'NON_BLOCKING', false, 'FINANCE_EXCEPTION', 'Allow expense save but enter finance exception queue if posting fails.', 'اسمح بحفظ المصروف مع إدخاله في قائمة استثناءات المالية عند فشل الترحيل.', 70),
    ('PETTY_CASH_TOPUP', 'NON_BLOCKING', false, 'FINANCE_EXCEPTION', 'Allow petty cash top-up save but create finance exception on posting failure.', 'اسمح بحفظ تغذية العهدة مع إنشاء استثناء مالي عند فشل الترحيل.', 80),
    ('PETTY_CASH_SPENT', 'NON_BLOCKING', false, 'FINANCE_EXCEPTION', 'Allow petty cash spend save but create finance exception on posting failure.', 'اسمح بحفظ صرف العهدة مع إنشاء استثناء مالي عند فشل الترحيل.', 90)
) AS seed(evt_code, blocking_mode, required_success, failure_action_code, notes, notes2, rec_order)
JOIN public.sys_fin_gov_pkg_mst p
  ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e
  ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, evt_id) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  blocking_mode = EXCLUDED.blocking_mode,
  required_success = EXCLUDED.required_success,
  retry_allowed = EXCLUDED.retry_allowed,
  repost_allowed = EXCLUDED.repost_allowed,
  failure_action_code = EXCLUDED.failure_action_code,
  notes = EXCLUDED.notes,
  notes2 = EXCLUDED.notes2,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0182';

COMMIT;
