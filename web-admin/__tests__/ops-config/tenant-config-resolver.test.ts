/** @jest-environment node */
import {
  invalidateTenantConfigCache,
  resolveTenantConfig,
  resolveTenantConfigRow,
  tenantConfigFingerprint,
  type TenantConfigRow,
} from '@lib/ops-config/tenant-config-resolver';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const ENV = 'TENANT_CFG_TEST_ENV';
const row = (over: Partial<TenantConfigRow> = {}): TenantConfigRow => ({
  config_key: 'ntf.app.twilio.auth_token',
  source_policy: 'ENV_OVERRIDES_DB',
  is_encrypted: false,
  env_var_name: ENV,
  db_value: null,
  db_value_enc: null,
  db_value_fingerprint: null,
  ...over,
});
const stored = (value: string, over: Partial<TenantConfigRow> = {}) =>
  row({ db_value: value, db_value_fingerprint: tenantConfigFingerprint(value), ...over });
const encrypted = (value: string, over: Partial<TenantConfigRow> = {}) =>
  row({ is_encrypted: true, db_value: null, db_value_enc: 'v1.envelope', db_value_fingerprint: tenantConfigFingerprint(value), ...over });

describe('resolveTenantConfigRow — policy matrix (same as HQ)', () => {
  it('DB_ONLY uses the stored value and ignores the environment', () => {
    expect(resolveTenantConfigRow(stored('db', { source_policy: 'DB_ONLY' }), { [ENV]: 'env' }).value).toBe('db');
    expect(resolveTenantConfigRow(row({ source_policy: 'DB_ONLY' }), { [ENV]: 'env' }).value).toBeUndefined();
  });

  it('ENV_ONLY uses the environment only', () => {
    expect(resolveTenantConfigRow(stored('db', { source_policy: 'ENV_ONLY' }), { [ENV]: ' env ' }).value).toBe('env');
    expect(resolveTenantConfigRow(stored('db', { source_policy: 'ENV_ONLY' }), {}).value).toBeUndefined();
  });

  it('ENV_OVERRIDES_DB: env wins, stored is the fallback, blank env counts as unset', () => {
    expect(resolveTenantConfigRow(stored('db'), { [ENV]: 'env' }).value).toBe('env');
    expect(resolveTenantConfigRow(stored('db'), { [ENV]: '   ' }).value).toBe('db');
    expect(resolveTenantConfigRow(row(), {}).value).toBeUndefined();
  });

  it.each(['DB_OVERRIDES_ENV', 'TAKE_EXISTING_DB_OR_ENV'])('%s: stored wins, env is the fallback', (policy) => {
    expect(resolveTenantConfigRow(stored('db', { source_policy: policy }), { [ENV]: 'env' }).value).toBe('db');
    expect(resolveTenantConfigRow(row({ source_policy: policy }), { [ENV]: 'env' }).value).toBe('env');
  });

  it('BOTH_MUST_MATCH returns the value only when equal; otherwise a value-free refusal', () => {
    expect(resolveTenantConfigRow(stored('same', { source_policy: 'BOTH_MUST_MATCH' }), { [ENV]: 'same' }).value).toBe('same');
    const refused = resolveTenantConfigRow(stored('db-secret', { source_policy: 'BOTH_MUST_MATCH' }), { [ENV]: 'env-secret' });
    expect(refused.value).toBeUndefined();
    expect(refused.refused).toBeDefined();
    expect(refused.refused).not.toContain('secret-');
    expect(resolveTenantConfigRow(row({ source_policy: 'BOTH_MUST_MATCH' }), {}).value).toBeUndefined();
  });

  it('returns a plain-stored secret (encryption is independent of is_secret)', () => {
    expect(resolveTenantConfigRow(stored('plain-token', { source_policy: 'DB_ONLY' }), {}).value).toBe('plain-token');
  });

  it('cannot read an encrypted stored value, but accepts an environment value proven equal by fingerprint', () => {
    const enc = encrypted('real-token', { source_policy: 'DB_OVERRIDES_ENV' });
    expect(resolveTenantConfigRow(enc, { [ENV]: 'real-token' }).value).toBe('real-token');
    const refused = resolveTenantConfigRow(enc, { [ENV]: 'other' });
    expect(refused.value).toBeUndefined();
    expect(refused.refused).toMatch(/encrypted/);
    // ENV_OVERRIDES_DB never needs the stored plaintext while the env is set.
    expect(resolveTenantConfigRow(encrypted('x'), { [ENV]: 'env' }).value).toBe('env');
  });

  it('uses the fallback variable name when the row names none', () => {
    expect(resolveTenantConfigRow(row({ env_var_name: null }), { OTHER_ENV: 'v' }, 'OTHER_ENV').value).toBe('v');
  });
});

describe('resolveTenantConfig — registry loading', () => {
  const rpc = jest.fn();
  const saved = process.env[ENV];

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateTenantConfigCache();
    delete process.env[ENV];
    jest.mocked(createAdminSupabaseClient).mockReturnValue({ rpc } as never);
  });
  afterAll(() => {
    if (saved === undefined) delete process.env[ENV];
    else process.env[ENV] = saved;
  });

  it('loads only the keys TENANT_WEB still uses, in one call, and caches them', async () => {
    rpc.mockResolvedValue({ data: [stored('from-registry', { source_policy: 'DB_ONLY' })], error: null });
    await expect(resolveTenantConfig('ntf.app.twilio.auth_token', ENV)).resolves.toBe('from-registry');
    await expect(resolveTenantConfig('ntf.app.twilio.auth_token', ENV)).resolves.toBe('from-registry');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('fn_ops_config_get_raw', { p_app: 'TENANT_WEB' });
  });

  it('falls back to the environment variable when the key is not registered', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    process.env[ENV] = 'from-env';
    await expect(resolveTenantConfig('ntf.app.unknown', ENV)).resolves.toBe('from-env');
  });

  it('falls back to the environment when the registry cannot be read', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    process.env[ENV] = 'from-env';
    await expect(resolveTenantConfig('ntf.app.twilio.auth_token', ENV)).resolves.toBe('from-env');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs a refusal by key only, never the value, and returns undefined (fail closed)', async () => {
    rpc.mockResolvedValue({ data: [stored('db-secret-1', { source_policy: 'BOTH_MUST_MATCH' })], error: null });
    process.env[ENV] = 'env-secret-2';
    await expect(resolveTenantConfig('ntf.app.twilio.auth_token', ENV)).resolves.toBeUndefined();
    const logged = JSON.stringify(jest.mocked(logger.error).mock.calls);
    expect(logged).toContain('ntf.app.twilio.auth_token');
    expect(logged).not.toContain('db-secret-1');
    expect(logged).not.toContain('env-secret-2');
  });
});
