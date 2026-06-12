-- ==================================================================
-- Migration: 0357_fin_settlement_catalogs_v1_1.sql
-- Purpose: Payment/settlement catalog foundation (v1.1 reference pack).
--          Extends existing sys_fin_vch_* catalogs — no duplicate tables.
-- ADR: docs/features/Order_Fin/ADR/ADR-047-Overpayment-Disposition.md
-- Plan: docs/features/Order_Fin/Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- 1. sys_fin_overpay_res_cd — overpayment resolution catalog
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_overpay_res_cd (
  resolution_code                 TEXT PRIMARY KEY,
  name                            TEXT NOT NULL,
  name2                           TEXT,
  description                     TEXT,
  description2                    TEXT,
  allowed_for_cash                BOOLEAN NOT NULL DEFAULT false,
  allowed_for_card                BOOLEAN NOT NULL DEFAULT false,
  allowed_for_gateway             BOOLEAN NOT NULL DEFAULT false,
  allowed_for_bank                BOOLEAN NOT NULL DEFAULT false,
  allowed_for_check               BOOLEAN NOT NULL DEFAULT false,
  allowed_for_mobile              BOOLEAN NOT NULL DEFAULT false,
  allowed_for_stored_value        BOOLEAN NOT NULL DEFAULT false,
  creates_change_return           BOOLEAN NOT NULL DEFAULT false,
  creates_payment_reduction       BOOLEAN NOT NULL DEFAULT false,
  creates_void_or_refund          BOOLEAN NOT NULL DEFAULT false,
  creates_customer_advance        BOOLEAN NOT NULL DEFAULT false,
  creates_customer_credit         BOOLEAN NOT NULL DEFAULT false,
  restores_stored_value           BOOLEAN NOT NULL DEFAULT false,
  creates_multi_target_allocation BOOLEAN NOT NULL DEFAULT false,
  uses_allocation_policy          BOOLEAN NOT NULL DEFAULT false,
  requires_allocation_details     BOOLEAN NOT NULL DEFAULT false,
  requires_permission             BOOLEAN NOT NULL DEFAULT false,
  permission_code                 TEXT,
  requires_reason                 BOOLEAN NOT NULL DEFAULT false,
  requires_approval               BOOLEAN NOT NULL DEFAULT false,
  display_order                   INTEGER,
  is_system                       BOOLEAN NOT NULL DEFAULT true,
  is_active                       BOOLEAN NOT NULL DEFAULT true,
  metadata                        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ
);

COMMENT ON TABLE sys_fin_overpay_res_cd IS
  'Global catalog: how checkout excess is resolved (change, reduce, wallet, advance, customer credit, allocation).';

-- ==================================================================
-- 2. sys_fin_vch_source_type_cd — voucher origin catalog
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_vch_source_type_cd (
  source_type                         TEXT PRIMARY KEY,
  name                                TEXT NOT NULL,
  name2                               TEXT,
  description                         TEXT,
  description2                        TEXT,
  source_family                       TEXT NOT NULL,
  originates_from_order               BOOLEAN NOT NULL DEFAULT false,
  originates_from_customer_account    BOOLEAN NOT NULL DEFAULT false,
  originates_from_ar                  BOOLEAN NOT NULL DEFAULT false,
  originates_from_b2b_statement         BOOLEAN NOT NULL DEFAULT false,
  originates_from_wallet              BOOLEAN NOT NULL DEFAULT false,
  originates_from_gift_card           BOOLEAN NOT NULL DEFAULT false,
  originates_from_refund              BOOLEAN NOT NULL DEFAULT false,
  originates_from_gateway_callback    BOOLEAN NOT NULL DEFAULT false,
  is_manual                           BOOLEAN NOT NULL DEFAULT false,
  display_order                       INTEGER,
  is_system                           BOOLEAN NOT NULL DEFAULT true,
  is_active                           BOOLEAN NOT NULL DEFAULT true,
  metadata                            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ,
  CONSTRAINT chk_fin_vch_src_family CHECK (
    source_family IN (
      'ORDER', 'CUSTOMER_ACCOUNT', 'AR', 'B2B_STATEMENT', 'WALLET',
      'GIFT_CARD', 'ADVANCE', 'REFUND', 'GATEWAY', 'MANUAL', 'OTHER'
    )
  )
);

COMMENT ON TABLE sys_fin_vch_source_type_cd IS
  'BVM voucher source/origin classification. Source = where voucher came from; target = what a line settles.';

