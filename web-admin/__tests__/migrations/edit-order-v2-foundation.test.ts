/**
 * WP02 source-contract checks protect the reviewed, unapplied foundation.
 * These read migration files only: they do not prove deployed privileges,
 * FK enforcement, transaction rollback, or the future Apply service.
 */
import fs from 'node:fs';
import path from 'node:path';

const migrationDirectory = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');

/** Remove documentation so a promised safeguard cannot satisfy an operative SQL assertion. */
function readSql(filename: string): string {
  return fs.readFileSync(path.join(migrationDirectory, filename), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');
}

/** Restrict column assertions to their table, avoiding accidental matches in another aggregate. */
function tableBody(sql: string, name: string): string {
  const body = sql.match(new RegExp(`CREATE TABLE public\\.${name} \\(([\\s\\S]*?)\\n\\);`, 'i'))?.[1];
  if (!body) throw new Error(`Missing CREATE TABLE ${name}`);
  return body;
}

/** Normalize whitespace so formatting changes do not weaken tuple/privilege checks. */
function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/** Return a named constraint independently, including any later clauses through its comma terminator. */
function constraint(sql: string, name: string): string {
  const start = sql.indexOf(`CONSTRAINT ${name} `);
  if (start < 0) throw new Error(`Missing constraint ${name}`);
  const remaining = sql.slice(start);
  const end = remaining.search(/,\s*(?:ADD CONSTRAINT|CONSTRAINT)\b|;|\n\);/);
  return compact(end < 0 ? remaining : remaining.slice(0, end));
}

const foundation = readSql('0547_wp02_order_change_foundation.sql');
const history = readSql('0548_wp02_order_change_history.sql');
const combined = `${foundation}\n${history}`;
const master = tableBody(history, 'org_order_changes_mst');
const operations = tableBody(history, 'org_order_change_ops_dtl');
const lifecycleColumns = ['created_at', 'created_by', 'created_info', 'updated_at', 'updated_by',
  'updated_info', 'rec_status', 'rec_order', 'rec_notes', 'is_active'];

