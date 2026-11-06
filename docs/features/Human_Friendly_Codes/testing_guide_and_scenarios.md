# Testing Guide and Scenarios — Human-Friendly Codes

Covers T9.1 (QA on deployed envs), T9.2 (performance) and the automated test inventory. The manual scenarios S1–S20 are in [`QA_TEST_GUIDE.md`](./QA_TEST_GUIDE.md) (the plan names that file; this page is the pack's standard testing guide and links to it, A-70).

## 1. Automated tests

### 1.1 Database (tenant repo, `supabase/tests/`; plain SQL with NOTICE PASS lines; each safety test rolls back)

| File | Phase | Run when |
|---|---|---|
| `doc_seq_engine_p1.test.sql` | P1 | after `0666`–`0672` |
| `ord_order_no_engine_p2.test.sql` | P2 | after `0674` |
| `hfc_p21_split_safety.test.sql` | P2.1 | after `0677`, `0678` |
| `hfc_p3_codes_safety.test.sql` | P3 | after `0682`, `0683` (needs `-v tenant_id=<uuid>`) |
| `hfc_p4_label_settings_safety.test.sql` | P4 | after `0685` |
| `hfc_p5_scn_safety.test.sql` | P5 | after `0687` → expect `PASS T5.1a`..`T5.1h` |
| `hfc_p6_safety.test.sql` | P6 | after `0688`, `0689` → expect two `P6 PASS` |

Run: `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/<file>` (local only; on remote use a staging copy).

**Box run 2026-10-31 (scratch Postgres, not the user's DB):** chain `0666`–`0672`, `0674`, stubs, `0687`, `0688`, `0689`: P5 T5.1a–h PASS, P6 both PASS; `0688` and `0689` re-run without error; `0687` second run refused by design (`FIN_SCN_ALREADY_GENERAL`).

### 1.2 web-admin (Jest)
Run from `web-admin`: `NODE_OPTIONS=--max-old-space-size=10240 npx jest <paths>`. HFC suites:
- Numbering: `__tests__/services/order-numbering/order-number-format.test.ts`, `__tests__/services/order-item-code.service.test.ts`, `__tests__/utils/order-number-generator.test.ts`.
- Scan: `__tests__/services/scan-resolve/*`, `__tests__/api/scan/*`, `__tests__/ui/scan/*` (incl. jest-axe), `__tests__/validations/code-format-*.test.ts`.
- Labels: `__tests__/services/labels/*`, `__tests__/api/order-label-data.test.ts`, `__tests__/api/settings-label-printing.test.ts`, `__tests__/features/settings/labels/*`, `__tests__/features/orders/{print-label-button,order-receipt-print-barcode}.test.tsx`, `__tests__/ui/print/*`, `__tests__/utils/barcode/*`, `__tests__/utils/barcode-generator.test.ts`, `__tests__/validations/label-printing-schemas.test.ts`.
- Credit notes: `__tests__/services/stored-value.service.test.ts`.
- Notifications: `__tests__/api/v1/orders-transition.route.test.ts`.

**Run 2026-10-31 (Windows, 11:04 Asia/Muscat):** 29 suites / 237 tests pass. `npx tsc --noEmit -p .` 0 errors (P8 run).

### 1.3 HQ (`cleanmatexsaas`)
- `platform-api`: `npx jest src/modules/doc-seq-config src/modules/general-config` (P7: 5 suites / 42 tests) and the tenant create specs `tenants.service.create.spec.ts` + guard spec (P2.2).
- `platform-web`: `npx jest` for doc-seq / general-config (2 suites / 7 tests), `npm run check:i18n`.
- Note: `jest-axe` is not installed in `platform-web` yet (A-63, follow-up).

### 1.4 Mobile
`cd cmx_mobile_apps/packages/mobile_core && flutter test --no-pub` (7 tests); customer app `flutter test --no-pub test/orders` (2 widget tests); `flutter analyze --no-pub`.

## 2. Manual QA (T9.1)
S1–S20 in [`QA_TEST_GUIDE.md`](./QA_TEST_GUIDE.md). **Status: Pending (user-run on deployed env).**

## 3. Performance (T9.2)
Targets from plan §11. Measure on staging or remote after deploy. **Status: Pending (user-run on deployed env).** The box load test of P1 (indicative only) is in DEV_GUIDE §14.

| Path | Target | How to measure | Result |
|---|---|---|---|
| `fn_doc_seq_next` per call | p95 < 2 ms, no table scan | `EXPLAIN (ANALYZE, BUFFERS) SELECT fn_doc_seq_next(...)` in a rolled-back transaction; `pg_stat_statements` | PARTIAL — Cannot isolate per-call p95: fn_doc_seq_next runs nested inside triggers, so it never appears as a top-level row in pg_stat_statements (0 rows). Calling it directly would consume a number, so it was NOT executed. Supporting evidence: the counter read it performs is an Index Scan on idx_org_doc_seq_type at 0.799 ms exec (1 row, shared hit=3); fn_doc_seq_format mean 0.326 ms. No table scan on the counter path. Recommend a staging-only direct EXPLAIN to fill the true p95. |
| Order create (end to end) | ≤ +3 ms vs before | compare API timing before/after on the same env | BLOCKED — Needs a before/after API timing baseline on the same env, which is not available (no pre-HFC baseline captured). UI cash order creation succeeded each time (~15-20 s wall including browser round-trips, dominated by client render, not the numbering call). |
| Hot-tenant contention | ≥ 200 orders/s on one tenant-day, no errors | staging script (parallel creates) | BLOCKED — Requires the staging parallel-create script (200 orders/s on one tenant-day). Not runnable against the shared Preview tenant. No errors seen across sequential QA creates; counter advanced cleanly with no gaps. |
| Scan resolve | p95 < 50 ms server, < 150 ms to UI | server logs / browser devtools on `POST /api/v1/scan/resolve` | PARTIAL — Server fast paths measured read-only: exact piece_code lookup 1.747 ms exec (Seq Scan on the 7-row table; unique index uq_ord_piece_code present, forced-index 11.4 ms cold); exact order_no lookup 1.529 ms exec on idx_org_orders_tenant_no. Both far under the 50 ms server target. The <150 ms-to-UI figure was not captured (no devtools timing). |
| Order search by code | p95 < 30 ms exact match | `EXPLAIN ANALYZE` on the `order_no` fast path | PASS — Exact match on order_no uses Index Scan idx_org_orders_tenant_no: warm exec 0.051 ms / planning 0.260 ms; re-measured 1.529 ms exec after QA data loaded. Cold planning 533 ms was one-off catalog/cache overhead. Well under the 30 ms target. Partial-match ILIKE uses a Seq Scan (17.7 ms) on the tiny table; no trigram index, acceptable at this size. |
| Label render | < 300 ms for 50 piece tags | browser performance panel on "Print piece tags" | PARTIAL — Label and piece-tag print previews rendered correctly (EN+AR) with the human code, CODE128 barcode and QR, but the <300 ms-for-50-tags render time was not captured (Chrome print dialog blocks automation timing). |
| Consistency checks | < 2 s | HQ Code Consistency "Run again" timing | PASS on the server call / borderline on full UI. DB: fn_doc_seq_consistency_data() mean 625.781 ms, max 880.456 ms, min 333.690 ms (3 calls). HQ Run again (Playwright resource timing on GET /api/hq/v1/doc-seq/consistency, HTTP 200): request duration ~989 ms (under the 2 s target). But wall-clock from click until the 'Checked at' text changed was ~3145 ms (over 2 s) — the extra ~2.1 s is client render, not the query. Recommend noting the render cost. Run again refreshed the timestamp (EN Nov 5 2026 9:58:04 PM -> 9:58:40 PM; AR page load 10:02:04 PM). |
| Migrations | locks ≤ `lock_timeout 10s` | apply output; no lock timeout error | PARTIAL — All 32 migrations 0666-0697 are recorded in supabase_migrations.schema_migrations with no gaps, and the DB is reachable with no lock-timeout errors during this read-only pass. The apply-time lock duration (lock_timeout 10s) was not observable post-hoc; confirm from the deploy log. |

## 4. Scenario map (feature → scenario)

| Feature | Scenarios |
|---|---|
| Order numbers | S1, S2, S3, S11, S20 |
| Split | S4, S14 |
| Pieces, tags, scan | S5, S7, S8, S9, S10 |
| Labels, receipt | S6, S13 |
| Credit notes | S12 |
| Notifications | S15 |
| HQ | S16, S17, S18 |
| Flag off | S19 |
