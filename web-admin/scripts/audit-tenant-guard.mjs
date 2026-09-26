/**
 * Tenant Guard static audit (Tenant Guard Restoration — Phase 1 discovery).
 *
 * Complements the runtime guard (lib/db/tenant-guard.ts): runtime logging only sees
 * code paths that actually execute, so this scans every Prisma model call and raw-SQL
 * template in app code and classifies it:
 *   MISSING — literal args with no tenant_org_id anywhere in them
 *   REVIEW  — args built elsewhere (variable / spread), or raw SQL we can't judge
 *   OK      — tenant_org_id appears in the args (not proof of correctness; the
 *             runtime guard is the real check)
 *   BYPASS  — call sits directly inside withTenantGuardBypass(reason, …); must be in
 *             the STATUS.md bypass register
 *
 * Heuristic by design (naive paren/backtick matching). It produces a worklist, not a verdict.
 *
 * Usage:  node scripts/audit-tenant-guard.mjs [--out <file.md>]
 * Exit code is always 0 in Phase 1; Phase 3 may gate CI on MISSING == 0.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['lib', 'app', 'src'];
const SKIP = new Set(['node_modules', '.next', '__tests__', '__mocks__']);
const SCHEMA = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8');

// Tenant-scoped models = models with a tenant_org_id field (+ org_tenants_mst on id),
// mirroring the runtime guard's catalog.
const scoped = new Map();
for (const m of SCHEMA.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  if (m[1] === 'org_tenants_mst') scoped.set(m[1], 'id');
  else if (/^\s+tenant_org_id\s/m.test(m[2])) scoped.set(m[1], 'tenant_org_id');
}

const OPS =
  'findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|count|aggregate|groupBy|' +
  'create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany';
const CALL_RE = new RegExp(`\\.(\\w+)\\s*\\.\\s*(${OPS})\\s*\\(`, 'g');
const RAW_RE = /\$(queryRaw|executeRaw)(Unsafe)?\s*(`|\(|<)/g;

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec|stories)\.tsx?$/.test(name)) out.push(full);
  }
}

/** Text between the '(' at `start` and its matching ')'. */
function balanced(src, start, open = '(', close = ')') {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close && --depth === 0) return src.slice(start + 1, i);
  }
  return src.slice(start + 1, start + 2000);
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

const findings = [];
const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replace(/\\/g, '/');

  for (const m of src.matchAll(CALL_RE)) {
    const [, model, op] = m;
    const key = scoped.get(model);
    if (!key) continue;
    const args = balanced(src, m.index + m[0].length - 1).trim();
    // Statement text before the call: a registered bypass wraps it directly.
    const stmtStart = Math.max(src.lastIndexOf(';', m.index), src.lastIndexOf('}\n', m.index));
    const bypassed = src.slice(stmtStart + 1, m.index).includes('withTenantGuardBypass(');
    let status;
    if (key === 'tenant_org_id' ? args.includes('tenant_org_id') : /\bid\b/.test(args)) status = 'OK';
    else if (bypassed) status = 'BYPASS';
    // A where built elsewhere (variable, helper call) can't be judged statically.
    else if (/\bwhere\s*:\s*[^{\s]/.test(args)) status = 'REVIEW';
    // MISSING only when the scoping key is an inline literal we can see; otherwise the
    // filter/data comes from a variable, shorthand ({ where }) or spread — REVIEW.
    else if (args === '' || /(?:^|[{,]\s*)(where|data|create)\s*:\s*\{/.test(args) && !/\.\.\.\w/.test(args)) status = 'MISSING';
    else status = 'REVIEW';
    findings.push({ kind: 'model', status, file: rel, line: lineOf(src, m.index), target: `${model}.${op}` });
  }

  for (const m of src.matchAll(RAW_RE)) {
    const [, fn, unsafe, opener] = m;
    let openIdx = m.index + m[0].length - 1;
    let tag = opener;
    if (opener === '<') {
      // Generic result type: $queryRaw<Array<{...}>>`...` — skip to what follows the '>'.
      let depth = 0;
      for (let i = openIdx; i < src.length; i++) {
        if (src[i] === '<') depth++;
        else if (src[i] === '>' && --depth === 0) { openIdx = i + 1; break; }
      }
      while (/\s/.test(src[openIdx])) openIdx++;
      tag = src[openIdx];
    }
    const body = tag === '`' ? src.slice(openIdx + 1, src.indexOf('`', openIdx + 1)) : balanced(src, src.indexOf('(', openIdx));
    // $queryRaw(Prisma.sql`...`) is as inspectable as the tagged form.
    const opener2 = tag !== '`' && /^\s*Prisma\.sql\s*`/.test(body) ? '`' : tag;
    const touchesOrg = /\borg_\w+/.test(body);
    if (!touchesOrg && opener2 === '`') continue; // sys_* / pg_* / SELECT 1
    let status;
    if (unsafe || opener2 !== '`') status = 'REVIEW';
    else status = body.includes('tenant_org_id') ? 'OK' : 'MISSING';
    findings.push({ kind: 'raw', status, file: rel, line: lineOf(src, m.index), target: `$${fn}${unsafe ?? ''}` });
  }
}

// ─── Report ──────────────────────────────────────────────────────────────
const count = (kind, status) => findings.filter((f) => f.kind === kind && f.status === status).length;
const table = (kind, status) => {
  const rows = findings.filter((f) => f.kind === kind && f.status === status);
  if (rows.length === 0) return '_none_\n';
  return ['| File | Line | Call |', '|---|---|---|', ...rows.map((r) => `| \`${r.file}\` | ${r.line} | \`${r.target}\` |`)].join('\n') + '\n';
};

const md = `# Tenant Guard — Static Audit (generated)

Generated by \`node scripts/audit-tenant-guard.mjs\` on ${new Date().toISOString().slice(0, 10)}. Do not hand-edit; re-run instead.
Heuristic worklist. The runtime guard (\`TENANT_GUARD_MODE\`) is the authoritative check.

Tenant-scoped models: ${scoped.size} · files scanned: ${files.length}

| Kind | MISSING | REVIEW | BYPASS | OK |
|---|---|---|---|---|
| Prisma model calls | ${count('model', 'MISSING')} | ${count('model', 'REVIEW')} | ${count('model', 'BYPASS')} | ${count('model', 'OK')} |
| Raw SQL touching org_* | ${count('raw', 'MISSING')} | ${count('raw', 'REVIEW')} | — | ${count('raw', 'OK')} |

## Prisma model calls — MISSING
${table('model', 'MISSING')}
## Prisma model calls — REVIEW (args built elsewhere)
${table('model', 'REVIEW')}
## Prisma model calls — BYPASS (inside withTenantGuardBypass; see STATUS.md register)
${table('model', 'BYPASS')}
## Raw SQL — MISSING (org_* referenced, no tenant_org_id in the template)
${table('raw', 'MISSING')}
## Raw SQL — REVIEW (Unsafe / non-template)
${table('raw', 'REVIEW')}`;

const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : null;
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md);
}
console.log(
  `[audit-tenant-guard] model MISSING=${count('model', 'MISSING')} REVIEW=${count('model', 'REVIEW')} BYPASS=${count('model', 'BYPASS')} OK=${count('model', 'OK')} | ` +
    `raw MISSING=${count('raw', 'MISSING')} REVIEW=${count('raw', 'REVIEW')} OK=${count('raw', 'OK')}`
);
