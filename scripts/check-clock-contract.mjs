#!/usr/bin/env node
/**
 * Clock contract guard v2 (docs/features/Time_and_Timezone/MASTER_PLAN_v2.md §7.12).
 * The SAME file runs in both repos: cleanmatex (tenant) and cleanmatexsaas (HQ). The profile is
 * chosen from the folders present at the repo root.
 *
 * Two kinds of rule:
 *  1. Hard rules (any hit fails): temporal-polyfill / Temporal global outside the adapter (D1),
 *     new-migration bans from 0842 on (D25/D26: now(), clock_timestamp(), CURRENT_DATE, …, direct
 *     fn_ops_zone calls), naive timestamps without `CIVIL:` and zone-column reads outside the
 *     zone doors (migrations >= 0832; `0832` is allowlisted by name, G4), `cmx_dt_env_cf` test
 *     writes / `cmx.fake_now` outside supabase/tests, `REVOKE … anon` on every fn_cmx_dt_*,
 *     vendored vector copies equal to the source file, markers without a reason.
 *  2. Ratchet rules (§1.3 banned list in TS, TSX, JS and Dart): per-file counts are stored in
 *     scripts/clock-contract-baseline.json and may only go down. A new file with a hit, or a
 *     higher count, fails.
 *
 * Allow marker: `// clock-ok: <reason>` or `-- CLOCK-OK: <reason>` exempts that line and the next.
 * A marker without a reason is itself a failure.
 *
 * Usage:
 *   node scripts/check-clock-contract.mjs                    check (CI)
 *   node scripts/check-clock-contract.mjs --update-baseline  lower counts after a cleanup (never raises;
 *                                                            writes the first baseline when none exists)
 *   node scripts/check-clock-contract.mjs --report           totals per rule
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const baselinePath = join(root, 'scripts', 'clock-contract-baseline.json');

const PROFILES = {
  tenant: {
    marker: 'web-admin',
    codeRoots: ['web-admin', 'cmx-api', 'cmx-workers', 'packages', 'cmx_mobile_apps'],
    migrationDir: 'supabase/migrations',
    vectorsSource: 'packages/clock/vectors/time-vectors.v1.json',
    vendoredVectors: [
      'cmx_mobile_apps/packages/mobile_core/test/clock/time-vectors.v1.json',
      '../cleanmatexsaas/packages/clock-vectors/time-vectors.v1.json',
    ],
  },
  hq: {
    marker: 'platform-api',
    codeRoots: ['platform-api', 'platform-web', 'platform-workers', 'packages'],
    migrationDir: null,
    vectorsSource: 'packages/clock-vectors/time-vectors.v1.json',
    vendoredVectors: ['../cleanmatex/packages/clock/vectors/time-vectors.v1.json'],
  },
};
const profileName = existsSync(join(root, PROFILES.tenant.marker)) ? 'tenant' : 'hq';
const profile = PROFILES[profileName];

const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'dist-test', 'build', 'out', 'coverage', '.turbo', '.git',
  '.dart_tool', '.vercel', '.expo', 'Pods', '.gradle', 'storybook-static', 'playwright-report', 'test-results',
]);
const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|dart)$/;
const TEMPORAL_ADAPTER = 'packages/clock/src/temporal.ts';
const MARKER = /(?:\/\/|--|\/\*|\*|#)\s*clock-ok\s*:(.*)$/i;

/** Ratchet rules: id → { test(line, window, file) → number of hits }. */
const TS_RULES = {
  'ts.iso-slice-date': { re: /toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g },
  'ts.iso-split-date': { re: /toISOString\(\)\s*\.split\(\s*['"`]T['"`]\s*\)\s*\[\s*0\s*\]/g },
  'ts.date-only-literal': { re: /new Date\(\s*['"`]\d{4}-\d{2}-\d{2}['"`]\s*\)/g },
  'ts.tolocale-no-zone': { re: /\.toLocale(?:Date|Time)String\(/g, needsZoneInWindow: true },
  'ts.instant-getters': { re: /\.(?:get(?:Hours|Minutes|Date|Day|Month|FullYear)\(\)|set(?:Hours|Minutes|Date|Month|FullYear)\()/g },
  'ts.intl-dtf-no-zone': { re: /\bIntl\.DateTimeFormat\(/g, needsZoneInWindow: true, skipIf: /resolvedOptions\(\)/ },
  'ts.resolved-options-zone': { re: /resolvedOptions\(\)\s*\.\s*timeZone/g },
  'ts.muscat-literal': { re: /['"`]Asia\/Muscat['"`]/g, skipFile: /(?:__tests__|\.test\.|\.spec\.|\.stories\.|\/e2e\/|\/messages\/|\/fixtures?\/|\/seed)/ },
};
const DART_RULES = {
  'dart.datetime-now': { re: /DateTime\.now\(\)/g },
  'dart.datetime-parse': { re: /DateTime\.parse\(/g },
  'dart.to-local': { re: /\.toLocal\(\)/g },
};
const HARD_TS = [
  { id: 'temporal-polyfill-import', re: /(?:from\s+|require\(\s*|import\(\s*)['"](?:temporal-polyfill|@js-temporal\/polyfill)(?:\/[^'"]*)?['"]/ },
  { id: 'temporal-global', re: /\bglobalThis\.Temporal\b|(?<![\w.])Temporal\s*\.\s*(?:Now|Instant|ZonedDateTime|PlainDate|PlainDateTime|PlainTime|Duration|PlainYearMonth|PlainMonthDay|TimeZone|Calendar)\b/ },
];

const failures = [];
const counts = {};
const fail = (msg) => failures.push(msg);
const rel = (p) => relative(root, p).replaceAll('\\', '/');

function walk(dir, out) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    let info;
    try {
      info = statSync(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) walk(path, out);
    else if (CODE_FILE.test(name) && !name.endsWith('.d.ts')) out.push(path);
  }
}

/** Lines with their exemption flag (a marker exempts its own line and the next one). */
function linesOf(text, file) {
  const lines = text.split(/\r?\n/);
  const exempt = new Array(lines.length).fill(false);
  lines.forEach((line, i) => {
    const m = MARKER.exec(line);
    if (!m) return;
    if (!m[1].trim() || /^\*\/\s*$/.test(m[1].trim())) fail(`${file}:${i + 1} clock-ok marker without a reason`);
    exempt[i] = true;
    if (i + 1 < lines.length) exempt[i + 1] = true;
  });
  return { lines, exempt };
}

function bump(rule, file, n) {
  if (!n) return;
  counts[rule] ??= {};
  counts[rule][file] = (counts[rule][file] ?? 0) + n;
}

// ---------------------------------------------------------------- code files
for (const folder of profile.codeRoots) {
  const files = [];
  walk(join(root, folder), files);
  for (const path of files) {
    const file = rel(path);
    const text = readFileSync(path, 'utf8');
    const { lines, exempt } = linesOf(text, file);
    const isDart = file.endsWith('.dart');
    const rules = isDart ? DART_RULES : TS_RULES;
    lines.forEach((line, i) => {
      if (exempt[i]) return;
      // Whole-line comments are documentation; they may name a banned pattern.
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return;
      if (!isDart && file !== TEMPORAL_ADAPTER) {
        for (const rule of HARD_TS) {
          if (rule.re.test(line)) fail(`${file}:${i + 1} ${rule.id}: only ${TEMPORAL_ADAPTER} may use Temporal / temporal-polyfill (D1)`);
        }
      }
      for (const [id, rule] of Object.entries(rules)) {
        if (rule.skipFile && rule.skipFile.test(`/${file}`)) continue;
        const hits = line.match(rule.re);
        if (!hits) continue;
        if (rule.skipIf && rule.skipIf.test(line)) continue;
        let n = hits.length;
        if (rule.needsZoneInWindow) {
          const window = lines.slice(i, i + 8).join('\n');
          if (/timeZone\s*:/.test(window) || /buildIntlOptions\(/.test(window)) n = 0;
        }
        bump(id, file, n);
      }
    });
  }
}

// ---------------------------------------------------------------- migrations
const STRICT_FROM = 842;
const LEGACY_FROM = 832;
const ALLOWLIST = new Map([
  ['0832_lockout_timestamptz.sql', 'G4: the naive-timestamp text is in a comment that documents the conversion'],
  // Applied before the rule reached their authors (0.1.47): `updated_at = now()` audit instants only, no civil day.
  // New migrations write `public.fn_cmx_dt_now()` or mark the line `-- CLOCK-OK: <reason>`.
  ['0847_bg_jobs_file_purge.sql', 'applied 2026-11-27; now() only for updated_at (instant)'],
  ['0848_hq_nav_uom_config.sql', 'written 2026-11-27 outside the clock program; now() only for updated_at (instant)'],
]);
const ZONE_DOORS = /CREATE(?: OR REPLACE)? FUNCTION\s+(?:public\.)?(?:fn_ops_zone|fn_cmx_dt_zone|fn_tenant_tz_validate|fn_hq_gen_cfg_validate)\b/i;
const NEW_SQL_BANS = [
  ['now()', /\bnow\s*\(\s*\)/i],
  ['clock_timestamp()', /\bclock_timestamp\s*\(\s*\)/i],
  ['statement_timestamp()', /\bstatement_timestamp\s*\(\s*\)/i],
  ['transaction_timestamp()', /\btransaction_timestamp\s*\(\s*\)/i],
  ['current_timestamp', /\bcurrent_timestamp\b/i],
  ['CURRENT_DATE', /\bcurrent_date\b/i],
  ['CURRENT_TIME', /\bcurrent_time\b/i],
  ['LOCALTIME / LOCALTIMESTAMP', /\blocaltime(?:stamp)?\b/i],
  ['SET TIME ZONE', /\bset\s+time\s+zone\b/i],
  ['direct fn_ops_zone call', /\bfn_ops_zone\s*\(/i],
];
const GRANT_EXEMPT = /^fn_cmx_dt_(?:now|clock|_fake_\w+)$/;

/** Removes comments and the bodies of the functions that are allowed to use a banned call. */
function sqlForBans(text) {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s
    .split(/\r?\n/)
    .map((l) => (/CLOCK-OK\s*:\s*\S/i.test(l) ? '' : l.replace(/--.*$/, '')))
    .join('\n');
  // Bodies of fn_cmx_dt_now / fn_cmx_dt_clock / fn_cmx_dt__fake_* (time sources) and fn_cmx_dt_zone (wraps fn_ops_zone).
  const def = /CREATE(?: OR REPLACE)? FUNCTION\s+(?:public\.)?(fn_cmx_dt_(?:now|clock|zone|_fake_\w+))\b[\s\S]*?(\$[A-Za-z_]*\$)([\s\S]*?)\2/gi;
  return s.replace(def, (m, _name, tag) => m.slice(0, m.indexOf(tag)) + ' ');
}

const migrationDir = profile.migrationDir ? join(root, profile.migrationDir) : null;
if (migrationDir && existsSync(migrationDir)) {
  for (const name of readdirSync(migrationDir).sort()) {
    const match = /^(\d+)_.*\.sql$/.exec(name);
    if (!match) continue;
    const num = Number(match[1]);
    const text = readFileSync(join(migrationDir, name), 'utf8');
    const file = `${profile.migrationDir}/${name}`;
    // Test-clock safety applies to every migration (D25).
    if (/cmx_dt_env_cf/i.test(text) && /(?:insert\s+into|update)\s+(?:public\.)?cmx_dt_env_cf[\s\S]{0,200}?'test'/i.test(text)) {
      fail(`${file} writes env = 'test' into cmx_dt_env_cf (only supabase/tests may)`);
    }
    if (/set_config\(\s*'cmx\.fake_now'|\bset\s+(?:local\s+)?cmx\.fake_now\b/i.test(sqlForBans(text))) {
      fail(`${file} sets cmx.fake_now (only supabase/tests may)`);
    }
    if (num < LEGACY_FROM || ALLOWLIST.has(name)) continue;
    if (/timestamp without time zone/i.test(text) && !text.includes('CIVIL:')) {
      fail(`${file} adds a naive timestamp without CIVIL:`);
    }
    const readsZone = /org_tenants_mst\.timezone\b|org_branches_mst\.timezone_code\b/.test(text);
    if (readsZone && !ZONE_DOORS.test(text) && !/^0848_/.test(name)) {
      fail(`${file} reads a timezone column outside the zone doors (fn_ops_zone, fn_cmx_dt_zone, validators, 0848)`);
    }
    if (num < STRICT_FROM) continue;
    const body = sqlForBans(text);
    for (const [label, re] of NEW_SQL_BANS) {
      if (re.test(body)) fail(`${file} uses ${label}; new SQL calls fn_cmx_dt_* instead (D25, D26) or marks the line -- CLOCK-OK: <reason>`);
    }
    for (const m of text.matchAll(/CREATE(?: OR REPLACE)? FUNCTION\s+(?:public\.)?(fn_cmx_dt_\w+)\s*\(/gi)) {
      const fn = m[1].toLowerCase();
      if (GRANT_EXEMPT.test(fn)) continue;
      const revoke = new RegExp(`REVOKE[^;]*\\b${fn}\\b[^;]*\\banon\\b`, 'i');
      if (!revoke.test(text)) fail(`${file} creates ${fn} without REVOKE … FROM anon (§7.16)`);
    }
  }
}

// ---------------------------------------------------------------- vectors checksum
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const vectorsPath = join(root, profile.vectorsSource);
if (existsSync(vectorsPath)) {
  const want = sha(vectorsPath);
  for (const copy of profile.vendoredVectors) {
    const p = join(root, copy);
    if (existsSync(p) && sha(p) !== want) fail(`${copy} differs from ${profile.vectorsSource} (re-copy the shared vectors)`);
  }
} else if (profileName === 'tenant') {
  fail(`${profile.vectorsSource} is missing`);
}

// ---------------------------------------------------------------- ratchet
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const current = sortObj(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, sortObj(v)])));
const hasBaseline = existsSync(baselinePath);
const baseline = hasBaseline ? JSON.parse(readFileSync(baselinePath, 'utf8')).rules ?? {} : {};
const rises = [];
const drops = [];
for (const [rule, files] of Object.entries(current)) {
  for (const [file, n] of Object.entries(files)) {
    const was = baseline[rule]?.[file] ?? 0;
    if (n > was) rises.push(`${file}: ${rule} ${was} -> ${n}`);
  }
}
for (const [rule, files] of Object.entries(baseline)) {
  for (const [file, was] of Object.entries(files)) {
    const n = current[rule]?.[file] ?? 0;
    if (n < was) drops.push(`${file}: ${rule} ${was} -> ${n}`);
  }
}

const writeBaseline = (rules) => {
  const body = {
    $comment: 'Clock contract ratchet (MASTER_PLAN_v2 §7.12). Counts may only go down. Lower them with --update-baseline after a cleanup; never raise them by hand.',
    profile: profileName,
    rules,
  };
  writeFileSync(baselinePath, `${JSON.stringify(body, null, 2)}\n`);
};

if (args.has('--report')) {
  for (const [rule, files] of Object.entries(current)) {
    const total = Object.values(files).reduce((a, b) => a + b, 0);
    console.log(`${rule.padEnd(26)} files=${String(Object.keys(files).length).padStart(4)} hits=${total}`);
  }
}

if (args.has('--update-baseline')) {
  if (!hasBaseline) {
    writeBaseline(current);
    console.log(`clock contract: first baseline written (${profileName}) to ${rel(baselinePath)}`);
  } else if (rises.length > 0) {
    console.error(`clock contract: refusing to raise the baseline:\n${rises.join('\n')}`);
    process.exit(1);
  } else {
    writeBaseline(current);
    console.log(`clock contract: baseline lowered (${drops.length} entries)`);
  }
} else {
  if (!hasBaseline) fail(`${rel(baselinePath)} is missing (run with --update-baseline once)`);
  for (const r of rises) fail(`ratchet: ${r} (use @cmx/clock; see docs/dev/rules/time-and-timezone.md)`);
  if (drops.length > 0) console.log(`clock contract: ${drops.length} counts went down; run --update-baseline to lock them in`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  console.error(`clock contract: ${failures.length} failure(s) [${profileName}]`);
  process.exit(1);
}
console.log(`clock contract ok [${profileName}]`);
