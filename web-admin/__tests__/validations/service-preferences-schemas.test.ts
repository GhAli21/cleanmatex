/**
 * Unit Tests: Service Preferences Schemas
 * Tests for Zod validation of preference-related API inputs
 */

import {
  addServicePrefSchema,
  addPieceServicePrefSchema,
  updatePackingPrefSchema,
  addCustomerServicePrefSchema,
  applyBundleSchema,
  preferenceBundleSchema,
} from '@/lib/validations/service-preferences-schemas';

describe('Service Preferences Schemas', () => {
  describe('addServicePrefSchema', () => {
    it('should accept valid input', () => {
      const result = addServicePrefSchema.safeParse({
        preference_code: 'STARCH_LIGHT',
        source: 'manual',
        extra_price: 2.5,
      });
      expect(result.success).toBe(true);
    });

    it('should default source to manual', () => {
      const result = addServicePrefSchema.safeParse({
        preference_code: 'PERFUME',
        extra_price: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.source).toBe('manual');
    });

    it('should reject invalid preference_code', () => {
      const result = addServicePrefSchema.safeParse({
        preference_code: 'INVALID_CODE',
        extra_price: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative extra_price', () => {
      const result = addServicePrefSchema.safeParse({
        preference_code: 'STARCH_LIGHT',
        extra_price: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addPieceServicePrefSchema', () => {
    it('should accept valid input', () => {
      const result = addPieceServicePrefSchema.safeParse({
        preference_code: 'DELICATE',
        source: 'manual',
        extra_price: 3,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updatePackingPrefSchema', () => {
    it('should accept valid packing_pref_code', () => {
      const result = updatePackingPrefSchema.safeParse({
        packing_pref_code: 'HANG',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid packing_pref_code', () => {
      const result = updatePackingPrefSchema.safeParse({
        packing_pref_code: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addCustomerServicePrefSchema', () => {
    it('should accept valid input', () => {
      const result = addCustomerServicePrefSchema.safeParse({
        preference_code: 'STARCH_HEAVY',
        source: 'manual',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('applyBundleSchema', () => {
    it('should accept valid bundle_code', () => {
      const result = applyBundleSchema.safeParse({
        bundle_code: 'CARE_PACKAGE_1',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty bundle_code', () => {
      const result = applyBundleSchema.safeParse({
        bundle_code: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('preferenceBundleSchema', () => {
    it('should accept valid bundle create input', () => {
      const result = preferenceBundleSchema.safeParse({
        bundle_code: 'CARE_001',
        name: 'Care Package',
        preference_codes: ['STARCH_LIGHT', 'PERFUME'],
        discount_percent: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should default discount_percent and discount_amount to 0', () => {
      const result = preferenceBundleSchema.safeParse({
        bundle_code: 'BUNDLE_1',
        name: 'Test Bundle',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discount_percent).toBe(0);
        expect(result.data.discount_amount).toBe(0);
      }
    });

    it('should reject empty bundle_code', () => {
      const result = preferenceBundleSchema.safeParse({
        bundle_code: '',
        name: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = preferenceBundleSchema.safeParse({
        bundle_code: 'B1',
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject discount_percent > 100', () => {
      const result = preferenceBundleSchema.safeParse({
        bundle_code: 'B1',
        name: 'Test',
        discount_percent: 101,
      });
      expect(result.success).toBe(false);
    });
  });
});
