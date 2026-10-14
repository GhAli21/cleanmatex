/**
 * Tenant-app resolver for the Config Registry (`sys_ops_config_cf`, migrations 0612/0615/0617).
 *
 * The registry is the single authority for configuration (owner decision 2026-10-15). HQ
 * platform-api has its own resolver; this is the tenant web app's equivalent with the SAME policy
 * matrix (env = this host's environment variable, db = registry stored value):
 *  - DB_ONLY                 -> db
 *  - ENV_ONLY                -> env
 *  - ENV_OVERRIDES_DB        -> env, else db            (legacy "env wins")
 *  - DB_OVERRIDES_ENV        -> db, else env
 *  - TAKE_EXISTING_DB_OR_ENV -> db, else env            (HQ "Check now" reports DRIFT on a difference)
 *  - BOTH_MUST_MATCH         -> the value when equal; refused when they differ or only one is set
 *
 * Encrypted values: the HQ master key never reaches this host, so an encrypted stored value cannot be
 * read here. It is still compared by fingerprint, so an environment value equal to it is accepted;
 * anything that would need the plaintext is refused (fail closed: the caller sees "not configured").
 *
 * Reads: one call to `fn_ops_config_get_raw(p_app => 'TENANT_WEB')` loads every key this app still
 * uses; cached for 45 s, stale data served when a reload fails, and the legacy environment variable is
 * used when the registry is unreadable or the key is not registered. Values are never logged.
 * Server-only (service-role client).
 */
import { createHash } from 'node:crypto';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';

/** App code of this host in `applies_to_app`. */
export const TENANT_CONFIG_APP = 'TENANT_WEB';

/** Cache lifetime of the loaded registry rows (same as the HQ resolver). */
export const TENANT_CONFIG_TTL_MS = 45_000;

/** Registry storage columns this resolver needs (subset of `fn_ops_config_get_raw`). */
export interface TenantConfigRow {
  config_key: string;
  source_policy: string;
  is_encrypted: boolean;
  env_var_name: string | null;
  db_value: string | null;
  db_value_enc: string | null;
  db_value_fingerprint: string | null;
}

/** Outcome of resolving one row; `refused` carries a value-free reason. */
export interface TenantConfigResolution {
  value: string | undefined;
  refused?: string;
}

/** Trimmed environment value; empty or missing means "not set". */
export function readTenantEnv(env: NodeJS.ProcessEnv, name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const raw = env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** SHA-256 hex of a trimmed value (same fingerprint as the HQ registry). */
export function tenantConfigFingerprint(value: string): string {
  return createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

/**
 * Pure policy matrix for one registry row. Never returns or reports a value in `refused`.
 * @param row Registry storage columns of the key.
 * @param env Process environment of this host.
 * @param envFallback Variable name used when the row names none.
 */
export function resolveTenantConfigRow(
  row: TenantConfigRow,
  env: NodeJS.ProcessEnv,
  envFallback?: string,
): TenantConfigResolution {
  const envValue = readTenantEnv(env, row.env_var_name ?? envFallback);
  const stored = row.db_value_fingerprint !== null;
  // Plain stored value readable here; an encrypted one is not (HQ master key never on this host).
  const plain = !row.is_encrypted && row.db_value !== null && row.db_value.trim() !== '' ? row.db_value.trim() : undefined;
  const envMatchesStored = envValue !== undefined && stored && tenantConfigFingerprint(envValue) === row.db_value_fingerprint;

  /** Stored value, or the env value when it provably equals an encrypted stored value. */
  const storedReadable = (): TenantConfigResolution => {
    if (plain !== undefined) return { value: plain };
    if (envMatchesStored) return { value: envValue };
    return { value: undefined, refused: 'stored value is encrypted and cannot be read by the tenant app' };
  };

  switch (row.source_policy) {
    case 'DB_ONLY':
      return stored ? storedReadable() : { value: undefined };
    case 'ENV_ONLY':
      return { value: envValue };
    case 'ENV_OVERRIDES_DB':
      if (envValue !== undefined) return { value: envValue };
      return stored ? storedReadable() : { value: undefined };
    case 'DB_OVERRIDES_ENV':
    case 'TAKE_EXISTING_DB_OR_ENV':
      if (stored) return storedReadable();
      return { value: envValue };
    case 'BOTH_MUST_MATCH':
      if (envValue === undefined && !stored) return { value: undefined };
      if (envMatchesStored) return { value: envValue };
      return { value: undefined, refused: 'environment and stored value must match' };
    default:
      return { value: undefined, refused: `unknown source policy ${row.source_policy}` };
  }
}

interface RegistryCache {
  rows: Map<string, TenantConfigRow>;
  expiresAt: number;
}

let cache: RegistryCache | null = null;

/** Drops the cached registry rows (tests; after an operator change the TTL suffices). */
export function invalidateTenantConfigCache(): void {
  cache = null;
}

/** Loads every key the tenant app still uses; stale cache on a failed reload; null when unreadable. */
async function loadRegistry(): Promise<Map<string, TenantConfigRow> | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.rows;
  try {
    const { data, error } = await createAdminSupabaseClient().rpc('fn_ops_config_get_raw', { p_app: TENANT_CONFIG_APP });
    if (error) throw new Error(error.message);
    const rows = new Map<string, TenantConfigRow>();
    for (const row of data ?? []) {
      rows.set(row.config_key, {
        config_key: row.config_key,
        source_policy: row.source_policy,
        is_encrypted: row.is_encrypted === true,
        env_var_name: row.env_var_name ?? null,
        db_value: row.db_value ?? null,
        db_value_enc: row.db_value_enc ?? null,
        db_value_fingerprint: row.db_value_fingerprint ?? null,
      });
    }
    cache = { rows, expiresAt: now + TENANT_CONFIG_TTL_MS };
    return rows;
  } catch (err) {
    logger.warn('tenant-config: registry read failed', {
      error: err instanceof Error ? err.message : String(err),
      fallback: cache ? 'stale cache' : 'environment',
      feature: 'ops-config',
    });
    return cache ? cache.rows : null;
  }
}

/**
 * Resolves one registry key for the tenant app. Never throws and never logs a value.
 * @param key Registry key (for example `ntf.app.twilio.auth_token`).
 * @param envFallback Environment variable used when the key is not registered or the registry is unreadable.
 * @returns The live value, or undefined when unset or refused (a refusal is logged by key only, so callers
 *   treat it exactly like a missing setting and fail closed).
 */
export async function resolveTenantConfig(key: string, envFallback?: string): Promise<string | undefined> {
  const rows = await loadRegistry();
  const row = rows?.get(key);
  if (!row) return readTenantEnv(process.env, envFallback);
  const result = resolveTenantConfigRow(row, process.env, envFallback);
  if (result.refused) {
    logger.error('tenant-config: value refused by its source policy', undefined, {
      configKey: key,
      reason: result.refused,
      feature: 'ops-config',
    });
  }
  return result.value;
}
