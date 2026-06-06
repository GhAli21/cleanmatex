import {
  sanitizeMoneyDraft,
  parseMoneyDraft,
  formatMoneyDraft,
  applyKeypadInput,
} from '@/lib/money/money-draft';

describe('sanitizeMoneyDraft', () => {
  it('collapses leading zeros: 007 → 7', () => {
    expect(sanitizeMoneyDraft('007', 3)).toBe('7');
  });

  it('collapses leading zeros with decimal: 00.5 → 0.5', () => {
    expect(sanitizeMoneyDraft('00.5', 3)).toBe('0.5');
  });

  it('preserves lone zero', () => {
    expect(sanitizeMoneyDraft('0', 3)).toBe('0');
  });

  it('preserves empty string', () => {
    expect(sanitizeMoneyDraft('', 3)).toBe('');
  });

  it('removes double dots: 1..23 → 1.23', () => {
    expect(sanitizeMoneyDraft('1..23', 3)).toBe('1.23');
  });

  it('caps fraction to decimalPlaces: 1.23456 with dp=3 → 1.234', () => {
    expect(sanitizeMoneyDraft('1.23456', 3)).toBe('1.234');
  });

  it('normalises leading dot: .5 → 0.5', () => {
    expect(sanitizeMoneyDraft('.5', 3)).toBe('0.5');
  });

  it('strips non-numeric chars', () => {
    expect(sanitizeMoneyDraft('12abc.5', 3)).toBe('12.5');
  });
});

describe('parseMoneyDraft', () => {
  it('returns 0 for empty string', () => {
    expect(parseMoneyDraft('')).toBe(0);
  });

  it('returns 0 for lone dot', () => {
    expect(parseMoneyDraft('.')).toBe(0);
  });

  it('parses valid decimal string', () => {
    expect(parseMoneyDraft('12.5')).toBe(12.5);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseMoneyDraft('abc')).toBe(0);
  });

  it('parses integer string', () => {
    expect(parseMoneyDraft('100')).toBe(100);
  });
});

describe('formatMoneyDraft', () => {
  it('formats with full precision — no trailing zero strip', () => {
    expect(formatMoneyDraft(10.5, 3, false)).toBe('10.500');
  });

  it('returns empty for zero when showZero=false', () => {
    expect(formatMoneyDraft(0, 3, false)).toBe('');
  });

  it('returns fixed-point for zero when showZero=true', () => {
    expect(formatMoneyDraft(0, 3, true)).toBe('0.000');
  });

  it('returns empty for null', () => {
    expect(formatMoneyDraft(null, 3, false)).toBe('');
  });

  it('returns empty for NaN', () => {
    expect(formatMoneyDraft(NaN, 3, false)).toBe('');
  });

  it('returns empty for undefined', () => {
    expect(formatMoneyDraft(undefined, 3, false)).toBe('');
  });
});

describe('applyKeypadInput', () => {
  it('appends digits sequentially', () => {
    let draft = '';
    draft = applyKeypadInput(draft, '1', 3);
    draft = applyKeypadInput(draft, '2', 3);
    expect(draft).toBe('12');
  });

  it('decimal guard: 12.5 + . stays 12.5', () => {
    expect(applyKeypadInput('12.5', '.', 3)).toBe('12.5');
  });

  it('decimal first: empty + . + 5 → 0.5', () => {
    let draft = applyKeypadInput('', '.', 3);
    draft = applyKeypadInput(draft, '5', 3);
    expect(draft).toBe('0.5');
  });

  it('backspace removes last char', () => {
    expect(applyKeypadInput('12.5', 'backspace', 3)).toBe('12.');
  });

  it('clear returns empty', () => {
    expect(applyKeypadInput('12.5', 'clear', 3)).toBe('');
  });

  it('+10 quick-add uses full precision with dp=3', () => {
    expect(applyKeypadInput('1.5', '+10', 3)).toBe('11.500');
  });

  it('+50 from empty returns full precision', () => {
    expect(applyKeypadInput('', '+50', 3)).toBe('50.000');
  });

  it('backspace on empty returns empty', () => {
    expect(applyKeypadInput('', 'backspace', 3)).toBe('');
  });
});