-- ==================================================================
-- 3. sys_fin_rcpt_alloc_mode_cd — customer receipt allocation modes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_rcpt_alloc_mode_cd (
  allocation_mode         TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  name2                   TEXT,
  description             TEXT,
  description2            TEXT,
  sort_by_due_date        BOOLEAN NOT NULL DEFAULT false,
  sort_by_document_date   BOOLEAN NOT NULL DEFAULT false,
  uses_target_priority    BOOLEAN NOT NULL DEFAULT false,
  is_manual_only          BOOLEAN NOT NULL DEFAULT false,
  display_order           INTEGER,
  is_system               BOOLEAN NOT NULL DEFAULT true,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ
);

COMMENT ON TABLE sys_fin_rcpt_alloc_mode_cd IS
  'How excess customer receipt is auto-allocated across open balances.';

-- ==================================================================
-- 4. sys_fin_rcpt_fb_dest_cd — fallback when allocation does not consume all excess
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_rcpt_fb_dest_cd (
  fallback_destination        TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  name2                       TEXT,
  description                 TEXT,
  description2                TEXT,
  line_role                   TEXT,
  target_type                 TEXT,
  creates_wallet_topup        BOOLEAN NOT NULL DEFAULT false,
  creates_customer_advance    BOOLEAN NOT NULL DEFAULT false,
  creates_customer_credit     BOOLEAN NOT NULL DEFAULT false,
  creates_cash_change         BOOLEAN NOT NULL DEFAULT false,
  blocks_posting              BOOLEAN NOT NULL DEFAULT false,
  requires_cash               BOOLEAN NOT NULL DEFAULT false,
  display_order               INTEGER,
  is_system                   BOOLEAN NOT NULL DEFAULT true,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ
);

COMMENT ON TABLE sys_fin_rcpt_fb_dest_cd IS
  'Fallback destination for unallocated customer receipt excess after eligible targets are paid.';

-- ==================================================================
-- 5. sys_fin_rem_bal_policy_cd — remaining balance / outstanding policy catalog
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_rem_bal_policy_cd (
  policy_code                     TEXT PRIMARY KEY,
  name                            TEXT NOT NULL,
  name2                           TEXT,
  description                     TEXT,
  description2                    TEXT,
  requires_zero_remaining         BOOLEAN NOT NULL DEFAULT false,
  creates_pay_on_collection_due   BOOLEAN NOT NULL DEFAULT false,
  creates_ar_invoice              BOOLEAN NOT NULL DEFAULT false,
  creates_ar_ledger               BOOLEAN NOT NULL DEFAULT false,
  creates_statement_entry         BOOLEAN NOT NULL DEFAULT false,
  requires_customer_account       BOOLEAN NOT NULL DEFAULT false,
  requires_b2b_customer           BOOLEAN NOT NULL DEFAULT false,
  requires_credit_limit_check     BOOLEAN NOT NULL DEFAULT false,
  requires_approval               BOOLEAN NOT NULL DEFAULT false,
  resulting_payment_status        TEXT,
  display_order                   INTEGER,
  is_system                       BOOLEAN NOT NULL DEFAULT true,
  is_active                       BOOLEAN NOT NULL DEFAULT true,
  metadata                        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ
);

COMMENT ON TABLE sys_fin_rem_bal_policy_cd IS
  'Catalog for how unpaid order remainder is handled (full pay, pay on collection, AR invoice, B2B statement).';

