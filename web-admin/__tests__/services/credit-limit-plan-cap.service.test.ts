/**
 * Unit tests for credit-limit-plan-cap.service
 * Pure function capCreditLimitToPlan
 */

import { capCreditLimitToPlan } from '@/lib/services/credit-limit-plan-cap.service';

describe('credit-limit-plan-cap.service', () => {
  describe('capCreditLimitToPlan', () => {
    it('returns requested when planCap is null', () => {
      expect(capCreditLimitToPlan(5000, null)).toBe(5000);
      expect(capCreditLimitToPlan(100, null)).toBe(100);
    });

    it('returns requested when planCap is 0', () => {
      expect(capCreditLimitToPlan(5000, 0)).toBe(5000);
    });

    it('caps to plan when requested exceeds plan', () => {
      expect(capCreditLimitToPlan(10000, 5000)).toBe(5000);
      expect(capCreditLimitToPlan(6000, 5000)).toBe(5000);
    });

    it('returns requested when within plan cap', () => {
      expect(capCreditLimitToPlan(3000, 5000)).toBe(3000);
      expect(capCreditLimitToPlan(5000, 5000)).toBe(5000);
    });

    it('handles zero requested', () => {
      expect(capCreditLimitToPlan(0, 5000)).toBe(0);
    });
  });
});
