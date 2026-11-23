/**
 * Test environment. Imported first by every test file so it runs before any web-admin module loads.
 * Every database URL is forced to the local test database, so a shell DATABASE_URL pointing at a
 * shared database can never be used by a test.
 */
import { execSync } from 'node:child_process';

export const LOCAL_DB = process.env.JOBS_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * The local Supabase API and keys, read from `supabase status` (local stack only), for tests that
 * run web-admin code calling Supabase over HTTP. Placeholders when the CLI is unavailable; those
 * tests then fail on their first Supabase call. JOBS_TEST_SUPABASE_* override.
 */
function localSupabase(): { url: string; anon: string; service: string } {
  const fromEnv = process.env.JOBS_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (fromEnv) {
    return { url: process.env.JOBS_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321', anon: process.env.JOBS_TEST_SUPABASE_ANON_KEY ?? 'anon', service: fromEnv };
  }
  try {
    const out = execSync('npx supabase status -o env', { cwd: new URL('../..', import.meta.url), stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 }).toString();
    const get = (k: string) => new RegExp(`^${k}="?([^"\\r\\n]*)"?`, 'm').exec(out)?.[1];
    const url = get('API_URL');
    const anon = get('ANON_KEY');
    const service = get('SERVICE_ROLE_KEY');
    if (url && anon && service) return { url, anon, service };
  } catch {
    // fall through to placeholders
  }
  return { url: 'http://127.0.0.1:54321', anon: 'local-test-anon-key', service: 'local-test-service-role-key' };
}

const supabase = localSupabase();

export const LOCAL_ENV = {
  JOBS_DATABASE_URL: LOCAL_DB,
  DATABASE_URL: LOCAL_DB,
  NEXT_PUBLIC_SUPABASE_URL: supabase.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anon,
  SUPABASE_SERVICE_ROLE_KEY: supabase.service,
};

Object.assign(process.env, LOCAL_ENV);
