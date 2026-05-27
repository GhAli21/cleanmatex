/**
 * Tests: lib/utils/money.ts
 *
 * Why these tests exist:
 * Money math drift on 3-decimal currencies (OMR, BHD, KWD) and split-payment
 * accumulators is the source of the audit's S6 finding. These tests pin the
 * helper behavior at scale 4 so a regression on the helper itself surfaces
 * loudly rather than silently corrupting AR allocations.
 */

import { Decimal } from '@prisma/client/runtime/library';
import {
  toDecimal,
  addMoney,
  subMoney,
  mulMoney,
  roundMoney,
  sumMoney,
  eqMoney,
  compareMoney,
  decimalToNumber,
  MONEY_SCALE,
} from '@/lib/utils/money';

describe('money helpers', () => {
  describe('toDecimal', () => {
    it('coerces number / string / Decimal / null / undefined', () => {
      expect(toDecimal(0).toString()).toBe('0');
      expect(toDecimal(1.23).toString()).toBe('1.23');
      expect(toDecimal('4.56').toString()).toBe('4.56');
      expect(toDecimal(new Decimal('7.89')).toString()).toBe('7.89');
      expect(toDecimal(null).toString()).toBe('0');
      expect(toDecimal(undefined).toString()).toBe('0');
    });

    it('throws on non-finite numbers', () => {
      expect(() => toDecimal(NaN)).toThrow(/finite/);
      expect(() => toDecimal(Infinity)).toThrow(/finite/);
      expect(() => toDecimal(-Infinity)).toThrow(/finite/);
    });
  });

  describe('addMoney / subMoney / mulMoney', () => {
    it('addMoney sums to scale 4', () => {
      expect(addMoney(0.1, 0.2).toString()).toBe('0.3');
      expect(addMoney('10.0001', '20.0001').toString()).toBe('30.0002');
    });

    it('subMoney subtracts to scale 4', () => {
      expect(subMoney(1, 0.7).toString()).toBe('0.3');
      expect(subMoney('100', '33.333').toString()).toBe('66.667');
    });

    it('mulMoney multiplies to scale 4 and rounds', () => {
      // 0.1 * 0.2 → 0.02 (clean), 1.005 * 2 → 2.01
      expect(mulMoney(0.1, 0.2).toString()).toBe('0.02');
      expect(mulMoney('1.005', 2).toString()).toBe('2.01');
    });

    it('rounds at the canonical scale', () => {
      // 0.12345 → 0.1235 (banker's rounding via Decimal.toDecimalPlaces)
      const rounded = roundMoney(0.12345);
      expect(rounded.toString()).toBe('0.1235');
    });
  });

  describe('sumMoney', () => {
    it('returns 0 for empty array', () => {
      expect(sumMoney([]).toString()).toBe('0');
    });

    it('sums a list of legs without float drift', () => {
      // Classic split-payment failure on plain JS floats: 33.333 + 33.333 + 33.334 = 100.0000000003
      const result = sumMoney([33.333, 33.333, 33.334]);
      expect(result.toString()).toBe('100');
    });

    it('handles 3-decimal-currency legs (OMR scenario)', () => {
      // OMR sub-Bisa precision; sum must stay at scale 4 internally
      const legs = [10.001, 10.002, 10.003, 10.004];
      expect(sumMoney(legs).toString()).toBe('40.01');
    });
  });

  describe('eqMoney / compareMoney', () => {
    it('eqMoney treats 0.30000001 and 0.30000002 as equal at scale 4', () => {
      expect(eqMoney(0.30000001, 0.30000002)).toBe(true);
      expect(eqMoney(0.3001, 0.3002)).toBe(false);
    });

    it('compareMoney returns -1 / 0 / 1', () => {
      expect(compareMoney(1, 2)).toBe(-1);
      expect(compareMoney(2, 2)).toBe(0);
      expect(compareMoney(3, 2)).toBe(1);
    });
  });

  describe('decimalToNumber', () => {
    it('round-trips through JS number', () => {
      expect(decimalToNumber('123.45')).toBe(123.45);
      expect(decimalToNumber(0)).toBe(0);
      expect(decimalToNumber(null)).toBe(0);
    });
  });

  describe('MONEY_SCALE constant', () => {
    it('matches DB DECIMAL(19,4)', () => {
      expect(MONEY_SCALE).toBe(4);
    });
  });
});
