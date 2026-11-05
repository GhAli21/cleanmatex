/**
 * HFC P3: external tag format and code look-alikes (same rules as DB ck_ord_piece_barcode_fmt / trg_ord_piece_tag_rules).
 */
import {
  EXTERNAL_TAG_ERROR,
  EXTERNAL_TAG_MAX_LENGTH,
  codeLookalikePattern,
  externalTagSchema,
  looksLikeCode,
} from '@/lib/validations/code-format-schemas';

const issue = (value: string) => {
  const r = externalTagSchema.safeParse(value);
  return r.success ? null : r.error.issues[0]?.message;
};

describe('externalTagSchema (A-36)', () => {
  it('trims and upper-cases a scanned tag', () => {
    expect(externalTagSchema.parse('  hs-00123\r\n')).toBe('HS-00123');
    expect(externalTagSchema.parse('a.b_c/d-9')).toBe('A.B_C/D-9');
    expect(externalTagSchema.parse('X'.repeat(EXTERNAL_TAG_MAX_LENGTH))).toHaveLength(64);
  });

  it('refuses blank, too long and characters outside A-Z 0-9 - _ . /', () => {
    expect(issue('   ')).toBe(EXTERNAL_TAG_ERROR.EMPTY);
    expect(issue('X'.repeat(EXTERNAL_TAG_MAX_LENGTH + 1))).toBe(EXTERNAL_TAG_ERROR.TOO_LONG);
    for (const bad of ['A B', 'A\tB', 'A\u0000B', 'وسم-1', 'TAG#1', 'É1', 'A:B']) {
      expect(issue(bad)).toBe(EXTERNAL_TAG_ERROR.BAD_CHARACTERS);
    }
  });
});

describe('looksLikeCode (A-37)', () => {
  it('refuses order numbers, line numbers, piece codes and staff QR payloads', () => {
    for (const v of ['ORD-20261101-0001', 'ord-20261101-0001-2', 'ORD-20261101-00009-S2-01-3', 'CMX1:ORD:ORD-1', 'cmx2:x', 'ORD1', 'ITM-1', 'PEC_7']) {
      expect(looksLikeCode(v)).toBe(true);
    }
  });

  it('refuses codes of any doc type prefix given', () => {
    expect(looksLikeCode('CUST-000123', ['CUST'])).toBe(true);
    expect(looksLikeCode('INV/2026/1', ['INV'])).toBe(true);
    expect(looksLikeCode('CN-1234ABCD-00001', ['CN'])).toBe(true);
    expect(looksLikeCode('CUST-000123')).toBe(false); // prefix not given
  });

  it('allows tags that only share letters with a prefix', () => {
    for (const v of ['ORDER-5', 'XORD-20261101-0001-1-1', 'HS-00123', 'ORD-A1', '12345']) {
      expect(looksLikeCode(v, ['CUST', 'INV'])).toBe(false);
    }
  });

  it('escapes prefixes and prefers the longest', () => {
    expect(codeLookalikePattern(['AB', 'ABC']).source).toContain('ABC|AB');
  });
});
