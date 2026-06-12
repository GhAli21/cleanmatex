import {
  CUSTOMER_RECEIPT_ALLOCATION_MODES,
  CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS,
  OVERPAYMENT_RESOLUTIONS,
  SETTLEMENT_MONEY_EPSILON,
  VOUCHER_SOURCE_TYPES,
} from '@/lib/constants/settlement-catalog';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';

describe('settlement-catalog constants', () => {
  it('mirrors org_fin_overpay_disp_dtl resolution CHECK constraint', () => {
    const auditCodes = [
      OVERPAYMENT_RESOLUTIONS.REDUCE_PAYMENT,
      OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE,
      OVERPAYMENT_RESOLUTIONS.VOID_OR_REFUND_EXCESS,
      OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE,
      OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
      OVERPAYMENT_RESOLUTIONS.RESTORE_STORED_VALUE,
      OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES,
      OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
    ];
    expect(new Set(auditCodes).size).toBe(auditCodes.length);
  });

  it('uses production INVOICE target (not AR_INVOICE) for invoice payments', () => {
    expect(TARGET_TYPE.INVOICE).toBe('INVOICE');
    expect(LINE_ROLE.INVOICE_PAYMENT).toBe('INVOICE_PAYMENT');
  });

  it('defines CUSTOMER_CREDIT_ISSUE as canonical credit issue role', () => {
    expect(LINE_ROLE.CUSTOMER_CREDIT_ISSUE).toBe('CUSTOMER_CREDIT_ISSUE');
    expect(LINE_ROLE.CUSTOMER_CREDIT_RECEIPT).toBe('CUSTOMER_CREDIT_RECEIPT');
  });

  it('defines allocation catalog codes for Phase 4', () => {
    expect(CUSTOMER_RECEIPT_ALLOCATION_MODES.AUTO_OLDEST_DUE).toBe('AUTO_OLDEST_DUE');
    expect(CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.CUSTOMER_ADVANCE).toBe('CUSTOMER_ADVANCE');
  });

  it('defines voucher source types for BVM origin tracking', () => {
    expect(VOUCHER_SOURCE_TYPES.ORDER_PAYMENT_MODAL).toBe('ORDER_PAYMENT_MODAL');
    expect(VOUCHER_SOURCE_TYPES.POS_OVERPAYMENT_ALLOCATION).toBe('POS_OVERPAYMENT_ALLOCATION');
  });

  it('uses standard money epsilon', () => {
    expect(SETTLEMENT_MONEY_EPSILON).toBe(0.001);
  });
});
