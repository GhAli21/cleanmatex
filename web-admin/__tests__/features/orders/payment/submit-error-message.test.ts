import {
  collectSubmitErrorDetails,
  formatErrorDetails,
  formatSubmitErrorMessage,
  resolveSubmitErrorCode,
  resolveSubmitToastMessage,
} from '@features/orders/payment/domain/submit-error-message';

describe('submit-error-message', () => {
  describe('resolveSubmitErrorCode', () => {
    it('prefers errorCode and falls back to a code-shaped error', () => {
      expect(resolveSubmitErrorCode({ errorCode: 'LOYALTY_BELOW_MIN_REDEEM' })).toBe(
        'LOYALTY_BELOW_MIN_REDEEM',
      );
      expect(resolveSubmitErrorCode({ error: 'LOYALTY_NOT_CONFIGURED' })).toBe(
        'LOYALTY_NOT_CONFIGURED',
      );
      expect(resolveSubmitErrorCode({ error: 'Order submission failed.' })).toBe('');
    });
  });

  describe('formatSubmitErrorMessage', () => {
    it('includes translated text, details, and the exact code', () => {
      expect(
        formatSubmitErrorMessage({
          message: 'Loyalty redemption is below the program minimum redeemable points.',
          errorCode: 'LOYALTY_BELOW_MIN_REDEEM',
          details: { minRedeemPoints: 100, pointsToRedeem: 50 },
        }),
      ).toBe(
        'Loyalty redemption is below the program minimum redeemable points. Min Redeem Points: 100 · Points To Redeem: 50 [LOYALTY_BELOW_MIN_REDEEM]',
      );
    });
  });

  describe('formatErrorDetails / collectSubmitErrorDetails', () => {
    it('merges nested details with top-level extras', () => {
      expect(
        collectSubmitErrorDetails({
          details: { minRedeemPoints: 100 },
          monetaryAmount: 0.5,
          creditLimit: 200,
        }),
      ).toEqual({
        minRedeemPoints: 100,
        monetaryAmount: 0.5,
        creditLimit: 200,
      });
    });

    it('humanizes object keys', () => {
      expect(formatErrorDetails({ minRedeemPoints: 100 })).toBe('Min Redeem Points: 100');
    });
  });

  describe('resolveSubmitToastMessage', () => {
    it('does not hide a typed loyalty code behind the generic 500 toast', () => {
      const result = resolveSubmitToastMessage({
        status: 500,
        json: {
          errorCode: 'LOYALTY_BELOW_MIN_REDEEM',
          error: 'LOYALTY_BELOW_MIN_REDEEM',
          details: { minRedeemPoints: 100, pointsToRedeem: 50 },
        },
        extractedText: '',
        translatedByCode: {
          LOYALTY_BELOW_MIN_REDEEM:
            'Loyalty redemption is below the program minimum redeemable points.',
        },
        genericServerError: 'A server error occurred.',
        orderCreationFailed: 'Failed to create order',
      });

      expect(result.errorCode).toBe('LOYALTY_BELOW_MIN_REDEEM');
      expect(result.message).toContain('Loyalty redemption is below the program minimum');
      expect(result.message).toContain('Min Redeem Points: 100');
      expect(result.message).toContain('[LOYALTY_BELOW_MIN_REDEEM]');
      expect(result.message).not.toContain('A server error occurred.');
    });

    it('keeps the generic copy only for a true unexpected 500', () => {
      const result = resolveSubmitToastMessage({
        status: 500,
        json: { error: 'Order submission failed.' },
        extractedText: '',
        translatedByCode: {},
        genericServerError: 'A server error occurred.',
        orderCreationFailed: 'Failed to create order',
      });

      expect(result.errorCode).toBe('');
      expect(result.message).toBe('A server error occurred.');
    });

    it('humanizes an unmapped 422 business code instead of dropping it', () => {
      const result = resolveSubmitToastMessage({
        status: 422,
        json: { errorCode: 'GIFT_CARD_NOT_FOUND', error: 'GIFT_CARD_NOT_FOUND' },
        extractedText: '',
        translatedByCode: {},
        genericServerError: 'A server error occurred.',
        orderCreationFailed: 'Failed to create order',
      });

      expect(result.message).toBe('Gift Card Not Found [GIFT_CARD_NOT_FOUND]');
    });
  });
});