-- ==================================================================
-- 6. org_fin_rcpt_alloc_policy_cf — tenant/branch allocation policy
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_fin_rcpt_alloc_policy_cf (
  id                                  UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id                       UUID NOT NULL,
  branch_id                           UUID,
  policy_code                         TEXT NOT NULL,
  name                                TEXT NOT NULL,
  name2                               TEXT,
  description                         TEXT,
  description2                        TEXT,
  is_default                          BOOLEAN NOT NULL DEFAULT false,
  is_active                           BOOLEAN NOT NULL DEFAULT true,
  allocation_mode                     TEXT NOT NULL DEFAULT 'AUTO_OLDEST_DUE',
  include_ar_invoices                 BOOLEAN NOT NULL DEFAULT true,
  include_b2b_statements              BOOLEAN NOT NULL DEFAULT true,
  include_pay_on_collection_orders    BOOLEAN NOT NULL DEFAULT true,
  include_open_order_balances         BOOLEAN NOT NULL DEFAULT true,
  priority_ar_invoices                INTEGER NOT NULL DEFAULT 10,
  priority_b2b_statements             INTEGER NOT NULL DEFAULT 20,
  priority_pay_on_collection_orders INTEGER NOT NULL DEFAULT 30,
  priority_open_order_balances        INTEGER NOT NULL DEFAULT 40,
  allow_partial_last_target           BOOLEAN NOT NULL DEFAULT true,
  require_same_currency               BOOLEAN NOT NULL DEFAULT true,
  allow_cross_branch_allocation       BOOLEAN NOT NULL DEFAULT false,
  allow_cross_contract_allocation     BOOLEAN NOT NULL DEFAULT false,
  fallback_destination                TEXT NOT NULL DEFAULT 'CUSTOMER_ADVANCE',
  require_confirmation_before_posting BOOLEAN NOT NULL DEFAULT true,
  max_targets_per_allocation          INTEGER NOT NULL DEFAULT 100,
  metadata                            JSONB NOT NULL DEFAULT '{}'::jsonb,
  rec_status                          SMALLINT NOT NULL DEFAULT 1,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                          TEXT,
  updated_at                          TIMESTAMPTZ,
  updated_by                          TEXT,
  CONSTRAINT pk_org_fin_rcpt_alloc_policy_cf
    PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_fin_rcpt_alloc_policy_code
    UNIQUE (tenant_org_id, branch_id, policy_code),
  CONSTRAINT fk_fin_rcpt_alloc_policy_mode
    FOREIGN KEY (allocation_mode)
    REFERENCES sys_fin_rcpt_alloc_mode_cd (allocation_mode)
    ON DELETE RESTRICT,
  CONSTRAINT fk_fin_rcpt_alloc_policy_fb
    FOREIGN KEY (fallback_destination)
    REFERENCES sys_fin_rcpt_fb_dest_cd (fallback_destination)
    ON DELETE RESTRICT,
  CONSTRAINT chk_fin_rcpt_max_targets
    CHECK (max_targets_per_allocation > 0)
);

COMMENT ON TABLE org_fin_rcpt_alloc_policy_cf IS
  'Tenant/branch policy for auto-allocation of excess customer receipt across open balances.';

CREATE INDEX IF NOT EXISTS idx_fin_rcpt_policy_tenant
  ON org_fin_rcpt_alloc_policy_cf (tenant_org_id, branch_id, is_active, is_default);

-- ==================================================================
-- 7. org_fin_rcpt_alloc_preview_tr — allocation preview (audit + idempotency)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_fin_rcpt_alloc_preview_tr (
  id                                  UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id                       UUID NOT NULL,
  branch_id                           UUID,
  customer_id                         UUID NOT NULL,
  source_type                         TEXT NOT NULL,
  source_order_id                     UUID,
  policy_id                           UUID,
  receipt_amount                      DECIMAL(19, 4) NOT NULL,
  current_order_allocation_amount     DECIMAL(19, 4) NOT NULL DEFAULT 0,
  excess_amount                       DECIMAL(19, 4) NOT NULL DEFAULT 0,
  amount_allocated                    DECIMAL(19, 4) NOT NULL DEFAULT 0,
  remaining_unallocated_amount        DECIMAL(19, 4) NOT NULL DEFAULT 0,
  currency_code                       TEXT NOT NULL,
  currency_ex_rate                    DECIMAL(22, 10),
  allocation_mode                     TEXT NOT NULL,
  fallback_destination                TEXT,
  preview_status                      TEXT NOT NULL DEFAULT 'DRAFT',
  preview_payload                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  warning_payload                     JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key                     TEXT,
  expires_at                          TIMESTAMPTZ,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                          TEXT,
  updated_at                          TIMESTAMPTZ,
  updated_by                          TEXT,
  CONSTRAINT pk_org_fin_rcpt_alloc_preview_tr
    PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT chk_fin_rcpt_preview_amts CHECK (
    receipt_amount >= 0
    AND current_order_allocation_amount >= 0
    AND excess_amount >= 0
    AND amount_allocated >= 0
    AND remaining_unallocated_amount >= 0
  ),
  CONSTRAINT chk_fin_rcpt_preview_status CHECK (
    preview_status IN ('DRAFT', 'CONFIRMED', 'POSTED', 'EXPIRED', 'CANCELLED')
  )
);

