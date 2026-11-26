---
name: check-for-timezone
description: Validate and audit CleanMateX features, database tables, migrations, Prisma schemas, SQL functions, backend services, workers, API routes, pages, UI components, print views, reports, notifications, and exports against CleanMateX Time and Timezone rules. Use when the user asks to "check for timezone", "check timezone", "validate timezone", "review time and timezone", "audit clocks/dates/timestamps", or before finishing any feature touching dates, times, schedules, or timezones.
user-invocable: true
version: 1.0.0
---

# Check for Timezone

Canonical rules live in **`docs/dev/rules/time-and-timezone.md`**. Read it before reviewing when any edge case is unclear. This skill defines how to audit; the rules file defines what is right.

Default mode is **review only**: change nothing, report ranked findings. Use **fix mode** only when the user explicitly asks (`check and fix`, `--fix`). Even in fix mode, never apply database migrations — create migration SQL only and stop for review.

---

## 1. Resolve Target Scope

Never scan the whole repository. Scope strictly to what the user named:

| User gives | Audit scope |
|---|---|
| Files or folders | Those files only |
| A feature name (e.g. "orders", "POS", "reports") | Related migrations/tables in `web-admin/prisma/schema.prisma`, backend services, API routes, pages/UI, print views, notifications, and tests for that feature |
| A DB table or migration | Table definition in `schema.prisma`, related migrations, SQL functions, and direct readers/writers |
| An API route or UI route | Route handler / `page.tsx`, backing service(s), and feature UI components one level deep |
| Nothing | Changed and untracked files: `git diff --name-only HEAD` + `git ls-files --others --exclude-standard` |

Note if HQ (`cleanmatexsaas`) also reads/writes any touched table or surface; check HQ readers when applicable or list under **Not checked**.

---

## 2. Run Automated Checks

From the repo root (`f:\jhapp\cleanmatex`):

```bash
node scripts/check-clock-contract.mjs
```

Also run a targeted grep on the target files for forbidden patterns:

```bash
git grep -n -E "toISOString\(\)\.slice\(0,\s*10\)|toLocale(Date|Time)?String\(|new Date\(['\"][0-9]{4}-[0-9]{2}-[0-9]{2}( ['\"0-9:]+)?['\"]\)|\.(get|set)(Hours|Date|Day)\(|utc_offset_hours|Asia/Muscat|timestamp without time zone|::date\b" -- <target-files>
```

If the target touches `operational-time.ts`, `operational-zone.server.ts`, `ready-by-calculator.ts`, or `business-date.ts`, also run:

```bash
cd web-admin && npx jest __tests__/lib/utils/operational-time.test.ts __tests__/utils/ready-by-calculator.test.ts
```

Do not run `npm run build` or the full test suite during a review-only check unless asked; state what was not run.

---

## 3. Layer-by-Layer Validation Checklist

Inspect only the layers present in the target scope. Verify each finding in the actual code before reporting (a shared helper may already handle it).

### A. Database Tables, Migrations, Prisma & SQL Functions
- **Time value shapes:** Instants are `timestamptz` (`@db.Timestamptz(6)`); civil calendar days are `date`; repeating local wall-clock times are `time`. No new `timestamp without time zone` instant columns (only allowed with explicit `CIVIL:` rationale).
- **No legacy naive twins:** Do not read, write, or index retired naive instant columns when a `timestamptz` column exists (e.g. `org_orders_mst` uses canonical `ready_by_at` + `ready_at` `timestamptz`, never legacy `ready_by` or `ready_by_override`).
- **One SQL door:** SQL functions/triggers resolve operational zones through `public.fn_ops_zone(tenant, operation, scope)` — never private queries against `org_tenants_mst.timezone` or `org_branches_mst.timezone_code`, and never `utc_offset_hours`, hardcoded `+04:00`, `Asia/Muscat`, or `UTC` fallbacks.
- **Sargable predicates:** Filter indexed `timestamptz` columns with half-open UTC bounds `[start, nextStart)`. Never wrap an indexed column in `AT TIME ZONE` or cast `occurred_at::date` in `WHERE`.
- **Single database clock:** Persisted instant + derived `business_date` bundles derive from one captured database instant (`now()` / `readDatabaseInstant`), written with `business_timezone` / `timezone_code`.

### B. Backend Services, Domain Logic & Workers
- **Authoritative scope & tenant check:** Use `resolveOperationalTimeZone` / `resolveOperationalTimeZoneOn` with the feature's documented scope (order acceptance → receiving branch; ready-by → fulfilment branch; POS session → till's branch; delivery → service location; invoice → issuing legal entity; fallback → organization). Never trust a client-supplied timezone as authority.
- **Fail closed:** When no valid active IANA zone exists, refuse business-date assignment, document numbering, POS open, local scheduling, or ready-by calculation with a clear user-facing error. Never fall back to `UTC`, `Asia/Muscat`, server/process zone, or browser zone.
- **Forbidden JS date patterns:**
  - `toISOString().slice(0, 10)` for a business date
  - `new Date('YYYY-MM-DD')` or `new Date('YYYY-MM-DD HH:mm:ss')` (no offset)
  - `getHours` / `getDate` / `getDay` / `setHours` / `setDate` for user-visible values or business-day boundaries
  - Local-midnight day ranges on the server
