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
| `fn_doc_seq_next` per call | p95 < 2 ms, no table scan | `EXPLAIN (ANALYZE, BUFFERS) SELECT fn_doc_seq_next(...)` in a rolled-back transaction; `pg_stat_statements` | Pending |
| Order create (end to end) | ≤ +3 ms vs before | compare API timing before/after on the same env | Pending |
| Hot-tenant contention | ≥ 200 orders/s on one tenant-day, no errors | staging script (parallel creates) | Pending |
| Scan resolve | p95 < 50 ms server, < 150 ms to UI | server logs / browser devtools on `POST /api/v1/scan/resolve` | Pending |
| Order search by code | p95 < 30 ms exact match | `EXPLAIN ANALYZE` on the `order_no` fast path | Pending |
| Label render | < 300 ms for 50 piece tags | browser performance panel on "Print piece tags" | Pending |
| Consistency checks | < 2 s | HQ Code Consistency "Run again" timing | Pending |
| Migrations | locks ≤ `lock_timeout 10s` | apply output; no lock timeout error | Pending |

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
