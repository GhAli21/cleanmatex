/**
 * HFC P3b: scan input helpers in code-format-schemas (plan section 6.6).
 */
import {
  classifyCode,
  codeSearchSchema,
  normalizeScanInput,
  orderNoSchema,
  pieceCodeSchema,
  scanInputSchema,
  toAsciiDigits,
} from '@/lib/validations/code-format-schemas';

describe('normalizeScanInput', () => {
  it('drops control characters, AIM prefix and outer spaces', () => {
    expect(normalizeScanInput('\u001d]C0ORD-20261031-0001\r\n')).toBe('ORD-20261031-0001');
    expect(normalizeScanInput(']Q1CMX1:ORD:ORD-20261031-0001')).toBe('CMX1:ORD:ORD-20261031-0001');
    expect(normalizeScanInput('\tTAG-1 ')).toBe('TAG-1');
  });
  it('maps Arabic-Indic and Persian digits', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });
  it('keeps letter case', () => {
    expect(normalizeScanInput('tag-a')).toBe('tag-a');
  });
});

describe('classifyCode', () => {
  it.each([
    ['CMX1:PEC:ORD-20261031-0001-1-1', 'CMX'],
    ['ord-20261031-0001', 'ORDER'],
    ['ORD-20261031-0001-S2', 'ORDER'],
    ['ORD-20261031-0001-3', 'ITEM'],
    ['ORD-20261031-0001-S2-3', 'ITEM'],
    ['ORD-20261031-0001-3-12', 'PIECE'],
    ['TAG-77', 'UNKNOWN'],
    ['', 'UNKNOWN'],
  ])('%s -> %s', (raw, kind) => {
    expect(classifyCode(raw)).toBe(kind);
  });
});

describe('schemas', () => {
  it('scanInputSchema defaults context to any and caps raw at 128', () => {
    expect(scanInputSchema.parse({ raw: 'X' })).toEqual({ raw: 'X', context: 'any' });
    expect(scanInputSchema.safeParse({ raw: 'X'.repeat(129) }).success).toBe(false);
    expect(scanInputSchema.safeParse({ raw: '' }).success).toBe(false);
    expect(scanInputSchema.safeParse({ raw: 'X', context: 'nope' }).success).toBe(false);
  });
  it('orderNoSchema and pieceCodeSchema normalise and check the shape', () => {
    expect(orderNoSchema.parse(' ord-20261031-0001 ')).toBe('ORD-20261031-0001');
    expect(orderNoSchema.safeParse('ORD-20261031-0001-1').success).toBe(false);
    expect(pieceCodeSchema.parse('ord-20261031-0001-1-1')).toBe('ORD-20261031-0001-1-1');
    expect(pieceCodeSchema.safeParse('ORD-20261031-0001-1').success).toBe(false);
  });
  it('codeSearchSchema wants 2..64 characters', () => {
    expect(codeSearchSchema.safeParse('a').success).toBe(false);
    expect(codeSearchSchema.parse(' 0007 ')).toBe('0007');
    expect(codeSearchSchema.safeParse('x'.repeat(65)).success).toBe(false);
  });
});
