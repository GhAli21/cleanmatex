import {
  triStateToBoolean,
  booleanToTriState,
  nullableStringToFormValue,
  formStringToNullable,
} from '@/src/features/payment-config/ui/d9-routing-helpers';

describe('d9-routing-helpers — BVM Phase 6 Sub-item 5', () => {
  describe('triStateToBoolean', () => {
    it("returns null for '' (inherit)", () => {
      expect(triStateToBoolean('')).toBeNull();
    });
    it("returns true for 'true'", () => {
      expect(triStateToBoolean('true')).toBe(true);
    });
    it("returns false for 'false'", () => {
      expect(triStateToBoolean('false')).toBe(false);
    });
  });

  describe('booleanToTriState', () => {
    it("returns '' for null (inherit)", () => {
      expect(booleanToTriState(null)).toBe('');
    });
    it("returns '' for undefined (inherit)", () => {
      expect(booleanToTriState(undefined)).toBe('');
    });
    it("returns 'true' for true", () => {
      expect(booleanToTriState(true)).toBe('true');
    });
    it("returns 'false' for false", () => {
      expect(booleanToTriState(false)).toBe('false');
    });
  });

  describe('nullableStringToFormValue', () => {
    it("returns '' for null (inherit)", () => {
      expect(nullableStringToFormValue(null)).toBe('');
    });
    it("returns '' for undefined", () => {
      expect(nullableStringToFormValue(undefined)).toBe('');
    });
    it('preserves the original string', () => {
      expect(nullableStringToFormValue('PAY_IN_ADVANCE')).toBe('PAY_IN_ADVANCE');
    });
  });

  describe('formStringToNullable', () => {
    it("returns null for '' (inherit)", () => {
      expect(formStringToNullable('')).toBeNull();
    });
    it('preserves the original string', () => {
      expect(formStringToNullable('PAY_ON_COLLECTION')).toBe('PAY_ON_COLLECTION');
    });
  });

  describe('round-trip invariants', () => {
    it('boolean → string → boolean preserves the value', () => {
      for (const v of [true, false, null] as const) {
        expect(triStateToBoolean(booleanToTriState(v))).toBe(v);
      }
    });
    it('nullable string → string → nullable string preserves the value', () => {
      for (const v of ['PAY_IN_ADVANCE', 'CREDIT_INVOICE', null]) {
        expect(formStringToNullable(nullableStringToFormValue(v))).toBe(v);
      }
    });
  });
});
