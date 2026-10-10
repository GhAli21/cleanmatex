/**
 * Validates the immutable source contract of the unapplied WP05-B migration.
 *
 * This is intentionally static: it proves the reviewed SQL retains the V1 grammar,
 * safety guards, and documentation expectations without running DDL against a DB.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve('supabase/migrations/0597_wp05b_order_edit_policy_foundation.sql');
const sql = readFileSync(migrationPath, 'utf8');

/** Fails with an actionable message so a changed SQL contract is caught in review. */
function requireText(needle, label) {
  if (!sql.includes(needle)) {
    throw new Error(`WP05-B migration contract failed: missing ${label}.`);
  }
}

const requiredTables = [
  'sys_wf_order_edit_ops_cd',
  'sys_wf_order_edit_op_tgt_cd',
  'sys_wf_edit_policy_mst',
  'sys_wf_edit_policy_rule_dtl',
  'org_wf_edit_policy_asg_cf',
];

for (const table of requiredTables) {
  requireText(`CREATE TABLE public.${table}`, `${table} table`);
  requireText(`COMMENT ON TABLE public.${table}`, `${table} table comment`);
}

for (const guard of [
  'sys_wf_edit_grammar_guard',
  'sys_wf_edit_policy_guard',
  'sys_wf_edit_rule_guard',
  'org_wf_edit_asg_guard',
]) {
  requireText(`CREATE FUNCTION public.${guard}`, `${guard} function`);
  requireText(`COMMENT ON FUNCTION public.${guard}`, `${guard} function comment`);
}

requireText("('ADD_PREFERENCE','ORDER'", 'ADD_PREFERENCE / ORDER mapping');
requireText("('ADD_PREFERENCE','ITEM'", 'ADD_PREFERENCE / ITEM mapping');
requireText("('ADD_PREFERENCE','PIECE'", 'ADD_PREFERENCE / PIECE mapping');
requireText('IF v_operation_count <> 13 OR v_pair_count <> 15 THEN', '13-code/15-pair coverage assertion');
requireText(
  'SELECT matrix.edit_policy_id,matrix.status_code,matrix.operation_code,matrix.target_type,matrix.decision,',
  'qualified Draft-matrix seed projection',
);
requireText('FOR UPDATE;', 'serialized Draft/Pilot rule guard');
requireText('policy_revision = policy_revision + 1', 'rule freshness increment');
requireText('ALTER TABLE public.org_wf_edit_policy_asg_cf ENABLE ROW LEVEL SECURITY;', 'tenant assignment RLS');
requireText('REVOKE ALL ON TABLE', 'browser privilege revocation');
requireText('GRANT SELECT ON TABLE public.sys_wf_order_edit_ops_cd', 'read-only grammar grant');
requireText('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_wf_edit_policy_mst', 'trusted policy administration grant');

if (/\bSECURITY\s+DEFINER\b/i.test(sql)) {
  throw new Error('WP05-B migration contract failed: SECURITY DEFINER is not permitted for these policy guards.');
}
if (/\bCASCADE\b/i.test(sql)) {
  throw new Error('WP05-B migration contract failed: CASCADE is not permitted.');
}
if (/INSERT\s+INTO\s+public\.org_wf_edit_policy_asg_cf/i.test(sql)) {
  throw new Error('WP05-B migration contract failed: no tenant assignment may be seeded.');
}

console.log('WP05-B migration static contract: PASS');
