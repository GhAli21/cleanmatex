/** @jest-environment node */

/**
 * Repo-wide guard (BF-23, docs/features/API_Route_Auth_Hardening/PLAN.md).
 *
 * 1. Tenant comes from the validated session, never from `get_user_tenants()[0]`.
 *    Only the files in RPC_ALLOWED may call that RPC (sign-in, the client tenant
 *    list, and the role lookup that matches the session tenant).
 * 2. Every `app/api/**\/route.ts` must validate the session: a permission guard
 *    (`requirePermission` family) or a session guard (`validateJWTWithTenant`,
 *    `getAuthContext`, `getTenantIdFromSession`, or a service helper built on them).
 *    Exempt: pre-session auth endpoints, public customer/token routes and
 *    signature-verified webhooks. LEGACY_UNGUARDED lists routes that predate this
 *    rule; it may only shrink — fix a route, then remove it from the list.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Files allowed to call rpc('get_user_tenants') → reason. */
const RPC_ALLOWED: Record<string, string> = {
  'app/api/auth/login/route.ts': 'Picks the active membership at sign-in, before a session exists.',
  'lib/auth/server-auth.ts': 'Reads the role of the session tenant; fails closed when it is not in the list.',
  'lib/auth/auth-context.tsx': 'Client tenant list for the UI; no authorization decision.',
  'lib/services/auth-data.service.ts': 'Client tenant list loaded after sign-in; no authorization decision.',
  'app/dashboard/jhtestui/components/UserContextViewer.tsx': 'Developer diagnostics screen; displays the list only.',
  'proxy.ts': 'Admin page redirect check (UX); every API route validates the session itself.',
};

const GUARD_RE =
  /\b(requirePermission|requireAnyPermission|requireAllPermissions|withPermission|withAnyPermission|withAllPermissions|validateJWTWithTenant|withJWTTenantValidation|getAuthContext|getTenantIdFromSession|withTenantFromSession|requireAuth|getCurrentTenant|getAuthenticatedTenantId|getCurrentSubscription|requireTenantAuth|requireRequestPermission|createWorkflowStageCommandHandler)\s*\(/;

const EXEMPT = [
  /^app\/api\/auth\//, // sign-in, sign-out, password reset: run before or while ending a session
  /^app\/api\/v1\/public\//, // customer app and tracking links: own token auth
  /\/webhooks?\//, // provider callbacks: signature verification
  /^app\/api\/docs\/route\.ts$/, // public OpenAPI spec for the /api-docs Swagger viewer; no tenant data
  /^app\/api\/v1\/customers\/(send-otp|verify-otp)\/route\.ts$/, // pre-session phone verification; rate-limited, no session yet
  /^app\/api\/v1\/tenants\/(check-slug|register)\/route\.ts$/, // pre-session tenant signup flow
  /^app\/api\/(finance\/process-(jobs|outbox)|notifications\/(process-campaigns|process-outbox|reconcile-outbox))\/route\.ts$/, // pg_cron-driven internal jobs: Bearer {OUTBOX_SECRET}, not a user session
];

/** Routes that predate the rule. Review each in a follow-up package; never add to this list. */
const LEGACY_UNGUARDED: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (/node_modules|\.next/.test(full)) continue;
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

function routeFiles(): string[] {
  return walk(path.join(ROOT, 'app', 'api'))
    .filter((f) => path.basename(f) === 'route.ts')
    .map(rel);
}

describe('API routes resolve the tenant from the validated session (BF-23)', () => {
  it('only allowed files call rpc("get_user_tenants")', () => {
    const files = [
      ...['app', 'src', 'lib'].flatMap((d) => walk(path.join(ROOT, d))),
      path.join(ROOT, 'proxy.ts'),
    ].filter((f) => fs.existsSync(f));
    const offenders = files
      .filter((f) => /rpc\(\s*['"]get_user_tenants['"]/.test(fs.readFileSync(f, 'utf8')))
      .map(rel)
      .filter((f) => !RPC_ALLOWED[f]);
    expect(offenders).toEqual([]);
  });

  it('no route uses get_user_tenants()[0] / tenants[0] as the tenant', () => {
    const offenders = routeFiles().filter(
      (f) => !RPC_ALLOWED[f] && /tenants\??\[0\]/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('every non-exempt route validates the session (legacy list may only shrink)', () => {
    const legacy = new Set(LEGACY_UNGUARDED);
    const offenders = routeFiles().filter((f) => {
      if (EXEMPT.some((re) => re.test(f)) || legacy.has(f)) return false;
      return !GUARD_RE.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    });
    expect(offenders).toEqual([]);
  });

  it('every LEGACY_UNGUARDED entry still exists and is still unguarded (remove fixed ones)', () => {
    const stale = LEGACY_UNGUARDED.filter((f) => {
      const full = path.join(ROOT, f);
      return !fs.existsSync(full) || GUARD_RE.test(fs.readFileSync(full, 'utf8'));
    });
    expect(stale).toEqual([]);
  });

  it('every RPC_ALLOWED entry still calls the RPC (no stale exceptions)', () => {
    const stale = Object.keys(RPC_ALLOWED).filter((f) => {
      const full = path.join(ROOT, f);
      return !fs.existsSync(full) || !/rpc\(\s*['"]get_user_tenants['"]/.test(fs.readFileSync(full, 'utf8'));
    });
    expect(stale).toEqual([]);
  });
});
