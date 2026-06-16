import {
  normalizeVoucherLinePaymentStatus,
  VOUCHER_LINE_PAYMENT_STATUS,
} from '@/lib/constants/voucher';

describe('normalizeVoucherLinePaymentStatus', () => {
  it('maps async gateway statuses to PENDING for voucher lines', () => {
    expect(normalizeVoucherLinePaymentStatus('PROCESSING')).toBe(
      VOUCHER_LINE_PAYMENT_STATUS.PENDING
    );
    expect(normalizeVoucherLinePaymentStatus('CAPTURE_PENDING')).toBe(
      VOUCHER_LINE_PAYMENT_STATUS.PENDING
    );
  });

  it('passes through allowed terminal statuses', () => {
    expect(normalizeVoucherLinePaymentStatus('COMPLETED')).toBe('COMPLETED');
    expect(normalizeVoucherLinePaymentStatus('PENDING')).toBe('PENDING');
    expect(normalizeVoucherLinePaymentStatus('FAILED')).toBe('FAILED');
  });

  it('returns null for empty input', () => {
    expect(normalizeVoucherLinePaymentStatus(null)).toBeNull();
    expect(normalizeVoucherLinePaymentStatus('')).toBeNull();
  });
});
