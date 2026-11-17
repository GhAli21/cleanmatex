/**
 * Fails when the drafted S0 migrations drift from the reviewed allowlist.
 * No database connection. A green result does not mean the migrations are applied.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

const allowlist = read('docs/pending_to_production/16_11_2026/S0_authenticated_allowlist.md')
const fence = allowlist.match(/```s0-allowlist\r?\n([\s\S]*?)```/)
if (!fence) {
  throw new Error('S0 allowlist is missing the s0-allowlist block')
}
const signatures = fence[1]
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))

if (signatures.length === 0) {
  throw new Error('S0 allowlist block is empty')
}

const helperFence = allowlist.match(/```s0-rls-helpers\r?\n([\s\S]*?)```/)
if (!helperFence) {
  throw new Error('S0 allowlist is missing the s0-rls-helpers block')
}
const rlsHelpers = helperFence[1]
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))

if (rlsHelpers.length === 0) {
  throw new Error('S0 row-security helper block is empty')
}

const migrationB = read('supabase/migrations/0746_revoke_definer_execute_and_lock_search_path.sql')
const migrationD = read('supabase/migrations/0748_grant_rls_helper_execute.sql')
const migrationE = read('supabase/migrations/0749_settings_resolver_session_definer.sql')
const migrationA = read('supabase/migrations/0745_revoke_sys_hq_anon_writes.sql')
const migrationC = read('supabase/migrations/0747_security_invoker_catalog_views.sql')
const invariant = read('scripts/db/check-s0-privileges.sql')

const settingsFence = allowlist.match(/```s0-settings-resolvers\r?\n([\s\S]*?)```/)
if (!settingsFence) {
  throw new Error('S0 allowlist is missing the s0-settings-resolvers block')
}
const settingsResolvers = settingsFence[1]
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))

if (settingsResolvers.length === 0) {
  throw new Error('S0 settings resolver block is empty')
}

for (const signature of settingsResolvers) {
  const grant = `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated, service_role;`
  if (!migrationE.includes(grant)) {
    throw new Error(`0749 is missing ${grant}`)
  }
  const bare = signature.replace(/^public\./, '')
  if (!invariant.includes(`'${bare}'`)) {
    throw new Error(`check-s0-privileges.sql is missing ${bare}`)
  }
}

for (const signature of rlsHelpers) {
  const grant = `GRANT EXECUTE ON FUNCTION ${signature} TO anon, authenticated;`
  if (!migrationD.includes(grant)) {
    throw new Error(`0748 is missing ${grant}`)
  }
  const bare = signature.replace(/^public\./, '')
  if (!invariant.includes(`'${bare}'`)) {
    throw new Error(`check-s0-privileges.sql is missing ${bare}`)
  }
}

for (const signature of signatures) {
  const grant = `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`
  if (!migrationB.includes(grant)) {
    throw new Error(`0746 is missing ${grant}`)
  }
  const bare = signature.replace(/^public\./, '')
  if (!migrationB.includes(`'${bare}'`)) {
    throw new Error(`0746 self-check is missing ${bare}`)
  }
  if (!invariant.includes(`'${bare}'`)) {
    throw new Error(`check-s0-privileges.sql is missing ${bare}`)
  }
}

const required = [
  [migrationA, 'REVOKE ALL ON TABLE'],
  [migrationA, 'FORCE ROW LEVEL SECURITY'],
  [migrationA, "lock_timeout = '3s'"],
  [migrationA, 'RAISE EXCEPTION'],
  [migrationA, 'crm_track_test'],
  [migrationB, 'REVOKE ALL ON FUNCTION'],
  [migrationB, 'SET search_path'],
  [migrationB, "lock_timeout = '3s'"],
  [migrationB, 'RAISE EXCEPTION'],
  [migrationC, 'security_invoker = true'],
  [migrationC, 'v_effective_tenant_settings'],
  [migrationC, 'vw_fin_coa_explorer'],
  [migrationC, 'vw_fin_effective_gov_for_tenant'],
  [migrationC, 'vw_fin_missing_required_usage'],
  [migrationC, 'vw_fin_open_exceptions'],
  [migrationC, 'vw_fin_tenant_readiness'],
  [migrationC, 'org_order_status_history_legacy'],
  [migrationC, "lock_timeout = '3s'"],
  [migrationC, 'RAISE EXCEPTION'],
  [invariant, 'SECURITY DEFINER'],
  [invariant, 'security_invoker=true'],
  [invariant, 'pg_default_acl'],
  [invariant, 'rls_helpers'],
  [migrationD, 'current_tenant_id'],
  [migrationD, 'is_admin'],
  [migrationD, 'RAISE EXCEPTION'],
]

for (const [source, needle] of required) {
  if (!source.includes(needle)) {
    throw new Error(`Missing required text: ${needle}`)
  }
}

if (migrationA.includes('USING (true)') || migrationB.includes('USING (true)') || migrationC.includes('USING (true)')) {
  throw new Error('S0 migrations must not add USING (true)')
}

console.log(`s0 source check passed (${signatures.length} authenticated functions, ${rlsHelpers.length} row-security helpers, ${settingsResolvers.length} settings resolvers)`)
