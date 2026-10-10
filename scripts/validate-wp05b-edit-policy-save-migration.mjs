/**
 * WP05-B forward-migration contract check.
 *
 * This remains static because migration execution is operator-owned. It rejects
 * unsafe function scope, missing lifecycle coverage enforcement, and a command
 * that browser roles could invoke directly.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/0599_wp05b_edit_policy_save_command.sql')
const sql = readFileSync(migrationPath, 'utf8')

const requiredFragments = [
  'BEGIN;',
  "SET LOCAL lock_timeout = '5s';",
  'CREATE OR REPLACE FUNCTION public.sys_wf_edit_rule_guard()',
  'CREATE OR REPLACE FUNCTION public.sys_wf_edit_policy_guard()',
  'CREATE FUNCTION public.sys_wf_edit_policy_save(',
  'SECURITY INVOKER',
  "current_setting('cmx.edit_policy_save', true) IS DISTINCT FROM 'on'",
  "PERFORM set_config('cmx.edit_policy_save', 'on', true);",
  "NEW.lifecycle_status IN ('PILOT', 'PUBLISHED')",
  'COUNT(*) * 15 INTO v_required_rule_count',
  'DELETE FROM public.sys_wf_edit_policy_rule_dtl WHERE edit_policy_id = p_edit_policy_id;',
  'UPDATE public.sys_wf_edit_policy_mst AS policy',
  'policy_revision = policy.policy_revision + 1',
  'REVOKE ALL ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;',
  'GRANT EXECUTE ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;',
  'COMMENT ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID)',
  'COMMIT;',
]

for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) {
    throw new Error(`0599 contract missing: ${fragment}`)
  }
}

for (const forbiddenFragment of ['SECURITY DEFINER', 'DROP ', 'CASCADE']) {
  if (sql.includes(forbiddenFragment)) {
    throw new Error(`0599 contains forbidden migration scope: ${forbiddenFragment}`)
  }
}

console.log('0599 WP05-B Edit Policy save-command static contract: PASS')
