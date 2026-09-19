import {
  extractThrownErrorDetails,
  isStableErrorCode,
  throwBusinessError,
} from '@/lib/utils/business-error';

describe('business-error', () => {
  describe('isStableErrorCode', () => {
    it('accepts SCREAMING_SNAKE_CASE business codes', () => {
      expect(isStableErrorCode('LOYALTY_BELOW_MIN_REDEEM')).toBe(true);
      expect(isStableErrorCode('GIFT_CARD_NOT_FOUND')).toBe(true);
      expect(isStableErrorCode('A_B')).toBe(true);
    });

    it('rejects prose and non-codes', () => {
      expect(isStableErrorCode('Order submission failed.')).toBe(false);
      expect(isStableErrorCode('Product not found: abc')).toBe(false);
      expect(isStableErrorCode('loyalty_below_min_redeem')).toBe(false);
      expect(isStableErrorCode('AB')).toBe(false);
      expect(isStableErrorCode('')).toBe(false);
      expect(isStableErrorCode(null)).toBe(false);
    });
  });

  describe('throwBusinessError', () => {
    it('throws the code as the Error message and attaches details', () => {
      expect(() =>
        throwBusinessError('LOYALTY_BELOW_MIN_REDEEM', { minRedeemPoints: 100 }),
      ).toThrow('LOYALTY_BELOW_MIN_REDEEM');

      try {
        throwBusinessError('LOYALTY_BELOW_MIN_REDEEM', { minRedeemPoints: 100, pointsToRedeem: 50 });
      } catch (error) {
        expect(extractThrownErrorDetails(error)).toEqual({
          minRedeemPoints: 100,
          pointsToRedeem: 50,
        });
      }
    });
  });

  describe('extractThrownErrorDetails', () => {
    it('collects details plus known extra fields', () => {
      const error = Object.assign(new Error('B2B_CREDIT_EXCEEDED'), {
        details: { reason: 'limit' },
        creditLimit: 200,
        available: 10,
      });
      expect(extractThrownErrorDetails(error)).toEqual({
        reason: 'limit',
        creditLimit: 200,
        available: 10,
      });
    });

    it('returns undefined when nothing is attached', () => {
      expect(extractThrownErrorDetails(new Error('OTHER'))).toBeUndefined();
    });
  });
});
