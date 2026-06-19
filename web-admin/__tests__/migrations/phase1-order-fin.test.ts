/**
 * Phase 1 (post-decision) migration + source content checks.
 *
 * Deterministic, CI-safe assertions against the schema source-of-truth
 * (migration DDL) and the collect-payment key fix. These lock the Phase-1
 * invariants until the real DB-level harness (F-T5 / D-10) lands.
 *
 *  - 1A (F-01): 0379 enables RLS + tenant_isolation + service_role on
 *    org_tax_doc_seq_counters.
 *  - 1B (F-02/F-04): 0380 creates org_b2b_statement_payments_dtl with a
 *    partial idempotency unique index + RLS.
 *  - 1C (F-10): order-settlement.service no longer defaults to the unsafe
 *    stable collect key and falls back to a per-request UUID.
 */

import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const SERVICES_DIR = path.join(__dirname, '..', '..', 'lib', 'services');

function readMigration(prefix: string): string {
  const file = fs
    .readdirSync(MIGRATIONS_DIR)
    .find((n) => n.startsWith(prefix) && n.endsWith('.sql'));
  if (!file) throw new Error(`Migration ${prefix} not found in ${MIGRATIONS_DIR}`);
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
}

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

describe('1A — 0379 RLS on org_tax_doc_seq_counters (F-01)', () => {
  const ddl = stripSqlComments(readMigration('0379'));

  it('enables row level security on the table', () => {
    expect(ddl).toMatch(
      /ALTER\s+TABLE\s+public\.org_tax_doc_seq_counters\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
  });

  it('adds a tenant_isolation policy keyed on current_tenant_id()', () => {
    expect(ddl).toMatch(/CREATE\s+POLICY\s+tenant_isolation_org_tax_doc_seq_counters/i);
    expect(ddl).toMatch(/tenant_org_id\s*=\s*current_tenant_id\(\)/i);
  });

  it('adds a service_role policy so the server sequence service still writes (D-08)', () => {
    expect(ddl).toMatch(/CREATE\s+POLICY\s+service_role_org_tax_doc_seq_counters/i);
    expect(ddl).toMatch(/auth\.jwt\(\)\s*->>\s*'role'\s*=\s*'service_role'/i);
  });
});

describe('1B — 0380 org_b2b_statement_payments_dtl (F-02 / F-04)', () => {
  const ddl = stripSqlComments(readMigration('0380'));

  it('creates the B2B statement payment detail table', () => {
    expect(ddl).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+org_b2b_statement_payments_dtl/i);
  });

  it('has a partial idempotency unique index (replay guard)', () => {
    expect(ddl).toMatch(/CREATE\s+UNIQUE\s+INDEX[\s\S]*uq_b2b_stmt_pay_idem/i);
    expect(ddl).toMatch(/idempotency_key\)\s*\n?\s*WHERE\s+idempotency_key\s+IS\s+NOT\s+NULL/i);
  });

  it('carries an amount>0 check and enables RLS with both policies', () => {
    expect(ddl).toMatch(/CHECK\s*\(\s*amount\s*>\s*0\s*\)/i);
    expect(ddl).toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(ddl).toMatch(/tenant_isolation_org_b2b_stmt_pay_dtl/i);
    expect(ddl).toMatch(/service_role_org_b2b_stmt_pay_dtl/i);
  });

  it('table name is within the 30-char DB object limit', () => {
    expect('org_b2b_statement_payments_dtl'.length).toBeLessThanOrEqual(30);
  });
});

describe('1C — collect-payment idempotency key (F-10)', () => {
  const src = fs.readFileSync(path.join(SERVICES_DIR, 'order-settlement.service.ts'), 'utf8');

  it('no longer defaults the collect key to the unsafe stable form (operative code, not comments)', () => {
    // The bug was a default of `${orderId}_collect_${collectedBy}` — collides
    // across distinct events. Strip // line comments so the doc-comment that
    // references the old token (for explanation) does not trip this guard.
    const code = src
      .split('\n')
      .map((line) => {
        const i = line.indexOf('//');
        return i >= 0 ? line.slice(0, i) : line;
      })
      .join('\n');
    expect(code).not.toMatch(/`\$\{orderId\}_collect_\$\{collectedBy\}`/);
    // and the operative fallback uses a per-request UUID
    expect(code).toMatch(/idempotencyKeyInput\s*\?\?\s*`\$\{orderId\}_collect_\$\{randomUUID\(\)\}`/);
  });

  it('falls back to a per-request UUID when no client key is supplied', () => {
    expect(src).toMatch(/randomUUID/);
    expect(src).toMatch(/idempotencyKeyInput\s*\?\?/);
  });
});
