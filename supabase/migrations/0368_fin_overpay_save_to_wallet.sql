-- Migration: 0368_fin_overpay_save_to_wallet
-- Purpose: Add SAVE_TO_CUSTOMER_WALLET overpayment resolution catalog row (ADR-050)
-- Permission orders:overpayment_to_wallet already seeded in 0354_order_overpay_disposition.sql

BEGIN;

INSERT INTO sys_fin_overpay_res_cd (
  resolution_code, name, name2, description, description2,
  allowed_for_cash, allowed_for_card, allowed_for_gateway, allowed_for_bank,
  allowed_for_check, allowed_for_mobile, allowed_for_stored_value,
  creates_change_return, creates_payment_reduction, creates_void_or_refund,
  creates_customer_advance, creates_customer_credit, restores_stored_value,
  creates_multi_target_allocation, uses_allocation_policy, requires_allocation_details,
  requires_permission, permission_code, requires_reason, requires_approval, display_order,
  metadata
) VALUES (
  'SAVE_TO_CUSTOMER_WALLET',
  'Save to Customer Wallet',
  'حفظ في محفظة العميل',
  'Credit checkout excess to customer wallet balance for future payments.',
  'إيداع فائض الدفع في رصيد محفظة العميل للمدفوعات المستقبلية.',
  true, true, true, true, true, true, true,
  false, false, false, false, false, false, false, false, false,
  true, 'orders:overpayment_to_wallet', false, false, 45,
  '{"creates_wallet_topup": true}'::jsonb
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
  requires_permission = EXCLUDED.requires_permission,
  permission_code = EXCLUDED.permission_code,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

COMMIT;
