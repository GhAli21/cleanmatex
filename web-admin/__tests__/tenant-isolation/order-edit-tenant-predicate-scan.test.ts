/**
 * WP18 OC-SEC-005: the Order Edit, commercial calculator and financial view server code runs on
 * Prisma as `postgres` (row security does not apply), so every `org_*` query must carry its own
 * `tenant_org_id` predicate (CLAUDE.md rule 4). This scan fails on any Prisma call or raw SQL block
 * on an `org_*` table in those folders without one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOTS = ['lib/services/order-change', 'lib/services/commercial', 'lib/services/order-fin-view'];

function files(dir: string): string[] {
  const abs = path.join(process.cwd(), dir);
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(rel);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

/** Text from `start` (an opening bracket) to its matching closing bracket. */
function balanced(code: string, start: number, open: string, close: string): string {
  let depth = 0;
  for (let i = start; i < code.length; i += 1) {
    if (code[i] === open) depth += 1;
    else if (code[i] === close && --depth === 0) return code.slice(start, i + 1);
  }
  return code.slice(start);
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Tables without a `tenant_org_id` column: the organization row itself is keyed by its id. */
const NO_TENANT_COLUMN = new Set(['org_tenants_mst']);

/** Prisma model calls that read or write rows (aggregate/groupBy/count included). */
const PRISMA_CALL = /\.(org_[a-z0-9_]+)\.(findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|updateMany|update|deleteMany|delete|count|aggregate|groupBy|upsert|create|createMany)\s*\(/g;

describe('OC-SEC-005 tenant predicate scan (Order Edit server code)', () => {
  const offenders: string[] = [];
  for (const file of ROOTS.flatMap(files)) {
    const code = stripComments(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));
    // Shared filters such as `const scope = { tenant_org_id: …, order_id: … }` count as the predicate.
    const scoped = [...code.matchAll(/const\s+([a-zA-Z_$][\w$]*)\s*=\s*\{[^}]*tenant_org_id/g)].map((m) => m[1]);
    const usesScope = (args: string) => scoped.some((name) => new RegExp(`(\\.\\.\\.|where:\\s*)${name}\\b`).test(args));
    for (const match of code.matchAll(PRISMA_CALL)) {
      if (NO_TENANT_COLUMN.has(match[1])) continue;
      const args = balanced(code, (match.index ?? 0) + match[0].length - 1, '(', ')');
      // A call whose arguments come from a variable is checked where the variable is built; flag only literal shapes.
      if (/^\(\s*[a-zA-Z_$][\w$.]*\s*\)$/.test(args)) continue;
      // Inserts of rows built by a writer (`data: rows.x`) carry tenant_org_id from that builder.
      if (/^(create|createMany)$/.test(match[2]) && !/data:\s*[{[]/.test(args)) continue;
      if (/^(create|createMany)$/.test(match[2]) && /data:\s*[a-zA-Z_$][\w$.]*\.map\(/.test(args)) continue;
      if (!/tenant_org_id|tenantOrgId/.test(args) && !usesScope(args)) offenders.push(`${file}: ${match[1]}.${match[2]}`);
    }
    for (const match of code.matchAll(/\$(?:queryRaw|executeRaw)(?:Unsafe)?\s*(?:<[^`(]*>)?\s*`/g)) {
      const startTick = (match.index ?? 0) + match[0].length - 1;
      const end = code.indexOf('`', startTick + 1);
      const sql = code.slice(startTick, end + 1);
      if (/\borg_[a-z0-9_]+/.test(sql) && !/tenant_org_id/.test(sql)) offenders.push(`${file}: raw SQL ${sql.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
  }

  it('finds the server code it is meant to scan', () => {
    expect(ROOTS.flatMap(files).length).toBeGreaterThan(10);
  });

  it('has no org_* query without a tenant_org_id predicate', () => {
    expect(offenders).toEqual([]);
  });
});
