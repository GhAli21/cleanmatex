/** @jest-environment node */
import {
  isValidOrderNumber,
  isRootOrderNumber,
  parseOrderNumber,
  extractSequence,
  formatSequence,
  getOrderNumberPrefix,
} from '@/lib/services/order-numbering/order-number-format';

describe('order-number-format', () => {
  it('accepts root and sub-order numbers', () => {
    expect(isValidOrderNumber('ORD-20261030-0001')).toBe(true);
    expect(isValidOrderNumber('ORD-20261030-99999')).toBe(true);
    expect(isValidOrderNumber('ORD-20261030-0001-S1')).toBe(true);
    expect(isValidOrderNumber('ORD-20261030-0001-S12')).toBe(true);
  });

  it('rejects malformed values', () => {
    for (const v of ['', 'ORD-2026103-0001', 'ORD-20261030-001', 'ORD-20261030-0001-S0', 'ORD-20261030-0001-S', 'ORD-20261030-0001-123456', 'ord-20261030-0001', null, undefined]) {
      expect(isValidOrderNumber(v as string)).toBe(false);
    }
  });

  it('separates root numbers from sub-orders', () => {
    expect(isRootOrderNumber('ORD-20261030-0001')).toBe(true);
    expect(isRootOrderNumber('ORD-20261030-0001-S1')).toBe(false);
  });

  it('parses parts', () => {
    expect(parseOrderNumber('ORD-20261030-10001')).toEqual({
      orderNumber: 'ORD-20261030-10001',
      date: '20261030',
      sequence: 10001,
      subOrderIndex: null,
      rootOrderNumber: 'ORD-20261030-10001',
    });
    expect(parseOrderNumber('ORD-20261030-0007-S2')?.rootOrderNumber).toBe('ORD-20261030-0007');
    expect(parseOrderNumber('bad')).toBeNull();
  });

  it('extracts the sequence like the DB helper', () => {
    expect(extractSequence('ORD-20261030-0042')).toBe(42);
    expect(extractSequence('ORD-20261030-0042-S9')).toBe(42);
    expect(extractSequence('nope')).toBeNull();
  });

  it('pads to 4 digits and keeps longer values', () => {
    expect(formatSequence(1)).toBe('0001');
    expect(formatSequence(12345)).toBe('12345');
    expect(() => formatSequence(0)).toThrow();
    expect(() => formatSequence(1.5)).toThrow();
  });

  it('builds a display prefix', () => {
    expect(getOrderNumberPrefix(new Date(2026, 9, 30))).toBe('ORD-20261030-');
  });
});