describe('WP02 unapplied database foundation source contracts', () => {
  it('adds exactly the ten foundation columns with compatibility defaults and nullable unknown provenance', () => {
    expect([...foundation.matchAll(/ADD COLUMN (\w+) ([^,;\n]+)/g)].map(match => match[1])).toEqual([
      'committed_at', 'committed_by', 'edit_state_version', 'edit_access_status',
      'edit_block_reason_code', 'edit_block_reason_text', 'edit_blocked_at', 'edit_blocked_by',
      'edit_block_until', 'service_speed',
    ]);
    expect(foundation).toMatch(/committed_at TIMESTAMPTZ NULL/);
    expect(foundation).toMatch(/committed_by UUID NULL/);
    expect(foundation).toMatch(/edit_state_version INTEGER NOT NULL DEFAULT 0/);
    expect(foundation).toMatch(/edit_access_status TEXT NOT NULL DEFAULT 'OPEN'/);
    expect(foundation).toMatch(/service_speed TEXT NULL/);
    expect(constraint(foundation, 'oc_order_speed_ck')).toContain("service_speed IN ('STANDARD', 'EXPRESS')");
    expect(combined).not.toMatch(/ADD COLUMN (?:state_version|wf_state_version|is_committed|committed_status|is_deleted|is_active)\b/);
  });

  it('defines draft versus committed revision consistency without historical classification DML', () => {
    const check = constraint(foundation, 'oc_order_commit_ck');
    expect(check).toContain('committed_at IS NULL AND edit_state_version = 0 AND committed_by IS NULL');
    expect(check).toContain('committed_at IS NOT NULL AND edit_state_version >= 1');
    expect(check).toContain('NOT VALID');
  });

  it('guards commitment evidence, committed deletion, and permanent-block reversal with OLD/NEW checks', () => {
    expect(foundation).toMatch(/OLD\.committed_at IS NOT NULL[\s\S]*NEW\.committed_at IS DISTINCT FROM OLD\.committed_at[\s\S]*NEW\.committed_by IS DISTINCT FROM OLD\.committed_by/);
    expect(foundation).toMatch(/IF TG_OP = 'DELETE' THEN\s+IF OLD\.committed_at IS NOT NULL THEN\s+RAISE EXCEPTION/);
    expect(foundation).toMatch(/OLD\.edit_access_status = 'PERMANENTLY_BLOCKED'\s+AND NEW\.edit_access_status IS DISTINCT FROM OLD\.edit_access_status THEN\s+RAISE EXCEPTION/);
    expect(foundation).toMatch(/BEFORE UPDATE OR DELETE ON public\.org_orders_mst\s+FOR EACH ROW EXECUTE FUNCTION public\.oc_guard_order_foundation\(\)/);
  });

  it('requires coherent block metadata and prevents a permanent expiry', () => {
    const check = constraint(foundation, 'oc_order_access_ck');
    expect(check).toContain("edit_access_status = 'OPEN'");
    expect(check).toContain("edit_access_status IN ('TEMPORARILY_BLOCKED', 'PERMANENTLY_BLOCKED')");
    expect(check).toContain('edit_blocked_at IS NOT NULL');
    expect(check).toContain("NULLIF(btrim(edit_block_reason_code), '') IS NOT NULL");
    expect(check).toContain("edit_access_status <> 'PERMANENTLY_BLOCKED' OR edit_block_until IS NULL");
    expect(check).toContain('edit_block_until IS NULL OR edit_block_until > edit_blocked_at');
  });

  it.each([
    ['master', master, ['id', 'tenant_org_id', 'order_id', 'change_no', 'edit_state_version_before',
      'edit_state_version_after', 'wf_state_version_expected', 'source_context', 'actor_user_id',
      'actor_name', 'change_reason', 'currency_code', 'financial_before', 'financial_after',
      'commercial_delta', 'financial_outcome', 'idempotency_key', 'request_hash', 'apply_response',
      'applied_at', 'metadata', ...lifecycleColumns]],
    ['operations', operations, ['id', 'tenant_org_id', 'order_id', 'order_change_id', 'operation_seq',
      'operation_code', 'target_type', 'order_item_id', 'order_item_piece_id', 'order_preference_id',
      'client_ref', 'before_values', 'after_values', 'audit_summary', 'metadata', ...lifecycleColumns]],
  ] as const)('freezes the complete %s column catalog without a duplicate ledger', (_name, body, expected) => {
    const columns = [...body.matchAll(/^\s{2}(\w+)\s+(?:UUID|TEXT|INTEGER|TIMESTAMPTZ|JSONB|DECIMAL|SMALLINT|BOOLEAN)\b/gm)].map(match => match[1]);
    expect(columns).toEqual(expected);
    expect(body).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(body).toMatch(/tenant_org_id UUID NOT NULL/);
    expect(body).toMatch(/created_by TEXT NOT NULL/);
    expect(body).toMatch(/rec_status SMALLINT NOT NULL DEFAULT 1/);
  });

  it('requires final snapshots and replay response before immutable insertion', () => {
    for (const column of ['financial_before', 'financial_after', 'apply_response']) {
      expect(master).toMatch(new RegExp(`${column} JSONB NOT NULL,`));
      expect(master).toContain(`jsonb_typeof(${column}) = 'object' AND ${column} <> '{}'::jsonb`);
    }
    expect(master).toMatch(/currency_code TEXT NOT NULL,/);
    expect(master).not.toMatch(/currency_code TEXT[^\n]*DEFAULT/);
    expect(master).toMatch(/commercial_delta DECIMAL\(19,4\) NOT NULL/);
    expect(master).toContain("commercial_delta <> 'NaN'::numeric");
    expect(constraint(master, 'oc_change_revision_ck')).toContain('edit_state_version_after::bigint = edit_state_version_before::bigint + 1');
    expect(constraint(master, 'oc_change_outcome_ck')).toContain("'NONE', 'OUTSTANDING_OPTIONAL', 'OUTSTANDING_REQUIRED', 'OVERPAYMENT'");
  });

  it('retains tenant-scoped durable idempotency, change number, revision, and operation sequence uniqueness', () => {
    for (const tuple of ['tenant_org_id, order_id, change_no', 'tenant_org_id, order_id, edit_state_version_after',
      'tenant_org_id, idempotency_key', 'id, tenant_org_id', 'id, order_id, tenant_org_id']) {
      expect(master).toContain(`UNIQUE (${tuple})`);
    }
    expect(operations).toContain('UNIQUE (tenant_org_id, order_change_id, operation_seq)');
    expect(operations).toContain('CHECK (operation_seq > 0)');
  });

  it('requires typed identities and separates nullable snapshots from required authoritative facts', () => {
    for (const body of [master, operations]) {
      expect(body).toMatch(/order_id UUID NOT NULL,/);
      expect(body).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\),/);
      expect(body).toMatch(/metadata JSONB NOT NULL DEFAULT '\{\}'::jsonb,/);
      expect(body).toMatch(/is_active BOOLEAN NOT NULL DEFAULT true,/);
      for (const field of ['created_info', 'updated_by', 'updated_info', 'rec_notes']) {
        expect(body).toMatch(new RegExp(`${field} TEXT NULL,`));
      }
      expect(body).toMatch(/updated_at TIMESTAMPTZ NULL,/);
      expect(body).toMatch(/rec_order INTEGER NULL,/);
    }
    for (const field of ['change_no', 'edit_state_version_before', 'edit_state_version_after', 'wf_state_version_expected']) {
      expect(master).toMatch(new RegExp(`${field} INTEGER NOT NULL,`));
    }
    expect(master).toMatch(/actor_user_id UUID NOT NULL,/);
    expect(master).toMatch(/applied_at TIMESTAMPTZ NOT NULL,/);
    for (const field of ['actor_name', 'change_reason']) expect(master).toMatch(new RegExp(`${field} TEXT NULL,`));
    for (const field of ['order_item_id', 'order_item_piece_id', 'order_preference_id', 'client_ref']) {
      expect(operations).toMatch(new RegExp(`${field} UUID NULL,`));
    }
    for (const field of ['before_values', 'after_values']) {
      expect(operations).toMatch(new RegExp(`${field} JSONB NOT NULL DEFAULT '\\{\\}'::jsonb,`));
    }
  });

  it('reuses order/item identity keys and adds only the missing piece/preference identity tuples', () => {
    expect(compact(history)).toContain('ALTER TABLE public.org_order_item_pieces_dtl ADD CONSTRAINT oc_piece_identity_uq UNIQUE (id, tenant_org_id)');
    expect(compact(history)).toContain('ALTER TABLE public.org_order_preferences_dtl ADD CONSTRAINT oc_pref_identity_uq UNIQUE (id, tenant_org_id)');
    expect(history).not.toMatch(/ALTER TABLE public\.org_(?:orders_mst|order_items_dtl)\s+ADD CONSTRAINT \w+ UNIQUE/);
    for (const [name, table, field] of [
      ['oc_op_item_fk', 'org_order_items_dtl', 'order_item_id'],
      ['oc_op_piece_fk', 'org_order_item_pieces_dtl', 'order_item_piece_id'],
      ['oc_op_pref_fk', 'org_order_preferences_dtl', 'order_preference_id'],
    ]) {
      const fk = constraint(operations, name);
      expect(fk).toContain(`FOREIGN KEY (${field}, tenant_org_id) REFERENCES public.${table}(id, tenant_org_id)`);
      expect(fk).toContain('ON UPDATE RESTRICT ON DELETE RESTRICT');
    }
    expect(constraint(operations, 'oc_op_change_fk')).toContain('FOREIGN KEY (order_change_id, order_id, tenant_org_id) REFERENCES public.org_order_changes_mst(id, order_id, tenant_org_id)');
  });

  it.each(['item', 'piece', 'pref'])('makes %s governed removal NULL-safe and defers only the late-master lineage check', prefix => {
    const check = constraint(history, `oc_${prefix}_removal_ck`);
    expect(check).toContain('deleted_order_change_id IS NULL AND deleted_at IS NULL AND deleted_by IS NULL');
    expect(check).toContain('deleted_order_change_id IS NOT NULL AND rec_status IS NOT NULL AND rec_status = 0 AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL');
    expect(check).toContain('NOT VALID');
    const fk = constraint(history, `oc_${prefix}_removal_change_fk`);
    expect(fk).toContain('FOREIGN KEY (deleted_order_change_id, tenant_org_id) REFERENCES public.org_order_changes_mst(id, tenant_org_id)');
    expect(fk).toContain('ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID');
    expect(constraint(history, `oc_${prefix}_removal_actor_fk`)).toContain('REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID');
  });

  it('does not defer identity uniqueness, operation FKs, or silently install global live-parent constraints', () => {
    expect([...combined.matchAll(/\bDEFERRABLE\b/g)]).toHaveLength(3);
    expect(history).not.toMatch(/FOREIGN KEY \((?:order_item_id, order_id|order_item_piece_id, order_item_id)/);
    expect(history).not.toMatch(/ADD CONSTRAINT [^;]*CHECK\s*\([^;]*prefs_level/);
    expect(history).not.toMatch(/UNIQUE \(id, order_item_id, order_id, tenant_org_id\)/);
  });

  it('uses RESTRICT for every new FK and auth.users for all actor references', () => {
    const definitions = [...combined.matchAll(/FOREIGN KEY \([^)]+\)\s+REFERENCES [\w.]+\([^)]*\)\s+([^,;]+)/g)];
    expect(definitions.length).toBe(16);
    for (const fk of definitions) expect(fk[1]).toMatch(/^ON UPDATE RESTRICT ON DELETE RESTRICT/);
    expect(constraint(master, 'oc_change_actor_fk')).toContain('REFERENCES auth.users(id)');
    expect(combined).not.toMatch(/REFERENCES (?:public\.)?org_users_mst/);
    expect(combined).not.toMatch(/\bCASCADE\b/);
  });

  it('denies inherited browser privileges and exposes only reviewed backend SELECT/INSERT with RLS enabled', () => {
    for (const table of ['org_order_changes_mst', 'org_order_change_ops_dtl']) {
      expect(history).toContain(`ALTER TABLE public.${table} OWNER TO postgres;`);
      expect(history).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
    expect(compact(history)).toContain('REVOKE ALL ON TABLE public.org_order_changes_mst, public.org_order_change_ops_dtl FROM PUBLIC, anon, authenticated, service_role;');
    expect(compact(history)).toContain('GRANT SELECT, INSERT ON TABLE public.org_order_changes_mst, public.org_order_change_ops_dtl TO service_role;');
    expect([...history.matchAll(/\bGRANT\b/g)]).toHaveLength(1);
    expect(combined).not.toMatch(/CREATE POLICY|current_tenant_id\(|auth\.jwt\(|user_metadata|SECURITY DEFINER/i);
  });

  it('blocks row mutations and TRUNCATE even through ordinary owner/BYPASSRLS commands', () => {
    for (const table of ['org_order_changes_mst', 'org_order_change_ops_dtl']) {
      expect(history).toMatch(new RegExp(`BEFORE UPDATE OR DELETE ON public\\.${table}\\s+FOR EACH ROW EXECUTE FUNCTION public\\.oc_deny_history_mutation\\(\\)`));
      expect(history).toMatch(new RegExp(`BEFORE TRUNCATE ON public\\.${table}\\s+FOR EACH STATEMENT EXECUTE FUNCTION public\\.oc_deny_history_mutation\\(\\)`));
    }
    expect(history).toMatch(/IF OLD\.deleted_order_change_id IS NOT NULL THEN[\s\S]*IF NEW IS DISTINCT FROM OLD THEN\s+RAISE EXCEPTION/);
    expect(history).not.toMatch(/current_setting|set_config|DISABLE TRIGGER|session_replication_role/i);
    expect([...combined.matchAll(/SECURITY INVOKER\s+SET search_path = pg_catalog/g)]).toHaveLength(3);
    expect([...combined.matchAll(/REVOKE ALL ON FUNCTION [\w.]+\(\)\s+FROM PUBLIC, anon, authenticated, service_role/g)]).toHaveLength(3);
  });

  it('freezes the thirteen operation codes independently of command parent scope', () => {
    const check = constraint(operations, 'oc_op_catalog_ck');
    const codes = [...check.matchAll(/'([A-Z_]+)'/g)].map(match => match[1]);
    expect(codes).toEqual(['ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE',
      'ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE', 'CHANGE_PRIORITY',
      'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY', 'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT',
      'ORDER', 'ITEM', 'PIECE', 'PREFERENCE']);
  });

  it('binds audit target types to affected row identity rather than ADD command parent scope', () => {
    const check = constraint(operations, 'oc_op_target_ck');
    expect(check).toContain("operation_code IN ('ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY') AND target_type = 'ITEM' AND order_item_id IS NOT NULL AND order_item_piece_id IS NULL AND order_preference_id IS NULL");
    expect(check).toContain("operation_code IN ('ADD_PIECE', 'REMOVE_PIECE') AND target_type = 'PIECE' AND order_item_id IS NOT NULL AND order_item_piece_id IS NOT NULL AND order_preference_id IS NULL");
    expect(check).toContain("operation_code IN ('ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE') AND target_type = 'PREFERENCE' AND order_preference_id IS NOT NULL AND (order_item_piece_id IS NULL OR order_item_id IS NOT NULL)");
    expect(check).toContain("operation_code IN ('CHANGE_PRIORITY', 'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY', 'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT') AND target_type = 'ORDER' AND order_item_id IS NULL AND order_item_piece_id IS NULL AND order_preference_id IS NULL");
  });

  it('indexes history and sparse removal lookups without duplicate tuple indexes', () => {
    const tuples = [...history.matchAll(/CREATE INDEX \w+ ON public\.(\w+)\s*\(([^)]+)\)([^;]*);/g)]
      .map(match => `${match[1]}:${compact(match[2])}:${compact(match[3])}`);
    expect(new Set(tuples).size).toBe(tuples.length);
    expect(tuples).toContain('org_order_changes_mst:tenant_org_id, order_id, applied_at DESC:');
    expect(tuples).toContain('org_order_changes_mst:tenant_org_id, created_at DESC:');
    expect(tuples).toContain('org_order_change_ops_dtl:tenant_org_id, order_id, order_change_id:');
    for (const table of ['org_order_items_dtl', 'org_order_item_pieces_dtl', 'org_order_preferences_dtl']) {
      expect(tuples).toContain(`${table}:tenant_org_id, deleted_order_change_id:WHERE deleted_order_change_id IS NOT NULL`);
    }
  });

  it('keeps all authored object names within thirty characters and migrations transaction-safe', () => {
    const names = [...combined.matchAll(/(?:CREATE (?:TABLE|FUNCTION) public\.|CREATE (?:INDEX|TRIGGER) |(?:ADD )?CONSTRAINT )(\w+)/g)].map(match => match[1]);
    expect(names.length).toBeGreaterThan(30);
    for (const name of names) expect(name.length).toBeLessThanOrEqual(30);
    for (const migration of [foundation, history]) {
      expect(migration.trim()).toMatch(/^BEGIN;/);
      expect(migration.trim()).toMatch(/COMMIT;$/);
      expect(migration).toMatch(/SET LOCAL lock_timeout = '\d+s'/);
      expect(migration).toMatch(/SET LOCAL statement_timeout = '\d+s'/);
    }
    expect(combined).not.toMatch(/CREATE INDEX CONCURRENTLY|VALIDATE CONSTRAINT|DROP\s|TRUNCATE TABLE|INSERT INTO|UPDATE public\.|DELETE FROM|ALTER COLUMN|CREATE OR REPLACE/i);
    expect([...history.matchAll(/CREATE TABLE public\.(\w+)/g)].map(match => match[1])).toEqual(['org_order_changes_mst', 'org_order_change_ops_dtl']);
  });
});
