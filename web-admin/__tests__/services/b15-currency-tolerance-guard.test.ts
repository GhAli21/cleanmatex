/**
 * B15 — currency defaults + tolerance guards.
 *
 * 1. Source guard: no 'OMR'/'USD' literals on lib money paths (services,
 *    payments, db) outside comments — currency is resolved or the operation
 *    fails loudly.
 * 2. Unit contract of lib/money/currency-resolution.
 * 3. Tolerance constants: exactly two classes, all re-exports point at them.
 * 4. Formatter degradation: blank currency renders a plain number, never an
 *    invented code.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CURRENCY_RESOLUTION_ERRORS,
  CurrencyResolutionError,
  assertCurrencyMatch,
  optionalCurrencyCode,
  requireCurrencyCode,
} from '@/lib/money/currency-resolution';
import {
  CASH_VARIANCE_TOLERANCE,
  MONEY_COMPARISON_TOLERANCE,
} from '@/lib/constants/financial-tolerances';
import { ORDER_FINANCIAL_COMPARISON_TOLERANCE } from '@/lib/services/order-financial-aggregation';
import { RECONCILIATION_TOLERANCE } from '@/lib/services/reconciliation/types';
import { RECON_REPORT_EPSILON } from '@/lib/constants/reconciliation-reports';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { formatMoneyAmount, formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { formatPrice } from '@/lib/utils/pricing-calculator';

// ---------------------------------------------------------------------------
// 1. Source guard — no currency literals on money paths
// ---------------------------------------------------------------------------

const MONEY_PATH_DIRS = ['lib/services', 'lib/payments', 'lib/db'];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function listSourceFiles(dir: string): string[] {
  const abs = path.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(path.join(dir, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('B15 source guard — money paths have no currency literals', () => {
  const offenders: string[] = [];

  beforeAll(() => {
    for (const dir of MONEY_PATH_DIRS) {
      for (const file of listSourceFiles(dir)) {
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        if (/['"](OMR|USD)['"]/.test(code)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
    }
  });

  it("has no 'OMR' or 'USD' string literal in lib/services, lib/payments, lib/db", () => {
    expect(offenders).toEqual([]);
  });

  it('recalculateOrderTotals has no 0.05 VAT fallback and zero-rates unconfigured tax', () => {
    const code = stripComments(
      fs.readFileSync(path.join(process.cwd(), 'lib/db/orders.ts'), 'utf8')
    );
    expect(code).not.toMatch(/:\s*0\.05\b/);
    // Resolution ladder: header stamp → org_order_taxes_dtl effective rate →
    // zero-rated (owner policy: no tax setup = tenant does not use tax).
    expect(code).toContain('org_order_taxes_dtl');
    expect(code).toContain('vatRate = 0');
  });

  it('use-payment-totals has no 0.06/0.05 tax fallback', () => {
    const code = stripComments(
      fs.readFileSync(
        path.join(process.cwd(), 'src/features/orders/hooks/use-payment-totals.ts'),
        'utf8'
      )
    );
    expect(code).not.toMatch(/0\.06|0\.05/);
  });

  it('drawer close comparison uses the central cash tolerance', () => {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/cash-drawer.service.ts'),
      'utf8'
    );
    expect(code).toContain('Math.abs(variance) < CASH_VARIANCE_TOLERANCE');
  });
});

// ---------------------------------------------------------------------------
// 2. currency-resolution unit contract
// ---------------------------------------------------------------------------

describe('currency-resolution', () => {
  it('requireCurrencyCode returns the trimmed code', () => {
    expect(requireCurrencyCode(' BHD ', 'ctx')).toBe('BHD');
  });

  it.each([null, undefined, '', '   '])(
    'requireCurrencyCode throws MISSING_CURRENCY_CODE for %p',
    (value) => {
      try {
        requireCurrencyCode(value as string | null | undefined, 'wallet create');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CurrencyResolutionError);
        const e = err as CurrencyResolutionError;
        expect(e.code).toBe(CURRENCY_RESOLUTION_ERRORS.MISSING_CURRENCY_CODE);
        expect(e.message).toContain('wallet create');
      }
    }
  );

  it('optionalCurrencyCode trims and returns undefined for blank', () => {
    expect(optionalCurrencyCode(' SAR ')).toBe('SAR');
    expect(optionalCurrencyCode('')).toBeUndefined();
    expect(optionalCurrencyCode('   ')).toBeUndefined();
    expect(optionalCurrencyCode(null)).toBeUndefined();
    expect(optionalCurrencyCode(undefined)).toBeUndefined();
  });

  it('assertCurrencyMatch passes on equal or blank supplied currency', () => {
    expect(() => assertCurrencyMatch('BHD', 'BHD', 'ctx')).not.toThrow();
    expect(() => assertCurrencyMatch('BHD', ' BHD ', 'ctx')).not.toThrow();
    expect(() => assertCurrencyMatch('BHD', undefined, 'ctx')).not.toThrow();
    expect(() => assertCurrencyMatch('BHD', '', 'ctx')).not.toThrow();
  });

  it('assertCurrencyMatch throws CURRENCY_MISMATCH on conflict', () => {
    try {
      assertCurrencyMatch('BHD', 'SAR', 'wallet w1');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CurrencyResolutionError);
      const e = err as CurrencyResolutionError;
      expect(e.code).toBe(CURRENCY_RESOLUTION_ERRORS.CURRENCY_MISMATCH);
      expect(e.message).toContain('row=BHD');
      expect(e.message).toContain('supplied=SAR');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Tolerance classes — one constant per comparison class
// ---------------------------------------------------------------------------

describe('financial tolerances', () => {
  it('defines the two documented classes', () => {
    expect(MONEY_COMPARISON_TOLERANCE).toBe(0.001);
    expect(CASH_VARIANCE_TOLERANCE).toBe(0.01);
  });

  it('all re-exports point at the central constants', () => {
    expect(ORDER_FINANCIAL_COMPARISON_TOLERANCE).toBe(MONEY_COMPARISON_TOLERANCE);
    expect(SETTLEMENT_MONEY_EPSILON).toBe(MONEY_COMPARISON_TOLERANCE);
    expect(RECONCILIATION_TOLERANCE).toBe(CASH_VARIANCE_TOLERANCE);
    expect(RECON_REPORT_EPSILON).toBe(CASH_VARIANCE_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// 4. Formatter degradation — blank currency renders plain numbers
// ---------------------------------------------------------------------------

describe('formatter degradation without a resolved currency', () => {
  it('formatMoneyAmount renders a plain number for blank currency', () => {
    const out = formatMoneyAmount(12.5, { currencyCode: '', decimalPlaces: 3 });
    expect(out).not.toMatch(/[A-Z]{3}/);
    expect(out).toContain('12.500');
  });

  it('formatMoneyAmount keeps currency style when a code is resolved', () => {
    const out = formatMoneyAmount(12.5, { currencyCode: 'BHD', decimalPlaces: 3 });
    expect(out).toMatch(/BHD|د\.ب/);
  });

  it('formatMoneyAmountWithCode omits the suffix for blank currency', () => {
    expect(
      formatMoneyAmountWithCode(7, { currencyCode: '', decimalPlaces: 2 })
    ).toBe('7.00');
    expect(
      formatMoneyAmountWithCode(7, { currencyCode: 'SAR', decimalPlaces: 2 })
    ).toBe('7.00 SAR');
  });

  it('formatPrice renders a plain number for blank currency', () => {
    const out = formatPrice(3.25, '', 'en', 3);
    expect(out).not.toMatch(/[A-Z]{3}/);
    expect(out).toContain('3.250');
  });
});
