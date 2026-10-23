/** @jest-environment node */

/**
 * Repo-wide guard (BF-20): no `'use server'` export may trust a caller-supplied
 * tenant id.
 *
 * A server action is a callable HTTP endpoint. Any exported async function in
 * a `'use server'` module whose parameters mention a tenant must call
 * `resolveActionTenant` (lib/auth/server-action-guard.ts), which takes the
 * tenant from the session and only verifies the caller's value.
 *
 * To add an exception, add it to ALLOWED with the reason. Prefer fixing the
 * action instead.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'src', 'lib'];

/** `file::function` → reason it is safe without the shared guard. */
const ALLOWED: Record<string, string> = {
  'app/actions/orders/delete-order.ts::deleteOrderAction':
    'Compares the caller tenant with getAuthContext().tenantId and checks orders:delete (pattern predating the guard).',
  'app/actions/orders/complete-preparation.ts::completePreparation':
    'Ignores the `_tenantOrgId` argument and resolves tenant and user from the session; checks orders:update and orders:transition.',
  'app/actions/payments/voucher-crud-actions.ts::createVoucherAction':
    'Parameter type is Omit<…, "tenant_org_id">: it excludes the tenant; the action resolves it from the session.',
};

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (/node_modules|\.next/.test(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

interface Offender {
  key: string;
  params: string;
}

function findOffenders(): Offender[] {
  const offenders: Offender[] = [];
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/^\s*['"]use server['"]/m.test(src.slice(0, 800))) continue;

    const re = /export\s+async\s+function\s+(\w+)\s*\(([\s\S]*?)\)\s*(?::[^{]*)?\{/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(src))) {
      const [, fnName, params] = match;
      if (!/tenant/i.test(params)) continue;

      const key = `${path.relative(ROOT, file).split(path.sep).join('/')}::${fnName}`;
      if (ALLOWED[key]) continue;

      // The function body runs from this match to the next top-level export.
      const rest = src.slice(match.index + match[0].length);
      const next = rest.search(/\nexport\s/);
      const body = next === -1 ? rest : rest.slice(0, next);
      if (!/\bresolveActionTenant\s*\(/.test(body)) {
        offenders.push({ key, params: params.replace(/\s+/g, ' ').trim() });
      }
    }
  }
  return offenders;
}

describe('server actions never trust a caller-supplied tenant (BF-20)', () => {
  it('every tenant-taking server action calls resolveActionTenant', () => {
    const offenders = findOffenders();
    expect(offenders).toEqual([]);
  });

  it('every ALLOWED entry still exists (no stale exceptions)', () => {
    for (const key of Object.keys(ALLOWED)) {
      const [file, fnName] = key.split('::');
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(src).toMatch(new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`));
    }
  });
});
