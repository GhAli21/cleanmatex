import fs from 'node:fs';
import path from 'node:path';

import {
  CUSTOMER_RECEIPT_ALLOCATION_MODES,
  CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS,
  OVERPAYMENT_RESOLUTIONS,
  SETTLEMENT_MONEY_EPSILON,
  VOUCHER_SOURCE_TYPES,
} from '@/lib/constants/settlement-catalog';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');

function readMigration(prefix: string): string {
  const file = fs
    .readdirSync(MIGRATIONS_DIR)
    .find((name) => name.startsWith(prefix) && name.endsWith('.sql'));
  if (!file) {
    throw new Error(`Migration starting with "${prefix}" not found in ${MIGRATIONS_DIR}`);
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
}

/** Strip `--` line comments so structural assertions test real DDL, not comment text. */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

/**
 * Canonical sys_fin_overpay_res_cd.resolution_code set — seeded across
 * 0357 (8 codes) + 0368 (SAVE_TO_CUSTOMER_WALLET). This is the single source
 * of truth that org_fin_overpay_disp_dtl.resolution_code is now FK-bound to
 * (migration 0378), replacing the drift-prone hardcoded CHECK.
 */
const CATALOG_RESOLUTION_CODES = [
  'REDUCE_PAYMENT',
  'RETURN_CASH_CHANGE',
  'VOID_OR_REFUND_EXCESS',
  'SAVE_AS_CUSTOMER_ADVANCE',
  'SAVE_TO_CUSTOMER_WALLET',
  'SAVE_AS_CUSTOMER_CREDIT',
  'RESTORE_STORED_VALUE',
  'ALLOCATE_TO_CUSTOMER_BALANCES',
  'AUTO_ALLOCATE_TO_CUSTOMER_BALANCES',
] as const;

describe('settlement-catalog constants', () => {
  describe('overpayment resolution ↔ sys_fin_overpay_res_cd parity', () => {
    it('TypeScript OVERPAYMENT_RESOLUTIONS exactly matches the catalog code set', () => {
      expect(new Set(Object.values(OVERPAYMENT_RESOLUTIONS))).toEqual(
        new Set<string>(CATALOG_RESOLUTION_CODES),
      );
    });

    it('every catalog code is seeded by migration 0357 or 0368', () => {
      const seedSql = `${readMigration('0357')}\n${readMigration('0368')}`;
      for (const code of CATALOG_RESOLUTION_CODES) {
        expect(seedSql).toContain(`'${code}'`);
      }
    });
  });

  describe('org_fin_overpay_disp_dtl.resolution_code is FK-enforced, not CHECK-enforced (mig 0378)', () => {
    // Schema source of truth: the migration DDL. This replaces the previous
    // no-op assertion (which only checked array uniqueness and let the
    // SAVE_TO_CUSTOMER_WALLET blocker ship — see validation report 2026-06-18).
    const ddl = stripSqlComments(readMigration('0378'));

    it('drops the legacy hardcoded CHECK org_fin_overpay_disp_res_chk', () => {
      expect(ddl).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+org_fin_overpay_disp_res_chk/i);
    });

    it('adds FK org_fin_overpay_disp_res_fk → sys_fin_overpay_res_cd(resolution_code)', () => {
      expect(ddl).toMatch(/ADD\s+CONSTRAINT\s+org_fin_overpay_disp_res_fk/i);
      expect(ddl).toMatch(/FOREIGN\s+KEY\s*\(\s*resolution_code\s*\)/i);
      expect(ddl).toMatch(
        /REFERENCES\s+public\.sys_fin_overpay_res_cd\s*\(\s*resolution_code\s*\)/i,
      );
    });

    it('uses ON UPDATE RESTRICT / ON DELETE RESTRICT on the catalog FK', () => {
      expect(ddl).toMatch(/ON\s+UPDATE\s+RESTRICT/i);
      expect(ddl).toMatch(/ON\s+DELETE\s+RESTRICT/i);
    });

    it('does NOT re-introduce a hardcoded resolution_code value CHECK (drift guard)', () => {
      expect(ddl).not.toMatch(/ADD\s+CONSTRAINT\s+org_fin_overpay_disp_res_chk/i);
      expect(ddl).not.toMatch(/CHECK\s*\(\s*resolution_code\s+IN/i);
    });
  });

  it('uses production INVOICE target (not AR_INVOICE) for invoice payments', () => {
    expect(TARGET_TYPE.INVOICE).toBe('INVOICE');
    expect(LINE_ROLE.INVOICE_PAYMENT).toBe('INVOICE_PAYMENT');
  });

  it('defines CUSTOMER_CREDIT_ISSUE as canonical credit issue role', () => {
    expect(LINE_ROLE.CUSTOMER_CREDIT_ISSUE).toBe('CUSTOMER_CREDIT_ISSUE');
    expect(LINE_ROLE.CUSTOMER_CREDIT_RECEIPT).toBe('CUSTOMER_CREDIT_RECEIPT');
  });

  it('defines allocation catalog codes for Phase 4', () => {
    expect(CUSTOMER_RECEIPT_ALLOCATION_MODES.AUTO_OLDEST_DUE).toBe('AUTO_OLDEST_DUE');
    expect(CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.CUSTOMER_ADVANCE).toBe('CUSTOMER_ADVANCE');
  });

  it('defines voucher source types for BVM origin tracking', () => {
    expect(VOUCHER_SOURCE_TYPES.ORDER_PAYMENT_MODAL).toBe('ORDER_PAYMENT_MODAL');
    expect(VOUCHER_SOURCE_TYPES.POS_OVERPAYMENT_ALLOCATION).toBe('POS_OVERPAYMENT_ALLOCATION');
  });

  it('uses standard money epsilon', () => {
    expect(SETTLEMENT_MONEY_EPSILON).toBe(0.001);
  });
});