COMMENT ON TABLE org_fin_rcpt_alloc_preview_tr IS
  'Generated customer receipt allocation previews for confirmation and idempotent posting.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_rcpt_preview_idempotency
  ON org_fin_rcpt_alloc_preview_tr (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_rcpt_preview_tenant_cust
  ON org_fin_rcpt_alloc_preview_tr (tenant_org_id, customer_id, created_at DESC);

-- ==================================================================
-- 8. RLS — tenant org_fin_* tables
-- ==================================================================

ALTER TABLE org_fin_rcpt_alloc_policy_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_fin_rcpt_alloc_preview_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_fin_rcpt_alloc_policy_cf ON org_fin_rcpt_alloc_policy_cf;
CREATE POLICY tenant_isolation_org_fin_rcpt_alloc_policy_cf ON org_fin_rcpt_alloc_policy_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_fin_rcpt_alloc_policy_cf ON org_fin_rcpt_alloc_policy_cf;
CREATE POLICY service_role_org_fin_rcpt_alloc_policy_cf ON org_fin_rcpt_alloc_policy_cf
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS tenant_isolation_org_fin_rcpt_alloc_preview_tr ON org_fin_rcpt_alloc_preview_tr;
CREATE POLICY tenant_isolation_org_fin_rcpt_alloc_preview_tr ON org_fin_rcpt_alloc_preview_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_fin_rcpt_alloc_preview_tr ON org_fin_rcpt_alloc_preview_tr;
CREATE POLICY service_role_org_fin_rcpt_alloc_preview_tr ON org_fin_rcpt_alloc_preview_tr
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- 9. Extend sys_fin_vch_* catalog seeds (no duplicate tables)
-- ==================================================================

INSERT INTO sys_fin_vch_line_role_cd (code, name, name2, line_type, direction, rec_order, is_active, rec_status)
VALUES
  ('STATEMENT_PAYMENT',            'Statement Payment',            'دفع كشف حساب',           'RECEIPT', 'IN',  21, true, 1),
  ('STATEMENT_CREDIT_APPLICATION', 'Statement Credit Application', 'تطبيق رصيد على كشف',     'CREDIT_APPLICATION', 'NEUTRAL', 22, true, 1),
  ('CUSTOMER_CREDIT_ISSUE',        'Customer Credit Issue',        'إصدار رصيد عميل',        'ADJUSTMENT', 'NEUTRAL', 23, true, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  line_type = EXCLUDED.line_type,
  direction = EXCLUDED.direction,
  rec_order = EXCLUDED.rec_order,
  updated_at = NOW();

INSERT INTO sys_fin_vch_target_type_cd (code, name, name2, rec_order, is_active, rec_status)
VALUES
  ('B2B_STATEMENT', 'B2B Statement', 'كشف عميل شركات', 14, true, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  rec_order = EXCLUDED.rec_order,
  updated_at = NOW();

-- ==================================================================
-- 10. Extend org_fin_voucher_trx_lines_dtl CHECK constraints
-- ==================================================================

ALTER TABLE org_fin_voucher_trx_lines_dtl
  DROP CONSTRAINT IF EXISTS chk_vch_trx_ln_role;

ALTER TABLE org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT chk_vch_trx_ln_role
  CHECK (line_role IN (
    'ORDER_PAYMENT',
    'INVOICE_PAYMENT',
    'WALLET_TOPUP',
    'GIFT_CARD_SALE',
    'CUSTOMER_CREDIT_RECEIPT',
    'CUSTOMER_CREDIT_ISSUE',
    'CUSTOMER_ADVANCE_RECEIPT',
    'SUPPLIER_PAYMENT',
    'EXPENSE_PAYMENT',
    'SHOP_RENT_PAYMENT',
    'UTILITY_PAYMENT',
    'EMPLOYEE_ADVANCE_PAYMENT',
    'PETTY_CASH_ISSUE',
    'CUSTOMER_REFUND',
    'ORDER_REFUND',
    'INVOICE_REFUND',
    'PETTY_CASH_RETURN',
    'WALLET_REFUND',
    'GIFT_CARD_REFUND',
    'INTERNAL_TRANSFER',
    'ORDER_CREDIT_APPLICATION',
    'STATEMENT_PAYMENT',
    'STATEMENT_CREDIT_APPLICATION'
  ));

ALTER TABLE org_fin_voucher_trx_lines_dtl
  DROP CONSTRAINT IF EXISTS chk_vch_trx_ln_target;

ALTER TABLE org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT chk_vch_trx_ln_target
  CHECK (target_type IS NULL OR target_type IN (
    'ORDER',
    'INVOICE',
    'CUSTOMER',
    'SUPPLIER',
    'EMPLOYEE',
    'WALLET',
    'GIFT_CARD',
    'CREDIT_NOTE',
    'EXPENSE',
    'BANK_ACCOUNT',
    'CASH_DRAWER',
    'PETTY_CASH',
    'OTHER',
    'B2B_STATEMENT'
  ));

-- ==================================================================
-- 11. Catalog seeds — overpayment resolutions
-- ==================================================================

INSERT INTO sys_fin_overpay_res_cd (
  resolution_code, name, name2, description, description2,
  allowed_for_cash, allowed_for_card, allowed_for_gateway, allowed_for_bank,
  allowed_for_check, allowed_for_mobile, allowed_for_stored_value,
  creates_change_return, creates_payment_reduction, creates_void_or_refund,
  creates_customer_advance, creates_customer_credit, restores_stored_value,
  creates_multi_target_allocation, uses_allocation_policy, requires_allocation_details,
  requires_permission, permission_code, requires_reason, requires_approval, display_order
) VALUES
  (
    'REDUCE_PAYMENT', 'Reduce Payment Amount', 'تخفيض مبلغ الدفع',
    'Reduce entered payment amount before posting.', 'تخفيض مبلغ الدفع المدخل قبل الترحيل.',
    true, true, true, true, true, true, false,
    false, true, false, false, false, false, false, false, false, false, NULL, false, false, 10
  ),
  (
    'RETURN_CASH_CHANGE', 'Return Cash Change', 'إرجاع الباقي نقداً',
    'Return excess cash as change to customer.', 'إرجاع الزيادة النقدية كباقي للعميل.',
    true, false, false, false, false, false, false,
    true, false, false, false, false, false, false, false, false, false, NULL, false, false, 20
  ),
  (
    'VOID_OR_REFUND_EXCESS', 'Void or Refund Excess', 'إلغاء أو رد الزيادة',
    'Void authorization or refund captured excess.', 'إلغاء التفويض أو رد المبلغ الزائد.',
    false, true, true, true, false, true, false,
    false, false, true, false, false, false, false, false, false, true, 'order_payment:refund_excess', true, true, 30
  ),
  (
    'SAVE_AS_CUSTOMER_ADVANCE', 'Save as Customer Advance', 'حفظ كدفعة مقدمة',
    'Convert excess to customer advance liability.', 'تحويل المبلغ الزائد إلى دفعة مقدمة.',
    true, true, true, true, true, true, true,
    false, false, false, true, false, false, false, false, false, true, 'orders:overpayment_to_advance', false, false, 40
  ),
  (
    'SAVE_AS_CUSTOMER_CREDIT', 'Save as Customer Credit', 'حفظ كرصيد عميل',
    'Convert excess to customer credit balance.', 'تحويل المبلغ الزائد إلى رصيد عميل.',
    true, true, true, true, true, true, true,
    false, false, false, false, true, false, false, false, false, true, 'orders:overpayment_to_credit', false, false, 50
  ),
  (
    'RESTORE_STORED_VALUE', 'Restore Stored Value', 'استعادة القيمة المخزنة',
    'Restore excess applied stored value to source.', 'استعادة القيمة المخزنة الزائدة إلى مصدرها.',
    false, false, false, false, false, false, true,
    false, false, false, false, false, true, false, false, false, false, NULL, false, false, 60
  ),
  (
    'ALLOCATE_TO_CUSTOMER_BALANCES', 'Manual Allocate to Balances', 'توزيع يدوي على الأرصدة',
    'Cashier manually allocates excess to customer balances.', 'توزيع يدوي للمبلغ الزائد على أرصدة العميل.',
    true, true, true, true, true, true, false,
    false, false, false, false, false, false, true, false, true, true, 'orders:overpayment_allocate', false, false, 70
  ),
  (
    'AUTO_ALLOCATE_TO_CUSTOMER_BALANCES', 'Auto Allocate Oldest Balances', 'توزيع آلي على الأرصدة',
    'System auto-allocates excess by tenant policy.', 'توزيع آلي للمبلغ الزائد حسب سياسة المنشأة.',
    true, true, true, true, true, true, false,
    false, false, false, false, false, false, true, true, true, true, 'orders:overpayment_allocate', false, false, 80
  )
ON CONFLICT (resolution_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  allowed_for_cash = EXCLUDED.allowed_for_cash,
  allowed_for_card = EXCLUDED.allowed_for_card,
  allowed_for_gateway = EXCLUDED.allowed_for_gateway,
  allowed_for_bank = EXCLUDED.allowed_for_bank,
  allowed_for_check = EXCLUDED.allowed_for_check,
  allowed_for_mobile = EXCLUDED.allowed_for_mobile,
  allowed_for_stored_value = EXCLUDED.allowed_for_stored_value,
  creates_change_return = EXCLUDED.creates_change_return,
  creates_payment_reduction = EXCLUDED.creates_payment_reduction,
  creates_void_or_refund = EXCLUDED.creates_void_or_refund,
  creates_customer_advance = EXCLUDED.creates_customer_advance,
  creates_customer_credit = EXCLUDED.creates_customer_credit,
  restores_stored_value = EXCLUDED.restores_stored_value,
  creates_multi_target_allocation = EXCLUDED.creates_multi_target_allocation,
  uses_allocation_policy = EXCLUDED.uses_allocation_policy,
  requires_allocation_details = EXCLUDED.requires_allocation_details,
  requires_permission = EXCLUDED.requires_permission,
  permission_code = EXCLUDED.permission_code,
  requires_reason = EXCLUDED.requires_reason,
  requires_approval = EXCLUDED.requires_approval,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ==================================================================
-- 12. Catalog seeds — allocation modes, fallback, remaining balance, source types
-- ==================================================================

INSERT INTO sys_fin_rcpt_alloc_mode_cd (
  allocation_mode, name, name2, description, description2,
  sort_by_due_date, sort_by_document_date, uses_target_priority, is_manual_only, display_order
) VALUES
  ('AUTO_OLDEST_DUE', 'Auto Oldest Due', 'آلي حسب الأقدم استحقاقاً',
   'Allocate by due date ascending.', 'توزيع حسب تاريخ الاستحقاق تصاعدياً.',
   true, false, true, false, 10),
  ('AUTO_OLDEST_DOCUMENT', 'Auto Oldest Document', 'آلي حسب أقدم مستند',
   'Allocate by document date ascending.', 'توزيع حسب تاريخ المستند تصاعدياً.',
   false, true, false, false, 20),
  ('AUTO_PRIORITY_THEN_OLDEST', 'Auto Priority Then Oldest', 'آلي حسب الأولوية ثم الأقدم',
   'Priority then oldest due/document.', 'الأولوية ثم الأقدم استحقاقاً أو مستنداً.',
   true, true, true, false, 30),
  ('MANUAL_ONLY', 'Manual Only', 'يدوي فقط',
   'Cashier selects targets manually.', 'اختيار الأهداف يدوياً.',
   false, false, false, true, 40)
ON CONFLICT (allocation_mode) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  sort_by_due_date = EXCLUDED.sort_by_due_date,
  sort_by_document_date = EXCLUDED.sort_by_document_date,
  uses_target_priority = EXCLUDED.uses_target_priority,
  is_manual_only = EXCLUDED.is_manual_only,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO sys_fin_rcpt_fb_dest_cd (
  fallback_destination, name, name2, description, description2,
  line_role, target_type,
  creates_wallet_topup, creates_customer_advance, creates_customer_credit,
  creates_cash_change, blocks_posting, requires_cash, display_order
) VALUES
  (
    'CUSTOMER_ADVANCE', 'Customer Advance', 'دفعة مقدمة للعميل',
    'Remaining excess becomes customer advance.', 'المبلغ المتبقي يصبح دفعة مقدمة.',
    'CUSTOMER_ADVANCE_RECEIPT', 'CUSTOMER',
    false, true, false, false, false, false, 10
  ),
  (
    'WALLET_TOPUP', 'Wallet Top-up', 'شحن محفظة',
    'Remaining excess tops up wallet.', 'المبلغ المتبقي يشحن المحفظة.',
    'WALLET_TOPUP', 'WALLET',
    true, false, false, false, false, false, 20
  ),
  (
    'CUSTOMER_CREDIT', 'Customer Credit', 'رصيد عميل',
    'Remaining excess becomes customer credit.', 'المبلغ المتبقي يصبح رصيد عميل.',
    'CUSTOMER_CREDIT_ISSUE', 'CUSTOMER',
    false, false, true, false, false, false, 30
  ),
  (
    'RETURN_CHANGE', 'Return Change', 'إرجاع الباقي',
    'Remaining excess returned as cash change.', 'المبلغ المتبقي يعاد كباقي نقدي.',
    NULL, NULL,
    false, false, false, true, false, true, 40
  ),
  (
    'BLOCK_AND_REQUIRE_MANUAL_ACTION', 'Block Manual Action Required', 'منع وطلب إجراء يدوي',
    'Posting blocked until cashier resolves excess.', 'منع الترحيل حتى حل الزيادة يدوياً.',
    NULL, NULL,
    false, false, false, false, true, false, 50
  )
ON CONFLICT (fallback_destination) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  line_role = EXCLUDED.line_role, target_type = EXCLUDED.target_type,
  creates_wallet_topup = EXCLUDED.creates_wallet_topup,
  creates_customer_advance = EXCLUDED.creates_customer_advance,
  creates_customer_credit = EXCLUDED.creates_customer_credit,
  creates_cash_change = EXCLUDED.creates_cash_change,
  blocks_posting = EXCLUDED.blocks_posting,
  requires_cash = EXCLUDED.requires_cash,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO sys_fin_rem_bal_policy_cd (
  policy_code, name, name2, description, description2,
  requires_zero_remaining, creates_pay_on_collection_due, creates_ar_invoice,
  creates_ar_ledger, creates_statement_entry, requires_customer_account,
  requires_b2b_customer, requires_credit_limit_check, requires_approval,
  resulting_payment_status, display_order
) VALUES
  (
    'FULL_PAYMENT', 'Full Payment', 'دفع كامل',
    'Remaining balance must be zero before submit.', 'يجب أن يكون الرصيد المتبقي صفراً.',
    true, false, false, false, false, false, false, false, false, 'PAID', 10
  ),
  (
    'PAY_ON_COLLECTION', 'Pay on Collection', 'الدفع عند الاستلام',
    'Remainder collected at pickup/delivery.', 'المتبقي يُحصل عند الاستلام.',
    false, true, false, false, false, false, false, false, false, 'PENDING_COLLECTION', 20
  ),
  (
    'CREDIT_INVOICE', 'Credit Invoice', 'فاتورة آجلة',
    'Remainder becomes AR invoice.', 'المتبقي يتحول إلى فاتورة ذمم.',
    false, false, true, true, false, true, false, true, false, 'PARTIALLY_PAID', 30
  ),
  (
    'B2B_STATEMENT', 'B2B Statement', 'كشف حساب شركات',
    'Remainder allocated to B2B statement.', 'المتبقي يُخصص لكشف شركات.',
    false, false, true, true, true, true, true, true, false, 'PARTIALLY_PAID', 40
  )
ON CONFLICT (policy_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  requires_zero_remaining = EXCLUDED.requires_zero_remaining,
  creates_pay_on_collection_due = EXCLUDED.creates_pay_on_collection_due,
  creates_ar_invoice = EXCLUDED.creates_ar_invoice,
  creates_ar_ledger = EXCLUDED.creates_ar_ledger,
  creates_statement_entry = EXCLUDED.creates_statement_entry,
  requires_customer_account = EXCLUDED.requires_customer_account,
  requires_b2b_customer = EXCLUDED.requires_b2b_customer,
  requires_credit_limit_check = EXCLUDED.requires_credit_limit_check,
  requires_approval = EXCLUDED.requires_approval,
  resulting_payment_status = EXCLUDED.resulting_payment_status,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO sys_fin_vch_source_type_cd (
  source_type, name, name2, description, description2, source_family,
  originates_from_order, originates_from_customer_account, originates_from_ar,
  originates_from_b2b_statement, originates_from_wallet, originates_from_gift_card,
  originates_from_refund, originates_from_gateway_callback, is_manual, display_order
) VALUES
  ('ORDER_SUBMIT', 'Order Submit', 'حفظ الطلب', 'Voucher from initial order submit.', 'السند من حفظ الطلب.', 'ORDER', true, false, false, false, false, false, false, false, false, 10),
  ('ORDER_PAYMENT_MODAL', 'Order Payment Modal', 'نافذة دفع الطلب', 'Voucher from payment modal.', 'السند من نافذة الدفع.', 'ORDER', true, false, false, false, false, false, false, false, false, 20),
  ('CUSTOMER_RECEIPT', 'Customer Receipt', 'قبض عميل', 'General customer receipt.', 'قبض عام من عميل.', 'CUSTOMER_ACCOUNT', false, true, false, false, false, false, false, false, false, 30),
  ('ACCOUNT_RECEIPT', 'Account Receipt', 'قبض حساب', 'Account-level customer receipt.', 'قبض على مستوى الحساب.', 'CUSTOMER_ACCOUNT', false, true, false, false, false, false, false, false, false, 40),
  ('POS_OVERPAYMENT_ALLOCATION', 'POS Overpayment Allocation', 'توزيع زيادة نقطة البيع', 'POS excess allocated to balances.', 'توزيع زيادة نقطة البيع.', 'CUSTOMER_ACCOUNT', true, true, false, false, false, false, false, false, false, 50),
  ('CUSTOMER_ACCOUNT_PAYMENT', 'Customer Account Payment', 'دفع حساب عميل', 'Customer pays account balances.', 'دفع أرصدة حساب العميل.', 'CUSTOMER_ACCOUNT', false, true, false, false, false, false, false, false, false, 60),
  ('AR_INVOICE_COLLECTION', 'AR Invoice Collection', 'تحصيل فاتورة ذمم', 'AR invoice collection.', 'تحصيل فاتورة ذمم.', 'AR', false, false, true, false, false, false, false, false, false, 70),
  ('B2B_STATEMENT_COLLECTION', 'B2B Statement Collection', 'تحصيل كشف شركات', 'B2B statement collection.', 'تحصيل كشف شركات.', 'B2B_STATEMENT', false, false, false, true, false, false, false, false, false, 80),
  ('WALLET_TOPUP', 'Wallet Top-up', 'شحن محفظة', 'Wallet top-up origin.', 'منشأ شحن محفظة.', 'WALLET', false, true, false, false, true, false, false, false, false, 90),
  ('GIFT_CARD_SALE', 'Gift Card Sale', 'بيع بطاقة هدية', 'Gift card sale origin.', 'منشأ بيع بطاقة هدية.', 'GIFT_CARD', false, true, false, false, false, true, false, false, false, 100),
  ('CUSTOMER_ADVANCE_RECEIPT', 'Customer Advance Receipt', 'قبض دفعة مقدمة', 'Customer advance receipt.', 'قبض دفعة مقدمة.', 'ADVANCE', false, true, false, false, false, false, false, false, false, 110),
  ('MANUAL_VOUCHER', 'Manual Voucher', 'سند يدوي', 'Manually created voucher.', 'سند يدوي.', 'MANUAL', false, false, false, false, false, false, false, false, true, 120),
  ('GATEWAY_CALLBACK', 'Gateway Callback', 'استجابة بوابة دفع', 'Payment gateway callback.', 'استجابة بوابة الدفع.', 'GATEWAY', false, false, false, false, false, false, false, true, false, 130),
  ('REFUND_PROCESS', 'Refund Process', 'عملية مردود', 'Refund process origin.', 'منشأ عملية مردود.', 'REFUND', false, false, false, false, false, false, true, false, false, 140)
ON CONFLICT (source_type) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  source_family = EXCLUDED.source_family,
  originates_from_order = EXCLUDED.originates_from_order,
  originates_from_customer_account = EXCLUDED.originates_from_customer_account,
  originates_from_ar = EXCLUDED.originates_from_ar,
  originates_from_b2b_statement = EXCLUDED.originates_from_b2b_statement,
  originates_from_wallet = EXCLUDED.originates_from_wallet,
  originates_from_gift_card = EXCLUDED.originates_from_gift_card,
  originates_from_refund = EXCLUDED.originates_from_refund,
  originates_from_gateway_callback = EXCLUDED.originates_from_gateway_callback,
  is_manual = EXCLUDED.is_manual,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ==================================================================
-- 13. Default allocation policy for demo/test tenants
-- ==================================================================

INSERT INTO org_fin_rcpt_alloc_policy_cf (
  id, tenant_org_id, branch_id, policy_code, name, name2,
  is_default, is_active, allocation_mode, fallback_destination,
  require_confirmation_before_posting, created_by
)
SELECT
  gen_random_uuid(),
  t.id,
  NULL,
  'DEFAULT_OLDEST_DUE',
  'Default Oldest Due Allocation',
  'التوزيع الافتراضي حسب الأقدم استحقاقاً',
  true,
  true,
  'AUTO_OLDEST_DUE',
  'CUSTOMER_ADVANCE',
  true,
  'seed'
FROM org_tenants_mst t
WHERE t.is_hq_test_demo = true
  AND NOT EXISTS (
    SELECT 1
    FROM org_fin_rcpt_alloc_policy_cf p
    WHERE p.tenant_org_id = t.id
      AND p.policy_code = 'DEFAULT_OLDEST_DUE'
      AND p.branch_id IS NULL
  );

-- ==================================================================
-- 14. Permissions — allocation (Phase 4 prep; seeded now for RBAC completeness)
-- ==================================================================

INSERT INTO sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  (
    'orders:overpayment_allocate',
    'Allocate Overpayment to Balances',
    'توزيع فائض الدفع على الأرصدة',
    'actions',
    'Manual or auto allocate checkout excess to customer balances',
    'توزيع فائض الدفع يدوياً أو آلياً على أرصدة العميل',
    'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'orders:overpayment_to_credit',
    'Overpayment to Customer Credit',
    'فائض الدفع إلى رصيد عميل',
    'actions',
    'Issue customer credit from checkout overpayment',
    'إصدار رصيد عميل من فائض الدفع',
    'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'operator', 'branch_manager')
  AND p.code IN ('orders:overpayment_allocate', 'orders:overpayment_to_credit')
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