- **Durations & DST:** Compute elapsed durations by subtracting UTC instants. Typed DST gap/overlap inputs reject unless explicit `earlier`/`later` policy is captured; computed schedule gaps advance and overlaps pick earlier offset (logged/recorded).
- **Workers & schedules:** Local schedules store civil rule + IANA zone + materialized UTC `next_run_at`. Workers compare `next_run_at <= now()`, claim atomically with bounded lease, and enforce idempotency.

### C. API Routes, Webhooks & Cross-App Boundaries (`cmx-api`, Mobile, HQ)
- **Wire formats:** Instants leave APIs as RFC 3339 UTC with `Z`. Reject naive datetime payloads without offset. Civil dates use `YYYY-MM-DD`; local times use `HH:mm` / `HH:mm:ss`.
- **Prisma civil serialization:** Prisma `date` and `time` fields leave service/API boundaries as civil strings, not shifted JS `Date` ISO instants.
- **Echo vs authority:** Client-sent timezone is echo/stale-form check only. Return the resolved IANA `opsZone` alongside instants when the caller must render a shop clock.
- **No N+1 zone resolution:** Lists and reports join or batch-resolve zones (`resolveOperationalTimeZonesForBranches`) — never call the resolver per row.
- **HQ boundary:** HQ UI/API uses tenant zone (or row snapshot) for tenant rows, and HQ config zone only for HQ-owned rows.

### D. Frontend Pages, UI, Pickers, Print, Reports & Notifications
- **No UTC-to-local jump:** Server resolves the operations zone and passes it before the first absolute date paints. Wait with a skeleton or empty/unavailable state when the zone is missing — never paint from the browser clock.
- **One formatting path:** Use shared helpers (`web-admin/lib/utils/operational-time.ts`, `Intl.DateTimeFormat`, or `next-intl` with explicit `timeZone`). No bare `toLocaleString`, `toLocaleDateString`, `date-fns` `format`, or `dayjs` without an explicit IANA zone. Relative phrases ("5m ago") need no zone.
- **Mixed-zone lists & pickers:** Multi-branch lists format each row in that row's zone and show a clear zone label (IANA name + offset/abbr for that instant). Pickers submit civil `YYYY-MM-DD` / `HH:mm`, never local `new Date()` getters.
- **Print, PDF & customer messages:** Print/PDF views format in the same operations zone as the screen and display the zone in the header. SMS/email/WhatsApp use the event's operations-zone calendar day (and omit the clock if zone is missing).

### E. Logs, Audit & Exports
- **Logs:** UTC ISO-8601 timestamps with `tenant_org_id` and structured `zone` / `business_date` fields for civil decisions.
- **Audit rows:** `occurred_at timestamptz` from DB clock, plus `timezone_code` and `business_date` when applicable.
- **Exports:** Emit UTC instant (`Z`) plus civil date and IANA zone ID.

### F. Tests
- Check that tests cover applicable edge cases from `docs/dev/rules/time-and-timezone.md` (21:00Z `Asia/Muscat` next-day rollover, missing-zone fail-closed, half-open `[start, nextStart)` boundary, client in another zone, DST gap/overlap, non-UTC DB session).

---

## 4. Severity Levels

| Level | Meaning | Examples |
|---|---|---|
| **Critical** | Wrong business date, shifted money/SLA/schedule, cross-tenant scope leak, or silent fallback | Naive `timestamp` instant column; `toISOString().slice(0, 10)` business date; trusting client timezone; fallback to `Asia/Muscat` / `UTC` / browser clock; `occurred_at::date` filter; missing `tenant_org_id` in zone lookup |
| **Important** | Violates a hard contract rule or fails under DST / multi-branch / non-UTC session | Bare `toLocaleDateString` without `timeZone`; N+1 zone resolver in list; UTC-to-local paint jump; missing `zone` null-guard; missing `fn_ops_zone` in new SQL; naive datetime accepted by API |
| **Minor** | Missing defensive test, incomplete zone header on print, or minor clarity gap | Missing DST or 21:00Z unit test; print header omits zone name; missing structured `zone` field in log |

Pre-existing debt in untouched lines goes under **Debt seen (not from this change)** with counts only — not as a finding.

---

## 5. Report Format

```markdown
Timezone check: <target> (<n> files)

Tools: check-clock-contract <pass/fail> · pattern grep <n> hits · clock tests <pass/fail/not run>

Critical
1. <file>:<line> — <what violates the rule, in one sentence> (Rule: <section>)
   Fix: <concrete change>

Important
1. <file>:<line> — <what violates the rule> (Rule: <section>)
   Fix: <concrete change>

Minor
1. <file>:<line> — <issue> (Rule: <section>)
   Fix: <concrete change>

Debt seen (not from this change): <summary counts or "None">
Not checked: <e.g., HQ repo, live DB session, full build>
```

If there are zero findings in a severity bucket, omit that bucket and state `Passed — no timezone violations found` when all buckets are empty.

---

## 6. Fix Mode (`--fix` / "check and fix")

Only when explicitly requested:
1. Present the findings first if the fix requires a DB migration or touches > 5 files.
2. Apply fixes strictly within the target scope (never modify applied migrations; create a new migration SQL file only and stop for user review).
3. Re-run `node scripts/check-clock-contract.mjs`, targeted clock tests, and `cd web-admin && npm run build` after frontend edits.
