import {
  normalizeCustomerPhone,
  normalizeCustomerEmail,
  maskCustomerPhone,
  maskCustomerEmail,
} from '@/lib/utils/customer-identity';

describe('customer-identity utilities', () => {
  describe('normalizeCustomerPhone', () => {
    it('preserves valid E.164 numbers and strips formatting', () => {
      const result = normalizeCustomerPhone('+968 9012-3456');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+96890123456');
      expect(result.countryCode).toBe('+968');
    });

    it('converts leading 00 international prefix to +', () => {
      const result = normalizeCustomerPhone('00968 9012 3456');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+96890123456');
    });

    it('prepends tenant default country code to local numbers', () => {
      const result = normalizeCustomerPhone('9012 3456', '+968');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+96890123456');
    });

    it('strips leading trunk zero before prepending default country code', () => {
      const result = normalizeCustomerPhone('0501234567', '+971');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+971501234567');
    });

    it('rejects too-short or non-numeric phone numbers', () => {
      expect(normalizeCustomerPhone('1234').isValid).toBe(false);
      expect(normalizeCustomerPhone('abc-def').isValid).toBe(false);
    });
  });

  describe('normalizeCustomerEmail', () => {
    it('trims and lowercases valid emails', () => {
      const result = normalizeCustomerEmail('  Ahmed.Ali@Example.COM  ');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('ahmed.ali@example.com');
    });

    it('rejects invalid email formats', () => {
      expect(normalizeCustomerEmail('not-an-email').isValid).toBe(false);
      expect(normalizeCustomerEmail('').isValid).toBe(false);
    });
  });

  describe('maskCustomerPhone & maskCustomerEmail', () => {
    it('masks phone middle digits', () => {
      expect(maskCustomerPhone('+96890123456')).toBe('+96890****56');
    });

    it('masks email local part while keeping domain', () => {
      expect(maskCustomerEmail('Ahmed.Ali@Example.com')).toBe('ah***@example.com');
    });
  });
});
