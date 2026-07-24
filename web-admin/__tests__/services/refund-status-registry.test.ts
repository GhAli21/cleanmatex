/**
 * B22 — Financial Registry Consolidation (RefundStatus).
 *
 * `org_order_refunds_dtl.refund_status` had no exported registry (§44
 * finding) — every writer/reader used raw string literals. Covers:
 *  1. `REFUND_STATUSES` is byte-identical to the live DB CHECK constraint
 *     (`chk_org_order_refunds_status`, migration 0404) — CRITICAL RULE 12.
 *  2. Grep-guard: no literal refund_status assignment/comparison remains in
 *     the files this package migrated (order-refund.service.ts, the 3
 *     reconciliation check modules, refunds-list-client.tsx).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { REFUND_STATUSES } from '@/lib/constants/order-financial';

describe('REFUND_STATUSES — DB-mirror equality (CRITICAL RULE 12)', () => {
  it('matches chk_org_order_refunds_status (migration 0404) exactly', () => {
    // Mirrors supabase/migrations/0404_b01_refund_lineage_and_context.sql's
    // Step 6 CHECK constraint verbatim — update both together if either changes.
    const dbConstraintValues = ['PENDING', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSED', 'FAILED', 'CANCELLED'];
    expect(Object.values(REFUND_STATUSES).sort()).toEqual([...dbConstraintValues].sort());
  });
});

describe('B22 grep-guard — refund_status literals must use REFUND_STATUSES', () => {
  const REFUND_STATUS_LITERAL = /refund_status\s*(:|===?)\s*['"][A-Z_]+['"]/;

  function findOffenders(filePath: string): string[] {
    const source = fs.readFileSync(filePath, 'utf8');
    const offenders: string[] = [];
    source.split('\n').forEach((line, index) => {
      if (REFUND_STATUS_LITERAL.test(line)) {
        offenders.push(`${path.basename(filePath)}:${index + 1} → ${line.trim()}`);
      }
    });
    return offenders;
  }

  it('order-refund.service.ts contains no refund_status literal', () => {
    const file = path.resolve(__dirname, '../../lib/services/order-refund.service.ts');
    expect(findOffenders(file)).toEqual([]);
  });

  it('reconciliation check modules contain no refund_status literal', () => {
    const reconDir = path.resolve(__dirname, '../../lib/services/reconciliation');
    const offenders: string[] = [];
    for (const file of fs.readdirSync(reconDir)) {
      if (!file.endsWith('.ts')) continue;
      offenders.push(...findOffenders(path.join(reconDir, file)));
    }
    expect(offenders).toEqual([]);
  });

  it('refunds-list-client.tsx contains no refund_status literal (REJECTED display-only key is a documented exception, not a governed status)', () => {
    const file = path.resolve(__dirname, '../../src/features/billing/ui/refunds-list-client.tsx');
    expect(findOffenders(file)).toEqual([]);
  });
});
