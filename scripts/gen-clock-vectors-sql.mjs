#!/usr/bin/env node
/**
 * Generates supabase/tests/clock_vectors.test.sql from packages/clock/vectors/time-vectors.v1.json
 * (MASTER_PLAN_v2 §7.1.1 S2: the SQL API must pass the same vectors as @cmx/clock).
 *
 * Usage:
 *   node scripts/gen-clock-vectors-sql.mjs          write the SQL file
 *   node scripts/gen-clock-vectors-sql.mjs --check  exit 1 when the SQL file is not up to date (CI)
 *
 * Every case becomes one row of a temp table (id, expected jsonb, actual jsonb). The actual value is
 * computed by the explicit-zone SQL functions (fn_cmx_dt_*_in, fn_cmx_dt_instant_at_zone, the pure
 * settings resolvers); zoneResolution cases set the zones of an existing tenant and branch inside the
 * transaction. An error is reported as {"error": "<CODE>"} like the TS runner.
 * Not run in SQL (stated in the file): clockBlock (API response, S6), parseInstant (TS parser only),
 * catalog cases whose zone is not in the vector fixture catalog (fixture-specific: the real catalog has them).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const srcRel = 'packages/clock/vectors/time-vectors.v1.json';
const outRel = 'supabase/tests/clock_vectors.test.sql';
const vectors = JSON.parse(readFileSync(join(root, srcRel), 'utf8'));

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const ts = (v) => `${q(v)}::timestamptz`;
const iso = (expr) => `pg_temp.zz_iso(${expr})`;
const sqlText = (s) => q(s);

const fixtureCodes = new Set((vectors.catalog ?? []).map((c) => c.code));
const skipped = [];
const rows = [];

function add(c, actualSql) {
  rows.push(`  (${q(c.id)}, ${j(c.expect)}, pg_temp.zz_try(${sqlText(actualSql)}))`);
}

for (const c of vectors.cases) {
  switch (c.kind) {
    case 'today':
      add(c, `SELECT to_jsonb(public.fn_cmx_dt_today_in(${q(c.zone)}, ${ts(c.at)})::text)`);
      break;
    case 'localParts':
      add(c, `SELECT jsonb_build_object('localDate', p.local_date::text, 'localTime', to_char(p.local_time, 'HH24:MI:SS'),
        'isoDow', p.iso_dow, 'hour', p.hour, 'minute', p.minute, 'utcOffsetMin', p.utc_offset_min)
        FROM public.fn_cmx_dt_local_parts(${ts(c.at)}, ${q(c.zone)}) p`);
      break;
    case 'toLocal':
      add(c, `SELECT to_jsonb(to_char(public.fn_cmx_dt_to_local(${ts(c.at)}, ${q(c.zone)}), 'YYYY-MM-DD"T"HH24:MI:SS'))`);
      break;
    case 'atLocal':
      add(c, `SELECT to_jsonb(${iso(`public.fn_cmx_dt_instant_at_zone(${q(c.zone)}, ${q(c.date)}::date, ${q(c.time)}::time, ${q(c.disambiguation ?? 'reject')})`)})`);
      break;
    case 'dayBounds':
      add(c, `SELECT jsonb_build_object('start', ${iso('b.start_at')}, 'end', ${iso('b.end_at')},
        'hours', round(extract(epoch FROM b.end_at - b.start_at) / 3600, 2))
        FROM public.fn_cmx_dt_day_bounds_in(${q(c.zone)}, ${q(c.from)}::date, ${q(c.toExclusive)}::date) b`);
      break;
    case 'businessDayBounds':
      add(c, `SELECT jsonb_build_object('start', ${iso('b.start_at')}, 'end', ${iso('b.end_at')})
        FROM public.fn_cmx_dt_business_day_bounds_in(${q(c.zone)}, ${q(c.cutover)}::time, ${q(c.from)}::date, ${q(c.toExclusive)}::date) b`);
      break;
    case 'periodKey': {
      const o = c.options ?? {};
      add(c, `SELECT to_jsonb(public.fn_cmx_dt_period_key_in(${q(c.zone)}, ${q(c.grain)}, ${ts(c.at)},
        ${o.weekStart ?? 'NULL'}::smallint, ${o.fiscalYearStartMonth ?? 'NULL'}::smallint))`);
      break;
    }
    case 'businessDate':
      // The cut-over is text in the vectors; a bad one fails in the resolver check like assertCutover.
      add(c, `SELECT to_jsonb(public.fn_cmx_dt_business_date_in(${q(c.zone)}, public.fn_cmx_dt__check_cutover(${q(c.cutover)}), ${ts(c.at)})::text)`);
      break;
    case 'civilAdd':
      add(c, `SELECT to_jsonb(public.fn_cmx_dt_civil_add(${q(c.date)}::date, ${c.n}, ${q(c.unit)})::text)`);
      break;
    case 'zoneValid':
      add(c, `SELECT jsonb_build_object('valid', public.fn_cmx_dt_is_valid_zone(${q(c.zone)}),
        'canonical', CASE WHEN public.fn_cmx_dt_is_valid_zone(${q(c.zone)}) THEN public.fn_cmx_dt_canonical_zone(${q(c.zone)}) END)`);
      break;
    case 'catalog':
      if (!fixtureCodes.has(c.zone) && c.expect.valid === false && c.expect.canonical === null
          && /^[A-Z][a-z]+\/[A-Za-z_]+$/.test(c.zone)) {
        skipped.push(`${c.id} (zone absent from the vector fixture catalog only; the real catalog has it)`);
        break;
      }
      add(c, `SELECT jsonb_build_object('valid', public.fn_cmx_dt_is_valid_zone(${q(c.zone)}),
        'canonical', public.fn_cmx_dt_canonical_zone(${q(c.zone)}),
        'isCanonical', coalesce((SELECT z.is_canonical FROM public.sys_timezone_cd z WHERE z.code = ${q(c.zone)}), false))`);
      break;
    case 'settings': {
      const i = c.input;
      const fn = {
        hourCycle: `public.fn_cmx_dt__resolve_hour_cycle(${q(i.tenant)}, ${q(i.country)}, ${q(i.platform)})`,
        weekStart: `public.fn_cmx_dt__resolve_week_start(${i.tenant ?? 'NULL'}::smallint, ${i.country ?? 'NULL'}::smallint, ${i.platform ?? 'NULL'}::smallint)`,
        cutover: `public.fn_cmx_dt__resolve_cutover(${q(i.branch)}, ${q(i.tenant)}, ${q(i.platform)})`,
        dateFormat: `public.fn_cmx_dt__resolve_date_format(${q(i.tenant)}, ${q(i.platform)})`,
      }[c.setting];
      if (!fn) throw new Error(`unknown setting ${c.setting} in ${c.id}`);
      const value = c.setting === 'cutover' ? `to_char(r.value, 'HH24:MI')` : 'r.value';
      add(c, `SELECT jsonb_build_object('value', ${value}, 'source', r.source) FROM ${fn} r`);
      break;
    }
    case 'zoneResolution':
      add(c, `SELECT pg_temp.zz_zone_resolution(${q(c.operation)}, ${q(c.scopeZone)}, ${q(c.organizationZone)})`);
      break;
    case 'clockBlock':
      skipped.push(`${c.id} (clockBlock: API response shape, tested in S6)`);
      break;
    case 'parseInstant':
      skipped.push(`${c.id} (parseInstant: TS input parser only)`);
      break;
    default:
      throw new Error(`unknown vector kind ${c.kind} (${c.id}): extend scripts/gen-clock-vectors-sql.mjs`);
  }
}

const header = `-- ==================================================================
-- clock_vectors.test.sql (GENERATED by scripts/gen-clock-vectors-sql.mjs; do not edit by hand)
-- Source: ${srcRel} (version ${vectors.version}, ${vectors.cases.length} cases; ${rows.length} run here)
-- Purpose: the SQL clock API (0842, 0843) gives the same answers as @cmx/clock for the shared vectors.
-- Run (LOCAL database only, as postgres so the zone fixture can bypass the validators):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f ${outRel}
-- Needs one row in org_tenants_mst (and a branch of it for the scoped zoneResolution cases).
-- Everything is ROLLED BACK. Prints "PASS: n vectors" or stops with "FAIL: ..." listing every mismatch.
-- Fixture as in the vector file: Asia/Pyongyang is set inactive inside the transaction.
-- Not run here:
${skipped.map((s) => `--   ${s}`).join('\n')}
-- ==================================================================
`;

const body = `
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION pg_temp.zz_iso(p TIMESTAMPTZ) RETURNS TEXT LANGUAGE sql IMMUTABLE AS
$$ SELECT to_char(p AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Runs one query that returns jsonb; an error becomes {"error": "<leading CODE of the message>"}.
CREATE FUNCTION pg_temp.zz_try(p_sql TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v JSONB;
BEGIN
  EXECUTE p_sql INTO v;
  RETURN coalesce(v, 'null'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', coalesce(substring(SQLERRM FROM '^([A-Z][A-Z0-9_]+)'), SQLSTATE || ' ' || SQLERRM));
END $$;

CREATE TEMP TABLE zz_fx (tenant_id UUID, branch_id UUID) ON COMMIT DROP;
INSERT INTO zz_fx
SELECT t.id, (SELECT b.id FROM public.org_branches_mst b WHERE b.tenant_org_id = t.id ORDER BY b.id LIMIT 1)
  FROM public.org_tenants_mst t
 ORDER BY (EXISTS (SELECT 1 FROM public.org_branches_mst b WHERE b.tenant_org_id = t.id)) DESC, t.id
 LIMIT 1;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM zz_fx) THEN RAISE EXCEPTION 'SETUP: need one row in org_tenants_mst'; END IF; END $$;
UPDATE public.sys_timezone_cd SET is_active = false WHERE code = 'Asia/Pyongyang';

-- Sets the organization and branch zones (validators and FKs bypassed: replica mode) and resolves.
CREATE FUNCTION pg_temp.zz_zone_resolution(p_op TEXT, p_scope_zone TEXT, p_org_zone TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE f RECORD;
BEGIN
  SELECT * INTO f FROM zz_fx;
  IF p_scope_zone IS NOT NULL AND f.branch_id IS NULL THEN
    RETURN jsonb_build_object('skipped', 'no branch');
  END IF;
  SET LOCAL session_replication_role = replica;
  UPDATE public.org_tenants_mst SET timezone = p_org_zone WHERE id = f.tenant_id;
  IF f.branch_id IS NOT NULL THEN
    UPDATE public.org_branches_mst SET timezone_code = p_scope_zone WHERE id = f.branch_id;
  END IF;
  SET LOCAL session_replication_role = origin;
  RETURN to_jsonb(public.fn_cmx_dt_zone(f.tenant_id, p_op, CASE WHEN p_scope_zone IS NOT NULL THEN f.branch_id END));
END $$;

CREATE TEMP TABLE zz_v (id TEXT PRIMARY KEY, expected JSONB, actual JSONB) ON COMMIT DROP;
INSERT INTO zz_v (id, expected, actual) VALUES
${rows.join(',\n')};

DO $$
DECLARE v_bad TEXT; v_skip INTEGER; v_n INTEGER;
BEGIN
  SELECT count(*) FILTER (WHERE actual ? 'skipped'), count(*) INTO v_skip, v_n FROM zz_v;
  SELECT string_agg(format('%s: expected %s, got %s', id, expected, actual), E'\\n' ORDER BY id) INTO v_bad
    FROM zz_v WHERE NOT (actual ? 'skipped') AND actual IS DISTINCT FROM expected;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION E'FAIL: clock vectors\\n%', v_bad;
  END IF;
  RAISE NOTICE 'PASS: % clock vectors (% skipped: no branch)', v_n - v_skip, v_skip;
END $$;

ROLLBACK;
`;

const text = header + body;
const outPath = join(root, outRel);
if (process.argv.includes('--check')) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (current !== text) {
    console.error(`${outRel} is out of date: run node scripts/gen-clock-vectors-sql.mjs`);
    process.exit(1);
  }
  console.log(`${outRel} is up to date (${rows.length} vectors)`);
} else {
  writeFileSync(outPath, text);
  console.log(`wrote ${outRel}: ${rows.length} vectors, ${skipped.length} not run in SQL`);
}
