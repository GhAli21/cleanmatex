/**
 * Unit Tests for generateCode Utility
 * Customer Category code generation
 */

import { generateCode } from '@/lib/utils/generate-code';

describe('generateCode', () => {
  it('converts simple name to uppercase with underscore', () => {
    expect(generateCode('Walk in')).toBe('WALK_IN');
  });

  it('handles multiple words', () => {
    expect(generateCode('Hotel B2B')).toBe('HOTEL_B2B');
  });

  it('removes special characters', () => {
    expect(generateCode('Guest (VIP)')).toBe('GUEST_VIP');
  });

  it('preserves numbers', () => {
    expect(generateCode('B2B Corp')).toBe('B2B_CORP');
  });

  it('trims leading and trailing spaces', () => {
    expect(generateCode('  Stub  ')).toBe('STUB');
  });

  it('returns empty string for empty input', () => {
    expect(generateCode('')).toBe('');
  });

  it('handles single word', () => {
    expect(generateCode('guest')).toBe('GUEST');
  });

  it('handles multiple spaces between words', () => {
    expect(generateCode('Walk   In')).toBe('WALK_IN');
  });

  it('removes hyphens and other non-alphanumeric chars', () => {
    expect(generateCode('Walk-In-Customer')).toBe('WALKINCUSTOMER');
  });
});
