# Implementation Plan: Human-Friendly Codes (CleanMateX)

Status: **CLOSED** — **P11 follow-ups CODE DONE 2026-11-01 → WAITING FOR USER (apply `0690`, deploy web-admin, next mobile release)**; all 16 HFC migrations applied (`0687`–`0689` applied by the user 2026-11-01, local + remote); waiting for user deploy, smoke test and QA (updated 2026-11-01; full report `IMPLEMENTATION_REPORT.md`). P0–P4 DONE (P4 `0685` applied 2026-10-31); P3b CODE DONE (T3.5–T3.11 incl. T3.9b, 2026-10-31) → WAITING FOR USER (deploy/test); P5 `0687` APPLIED 2026-11-01 (WAITING FOR USER deploy web-admin); P6 DONE (`0688`, `0689` applied 2026-11-01); P7 CODE DONE 2026-10-31 (HQ API + screens, no migration, WAITING FOR USER deploy); P8 CODE DONE 2026-10-31 (mobile LTR + Dart codec, notification fix, rules; no migration, WAITING FOR USER deploy); P9 DONE 2026-10-31 (docs pack, ADR-004, no migration; QA/perf user-run), see §1. Remaining (user): deploy web-admin, then HQ `platform-api` → `platform-web`; optional HQ role grants (A-54); customer mobile release; smoke test; QA S1–S20 + perf; follow-ups in `DEV_GUIDE_DOC_SEQ_ENGINE.md` §25.1. Steps: §22 APPLY_RUNBOOK. Live status is §1, not this line.
Source design: [`PROPOSAL_Human_Friendly_Codes.md`](./PROPOSAL_Human_Friendly_Codes.md) (all decisions approved, including the DECIDED items in §9, §11.10, §11.11 and §11.12).
Author: Coding_Bot_JhA, 2026-10-30 (Asia/Muscat, UTC+4)
Repos: tenant `F:\jhapp\cleanmatex` (owns **all** migrations, `web-admin`, `cmx-api`, `cmx_mobile_apps`) and HQ `F:\jhapp\cleanmatexsaas` (`platform-api`, `platform-web`, `platform-workers`).
Single full report file (created in T0.2, kept updated through the whole job): `docs/features/Human_Friendly_Codes/IMPLEMENTATION_REPORT.md` in the tenant repo, with a mirror pointer in `cleanmatexsaas/docs/features/human-friendly-codes/README.md`.

> How to read this plan: §0 holds the working rules for every task. §1 is the live status table. §2–§4 cover the why and the shape. §5–§9 go layer by layer. §10–§16 are cross-cutting (notifications, performance, security, observability, testing, deprecations, docs). §17–§22 cover delivery: phases with checkpoints, rollback, risks, the approval list, the ordered task checklist and the consolidated TO VERIFY list. Anything not confirmed by a read in this session is marked **TO VERIFY**.

---

## 0. Working rules (apply to every phase and every task)

### 0.1 Approval and safety
1. **Nothing is modified until you approve this plan clearly.** Approval happens phase by phase: a phase starts only after its checkpoint (§17) is signed off in the status table.
2. **Migrations are written but never applied by the bot.** You apply them to local and remote, regenerate types for both repos, and run the Prisma pull. You also commit and deploy, then ask for tests on the deployed environments. The bot never runs `supabase db push`, `db reset`, `migration up` or anything like them.
3. **Never edit an existing migration.** New files only. Other people add migrations at the same time, so this plan names migrations by **name**; the number is assigned at creation time: re-list `supabase/migrations/` immediately before creating each file, take the next free number, and after all files of a phase are written re-check that no number collides with another file (renumber if it does). The actual numbers are recorded in §1 and in the phase report only after each file exists.
4. **No secrets in output.** `.env` files are never printed or echoed. DB checks use a read-only session only, and only when the connection can be made without exposing a secret. Otherwise they are skipped and marked TO VERIFY.
5. **Reuse and extend, never duplicate.** Before creating any table, function, service, component or validator, search both repos (`git grep`) and the DB inventory. If something fits fully, reuse it. If it fits partly, flag it with a specific change suggestion and get approval.
6. **Existing implementations stay as they are.** They are registered as `DOMAIN` or `MANUAL`, and existing printed prefixes are kept (`ARI`, `REF`, `INV`, `SIM`, `CN`, `DN`, `RV`, `PV`, `ADJ`, `POS`, `SES`, `CUST`, …). Every doc type also has a reserved `type_prefix` (3-5 capital letters, unique across all types; approved 2026-10-30 in §20.2). New printed prefixes are 3-5 letters and equal the type's `type_prefix`.

### 0.2 CLAUDE.md files, rules and docs (never ignored)
7. Read these before each phase, and re-read the relevant parts before each task:
   - **Tenant repo**
     - `CLAUDE.md` (root).
     - `web-admin/CLAUDE.md`, which is `@AGENTS.md`. Its two rules: read `node_modules/next/dist/docs/` before writing Next.js code (the Next version has breaking changes), and apply the performance rules.
     - `cmx_mobile_apps/CLAUDE.md`.
     - `docs/features/Order_Fin/Remediation_Work_Packages/CLAUDE.md`, only when touching Order_Fin docs.
   - **HQ repo:** `CLAUDE.md` (root) and `platform-web/AGENTS.md` (TO VERIFY its content).
8. Rule docs per phase are listed in §0.6. Two conventions to remember:
   - The CLAUDE.md files are authoritative (`.cursor/rules/claude-md-authoritative` in HQ).
   - When a rule doc and the real schema disagree, the schema wins and the gap goes into the report. Example: the rule doc says `sys_auth_permissions_cd`, but the real tenant table is `sys_auth_permissions`.

### 0.3 Reusable UI and shared validation
9. **Use existing Cmx components only.**
   - Import from `@ui/primitives|feedback|overlays|forms|data-display|navigation`. The import snippets are in `web-admin/.clauderc`.
   - Feedback uses `cmxMessage` / `useMessage()` from `@ui/feedback`.
   - Paging uses `CMX_DEFAULT_PAGE_SIZE`.
10. **Create a new reusable component only when none exists and it will be reused.** Use the `create-cmx-component` skill in HQ and follow `cmx-shared-components` in the tenant repo. The new components are listed in §8.1 with their path and API. Each one gets a story (`storybook` skill) and unit tests.
11. **Validation is shared.**
    - Zod v4 schemas go in `web-admin/lib/validations/*-schemas.ts`, which is the existing folder. `lib/schemas` and `lib/validation` are empty, so they are not used.
    - The same schema is used by the route, the service and the form.
    - The new `code-format-schemas.ts` is described in §6.6.

### 0.4 Separation of concerns
12. **Every module has its own service and files** (§4.3). Routes and UI call services only. There is no business logic and no direct Supabase or Prisma query in a route handler or component.
    - Existing violations that this work touches are refactored. Example: `app/api/v1/orders/[id]/items/[itemId]/pieces/scan/route.ts` queries tables directly.
    - Repositories hold the data access. Services hold the rules. Routes and controllers handle auth, validation, the service call and the response mapping.
13. **Tenant isolation is mandatory.**
    - Every `org_*` query has an explicit `tenant_org_id` predicate.
    - The tenant comes from the session (`getTenantIdFromSession` / `withTenantContext` in `web-admin/lib/db/tenant-context.ts`, and `requirePermission(...)` in `lib/middleware/require-permission.ts`), never from the request body.

### 0.5 Status, report and docs discipline
14. **After every task:** update the §1 status table (task state, date, by whom) and append to the single report file. The entry records what changed, the files, the tests run with their results, deviations, TO VERIFY items closed or opened, and the next step.
15. **Every phase ends with a docs task:** refresh or create the feature docs under `docs/features/Human_Friendly_Codes/` (tenant) and `docs/features/human-friendly-codes/` (HQ). That covers status, dev guide, user guide, test guide, deploy guide, permissions, APIs, flags, settings, validations, risks and rollout. The plan's final task (T9.6) runs the repo documentation skills to generate the full pack.
16. **Deprecations** get a full note (§15): what it is, where it's used, the replacement call chain down to the DB table, and why.
17. **After code changes,** run `npm run build` and `npx eslint . --quiet` (web-admin), `npm run check:i18n` (web-admin) and `npm run i18n:split` (platform-web). In HQ, also run the typecheck and `npm run verify:schema`. Results go in the report.

### 0.6 Skills, agents and rule docs per phase (verified to exist on 2026-10-30)

| Phase | Tenant repo skills (`.claude/skills`) | HQ repo skills (`.claude/skills`) | Agents (`.claude/agents`) | Rule docs to read first |
|---|---|---|---|---|
| P0 Inventory | `database`, `multitenancy`, `architecture`, `rebuild-platform-info-inventories` | `database`, `architecture-hq`, `cross-project-sync`, `check-placement` | HQ `code-analysis`, `cross-project-orchestrator` | tenant `.cursor/rules/databaseconventions`, `databasefeatureabbreviations`, `databasegrandfatheredobjects`, `postgresqlrules`, `supabaserules`; `docs/platform/inventories/*` |
| P1 DB engine | `database`, `multitenancy`, `add-setting-db` (only if a settings row is reused, A-03), `implementation` | `database`, `create-db-table`, `create-rls-policy`, `platform-security` | `implementer-tester`, `code-review-specialist` | `database-migrations`, `migration-object-comments`, `databaseconventions`, `multitenancy`, `postgresqlrules`, `supabaserules`, `constants-db-mirror`; `docs/dev/drop-cascade-migration-workflow.md` |
| P2 ORDER | `database`, `backend`, `business-logic`, `implementation`, `testing`, `pull-prisma` (user runs it) | `cross-project-sync` (types only) | `implementer-tester`, `debugging-specialist`, `code-review-specialist` | `backendstandards`, `performance-engineering`, `testing`; `docs/dev/rules/integration-contracts.md`, `docs/dev/rules/no-silent-money-mutation.md` (split flow touches money totals) |
| P3 Pieces, items, scan | `database`, `backend`, `frontend`, `i18n`, `testing` | — | `implementer-tester`, `code-review-specialist` | `cmx-shared-components`, `frontendstandards`, `uiuxrules`, `uiblueprint`, `i18n`; `docs/dev/rules/react-effects-patterns.md`, `react-rhf-and-table-lint.md`, `react-lint-verification-checklist.md` |
| P4 Labels, QR | `frontend`, `backend`, `i18n`, `storybook`, `testing` | — | `implementer-tester`, `storybook-generator` | `cmx-shared-components`, `cmx-message`, `uiuxrules`, `report-implement-or-build` (print pages) |
| P5 Store credit SCN + DOMAIN registration | `database`, `backend`, `business-logic`, `testing` | — | `implementer-tester`, `code-review-specialist` | `no-silent-money-mutation.md`, `constants-db-mirror` |
| P6 Permissions, nav, flags | `create-update-rbac-permission`, `update-rbac-role`, `navigation`, `create-feature-flag`, `rebuild-ui-access-contract`, `refill-ui-access-contract-permissions` | `platform-security`, `create-feature-flag` | `nav-refactor-specialist` | `permissions-migration`, `navigation-dual-write`, `feature-flag-migration`, `ui-access-contract-pattern` |
| P7 HQ API + screens | — | `create-nestjs-module`, `api-design`, `backend-hq`, `create-feature-screen`, `create-cmx-component`, `frontend`, `i18n`, `generate-storybook-stories`, `verify-architecture`, `testing`, `performance-monitoring` | HQ `implementer-tester`, `code-review-specialist`, `storybook-stories-generator` | HQ `CLAUDE.md`; `.cursor/rules/cmx-shared-components`, `i18n-catalog`, `react-effects-patterns`, `react-rhf-and-table-lint`, `web-typecheck-patterns`, `saas-backoffice-name`, `rulesfromclaudejh`; `.claude/docs/Dev/FEATURE_PLACEMENT_GUIDE.md`, `CROSS_PROJECT_FEATURE_CHECKLIST.md` |
| P8 Clients, notifications, rules text | `backend`, `i18n`, `code-documentation` | `cross-project-sync`, `share-code-decision` | `cross-project-orchestrator` | `cmx_mobile_apps/CLAUDE.md`, `integration-contracts.md` |
| P9 QA, docs, close-out | `testing`, `documentation`, `code-documentation`, `documentation-audit`, `documentation-pack-repair` | `testing`, `documentation`, `create-feature-documentation`, `code-documentation`, `adr-builder`, `adr-index` | tenant + HQ `code-documenter`, `adr-producer` | `documentationrules`, `documentationmap`, `.claude/skills/implementation/prd-rules.md` |

- Tenant `.cursor/skills` holds only `pull-prisma`.
- No skill was found for these, so they're TO VERIFY:
  - "label printing / thermal printers". Use `frontend` + `report-implement-or-build`.
  - "barcode libraries". Handled as approval item A-07.
- An ADR is produced in P9 for the shared engine (`adr-builder` in HQ, `adr-producer` agent in tenant).

---

## 1. Status table (update after every task, per rule 14)

| Phase | Title | State | Checkpoint sign-off | Last update | Notes |
|---|---|---|---|---|---|
| P0 | Inventory + seed lists (read-only) | DONE | 2026-10-30 | 2026-10-30 | `INVENTORY.md` written; §22 resolved; A-01/A-02/A-16/A-21 APPROVED 2026-10-30 (§20) |
| P1 | DB engine (lookups, config, counters, functions, view) | DONE | 2026-10-30 | 2026-10-30 | Applied 2026-10-30 by the user (local + remote); Supabase types regenerated in both repos and `prisma.schema` updated. 7 migrations: `scope_modules` `0666_sys_platform_scope_modules.sql`, `doc_seq_type_config` `0667_doc_seq_type_config.sql`, `hq_general_config` `0668_hq_general_config.sql`, `doc_seq_counters` `0669_doc_seq_counters.sql`, `doc_seq_engine_fns` `0670_doc_seq_engine_fns.sql`, `doc_seq_consistency` `0671_doc_seq_consistency.sql`, `doc_seq_code_tables_registry` `0672_doc_seq_code_tables_registry.sql`. Tests `supabase/tests/doc_seq_engine_p1.test.sql`; guide `DEV_GUIDE_DOC_SEQ_ENGINE.md` (pre-apply checks + apply order). Then regenerate types and `prisma:pull`. Perf revision before apply (2026-10-30, approved): `0670` reads the config once per number, `0667`/`0669` drop 3 redundant indexes, `0671` view reads only target tables and accepts typed triggers, data fn skips proven-unique dup scans; load-test numbers in DEV_GUIDE §14 |
| P2 | ORDER numbering cutover | DONE | 2026-10-31 | 2026-10-31 | **P2 DONE applied 2026-10-31** by the user (local + remote); Supabase types regenerated in both repos and `prisma.schema` updated. Migration `ord_order_no_engine` = `0674_ord_order_no_engine.sql`; tests `supabase/tests/ord_order_no_engine_p2.test.sql`; app: order numbering service, transactional split, signup cleanup. Decisions A-28..A-30 (§20) |
| P2.1 | Split family root + tenant hard-delete guard | DONE | 2026-10-31 | 2026-10-31 | **P2.1 DONE applied 2026-10-31** by the user (local + remote); Supabase types regenerated in both repos and `prisma.schema` updated. Migrations `ord_root_order_id` = `0677_ord_root_order_id.sql`, `tenant_hard_delete_guard` = `0678_tenant_hard_delete_guard.sql` (§5.8.1). Tests: `supabase/tests/hfc_p21_split_safety.test.sql` (user-run, rolled back), P2 test T2.6c updated; Jest in both repos. App: split stores/reads the family root; `registerTenant` inserts `creating` → `trial`. Decisions A-28 (changed), A-29, A-30, A-31 (§20) |
| P2.2 | HQ tenant create uses `creating` (A-31 follow-up) | WAITING FOR USER (deploy/test) | — | 2026-10-31 | No migration (0678 already allows it). HQ `platform-api` `TenantsService.create` inserts `creating`, writes the base currency, then moves the tenant to the requested status (default `trial`); a failed required step hard-deletes the `creating` row; a failed final update rolls back and returns 500 `TENANT_CREATE_FINISH_FAILED`. Initialization stays best-effort after the switch (A-32). Callers still cannot ask for `creating` (409). Spec `tenants.service.create.spec.ts` (7) + guard spec (4). §5.8.2, §21 T2.10–T2.12 |
| P3 | Item / piece codes (DB + must-ship app fixes) | DONE | 2026-10-31 | 2026-10-31 | **P3 DONE applied 2026-10-31** by the user (local + remote); Supabase types regenerated in both repos and `prisma.schema` updated. Review choices accepted by the user 2026-10-31 (A-39). Written 2026-10-31. Migrations `ord_item_srno_barcode` = `0682_ord_item_srno_barcode.sql`, `ord_piece_code_human` = `0683_ord_piece_code_human.sql` (renumbered from 0681/0682 because `0681_fin_view_tenant_order_idx.sql` is yours). Order: deploy web-admin P3 code → 0682 → 0683 → regenerate types + Prisma (`piece_code String @default("")`) → `supabase/tests/hfc_p3_codes_safety.test.sql` (DEV_GUIDE §17). App: plain line barcode (`lib/db/orders.ts`), item numbering continues from the highest serial under the DB lock (`order-item-code.service.ts`; `updateOrder`, order-change ADD_ITEM, split), batch-update checks every tag first and saves nothing on failure (400 `PIECE_TAG_INVALID` / `PIECE_TAG_LOOKS_LIKE_CODE`, 409 `PIECE_TAG_IN_USE` / `PIECE_TAG_DUPLICATE_IN_BATCH`, `issues[]`; race → 409 with `piecesUpdated`), tags trimmed + upper-cased, A-Z 0-9 - _ . /, ≤ 64, never shaped like one of our codes, freed when the piece is removed or the order is delivered / closed / cancelled (`tag_released_at`, `trg_ord_piece_tag_release`), piece scan looks the tag up upper-cased, `SortingPieceCard` tag = `barcode`, labels render the serial. HQ: A-33 rollback check, wizard 409 title EN/AR. Decisions A-33..A-38 (§20). Box Postgres tests incl. 4-session concurrency pass (t0682 54 checks, safety test A1..C7); web-admin jest 26/26, tsc 0 errors, eslint 0 errors on the changed files (2026-10-31). Prisma also gets `tag_released_at DateTime? @db.Timestamptz(6)`. Scan API / scan UI / `jest-axe` (T3.5 rest–T3.11) move to **P3b** |
| P3b | Tenant-wide scan (APIs, `CmxScanInput`, global scan dialog, codes on screens) | CODE DONE (T3.5–T3.11 incl. T3.9b, all done 2026-10-31) → WAITING FOR USER (deploy/test) | — | 2026-10-31 | **No migration.** Done 2026-10-31: `ScanResolveService` + `cmx-code-payload` (T3.5); APIs `POST /api/v1/scan/resolve`, `GET /api/v1/orders/lookup`, `GET /api/v1/orders/pieces/lookup`, `PUT|DELETE /api/v1/orders/pieces/:pieceId/external-tag`, `pieces/scan` on the resolver, piece `PATCH` tag checks = batch-update (T3.6); `useKeyboardWedge`, `CmxScanInput`, both scanners moved (T3.7); `CmxCodeChip`, `CmxCodeSearchInput` (T3.8); `src/features/scan` global scan dialog + link-tag dialog + top-bar button + `Ctrl+Shift+F`, behind `human_codes_scan_labels` (default off) (T3.10); EN/AR `scan.json` + `check:i18n` (T3.11); `jest-axe@^10` (A-25). Rate limit `scan-user` 600/min/user. Decisions A-39, A-40 (§20). **Done 2026-10-31 (second slice, A-41..A-44 approved by the user):** T3.9 core — `CmxCodeChip` on the order page header (+ "Part of …" parent link), order lines, piece cards (piece code + live tag), gift-card log; order and piece UUID shortening removed (fix-order-data modal, issues table, pending-payments worklist, gift-card log); orders search box = `CmxCodeSearchInput` (a full code opens the order via the resolver, else list search) + server fast path on exact `order_no` / its sub-orders; `?piece=` (piece id or piece code) opens the items tab, the line, the page of the piece, scrolls to it and highlights it (`aria-current`); `codes.json` (EN/AR) glossary; assembly scan falls back to the shared resolver (A-42); `CmxDialog` accessible name + jest-axe full rules (A-44); lint fix in `code-format-schemas.ts`. **Done 2026-10-31 (T3.9b):** `CmxCodeChip` (order no.) on the workflow processing table, workboard, preparation list + detail, processing / ready / packing / assembly detail headers, packing / assembly / delivery lists, pickup ready list, delivery route manifest / stop / order detail, home-collection list + detail, orders / payments / financial reports, orders simple table; receipt print shows the order no. as `<bdi dir="ltr">` monospace (no button in print); chips inside links are `copyable={false}`; reconciliation screens show no order numbers (N/A). Pieces panel (`PieceList`, every pieces view): filter by piece code or live tag (`matchesPieceCodeFilter`, shown from 6 pieces, released tags ignored, Arabic-Indic digits read), with count and no-match text (`codes.json` EN/AR); tests `__tests__/ui/scan/codes-on-stations.test.tsx`. Guide `SCAN_AND_PIECE_CODES.md` |
| P4 | Labels, staff QR, real CODE128 | **DONE (applied 2026-10-31)** — `0685` applied by the user local + remote, types (both repos) and `prisma.schema` regenerated; deploy and real-scanner test S6/S7/S13 are yours | 2026-10-31 | 2026-10-31 | **Applied 2026-10-31.** **Pending follow-ups (not done, recorded 2026-10-31, each needs your OK):** (1) retire the `label_printing` flag from HQ later, separately; (2) delete the old `sys_tenant_settings_cd` `LABEL_*` / `RECEIPT_ORDER_CODE128` rows later, only if the `0685` NOTICE reported any; (3) regenerate the platform inventory with `scripts/sync-platform-inventory.mjs`; (4) the stray `C:\Users\JHNLP\p4v2code.zip` can be deleted. Migration `add_settings_label_printing` = `0685_add_settings_label_printing.sql` (**reworked 2026-10-31, A-46..A-49:** config tables `sys_label_printing_cf` (platform defaults per label type ORDER_LABEL / PIECE_TAG / RECEIPT) + `org_label_printing_cf` (tenant-wide and per-branch overrides, NULL = inherit), resolver `fn_label_printing_resolve(tenant, branch)` branch → tenant → system, nav row `settings_labels`; **no `label_printing` flag check** (available to all, A-47); only the receipt barcode is still capped by `human_codes_scan_labels` (0684). The earlier draft with five `sys_tenant_settings_cd` rows was never applied and is replaced). Settings screen **Settings → Labels & Tags** (`/dashboard/settings/labels`, `settings:read` / save `settings:update`, EN/AR, per branch with "use default") + `GET`/`PUT /api/v1/settings/label-printing`. Test `supabase/tests/hfc_p4_label_settings_safety.test.sql` (rolled back). App: `bwip-js@^4.11.4` (A-07) → `lib/utils/barcode/code128.ts` + `qr.ts`; `LabelDataService` + `GET /api/v1/orders/[id]/label-data` (`orders:read`, A-09); `src/ui/print` (`CmxBarcode`, `CmxLabelRenderer` order label + piece tag, `labelPageCss`, stories); `printReactInIframe` + `useLabelPrint`; `print-label-button.tsx` rebuilt (no HTML strings, no phone, always enabled, "Print piece tags"); `PrintItemLabels` real CODE128; receipt print CODE128 of the order no. when `RECEIPT_ORDER_CODE128` resolves true; D2 shim, D3 removed, D4 no longer read; EN/AR `labels.json`. Decisions A-45..A-49 (§20). Guide `USER_GUIDE_LABELS.md` |
| P5 | Store credit notes SCN + DOMAIN registration check | **APPLIED 2026-11-01** (`0687` applied by the user 2026-11-01, local + remote) → WAITING FOR USER (deploy web-admin; local safety test `hfc_p5_scn_safety.test.sql` not reported yet) | 2026-11-01 | 2026-11-01 | Migration `fin_store_credit_note_scn` = `0687_fin_store_credit_note_scn.sql` (0686 is `0686_scrr_acct_minor_unit_chk.sql`, not ours); safety test `supabase/tests/hfc_p5_scn_safety.test.sql` (rolled back); app `stored-value.service.ts` inserts `''` and reads `SCN-YYYY-NNNNNN` back, fallback `STORE_CREDIT_NOTE_NUMBERING` (`lib/constants/doc-seq.ts`, ENGINE / LEGACY; kept in P9 (A-68), removal follow-up ~2026-12-01). Box Postgres: chain 0666–0674 + 0687 applies, 0 ERROR, safety test T5.1a–h PASS, 20 parallel issues → 20 distinct numbers 000001–000020, re-run refused, blank row refused, seed continues from SCN-2026-000041. `DOMAIN_CODES_REGISTRY.md` (49 DOMAIN rows match INVENTORY §6, 17 app owner files exist). Decisions A-50..A-53 (§20, decided by assistant while user away, please review). Apply steps DEV_GUIDE §20 |
| P6 | Permissions, navigation, feature flag | **DONE (applied 2026-11-01)** — `0688` + `0689` applied by the user 2026-11-01, local + remote; no deploy needed (local safety test `hfc_p6_safety.test.sql` not reported yet) | 2026-11-01 | 2026-11-01 | `permissions_doc_seq` = `0688_hq_doc_seq_permissions.sql` (3 HQ codes `hq_doc_seq:read`, `hq_general_config:read`, `hq_general_config:manage`; no role grant, A-54: SUPER_ADMIN has `*`); A-48 (2) = `0689_ord_label_image_cols_deprecated.sql` (COMMENT ON only, nothing dropped, A-56); safety test `supabase/tests/hfc_p6_safety.test.sql`. `navigation_doc_seq` SKIPPED (HQ nav is code, P7); `ff_human_codes` already done as `human_codes_scan_labels` in `0684`; no tenant permission, so no UI access contract refresh (A-55). Doc: `PERMISSIONS.md`. Box test: full chain 0666→0689 + P5 and P6 safety tests PASS, both migrations run twice without error. |
| P7 | HQ API + HQ screens | CODE DONE → WAITING FOR USER (deploy `platform-api` + `platform-web`; `0688` applied 2026-11-01, so the deploy can go now; no migration) | 2026-10-31 | 2026-10-31 | **No migration.** HQ `platform-api`: modules `doc-seq-config` (`GET /api/hq/v1/doc-seq/types`, `/types/:code`, `/types/:code/preview`, `/consistency`; `hq_doc_seq:read`) and `general-config` (`GET /api/hq/v1/general-config`, `GET …/options` with `hq_general_config:read`; `PATCH` with `hq_general_config:manage`, optimistic version, audit of changed fields only); registered in `app.module.ts`. HQ `platform-web`: `CmxCodeChip` (`src/ui/data-display`, HQ copy of the tenant chip + `doc` kind), features `src/features/doc-seq` (Code Types list + details dialog with preview, Code Consistency screen) and `src/features/general-config` (view + edit dialog with period-field confirm and 409 reload), pages `/system-codes/doc-seq-types`, `/system-codes/doc-seq-consistency`, `/settings/general-config`, 3 sidebar entries, EN/AR `docSeq.json` + `generalConfig.json` + `layout.json` routes, catalog regenerated; tenant wizard prefill from General Config (A-13, best effort). Tests (2026-10-31, Windows): platform-api jest 5 suites / 42 tests pass, tsc no new error (63 old errors in other spec files), eslint 0 errors; platform-web jest 2 suites / 7 tests pass, `tsc --noEmit` 0 errors, eslint 0 errors (JSDoc warnings only), `check:i18n` passes. Decisions A-57..A-63 (§20). Guide DEV_GUIDE §23; HQ pointer `cleanmatexsaas/docs/features/human-friendly-codes/README.md` |
| P8 | Clients, notifications, rule text in both repos | CODE DONE → WAITING FOR USER (deploy web-admin for the notification fix; next mobile release for the LTR display; no migration) | 2026-10-31 | 2026-10-31 | **No migration.** Mobile: `mobile_core` `human_codes.dart` (+7 tests) exported; customer app order card + detail title use `ltrCode` (2 widget tests updated). cmx-api: N/A (A-65). Notifications: transition route now sends `order_no` as `{{order_number}}` (+2 jest tests, A-66). Rules: HFC-RULE blocks refreshed in 6 tenant + 6 HQ files (A-67). Tests (2026-10-31, Windows): `flutter test` mobile_core 7/7, customer_app test/orders 2/2, `flutter analyze` no issues; web-admin jest `orders-transition.route.test.ts` 5/5, eslint clean, `tsc --noEmit` 0 errors. Decisions A-64..A-67 (§20). Guide DEV_GUIDE §24 |
| P9 | QA on deployed envs, docs pack, close-out | **DONE (docs) → CLOSED** (migrations all applied 2026-11-01; waiting for user deploy); QA S1–S20 + perf are user-run on the deployed env | 2026-10-31 | 2026-10-31 | **No migration** (next free number `0690`). Tenant pack (15 new files in this folder): README, version.txt 1.0.0, CHANGELOG, current_status, development_plan, progress_summary, developer_guide(+mermaid), user_guide EN/AR (+mermaid), deploy_guide, testing_guide_and_scenarios, technical_docs/README, `QA_TEST_GUIDE.md` (S1–S20, results Pending), `IMPLEMENTATION_REPORT.md` (phases, decisions A-01..A-70, apply steps, 14 follow-ups). HQ: ADR-004 (Proposed) + both ADR indexes (next ADR-005) + HQ README links. Shims kept (A-68). Tests (2026-10-31): web-admin HFC jest 29 suites / 237 tests PASS; box chain 0666–0689 + safety tests PASS; web-admin `tsc --noEmit` clean (the earlier `order-change-preview.service.ts:486` error was your WIP and looks resolved by you). Decisions A-68..A-70 (§20). Guide DEV_GUIDE §25 |
| P10 (later) | Backfill waves for other master data (suppliers, employees, delivery…) | NOT PLANNED IN DETAIL | — | — | Template in §5.13; separate approval per table |
| P11 | Follow-ups from DEV_GUIDE §25.1 (#1 code part, #8, #10, #11) | **CODE DONE → WAITING FOR USER (apply `0690`; deploy web-admin; next mobile release)** | 2026-11-01 | 2026-11-01 | Migration `0690_hq_doc_seq_role_grants` (A-71, not applied) + safety test `hfc_p11_role_grants_safety.test.sql`; `label_printing` removed from web-admin code (A-72); mobile booking `ltrCode` (A-73); `credit_note_no` variables (A-74). Tests: box Postgres chain `0687`→`0690` + rerun PASS; web-admin jest 46 suites / 407 tests + 9 new/changed pass; Windows `tsc --noEmit` 0 errors; `flutter analyze` clean. Next free number `0691` |

States: `NOT STARTED` → `IN PROGRESS` → `WAITING FOR USER (apply/regenerate)` → `WAITING FOR USER (deploy/test)` → `DONE` / `BLOCKED (reason)`.

---

## 2. Goals and non-goals

### 2.1 Goals
- **G1.** One domain-agnostic code engine in the DB.
  - `sys_doc_seq_type_cd` with its lookups.
  - Three scope counters (org / sys / hq).
  - A shared formatter, period-key function and assign/guard triggers.
  - The consistency view.
  - Any future table gets a human code by adding one config row plus one trigger.
- **G2.** ORDER numbers are race-free, never truncate, use the tenant's day, are immutable, and keep the same look (`ORD-YYYYMMDD-NNNN`).
- **G3.** Sub-orders are `<parent>-S<n>`, assigned in the same transaction as the split.
- **G4.** Piece codes are human: `<order_no>-<item n>-<piece n>`, unique per tenant and immutable. Item barcode stores the value, not an image.
- **G5.** Scanning works across the whole tenant: order number, piece code, external piece tag or the `CMX1:` staff QR, from any scanner screen. That includes keyboard-wedge scanners.
- **G6.** Labels always print.
  - The order label has the staff QR `CMX1:ORD:<order_no>` plus a **real** CODE128 of `order_no`.
  - The piece tag has a CODE128 of `piece_code`, with an optional QR.
  - Everything is rendered at print time, with no images stored.
- **G7.** Store credit notes use `SCN-YYYY-NNNNNN` on the general counter. That removes the `count+1` race, the tenant-UUID leak and the prefix clash with tax `CN`.
- **G8.** Every existing numbering scheme (finance, tax, vouchers, POS, cash drawer, customers, users) is registered as DOMAIN, so prefixes are globally unique and visible.
- **G9.** HQ can see the code types, the general config and a consistency dashboard, in EN and AR with RTL.
- **G10.** UUIDs are never shown as business identifiers in the touched screens, prints, QR codes or messages.

### 2.2 Non-goals (this plan)
- Moving finance, tax, voucher, POS or cash-drawer generators to GENERAL. They are registered as DOMAIN only, and moving them is a later, separate decision (proposal 11.7 K).
- Strict no-gap numbering in the general engine. Owning domains implement it.
- Tenant prefix override. The column is reserved and the flag stays off.
- Per-branch counters and the `BR` token. The token is reserved and the formatter rejects it until enabled (A-10).
- Signed QR payloads (`CMX1:…:<HMAC>`). Reserved for later.
- An offline POS numbering range (`OFF-<device>-<n>`). Documented only.
- An HQ edit screen for `sys_doc_seq_type_cd`. It stays read-only in this plan. The `hq_general_config` edit screen **is in this release** (A-12 approved 2026-10-30).
- Backfilling suppliers, employees, delivery and others. That is P10, with separate approval per table.
- Renaming any existing column. `order_no`, `piece_code` and `credit_note_no` keep their names.

---

## 3. Verified facts and new findings (read-only, 2026-10-30)

These came from `git grep` / `Get-Content` on both repos. **No DB query was run in this session:** the connection would need a secret from `.env`. DB facts below come from proposal §11.3 (the earlier read-only session) and must be re-checked in P0.

| # | Finding | Impact on plan |
|---|---|---|
| F1 | `sys_modules_cd`, `sys_saas_scope_cd`, `sys_module_sub_systems_cd`, `hq_general_config`, `sys_doc_seq*` don't exist in any migration. The only near matches are `sys_wf_prof_ver_module_cf` and `hq_crm_marketing_tracking_config`, and neither fits. | Create them (P1). Note the near matches in the inventory. |
| F2 | `sys_currency_cd`, `sys_language_cd`, `sys_country_cd` exist (0055; currency also in 0264/0265). `org_tenants_mst.timezone VARCHAR(50)` exists (0001). | FK targets for `hq_general_config`. The tenant TZ is the source for the order day key. |
| F3 | **Overlap:** `sys_tenant_settings_cd` already has `ERP_LITE_FISCAL_YEAR_START` (INTEGER 1–12, TENANT scope, 0178). 0652 deactivated it, along with `SYS_TIMEZONE`, `TENANT_DATE_FORMAT`, `TENANT_LANGUAGE`, …, because they had no consumer. | "Never duplicate" means you decide (A-03). Recommended: keep the approved `org_tenants_mst.fiscal_year_start_month` and `hq_general_config`, and add a `COMMENT ON` + deprecation note saying the deactivated settings are superseded. |
| F4 | `lib/utils/barcode-generator.ts` `generateBarcode()` builds a **fake** "CODE128-style" SVG (its own comment says "not real CODE128, but visually similar") and strips hyphens. Only `lib/db/orders.ts:253` calls it. | Item and order barcodes printed today **can't be scanned**. P4 replaces it with a real CODE128 renderer (new dependency, A-07). |
| F5 | `qrcode ^1.5.4` and `zod ^4.1.12` are installed. No CODE128 library is installed. | QR rendering reuses `qrcode`. CODE128 needs `bwip-js` or `jsbarcode` (A-07). |
| F6 | `app/api/v1/orders/[id]/items/[itemId]/pieces/scan/route.ts` queries `org_order_items_dtl` / `org_order_item_pieces_dtl` straight from the route and matches `barcode` within one item only. | Refactor it to call `ScanResolveService` (same response contract), plus a new tenant-wide resolve endpoint. |
| F7 | Scanner UIs exist: `src/features/orders/ui/PieceBarcodeScanner.tsx` (CmxInput + Enter) and `src/features/assembly/ui/assembly-scanner.tsx` (Enter key, posts `{taskId, barcode}` to `v1/assembly/tasks/[taskId]/scan`). | Extract one reusable `CmxScanInput` + `useKeyboardWedge`, and move both screens onto it (no duplicate logic). |
| F8 | `current_tenant_id()` (redefined in 0563) is a pure membership lookup and is used in RLS policies as `(SELECT public.current_tenant_id())`. | The tenant check in `generate_order_number` and the new `fn_*` functions uses it. |
| F9 | `0563_org_users_user_code.sql` already gives users a platform-wide unique `user_code` (`org_user_code_seq`, `fn_org_user_code_next()`). | Register it as DOMAIN (scope and format TO VERIFY in P0). |
| F10 | Generators in migrations: `generate_order_number`, `generate_customer_number`, `fn_next_order_item_srno`, `fn_next_fin_doc_no`, `generate_cash_drawer_sess_no`, `generate_cash_drawer_trx_no`, `generate_session_no`. | All are inventoried and registered (DOMAIN, or GENERAL for ORDER). |
| F11 | `org_credit_notes_mst.credit_note_no TEXT NOT NULL`, `CONSTRAINT uq_credit_note_no UNIQUE (tenant_org_id, credit_note_no)` + index (0286). 0283 also adds `credit_note_no` to another table (TO VERIFY which). App: `stored-value.service.ts:414,472` builds `CN-<tenant8>-<count+1>`. | The SCN target is confirmed. The 0283 column is checked in P0. |
| F12 | `piece_code` appears only in `0073`. Index `idx_order_pieces_barcode` is there (0073:165). | `DROP EXPRESSION` is safe from other migrations. Views and functions are still checked in P0 via `pg_depend` (TO VERIFY). |
| F13 | HQ permission codes are mixed: `currencies.view` / `currencies.manage` (dot) and `hq_ops:read` / `hq_ops:manage_config` (colon, the newer style, 0612). Seed pattern: `INSERT INTO public.hq_permissions (permission_code, permission_name, permission_name_ar, resource_code, action_code, …) … split_part(code, ':', …) ON CONFLICT DO NOTHING`. Guards: `@UseGuards(JwtAuthGuard, HqPermissionGuard)` + `@RequireHqPermission('…')`. | New HQ permissions use the colon style (A-08). |
| F14 | HQ already has a **Core Data Management** module (`platform-api/src/modules/core-data`, route `platform/core-data`). It's driven by `sys_code_tables_registry` + `sys_code_table_audit_log`. HQ `system-codes` (code locking / dependency check) and the `(dashboard)/system-codes/*` web pages exist. | The five new lookup tables are **registered in `sys_code_tables_registry`** so the existing screens list and manage them. No new lookup-editing UI. Registry columns are TO VERIFY. |
| F15 | Tenant permissions are in `sys_auth_permissions` (not `_cd`). Constants are in `lib/constants/permissions/orders-perm.ts` (`orders:read`, …). | The scan and label APIs reuse `orders:read`. Optional new codes are in A-09. |
| F16 | HQ feature layout: `platform-web/src/features/<feature>/{api,hooks,model,ui}`. NestJS modules: `<module>.controller/.service/.repository/.module.ts`, `dto/`, `__tests__/`. | Mirrored for the new HQ modules (§4.3). |
| F17 | `org_tenants_mst` already has `date_format` (default `DD/MM/YYYY`), `time_format` (default `24h`, lowercase), `first_day_of_week` (default 6) and `language VARCHAR(10)` (0039:150–156). | §5.3 adds only `current_fiscal_year`, `fiscal_year_start_month` and `locale_code`; it reuses `language` and the lowercase values (S1). See `INVENTORY.md` |
| F18 | HQ already edits tenant locale (`tenants/dto/update-tenant-locale-settings.dto.ts`, `tenants.service.ts:320–404`). The wizard defaults are OMR and 30 trial days. | Extend that service and DTO; the seed uses OMR and 30 (S2, S3). See `INVENTORY.md` |
| F19 | `fn_next_fin_doc_no` and `generate_cash_drawer_sess_no` are SECURITY DEFINER with no REVOKE and no `search_path`. | Harden them in `doc_seq_engine_fns` (S5). See `INVENTORY.md` |
| F20 | The srno trigger always returns `'001'` (regex bug in 0015). Item `barcode` holds SVG data URLs. | §5.9 backfills before the UNIQUE (S6, S7). See `INVENTORY.md` |
| F21 | Two split paths with no transaction; two voucher generators on one table; two `product_code` generators. | One transactional split service (S9). Vouchers and products stay DOMAIN (S10, S17). See `INVENTORY.md` |
| F22 | DOMAIN prefixes clash (INV, CN, REF, ADJ, CRN, CMX) and share target columns. Some prefixes are 1 letter or contain `-`. | The prefix/target unique indexes and the prefix CHECK apply to GENERAL rows only (S11, S18). See `INVENTORY.md` |
| F23 | `print-label-button.tsx` is an XSS sink and always disabled. The orders list sorts `order_no` lexically. | Fixed in P4 (S12) and P3 (S13). See `INVENTORY.md` |
| F24 | HQ nav is hard-coded in `platform-web/components/layout/sidebar.tsx`. | `navigation_doc_seq` is not needed and is skipped (§5.12, A-22). See `INVENTORY.md` |

---
## 4. Architecture

### 4.1 Layers and ownership

```
                 ┌──────────────────────────── DB (tenant repo migrations) ─────────────────────────────┐
 Config  ────►   │ sys_saas_scope_cd · sys_modules_cd · sys_module_sub_systems_cd                        │
                 │ sys_doc_seq_category_cd · sys_doc_seq_manage_level_cd · sys_doc_seq_type_cd           │
                 │ hq_general_config (1 row) · org_tenants_mst.fiscal_year_start_month / .timezone      │
 Engine  ────►   │ fn_doc_seq_period_key · fn_doc_seq_format                                             │
                 │ fn_doc_seq_next (TENANT_ORG) · fn_sys_doc_seq_next (SYS) · fn_hq_doc_seq_next (HQ)    │
                 │ counters: org_doc_seq_mst · sys_doc_seq_mst · hq_doc_seq_mst                          │
 Attach  ────►   │ fn_doc_seq_assign_code() BEFORE INSERT · fn_doc_seq_guard_immutable() BEFORE UPDATE   │
 Domain  ────►   │ ORDER: generate_order_number (wrapper) · fn_ord_next_sub_order_no                     │
                 │ ITEM: fn_next_order_item_srno (new body) · PIECE: fn_ord_piece_code_set               │
 Safety  ────►   │ vw_doc_seq_consistency (schema) · fn_doc_seq_consistency_data() (data)                │
                 └───────────────────────────────────────────────────────────────────────────────────────┘
        ▲ reads only (codes are never generated in TS)                     ▲ service role, server-only
 web-admin services (tenant)                                         platform-api modules (HQ)
  order-numbering · piece-code · labels · scan-resolve · doc-seq-cfg   doc-seq-config · general-config · core-data(reuse)
        ▲                                                                   ▲
 web-admin routes/actions → UI (Cmx components)                      platform-web features → screens
```

**Principles**
- **Codes are generated only in the DB.** TS code never computes a sequence number. It can only format a preview by calling the DB formatter (HQ preview), or parse and validate a code (shared validators).
- **The engine doesn't know any domain.** Domain functions (ORDER, PIECE) are thin wrappers or derived triggers, and they're registered in `sys_doc_seq_type_cd` with `managed_by_object`.
- **Attach by configuration.** A GENERAL code needs one config row plus `CREATE TRIGGER … EXECUTE FUNCTION fn_doc_seq_assign_code('<DOC_TYPE>', '<column>')` plus the guard. The consistency view proves the wiring.
- **Clients treat codes as opaque strings.** Only `code-format-schemas.ts` knows the shapes, and it is lenient: `\d{4,}`, optional `-S<n>`.

### 4.2 Engine contracts (DB)

| Function | Signature | Volatility / security | Returns | Errors (SQLSTATE `P0001`, message prefix) |
|---|---|---|---|---|
| `fn_doc_seq_period_key` | `(p_reset text, p_at timestamptz, p_tz text, p_fy_start smallint)` | STABLE, INVOKER | `''`, `'2026'`, `'202610'`, `'20261030'`, `'FY2026'` | `DOC_SEQ_BAD_RESET` |
| `fn_doc_seq_format` | `(p_doc_type text, p_value bigint, p_at timestamptz, p_tz text, p_fy_start smallint DEFAULT NULL)` | STABLE, DEFINER, `search_path=pg_catalog, public, pg_temp` | formatted code | `DOC_SEQ_TYPE_NOT_FOUND`, `DOC_SEQ_TOKEN_NOT_ENABLED` (BR) |
| `fn_doc_seq_next` | `(p_tenant uuid, p_doc_type text, p_at timestamptz DEFAULT now())` | VOLATILE, DEFINER, same search_path | formatted code (calls the formatter) | `DOC_SEQ_TYPE_NOT_FOUND`, `DOC_SEQ_TYPE_INACTIVE`, `DOC_SEQ_NOT_GENERAL`, `DOC_SEQ_SCOPE_MISMATCH`, `DOC_SEQ_TENANT_MISMATCH` |
| `fn_sys_doc_seq_next` | `(p_doc_type text, p_at timestamptz DEFAULT now())` | same | code | same, minus tenant |
| `fn_hq_doc_seq_next` | `(p_doc_type text, p_at timestamptz DEFAULT now())` | same | code | same, minus tenant |
| `fn_doc_seq_assign_code` | trigger; `TG_ARGV[0]`=doc type, `[1]`=column | DEFINER | `NEW` with the column filled if NULL/'' | from `*_next` |
| `fn_doc_seq_guard_immutable` | trigger; `TG_ARGV[0]`=column | INVOKER | blocks the change | `DOC_SEQ_CODE_IMMUTABLE` |

**Design details to confirm (A-05):**
1. `fn_doc_seq_format` takes an extra optional `p_fy_start`. With `reset_policy = FISCAL_YEAR`, the `YYYY` / `YY` tokens must print the **fiscal** year. If they printed the calendar year, a counter that resets in April would produce `X-2027-000001` in April 2027 after `X-2027-000400` was already issued in January 2027 under FY2026, which is a collision.
2. `fn_doc_seq_next` returns the formatted code, not the raw number. That way callers and the trigger can't format differently.
3. Three extra descriptive tokens/values exist only so non-GENERAL rows can be registered: `PARENT` (derived child codes), `RAND` (POS random part) and `reset_policy = PER_PARENT`. The formatter rejects them, and the CHECK that pairs format with reset is enforced only for `GENERAL` rows.

### 4.3 Module and file layout (new and changed files)

**Tenant repo — DB** (`supabase/migrations/`, numbers TO VERIFY at write time)

```
0664_sys_platform_scope_modules.sql     sys_saas_scope_cd, sys_modules_cd, sys_module_sub_systems_cd (+ PROPOSED seed)
0665_doc_seq_type_config.sql            sys_doc_seq_category_cd, sys_doc_seq_manage_level_cd, sys_doc_seq_type_cd (+ PROPOSED seed)
0666_hq_general_config.sql              hq_general_config (+ seed row, tz trigger), org_tenants_mst.fiscal_year_start_month
0667_doc_seq_counters.sql               org_doc_seq_mst, sys_doc_seq_mst, hq_doc_seq_mst (RLS, grants)
0668_doc_seq_engine_fns.sql             period_key, format, 3× next, assign trigger fn, guard fn, fn_doc_seq_full_size
0669_doc_seq_consistency.sql            vw_doc_seq_consistency, fn_doc_seq_consistency_data()
0670_doc_seq_code_tables_registry.sql   register the 5 lookups (+ sys_doc_seq_type_cd read-only) in sys_code_tables_registry
0671_ord_order_no_engine.sql            counter seed, generate_order_number wrapper, triggers, revoke, helpers, fn_ord_next_sub_order_no
0672_ord_item_srno_barcode.sql          fn_next_order_item_srno new body, UNIQUE srno, item barcode value backfill + CHECK
0673_ord_piece_code_human.sql           piece_code DROP EXPRESSION, trigger, backfill, UNIQUE, guard, barcode partial UNIQUE
0687_fin_store_credit_note_scn.sql      SCN trigger + guard on org_credit_notes_mst.credit_note_no
0688_hq_doc_seq_permissions.sql         HQ permissions only (A-54: no role grant; A-09: no tenant ones)
0689_ord_label_image_cols_deprecated.sql  DEPRECATED comment on org_orders_mst.qr_code / barcode (A-48, A-56)
(skipped) navigation_doc_seq          HQ nav entries (+ tenant sys_components_cd only if A-11)
                                        P0: HQ nav is a code edit in platform-web/components/layout/sidebar.tsx and A-11 adds no tenant page,
                                        so `navigation_doc_seq` is SKIPPED (A-22)
(done in 0684) ff_human_codes          hq_ff_feature_flags_mst row human_codes_scan_labels (A-14)
```

**Tenant repo: web-admin** (paths follow the existing `lib/services`, `lib/validations`, `src/ui`, `src/features` layout)

```
lib/services/doc-seq/
  doc-seq-config.repository.ts     read sys_doc_seq_type_cd (cached, read-only)
  doc-seq-config.service.ts        getType(code), listByTargetTable(); no generation
lib/services/order-numbering/
  order-number.service.ts          generateWithTx(tx, tenantId) → SELECT generate_order_number; nextSubOrderNoWithTx(tx, tenantId, parentId)
  order-number.repository.ts       raw SQL calls (Prisma $queryRaw), tenant-scoped lookups by order_no
lib/services/piece-code/
  piece-code.service.ts            getByCode, linkExternalTag(pieceId, tag), unlinkExternalTag; generation stays in DB
  piece-code.repository.ts
lib/services/labels/
  label-data.service.ts            buildOrderLabelData(orderId), buildPieceTagData(pieceIds) → values only (no images)
  cmx-code-payload.ts              encode/decode CMX1:<type_prefix>:<code> (pure, shared by web, cmx-api, mobile)
lib/services/scan-resolve/
  scan-resolve.service.ts          resolve(tenantId, raw, context?) → typed result
  scan-resolve.repository.ts       indexed lookups: order_no, order_item_srno, piece_code, piece barcode
lib/validations/code-format-schemas.ts   zod: orderNo, subOrderNo, itemSrno, pieceCode, externalTag, cmxPayload, scanInput
lib/utils/barcode/code128.ts       real CODE128 SVG renderer (wraps the approved library, A-07)
lib/utils/order-number-generator.ts  → deprecated shim re-exporting order-numbering (one release), then removed
lib/utils/barcode-generator.ts       → generateQRCode/decodeQRCode/isValidQRCodeData removed; generateBarcode → shim to code128 then removed
src/ui/data-display/cmx-code-chip.tsx         (new reusable)
src/ui/forms/cmx-code-search-input.tsx        (new reusable)
src/ui/forms/cmx-scan-input.tsx               (new reusable) + src/ui/hooks/use-keyboard-wedge.ts (placement TO VERIFY)
src/ui/print/cmx-label-renderer.tsx           (new reusable; folder TO VERIFY vs existing print helpers)
src/features/scan/                            global scan dialog + result router (api/, hooks/, ui/)
src/features/labels/                          order label + piece tag print views (ui/), print hook
app/api/v1/scan/resolve/route.ts              POST (new)
app/api/v1/orders/lookup/route.ts             GET ?code= (new)
app/api/v1/orders/pieces/lookup/route.ts      GET ?code= (new)
app/api/v1/orders/pieces/[pieceId]/external-tag/route.ts   PUT / DELETE (new; UUID write route)
app/api/v1/orders/[id]/label-data/route.ts    GET (new)
app/api/v1/orders/[id]/items/[itemId]/pieces/scan/route.ts  refactored → ScanResolveService (contract unchanged)
```

**HQ repo: platform-api** (`src/modules/`, NestJS pattern as in `ops-config` / `core-data`)

```
doc-seq-config/
  doc-seq-config.module.ts · doc-seq-config.controller.ts · doc-seq-config.service.ts · doc-seq-config.repository.ts
  doc-seq-consistency.service.ts   (calls vw_doc_seq_consistency + fn_doc_seq_consistency_data)
  dto/ list-doc-seq-types.query.dto.ts · doc-seq-type.response.dto.ts (includes `implementDescription`) · doc-seq-preview.query.dto.ts · consistency.response.dto.ts
  __tests__/ *.spec.ts
general-config/
  general-config.module.ts · general-config.controller.ts · general-config.service.ts · general-config.repository.ts
  dto/ general-config.response.dto.ts · update-general-config.dto.ts
  __tests__/ *.spec.ts
core-data/  (reused unchanged; the new lookups appear via sys_code_tables_registry rows)
```

**HQ repo: platform-web** (`src/features/<feature>/{api,hooks,model,ui}`)

```
src/features/doc-seq-config/  api/doc-seq-config-api.ts · hooks/use-doc-seq-types.ts, use-doc-seq-consistency.ts
                              model/doc-seq.types.ts · ui/doc-seq-types-screen.tsx, doc-seq-type-drawer.tsx,
                              doc-seq-consistency-screen.tsx, doc-seq-format-preview.tsx
src/features/general-config/  api/ · hooks/use-general-config.ts · model/ · ui/general-config-screen.tsx
app/(dashboard)/system-codes/doc-seq-types/page.tsx
app/(dashboard)/system-codes/doc-seq-consistency/page.tsx
app/settings/general-config/page.tsx          (placement TO VERIFY with check-placement skill)
src/ui/data-display/cmx-code-chip.tsx         (HQ copy via create-cmx-component, A-15 on sharing)
messages/{en,ar}/doc-seq-config/*.json, messages/{en,ar}/general-config/*.json  (tree catalog, i18n:split)
```

---

## 5. Database layer (each migration, in order)

**Common to every file**
- Header: Migration / Purpose / Affected / Related / Plan / APPLY ORDER / ROLLBACK PLAN / Apply note. There is no applied-status line.
- Body: `BEGIN; SET LOCAL lock_timeout = '10s'; … COMMIT;`.
- `COMMENT ON` every table, column (including audit columns), function, trigger, index and constraint.
- `DROP … RESTRICT` only; `CASCADE` is never used. Names are ≤ 30 chars. There are no DEFAULTs on timezone, currency or country columns.
- Audit columns as the standard: `created_at, created_by, created_info, updated_at, updated_by, updated_info, rec_status, rec_order, rec_notes, is_active`.
- `sys_*` lookup columns: `code` PK (or the named code column), `name, name2, description, description2, display_order, is_active` plus audit columns.
- The RLS pattern for global `sys_*_cd` follows `0575` (**VERIFIED in P1**): RLS on, one `SELECT` policy for `authenticated` on active, live rows (`is_active AND rec_status = 1`), `REVOKE ALL … FROM PUBLIC, anon`, `GRANT ALL … TO service_role`, `updated_at` trigger `trg_set_updated_at()`, seeds with `created_by = 'migration'`.
- **File names:** `NNNN_<name>.sql`, where NNNN is assigned at creation time (rule 3). The names below are the stable references.
- **As built in P1 (2026-10-30):** every doc type is seeded as `DOMAIN` first (DOMAIN-first), including ORDER and STORE_CREDIT_NOTE. P2 and P5 switch them to `GENERAL` in the same migration that seeds the counters and adds the triggers, so nothing changes on apply of P1.

### 5.1 `scope_modules` (number assigned at creation time: `0666_sys_platform_scope_modules.sql`)
- **Tables:**
  - `sys_saas_scope_cd(scope_code PK, short_code)`, seeded TENANT_ORG (ORG), SYS (SYS), HQ (HQ).
  - `sys_modules_cd(module_code PK, short_code, scope_code FK → sys_saas_scope_cd ON DELETE RESTRICT)`.
  - `sys_module_sub_systems_cd(module_code FK → sys_modules_cd ON DELETE RESTRICT, sub_system_code, short_code, PK (module_code, sub_system_code))`.
- **`short_code`** (user change 2026-10-30; length 2-5 per A-27): `TEXT NOT NULL`, CHECK `^[A-Z]{2,5}$`, `UNIQUE` in each of the three tables (`uq_saas_scope_short`, `uq_modules_short`, `uq_mod_subsys_short`). Used alone in screens, logs and compact labels.
- **CHECKs:** codes `^[A-Z][A-Z0-9_]{1,29}$`.
- **Seed (APPROVED 2026-10-30, §20.1):** 3 scopes, 35 modules (tenant ORG modules incl. the shared ones AUTH, RBAC, NTF, SETTINGS, AUDIT, REPORTS, INTEGRATIONS, BRANCHES, WORKFLOW; SYS modules CORE, CURRENCY; HQ-only modules HQ_TENANTS, HQ_BILLING, HQ_PLANS, HQ_OPS, HQ_SUPPORT, HQ_CRM and the HQ copies of auth, RBAC, notifications, settings, audit, core data, flags, developer portal), 67 sub-systems. Journals belong to **ERP** (`ERP/JOURNAL`).
- **Rollback:** `DROP TABLE … RESTRICT` in reverse order. It fails safely if `doc_seq_type_config` already references them.

### 5.2 `doc_seq_type_config` (number assigned at creation time: `0667_doc_seq_type_config.sql`)
- **Lookup tables:**
  - `sys_doc_seq_category_cd`: CATALOG, MASTER_DATA, TRANSACTION.
  - `sys_doc_seq_manage_level_cd`: GENERAL, DOMAIN, MANUAL, NONE.
- **`sys_doc_seq_type_cd`:** columns as in proposal §4, plus:

As built (copied from the `doc_seq_type_config` migration; the migration file is the source of truth):

```sql
CREATE TABLE public.sys_doc_seq_type_cd (
  doc_type_code         TEXT     NOT NULL,           -- Stored doc type value, e.g. ORDER.
  name                  TEXT     NOT NULL,           -- English display name.
  name2                 TEXT,                        -- Arabic display name.
  description           TEXT,                        -- English description.
  description2          TEXT,                        -- Arabic description.
  scope_code            TEXT     NOT NULL,           -- Who owns the numbered data (FK sys_saas_scope_cd).
  category_code         TEXT     NOT NULL,           -- FK sys_doc_seq_category_cd.
  module_code           TEXT     NOT NULL,           -- Owning module (FK with sub_system_code).
  sub_system_code       TEXT     NOT NULL,           -- Owning sub-system.
  target_table          TEXT     NOT NULL,           -- Table that stores the code.
  target_column         TEXT     NOT NULL,           -- Column that stores the code.
  is_unique             BOOLEAN  NOT NULL DEFAULT true,  -- Code must be unique within unique_with.
  unique_with           TEXT[],                      -- Columns that scope uniqueness, e.g. {tenant_org_id}.
  prefix                TEXT,                        -- Printed prefix (NULL = none / varies).
  type_prefix           TEXT     NOT NULL,           -- Reserved unique 3-5 letter key of the type.
  separator             TEXT     NOT NULL DEFAULT '-',  -- Printed separator between parts.
  parts_format          TEXT     NOT NULL,           -- Tokens joined by '-', e.g. YYYYMMDD-SEQ.
  how_many_parts        SMALLINT GENERATED ALWAYS AS (cardinality(string_to_array(parts_format, '-'))::SMALLINT) STORED,  -- Token count.
  seq_pad_length        SMALLINT NOT NULL DEFAULT 6,   -- Minimum SEQ width (grows, never truncates).
  full_size             SMALLINT GENERATED ALWAYS AS (public.fn_doc_seq_full_size(prefix, separator, parts_format, seq_pad_length)) STORED,  -- Minimum printed length.
  reset_policy          TEXT,                        -- When the counter restarts.
  manage_by_level       TEXT     NOT NULL,           -- FK sys_doc_seq_manage_level_cd.
  managed_by_object     TEXT,                        -- DOMAIN/MANUAL owner: function signature, table, or app:<path>.
  allow_tenant_override BOOLEAN  NOT NULL DEFAULT false,  -- Reserved, always false.
  strict_no_gaps        BOOLEAN  NOT NULL DEFAULT false,  -- Documented need for gap-free numbers.
  implement_description TEXT     NOT NULL,           -- How it works, step by step, for HQ support.
  display_order         INTEGER  NOT NULL DEFAULT 0, -- Order in lists.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_sys_doc_seq_type_cd PRIMARY KEY (doc_type_code),
  CONSTRAINT ck_doc_seq_type_code CHECK (doc_type_code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  CONSTRAINT fk_doc_seq_type_scope FOREIGN KEY (scope_code)
    REFERENCES public.sys_saas_scope_cd (scope_code) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_seq_type_cat FOREIGN KEY (category_code)
    REFERENCES public.sys_doc_seq_category_cd (category_code) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_seq_type_level FOREIGN KEY (manage_by_level)
    REFERENCES public.sys_doc_seq_manage_level_cd (manage_level_code) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_seq_type_subsys FOREIGN KEY (module_code, sub_system_code)
    REFERENCES public.sys_module_sub_systems_cd (module_code, sub_system_code) ON DELETE RESTRICT,
  CONSTRAINT ck_doc_seq_target CHECK (target_table ~ '^[a-z][a-z0-9_]{0,62}$' AND target_column ~ '^[a-z][a-z0-9_]{0,62}$'),
  CONSTRAINT ck_doc_seq_separator CHECK (separator IN ('-', '/', '')),
  CONSTRAINT ck_doc_seq_parts CHECK (parts_format ~ '^((YYYY|YY|YYYYMM|YYMM|YYYYMMDD|BR|PARENT|RAND)-)*(SEQ|RAND|PARENT)$'),
  CONSTRAINT ck_doc_seq_pad CHECK (seq_pad_length BETWEEN 0 AND 12),
  CONSTRAINT ck_doc_seq_reset CHECK (reset_policy IS NULL OR reset_policy IN ('NEVER','YEARLY','MONTHLY','DAILY','FISCAL_YEAR','PER_PARENT')),
  CONSTRAINT ck_doc_seq_tprefix CHECK (type_prefix ~ '^[A-Z]{3,5}$'),
  CONSTRAINT uq_doc_seq_type_tprefix UNIQUE (type_prefix),
  CONSTRAINT ck_doc_seq_gen_tprefix CHECK (manage_by_level <> 'GENERAL' OR type_prefix = prefix),
  CONSTRAINT ck_doc_seq_general_shape CHECK (manage_by_level <> 'GENERAL' OR (
        prefix IS NOT NULL AND seq_pad_length >= 1
    AND parts_format ~ '^((YYYY|YY|YYYYMM|YYMM|YYYYMMDD|BR)-)*SEQ$'
    AND reset_policy IS NOT NULL AND reset_policy <> 'PER_PARENT'
    AND (reset_policy <> 'NEVER'   OR parts_format !~ '(YYYY|YY|YYMM|YYYYMM|YYYYMMDD)')
    AND (reset_policy NOT IN ('YEARLY','FISCAL_YEAR') OR parts_format ~ '(^|-)(YYYY|YY)(-|$)')
    AND (reset_policy <> 'MONTHLY' OR parts_format ~ '(^|-)(YYYYMM|YYMM)(-|$)')
    AND (reset_policy <> 'DAILY'   OR parts_format ~ '(^|-)YYYYMMDD(-|$)'))),
  CONSTRAINT ck_doc_seq_prefix CHECK (prefix IS NULL
        OR (manage_by_level =  'GENERAL' AND prefix ~ '^[A-Z]{3,5}$')
        OR (manage_by_level <> 'GENERAL' AND prefix ~ '^[A-Z][A-Z0-9-]{0,11}$')),
  CONSTRAINT ck_doc_seq_managed_obj CHECK (manage_by_level = 'GENERAL' OR managed_by_object IS NOT NULL),
  CONSTRAINT ck_doc_seq_unique_with CHECK (is_unique OR unique_with IS NULL),
  CONSTRAINT ck_doc_seq_override_off CHECK (allow_tenant_override = false),
  CONSTRAINT ck_doc_seq_impl_desc CHECK (btrim(implement_description) <> '')
);
CREATE UNIQUE INDEX uq_doc_seq_type_target ON public.sys_doc_seq_type_cd (target_table, target_column)
  WHERE manage_by_level = 'GENERAL';
CREATE UNIQUE INDEX uq_doc_seq_type_prefix ON public.sys_doc_seq_type_cd (prefix)
  WHERE manage_by_level = 'GENERAL' AND prefix IS NOT NULL;
```

- **`fn_doc_seq_full_size`:** an IMMUTABLE SQL helper, created first in this file. It sums the prefix, the separators, the token widths (YYYY 4, YY 2, YYYYMM 6, YYMM 4, YYYYMMDD 8, BR TO VERIFY, PARENT/RAND NULL) and the padding.
- **Sub-orders** share `org_orders_mst.order_no` with ORDER. Because of `UNIQUE(target_table, target_column)` they **don't get their own row**: the ORDER row's description documents the `-S<n>` suffix and `fn_ord_next_sub_order_no`.
- **RLS:** RLS is on, with `SELECT` for `authenticated` (format config isn't secret and the tenant app's validators need it). Writes are `service_role` only. An `updated_at` trigger uses the project's standard function (**VERIFIED in P0: `public.trg_set_updated_at()`**; the older `update_updated_at_column()` is not used for new tables).
- **`type_prefix`** (user change 2026-10-30): every doc type has a reserved `type_prefix`, 3-5 capital letters, `NOT NULL`, unique across **all** rows (`uq_doc_seq_type_tprefix`). It is the stable key of the type (scan payload `CMX1:<type_prefix>:<code>`, logs, screens). GENERAL rows print it (`ck_doc_seq_gen_tprefix`: `type_prefix = prefix`). DOMAIN rows keep their own printed `prefix` (which may be shared, e.g. `CN`, `INV`, so the printed-prefix index stays partial, GENERAL-only); child codes (ORDER_ITEM `ITM`, ORDER_PIECE `PEC`) keep their own value format and print no prefix (`prefix` NULL). `implement_description` (NOT NULL, non-blank) states how the code is made today and what the `type_prefix` is used for.
- **Seed:** the 51 rows **APPROVED 2026-10-30** in §20.2 (from proposal §11.8 plus inventory additions; `STOCK_TRANSACTION` added in P1). Every seeded row gets an `implement_description`: the generator function, the counter table and key, the trigger, the period rule, and a sample SQL to check the current counter. For DOMAIN/MANUAL rows it names the owning service or table. A DB test (§14.2) fails if any active row has it empty.
- **Rollback:** drop in reverse order (RESTRICT).

### 5.3 `hq_general_config` (number assigned at creation time: `0668_hq_general_config.sql`; HQ defaults + per-tenant locale and fiscal columns)

**Decided 2026-10-30 (A-03):** seven general values live as real columns in **both** `hq_general_config` (platform default) and `org_tenants_mst` (each tenant's own value). **Resolution rule:** the tenant value if set, otherwise the HQ default. Shared helper `fn_tenant_general_value(p_tenant_id, p_key)` and the TS `TenantGeneralConfigService` apply that rule; nothing else reads the columns directly.

| Value | `hq_general_config` (NOT NULL default) | `org_tenants_mst` (NULL = use HQ default) | Replaces deactivated setting (0652) |
|---|---|---|---|
| Current fiscal year | `current_fiscal_year TEXT` e.g. `FY2026` or `2026-2027` | `current_fiscal_year TEXT` (new) | — |
| Fiscal year start month | `fiscal_year_start_month SMALLINT` 1–12 | `fiscal_year_start_month SMALLINT` 1–12 (new) | `ERP_LITE_FISCAL_YEAR_START` |
| Date format | `date_format TEXT` | existing `date_format VARCHAR(20)` (0039; P0 S1, not new) | `TENANT_DATE_FORMAT` |
| Time format | `time_format TEXT` `24h` / `12h` (lowercase, P0 S1) | existing `time_format VARCHAR(5)` (0039; not new) | `TENANT_TIME_FORMAT` |
| First day of week | `first_day_of_week SMALLINT` 0–6 (0 = Sunday … 6 = Saturday, as the HQ DTO) | existing `first_day_of_week INTEGER` (0039; not new) | `TENANT_FIRST_DAY_OF_WEEK` |
| Language | `default_language_code TEXT` → `sys_language_cd` | existing `language VARCHAR(10)` (**P0: found; reused**, no `language_code`) | `TENANT_LANGUAGE` |
| Locale | `locale_code TEXT` BCP 47, e.g. `en-US`, `ar-OM` | `locale_code VARCHAR(10)` (new; **P0: no existing locale column**) | `TENANT_LOCALE` |
| Time zone | `timezone TEXT` | existing `timezone VARCHAR(50)` (kept, 0001) | `SYS_TIMEZONE` |

- **Not added:** `UI_RTL_ENABLED` (direction follows the language). The other 17 settings deactivated by 0652 are feature settings with no consumer; they stay deactivated in `sys_tenant_settings_cd`, untouched, and are **not** copied anywhere.
- **The seven old setting rows stay** (`is_active = false`, nothing deleted). Each gets `COMMENT`/`updated_info` text pointing to its new column, so nobody reactivates them and creates two sources of truth.
- **Same CHECKs in both tables** (shared domain-style checks, one definition each): `current_fiscal_year ~ '^(FY)?[0-9]{4}(-[0-9]{4})?$'`, `date_format IN ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY')` (**P0 VERIFIED:** same list as the HQ DTO `update-tenant-locale-settings.dto.ts`; preflight existing values with INVENTORY.md §9 Q8), `time_format IN ('24h','12h')`, `first_day_of_week BETWEEN 0 AND 6`, `locale_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'`; time zones validated by the cheap `AT TIME ZONE` test trigger (see below), on both tables.
- **`current_fiscal_year` vs `fiscal_year_start_month`:** the start month drives the code generator's `FISCAL_YEAR` period key (computed from the local date). `current_fiscal_year` is the label shown and used by finance/reports. A consistency check in `vw_doc_seq_consistency` flags a tenant whose label disagrees with the computed fiscal year. Rolling it over each year is the finance domain's job (out of scope here; noted as a follow-up).

**P0 correction (2026-10-30, `INVENTORY.md` S1–S3):** three of the "new" tenant columns already exist with NOT NULL-style defaults (`DD/MM/YYYY`, `24h`, `6`), so every existing tenant already has a value. `hq_general_config` therefore (a) adds only the three missing columns, (b) runs a preflight that the existing values pass the CHECKs (Q8) and (c) **drops the defaults** on the three existing columns (APPROVED 2026-10-30; verified safe in P1: the columns are nullable and every reader already falls back) so that *new* tenants inherit HQ; existing rows keep their values. HQ's existing tenant locale service and DTO are extended (no second endpoint). The seed uses the wizard values (OMR, 30 trial days).

```sql
ALTER TABLE org_tenants_mst
  ADD COLUMN current_fiscal_year     TEXT     NULL,
  ADD COLUMN fiscal_year_start_month SMALLINT NULL,
  ADD COLUMN locale_code             VARCHAR(10) NULL;   -- P0: no existing locale column
  -- P0 S1: date_format / time_format / first_day_of_week / language already exist (0039) and are NOT added.
  -- Recommended (A-21): ALTER COLUMN date_format DROP DEFAULT, time_format DROP DEFAULT, first_day_of_week DROP DEFAULT
  -- + the CHECK constraints listed above (ck_tenants_*)

CREATE TABLE hq_general_config (
  config_id               BOOLEAN PRIMARY KEY DEFAULT true CONSTRAINT ck_hq_gen_cfg_single CHECK (config_id),
  default_currency_code   TEXT NOT NULL REFERENCES sys_currency_cd (code) ON DELETE RESTRICT,
  default_country_code    TEXT NOT NULL REFERENCES sys_country_cd (code) ON DELETE RESTRICT,
  default_language_code   TEXT NOT NULL REFERENCES sys_language_cd (code) ON DELETE RESTRICT,
  locale_code             TEXT NOT NULL,
  timezone                TEXT NOT NULL,
  current_fiscal_year     TEXT NOT NULL,
  fiscal_year_start_month SMALLINT NOT NULL,
  date_format             TEXT NOT NULL,
  time_format             TEXT NOT NULL,
  first_day_of_week       SMALLINT NOT NULL,
  default_vat_rate        NUMERIC(5,2) NOT NULL CHECK (default_vat_rate BETWEEN 0 AND 100),
  support_email           TEXT NULL CHECK (support_email IS NULL OR support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  support_phone           TEXT NULL CHECK (support_phone IS NULL OR support_phone ~ '^\+[1-9][0-9]{6,14}$'),  -- E.164
  default_trial_days      SMALLINT NOT NULL CHECK (default_trial_days BETWEEN 0 AND 365)
  /* + the shared CHECKs above + audit columns */
);
INSERT INTO hq_general_config (config_id, default_currency_code, default_country_code, default_language_code,
  locale_code, timezone, current_fiscal_year, fiscal_year_start_month, date_format, time_format,
  first_day_of_week, default_vat_rate, default_trial_days, created_info)
VALUES (true, 'OMR', 'OM', 'en', 'en-OM', 'Asia/Muscat', 'FY2026', 1,
  'DD/MM/YYYY', '24h', 6 /* Saturday */, 5.00, 30, 'hq_general_config seed');  -- P0 PROPOSED values (§20.4 A-21); were USD/en-US/YYYY-MM-DD/24H/0/14
```

- **Backfill:** existing tenants keep NULL in the new columns (they inherit the HQ defaults), so nothing changes for them on deploy. The seed values above are approved in A-21.
- **Trigger `fn_hq_gen_cfg_validate()`** (and the same check on `org_tenants_mst.timezone` when changed) runs BEFORE INSERT/UPDATE and raises `HQ_CONFIG_BAD_TIMEZONE` if `now() AT TIME ZONE NEW.timezone` fails.
- **Delete protection:** `REVOKE DELETE ON hq_general_config FROM PUBLIC, anon, authenticated, service_role`, plus a BEFORE DELETE guard, so the single row can't vanish.
- **RLS:** RLS on with **no** policy for `anon` / `authenticated`; only `service_role` reads it (HQ API, server only); engine functions read it as definer. Tenant columns follow the existing `org_tenants_mst` policies.
- **Consumers (wired in later phases):** the code engine (time zone, fiscal start), `TenantGeneralConfigService` (web-admin formatting: date, time, first day of week, locale), the HQ tenant wizard prefill (A-13), and `GET /hq/general-config`.
- **Rollback:** drop the trigger, then the table (RESTRICT), then drop the new `org_tenants_mst` columns (RESTRICT). Roll back `doc_seq_engine_fns` first, because its functions read these.

### 5.4 `doc_seq_counters` (number assigned at creation time: `0669_doc_seq_counters.sql`)
- **`org_doc_seq_mst`**
  - Columns: `tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE RESTRICT`, `doc_type_code TEXT NOT NULL REFERENCES sys_doc_seq_type_cd ON DELETE RESTRICT`, `period_key TEXT NOT NULL DEFAULT ''`, `last_value BIGINT NOT NULL CHECK (last_value >= 0)` and `prefix_override TEXT NULL` (reserved; CHECK `IS NULL`), plus audit columns.
  - `PRIMARY KEY (tenant_org_id, doc_type_code, period_key)`.
  - `fillfactor = 70`, for HOT updates on hot counter rows.
- **`sys_doc_seq_mst` / `hq_doc_seq_mst`:** the same without the tenant, `PK (doc_type_code, period_key)`.
- **RLS:** RLS is on for all three. There's no policy for `anon` / `authenticated`, and `REVOKE ALL … FROM PUBLIC, anon, authenticated`. Only the definer functions write. `service_role` gets `SELECT` for the consistency checks and HQ.
- **Tenant hard-delete paths (T1.9, VERIFIED in P1: no change needed):**
  - `0465` deletes no tenants. Tenant cleanup **never resets or deletes counters** (APPROVED 2026-10-30): a reused number would collide with printed labels and receipts.
  - The only hard delete of a tenant is the signup rollback in `web-admin/lib/services/tenants.service.ts` (lines ~248/272). It runs before any number is issued, so the `ON DELETE RESTRICT` FK can't block it in P1. When signup starts creating GENERAL-coded rows (P2+), that rollback must delete the tenant's `org_doc_seq_mst` rows first.
- **Rollback:** drop the three tables (RESTRICT).

### 5.5 `doc_seq_engine_fns` (number assigned at creation time: `0670_doc_seq_engine_fns.sql`; sketch, see the file for the built version)

```sql
CREATE OR REPLACE FUNCTION fn_doc_seq_period_key(p_reset TEXT, p_at TIMESTAMPTZ, p_tz TEXT, p_fy_start SMALLINT)
RETURNS TEXT LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_local TIMESTAMP := p_at AT TIME ZONE p_tz; v_fy INT;
BEGIN
  CASE p_reset
    WHEN 'NEVER'   THEN RETURN '';
    WHEN 'YEARLY'  THEN RETURN to_char(v_local, 'YYYY');
    WHEN 'MONTHLY' THEN RETURN to_char(v_local, 'YYYYMM');
    WHEN 'DAILY'   THEN RETURN to_char(v_local, 'YYYYMMDD');
    WHEN 'FISCAL_YEAR' THEN
      v_fy := extract(year FROM v_local)::INT
              - CASE WHEN extract(month FROM v_local) < COALESCE(p_fy_start, 1) THEN 1 ELSE 0 END;
      RETURN 'FY' || v_fy;
    ELSE RAISE EXCEPTION 'DOC_SEQ_BAD_RESET: %', p_reset;
  END CASE;
END $$;

-- fn_doc_seq_format: loops string_to_array(parts_format,'-'); date tokens from v_local (fiscal year when FISCAL_YEAR);
-- SEQ = CASE WHEN length(p_value::text) >= pad THEN p_value::text ELSE lpad(p_value::text, pad, '0') END  -- never truncates
-- BR/PARENT/RAND → RAISE 'DOC_SEQ_TOKEN_NOT_ENABLED'; result = prefix || separator || array_to_string(parts, separator)

CREATE OR REPLACE FUNCTION fn_doc_seq_next(p_tenant UUID, p_doc_type TEXT, p_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r sys_doc_seq_type_cd; v_tz TEXT; v_fy SMALLINT; v_key TEXT; v_val BIGINT; v_role TEXT;
BEGIN
  -- 1. caller check: JWT role 'authenticated' must belong to p_tenant; service_role / server (no JWT) allowed
  v_role := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  IF v_role = 'authenticated' AND p_tenant IS DISTINCT FROM (SELECT public.current_tenant_id()) THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  ELSIF v_role NOT IN ('', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;
  -- 2. config row
  SELECT * INTO r FROM sys_doc_seq_type_cd WHERE doc_type_code = p_doc_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOC_SEQ_TYPE_NOT_FOUND: %', p_doc_type; END IF;
  IF NOT r.is_active THEN RAISE EXCEPTION 'DOC_SEQ_TYPE_INACTIVE: %', p_doc_type; END IF;
  IF r.manage_by_level <> 'GENERAL' THEN RAISE EXCEPTION 'DOC_SEQ_NOT_GENERAL: %', p_doc_type; END IF;
  IF r.scope_code <> 'TENANT_ORG' THEN RAISE EXCEPTION 'DOC_SEQ_SCOPE_MISMATCH: %', p_doc_type; END IF;
  -- 3. tenant time zone (fallback hq_general_config), fiscal start
  SELECT t.timezone, t.fiscal_year_start_month INTO v_tz, v_fy FROM org_tenants_mst t WHERE t.id = p_tenant;
  BEGIN                                     -- cheap validity test (pg_timezone_names scan is ms-slow; see §11)
    PERFORM p_at AT TIME ZONE v_tz;
    IF v_tz IS NULL THEN RAISE invalid_parameter_value; END IF;
  EXCEPTION WHEN invalid_parameter_value OR null_value_not_allowed THEN
    SELECT timezone INTO v_tz FROM hq_general_config WHERE config_id;   -- fallback + WARN log in consistency data
  END;
  v_key := fn_doc_seq_period_key(r.reset_policy, p_at, v_tz, v_fy);
  -- 4. atomic increment (row lock held to end of tx; no MAX, no retry loop)
  INSERT INTO org_doc_seq_mst (tenant_org_id, doc_type_code, period_key, last_value, created_info)
  VALUES (p_tenant, p_doc_type, v_key, 1, 'fn_doc_seq_next')
  ON CONFLICT (tenant_org_id, doc_type_code, period_key)
  DO UPDATE SET last_value = org_doc_seq_mst.last_value + 1, updated_at = now()
  RETURNING last_value INTO v_val;
  RETURN fn_doc_seq_format(p_doc_type, v_val, p_at, v_tz, v_fy);
END $$;
```

- **Gaps (corrected in P1):** the increment is part of the caller's transaction, so a rolled-back insert gives its number back. Gaps appear only when a number is taken in a separate transaction or the document is deleted later.
- **Caller check (as built):** `current_tenant_id()` is membership-based (0563: `org_users_mst.user_id = auth.uid() AND is_active`), so an authenticated caller may only ask for a tenant it belongs to; anon is refused (`DOC_SEQ_TENANT_REQUIRED`/`DOC_SEQ_TENANT_MISMATCH`, SQLSTATE 42501). In P1 the engine is granted to `service_role` only anyway.
- **S5 (as built):** `fn_next_fin_doc_no` and `generate_cash_drawer_sess_no` are recreated with the same logic, `SET search_path = pg_catalog, public, pg_temp`, and EXECUTE for `service_role` only (pre-check Q11 + Q-N1 in the dev guide: the Prisma DB user must own them or be a member of `service_role`).
- **`fn_sys_doc_seq_next` / `fn_hq_doc_seq_next`:** the same steps without the tenant. The time zone and fiscal start come from `hq_general_config`, and they're callable only by `service_role` / server.
- **`fn_doc_seq_assign_code()`**
  - It's a definer function. It reads `v_cur := to_jsonb(NEW) ->> TG_ARGV[1]`.
  - If `v_cur IS NULL OR btrim(v_cur) = ''`, it dispatches on the row's `scope_code`: TENANT_ORG calls `fn_doc_seq_next(NEW.tenant_org_id, …)`; SYS and HQ call their own functions.
  - It sets the column with `NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[1], v_code))`.
  - A supplied value is kept, and the UNIQUE index enforces it.
- **`fn_doc_seq_guard_immutable()`:** if `OLD` has a non-empty value and `NEW` differs, it raises `DOC_SEQ_CODE_IMMUTABLE` (SQLSTATE `P0001`). An empty `OLD` may be filled once, which supports backfills. It's attached as `BEFORE UPDATE OF <column>`.
- **Perf revision (as built, 2026-10-30, before first apply; same signatures, errors and grants for the public functions):**
  - One read of `sys_doc_seq_type_cd` per number: `fn_doc_seq_type_get` returns the row; new internal `fn_doc_seq_next_by_row(tenant, row, at)` (owner only) and `fn_doc_seq_format_row(row, value, at, tz, fy)` take it. `fn_doc_seq_format(type, …)` is now a thin wrapper over `fn_doc_seq_format_row`; `fn_doc_seq_type_check(row, scope, type)` holds the shared checks (service_role).
  - `fn_doc_seq_assign_code` reads the config once (was 3 times) and does one `jsonb_populate_record`.
  - The JWT claim is parsed once; `current_tenant_id()` runs only for role `authenticated`.
  - Busy tables (P2 ORDER first) use a typed assign trigger plus a `WHEN (OLD.<col> IS DISTINCT FROM NEW.<col>)` guard (template in the `0670` header and DEV_GUIDE §12). The generic triggers stay for low-volume tables.
  - The counter row lock is held to COMMIT: numbering transactions must be short (DEV_GUIDE §13).
  - Load test (box, indicative): about 75 µs per number, 40k numbers/s across tenants, 5-7k/s on one hot counter row; 0 duplicates and 0 gaps under 10% rollbacks. Full table in DEV_GUIDE §14.
- **Grants:**
  - `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon` on every engine function.
  - `fn_doc_seq_format` and `fn_doc_seq_period_key` are granted to `authenticated, service_role`. They're pure; HQ preview uses them.
  - `fn_doc_seq_next`, `fn_sys_doc_seq_next` and `fn_hq_doc_seq_next` are granted to `service_role` only. The definer wrappers and triggers call them as owner.
  - `fn_doc_seq_format_row`: `authenticated, service_role` (pure). `fn_doc_seq_type_get`, `fn_doc_seq_type_check`: `service_role`. `fn_doc_seq_next_by_row`, `fn_doc_seq_caller_role` and the two trigger functions: owner only.
- **Rollback:** `DROP FUNCTION … RESTRICT` in reverse. That fails while triggers from `ord_order_no_engine` and later still exist, so roll those back first.

### 5.6 `doc_seq_consistency` (number assigned at creation time: `0671_doc_seq_consistency.sql`)
- **`vw_doc_seq_consistency`** (schema checks; `security_invoker = true`; `SELECT` to `service_role` only). Columns: `check_code, severity ('ERROR'|'WARN'), doc_type_code, object_name, detail`. Checks:
  - `TRG_NO_CONFIG`: a trigger using `fn_doc_seq_assign_code` (via `pg_trigger.tgfoid`, args decoded from `tgargs`) with no config row, or with a different doc type or column.
  - `CFG_TARGET_MISSING`: `target_table` / `target_column` not in `information_schema.columns`.
  - `GEN_NO_TRIGGER`: a GENERAL row with no assign trigger on its target, or no guard trigger.
  - `SCOPE_MISMATCH`: TENANT_ORG on a table without `tenant_org_id`, or SYS/HQ on a table with it.
  - `DOMAIN_OBJ_MISSING`: `managed_by_object` doesn't resolve to a function (`to_regprocedure` / `to_regproc`), table, or the literal `app:<path>` form (documented).
  - `FORMAT_RESET_MISMATCH`: a double check on the CHECK constraint.
  - `NO_UNIQUE_INDEX`: no unique index whose leading columns are `unique_with` + `target_column`.
  - `NOT_NULL_MISSING`: the target column is nullable.
  - `PREFIX_CLASH_DOMAIN`: a DOMAIN row's prefix appears in data owned by another type (WARN, sampled).
- **`fn_doc_seq_consistency_data()`** (definer, `service_role` only, dynamic SQL built from `quote_ident` over config rows only). For each row it returns `null_count`, `empty_count` and `dup_count` (per `unique_with`), plus `counter_behind`. `counter_behind` is true when `MAX(seq in data for a period) > counter.last_value`, which is computed for GENERAL rows only.
- **As built:** check codes `TRG_NO_CONFIG`, `GEN_NO_TRIGGER`, `TRG_GUARD_MISSING`, `CFG_TARGET_MISSING`, `DOMAIN_OBJ_MISSING`, `FORMAT_RESET_MISMATCH`, `TOKEN_NOT_ENABLED`, `SCOPE_MISMATCH`, `NO_UNIQUE_INDEX`, `NOT_NULL_MISSING`, `PREFIX_SHARED` (replaces `PREFIX_CLASH_DOMAIN`), `APP_OBJ_UNVERIFIED` (INFO, `app:` owners); severity `ERROR`/`WARN`/`INFO`.
- **Perf revision (as built, 2026-10-30, before first apply):** the view reads `pg_attribute` / `pg_index` / `pg_trigger` only for the configured target tables (52 ms → 4.6 ms with about 6.7k catalog relations). `GEN_NO_TRIGGER` also accepts a typed `BEFORE INSERT FOR EACH ROW` trigger whose function text has the type literal, `NEW.<column>` and a `*doc_seq_next(` call (test 11b). The data function skips the duplicate scan when a valid total unique index on `unique_with + column` proves there are none (all `unique_with` columns NOT NULL, or `NULLS NOT DISTINCT`), and runs the code regex once per row; about 20 s per 5M-row GENERAL table, so callers set `statement_timeout`.
- **Expected result** after each phase: 0 `ERROR` rows. WARN rows are listed in the report. After P1 (box run): WARN `PREFIX_SHARED` ×2 (CN-, INV-), `SCOPE_MISMATCH` (USER on `org_users_mst`), `NOT_NULL_MISSING` (cash drawer `session_no`); INFO `APP_OBJ_UNVERIFIED` ×39.
- **Rollback:** drop the view and the function.

### 5.7 `doc_seq_code_tables_registry` (number assigned at creation time: `0672_doc_seq_code_tables_registry.sql`)
- Insert rows into `sys_code_tables_registry` so HQ **Core Data Management** lists them, with no new lookup UI. The rows cover:
  - `sys_saas_scope_cd` and `sys_doc_seq_manage_level_cd` (`is_editable=false`, fixed sets).
  - `sys_modules_cd`, `sys_module_sub_systems_cd` and `sys_doc_seq_category_cd` (`is_editable=true`, `is_extensible=true`).
  - `sys_doc_seq_type_cd` (`is_editable=false` in this plan, so the dedicated screen shows it).
- Registry columns come from `platform-api/src/modules/core-data/interfaces/code-table.interface.ts` (TO VERIFY against the DB). `ON CONFLICT (table_name) DO NOTHING`.
- **P1 deviation (as built):** all six rows are `is_editable = false`, `is_extensible = false`, with `metadata.code_column` naming the real key column. The HQ generic Core Data screen assumes a column named `code`; these tables use `scope_code`, `module_code`, … so editing through it would fail. P8 adds `metadata.code_column` support to the screen, then the three extensible tables can be switched to editable.
- **Rollback:** `DELETE … WHERE table_name IN (…)`.

### 5.8 `ord_order_no_engine` (number assigned at creation time)
1. `LOCK TABLE org_orders_mst IN SHARE ROW EXCLUSIVE MODE;` blocks inserts only for the length of the migration (seconds; the lock_timeout guards it).
2. **Seed the counters from all existing data** (every tenant-day, not just today, so no past day can ever collide):

```sql
INSERT INTO org_doc_seq_mst (tenant_org_id, doc_type_code, period_key, last_value, created_info)
SELECT tenant_org_id, 'ORDER', split_part(order_no, '-', 2), MAX(split_part(order_no, '-', 3)::BIGINT), 'ord_order_no_engine seed'
FROM org_orders_mst
WHERE order_no ~ '^ORD-[0-9]{8}-[0-9]{4,}$'
GROUP BY tenant_org_id, split_part(order_no, '-', 2)
ON CONFLICT (tenant_org_id, doc_type_code, period_key)
DO UPDATE SET last_value = GREATEST(org_doc_seq_mst.last_value, EXCLUDED.last_value);
```

3. **Wrapper.** The signature, return type and grants are kept for back-compat. Only the body, the security settings and the grants change:

```sql
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_org_id UUID) RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RETURN fn_doc_seq_next(p_tenant_org_id, 'ORDER', now());   -- tenant check happens inside
END $$;
REVOKE ALL ON FUNCTION generate_order_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_order_number(UUID) TO authenticated, service_role;
```

4. **Triggers:**
   - `org_orders_mst` is a busy table, so it uses the **typed** pattern (DEV_GUIDE §12), not the generic `fn_doc_seq_assign_code`: `fn_ord_no_assign()` (definer, pinned `search_path`, owner only) sets `NEW.order_no := fn_doc_seq_next(NEW.tenant_org_id, 'ORDER', now())` only when NULL/''; `trg_ord_no_assign BEFORE INSERT ON org_orders_mst FOR EACH ROW EXECUTE FUNCTION fn_ord_no_assign()`.
   - `trg_ord_no_guard BEFORE UPDATE OF order_no ON org_orders_mst FOR EACH ROW WHEN (OLD.order_no IS DISTINCT FROM NEW.order_no) EXECUTE FUNCTION fn_doc_seq_guard_immutable('order_no')`.
   - `vw_doc_seq_consistency` accepts the typed trigger (`GEN_NO_TRIGGER` checks its function text for `'ORDER'` and `NEW.order_no`).
   - BEFORE-trigger order (alphabetical) relative to `oc_order_foundation_guard` and the others is checked in P0 (TO VERIFY).
5. **Grandfathered helpers:**
   - `ALTER FUNCTION get_order_number_prefix() STABLE`. A-06: drop it once P0 shows no callers.
   - `extract_order_sequence(text)` gets a new body: `substring(p_order_no FROM '^ORD-[0-9]{8}-([0-9]+)')::INT`, with no `SUBSTRING FROM 14`.
6. **`fn_ord_next_sub_order_no(p_tenant UUID, p_parent_order_id UUID) RETURNS TEXT`** (definer, same caller check):
   - `SELECT order_no … WHERE id = p_parent_order_id AND tenant_org_id = p_tenant FOR UPDATE` (parent row lock).
   - `n := COALESCE(MAX(substring(order_no FROM '-S([0-9]+)$')::INT), 0) + 1` over the rows `WHERE tenant_org_id = p_tenant AND parent_order_id = p_parent_order_id`, soft-deleted rows included.
   - **A-19 (approved): number under the root parent.** If the given parent is itself a sub-order, walk `parent_order_id` up to the root (bounded loop, max depth 10) and lock the root row instead; `n` is counted over all sub-orders of the root. So splitting `ORD-…-0007-S2` gives `ORD-…-0007-S3`, never `-S2-S1`. The new sub-order's `parent_order_id` stays the order it was split from (history kept), and a new `root_order_id` (or the existing equivalent found in P0) records the root.
   - It returns `root order_no || '-S' || n`. It errors with `ORD_PARENT_NOT_FOUND`, `ORD_SPLIT_DEPTH_EXCEEDED` or `DOC_SEQ_TENANT_MISMATCH`.
   - It's registered in the ORDER config row's description.
   - Grant: `authenticated, service_role`; revoke `PUBLIC, anon`.
7. **`COMMENT ON`** everything, including the updated function comments (remove "database sequence").
- **Rollback:** restore the 0012 bodies of `generate_order_number` / `extract_order_sequence` from the 0012 text, drop the two triggers and `fn_ord_next_sub_order_no`, and `DELETE FROM org_doc_seq_mst WHERE doc_type_code = 'ORDER'`. Data is untouched, so this is safe at any time.

### 5.8.1 P2.1: `ord_root_order_id` (`0677_ord_root_order_id.sql`) and `tenant_hard_delete_guard` (`0678_tenant_hard_delete_guard.sql`)

Written 2026-10-31 after the P2 review (user answers on A-28..A-30 and the two risks). Pre-apply checks, apply order and the safety test: DEV_GUIDE §16.

**`0677_ord_root_order_id` (A-28, user-approved column):**
1. `org_orders_mst.root_order_id UUID NULL`: NULL for a root order; the family root id for every sub-order, also a sub-order of a sub-order.
2. Keys: `fk_ord_root_order (root_order_id, tenant_org_id) → org_orders_mst (id, tenant_org_id) ON UPDATE RESTRICT ON DELETE SET NULL (root_order_id)` (PG15+ column list, so `tenant_org_id` is never nulled; Prisma-safe), `chk_ord_root_not_self`, partial index `idx_ord_root_order (tenant_org_id, root_order_id) WHERE root_order_id IS NOT NULL`.
3. Backfill from the `parent_order_id` chain (same tenant, depth ≤ 10, cycle-safe). A cross-tenant, missing, cyclic or too-deep chain stops the migration with `ORD_ROOT_BACKFILL_BAD_CHAIN` and the order ids (nothing is half-applied).
4. `trg_ord_root_guard` (BEFORE INSERT OR UPDATE OF `root_order_id`, `parent_order_id`): fills the root on INSERT from the parent (tenant-filtered; `ORD_PARENT_NOT_FOUND`), rejects a wrong root (`ORD_ROOT_MISMATCH`), a root that is itself a sub-order (`ORD_ROOT_NOT_ROOT`), any later change of the root (`ORD_ROOT_IMMUTABLE`, except the FK SET NULL path) and re-parenting into another family. Moving `parent_order_id` inside the same family or to NULL is allowed.
5. `fn_ord_next_sub_order_no` (same signature and grants): reads the root from `root_order_id` (no walk), locks the root `FOR UPDATE`, checks the family (`ORD_ROOT_INCONSISTENT`) and counts `-S<n>` over `WHERE tenant_org_id = … AND root_order_id = root` (index). `ORD_SPLIT_DEPTH_EXCEEDED` is no longer raised (depth no longer matters).
6. App: `order-split.service.ts` reads `parent_order_id, root_order_id` in the raw parent lock query, checks the new sub-order got the expected root before COMMIT, and writes `split_root_order_id` into sub-line metadata and `root_order_id` into the `SPLIT` history payload. Typed Prisma calls do not use the new column (works before and after `db pull`).

**`0678_tenant_hard_delete_guard` (risk 2, user rule "hard delete only in creating stage"; A-31):**
1. New tenant status `creating` (insert-only). `trg_tenant_hard_delete_guard` (BEFORE DELETE): only a `creating` tenant can be deleted; anything else, NULL included, fails closed with `TENANT_HARD_DELETE_BLOCKED` (SQLSTATE 55000). For an allowed delete the trigger removes the tenant's `org_doc_seq_mst` counters first (FK RESTRICT).
2. `trg_tenant_truncate_guard` (BEFORE TRUNCATE): always refused.
3. `trg_tenant_status_creating_guard` (BEFORE UPDATE OF status): no UPDATE can set `creating` (`TENANT_STATUS_CREATING_INSERT_ONLY`); leaving it is free.
4. App: web-admin `registerTenant` inserts `creating`, sets `trial` (`.eq('status','creating')`) when the subscription and the admin user exist, and its rollback deletes only a `creating` row (the app-side counter delete is gone). HQ `platform-api` refuses `creating` on create, update and status change with 409 `TENANT_STATUS_CREATING_INSERT_ONLY` and maps both DB codes to 409; HQ has no hard-delete endpoint (`DELETE /tenants/:id` archives). `platform-web` shows the status (EN "Creating" / AR "قيد الإنشاء") and can filter by it.

- **Rollback:** both headers carry a rollback plan (new forward migration). 0677 does not touch order numbers; 0678 changes no data.

### 5.8.2 P2.2: HQ tenant create uses `creating` (no migration; A-31 follow-up, A-32)
User decision 2026-10-31: tenants created from HQ also start in `creating`. `0678` already allows this (INSERT may set `creating`; only an UPDATE to it is refused; leaving it is free), so P2.2 is app-only.
1. `platform-api` `TenantsService.create` (the only HQ create path; both `POST /tenants` and `POST /tenants/create-with-initialization` use it; `platform-workers` and HQ scripts create no tenants) inserts `status = 'creating'` and remembers the requested status (`dto.status`, default `trial`).
2. Required steps: the tenant row, then the base currency (`TenantCurrencyProvisioningService.createBaseCurrency`). If the currency step throws, the `creating` row is hard-deleted (`.eq('status','creating')`; the 0678 trigger removes counters first) and the original error is thrown.
3. Then one UPDATE `creating → <requested>` guarded by `.eq('status','creating')`. If it fails, the row is rolled back the same way and the call fails with 500 `TENANT_CREATE_FINISH_FAILED`. The returned tenant is the final row.
4. Initialization (branches, categories, catalog, preferences) runs **after** the switch and stays best-effort with per-step results, exactly as before (A-32).
5. Callers still cannot ask for `creating` (409 `TENANT_STATUS_CREATING_INSERT_ONLY`, now worded "set only by the system while a tenant is being created"). `platform-web` needed no change: the wizard never offers `creating`, the list filter and EN/AR labels exist, and the detail page shows "Activate" for a stuck `creating` tenant (allowed status change).
6. If the rollback itself fails, it is logged and the row stays `creating` (risk R13, DEV_GUIDE §16 query).
7. The DB comments written by `0678` still say "self-signup"; they are refreshed in the next tenant migration (P3, `COMMENT ON` only; applied migrations are never edited). **Done in `0682` §8.**

### 5.9 `ord_item_srno_barcode` (number assigned at creation time)
- **Readiness check 2026-10-31 (before P3 starts):** `git grep` of the live web-admin code found the write sites this migration must ship with:
  - `lib/db/orders.ts` (~line 250) inserts the item, then **UPDATEs** `barcode` with `generateBarcode(...)` (an SVG data URL). With `ck_ord_item_barcode_val` it would fail, so T4.5 (store the value) moves into P3 with T3.1.
  - `lib/services/order-service.ts:867` (new order) and `:2430` (`existingOrder.order_no` + `index + 1`) set srno in the INSERT data; `:2430` restarts at 1 on an existing order, so it can collide with `uq_ord_item_srno`. It must use the next free number (as `order-change-structural-write.ts:208` already does) or leave srno to the trigger.
  - `app/api/v1/orders/[id]/batch-update/route.ts:250` UPDATEs piece `barcode` from user input: it needs the `PIECE_TAG_IN_USE` / format mapping when `uq_ord_piece_barcode` and `ck_ord_piece_barcode_fmt` land.
  - No srno UPDATE was found, so the srno guard can ship in the migration (T3.3 condition met, re-check at write time).
- **P0 correction (`INVENTORY.md` S6, S7):** today's trigger `trg_set_order_item_srno()` → `fn_next_order_item_srno(uuid, uuid)` (0015) always returns `'001'`, so duplicates exist wherever `lib/db/orders.ts addOrderItems` or `splitOrderByPieces` ran. The preflight below would fail. Corrected order of steps: (1) report counts (Q1, Q2); (2) **backfill** NULL, duplicate or non-canonical srno to `<order_no>-<n>` ordered by `(created_at, id)`; (3) backfill `barcode` where `LIKE 'data:%'`, **after** step 2; (4) create the UNIQUE and the CHECK; (5) add the guard. Keep both function signatures (`fn_next_order_item_srno(uuid, uuid)`); only the bodies change.
- **Pre-flight DO block** (style of 0563): raise with counts if `order_item_srno` is NULL/empty, or duplicated per tenant. *(P0: becomes a report plus the backfill above; it raises only if duplicates remain after the backfill.)*
- **`fn_next_order_item_srno(p_tenant uuid, p_order uuid)`** (real signature, P0 S6) gets a new body. When NULL/'', it sets `<order_no>-<n>`:
  - `order_no` comes from `org_orders_mst WHERE id = NEW.order_id AND tenant_org_id = NEW.tenant_org_id`.
  - `n = MAX(numeric last segment of sibling srno) + 1`.
  - A supplied value is kept, so the app's current assignments still work.
  - Concurrency on one order is covered by the order edit lock (`order-lock.service.ts`) and the new UNIQUE.
- **Index:** `CREATE UNIQUE INDEX uq_ord_item_srno ON org_order_items_dtl (tenant_org_id, order_item_srno)`. Not `CONCURRENTLY`, because the tables are tiny today and it sits inside the transaction. Later large tables use the §5.13 template.
- **Item barcode:**
  - `UPDATE org_order_items_dtl SET barcode = order_item_srno WHERE barcode LIKE 'data:%'`. That's the value, not the image; the expected count is 0, per §11.1. *(P0 S7: not safe. `lib/db/orders.ts` writes SVG data URLs, so count with Q1 and run this after the srno backfill.)*
  - Then `ADD CONSTRAINT ck_ord_item_barcode_val CHECK (barcode IS NULL OR barcode NOT LIKE 'data:%')`.
- **Guard on `order_item_srno`:** added **only if** P0 confirms no code path updates srno after insert. **P0 VERIFIED: all writes are INSERT data (`order-service.ts:861`, `:2727`, `order-change-structural-write.ts:208`), so the guard ships in `ord_item_srno_barcode`.** The app currently "overwrites" srno (TO VERIFY whether in the INSERT data or a later UPDATE). If it's an UPDATE, the guard waits until P3 removes that write (task T3.3).
- **Rollback:** restore the 0015 body, drop the index and CHECK. Values stay.

### 5.10 `ord_piece_code_human` (number assigned at creation time)
1. **Pre-flight:**
   - Fail if `org_order_item_pieces_dtl.barcode` has non-null duplicates per tenant.
   - Fail if any piece's item has a NULL `order_item_srno`.
   - Fail if `pg_depend` shows a view or function depending on `piece_code` (list them; TO VERIFY in P0).
2. `ALTER TABLE org_order_item_pieces_dtl ALTER COLUMN piece_code DROP EXPRESSION;` (PostgreSQL 13+; the remote is 17.6).
3. **Backfill**, before any guard exists:

```sql
UPDATE org_order_item_pieces_dtl p
SET piece_code = i.order_item_srno || '-' || p.piece_seq, updated_at = now(), updated_info = 'ord_piece_code_human backfill'
FROM org_order_items_dtl i
WHERE i.id = p.order_item_id AND i.tenant_org_id = p.tenant_org_id;
```

4. `ALTER COLUMN piece_code SET DEFAULT ''`, so Prisma and supabase-js can omit it; the trigger fills it. Then `SET NOT NULL` and `ADD CONSTRAINT ck_ord_piece_code_set CHECK (piece_code <> '')`.
5. **Trigger `fn_ord_piece_code_set()`** BEFORE INSERT. When NULL/'', it sets `srno || '-' || NEW.piece_seq` from the item `WHERE id = NEW.order_item_id AND tenant_org_id = NEW.tenant_org_id`. It raises `ORD_PIECE_ITEM_NOT_FOUND` / `ORD_PIECE_SEQ_MISSING`. `piece_seq` NOT NULL at insert is TO VERIFY.
6. **Indexes and guards:**
   - `CREATE UNIQUE INDEX uq_ord_piece_code ON … (tenant_org_id, piece_code)`.
   - `trg_ord_piece_code_guard BEFORE UPDATE OF piece_code … fn_doc_seq_guard_immutable('piece_code')`.
7. **External tag:**
   - `DROP INDEX idx_order_pieces_barcode RESTRICT`, then `CREATE UNIQUE INDEX uq_ord_piece_barcode ON … (tenant_org_id, barcode) WHERE barcode IS NOT NULL`.
   - `ADD CONSTRAINT ck_ord_piece_barcode_fmt CHECK (barcode IS NULL OR (barcode = btrim(barcode) AND barcode <> '' AND length(barcode) <= 64))`. The 64 limit is TO CONFIRM.
8. **Rollback:**
   - Drop the trigger, guard, CHECKs and unique indexes, and re-create `idx_order_pieces_barcode`. The human values stay; they're valid text.
   - Re-creating the old UUID **generated** column would need drop-and-re-add of the column, so it's documented as *not recommended* (forward-fix instead).

### 5.11 `fin_store_credit_note_scn` (number assigned at creation time)
- `ALTER TABLE org_credit_notes_mst ALTER COLUMN credit_note_no SET DEFAULT ''` (an empty-string default is allowed; it's not a tz/currency/country column).
- Triggers:
  - `trg_fin_cn_no_assign BEFORE INSERT … fn_doc_seq_assign_code('STORE_CREDIT_NOTE','credit_note_no')`.
  - `trg_fin_cn_no_guard BEFORE UPDATE OF credit_note_no … fn_doc_seq_guard_immutable('credit_note_no')`.
- `ADD CONSTRAINT ck_fin_cn_no_set CHECK (credit_note_no <> '')`.
- Existing `CN-xxxxxxxx-0000n` rows are **kept** (no backfill).
- The counter starts at 1 per tenant per year. There's no clash, because the `SCN-` prefix is new.
- The second `credit_note_no` column added in 0283 is checked in P0. If it **copies** the store credit number, it keeps copying; no generator there.
- **Rollback:** drop the triggers, the CHECK and the default. The app shim keeps the old generator for one release (T5.2), so a rollback is safe.
- **Built 2026-10-31 as `0687_fin_store_credit_note_scn.sql`:** pre-checks (config row still DOMAIN, unique index on `(credit_note_no, tenant_org_id)`, no NULL/blank numbers, `SCN` prefix free), `SHARE ROW EXCLUSIVE` lock, counter seeded from any `SCN-YYYY-n` rows, config row → GENERAL / `SCN` / `YYYY-SEQ` / pad 6 / YEARLY, `DEFAULT ''`, CHECK `btrim(credit_note_no) <> ''` (stricter than `<> ''`), generic assign trigger + guard. The 0283 column is a snapshot copy (verified), untouched.

### 5.12 `permissions_doc_seq`, `ff_human_codes` (numbers assigned at creation time; `navigation_doc_seq` is skipped)
- **`permissions_doc_seq`**
  - `INSERT INTO public.hq_permissions (permission_code, permission_name, permission_name_ar, resource_code, action_code, is_system, is_active, created_info)`, using the 0612 pattern with `split_part` and `ON CONFLICT (permission_code) DO NOTHING`. It adds `hq_doc_seq:read`, `hq_general_config:read` and `hq_general_config:manage` (A-12 approved).
  - Grants go to the HQ roles in `hq_role_permissions` (role codes TO VERIFY, e.g. super admin / platform admin).
  - Tenant `sys_auth_permissions` rows are added only if A-09 is approved. The default plan reuses `orders:read` / `orders:update`.
  - Constants are mirrored in `lib/constants/permissions/*-perm.ts` (web-admin) and the HQ permission constants file (path TO VERIFY), per `constants-db-mirror`.
- **`navigation_doc_seq`:** HQ nav entries for *Code Types*, *Code Consistency* and *General Config*. The HQ nav source (platform-api `navigation` module vs `cmx-sidebar.tsx`) is TO VERIFY. **P0 VERIFIED:** HQ nav is hard-coded in `platform-web/components/layout/sidebar.tsx` (the API `navigation` module serves the tenant `sys_components_cd`). The three entries are a **code edit in P8**, and A-11 adds no tenant page, so **`navigation_doc_seq` is reserved/skipped**. The tenant dual-write (`config/navigation.ts` + `sys_components_cd`) applies only if A-11 adds a tenant Scan page.
- **Built 2026-10-31 (P6):** `0688_hq_doc_seq_permissions.sql` adds the 3 HQ codes with EN/AR names and descriptions, `created_info = '0688 HFC doc seq permissions'`, no role grant (A-54). `0689_ord_label_image_cols_deprecated.sql` sets the DEPRECATED comment on `org_orders_mst.qr_code` and `barcode` (A-48, A-56). The HQ constants are mirrored in P7 next to the module that uses them. No tenant constants change. Safety test `supabase/tests/hfc_p6_safety.test.sql`.
- **`ff_human_codes`:** (done in `0684`) a `hq_ff_feature_flags_mst` row `human_codes_scan_labels` (default off; A-14). It gates the new global scan dialog and the new label print in the UI. DB changes are never flagged.

### 5.13 Template for later backfill waves (P10; one migration per table, separate approval)
1. Add `<x>_code TEXT NULL`.
2. Backfill in batches of 5,000 rows (`WHERE id IN (SELECT … ORDER BY created_at, id LIMIT 5000)` loop in a DO block, or a one-off script run by you). Order by `tenant_org_id, created_at, id`, and use the tenant time zone for period keys.
3. Seed `org_doc_seq_mst` to the max used per `(tenant, period)`.
4. `CREATE UNIQUE INDEX CONCURRENTLY` as a **separate, non-transactional file**, because CONCURRENTLY can't run inside BEGIN.
5. `SET NOT NULL` via a `CHECK … NOT VALID` → `VALIDATE` → `SET NOT NULL` sequence (minimal lock).
6. Attach the assign and guard triggers, add the config row, and confirm the consistency view shows 0 ERROR rows.

---
## 6. Backend layer (services and repositories)

Rules for every service:
- **Data access:** repositories own all queries. Each query has an explicit `tenant_org_id` predicate.
- **Inputs and errors:** services take `tenantId` from the caller (which got it from the session) and return typed results or throw typed errors.
- **Error format:** errors are `DomainError` subclasses with a stable `code`. They follow the existing pattern; the base class name is TO VERIFY.
- **Logging:** logs go through `log` from `@/lib/utils/logger`, with no PII.

### 6.1 `DocSeqConfigService` (tenant, read-only)
- **API**
  - `getType(code): Promise<DocSeqType | null>`.
  - `listByTarget(table, column)`.
  - `getPrefix(code)`.
- **Repository:** `SELECT … FROM sys_doc_seq_type_cd WHERE is_active`, cached in-process for 10 minutes. This config changes only by migration, and the cache is busted on deploy.
- **Used by:** validators, for prefix-aware patterns as a runtime check, and diagnostics. It never generates a code.
- **Constants:** `lib/constants/doc-seq.ts` mirrors the DB values (`DOC_SEQ_TYPE.ORDER = 'ORDER'`, `DOC_SEQ_PREFIX.ORDER = 'ORD'`, `CMX_PAYLOAD_VERSION = 'CMX1'`), per `constants-db-mirror`.

### 6.2 `OrderNumberService` (`lib/services/order-numbering/`)
- **`generateWithTx(tx, tenantId)`**
  - Runs `SELECT generate_order_number($1::uuid)` inside the caller's Prisma transaction. The call site is `order-service.ts:673`, which now calls the service.
  - It **does not throw** on format. An unexpected shape only logs a warning, because the code is opaque and the DB is the authority.
- **`nextSubOrderNoWithTx(tx, tenantId, parentOrderId)`:** runs `SELECT fn_ord_next_sub_order_no($1, $2)`.
- **Split flow (`order-service.ts` ~1319)**
  - Replace `supabase.rpc('generate_order_number')`, which runs outside the transaction, with `nextSubOrderNoWithTx` **inside** the same `prisma.$transaction` that creates the sub-order and moves items.
  - If no transaction wraps the split today, one is introduced (TO VERIFY the current shape). `no-silent-money-mutation` applies: totals must move with the items in the same transaction.
- **Pure helpers** move from `lib/utils/order-number-generator.ts` to `order-number.format.ts`:
  - `isValidOrderNumber` → `^ORD-\d{8}-\d{4,}(?:-S\d+)?$`.
  - `parseOrderNumber` splits on segments: `{ prefix, date, seq, subSeq? }`.
  - `extractSequence` uses the last numeric segment of the main part.
  - `formatSequence` is **removed**, since the DB formats. The fixed header comment says "DB counter `org_doc_seq_mst` via `fn_doc_seq_next`", not "database sequence".
  - `getOrderNumberPrefix()` → `DOC_SEQ_PREFIX.ORDER`.
- **Shim:** the old util file re-exports these with `@deprecated` for one release (§15). `__tests__/utils/order-number-generator.test.ts` moves to the new path and gains new cases.

### 6.3 `PieceCodeService` (`lib/services/piece-code/`)
- **Lookups:** `getByCode(tenantId, code)` checks `piece_code`, then `barcode`.
- **`linkExternalTag(tenantId, pieceId, tag, userId)`**
  - Validated with `externalTagSchema`.
  - The unique violation `23505` on `uq_ord_piece_barcode` maps to `PIECE_TAG_IN_USE`, with the holding `piece_code` (same tenant).
  - An audit entry goes through the existing order audit/history service (`order-audit.service.ts`, TO VERIFY its API).
- **`unlinkExternalTag(...)`:** the same, with audit.
- **Generation stays in the DB trigger.** `order-piece-service.ts` stops writing `piece_code` (it was generated) and doesn't set `barcode` at create.

### 6.4 `LabelDataService` (`lib/services/labels/`)
- **`buildOrderLabelData(tenantId, orderId)`** returns `{ orderNo, staffQr: 'CMX1:ORD:'+orderNo, barcodeValue: orderNo, branchName, readyBy, itemCount, pieceCount, customerShort }`.
  - `customerShort` keeps today's label field set (TO VERIFY in `print-label-button.tsx`).
  - The QR never carries personal data.
- **`buildPieceTagData(tenantId, orderId, pieceIds | 'all')`** returns one entry per piece: `{ pieceCode, barcodeValue: pieceCode, staffQr: 'CMX1:PEC:'+pieceCode, orderNo, itemName, pieceSeq, pieceTotal, externalTag }`.
- **`cmx-code-payload.ts`** (pure, no imports) provides:
  - `encodeCmxPayload(type, code)`.
  - `decodeCmxPayload(raw) → { version, type, code } | null`.
  - Types are the doc type's `type_prefix` from `sys_doc_seq_type_cd` (`DOC_SEQ_TYPE_PREFIXES` in `lib/constants/doc-seq.ts`): `ORD`, `PEC`, `ITM`, and any other registered type (user change 2026-10-30; replaces the one-letter `O`/`P`/`I`/`B`).
  - It rejects unknown versions with `null` and its own reason.
  - It's written so `cmx-api` and the mobile apps can copy it 1:1 or import it via `packages/` (A-15).
- **No images are produced or stored server-side.** Images are drawn at print time (§8.4).

### 6.5 `ScanResolveService` (`lib/services/scan-resolve/`)
- **`resolve(tenantId, raw, context?)`**
  1. Normalize: trim; strip CR/LF/TAB and other control chars; drop an AIM symbology prefix (`]C0`, `]Q1`, …) if present; limit to 128 chars.
  2. `decodeCmxPayload`: `ORD` → order by `order_no`, `PEC` → piece by `piece_code`, `ITM` → item by `order_item_srno`; other known `type_prefix` values resolve through the type's `target_table.target_column`.
  3. Otherwise, shape-match with `code-format-schemas`:
     - order / sub-order → `org_orders_mst (tenant_org_id, order_no)`.
     - item → `org_order_items_dtl (tenant_org_id, order_item_srno)`.
     - piece → `org_order_item_pieces_dtl (tenant_org_id, piece_code)`.
     - Codes are compared upper-cased.
  4. Otherwise, the external tag: `org_order_item_pieces_dtl (tenant_org_id, barcode)`, exact, case-sensitive.
  5. If a bare value matches both a code and someone's external tag, return `SCAN_AMBIGUOUS` with both options. Uniqueness makes this the only possible ambiguity.
- **Returns** `ScanResult = { kind: 'ORDER'|'ORDER_ITEM'|'PIECE', matchedBy: 'CMX_QR'|'ORDER_NO'|'ITEM_SRNO'|'PIECE_CODE'|'EXTERNAL_TAG', order: { id, orderNo, status, branchId, parentOrderNo? }, item?: { id, srno, name }, piece?: { id, pieceCode, externalTag, status } }`.
- **Not found:** a missing code and another tenant's code give the same `SCAN_NOT_FOUND`, so there's no enumeration.
- **Cost:** at most 2 indexed queries, each on a unique index.
- **`context`** (`assembly|qa|packing|pickup|intake|any`) is passed back for the UI. Validation that a piece belongs to the current task stays in the calling domain service. The assembly scan route keeps its own task check, but calls `resolve` to find the piece.
- **Refactor:** `app/api/v1/orders/[id]/items/[itemId]/pieces/scan/route.ts` becomes auth → zod → `ScanResolveService.resolve` (+ the existing `OrderPieceService` status update) → response. Its response shape is unchanged.

### 6.6 Shared validators (`lib/validations/code-format-schemas.ts`, zod v4)

```ts
export const ORDER_NO_RE      = /^ORD-\d{8}-\d{4,}(?:-S\d+)?$/;          // prefix from DOC_SEQ_PREFIX.ORDER
export const ITEM_SRNO_RE     = /^ORD-\d{8}-\d{4,}(?:-S\d+)?-\d+$/;
export const PIECE_CODE_RE    = /^ORD-\d{8}-\d{4,}(?:-S\d+)?-\d+-\d+$/;
export const CMX_PAYLOAD_RE   = /^CMX(\d+):([A-Z]):(.{1,100})$/;
export const orderNoSchema     = z.string().trim().toUpperCase().regex(ORDER_NO_RE);
export const pieceCodeSchema   = z.string().trim().toUpperCase().regex(PIECE_CODE_RE);
export const externalTagSchema = z.string().trim().min(1).max(64).regex(/^[\x21-\x7E]+$/); // printable ASCII, no spaces
export const scanInputSchema   = z.object({ raw: z.string().min(1).max(128),
  context: z.enum(['assembly','qa','packing','pickup','intake','any']).default('any') });
export const codeSearchSchema  = z.string().trim().min(2).max(64);       // partial allowed for search only
export function classifyCode(raw: string): 'CMX'|'ORDER'|'ITEM'|'PIECE'|'UNKNOWN' { /* … */ }
```

- The regex constants are built from `DOC_SEQ_PREFIX.ORDER` (one place).
- They are used by routes, services, `CmxCodeSearchInput` and `CmxScanInput`.
- They're unit-tested with 5-digit sequences, sub-orders, lower case, Arabic-digit input (rejected, normalised by the hook) and whitespace.
- The external-tag charset (printable ASCII, ≤ 64) is TO CONFIRM against real pre-printed tags (A-16).

### 6.7 HQ services (`platform-api`)
- **`DocSeqConfigService` + repository**
  - `list(query)`, `get(code)` and `preview(code, at, tz, fyStart)`. `preview` calls `fn_doc_seq_format(code, 1, at, tz, fyStart)` and **never** touches a counter.
  - Reads go through the service-role client (the HQ DB access pattern used by `core-data.repository.ts`).
- **`DocSeqConsistencyService`**
  - `run({ includeData })`: the schema checks come from the view, and the data checks come from `fn_doc_seq_consistency_data()`.
  - It caches 60 s in memory. `refresh=true` bypasses the cache, rate-limited to once per 10 s.
- **`GeneralConfigService` + repository**
  - `get()` returns the single row plus lookup labels from `sys_currency_cd` / `sys_language_cd` / `sys_country_cd`.
  - `update(dto, actor)` (A-12 approved). It uses optimistic concurrency on `updated_at` and writes an audit trail via the HQ `audit` module (API TO VERIFY).
- **Controllers:** `@UseGuards(JwtAuthGuard, HqPermissionGuard)` + `@RequireHqPermission('hq_doc_seq:read' | 'hq_general_config:read')`, with Swagger decorators as in `currency-setup.controller.ts`.
- **DTOs:** `class-validator` DTOs (pattern TO VERIFY in `core-data/dto/code-value.dto.ts`).

---

## 7. APIs and endpoints

The response envelope follows the existing pattern: `{ success: true, data }` / `{ success: false, error, code }`. HTTP codes are used as the existing routes use them.

**Rules**
- Lookup and search routes accept codes.
- Write routes keep UUIDs (approved).
- The tenant always comes from the session.
- Every input is validated with the shared zod schema.

### 7.1 Tenant (`web-admin/app/api/v1/…`)

| Method & path | Purpose | Permission | Request | Response `data` | Errors |
|---|---|---|---|---|---|
| `POST /scan/resolve` (new) | Resolve any scanned or typed code | `orders:read` | `{ raw, context? }` (`scanInputSchema`) | `ScanResult` (§6.5) | 400 `VALIDATION_ERROR`, 404 `SCAN_NOT_FOUND`, 409 `SCAN_AMBIGUOUS` (+ `options[]`), 422 `SCAN_UNSUPPORTED_PAYLOAD` |
| `GET /orders/lookup?code=` (new) | Order by `order_no` (exact) | `orders:read` | `orderNoSchema` | order summary `{ id, orderNo, status, customer, totals… }` (reuse the existing summary mapper, TO VERIFY) | 400, 404 `ORDER_NOT_FOUND` |
| `GET /orders/pieces/lookup?code=` (new) | Piece by `piece_code` or external tag | `orders:read` | `code` string ≤ 128 | `{ piece, item, order }` | 400, 404 `PIECE_NOT_FOUND`, 409 `SCAN_AMBIGUOUS` |
| `PUT /orders/pieces/[pieceId]/external-tag` (new) | Link a fixed or pre-printed tag | `orders:update` | `{ tag }` (`externalTagSchema`) | `{ pieceId, pieceCode, externalTag }` | 400, 404, 409 `PIECE_TAG_IN_USE` (+ `heldByPieceCode`), 423 `ORDER_LOCKED` (if the order edit lock is held, TO VERIFY) |
| `DELETE /orders/pieces/[pieceId]/external-tag` (new) | Unlink | `orders:update` | — | `{ pieceId }` | 404 |
| `GET /orders/[id]/label-data?pieces=all\|<uuid,…>` (new) | Values for the order label and piece tags | `orders:read` | query | `{ order: OrderLabelData, pieces: PieceTagData[] }` | 404 |
| `POST /orders/[id]/items/[itemId]/pieces/scan` (existing) | Item-scoped scan | `orders:read` (unchanged) | unchanged | unchanged; now also matches `piece_code` | unchanged |
| `GET /orders?search=` (existing, TO VERIFY path) | Search | unchanged | unchanged | An exact code match is returned first (fast path on the unique index); the existing fuzzy search is kept | unchanged |
| `GET /public/customer/orders/[orderNo]` (existing) | Customer app | unchanged | The param validator accepts sub-order numbers (`ORDER_NO_RE`) | unchanged | unchanged (404 for other customers) |

**Rate limiting:** `POST /scan/resolve` uses the existing API rate limiter if one exists (TO VERIFY). The target is 10 req/s per user, since scanners can be fast.

### 7.2 HQ (`platform-api`; global prefix and `/hq` convention TO VERIFY with the `api-design` skill)

| Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|
| `GET /hq/doc-seq/types` | `hq_doc_seq:read` | `scope, module, subSystem, level, category, active, q, page, pageSize (≤ 100, default CMX_DEFAULT_PAGE_SIZE)` | `{ items: DocSeqType[], total, page, pageSize }` | 400 |
| `GET /hq/doc-seq/types/:code` | `hq_doc_seq:read` | `code` matches `^[A-Z][A-Z0-9_]{1,29}$` | `DocSeqType` + `consistency` rows for this type | 404 `DOC_SEQ_TYPE_NOT_FOUND` |
| `GET /hq/doc-seq/types/:code/preview` | `hq_doc_seq:read` | `at` (ISO date-time, default now), `tz` (IANA, default `hq_general_config.timezone`), `fyStart` 1–12 | `{ sample, maxLength, periodKey }` | 404, 422 `DOC_SEQ_NOT_GENERAL`, 400 `BAD_TIMEZONE` |
| `GET /hq/doc-seq/consistency` | `hq_doc_seq:read` | `includeData=true\|false`, `severity`, `refresh` | `{ generatedAt, summary: { errors, warnings }, schema: Row[], data: Row[] }` | 429 on `refresh` abuse |
| `GET /hq/general-config` | `hq_general_config:read` | — | `{ defaultCurrency: { code, name, name2 }, timezone, defaultLanguage, defaultCountry, fiscalYearStartMonth, dateFormat, defaultVatRate, supportEmail, supportPhone, defaultTrialDays, updatedAt, updatedBy }` | 500 `HQ_CONFIG_MISSING` (if the single row is gone) |
| `PATCH /hq/general-config` | `hq_general_config:manage` | partial DTO + `If-Match: <updatedAt>` | updated object | 400, 409 `STALE_CONFIG`, 422 `HQ_CONFIG_BAD_TIMEZONE` |

`sys_doc_seq_type_cd` has no write endpoints in this plan. Changes go through migrations, so seed rows stay reviewable.

---

## 8. Frontend layer

### 8.1 New reusable components and hooks (exist nowhere today; checked with `git grep`)

| Component / hook | Path | API | Built on |
|---|---|---|---|
| `CmxCodeChip` | `web-admin/src/ui/data-display/cmx-code-chip.tsx`, exported from `@ui/data-display` | `{ code: string; kind?: 'order'\|'item'\|'piece'\|'tag'\|'doc'; size?: 'sm'\|'md'; copyable?: boolean = true; href?: string; emphasizeSeq?: boolean; label?: string }` | `cmx-copyable-cell.tsx` + `CmxBadge`. It's monospace and wrapped in `<bdi dir="ltr">` so it reads the same in RTL. Copy → `cmxMessage.success(t('common.copied'))`. `emphasizeSeq` bolds the last number ("0007") for counter speech. |
| `CmxCodeSearchInput` | `web-admin/src/ui/forms/cmx-code-search-input.tsx` | `{ value; onChange; onSubmit(code: string, kind: CodeKind); kinds?: CodeKind[]; placeholder?; autoFocus?; debounceMs = 250; disabled? }` | `CmxInput`, `codeSearchSchema` / `classifyCode`. Enter submits. It shows a kind hint ("Order number") and a clear button, and the input is `dir="ltr"` inside RTL forms. |
| `useKeyboardWedge` | `web-admin/src/ui/hooks/use-keyboard-wedge.ts` (folder TO VERIFY; else `lib/hooks/`) | `({ enabled, onScan(raw, meta), target: 'focused'\|'global', minLength = 4, maxIntervalMs = 35, terminators = ['Enter','Tab'], mapPhysicalKeys = true, dedupeMs = 800 })` | Burst detection by key timing. **It maps `KeyboardEvent.code`** (physical keys) when a burst is detected, so a scanner on an Arabic keyboard layout still yields `ORD-…` instead of Arabic letters. It converts Arabic-Indic digits to ASCII and ignores bursts while an IME composition is active. |
| `CmxScanInput` | `web-admin/src/ui/forms/cmx-scan-input.tsx` | `{ onScan(raw, meta: { source: 'wedge'\|'typed'\|'camera' }); status?: 'idle'\|'busy'\|'ok'\|'error'; statusMessage?; autoFocus = true; refocusOnBlur?; disabled?; enableCamera?: false (reserved); label? }` | `CmxInput` + `useKeyboardWedge`. It has an aria-live status region, an optional beep or vibrate setting, large touch targets, and stays focused for continuous scanning. |
| `CmxLabelRenderer` + `useLabelPrint` | `web-admin/src/ui/print/cmx-label-renderer.tsx`, `src/ui/print/use-label-print.ts` (folder TO VERIFY against existing print code) | `{ template: 'order-label'\|'piece-tag'; size: LabelSize; data: OrderLabelData \| PieceTagData[]; showQr?: boolean; locale }` / `useLabelPrint() → { print(node, { pageSize }) , printing }` | Real CODE128 SVG via `lib/utils/barcode/code128.ts` and QR SVG via `qrcode.toString({ type: 'svg', errorCorrectionLevel: 'M' })`. It prints through an isolated iframe with `@page { size }` CSS. The human-readable text sits under each barcode, and the quiet zone is ≥ 10× the module width. |
| `code128.ts` | `web-admin/lib/utils/barcode/code128.ts` | `renderCode128Svg(value, { moduleWidth = 2, height = 48, showText = false }): string` | The approved library (A-07: recommended `bwip-js`, pure JS and SSR-safe; alternative `jsbarcode`). It keeps hyphens, so the scanned value equals the code exactly (the old helper stripped them). |
| HQ `CmxCodeChip` | `platform-web/src/ui/data-display/cmx-code-chip.tsx` | same API | `cmx-copyable-cell.tsx`, via the `create-cmx-component` skill. Sharing one source between repos is A-15. |

Each one gets Storybook stories (states, RTL, dark mode if supported), unit tests (RTL, keyboard, a11y via jest-axe if present, TO VERIFY), and an entry in `docs/dev/rules/cmx-shared-components.md` and `web-admin/.clauderc` snippets.

### 8.2 HQ screens (`platform-web`)
1. **Code Types** (`/system-codes/doc-seq-types`, read-only).
   - **Layout:** `CmxPageHeader` + `CmxListWithFilters` + `CmxDatatable`.
   - **Filters:** `CmxCodeTableSelect` for scope, module, sub-system, level and category; a search box; an active switch.
   - **Columns:** code (`CmxCodeChip`), name (EN/AR by locale), prefix, `parts_format`, an example (from the preview API), reset, level (`CmxStatusBadge`: GENERAL green, DOMAIN blue, MANUAL grey, NONE outline), target (`table.column`), managed by, and a consistency status icon.
   - **Row detail:** clicking a row opens a `CmxDrawer` with all fields, a **How it works** section showing `implement_description` (read-only, preserved line breaks, SQL in a copyable code block), a **Format preview** (`doc-seq-format-preview.tsx`: date picker, tz select, fiscal start; it calls preview) and that type's consistency rows.
   - **States:** loading skeleton, `CmxEmptyState`, error (`CmxStatePanel` + retry), and no-permission (existing guard pattern).
2. **Code Consistency** (`/system-codes/doc-seq-consistency`).
   - **Top:** KPI cards (`CmxKpiStatCard`) for errors, warnings, types checked and last run.
   - **Tables:** schema checks and data checks, grouped by `check_code` with a severity badge. Each row explains in plain language what is wrong and how to fix it; the text comes from i18n keys per `check_code`.
   - **Actions:** a "Run again" button (`refresh=true`, disabled while running), and a copyable JSON export for support.
3. **General Config** (`/settings/general-config`).
   - Read-only cards for currency, timezone (with the current local time), language, country, fiscal start month, date format, VAT, support contacts and trial days.
   - **Edit mode (A-12, this release):** an Edit button for users with `hq_general_config:manage`, covering every column including the general values of §5.3 (current fiscal year, fiscal start, date and time format, first day of week, language, locale, timezone), with `CmxFormSection` / `CmxFormField`, `CmxSearchableSelect` for timezone (IANA list), the `CmxCodeTableSelect` lookups, a `CmxStickyActionBar`, `CmxConfirmDialog` for changes that affect code periods (timezone, fiscal start), and a 409 stale handling message.
4. **Core Data Management** (existing): the five new lookups appear automatically via `sys_code_tables_registry` (`doc_seq_code_tables_registry`). No new screen.
5. **Tenant wizard** (existing, A-13): prefill trial days, country, currency and timezone from `GET /hq/general-config` instead of hard-coded values.

### 8.3 Tenant screens (`web-admin`)
- **Show codes everywhere they're touched**
  - Order lists, details, the workspace, prepare, pickup, delivery, home collection, issues, reconciliation, reports and receipts use `CmxCodeChip`.
  - Pieces in `PieceBaseCard.tsx`, `SortingPieceCard.tsx` and `OrderPiecesManager.tsx` show the full `piece_code`. The "last 8 chars" UUID shortening is **removed**.
  - The external tag is shown as a second chip, kind `tag`.
  - Sub-orders show a parent link ("Part of ORD-…-0007").
- **Search by code**
  - The orders list search box becomes `CmxCodeSearchInput`. An exact code jumps straight to the order; anything else keeps the existing search.
  - The pieces panel can filter by piece code or tag.
- **Global scan**
  - A header "Scan" button plus a passive global wedge listener (only when no editable field has focus, and only with the feature flag on) opens a `CmxDialog` with `CmxScanInput`.
  - Results route as follows:
    - order → order detail.
    - piece → order detail with the piece highlighted (`?piece=<pieceCode>`).
    - ambiguous → a pick list.
    - not found → an inline error and `cmxMessage.error`.
  - The keyboard shortcut is TO CONFIRM (A-11). A separate `/dashboard/scan` page exists only if A-11 is approved (then a nav dual-write is needed).
- **Station scanners**
  - `PieceBarcodeScanner.tsx` and `assembly-scanner.tsx` move onto `CmxScanInput`. That's one shared behaviour: continuous focus, an aria-live result, dedupe, and sound.
  - The assembly API keeps its task check.
- **Link external tag:** a piece card action "Link tag" opens a dialog with `CmxScanInput`. On `PIECE_TAG_IN_USE` it shows the holding piece code and offers to open it. An unlink action needs a confirm.
- **Label printing**
  - `print-label-button.tsx` stops reading the NULL `qr_code` / `barcode` columns. It is **always enabled** and fetches `label-data`, then renders `CmxLabelRenderer` (order label) and prints.
  - A new **"Print piece tags"** action (all or selected pieces) uses the piece-tag template.
  - Sizes come from the existing print settings if they exist (TO VERIFY). Otherwise, new tenant settings `LABEL_ORDER_SIZE`, `LABEL_PIECE_TAG_SIZE` and `LABEL_PIECE_TAG_QR` go in via `add-setting-db` (A-16).
  - **Superseded 2026-10-31 (A-46):** sizes and options come from `sys_label_printing_cf` / `org_label_printing_cf` via `fn_label_printing_resolve`, edited in Settings → Labels & Tags; no `sys_tenant_settings_cd` rows.
- **Receipt** (`receipt-service.ts`): unchanged. It keeps the tracking-link QR, plus an optional CODE128 of `order_no` (setting, A-16).

### 8.4 States, a11y, i18n, RTL
- **States:** every new view has loading (skeleton), empty, error with retry, no-permission, offline (scan disabled with a message) and busy states.
- **Accessibility**
  - Scan results are announced via `aria-live="polite"`. Errors use `role="alert"`.
  - Every action has a visible focus state, and targets are at least 44×44 px.
  - Colour is never the only signal (icons + text).
  - Barcodes have `aria-label` = the code text.
- **i18n**
  - Tenant: new keys go under `web-admin/messages/{en,ar}/…` (tree), namespaces `codes`, `scan` and `labels`. Run `npm run check:i18n`.
  - HQ: keys go under `platform-web/messages/{en,ar}/doc-seq-config/` and `general-config/`. Run `npm run i18n:split`.
  - Terms follow `docs/dev/i18n_docs/GLOSSARY.md`: "Organization / المنشأة", never "Tenant"; HQ = إدارة المنصة. New glossary terms go through approval A-17: order number = رقم الطلب, piece code = رمز القطعة, tag = بطاقة.
- **RTL**
  - Codes, barcodes and payloads are always LTR inside RTL (`<bdi dir="ltr">`). Numbers stay Latin digits in codes.
  - Labels print in the order locale, with the code text always LTR.
  - Arabic fonts are embedded in the print CSS (the existing receipt font, TO VERIFY).

---
## 9. Mobile, `cmx-api` and other clients

| Client | Change | Notes |
|---|---|---|
| `cmx_mobile_apps` (Flutter; follow `cmx_mobile_apps/CLAUDE.md`) | **Display:** treat `order_no` / `piece_code` as opaque strings, shown LTR (`Directionality(textDirection: TextDirection.ltr)` inside RTL). **Regexes:** replace any order-number regex with the lenient pattern (`\d{4,}`, optional `-S<n>`); `git grep` in P0 found none, TO VERIFY. **Staff app scan (if any):** a Dart port of `cmx-code-payload` (`lib/core/codes/cmx_code_payload.dart`) with the same test vectors. | No API contract change. The customer app keeps using `[orderNo]` routes. |
| `cmx-api` | It uses the same shared validator and payload codec. Copying vs sharing a package is A-15. Any order lookup uses `order_no`, never the UUID. | Endpoints are listed in P0 (TO VERIFY that `cmx-api` touches orders). |
| `platform-workers` (HQ) | No change. If a job prints or sends order identifiers, it must use `order_no` (checked in P0). | — |
| Public tracking page | Unchanged: the receipt QR is still the tracking link with its token. Sub-order numbers work because the validator is lenient. | `public-order-tracking.service.ts` |
| Reports / exports (CSV, PDF) | The code columns show `order_no` / `piece_code`. UUID columns are removed from user-facing exports where present (inventory in P0). | Same files as §8.3. |
| Integrations / webhooks | Payloads keep `id` (UUID) **and** add or keep `order_no`. Nothing is removed. Follow `integration-contracts.md`. | — |

---

## 10. Notifications

- **Order placeholders:** templates keep `{{order_number}}`, filled from `order_no`. There's no template change, and sub-orders show `ORD-…-S1`.
- **Credit notes:** a new optional placeholder `{{credit_note_no}}` holds `SCN-…`, only where a credit-note message exists (TO VERIFY in P0).
- **Message hygiene:** check that no SMS, WhatsApp or email template prints a UUID or the old `CN-<tenant8>-…`. The inventory runs in P0 and fixes come in P8.
- **SMS length:** order numbers grow by at most 1 char at 10,000+ orders per day. Templates have that margin (TO VERIFY against the longest template).

---

## 11. Performance targets

| Path | Target | How |
|---|---|---|
| `fn_doc_seq_next` per call | p95 < 2 ms in the DB; no table scan | **Writes:** one `INSERT … ON CONFLICT DO UPDATE … RETURNING` on the PK; `fillfactor 70` → HOT updates. **Config:** a PK lookup on `sys_doc_seq_type_cd`. **Timezone:** checked with a cheap `AT TIME ZONE` test, not a `pg_timezone_names` scan (that scan costs ms). |
| Order create (end to end) | No regression beyond +3 ms | The number is fetched inside the existing transaction. Counter row locking is held only until commit, as today with the order lock. |
| Hot-tenant contention | ≥ 200 orders/s on one tenant-day without errors | Row-level lock on one counter row, with transactions kept short (DEV_GUIDE §13). P1 box load test (indicative): 5-7k numbers/s on one counter row; P2 re-measures with the real order insert (§14.2). |
| Scan resolve | p95 < 50 ms server, < 150 ms to UI feedback | At most 2 queries, each on a UNIQUE index (`tenant_org_id, <code>`). There are no LIKE scans. |
| Order search by code | p95 < 30 ms for an exact match | A fast path on `uq_…order_no`, before the existing search. |
| Label render | < 300 ms for 50 piece tags | Client-side SVG rendering, memoised per value. `qrcode.toString` runs once per tag, batched with `requestIdleCallback` when there are more than 50 tags. |
| Consistency data checks | < 2 s on current volumes | 60 s cache. For large tables they're served by the new unique indexes, with `EXPLAIN` checked in P1. |
| Migrations | Locks ≤ `lock_timeout 10s` | Tables are small today. For big future tables, the §5.13 template uses `CREATE INDEX CONCURRENTLY` outside the transaction and batched backfills. |

**Perf checks:** `EXPLAIN (ANALYZE, BUFFERS)` for each new lookup, recorded in the report (`performance-engineering` rule).

---

## 12. Security

- **Function grants:**
  - `REVOKE EXECUTE ON FUNCTION generate_order_number(uuid), fn_doc_seq_next(…), fn_ord_next_sub_order_no(…) FROM PUBLIC, anon`.
  - `GRANT EXECUTE … TO authenticated, service_role` only where a client really calls it.
  - Today the app calls it via Prisma or the service role, so `authenticated` may not be needed (A-05, TO VERIFY in P0 by `git grep` for `.rpc('generate_order_number'`).
- **P0 (`INVENTORY.md` S4, S5):** the role test is required because `current_tenant_id()` is NULL for Prisma/service-role. The same migration REVOKEs `fn_next_fin_doc_no(uuid,text)` and `generate_cash_drawer_sess_no(uuid)` from PUBLIC/anon/authenticated, GRANTs them to `service_role`, and sets `search_path = pg_catalog, public, pg_temp` (check live grants first with Q11).
- **Tenant check inside definer functions:** for a JWT session (`auth.role() = 'authenticated'`), `p_tenant` must equal `current_tenant_id()`, or it raises `DOC_SEQ_TENANT_MISMATCH`. Server connections (Prisma / service role, no JWT) are trusted, as everywhere else in the app.
- **`search_path`:** fixed on every `SECURITY DEFINER` function to `pg_catalog, public, pg_temp`, with all names schema-qualified.
- **RLS:**
  - The counters have no client policies.
  - Lookups have read-only policies for `authenticated`. Writes go by migration only.
  - `hq_general_config` has no auth policies; it's service role only.
  - New indexes don't change the existing `org_*` policies.
- **No enumeration:** scan and lookup return the same 404 for "missing" and "other tenant". Codes are not secrets. The customer tracking page keeps its token, and the staff QR carries no token or PII.
- **Input hardening:**
  - Scan input is ≤ 128 chars with control characters stripped. External tags are printable ASCII, ≤ 64.
  - All SQL is parameterised (`$queryRaw` tagged templates only, never `$queryRawUnsafe`).
- **Audit:** linking and unlinking an external tag is audited. HQ config edits are audited (old and new value per field, actor, time). Counter changes are traceable from the codes themselves.
- **Secrets:** no secrets appear in plans, reports, logs or test output (rule 4).

---

## 13. Observability

- **Logging:**
  - Structured logs (`log.info/warn/error` with `feature: 'doc-seq' | 'scan' | 'labels'`) carry tenantId, docType and result code. They never include the raw customer name or phone.
  - Scan resolve logs `matchedBy` and latency, with **no** full raw value when it isn't a code (a tag might be a customer's own tag ID; it gets truncated).
- **Error metrics** (counts by `code`): `DOC_SEQ_*`, `SCAN_NOT_FOUND` rate, `SCAN_AMBIGUOUS`, `PIECE_TAG_IN_USE`. These go to the existing monitoring (Sentry in HQ; web-admin TO VERIFY), with an alert on any `DOC_SEQ_TENANT_MISMATCH` or `DOC_SEQ_CODE_IMMUTABLE` in production.
- **Consistency:**
  - The HQ dashboard plus a weekly check: a routine or HQ worker calls `GET /hq/doc-seq/consistency` and alerts when errors > 0. A-18 decided 2026-10-30: **skipped for now**; the HQ Code Consistency screen covers it on demand.
  - The `platform-workers` job is reserved and needs your approval.
- **Report:** each phase records its before/after numbers: order create latency and scan latency.

---

## 14. Testing

### 14.1 Unit (Jest; tenant `__tests__/`, HQ `__tests__/*.spec.ts`)
- **`code-format-schemas`:** valid and invalid vectors for order, sub-order, item, piece, tag and CMX payload, plus whitespace, lower case, 5-digit sequences, Arabic-Indic digits and over-long values.
- **`cmx-code-payload`:** round trip; unknown version; unknown type; a payload with extra `:`.
- **`OrderNumberService`:** a mocked tx; the wrapper call is passed the tenant; no throw on a new format.
- **`ScanResolveService`:** priority order, ambiguity, not found, tenant isolation (repository called with the session tenant only), AIM prefix stripping.
- **`useKeyboardWedge`:**
  - Burst vs human typing; Enter/Tab terminators; dedupe.
  - The **Arabic layout** case (simulated `key='خ'`, `code='KeyO'` → `O`).
  - IME composition is ignored.
- **`code128`:** the SVG decodes back to the same value. Test via a decode library in tests only, or vectors from the library's own tests.
- **Components** (RTL + Testing Library): `CmxCodeChip` copy, RTL `dir`; `CmxScanInput` status announcements; `CmxLabelRenderer` snapshot for EN/AR.
- **HQ:** service and controller specs for the doc-seq list/preview/consistency and general-config get, plus permission guard denial.

### 14.2 DB tests (SQL; `supabase/tests/` with pgTAP if present, else plain SQL assertion scripts; TO VERIFY)
The bot writes these tests. **You run them on local** after applying (rule 2), or approve the bot to run them against local only.
1. **Concurrency, one tenant-day:**
   - 50 parallel sessions × 20 calls to `generate_order_number(t)`, driven by a small Node script in `web-admin/scripts/tests/doc-seq-concurrency.ts` with a `pg` pool.
   - Expect 1000 distinct codes, gap-free 1..1000 when no tx rolls back, and no errors.
2. **Rollback reuse (corrected in P1):** the counter increment is part of the caller's transaction, so a rolled-back tx gives its number back; the next call gets the same number. Gaps come only from numbers taken in a separate tx or documents deleted later.
3. **Day key in the tenant TZ:**
   - Tenant `Asia/Muscat`, `p_at = '2026-10-30 20:30Z'` → `…20261031-0001` (00:30 local next day).
   - A NULL or invalid tz falls back to `hq_general_config`.
4. **Seed correctness:** after `ord_order_no_engine` on a copy of the data, `MAX(order_no seq)` per tenant-day equals the counter `last_value` (from the consistency data function).
5. **Overflow:** with `last_value = 9999`, the next code is `…-10000` (no truncation, unique holds).
6. **Sub-orders:** 10 parallel splits of one parent give `-S1..-S10` with no duplicates; splitting a sub-order numbers under the root (`-S2` split gives `-S3`), and 10 parallel splits of different sub-orders of one root still give unique `-Sn` (A-19).
7. **Immutability:** an `UPDATE` of `order_no`, `piece_code` or `credit_note_no` raises `DOC_SEQ_CODE_IMMUTABLE`. An `UPDATE` of other columns works.
7a. **How-it-works text:** `SELECT doc_type_code FROM sys_doc_seq_type_cd WHERE is_active AND COALESCE(btrim(implement_description), '') = ''` returns zero rows after the seed.
8. **Piece codes:** insert pieces for 3 items → `<order>-<i>-<p>`. The backfill matches the old count. `uq_ord_piece_code` holds. A duplicate external tag in the same tenant is rejected and in another tenant is allowed.
9. **Security:**
   - `SET ROLE anon` → `generate_order_number` gives permission denied.
   - An authenticated JWT for tenant A calling with tenant B → `DOC_SEQ_TENANT_MISMATCH`.
   - A counters `SELECT` as `authenticated` returns 0 rows or is denied.
10. **SCN:** a new store credit note gets `SCN-2026-000001`. Old `CN-…` rows are unchanged. 20 parallel issues give no duplicates.
11. **Consistency view:** clean DB → 0 errors. Dropping a trigger in a tx → `GEN_NO_TRIGGER` appears (rolled back afterwards).
12. ~~**Tenant delete path**~~ **Superseded (APPROVED 2026-10-30):** tenant cleanup never resets or deletes counters; T1.9 found no path to change (§5.4).

**P1 as built:** `supabase/tests/doc_seq_engine_p1.test.sql` covers 2, 3, 5 (engine-level), 7 (on a temporary table), 7a, 9 and 11 with a temporary GENERAL type `ZZ_TEST_DOC`; one transaction ending in `ROLLBACK`; run as a superuser on local with ≥ 2 tenants.

### 14.3 Integration and e2e
- **API route tests:** `scan/resolve`, `orders/lookup`, `pieces/lookup`, `external-tag`, `label-data`. Each covers auth missing (401), permission missing (403), cross-tenant (404) and validation (400).
- **E2E** (Playwright if present, TO VERIFY):
  - Create an order → the number is shown → print the label → scan the printed value via a simulated wedge in the dialog → it lands on the order.
  - Split an order → the sub-order shows `-S1`.
  - The same flows in Arabic RTL.

### 14.4 QA rows (to be added to `docs/features/Human_Friendly_Codes/QA_TEST_GUIDE.md`; same style as `Line_Level_Money_Snapshot/QA_TEST_GUIDE.md`; use the `qa-guide-concurrent-merge` rules when editing)

```
## S1 — New order gets a day-based number in the organization's timezone
1. Set the organization timezone to Asia/Muscat. At 00:30 Muscat time, create an order.
**Expected:** Order number is ORD-<today in Muscat>-0001 (or next), shown in the order header, list and receipt.

## S2 — Two staff create orders at the same moment
1. Two users in the same organization click "Create order" at the same time (10 times each).
**Expected:** 20 different numbers, none skipped except for any cancelled create; no error.

## S3 — Order number cannot be changed
1. Try to edit the order number via any screen or API.
**Expected:** Not editable; API returns an error; number unchanged.

## S4 — Split order
1. Split two items off ORD-…-0007.
**Expected:** New order ORD-…-0007-S1 appears, linked to the parent; splitting again gives -S2.
2. (P2.1) Split -S1 again.
**Expected:** ORD-…-0007-S3 (numbered under the root); the parent's totals and payments do not change; the sub-order lines show 0 price.

## S5 — Piece codes
1. Create an order with 2 items (3 and 2 pieces).
**Expected:** Pieces show ORD-…-1-1, -1-2, -1-3, -2-1, -2-2 in full (no shortened UUID).

## S6 — Print order label
1. Open an order and click "Print label".
**Expected:** Label prints with a QR and a barcode; the barcode text equals the order number; works in Arabic UI with the code shown left-to-right.

## S7 — Scan order label with a USB scanner (Arabic keyboard layout)
1. Switch the computer keyboard to Arabic. Open the Scan dialog. Scan the order label.
**Expected:** The order opens. No Arabic letters appear in the field.

## S8 — Scan a piece tag on the assembly screen
**Expected:** The piece is marked as scanned; the result is announced; field stays focused for the next scan.

## S9 — Link a pre-printed tag
1. On a piece, choose "Link tag" and scan a tag already linked to another piece.
**Expected:** Message says the tag is in use by piece <code>, with a link to it; nothing changes.

## S10 — Code from another organization
1. Scan a label printed by a different organization.
**Expected:** "Code not found". No details from the other organization.

## S11 — Search by order number
1. Type the full order number in the orders search box and press Enter.
**Expected:** The order opens directly.

## S12 — Store credit note
1. Issue a store credit note.
**Expected:** Number SCN-<year>-000001 (or next); old credit notes keep their old numbers.

## S13 — Receipt
**Expected:** Receipt still shows the tracking QR that opens the customer tracking page.

## S14 — Customer app with a sub-order
**Expected:** Customer can open ORD-…-S1 in the app/tracking page.

## S15 — Notifications
**Expected:** SMS/WhatsApp show the order number (including -S1 for sub-orders); never a long technical ID.

## S16 — HQ Code Types (EN + AR)
**Expected:** List shows ORDER (ORD, GENERAL) and the domain rows with examples; each row's drawer shows its "How it works" text; preview shows a sample for a chosen date/timezone; Arabic layout is right-to-left with codes left-to-right.

## S17 — HQ Code Consistency
**Expected:** 0 errors on a healthy environment; "Run again" refreshes the time.

## S18 — HQ General Config
**Expected:** Shows currency, timezone, language, country, fiscal start, VAT, support contacts, trial days.

## S19 — Feature flag off
**Expected:** Scan dialog and new print hidden; existing screens still work; numbers still generated.

## S20 — Over 9,999 orders in a day (staging only, by script)
**Expected:** Order 10,000 is ORD-…-10000; search, scan and labels still work.
```

---

## 15. Deprecation notes (detailed)

| # | What | Where it's used today | Replacement call chain (down to the DB table) | Why | When it's removed |
|---|---|---|---|---|---|
| D1 | `lib/utils/order-number-generator.ts` (`generateOrderNumber`, `generateOrderNumberWithTx`, `isValidOrderNumber`, `parseOrderNumber`, `getOrderNumberPrefix`, `formatSequence`, `extractSequence`) | `order-service.ts:673` (`generateOrderNumberWithTx`); its test file; other callers listed in P0 (`git grep`) | `OrderNumberService.generateWithTx(tx, tenantId)` → `SELECT generate_order_number(tenant)` → `fn_doc_seq_next(tenant,'ORDER')` → `org_doc_seq_mst` (counter row `tenant, ORDER, YYYYMMDD`) + `sys_doc_seq_type_cd` (format). Pure helpers → `order-numbering/order-number.format.ts` + `code-format-schemas.ts`. | The strict regex throws after 9,999 orders per day. Generation is spread across the TS and the DB. The header comment is wrong. | It's a shim with `@deprecated` in P2 and is deleted in P9 once `git grep` shows no imports. |
| D2 | `lib/utils/barcode-generator.ts` `generateBarcode()` (fake CODE128 SVG, strips hyphens) | `lib/db/orders.ts:253` (writes an image to the item barcode) | `lib/db/orders.ts` stores **the value** (`order_item_srno`) in `org_order_items_dtl.barcode`. Printing uses `CmxLabelRenderer` → `code128.renderCode128Svg(value)` (A-07 library). Values come from `LabelDataService` → `org_order_items_dtl` / `org_order_item_pieces_dtl`. | Its output can't be scanned. It stores images in DB rows and loses the hyphens. | Shim in P4 that calls `code128`; deleted in P9. **Status 2026-10-31: shim done (P4).** |
| D3 | `barcode-generator.ts` `generateQRCode` / `decodeQRCode` / `isValidQRCodeData` (JSON QR with the order UUID) | Callers listed in P0 (none at runtime expected, TO VERIFY) | `cmx-code-payload.encodeCmxPayload('O', orderNo)` → value from `org_orders_mst.order_no`, rendered by `qrcode` in `CmxLabelRenderer`. | It leaks the UUID, has no version, and is big and hard to scan. | Removed in P4 (proposal: "retire"). **Status 2026-10-31: removed (P4); no callers were found.** |
| D4 | `org_orders_mst.qr_code` and `org_orders_mst.barcode` image columns | `print-label-button.tsx` reads them (always NULL → button disabled) | `GET /api/v1/orders/[id]/label-data` → `LabelDataService.buildOrderLabelData` → `org_orders_mst.order_no`, rendered at print time. | The images were never filled, and the values can be derived. | They stop being read in P4. The columns get a `COMMENT ON … 'DEPRECATED: unused, see HFC plan'` in a later migration. A drop is a separate approval. **Status 2026-10-31: no longer read (P4); `COMMENT ON … DEPRECATED` written in P6 as `0689` (A-56), waiting for your apply; drop only with a separate approval.** |
| D5 | The old `piece_code` generated expression (`order_id || '-' || item_id || '-' || piece_seq` style) | `PieceBaseCard.tsx` and others show the UUID-based value or a shortened version | `fn_ord_piece_code_set` (BEFORE INSERT) builds `order_item_srno || '-' || piece_seq` → `org_order_item_pieces_dtl.piece_code` (UNIQUE per tenant, immutable). | It wasn't human-readable or unique per tenant, and it exposed UUIDs. | Replaced in `ord_piece_code_human` (same column). |
| D6 | The store credit note number in `stored-value.service.ts:414,472` (`CN-<tenant8>-<count+1>`) | Store credit issue flows | Insert with `credit_note_no` empty → `trg_fin_cn_no_assign` → `fn_doc_seq_assign_code('STORE_CREDIT_NOTE','credit_note_no')` → `fn_doc_seq_next` → `org_doc_seq_mst (tenant, STORE_CREDIT_NOTE, YYYY)` → `SCN-YYYY-NNNNNN`. | It races (`count+1`), leaks part of the tenant UUID and clashes with the tax `CN` prefix. | The code path stops generating in P5; one-release fallback T5.2; removed in P9. |
| D7 | Deactivated settings `ERP_LITE_FISCAL_YEAR_START`, `SYS_TIMEZONE`, `TENANT_DATE_FORMAT`, `TENANT_TIME_FORMAT`, `TENANT_FIRST_DAY_OF_WEEK`, `TENANT_LANGUAGE`, `TENANT_LOCALE` (`sys_tenant_settings_cd`, deactivated 0652) | No consumer (per 0652) | Per tenant: the matching `org_tenants_mst` column (§5.3). System default: the matching `hq_general_config` column. Read via `fn_tenant_general_value` / `TenantGeneralConfigService`. | Avoids two sources of truth (A-03). | Only a `COMMENT ON` mark; rows kept. |
| D8 | `get_order_number_prefix()` | `generate_order_number` (old body); other callers in P0 | `sys_doc_seq_type_cd.prefix` (`ORDER`) read by `fn_doc_seq_format`; TS uses `DOC_SEQ_PREFIX.ORDER`. | The prefix now lives in config. | Made STABLE in `ord_order_no_engine`; dropped later if P0 shows no callers (A-06). |
| D9 | The direct-SQL logic in `pieces/scan/route.ts` | The item-scoped scan route | `ScanResolveService.resolve` → `scan-resolve.repository` → unique-index lookups. | Separation of concerns (rule 12); item-only barcode matching. | Refactored in P3 (same contract). |
| D10 | Per-screen scan input logic in `PieceBarcodeScanner.tsx` and `assembly-scanner.tsx` | Two screens | `CmxScanInput` + `useKeyboardWedge`. | Duplicate logic, and no wedge or Arabic-layout handling. | Refactored in P3. |

---

## 16. Documentation plan (per phase; rule 15)

| Phase | Docs task | Files |
|---|---|---|
| P0 | Inventory report + seed approval tables | `docs/features/Human_Friendly_Codes/INVENTORY.md`, report file |
| P1 | Engine dev guide (how to attach a code to a new table in 3 steps), DB objects list, ADR draft | `DEV_GUIDE_DOC_SEQ_ENGINE.md`, `docs/platform/inventories/*` refresh (`rebuild-platform-info-inventories`) |
| P2 | ORDER numbering notes, deprecation D1/D8 | `ORDER_NUMBERING.md` |
| P2.1 | Split family root, tenant hard-delete guard, safety test | `ORDER_NUMBERING.md`, DEV_GUIDE §16, plan §5.8.1 |
| P3 | Piece/item codes, scan API, external tags | `SCAN_AND_PIECE_CODES.md`, API docs |
| P4 | Label printing user guide (EN/AR), printer setup notes | `USER_GUIDE_LABELS.md` |
| P5 | Store credit SCN, DOMAIN registry list | `DOMAIN_CODES_REGISTRY.md` (written 2026-10-31) |
| P6 | Permissions, nav, flag docs | `PERMISSIONS.md` (written 2026-10-31), flag entry (flag in `0684`) |
| P7 | HQ screens and API docs | HQ `docs/features/human-friendly-codes/*` via `create-feature-documentation` |
| P8 | Client notes, rule text (`databaseconventions` adds a "human codes" section: always via the engine) | rule docs in both repos (needs your OK per file) |
| P9 | **Final:** run the tenant `documentation` skill (full pack: overview, dev, user, QA, deploy, rollback) and HQ `create-feature-documentation`; `documentation-audit`; ADR via `adr-builder` / `adr-producer` | the full pack, plus the report closed |

---
### 16.1 Human-Friendly Codes rule: where it's written and what it says

**When:** written in P1 (task T1.R), once the engine and config table exist, so every later phase follows it. Refreshed at the end in P8 (task T8.4) to match what was actually built. **P1:** written between `HFC-RULE:BEGIN` / `HFC-RULE:END` markers in every file below (appended, nothing else changed) on the instruction to implement P1; review the text in the P1 report.

**Where (extend existing files; no new rule files):**

| Repo | File | What goes in |
|---|---|---|
| Tenant | `.cursor/rules/databaseconventions.mdc` | Full rule section "Human-Friendly Codes" |
| Tenant | `.claude/skills/database/SKILL.md` | Short rule + new-table checklist; link to `conventions.md` |
| Tenant | `.claude/skills/database/conventions.md` | Full rule section (same text as the rules file) |
| Tenant | `CLAUDE.md` (root) | One-line pointer to the rule |
| HQ | `.cursor/rules/rulesfromclaudejh.mdc` | Full rule section (HQ and SYS scopes, `hq_general_config`) |
| HQ | `.claude/skills/database/SKILL.md` | Short rule + new-table checklist |
| HQ | `CLAUDE.md` (root) | One-line pointer to the rule |
| Tenant | `.codex/docs/database_conventions.md` | Full rule section (same text as `databaseconventions.mdc`) |
| Tenant | `.codex/skills/database/SKILL.md` | Short rule + new-table checklist; link to `conventions.md` |
| Tenant | `.codex/skills/database/conventions.md` | Full rule section |
| Tenant | `AGENTS.md` (root) | One-line pointer to the rule |
| HQ | `.codex/docs/database_conventions.md` | Full rule section (HQ and SYS scopes, `hq_general_config`) |
| HQ | `.codex/skills/database/SKILL.md` | Short rule + new-table checklist |
| HQ | `.codex/skills/create-db-table/SKILL.md` (and `templates/migration.template.sql`) | New-table checklist step + template placeholders for the code column, config row and trigger |
| HQ | `AGENTS.md` (root) | One-line pointer to the rule |

The `.claude`, `.cursor` and `.codex` copies carry the same rule text, so all three tool setups stay in sync; T1.R and T8.4 update all of them together. If P0 finds a matching `create-db-table` skill or migration template in `.claude/skills` of either repo, it gets the same checklist step.

Related rule files (`multitenancy.mdc`, `databasetablecheckworkflow.mdc`, `aicoderfrontendinstructions.mdc`, `codereviewchecklist.mdc`) get a one-line cross-reference only if P0 shows they cover the same ground; each one is listed for your OK.

**Rule content (from proposal §2, finalised with the built names):**
1. Never expose UUIDs as business identifiers. UUIDs stay the PK/FK; nothing joins on codes.
2. Any table whose records people refer to has a human-friendly code column, unique per tenant (or per scope for SYS/HQ).
3. Every code type has exactly one row in `sys_doc_seq_type_cd`; prefix, parts, padding, reset policy and `implement_description` live there, not in code. Its `type_prefix` is the stable key of the type.
4. Codes are generated only by the DB (`fn_doc_seq_assign_code` trigger, or the domain's registered function) and are immutable after insert.
5. Existing implementations stay as they are and are registered with `manage_by_level` DOMAIN or MANUAL.
6. A new prefix / `type_prefix` is 3-5 capital letters, unique across all types (`uq_doc_seq_type_tprefix`), and approved by the user.
7. Date parts use the tenant's local time; fiscal year from `org_tenants_mst.fiscal_year_start_month`; SYS/HQ from `hq_general_config`.
8. UI shows codes, never raw UUIDs; lookup/search routes accept codes, write routes keep UUIDs.
9. Printed/scanned codes: staff QR `CMX1:<type_prefix>:<code>`, CODE128 of the code; the tracking link only for customers.
10. Engine functions are service_role only; counters are never written by app code and never reset by tenant cleanup; take the number in the same transaction as the insert.
11. **New-table checklist:** add the code column, the config row, the trigger, `UNIQUE(tenant_org_id, <code>)`, the immutability guard, the backfill, and confirm `vw_doc_seq_consistency` shows 0 issues.

## 17. Rollout phases and checkpoints

Every phase works the same way:
1. You approve the start (§0.1).
2. The bot works on a branch.
3. Migrations are written but **not applied**.
4. Build, lint, i18n and tests run, and the status table and report are updated.
5. **CHECKPOINT:** you review.
6. **Your steps:**
   - Apply to local and remote.
   - Regenerate types in **both** repos (your usual `types:generate` scripts; exact script names TO VERIFY).
   - Run `npm run prisma:pull` in `web-admin` (`pull-prisma` skill), then commit and deploy.
   - Ask the bot for tests on the deployed environments.
7. The bot runs the post-deploy checks (read-only) and marks the phase DONE.

**Feature flag:** the new UI (global scan dialog, new label print) reads the flag `human_codes_scan_labels` with a default of **off** when the row is missing. That lets P3/P4 code ship dark before P6 creates the flag row. DB behaviour (numbers, triggers) is never behind a flag.

| Phase | Content | Migrations | Checkpoint (go/no-go) | Your apply / regenerate steps | Post-deploy checks |
|---|---|---|---|---|---|
| **P0** Inventory (read-only) | Inventory of every generator, code column, caller, template, export and print site. Read-only DB checks (only if no secret is exposed). Seed lists for A-01/A-02. Resolve the TO VERIFY items in §22. | none | You approve the seed rows row by row, plus A-03…A-21 | none | — |
| **P1** Engine | Lookups, config, `hq_general_config`, counters, functions, consistency view, registry rows; T1.9 delete paths | the 7 P1 migrations (`scope_modules` … `doc_seq_code_tables_registry`) | `npm run build` + DB test scripts green on your local; consistency shows only "not wired yet" warnings | Apply the 7 P1 migrations (`scope_modules` … `doc_seq_code_tables_registry`) local → run §14.2 tests 2, 3, 9, 11 → remote; regenerate types (both repos); `prisma:pull`; commit; deploy | HQ can read `sys_doc_seq_type_cd`; consistency has 0 errors |
| **P2** ORDER | Counter seed, wrapper, triggers, revoke, sub-order fn; `OrderNumberService`; split moved into the tx; D1 shim | `ord_order_no_engine` | Concurrency test (§14.2-1) green on local; order create works | Apply `ord_order_no_engine` local → create test orders → remote **in a quiet window** (it takes a short table lock) → regenerate → `prisma:pull` → deploy | QA S1–S4, S14, S20 (staging) |
| **P3** Pieces / items / scan | `ord_item_srno_barcode`, `ord_piece_code_human`; `PieceCodeService`, `ScanResolveService`, new APIs; `CmxScanInput`/wedge; refactor the two scanners and the scan route; codes shown everywhere | `ord_item_srno_barcode`, `ord_piece_code_human` | Piece backfill dry-run counts match (pre-flight SELECTs in the migration header) | Apply → regenerate → `prisma:pull` → deploy | QA S5, S7–S11 |
| **P4** Labels | `LabelDataService`, payload codec, `code128` (A-07 dependency added to `web-admin/package.json`), `CmxLabelRenderer`, print button, piece tags; D2–D4 | none (settings migration only if A-16) | Labels scan correctly on a real scanner (you test one printed label) | `npm install` after pull; deploy | QA S6, S7, S13 |
| **P5** SCN + DOMAIN | `fin_store_credit_note_scn`; stored-value change with a one-release fallback (T5.2); DOMAIN rows verified against the inventory | `fin_store_credit_note_scn` | SCN concurrency test green | Apply → regenerate → deploy | QA S12; consistency 0 errors |
| **P6** Permissions / nav / flag | `permissions_doc_seq`, `ff_human_codes`; role grants; UI access contract refresh | `permissions_doc_seq`, `ff_human_codes` | Permission matrix reviewed | Apply → regenerate → deploy → **enable the flag for a pilot organization** | QA S19 with the flag off/on |
| **P7** HQ | `doc-seq-config`, `general-config` modules and screens; A-13 wizard prefill | none | `verify:schema`, build, lint, i18n:split green | Regenerate HQ types if needed → deploy HQ | QA S16–S18 |
| **P8** Clients / notifications / rules | Mobile and cmx-api validators/codec; template check; rule text updates (each rule-file edit needs your OK) | none | Mobile builds; no UUID in templates | Release the mobile app per your process | QA S15, S14 |
| **P9** Close-out | Full QA on deployed envs; remove shims (D1, D2, D6) once `git grep` is clean; docs pack; ADR | possibly 1 (comments on deprecated columns) | All QA rows pass | Apply (if any) → deploy | Final report |
| **P10** (later) | Backfill waves per master table, using the §5.13 template | one per table | Separate approval each | Same pattern | — |

---

## 18. Rollback

| Phase | Rollback | Data impact |
|---|---|---|
| P1 | Drop new objects in reverse order (RESTRICT); remove the registry rows | None (new objects only) |
| P2 | Restore the 0012 bodies of `generate_order_number` / `extract_order_sequence`; drop the triggers and `fn_ord_next_sub_order_no`; delete the ORDER counter rows. App: revert to the D1 shim, which still calls the same DB function. | Numbers already issued stay valid and unique. The old function's MAX+1 continues from them. |
| P3 | Restore the old srno body; drop the new UNIQUEs, guard and CHECK. `piece_code` **can't go back** to a generated expression without data loss; it's forward-fix only (keep the values). | The new piece codes remain (harmless). |
| P4 | Revert the app (the print button falls back to disabled, as today) | None |
| P5 | Drop the SCN triggers, CHECK and default; the app fallback generator (T5.2) takes over | Issued SCN numbers stay |
| P6 | Revoke the permissions (`0688` header SQL, only rows no role uses); restore the `0012` comments (`0689` header); flag off | None |
| P7 | Revert HQ deploy | None |
| P8 | Revert app releases | None |

Each migration file carries its own `-- ROLLBACK` block (commented SQL), per the header style.

---

## 19. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | The counter seed misses a tenant-day, which would give a duplicate number on the first order after the deploy | Low / high | Seeded under `LOCK TABLE org_orders_mst IN SHARE ROW EXCLUSIVE MODE`; the UNIQUE `(tenant_org_id, order_no)` stops duplicates; the consistency data check (`counter_behind`) runs right after the deploy |
| R2 | Lock wait during the `ord_order_no_engine` deploy | Medium / medium | `lock_timeout 10s`, a quiet window, retry on timeout |
| R3 | An unknown caller of `generate_order_number` from the client with a JWT now fails the tenant check | Low / medium | P0 `git grep` of `.rpc(`; error message is clear; grant kept for `authenticated` |
| R4 | Code paths that UPDATE srno or `piece_code` break on the guards | Medium / medium | Conditional guard (T3.3); P0 inventory of writes; the guard error has a clear code. **P3:** re-checked 2026-10-31, no app UPDATE of srno or `piece_code`; the app never writes `piece_code` |
| R5 | Scanners configured with a suffix other than Enter, or with an AIM prefix | Medium / low | Tab terminator, AIM prefix stripping, a setup note in the user guide |
| R6 | The Arabic keyboard layout garbles wedge input | High (in Oman) / medium | Physical-key mapping in `useKeyboardWedge` (§8.1), QA S7 |
| R7 | The new barcode library adds bundle weight | Low / low | Dynamic `import()` only on print screens |
| R8 | Thermal printer DPI makes CODE128 unreadable | Medium / medium | Module width ≥ 2 px at 203 dpi, quiet zones, real-scanner checkpoint in P4 |
| R9 | Hidden consumers parse the old `piece_code` | Low / medium | P0 `git grep` of `piece_code` across all repos and templates |
| R10 | Store credit consumers expect `CN-` | Low / low | Old rows are unchanged; check reports/filters by prefix in P0 |
| R11 | Tenant delete blocked by the new FK | Medium / medium | T1.9 updates the delete paths before P1 is applied. **P2.1:** `0678` removes the counters of a `creating` tenant itself; every other tenant hard delete is refused by design (A-31) |
| R12 | Migration number collides with parallel work | Medium / low | Re-check the next number just before writing (rule 3) |
| R13 | A create finishes but the final `creating → <status>` update fails, or a failed create cannot roll back its `creating` row, so the tenant stays `creating` (still deletable). Applies to web-admin signup and, since P2.2, to HQ create | Low / medium | web-admin logs it and keeps the tenant; HQ rolls the row back and returns 500 `TENANT_CREATE_FINISH_FAILED`, logging a failed rollback; HQ can set the real status (allowed); check query in DEV_GUIDE §16 |
| R16 | HQ initialization fails after the switch (best-effort, as before), so the tenant has its final status but missing defaults | Medium / low | Unchanged behaviour: per-step results are returned to the wizard; `POST /tenants/:id/reinitialize` re-runs it (A-32) |
| R14 | An uncommitted root order is deleted; deeper sub-orders keep a parent but lose the root, and splitting under them fails (`ORD_ROOT_INCONSISTENT`) | Very low / low | Fails closed, no wrong number; manual repair in DEV_GUIDE §16 |
| R15 | Old web-admin `registerTenant` still deployed after `0678`: a failed signup cannot roll back its tenant row | Low / low | Deploy order in DEV_GUIDE §16 (web-admin with or after 0678) |
| R17 | Batch-update is not one transaction (A-38 keeps the one-by-one save): if another request takes a tag between the pre-check and the write, the DB unique index refuses that piece but earlier pieces of the same batch are already saved (the 409 says how many: `piecesUpdated`) | Low / low | Pre-check refuses known clashes before any write; the DB error is mapped to 409 `PIECE_TAG_IN_USE` with `piecesUpdated`, so the screen reloads and shows what was saved |
| R18 | Apply of `0683` stops on duplicate (after trim + upper-case), malformed or code-shaped live tags | Medium / low | The migration checks first and changes nothing, and its error gives the count per check; DEV_GUIDE §17 Q-P5..Q-P7 list them, R3 clears the older copies and R4 clears bad tags (old value kept in metadata) |
| R20 | Vendor tags that start with one of our prefixes and a digit (e.g. `REF-1`, `POS1`, and `U1` / `Z9` because of the one-letter registry prefixes `U`, `Z`) are refused after A-37 | Medium / low | Clear error `PIECE_TAG_LOOKS_LIKE_CODE` (EN/AR); tags such as `UA1`, `ZONE-1`, `T-100` stay allowed. If a tenant's tag stock clashes, narrow the rule (e.g. skip one-letter prefixes) in a new migration |
| R21 | A reopened order: its tags stay released in the DB, but the app's holder lookup still counts them | Low / low | Stricter, never looser: the app may refuse a tag the DB would allow; staff use another tag, or save the old tag on the reopened piece again (the DB re-checks it) |
| R22 | Order status changed by direct SQL to delivered / closed / cancelled | Low / low | The release trigger is on `org_orders_mst` itself, so every writer releases the tags |
| R23 | The page-wide scanner listener takes a fast burst of keys as a scan (P3b) | Low / low | Only outside text fields, only bursts with ≤ 50 ms between keys ending in Enter/Tab within 50 ms, min 4 characters; behind the flag (default off); the dialog only looks up, it changes nothing |
| R24 | Scan lookups used to probe codes of other tenants, or scanned in bulk | Low / medium | Every lookup is tenant-scoped; another tenant's code and a missing code give the same 404 `SCAN_NOT_FOUND`; limiter `scan-user` 600/min per user (fails open without Upstash, like the other limiters) |
| R25 | `Ctrl+Shift+F` clashes with a browser or OS shortcut on some setups | Low / low | No app shortcut uses it (checked 2026-10-31); matched by physical key, also `Cmd+Shift+F`; the header button always works. **Resolved 2026-10-31: kept (A-41)** |
| R19 | Old web-admin (data: URL barcode, `index + 1` serials) still deployed after `0682` | Low / medium | Deploy order in DEV_GUIDE §17: web-admin first. Old code would be refused by `ck_ord_item_barcode_val` / `uq_ord_item_srno`, not write bad data |
| R26 | Label printing is on for every tenant now (A-47), so tenants that had `label_printing` off see the new Labels & Tags screen and the order-label options | Low / low | The system defaults print exactly what P4 printed (order label 4×6 in with QR and short name, piece tag 58×30 mm without QR, 1 copy); the screen needs `settings:read` and saving needs `settings:update` |
| R27 | A branch override hides a later tenant-wide change (branch wins per field) | Medium / low | The screen shows "In use: value (source)" for every field and offers "Use default" per field; clearing every field of a branch deletes its override row |
| R28 | Old web-admin (P4 draft that read the five `LABEL_*` tenant settings) deployed after the reworked `0685` | Low / low | Those settings rows are not created any more, so old code would fall back to its built-in defaults; deploy web-admin with or after `0685` (DEV_GUIDE note) |

---

## 20. Approval items (row by row)

Please answer each with **Approve / Change / Reject**.

| ID | Item | Recommendation |
|---|---|---|
| A-01 | Seed for scopes, modules and sub-systems (table below) | **APPROVED 2026-10-30** (with the user's changes: `short_code` on all three tables, journals under ERP, shared ORG/HQ modules, HQ-only modules). Reason: covers every module that owns a numbered record today plus the platform modules, so new types never need a lookup migration first. |
| A-02 | Seed for doc types (table below) | **APPROVED 2026-10-30** (51 rows, each with a unique `type_prefix` and `implement_description`; all DOMAIN in P1). Reason: registers every code found in P0 without changing any generator, so the consistency view sees all codes from day one. |
| A-03 | Overlap with deactivated settings | **DECIDED 2026-10-30:** seven values as columns in both `hq_general_config` and `org_tenants_mst` (current_fiscal_year TEXT, fiscal_year_start_month, date_format, time_format, first_day_of_week, language, locale_code; plus the existing timezone). Tenant value wins, else HQ default. The seven old setting rows stay deactivated with a pointer comment; the other 17 deactivated feature settings are untouched (§5.3). |
| A-04 | Customers: the existing `generate_customer_number` (`CUST-00001`, MAX+1) vs the proposal seed `CUS` GENERAL on `customer_code` | Per "existing implementations stay": register `CUST` as **DOMAIN** now; moving it to the engine is a P10 decision (with a fix for the MAX+1 race) **APPROVED 2026-10-30** |
| A-05 | Engine details: `p_fy_start` for fiscal-year tokens; `next` returns the formatted code; PARENT/RAND tokens and PER_PARENT for non-GENERAL rows; separator set `- / ''`; keep the `authenticated` grant only where needed | Approve **APPROVED 2026-10-30** |
| A-06 | `get_order_number_prefix()`: STABLE now, drop later if unused | Approve **APPROVED 2026-10-30** |
| A-07 | CODE128 library | `bwip-js` (pure JS, SVG, SSR-safe, MIT); alternative `jsbarcode` **APPROVED 2026-10-30 (`bwip-js`)** |
| A-08 | HQ permission style: colon (`hq_doc_seq:read`, `hq_general_config:read`) | Approve (matches 0612) **APPROVED 2026-10-30** |
| A-09 | Optional tenant permissions (`orders:scan`, `orders:print_labels`, `orders:link_tag`) | Not needed now; reuse `orders:read` / `orders:update` **APPROVED 2026-10-30** |
| A-10 | `BR` (branch) token | Reserved; rejected by the formatter until enabled **APPROVED 2026-10-30** |
| A-11 | A tenant Scan page + nav entry, and the keyboard shortcut | Dialog only now (header button); shortcut `Ctrl+Shift+F` (TO CONFIRM against existing shortcuts); no page **APPROVED 2026-10-30** |
| A-12 | HQ General Config edit screen + `hq_general_config:manage` | Read-only first; edit in a later release **DECIDED 2026-10-30: edit in **this release**, not later. `hq_general_config` is a single row, so CRUD here means view + edit (update) with audit; the row is created by the seed and delete is blocked by design. `hq_general_config:manage` permission, PATCH endpoint and edit screen are in scope.** |
| A-13 | HQ tenant wizard prefills from `hq_general_config` | Approve **APPROVED 2026-10-30** |
| A-14 | Feature flag `human_codes_scan_labels` (UI only, default off) | Approve **APPROVED 2026-10-30** |
| A-15 | Shared code between repos (`cmx-code-chip`, `cmx-code-payload`): copy vs a shared package | Copy now with identical tests; shared package later (`share-code-decision` skill) **DECIDED 2026-10-30: copy only the cmx components/helpers each repo needs (e.g. `CmxCodeChip`, the `cmx-code-payload` codec) into that repo, with identical tests. No shared package.** |
| A-16 | Label settings (`LABEL_ORDER_SIZE`, `LABEL_PIECE_TAG_SIZE`, `LABEL_PIECE_TAG_QR`, receipt CODE128 on/off) and the external-tag charset (printable ASCII, ≤ 64) | **APPROVED 2026-10-30** (charset replaced 2026-10-31 by A-36: A-Z 0-9 - _ . /, upper-case, ≤ 64). Reason: no `LABEL_*` settings exist, the sizes match the existing label-printing flags, and the charset covers every printable tag. Seeded in P4. |
| A-17 | Glossary terms (AR): رقم الطلب / رمز القطعة / بطاقة / إشعار رصيد المتجر | Approve or change the wording **APPROVED 2026-10-30** |
| A-18 | A weekly consistency alert (routine or HQ worker) | Optional **DECIDED 2026-10-30: skip for now; the HQ Code Consistency screen is enough.** |
| A-19 | Splitting a sub-order: reject (`ORD_PARENT_IS_SUB`) vs number it under the root parent (`-S3`) | Number under the root parent is friendlier. The plan currently rejects; tell me which you want **APPROVED 2026-10-30: number under the root parent (`-S3`), see §5.8 item 6.** |
| A-20 | Register `user_code` (0563, platform-wide) as DOMAIN, scope `SYS` | Approve (format TO VERIFY in P0) **APPROVED 2026-10-30** |
| A-21 | `hq_general_config` values: `date_format` allowed list, `default_trial_days`, VAT default, `locale_code`, `time_format`, `first_day_of_week`, `current_fiscal_year` label style | **APPROVED 2026-10-30** (OMR, OM, en, en-OM, Asia/Muscat, FY2026, start month 1, DD/MM/YYYY, 24h, 6, VAT 5.00, 30 days). Reason: the values are today's wizard and tenant defaults, so nothing changes for existing or new tenants. |
| A-22 | HQ nav migration (`navigation_doc_seq`) | **APPROVED 2026-10-30: skipped.** Reason: HQ nav is hard-coded in `platform-web/components/layout/sidebar.tsx`, so it is a code change in P7/P8; no migration number is reserved. |
| A-23 | Drop the defaults on `org_tenants_mst.date_format`, `time_format`, `first_day_of_week` | **APPROVED 2026-10-30.** Reason: verified safe in P1 (nullable columns, every reader falls back); new tenants then inherit `hq_general_config`. |
| A-24 | Tenant cleanup and counters | **APPROVED 2026-10-30: cleanup never resets or deletes counters.** Reason: a reused number would collide with printed labels and receipts. |
| A-25 | `jest-axe` devDependency for a11y tests | **APPROVED 2026-10-30: add in P3 (tenant) and P7 (HQ).** Reason: neither repo has an a11y test helper; dev-only, no runtime impact. |
| A-26 | `short_code` on scopes, modules, sub-systems; unique `type_prefix` on every doc type | **APPROVED 2026-10-30 (user change).** Reason: stable short keys for screens, logs and scan payloads; DOMAIN child codes keep their own value format. |
| A-27 | `short_code` length on `sys_saas_scope_cd`, `sys_modules_cd`, `sys_module_sub_systems_cd` | **APPROVED 2026-10-30 (user decision): 2-5 capital letters** (`^[A-Z]{2,5}$` in `ck_saas_scope_short`, `ck_modules_short`, `ck_mod_subsys_short`). Reason: the HQ scope keeps `short_code` = `HQ`. `type_prefix` and GENERAL `prefix` stay 3-5. |
| A-28 | Root of a sub-order | **APPROVED 2026-10-31 (user decision, changes the 2026-10-30 agent decision): add `org_orders_mst.root_order_id`** (`0677_ord_root_order_id.sql`, §5.8.1): tenant-safe composite FK, backfilled, filled and guarded by `trg_ord_root_guard`, immutable; `fn_ord_next_sub_order_no` numbers over `root_order_id` with the root locked `FOR UPDATE`. Reason: one indexed read per split instead of a parent walk, the family is queryable directly, and a bad chain is refused at insert time. |
| A-29 | Money on a split | **DECIDED BY USER 2026-10-31: only moves.** All money stays on the parent order; sub-order lines are priced 0 and point back to the parent lines (`metadata.split_from_item_id`, `split_from_order_id`, `split_root_order_id`, `money_on_parent: true`). Parent lines/pieces get only split bookkeeping in `metadata` (`split_out_qty`, `split_out_piece_seqs`, `split_to_order_id`). Pieces are not moved. Reason: no silent money mutation, no conflict with committed-order evidence (WP02) or piece-history FKs. Follow-up (Order_Fin): piece rows on the sub-order and an operational "remaining units" view. Covered by `hfc_p21_split_safety.test.sql` B5 and Jest. |
| A-30 | When an order takes its number | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user delegated the decision):** keep it inside the create transaction, taken last, just before the INSERT (gapless; a rolled-back create reuses the number). Same-tenant creates serialize on the tenant/day counter until COMMIT: measured ~7k creates/s per tenant (7.2k tps, p95 3.1 ms, 8 clients, box), far above the ≥ 200/s target (§11). Reason: gapless daily numbers that match printed labels; the cost is only the short wait between same-tenant creates. Keep the create transaction short (DEV_GUIDE §13). |
| A-31 | Which tenant may be hard-deleted ("creating stage") | **DECIDED BY AGENT AS EXPERT 2026-10-31; HQ part CHANGED BY USER 2026-10-31 (P2.2): HQ-created tenants also start in `creating`.** On the user rule "hard delete of tenants should be blocked unless it is in creating stage only": the creating stage is the insert-only status `creating` (`0678`). Both web-admin self-signup and HQ `TenantsService.create` insert it and leave it when the required create steps succeed (signup: subscription + admin user → `trial`; HQ: base currency → requested status, default `trial`). Every other status, NULL included, is blocked by a DB trigger (fail closed, `TENANT_HARD_DELETE_BLOCKED`); TRUNCATE is blocked; no UPDATE can set `creating`, and no caller can request it (HQ 409). Risk R13 (stuck `creating`) covers both paths. |
| A-32 | Which HQ create steps must succeed before leaving `creating` | **DECIDED BY AGENT AS EXPERT 2026-10-31 (P2.2):** only the required steps, the tenant row and the base currency. Initialization (branches, categories, catalog, preferences) runs after the switch and stays best-effort with per-step results and `reinitialize`, as today. Reason: those steps already fail partially by design (e.g. no categories → step 3 fails), they write rows with `RESTRICT` FKs that would block a rollback, and the wizard relies on a created tenant plus a partial-success report. If the final switch fails, HQ rolls the row back (cheap: nothing else exists yet) instead of keeping it like signup does (where the auth user already exists). |
| A-33 | Counter cleanup when HQ deletes a tenant | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user asked for the safest design):** counters (`sys_doc_seq_counter_tr` rows) are removed **only** by the `0678` hard-delete trigger, in the same statement and transaction as the tenant delete, and only for a `creating` tenant. No app path (HQ or web-admin) deletes counter rows itself: a separate app delete could remove the counters of a tenant whose own delete is then refused (rule 4: codes never reused). HQ `rollbackCreatingTenant` now checks that a row was really deleted (`.select('id')`) and logs a warning when none was. |
| A-34 | Backfill of code columns on busy tables | **DECIDED BY AGENT AS EXPERT 2026-10-31:** `0682`/`0683` switch off every enabled user trigger on the table for the backfill only and switch the same set back on in the same transaction. Reason: the recalc trigger would rewrite order totals (a silent money change), removed-line guards would refuse history rows, and `updated_at` triggers would mark every line as edited. Only code columns and `metadata` change; old values are kept in `metadata.hfc_p3_old_srno` / `hfc_p3_old_barcode` (data: URL images are not kept). |
| A-35 | When an external tag is freed | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user rule: freed when the piece is removed or the order is delivered/cancelled; old tag stays as history):** new column `org_order_item_pieces_dtl.tag_released_at` (NULL = live). `uq_ord_piece_barcode` is UNIQUE `(tenant_org_id, barcode)` only `WHERE deleted_order_change_id IS NULL AND tag_released_at IS NULL`. `trg_ord_piece_tag_release` on `org_orders_mst` sets it when `status` or `current_status` becomes delivered, **closed** or cancelled. The piece keeps the tag value for tracing. Reopening an order does not take tags back; saving the tag again on an open order clears `tag_released_at` and the index re-checks it. Reason: a timestamp instead of clearing the value keeps scan history, needs no data rewrite and is reversible; a trigger on the order covers every status writer. |
| A-36 | Tag format | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user rule; replaces the A-16 charset "printable ASCII ≤ 64"):** trim + UPPER-case, only `A-Z 0-9 - _ . /`, 1..64. App: `externalTagSchema` (400 `PIECE_TAG_INVALID`, reasons EMPTY / TOO_LONG / BAD_CHARACTERS). DB: `trg_ord_piece_tag_rules` normalises (blank → NULL) and `ck_ord_piece_barcode_fmt` guards; 0683 normalises existing live tags (old value in `metadata.hfc_p3_old_barcode`). Removed pieces are exempt (immutable history, 0548). |
| A-37 | Tags that look like our codes | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user rule):** refused when the tag starts with any `sys_doc_seq_type_cd` prefix or type_prefix (plus ORD, ITM, PEC), an optional `- _ . /`, then a digit: order, line, piece codes and every doc code; `CMX1:` payloads fail on `:` and on the CMX prefix. App: `looksLikeCode` with the prefixes from the registry (static fallback), 400 `PIECE_TAG_LOOKS_LIKE_CODE`. DB: trigger (`fn_ord_piece_tag_code_re`, SQLSTATE 23514, on insert or change only) plus the static backstop `ck_ord_piece_barcode_not_code`. Open: the one-letter prefixes `U`, `Z` refuse `U1`, `Z9` (R20). |
| A-38 | Batch-update with tags | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user rule):** every tag of the batch is checked first (format, code shape, duplicates inside the batch, live holders); on any problem nothing is saved and the response lists all problems (`issues[]`, `piecesUpdated: 0`; 400 / 409 by the first problem). Pieces are then saved one by one (unchanged); a clash at the same instant is refused by the DB index and returned as 409 `PIECE_TAG_IN_USE` with `piecesUpdated` and `partial`. EN/AR messages `processing.modal.error.tag*`. |
| A-39 | P3 review choices | **ACCEPTED BY USER 2026-10-31** (after P3 was applied): (1) closed orders free their tags, like delivered and cancelled (A-35); (2) a reopened order keeps its tags released, staff save the tag again if needed (R21); (3) the one-letter registry prefixes `U` and `Z` refuse tags such as `U1`, `Z9` (A-37, R20); (4) the release trigger `trg_ord_piece_tag_release` is `SECURITY DEFINER` (fixed `search_path`) so every writer of `org_orders_mst` releases the tags (R22); (5) the piece `PATCH` tag path moved to P3b and now uses the batch-update checks. |
| A-40 | P3b scan design | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user delegated):** (a) code-shaped input is never looked up as a tag (A-37 makes them disjoint), so `SCAN_AMBIGUOUS` is kept only as a guard; (b) removed pieces are found by their code (`removed: true`, no tag link) but never by a tag; (c) another tenant's code and a missing code both give 404 `SCAN_NOT_FOUND` (no enumeration); an unknown or mismatched `CMX1:` type gives 422 `SCAN_UNSUPPORTED_PAYLOAD`; (d) piece `PATCH` and `external-tag PUT` return the batch-update body and status for a refused tag (400 / 409 `PIECE_TAG_*`, `heldByPieceCode`); (e) `external-tag PUT` refuses a delivered / closed / cancelled order (409 `PIECE_TAG_ORDER_CLOSED`) and a removed piece (409 `PIECE_TAG_PIECE_REMOVED`); `DELETE` is allowed on closed orders; both need the CSRF header; (f) limiter `scan-user` 600/min per user; (g) the wedge reads `KeyboardEvent.code` (layout-proof); inside a text field `CmxScanInput` reads the field on Enter; scanners clear the field after every scan, also a failed one; (h) the flag is read by its raw key `human_codes_scan_labels` and fails closed; it joins the flag catalog in P6 (T6.3); (i) `jest-axe@^10` (v11 needs Jest 30; the repo has Jest 29). |
| A-41 | Global scan shortcut | **APPROVED BY USER 2026-10-31:** keep `Ctrl+Shift+F` (also `Cmd+Shift+F`, physical key). Closes A-11's TO CONFIRM and R25. |
| A-42 | Assembly scan backend | **APPROVED BY USER 2026-10-31:** `AssemblyService.scanItem` first matches its own barcodes exactly as before; on a miss it asks `ScanResolveService` (context `assembly`) and accepts a piece code, line code, `CMX1:` QR or live tag of a piece **of the task's order** that maps to a pending assembly item (`order_item_id`). Removed pieces, other orders and order-only codes stay "not found"; the response shape is unchanged; a resolver error is logged and treated as not found. |
| A-43 | Scan rate limit | **APPROVED BY USER 2026-10-31:** keep `scan-user` at 600 scans per minute per user, failing open when Upstash is down (like the other limiters). |
| A-44 | `CmxDialog` accessible name | **APPROVED BY USER 2026-10-31:** `CmxDialogTitle` / `CmxDialogDescription` register their ids (own `id` kept, else `useId`), so the dialog gets `aria-labelledby` / `aria-describedby` without any caller change; new optional `aria-label` / `aria-labelledby` / `aria-describedby` props win when given. The scan dialog axe test runs the full rule set again (no `aria-dialog-name` skip). |
| A-45 | P4 label design | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user delegated):** (a) settings gated by the resolver ceiling (0652): while `label_printing` is off the four `LABEL_*` settings resolve to their defaults and the receipt barcode stays off until `human_codes_scan_labels` is on; (b) the print button is always enabled (values come from `order_no`, the old image columns are ignored); (c) barcodes encode the code as shown, hyphens kept; the order label QR is `CMX1:ORD:<order_no>`, piece tags get `CMX1:PEC:<piece_code>` only when `LABEL_PIECE_TAG_QR` is on; (d) the customer is printed as first name + last initial ("Ahmed B."), never the phone, and hidden when `LABEL_SHOW_CUSTOMER_NAME` is off; (e) printing renders React into a hidden iframe (no HTML strings, no pop-up blocker); (f) the digital receipt (`receipt-service.ts`) is unchanged, its tracking QR stays; (g) `label_printing_58mm` / `label_printing_80mm` are not checked per size (any allowed size prints when `label_printing` is on) — see open item in `USER_GUIDE_LABELS.md`. **Updated 2026-10-31:** (a) replaced by A-46/A-47 (config tables, no `label_printing` gate); (g) approved by A-48. |
| A-46 | Label options storage | **APPROVED BY USER 2026-10-31:** the five `sys_tenant_settings_cd` rows of the first 0685 draft (never applied) are replaced by typed config tables: `sys_label_printing_cf` (platform defaults, one row per label type `ORDER_LABEL`, `PIECE_TAG`, `RECEIPT`) and `org_label_printing_cf` (tenant-wide override when `branch_id` is NULL, branch override when set; every value column nullable, NULL = inherit; `UNIQUE NULLS NOT DISTINCT (tenant_org_id, label_type, branch_id)`, composite branch FK, RLS on `current_tenant_id()`). Fields: `size_code`, `show_qr`, `show_customer_name` (order label), `show_order_barcode` (receipt), `copies` 1–10; columns that do not apply to a label type must be NULL (CHECK). One resolver `fn_label_printing_resolve(tenant, branch)` resolves each field branch → tenant → system and returns `value_sources` (`BRANCH` / `TENANT` / `SYSTEM` / `FEATURE_FLAG`). App: `LabelPrintingConfigService` (resolve + admin read/save; an override whose values are all NULL is deleted). Follows the 0640 / 0667 config-table pattern. |
| A-47 | `label_printing` flag | **APPROVED BY USER 2026-10-31** ("no need for label_printing feature flag let it available for all"): label printing and its options are available to every tenant; no code or SQL checks `label_printing`. The flag row is **not** deleted: it stays in the HQ flag catalog (seeds 0066/0067, `scripts/flag-catalog-db.json`) and `lib/constants/feature-flags.ts` marks `LABEL_PRINTING` `@deprecated`. Recommendation: retire it later from HQ (plans / catalog) with a separate approval. `human_codes_scan_labels` stays: it gates the scan UI and caps the receipt barcode (resolver source `FEATURE_FLAG`). |
| A-48 | P4 open recommendations | **APPROVED BY USER 2026-10-31:** (1) `label_printing_58mm` / `label_printing_80mm` are not checked per size; every allowed size prints for every tenant; (2) the old image columns `org_orders_mst.qr_code` and `org_orders_mst.barcode` (D4, no longer read since P4) get a `DEPRECATED` `COMMENT ON` in P6/P9 and are dropped only with a separate approval; (3) bulk printing of many orders at once is left for a later phase. |
| A-49 | Labels settings screen | **DECIDED BY AGENT AS EXPERT 2026-10-31 (user delegated):** Settings → **Labels & Tags** (`/dashboard/settings/labels`, nav `settings_labels`, order 62, icon Tag, roles admin / super_admin / tenant_admin); page and `GET /api/v1/settings/label-printing` need `settings:read`, `PUT` needs `settings:update` (CSRF + tenant rate limit + zod); scope select "All branches" or one branch, locked while there are unsaved changes; each field offers "Use default (value)" and shows "In use: value (source)"; view-only when the user lacks `settings:update`; EN/AR (`messages/{en,ar}/labelSettings.json`), RTL-safe. Contract in `SETTINGS_ACCESS_CONTRACTS`. |
| A-50 | P5 fallback switch | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the one-release fallback (T5.2) is a code constant `STORE_CREDIT_NOTE_NUMBERING` (`'ENGINE'` default, `'LEGACY'`) in `web-admin/lib/constants/doc-seq.ts`, not an env var or a flag. Reason: a rollback must be deployed together with the DB rollback (drop the triggers), so a deploy-time constant is the safest and simplest; nothing to configure per environment. Removed in P9 (T9.3) |
| A-51 | P5 missing-number guard | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** ENGINE mode inserts `credit_note_no: ''` (no COUNT query) and checks the returned row; if the number is empty it throws `STORE_CREDIT_NOTE_NO_NOT_ASSIGNED`, which rolls the surrounding transaction back (refund / cancel / overpayment stay unchanged). Reason: `no-silent-money-mutation` — a credit note must never be issued without a number. Any non-empty number is accepted (old `CN-` too), so the check never blocks a valid insert |
| A-52 | P5 counter start | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** old `CN-<tenant8>-NNNNN` rows are kept (no backfill); the SCN counter starts at 1 per tenant per year and is seeded from any existing `SCN-YYYY-n` rows (normally none). Reason: reversible, no data rewrite, `SCN-` cannot clash with `CN-` |
| A-53 | P5 trigger type and order | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** generic trigger `fn_doc_seq_assign_code` (low-volume table, as the `0670` header allows); apply `0687` **before** deploying the P5 web-admin code (the old code keeps working after the apply because a supplied value is kept). Reason: each step alone is safe; the reverse order would make the new code stop with `STORE_CREDIT_NOTE_NO_NOT_ASSIGNED` until the apply |
| A-54 | P6 HQ role grants | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** `0688` adds the 3 HQ codes and **no** `hq_role_permissions` row. SUPER_ADMIN already holds `*`, which matches every code; other roles (TECH_ADMIN etc.) get them from the HQ Roles screen. Why: least privilege, the same as `hq_notifications:operate` in `0625`, and nothing to undo if you want different roles. Recommendation: after P7 is deployed, give `hq_doc_seq:read` to TECH_ADMIN and SUPPORT, and `hq_general_config:manage` only to TECH_ADMIN. |
| A-55 | P6 tenant side | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** no tenant `sys_auth_permissions` row (A-09 default: scan and label APIs reuse `orders:read`), so the UI access contract does not change and T6.4 is not needed; `navigation_doc_seq` is skipped (HQ nav is the code edit in P7); `ff_human_codes` was already delivered as `human_codes_scan_labels` in `0684`. |
| A-56 | P6 deprecated image columns | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the A-48 (2) `COMMENT ON` for `org_orders_mst.qr_code` / `barcode` ships now as `0689` (comment only; this also covers T9.4). The columns stay; a drop needs a separate approval. |
| A-57 | P7 HQ API shape | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** routes are `/api/hq/v1/doc-seq/…` and `/api/hq/v1/general-config` (the global prefix adds `/api/hq/v1`). Every route uses `JwtAuthGuard` + `HqIdentityGuard` + `HqPermissionGuard`; reads need `hq_doc_seq:read` / `hq_general_config:read`, the save needs `hq_general_config:manage`. Extra read route `GET general-config/options` (currency, country, language lists for the edit form). Errors: bad time zone → 422 `BAD_TIMEZONE`, unknown lookup (FK) → 422 `BAD_LOOKUP`, CHECK failure → 400. Reason: same guards and envelope as the other HQ modules; the options list keeps the screen to one call. |
| A-58 | General Config concurrency and audit | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the client sends `version` (= `updated_at`, or `created_at` when never updated) in the `PATCH` body; a different value returns 409 `STALE_CONFIG` and nothing is written. Only changed fields are written and audited (old → new). Reason: a single shared row edited by several admins; a body field is simpler than an `If-Match` header through the proxy and is fully reversible. |
| A-59 | Consistency and preview | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** data-check severity is derived: duplicate code or counter behind the data → ERROR; empty or NULL codes → WARN. The consistency report is cached 60 s per API process; `refresh=true` is allowed once per 10 s (else 429) and the screen's "Run again" button has the same 10 s cooldown. Preview works only for GENERAL types and never touches a counter. Reason: the data checks scan real tables, so they must not run on every page view. |
| A-60 | HQ screens and nav | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** pages `/system-codes/doc-seq-types` and `/system-codes/doc-seq-consistency` (sidebar Data group, after Cash/POS) and `/settings/general-config` (Settings group, after Audit). HQ `CmxCodeChip` is a copy of the tenant chip (A-15) with an extra `doc` kind; its copy toast uses `common.dataTable.copied` (there is no `common.copied` key in HQ). Reason: matches the existing HQ route groups; no nav migration (A-22). |
| A-61 | General Config edit safety | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** changing a period field (time zone, fiscal-year start month) asks for confirmation first, because it changes how yearly/monthly counters reset for new tenants. After a 409 the dialog shows a conflict note and "Load latest"; the form reloads and the admin applies the change again (no silent merge). |
| A-62 | Wizard prefill (A-13) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the tenant creation wizard reads General Config once and replaces a field (country, currency, time zone, language, trial days, default branch country) **only while it still holds the built-in default**, so nothing the operator typed is overwritten; "reset" applies the platform defaults again. Without `hq_general_config:read`, or on any error, the built-in defaults stay (no error shown). Reason: best effort, no new permission needed to create tenants. |
| A-63 | P7 test tooling | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** `jest-axe` (A-25) is **not** added to `platform-web/package.json` yet: adding it needs `npm install` and a lockfile change on your machine, which I did not run. Follow-up for you: `npm i -D jest-axe@^10 @types/jest-axe` in `platform-web`, then a11y tests can be added. `next build` was not run (long, writes `.next`); tsc, eslint, jest and `check:i18n` are green. Note: `npm run verify:schema` was run once on 2026-10-31; it makes read-only `SELECT` checks against the database configured in your HQ `.env` (all 7 tables OK). It changed nothing, but it is a DB connection, so it is reported here. |
| A-64 | P8 mobile code helpers | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the Dart helpers live in `cmx_mobile_apps/packages/mobile_core/lib/src/human_codes.dart`, a 1:1 copy of web-admin `code-format-schemas.ts` + `cmx-code-payload.ts` (same regexes, `normalizeScanInput`, `classifyCode`, `encodeCmxPayload` / `decodeCmxPayload`, max scan length 128), exported from `mobile_core.dart`. Codes are shown with `ltrCode(code)` (wraps in U+2066 … U+2069, LRI/PDI) — **display only**, never stored or compared. The customer app order card and order detail title use it. The mobile apps have no staff scan yet, so the codec is ready but unused. The booking screen order number was **not** touched because it has your uncommitted edits. Follow-up: use `ltrCode` there when your edit is done. Reason: same rules on every client without a new package or build step; a copy is what A-15 chose. |
| A-65 | P8 cmx-api | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** **N/A.** `cmx-api/src` has only the auth and health modules (no orders, no scan). When an orders or scan module is added, copy `cmx-code-payload.ts` and `code-format-schemas.ts` (A-15) and look orders up by `order_no`. Recorded in DEV_GUIDE §24. |
| A-66 | P8 notifications | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** bug fixed: `web-admin/app/api/v1/orders/[id]/transition/route.ts` sent `order_number = <order UUID>`. It now reads `org_orders_mst.order_no` (tenant-filtered) and sends that; only if the read fails does it fall back to the UUID (old behaviour), so a committed transition never fails because of the message. Other templates (`0346`, `0382`, `order-event-variables.ts`) already use `order_no` as `{{order_number}}`. No credit-note message template exists, so `{{credit_note_no}}` (§10) is not added; add it with the first such template. The only `CN-<tenant8>` text left is the A-50 LEGACY fallback. |
| A-67 | P8 rule refresh (T8.4) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the HFC-RULE blocks were refreshed in both repos (`.cursor`, `.claude`, `.codex`; long and short forms) with: 12) reuse the shared helpers (web-admin `code-format-schemas.ts`, `cmx-code-payload.ts`, scans via `POST /api/v1/scan/resolve`; mobile `human_codes.dart`), show codes with `CmxCodeChip` / `CmxCodeSearchInput`, always LTR (`dir="ltr"`, mobile `ltrCode()`); 13) messages carry the code, never the UUID. HQ text now names the P7 screens and modules (`doc-seq-config`, `general-config`; never edit counters). `CLAUDE.md` / `AGENTS.md` pointers already pointed at these files and were left unchanged. Your uncommitted edits in these files were kept (fresh bases). |
| A-68 | P9 shims (T9.3) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** `lib/utils/order-number-generator.ts` **kept** (still imported by `lib/services/order-service.ts:16` and tests; it is the P2 rollback path). `lib/utils/barcode-generator.ts` **kept** (only its own test imports it, but removing it means deleting tracked files — follow-up). The A-50 `LEGACY` credit-note fallback **kept** (your instruction): removal is a dated follow-up ~2026-12-01, after one release with `0687` applied (the branch, the constant in `lib/constants/doc-seq.ts`, the `CN-` line in `stored-value.service.ts`). Reason: nothing is deleted while you are away; every rollback path stays. |
| A-69 | P9 ADR (T9.5) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** ADR-004 written in HQ `cleanmatexsaas/docs/Dev/ADRs/ADR-004-human-friendly-codes-shared-doc-seq-engine-api-based-sharing-pattern.md` (Status **Proposed**, scope Both, API-Based Sharing Pattern: engine in the tenant DB, HQ through `platform-api`). Number 004 because HQ `.claude/docs/Dev/ADR_INDEX.md` already lists an ADR-003 while `docs/Dev/ADRs/README.md` says next is 003; both indexes now say next is ADR-005. |
| A-70 | P9 docs pack (T9.1, T9.2, T9.6) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-10-31):** the default documentation pack (README, version 1.0.0, CHANGELOG, current_status, development_plan, progress_summary, developer_guide(+mermaid), user_guide EN/AR (+mermaid), deploy_guide, testing_guide_and_scenarios, technical_docs/README) plus `QA_TEST_GUIDE.md` (S1–S20) and `IMPLEMENTATION_REPORT.md` were added **next to** the existing docs (nothing moved, links kept). QA S1–S20 and the §11 performance checks need deployed environments, so they are written down with result "Pending (user-run on deployed env)". documentation-audit presence check: 13/13 pack items + report + QA guide present (2026-10-31). |
| A-71 | P11 A-54 HQ role grants as a migration (§25.1 #8) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-11-01):** new migration `0690_hq_doc_seq_role_grants.sql` replaces the manual SQL of DEV_GUIDE §22 step 6a. Grants `hq_doc_seq:read` → `TECH_ADMIN`, `SUPPORT`; `hq_general_config:read` + `hq_general_config:manage` → `TECH_ADMIN` only. `SUPER_ADMIN` untouched (`*`). Inserts into `hq_role_permissions` (`ON CONFLICT DO NOTHING`, `created_info = '0690 HFC doc seq role grants'`) and appends the code to the `hq_roles.permissions` JSON copy only when it is missing. A missing role or permission is skipped with a NOTICE; safe to run twice. Rollback in the file header. Users of those roles may need to sign in again. |
| A-72 | P11 retire `label_printing` in code (§25.1 #1, code part) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-11-01):** removed from web-admin `lib/constants/feature-flags.ts` (FLAG_CATALOG entry + `FEATURE_FLAG_KEYS.LABEL_PRINTING`) and `lib/types/tenant.ts` (`label_printing`). No reader was left (A-47). HQ repo has no code use. **Not changed:** the DB row in `hq_ff_feature_flags_mst` and its plan mappings, applied seeds `0066`/`0067`, the DB snapshot `scripts/flag-catalog-db.json`, the generated `data/platform/platform-info-inventory.json`, and the different flags `label_printing_58mm`, `label_printing_80mm`, `intake_label_printing`. Comment-only note in `0690`. Follow-up (needs approval): deactivate/delete the DB row + mappings, then run `npm run rebuild:platform-info-inventories`. |
| A-73 | P11 mobile booking `ltrCode` (§25.1 #10) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-11-01):** `customer_order_booking_screen.dart` success message shows `ltrCode(booking.submittedOrderNumber ?? '')` (one line; display only). No new widget test: the success state needs a full submit flow; `flutter analyze` clean. The existing booking test "shows grouped preferences on booking step two" fails on Windows (text "Packing preferences" not found, step 2, not the success message): not caused by this change, left for the user. |
| A-74 | P11 `{{credit_note_no}}` variable (§25.1 #11) | **DECIDED BY ASSISTANT WHILE USER AWAY, PLEASE REVIEW (2026-11-01):** new `web-admin/lib/notifications/credit-note-variables.ts` → `buildCreditNoteIssuedNotificationVariables()` gives `credit_note_no`, `invoice_number` (alias, the seeded `0382` `credit_note.issued` text uses `{{invoice_number}}`), optional `amount` / `currency`. `credit_note_no` added to the WhatsApp named-variable list; EN/AR hint text in `messages/*/notifications.json`. **Not emitted yet** and the DB template text is not changed: sending a real customer message needs a separate approval (follow-up). |

*P0 2026-10-30, approved 2026-10-30: §20.1–§20.4 are the APPROVED seeds as built in P1. They mirror `INVENTORY.md` §6–§8; references to "§n"/"S#"/"Q#" inside them point to `INVENTORY.md`. The pre-P0 drafts are kept below in collapsed blocks.*

### 20.1 A-01: APPROVED scopes, modules, sub-systems (2026-10-30)

**APPROVED 2026-10-30** with the user's changes. Reason: one lookup for every module that owns numbered records plus the platform (ORG and HQ) modules. Codes are UPPER_SNAKE; `short_code` is 2-5 capital letters (A-27), unique per table. Names are EN / AR. The migration `scope_modules` is the source of truth.

`sys_saas_scope_cd`

| scope_code | short_code | name | name2 | description |
|---|---|---|---|---|
| TENANT_ORG | ORG | Organization | المنشأة | Data owned by one tenant organization (tenant_org_id). |
| SYS | SYS | Platform-wide | على مستوى المنصة | Platform-wide data shared by all tenants (no tenant_org_id). |
| HQ | HQ | Platform administration | إدارة المنصة | HQ / SaaS back-office data, used by the HQ console only. |

`sys_modules_cd` (journals belong to ERP; ORG modules incl. notification, auth, RBAC, settings, audit, reports, integrations; HQ-only modules ops, billing, tenants, plans, support, marketing …)

| module_code | short_code | scope | name | name2 | covers |
|---|---|---|---|---|---|
| ORDERS | ORD | TENANT_ORG | Orders | الطلبات | Orders, items, pieces |
| FIN | FIN | TENANT_ORG | Finance | المالية | AR, refunds, vouchers, store credit, gift cards, AR operations |
| ERP | ERP | TENANT_ORG | ERP Lite | تخطيط الموارد | Journals, expenses, petty cash, procurement, AP, bank, allocation, costing |
| TAX | TAX | TENANT_ORG | Tax | الضرائب | Tax documents |
| POS | POS | TENANT_ORG | Point of sale | نقاط البيع | POS sessions, cash drawers, Z-reports |
| CRM | CRM | TENANT_ORG | Customers | العملاء | Customers |
| CATALOG | CAT | TENANT_ORG | Catalog | الكتالوج | Products and services |
| INVENTORY | INV | TENANT_ORG | Inventory | المخزون | Stock items and stock transactions |
| B2B | BIZ | TENANT_ORG | Business clients | عملاء الأعمال | Contracts, statements |
| DELIVERY | DLV | TENANT_ORG | Delivery | التوصيل | Routes |
| WORKFLOW | WFL | TENANT_ORG | Workflow | سير العمل | Workflow profiles and transitions |
| NTF | NTF | TENANT_ORG | Notifications | الإشعارات | Notification templates and deliveries |
| AUTH | AUTH | TENANT_ORG | Authentication | المصادقة | Sign-in and sessions |
| RBAC | RBAC | TENANT_ORG | Roles and permissions | الأدوار والصلاحيات | Roles, permissions |
| SETTINGS | STNG | TENANT_ORG | Settings | الإعدادات | Tenant settings |
| AUDIT | AUD | TENANT_ORG | Audit | التدقيق | Audit logs |
| REPORTS | RPT | TENANT_ORG | Reports | التقارير | Reports |
| INTEGRATIONS | INTG | TENANT_ORG | Integrations | التكاملات | Payment gateways, API clients |
| BRANCHES | BRN | TENANT_ORG | Branches | الفروع | Branches |
| CORE | CORE | SYS | Core | الأساسي | Users and shared platform identities |
| CURRENCY | CUR | SYS | Currencies | العملات | Currency catalog and FX rates |
| HQ_TENANTS | HTNT | HQ | Tenant management | إدارة المستأجرين | Tenants, tenant maintenance |
| HQ_BILLING | HBIL | HQ | Platform billing | فوترة المنصة | SaaS invoices, payments |
| HQ_PLANS | HPLN | HQ | Plans and subscriptions | الخطط والاشتراكات | Plans, subscriptions |
| HQ_OPS | HOPS | HQ | Platform operations | عمليات المنصة | Ops jobs, operations, config, health |
| HQ_SUPPORT | HSUP | HQ | Support | الدعم | Support tickets |
| HQ_CRM | HCRM | HQ | Platform marketing | تسويق المنصة | Marketing leads, content, tracking |
| HQ_AUTH | HAUTH | HQ | HQ authentication | مصادقة المنصة | HQ sign-in and sessions |
| HQ_RBAC | HRBAC | HQ | HQ roles and permissions | أدوار وصلاحيات المنصة | HQ roles, permissions |
| HQ_NTF | HNTF | HQ | HQ notifications | إشعارات المنصة | Platform notification deliveries |
| HQ_SETTINGS | HSTNG | HQ | HQ settings | إعدادات المنصة | General config, document sequences |
| HQ_AUDIT | HAUD | HQ | HQ audit | تدقيق المنصة | HQ audit logs |
| HQ_CORE_DATA | HCDM | HQ | Core data management | إدارة البيانات الأساسية | Code tables |
| HQ_FLAGS | HFFL | HQ | Feature flags | مفاتيح الميزات | Feature flags |
| HQ_DEV | HDEV | HQ | Developer portal | بوابة المطورين | Developer portal |

`sys_module_sub_systems_cd`

| module_code | sub_system_code | short_code | name | name2 |
|---|---|---|---|---|
| ORDERS | ORDER | ORDR | Order | الطلب |
| ORDERS | ORDER_ITEM | ORDI | Order item | بند الطلب |
| ORDERS | ORDER_PIECE | ORDP | Order piece | قطعة الطلب |
| FIN | AR | FAR | Accounts receivable | الذمم المدينة |
| FIN | REFUND | FREF | Refunds | المبالغ المستردة |
| FIN | VOUCHER | FVCH | Vouchers | السندات |
| FIN | STORE_CREDIT | FSCN | Store credit | رصيد المتجر |
| FIN | GIFT_CARD | FGCD | Gift cards | بطاقات الهدايا |
| FIN | AR_OPS | FARO | AR operations | عمليات الذمم المدينة |
| ERP | JOURNAL | EJRL | Journals | القيود اليومية |
| ERP | EXPENSE | EEXP | Expenses | المصروفات |
| ERP | PETTY_CASH | EPCH | Petty cash | العهدة النقدية |
| ERP | PROCUREMENT | EPRC | Procurement | المشتريات |
| ERP | AP | EAPY | Accounts payable | الذمم الدائنة |
| ERP | BANK | EBNK | Bank | البنوك |
| ERP | ALLOCATION | EALC | Allocation | التوزيع |
| ERP | COSTING | ECST | Costing | التكاليف |
| TAX | TAX_DOC | TDOC | Tax documents | المستندات الضريبية |
| POS | POS_SESSION | PSES | POS sessions | جلسات نقاط البيع |
| POS | CASH_DRAWER | PCDR | Cash drawers | أدراج النقد |
| POS | Z_REPORT | PZRP | Z-reports | تقارير Z |
| CRM | CUSTOMER | CCUS | Customers | العملاء |
| CATALOG | PRODUCT | CPRD | Products | المنتجات |
| INVENTORY | STOCK_ITEM | ISTK | Stock items | أصناف المخزون |
| INVENTORY | STOCK_TRX | ISTX | Stock transactions | حركات المخزون |
| B2B | CONTRACT | BCON | Contracts | العقود |
| B2B | STATEMENT | BSTM | Statements | كشوف الحساب |
| DELIVERY | ROUTE | DRTE | Routes | مسارات التوصيل |
| WORKFLOW | WF_PROFILE | WPRF | Workflow profiles | ملفات سير العمل |
| NTF | NTF_TEMPLATE | NTPL | Notification templates | قوالب الإشعارات |
| NTF | NTF_DELIVERY | NDLV | Notification deliveries | إرسال الإشعارات |
| AUTH | SESSION | ASES | Sessions | الجلسات |
| RBAC | ROLE | RROL | Roles | الأدوار |
| RBAC | PERMISSION | RPRM | Permissions | الصلاحيات |
| SETTINGS | TENANT_SETTING | STST | Tenant settings | إعدادات المنشأة |
| AUDIT | AUDIT_LOG | AULG | Audit log | سجل التدقيق |
| REPORTS | REPORT | RRPT | Reports | التقارير |
| INTEGRATIONS | PAYMENT_GATEWAY | IPGW | Payment gateways | بوابات الدفع |
| INTEGRATIONS | API_CLIENT | IAPI | API clients | عملاء الواجهة البرمجية |
| BRANCHES | BRANCH | BBRN | Branches | الفروع |
| CORE | USER | CUSR | Users | المستخدمون |
| CURRENCY | CURRENCY_CD | XCUR | Currencies | العملات |
| CURRENCY | FX_RATE | XFXR | Exchange rates | أسعار الصرف |
| HQ_TENANTS | TENANT | HTEN | Tenants | المستأجرون |
| HQ_TENANTS | TENANT_MAINT | HTMN | Tenant maintenance | صيانة المستأجرين |
| HQ_BILLING | SAAS_INVOICE | HINV | SaaS invoices | فواتير المنصة |
| HQ_BILLING | PAYMENT | HPAY | SaaS payments | مدفوعات المنصة |
| HQ_PLANS | PLAN | HPLA | Plans | الخطط |
| HQ_PLANS | SUBSCRIPTION | HSUB | Subscriptions | الاشتراكات |
| HQ_OPS | OPS_JOB | HJOB | Ops jobs | مهام التشغيل |
| HQ_OPS | OPS_OPERATION | HOPR | Ops operations | عمليات التشغيل |
| HQ_OPS | OPS_CONFIG | HCFG | Ops config | إعدادات التشغيل |
| HQ_OPS | OPS_HEALTH | HHLT | Ops health | صحة المنصة |
| HQ_SUPPORT | TICKET | HTKT | Support tickets | تذاكر الدعم |
| HQ_CRM | LEAD | HLED | Marketing leads | العملاء المحتملون |
| HQ_CRM | CONTENT | HCNT | Marketing content | المحتوى التسويقي |
| HQ_CRM | TRACKING | HTRK | Marketing tracking | التتبع التسويقي |
| HQ_AUTH | HQ_SESSION | HSES | HQ sessions | جلسات المنصة |
| HQ_RBAC | HQ_ROLE | HROL | HQ roles | أدوار المنصة |
| HQ_RBAC | HQ_PERMISSION | HPRM | HQ permissions | صلاحيات المنصة |
| HQ_NTF | HQ_NTF_DELIVERY | HNDL | HQ notification deliveries | إرسال إشعارات المنصة |
| HQ_SETTINGS | GENERAL_CONFIG | HGCF | General config | الإعدادات العامة |
| HQ_SETTINGS | DOC_SEQ | HDSQ | Document sequences | تسلسل المستندات |
| HQ_AUDIT | HQ_AUDIT_LOG | HAUL | HQ audit log | سجل تدقيق المنصة |
| HQ_CORE_DATA | CODE_TABLE | HCTB | Code tables | جداول الرموز |
| HQ_FLAGS | FEATURE_FLAG | HFFG | Feature flags | مفاتيح الميزات |
| HQ_DEV | DEV_PORTAL | HDVP | Developer portal | بوابة المطورين |

<details><summary>Pre-P0 draft of §20.1/§20.2 (superseded, kept for history)</summary>

#### 20.1 (pre-P0) A-01: PROPOSED scopes, modules, sub-systems (to be refined by P0)

| Table | Rows (code: name EN / AR) |
|---|---|
| `sys_saas_scope_cd` | `TENANT_ORG`: Organization / المنشأة · `SYS`: Platform-wide / على مستوى المنصة · `HQ`: Platform administration / إدارة المنصة |
| `sys_modules_cd` | `ORDERS` Orders / الطلبات · `FIN` Finance / المالية · `TAX` Tax / الضرائب · `POS` Point of sale / نقاط البيع · `CRM` Customers / العملاء · `CORE` Core / الأساسي |
| `sys_module_sub_systems_cd` | `ORDERS/ORDER`, `ORDERS/ORDER_ITEM`, `ORDERS/ORDER_PIECE`, `FIN/AR`, `FIN/REFUND`, `FIN/VOUCHER`, `FIN/STORE_CREDIT`, `TAX/TAX_DOC`, `POS/POS_SESSION`, `POS/CASH_DRAWER`, `CRM/CUSTOMER`, `CORE/USER` |

#### 20.2 (pre-P0) A-02: PROPOSED doc types (targets and formats TO VERIFY in P0)

| doc_type_code | Prefix | Scope | Category | parts_format / pad | Reset | Level | Target | Managed by |
|---|---|---|---|---|---|---|---|---|
| ORDER | ORD | TENANT_ORG | TRANSACTION | `YYYYMMDD-SEQ` / 4 | DAILY | **GENERAL** | `org_orders_mst.order_no` | engine (+ `generate_order_number` wrapper, `fn_ord_next_sub_order_no` for `-S<n>`) |
| ORDER_ITEM | — | TENANT_ORG | TRANSACTION | `PARENT-SEQ` / 0 | PER_PARENT | DOMAIN | `org_order_items_dtl.order_item_srno` | `fn_next_order_item_srno` |
| ORDER_PIECE | — | TENANT_ORG | TRANSACTION | `PARENT-SEQ` / 0 | PER_PARENT | DOMAIN | `org_order_item_pieces_dtl.piece_code` | `fn_ord_piece_code_set` |
| STORE_CREDIT_NOTE | **SCN** | TENANT_ORG | TRANSACTION | `YYYY-SEQ` / 6 | YEARLY | **GENERAL** | `org_credit_notes_mst.credit_note_no` | engine |
| AR_INVOICE | ARI | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | `fn_next_fin_doc_no` |
| REFUND | REF | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | `fn_next_fin_doc_no` |
| TAX_INVOICE | INV | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | tax domain fn (TO VERIFY) |
| TAX_SIMPLIFIED | SIM | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | tax domain fn |
| TAX_CREDIT_NOTE | CN | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | tax domain fn |
| TAX_DEBIT_NOTE | DN | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | tax domain fn |
| RECEIPT_VOUCHER | RV | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | voucher fn (TO VERIFY) |
| PAYMENT_VOUCHER | PV | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | voucher fn |
| ADJUSTMENT_VOUCHER | ADJ | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | voucher fn |
| POS_SESSION | POS | TENANT_ORG | TRANSACTION | as today (incl. `RAND` if used) | as today | DOMAIN | TO VERIFY | `generate_session_no` |
| CASH_DRAWER_SESSION | SES | TENANT_ORG | TRANSACTION | `YYYYMMDD-SEQ` / 4 (as 0270) | DAILY | DOMAIN | TO VERIFY | `generate_cash_drawer_sess_no` |
| CASH_DRAWER_TRX | TO VERIFY | TENANT_ORG | TRANSACTION | as today | as today | DOMAIN | TO VERIFY | `generate_cash_drawer_trx_no` |
| CUSTOMER | CUST | TENANT_ORG | MASTER_DATA | `SEQ` / 5 | NEVER | DOMAIN (A-04) | `org_customers_mst.<column>` TO VERIFY | `generate_customer_number` |
| USER | — (TO VERIFY) | SYS | MASTER_DATA | TO VERIFY | NEVER | DOMAIN (A-20) | `org_users_mst.user_code` (table TO VERIFY) | `fn_org_user_code_next()` |

</details>

### 20.2 A-02: APPROVED doc types (2026-10-30)

**APPROVED 2026-10-30.** Reason: every code found in P0 is registered with its owner and format; nothing is regenerated.
- **P1 is DOMAIN-first:** all 51 rows are `DOMAIN` (existing generator stays). P2 switches ORDER, P5 switches STORE_CREDIT_NOTE (printed prefix becomes `SCN`) to `GENERAL` in the same migration that seeds the counter and adds the triggers.
- **`type_prefix`** is unique across all rows (3-5 letters). It is the type key in scan payloads (`CMX1:<type_prefix>:<code>`). For GENERAL rows the printed prefix equals it. DOMAIN rows keep their printed prefix (shared ones: `CN`, `INV`, `CMX`); child codes (ORDER_ITEM, ORDER_PIECE, POS_Z_REPORT …) keep their own value format.
- The full `implement_description` of each row (how it works today, the owner, the period rule, a check query, and the `type_prefix` meaning) is in the `doc_seq_type_config` migration.
- Pads never truncate.

| # | doc_type_code | type_prefix | printed prefix | scope | module/sub | parts / pad | reset | level (P1) | target | managed_by_object |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ORDER | **ORD** | ORD | TENANT_ORG | ORDERS/ORDER | `YYYYMMDD-SEQ` / 4 | DAILY | DOMAIN | `org_orders_mst.order_no` | `public.generate_order_number(uuid)` |
| 2 | ORDER_ITEM | **ITM** | — | TENANT_ORG | ORDERS/ORDER_ITEM | `PARENT-SEQ` / 0 | PER_PARENT | DOMAIN | `org_order_items_dtl.order_item_srno` | `public.fn_next_order_item_srno(uuid,uuid)` |
| 3 | ORDER_PIECE | **PEC** | — | TENANT_ORG | ORDERS/ORDER_PIECE | `PARENT-SEQ` / 0 | PER_PARENT | DOMAIN | `org_order_item_pieces_dtl.piece_code` | `public.org_order_item_pieces_dtl` |
| 4 | STORE_CREDIT_NOTE | **SCN** | CN | TENANT_ORG | FIN/STORE_CREDIT | `RAND-SEQ` / 5 | NEVER | DOMAIN | `org_credit_notes_mst.credit_note_no` | `app:web-admin/lib/services/stored-value.service.ts` |
| 5 | FIN_JOURNAL | **JRL** | — | TENANT_ORG | ERP/JOURNAL | `SEQ` / 6 | NEVER | DOMAIN | `org_fin_journal_mst.journal_no` | `public.fn_next_fin_doc_no(uuid,character varying)` |
| 6 | AR_INVOICE | **ARI** | ARI | TENANT_ORG | FIN/AR | `SEQ` / 6 | NEVER | DOMAIN | `org_invoice_mst.invoice_no` | `public.fn_next_fin_doc_no(uuid,character varying)` |
| 7 | REFUND | **REF** | REF | TENANT_ORG | FIN/REFUND | `SEQ` / 6 | NEVER | DOMAIN | `org_order_refunds_dtl.refund_no` | `public.fn_next_fin_doc_no(uuid,character varying)` |
| 8 | TAX_INVOICE | **INV** | INV | TENANT_ORG | TAX/TAX_DOC | `YYYY-SEQ` / 6 | FISCAL_YEAR | DOMAIN | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` |
| 9 | TAX_SIMPLIFIED | **SIM** | SIM | TENANT_ORG | TAX/TAX_DOC | `YYYY-SEQ` / 6 | FISCAL_YEAR | DOMAIN | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` |
| 10 | TAX_CREDIT_NOTE | **TCN** | CN | TENANT_ORG | TAX/TAX_DOC | `YYYY-SEQ` / 6 | FISCAL_YEAR | DOMAIN | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` |
| 11 | TAX_DEBIT_NOTE | **TDN** | DN | TENANT_ORG | TAX/TAX_DOC | `YYYY-SEQ` / 6 | FISCAL_YEAR | DOMAIN | `org_tax_documents_mst.document_no` | `app:web-admin/lib/services/tax-document-sequence.service.ts` |
| 12 | RECEIPT_VOUCHER | **RCV** | RV | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 6 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` |
| 13 | PAYMENT_VOUCHER | **PMV** | PV | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 6 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` |
| 14 | REFUND_VOUCHER | **RFV** | RF | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 6 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` |
| 15 | ADJUSTMENT_VOUCHER | **ADJ** | ADJ | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 6 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` |
| 16 | TRANSFER_VOUCHER | **TRV** | TR | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 6 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` |
| 17 | VOUCHER_OTHER | **VCH** | VCH | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 6 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-number.service.ts` |
| 18 | LEGACY_VOUCHER | **VCR** | — | TENANT_ORG | FIN/VOUCHER | `YYYY-SEQ` / 5 | YEARLY | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `app:web-admin/lib/services/voucher-service.ts` |
| 19 | POS_SESSION | **POS** | POS | TENANT_ORG | POS/POS_SESSION | `YYYYMMDD-RAND` / 8 | NEVER | DOMAIN | `org_pos_sessions_mst.session_no` | `app:web-admin/lib/services/pos-session.service.ts` |
| 20 | POS_Z_REPORT | **ZRP** | Z | TENANT_ORG | POS/Z_REPORT | `PARENT` / 0 | PER_PARENT | DOMAIN | `org_pos_shift_z_rpt_tr.report_no` | `app:web-admin/lib/services/pos-shift-report.service.ts` |
| 21 | CASH_DRAWER_SESSION | **SES** | SES | TENANT_ORG | POS/CASH_DRAWER | `YYYYMMDD-SEQ` / 4 | DAILY | DOMAIN | `org_cash_drawer_sessions_mst.session_no` | `public.generate_cash_drawer_sess_no(uuid)` |
| 22 | CASH_DRAWER_TRX | **CDT** | CDT | TENANT_ORG | POS/CASH_DRAWER | `YYYYMMDD-SEQ` / 4 | DAILY | DOMAIN | `org_cash_drawer_trx_mst.trx_no` | `public.generate_cash_drawer_trx_no(uuid)` |
| 23 | CUSTOMER | **CUST** | CUST | SYS | CRM/CUSTOMER | `SEQ` / 5 | NEVER | DOMAIN | `sys_customers_mst.customer_number` | `public.generate_customer_number(uuid)` |
| 24 | USER | **USR** | U | SYS | CORE/USER | `SEQ` / 6 | NEVER | DOMAIN | `org_users_mst.user_code` | `public.fn_org_user_code_next()` |
| 25 | PRODUCT | **PROD** | PROD | TENANT_ORG | CATALOG/PRODUCT | `SEQ` / 5 | NEVER | DOMAIN | `org_product_data_mst.product_code` | `app:web-admin/lib/services/catalog.service.ts` |
| 26 | STOCK_ITEM | **SKU** | INV | TENANT_ORG | INVENTORY/STOCK_ITEM | `SEQ` / 5 | NEVER | DOMAIN | `org_product_data_mst.product_code` | `app:web-admin/lib/services/inventory-service.ts` |
| 27 | GIFT_CARD | **GFT** | CMX | TENANT_ORG | FIN/GIFT_CARD | `RAND-RAND-RAND` / 4 | NEVER | DOMAIN | `org_gift_cards_mst.gift_card_code` | `app:web-admin/lib/services/gift-card-service.ts` |
| 28 | DELIVERY_ROUTE | **RTE** | RT | TENANT_ORG | DELIVERY/ROUTE | `YYYY-SEQ` / 3 | YEARLY | DOMAIN | `org_dlv_routes_mst.route_number` | `app:web-admin/lib/services/delivery/delivery-route-command.service.ts` |
| 29 | B2B_CONTRACT | **CON** | CON | TENANT_ORG | B2B/CONTRACT | `YYYYMM-SEQ` / 4 | MONTHLY | DOMAIN | `org_b2b_contracts_mst.contract_no` | `app:web-admin/lib/services/b2b-contracts.service.ts` |
| 30 | B2B_STATEMENT | **STMT** | STMT | TENANT_ORG | B2B/STATEMENT | `YYYYMM-SEQ` / 4 | MONTHLY | DOMAIN | `org_b2b_statements_mst.statement_no` | `app:web-admin/lib/services/b2b-statements.service.ts` |
| 31 | AR_DISPUTE | **ARD** | ARD | TENANT_ORG | FIN/AR_OPS | `RAND` / 4 | NEVER | DOMAIN | `org_ar_disputes_mst.dispute_no` | `app:web-admin/lib/services/ar-dispute.service.ts` |
| 32 | AR_DUNNING_RUN | **DUN** | — | TENANT_ORG | FIN/AR_OPS | `SEQ` / 0 | PER_PARENT | DOMAIN | `org_ar_dunning_runs_mst.run_no` | `app:web-admin/lib/services/ar-dunning-ops.service.ts` |
| 33 | AR_RECON_RUN | **RECON** | RECON | TENANT_ORG | FIN/AR_OPS | `YYYY-SEQ` / 3 | YEARLY | DOMAIN | `org_fin_recon_runs_mst.run_no` | `app:web-admin/lib/services/reconciliation.service.ts` |
| 34 | ERP_EXPENSE | **EXP** | EXP | TENANT_ORG | ERP/EXPENSE | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_exp_mst.expense_no` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` |
| 35 | ERP_PETTY_CASHBOX | **PCB** | PCB | TENANT_ORG | ERP/PETTY_CASH | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_cashbox_mst.cashbox_code` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` |
| 36 | ERP_PETTY_CASH_TXN | **PCT** | PCT | TENANT_ORG | ERP/PETTY_CASH | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_cash_txn_tr.txn_no` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` |
| 37 | ERP_PETTY_CASH_RECON | **PCR** | PCR | TENANT_ORG | ERP/PETTY_CASH | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_cash_rec_mst.recon_no` | `app:web-admin/lib/services/erp-lite-expenses.service.ts` |
| 38 | ERP_SUPPLIER | **SUP** | SUP | TENANT_ORG | ERP/PROCUREMENT | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_supp_mst.supplier_code` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 39 | ERP_PO | **PUR** | PO | TENANT_ORG | ERP/PROCUREMENT | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_po_mst.po_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 40 | ERP_AP_INVOICE | **API** | API | TENANT_ORG | ERP/AP | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_ap_inv_mst.ap_inv_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 41 | ERP_AP_PAYMENT | **APP** | APP | TENANT_ORG | ERP/AP | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_ap_pmt_mst.ap_pmt_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 42 | ERP_BANK_ACCOUNT | **BNK** | BNK | TENANT_ORG | ERP/BANK | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_bank_acct_mst.bank_code` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 43 | ERP_BANK_STATEMENT | **BST** | BST | TENANT_ORG | ERP/BANK | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_bank_stmt_mst.import_batch_no` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 44 | ERP_BANK_RECON | **BRC** | BRC | TENANT_ORG | ERP/BANK | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_bank_recon_mst.recon_code` | `app:web-admin/lib/services/erp-lite-v2.service.ts` |
| 45 | ERP_ALLOC_RULE | **ALR** | ALR | TENANT_ORG | ERP/ALLOCATION | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_alloc_rule_mst.rule_code` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` |
| 46 | ERP_ALLOC_RUN | **APR** | APR | TENANT_ORG | ERP/ALLOCATION | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_alloc_run_mst.run_no` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` |
| 47 | ERP_COST_COMPONENT | **CMP** | CMP | TENANT_ORG | ERP/COSTING | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_cost_cmp_cd.comp_code` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` |
| 48 | ERP_COST_RUN | **CRN** | CRN | TENANT_ORG | ERP/COSTING | `YYYYMM-SEQ` / 5 | MONTHLY | DOMAIN | `org_fin_cost_run_mst.run_no` | `app:web-admin/lib/services/erp-lite-phase10.service.ts` |
| 49 | HQ_SAAS_INVOICE | **HQI** | INV | HQ | HQ_BILLING/SAAS_INVOICE | `YYYY-SEQ` / 6 | NEVER | DOMAIN | `sys_bill_invoices_mst.invoice_no` | `public.sys_bill_generate_invoice_number()` |
| 50 | HQ_MARKETING_LEAD | **MLD** | CMX | HQ | HQ_CRM/LEAD | `YYYYMMDD-SEQ` / 6 | DAILY | DOMAIN | `hq_crm_marketing_leads.lead_code` | `public.hq_crm_marketing_lead_code_next()` |
| 51 | STOCK_TRANSACTION | **STK** | STK | TENANT_ORG | INVENTORY/STOCK_TRX | `YYYYMMDD-SEQ` / 4 | DAILY | DOMAIN | `org_inv_stock_tr.transaction_no` | `app:web-admin/lib/services/inventory-service.ts` |

Notes:
- Printed-prefix and target uniqueness are partial (GENERAL rows only) because DOMAIN rows share them (INVENTORY S11/S18); the consistency view reports shares as `PREFIX_SHARED` (WARN).
- New printed prefix in this plan: only **SCN** (P5). **ORD** is kept.

<details><summary>P0 PROPOSED draft of §20.2 (superseded 2026-10-30, kept for history)</summary>

| # | doc_type_code | Prefix | Scope | Module/Sub | Category | parts_format / pad | Reset | Level | Target | Draft `implement_description` |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ORDER | ORD | TENANT_ORG | ORDERS/ORDER | TRANSACTION | `YYYYMMDD-SEQ` / 4 grows | DAILY (tenant tz) | **GENERAL** | `org_orders_mst.order_no` | Engine `fn_org_doc_seq_next` via `generate_order_number` wrapper + BEFORE INSERT trigger; sub-orders `<root>-S<n>` by `fn_ord_next_sub_order_no` (A-19). |
| 2 | ORDER_ITEM | — | TENANT_ORG | ORDERS/ORDER_ITEM | TRANSACTION | `PARENT-SEQ` / 0 | PER_PARENT | DOMAIN | `org_order_items_dtl.order_item_srno` | Trigger `trg_set_order_item_srno` → `fn_next_order_item_srno(order_id, tenant)`: `<order_no>-<n>`; app may supply value at INSERT; immutable after insert (`ord_item_srno_barcode`). |
| 3 | ORDER_PIECE | — | TENANT_ORG | ORDERS/ORDER_PIECE | TRANSACTION | `PARENT-SEQ` / 0 | PER_PARENT | DOMAIN | `org_order_item_pieces_dtl.piece_code` | Trigger `fn_ord_piece_code_set`: `<order_item_srno>-<piece_seq>`; immutable (`ord_piece_code_human`). External tag lives in `barcode`. |
| 4 | STORE_CREDIT_NOTE | **SCN** | TENANT_ORG | FIN/STORE_CREDIT | TRANSACTION | `YYYY-SEQ` / 6 grows | YEARLY | **GENERAL** | `org_credit_notes_mst.credit_note_no` | Engine trigger `fn_doc_seq_assign_code('STORE_CREDIT_NOTE','credit_note_no')` (`fin_store_credit_note_scn`); legacy `CN-<tenant8>-n` rows kept; `org_order_credit_apps_dtl.credit_note_no` is a snapshot copy. |
| 5 | FIN_JOURNAL | — (NULL) | TENANT_ORG | FIN/JOURNAL | TRANSACTION | `SEQ` / 6 | NEVER | DOMAIN | `org_fin_journal_mst.journal_no` | `fn_next_fin_doc_no(tenant,'JOURNAL')` over `org_fin_doc_seq_mst`; called by the posting engine. |
| 6 | AR_INVOICE | ARI | TENANT_ORG | FIN/AR | TRANSACTION | `SEQ` / 6 (prefix `ARI-`) | NEVER | DOMAIN | `org_invoice_mst.invoice_no` | `fn_next_fin_doc_no(tenant,'AR_INV')` via `nextArInvoiceNumber` (`ar-invoice.service.ts`); prefix row seeded by 0314 (new tenants: TO FIX, §5 item 7). |
| 7 | REFUND | REF | TENANT_ORG | FIN/REFUND | TRANSACTION | `SEQ` / 6 (prefix `REF-`) | NEVER | DOMAIN | `org_order_refunds_dtl.refund_no` | `fn_next_fin_doc_no(tenant,'REFUND')` (`order-refund.service.ts:596`); prefix seeded by 0387. |
| 8 | TAX_INVOICE | INV | TENANT_ORG | TAX/TAX_DOC | TRANSACTION | `YYYY-SEQ` / 6 (YYYY = fiscal year) | FISCAL_YEAR | DOMAIN | `org_tax_documents_mst.document_no` | `allocateTaxDocumentSequence` (locked counter `org_tax_doc_seq_counters`). |
| 9 | TAX_SIMPLIFIED | SIM | TENANT_ORG | TAX/TAX_DOC | TRANSACTION | same | FISCAL_YEAR | DOMAIN | same | same |
| 10 | TAX_CREDIT_NOTE | CN | TENANT_ORG | TAX/TAX_DOC | TRANSACTION | same | FISCAL_YEAR | DOMAIN | same | same |
| 11 | TAX_DEBIT_NOTE | DN | TENANT_ORG | TAX/TAX_DOC | TRANSACTION | same | FISCAL_YEAR | DOMAIN | same | same |
| 12 | RECEIPT_VOUCHER | RV | TENANT_ORG | FIN/VOUCHER | TRANSACTION | `YYYY-SEQ` / 6 | YEARLY (server yr) | DOMAIN | `org_fin_vouchers_mst.voucher_no` | `generateBizVoucherNo` (`voucher-number.service.ts`), advisory lock `bvm_voucher_no_<tenant>`, lexical MAX. |
| 13 | PAYMENT_VOUCHER | PV | 〃 | FIN/VOUCHER | 〃 | 〃 | 〃 | DOMAIN | 〃 | 〃 |
| 14 | REFUND_VOUCHER | RF | 〃 | 〃 | 〃 | 〃 | 〃 | DOMAIN | 〃 | 〃 |
| 15 | ADJUSTMENT_VOUCHER | ADJ | 〃 | 〃 | 〃 | 〃 | 〃 | DOMAIN | 〃 | 〃 (prefix shared with legacy `VCR-ADJ`/`ADJ`, S10) |
| 16 | TRANSFER_VOUCHER | TR | 〃 | 〃 | 〃 | 〃 | 〃 | DOMAIN | 〃 | 〃 |
| 17 | VOUCHER_OTHER | VCH | 〃 | 〃 | 〃 | 〃 | 〃 | DOMAIN | 〃 | 〃 fallback prefix |
| 18 | LEGACY_VOUCHER | NULL (multi: VCR-RCP, VCR-PAY, VCR-ADJ, REF, CRN) | TENANT_ORG | FIN/VOUCHER | TRANSACTION | `YYYY-SEQ` / 5 | YEARLY | DOMAIN | 〃 | `voucher-service.ts generateVoucherNo` (legacy; one row, prefixes listed in description; retire in P10). |
| 19 | POS_SESSION | POS | TENANT_ORG | POS/POS_SESSION | TRANSACTION | `YYYYMMDD-RAND` / 8 | NEVER | DOMAIN | `org_pos_sessions_mst.session_no` (unique per tenant+branch) | `pos-session.service.ts:215` random suffix. |
| 20 | POS_Z_REPORT | Z | TENANT_ORG | POS/Z_REPORT | TRANSACTION | `PARENT` (S18c) | PER_PARENT | DOMAIN | `org_pos_shift_z_rpt_tr.report_no` | `Z-<session_no>` (`pos-shift-report.service.ts:350`). |
| 21 | CASH_DRAWER_SESSION | SES | TENANT_ORG | POS/CASH_DRAWER | TRANSACTION | `YYYYMMDD-SEQ` / 4 | DAILY (DB day) | DOMAIN | `org_cash_drawer_sessions_mst.session_no` | `generate_cash_drawer_sess_no` (0519), advisory lock tenant+date. |
| 22 | CASH_DRAWER_TRX | CDT | TENANT_ORG | POS/CASH_DRAWER | TRANSACTION | `YYYYMMDD-SEQ` / 4 | DAILY | DOMAIN | `org_cash_drawer_trx_mst.trx_no` | `generate_cash_drawer_trx_no` (0527). |
| 23 | CUSTOMER | CUST | TENANT_ORG | CRM/CUSTOMER | MASTER_DATA | `SEQ` / 5 | NEVER | DOMAIN (A-04) | `sys_customers_mst.customer_number` | `generate_customer_number` (0011) keyed by `first_tenant_org_id`; race fix in P10. |
| 24 | USER | U | SYS | CORE/USER | MASTER_DATA | `SEQ` / 6, separator '' | NEVER | DOMAIN (A-20) | `org_users_mst.user_code` | Column default `fn_org_user_code_next()` over global sequence `org_user_code_seq` (0563). |
| 25 | PRODUCT | PROD | TENANT_ORG | CATALOG/PRODUCT | MASTER_DATA | `SEQ` / 5 | NEVER | DOMAIN | `org_product_data_mst.product_code` | `catalog.service.ts:191 generateProductCode` (lexical MAX). |
| 26 | STOCK_ITEM | INV | TENANT_ORG | INVENTORY/STOCK_ITEM | MASTER_DATA | `SEQ` / 5 | NEVER | DOMAIN | `org_product_data_mst.product_code` (retail items) | `inventory-service.ts:73` (INV clash S11; shared target S17). |
| 27 | GIFT_CARD | CMX | TENANT_ORG | FIN/GIFT_CARD | MASTER_DATA | `RAND-RAND-RAND` | NEVER | DOMAIN | `org_gift_cards_mst.gift_card_code` | `gift-card-service.ts:261` random. |
| 28 | DELIVERY_ROUTE | RT | TENANT_ORG | DELIVERY/ROUTE | TRANSACTION | `YYYY-SEQ` / 3 grows | YEARLY | DOMAIN | `org_dlv_routes_mst.route_number` | Counter `org_dlv_route_seq_cf` (`delivery-route-command.service.ts:212`). |
| 29 | B2B_CONTRACT | CON | TENANT_ORG | B2B/CONTRACT | MASTER_DATA | `YYYYMM-SEQ` / 4 | MONTHLY | DOMAIN | `org_b2b_contracts_mst.contract_no` | `b2b-contracts.service.ts:99` count+1; manual override. |
| 30 | B2B_STATEMENT | STMT | TENANT_ORG | B2B/STATEMENT | TRANSACTION | `YYYYMM-SEQ` / 4 | MONTHLY | DOMAIN | `org_b2b_statements_mst.statement_no` | `b2b-statements.service.ts:81` count+1. |
| 31 | AR_DISPUTE | ARD | TENANT_ORG | FIN/AR_OPS | TRANSACTION | `RAND` | NEVER | DOMAIN | `org_ar_disputes_mst.dispute_no` | `ar-dispute.service.ts:66`: `ARD-<UTC yyyymmddhhmmss>-<4 base36>`. |
| 32 | AR_DUNNING_RUN | — | TENANT_ORG | FIN/AR_OPS | TRANSACTION | `SEQ` | PER_PARENT (customer) | DOMAIN | `org_ar_dunning_runs_mst.run_no` (per customer) | `ar-dunning-ops.service.ts:74`. |
| 33 | AR_RECON_RUN | RECON | TENANT_ORG | FIN/AR_OPS | TRANSACTION | `YYYY-SEQ` / 3 | YEARLY | DOMAIN | `org_fin_recon_runs_mst.run_no` | `reconciliation.service.ts:261` count+1. |
| 34 | ERP_EXPENSE | EXP | TENANT_ORG | ERP/EXPENSE | TRANSACTION | `YYYYMM-SEQ` / 5 | MONTHLY (UTC) | DOMAIN | `org_fin_exp_mst.expense_no` | `erp-lite-expenses.service.ts:1139` COUNT+1. |
| 35 | ERP_PETTY_CASHBOX | PCB | 〃 | ERP/PETTY_CASH | MASTER_DATA | 〃 | 〃 | DOMAIN | `org_fin_cashbox_mst.cashbox_code` | 〃 |
| 36 | ERP_PETTY_CASH_TXN | PCT | 〃 | ERP/PETTY_CASH | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_cash_txn_tr.txn_no` | 〃 |
| 37 | ERP_PETTY_CASH_RECON | PCR | 〃 | ERP/PETTY_CASH | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_cash_rec_mst.recon_no` | 〃 |
| 38 | ERP_SUPPLIER | SUP | 〃 | ERP/PROCUREMENT | MASTER_DATA | 〃 | 〃 | DOMAIN | `org_fin_supp_mst.supplier_code` | `erp-lite-v2.service.ts:2425` COUNT+1. |
| 39 | ERP_PO | PO | 〃 | ERP/PROCUREMENT | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_po_mst.po_no` | 〃 |
| 40 | ERP_AP_INVOICE | API | 〃 | ERP/AP | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_ap_inv_mst.ap_inv_no` | 〃 |
| 41 | ERP_AP_PAYMENT | APP | 〃 | ERP/AP | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_ap_pmt_mst.ap_pmt_no` | 〃 |
| 42 | ERP_BANK_ACCOUNT | BNK | 〃 | ERP/BANK | MASTER_DATA | 〃 | 〃 | DOMAIN | `org_fin_bank_acct_mst.bank_code` | 〃 |
| 43 | ERP_BANK_STATEMENT | BST | 〃 | ERP/BANK | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_bank_stmt_mst.import_batch_no` | 〃 |
| 44 | ERP_BANK_RECON | BRC | 〃 | ERP/BANK | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_bank_recon_mst.recon_code` | 〃 |
| 45 | ERP_ALLOC_RULE | ALR | 〃 | ERP/ALLOCATION | MASTER_DATA | 〃 | 〃 | DOMAIN | `org_fin_alloc_rule_mst.rule_code` | `erp-lite-phase10.service.ts:838`. |
| 46 | ERP_ALLOC_RUN | APR | 〃 | ERP/ALLOCATION | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_alloc_run_mst.run_no` | 〃 |
| 47 | ERP_COST_COMPONENT | CMP | 〃 | ERP/COSTING | MASTER_DATA | 〃 | 〃 | DOMAIN | `org_fin_cost_cmp_cd.comp_code` | 〃 |
| 48 | ERP_COST_RUN | CRN | 〃 | ERP/COSTING | TRANSACTION | 〃 | 〃 | DOMAIN | `org_fin_cost_run_mst.run_no` | 〃 (CRN clash, S11) |
| 49 | HQ_SAAS_INVOICE | INV | HQ | HQ_BILLING/SAAS_INVOICE | TRANSACTION | `YYYY-SEQ` / 6 | NEVER (global seq) | DOMAIN | HQ billing invoice number (0041 billing tables) | `sys_bill_generate_invoice_number` (0041:778), global `seq_invoice_number` starting at 1000; YYYY is printed but never resets. |
| 50 | HQ_MARKETING_LEAD | CMX | HQ | HQ_CRM/LEAD | MASTER_DATA | `YYYYMMDD-SEQ` / 6 | DAILY (UTC) | DOMAIN | `hq_crm_marketing_leads.lead_code` | `hq_crm_marketing_lead_code_next()` (0229), first code of the day is 32. |

Notes:
- New prefixes in this plan: only **SCN**. **ORD** is kept.
- Because rows 8–11 and 12–18 share a target column and 25/26 share `product_code` (S17), `uq_doc_seq_type_target` must be partial too (S18).
- Because rows 8/26/49, 10/18 (CN vs CRN), 7/18 (REF), 15/18 (ADJ), 18/48 (CRN) and 27/50 (CMX) share prefixes, the prefix unique index must be partial (S11).
- A smaller first seed is possible. Rows 1–24 cover the plan's scope; rows 25–50 can wait for P10. **Recommendation:** seed all 50 so the consistency view sees every code from day one.

</details>

### 20.3 A-16: APPROVED label settings (2026-10-30)

**APPROVED 2026-10-30** (reason in §20 A-16). There are no `LABEL_*` settings today, so these are new. The sizes match the existing `label_printing_58mm` / `label_printing_80mm` flags.

| setting_code | Type | Default | Allowed | Notes |
|---|---|---|---|---|
| LABEL_ORDER_SIZE | TEXT | `4x6in` | `4x6in`, `80mm`, `58mm`, `A6` | Today's button uses 4in×6in |
| LABEL_PIECE_TAG_SIZE | TEXT | `58x30mm` | `58x30mm`, `50x25mm`, `80x40mm` | Heat-seal and paper tags |
| LABEL_PIECE_TAG_QR | BOOLEAN | `false` | — | QR on large tags only (Q9) |
| RECEIPT_ORDER_CODE128 | BOOLEAN | `true` | — | CODE128 of `order_no` on the receipt |
| LABEL_SHOW_CUSTOMER_NAME | BOOLEAN | `true` | — | Privacy option for shared counters |
| External tag charset | rule | printable ASCII 0x21–0x7E, trimmed, length 1–64 | — | `ck_ord_piece_barcode_fmt`; confirm against a real tag sample |

Settings are gated by the existing `label_printing` flags and the new `human_codes_scan_labels` flag (A-14).

**Built in P4 (2026-10-31):** `0685_add_settings_label_printing.sql`. The four `LABEL_*` rows depend on `label_printing`; `RECEIPT_ORDER_CODE128` depends on `human_codes_scan_labels` and its disabled value is `false`. The external-tag charset was replaced by A-36 in P3.

**Superseded 2026-10-31 (A-46, A-47):** the values above are now the system rows of `sys_label_printing_cf` (`ORDER_LABEL` size `4x6in`, QR on, customer name on, 1 copy; `PIECE_TAG` size `58x30mm`, QR off, 1 copy; `RECEIPT` order barcode on, capped by `human_codes_scan_labels`). No `sys_tenant_settings_cd` rows are created and nothing depends on `label_printing`. Tenants and branches override them in `org_label_printing_cf` through Settings → Labels & Tags.

### 20.4 A-21: APPROVED `hq_general_config` values (2026-10-30)

**APPROVED 2026-10-30** (reason in §20 A-21). These values come from the current wizard, the HQ DTO and the tenant column defaults.

| Column | Default | Allowed / rule |
|---|---|---|
| default_currency_code | `OMR` | FK `sys_currency_cd(code)` |
| default_country_code | `OM` | FK `sys_country_cd(code)` |
| default_language_code | `en` | FK `sys_language_cd(code)` (`en`, `ar`); note it is VARCHAR(2) vs tenant VARCHAR(10) |
| locale_code | `en-OM` (alternative `ar-OM`) | `^[a-z]{2,3}(-[A-Z]{2})?$`, ≤ 10 |
| timezone | `Asia/Muscat` | `fn_hq_gen_cfg_validate()` (`AT TIME ZONE` test) |
| current_fiscal_year | `FY2026` | `^(FY)?[0-9]{4}(-[0-9]{4})?$` (plan §5.3) |
| fiscal_year_start_month | `1` | 1–12 |
| date_format | `DD/MM/YYYY` | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` (HQ DTO) |
| time_format | `24h` | `24h`, `12h` (lowercase, as stored today) |
| first_day_of_week | `6` (Saturday) | 0=Sunday … 6=Saturday |
| default_vat_rate | `5.00` | 0–100, NUMERIC(5,2) (Oman VAT) |
| default_trial_days | `30` | 0–365; a plan's `trial_days` overrides it |

New printed prefixes in this plan: **ORD** (existing, kept) and **SCN** (new, P5). Every type also has a unique `type_prefix` (§20.2). All others are existing and kept. `uq_doc_seq_type_prefix` enforces global uniqueness, and the P0 inventory checks there's no clash with any hard-coded prefix. **P0: ORD and SCN clash with nothing. The DOMAIN prefixes do clash (INV, CN, REF, ADJ, CRN, CMX), so the prefix and target unique indexes are partial, GENERAL-only (§5.2, `INVENTORY.md` S11/S18).**

---

## 21. Ordered task checklist

Sizes: **S** ≤ ½ day, **M** ≤ 2 days, **L** > 2 days. Every task ends with rule 14 (status table + report). The `.S` tasks are the phase status close-outs and the `.D` tasks are the phase docs.

| ID | Task | Depends on | Size |
|---|---|---|---|
| **P0** | | | |
| T0.1 | Re-read the CLAUDE.md files and the §0.6 rule docs; note any conflicts | approval of plan | S |
| T0.2 | Create the single report file + HQ pointer; copy the status table into it | T0.1 | S |
| T0.3 | `git grep` inventory: generators, `.rpc('generate_order_number'`, `order_no` regexes, `piece_code`, `credit_note_no`, `qr_code`/`barcode`, UUID shortening in UI, templates, exports, mobile, cmx-api | T0.2 | M |
| T0.4 | Read-only DB inventory (functions, triggers, `pg_depend` on `piece_code`, max order seq per day, `data:` barcodes, srno writes), only if possible without exposing a secret; else list the queries for you to run | T0.2 | M |
| T0.5 | Produce the A-01/A-02 seed tables + close or keep each §22 item | T0.3, T0.4 | S |
| T0.S / T0.D | Status update; `INVENTORY.md` | T0.5 | S |
| **P1** | | | |
| T1.1 | Write `scope_modules` (scopes/modules/sub-systems) — **DONE (P1)** | A-01 | S |
| T1.2 | Write `doc_seq_type_config` (lookups, `sys_doc_seq_type_cd`, `fn_doc_seq_full_size`) — **DONE (P1)** | T1.1, A-02, A-05 | M |
| T1.3 | Write `hq_general_config` (`hq_general_config`, `fiscal_year_start_month`) — **DONE (P1)** | A-03, A-21 | S |
| T1.4 | Write `doc_seq_counters` (counters) — **DONE (P1)** | T1.2 | S |
| T1.5 | Write `doc_seq_engine_fns` (engine functions + grants) — **DONE (P1)** | T1.4 | M |
| T1.6 | Write `doc_seq_consistency` (consistency view + data fn) — **DONE (P1)** | T1.5 | M |
| T1.7 | Write `doc_seq_code_tables_registry` (registry rows) — **DONE (P1)** | T1.2 | S |
| T1.8 | DB test scripts §14.2 (2, 3, 9, 11) + concurrency driver script — **DONE (P1):** `supabase/tests/doc_seq_engine_p1.test.sql` (2, 3, 5, 7, 7a, 9, 11, 11b); the parallel driver moves to P2, where ORDER becomes the first GENERAL type | T1.5 | M |
| T1.9 | Add `org_doc_seq_mst` to the tenant delete paths (0465 fn via a new migration if needed; HQ `tenant-maintenance`) — **DONE (P1): no change needed** (0465 deletes no tenants; signup rollback runs before any number exists; cleanup never resets counters) | T1.4 | S |
| T1.10 | `lib/constants/doc-seq.ts` + `DocSeqConfigService` — **DONE (P1)** | T1.2 | S |
| T1.R | **Write the Human-Friendly Codes rule** (§16.1) into both repos' rules files and DB skills: tenant `.cursor/rules/databaseconventions.mdc`, `.claude/skills/database/SKILL.md` + `conventions.md`, a pointer in root `CLAUDE.md`; HQ `.cursor/rules/rulesfromclaudejh.mdc`, `.claude/skills/database/SKILL.md`, a pointer in root `CLAUDE.md`; plus the `.codex` copies in both repos (`.codex/docs/database_conventions.md`, `.codex/skills/database/SKILL.md`, tenant `.codex/skills/database/conventions.md`, HQ `.codex/skills/create-db-table`) and pointers in both root `AGENTS.md` (full list in §16.1). Show the exact text for your OK per file before writing. — **DONE (P1)** | T1.1–T1.9 | S |
| T1.S / T1.D | Status update → **CHECKPOINT P1** (your apply/regenerate); engine dev guide — **DONE (P1):** `DEV_GUIDE_DOC_SEQ_ENGINE.md`; §1 = WAITING FOR USER (apply) | T1.1–T1.10 | S |
| **P2** | | | |
| T2.1 | **DONE (written, not applied): `0674_ord_order_no_engine.sql`.** Write `ord_order_no_engine` (seed, wrapper, triggers, revoke, helpers, sub-order fn). Triggers: typed `fn_ord_no_assign` + guard with `WHEN (OLD.order_no IS DISTINCT FROM NEW.order_no)` (§5.8, DEV_GUIDE §12) | P1 DONE, A-06, A-19 | M |
| T2.2 | **DONE:** `lib/services/order-numbering/` + shim `lib/utils/order-number-generator.ts` + tests. `OrderNumberService` + format helpers + tests; D1 shim. Short transactions (DEV_GUIDE §13): take the number last, just before the insert; no HTTP, queue, notification or PDF work inside the numbering transaction | T2.1 | M |
| T2.3 | **DONE:** `lib/services/order-split.service.ts` (A-29); both `OrderService` split paths delegate to it. Move the split flow into the Prisma tx using `nextSubOrderNoWithTx`; keep that tx short (no external calls; number taken last) | T2.2 | M |
| T2.4 | **DONE (box):** DEV_GUIDE §14 P2 numbers; DB tests `supabase/tests/ord_order_no_engine_p2.test.sql`. Concurrency test §14.2-1, 3–7; re-run the P1 box pgbench set (same tenant, many tenants, 10% rollbacks) against the real `org_orders_mst` insert path and compare with DEV_GUIDE §14 | T2.1 | S |
| T2.S / T2.D | Status → **CHECKPOINT P2** (WAITING FOR USER: apply 0674); `ORDER_NUMBERING.md` — **DONE; P2 applied by the user 2026-10-31** (local + remote, types + `prisma.schema` updated) | T2.1–T2.4 | S |
| **P2.1** | | | |
| T2.5 | **DONE (written, not applied): `0677_ord_root_order_id.sql`** (A-28): `root_order_id` column, composite FK, backfill, `trg_ord_root_guard`, `fn_ord_next_sub_order_no` on the root (§5.8.1). Box: guards G0–G6, backfill (good + bad chain), 2-client concurrency, P2 test in both modes | P2 DONE | M |
| T2.6 | **DONE (written, not applied): `0678_tenant_hard_delete_guard.sql`** (risk 2, A-31): `creating` status, delete/truncate/status guards, counters removed by the trigger. Box: G7 | P2 DONE | S |
| T2.7 | **DONE:** web-admin `order-split.service.ts` reads/checks the root (A-29 moves only, money on parent), `order-number.service.ts` error codes, `tenants.service.ts` `registerTenant` `creating → trial`, `lib/types/tenant.ts`; Jest: `order-split.service.test.ts` (+3), new `tenants.service.register.test.ts` (5). HQ: `utils/tenant-status-guard.ts` + spec (3), `tenants.service.ts` 409 mapping, `query-tenants.dto.ts` filter; platform-web status label EN/AR + filter | T2.5, T2.6 | M |
| T2.8 | **DONE (user runs it):** safety test `supabase/tests/hfc_p21_split_safety.test.sql` (risk 1; one transaction, rolled back); `ord_order_no_engine_p2.test.sql` T2.6c made root-aware | T2.5, T2.6 | S |
| T2.9 | Status → **CHECKPOINT P2.1** (WAITING FOR USER: apply 0677 + 0678, regenerate types/Prisma, run the safety test); DEV_GUIDE §16, `ORDER_NUMBERING.md`, decisions A-28..A-31 — **DONE; P2.1 applied by the user 2026-10-31** (local + remote, types + `prisma.schema` updated) | T2.5–T2.8 | S |
| **P2.2** | | | |
| T2.10 | **DONE:** HQ `platform-api` `TenantsService.create` inserts `creating`, rolls back on a failed base-currency step, then `creating → <requested status>` (`finishTenantCreation`, rollback + 500 `TENANT_CREATE_FINISH_FAILED` on failure); `utils/tenant-status-guard.ts` text + new code. Checked every create path: only `TenantsService.create` (both controller routes); `platform-workers`, HQ scripts and `packages` create no tenants; `platform-web` unchanged (§5.8.2) | P2.1 DONE, A-31 change | S |
| T2.11 | **DONE:** new `__tests__/tenants.service.create.spec.ts` (7) + `tenant-status-guard.spec.ts` (+1 = 4); jest 11/11, tsc and eslint no new findings | T2.10 | S |
| T2.12 | Status → **CHECKPOINT P2.2** (WAITING FOR USER: deploy HQ `platform-api`; no migration); A-31 updated, A-32, R13/R16, PROPOSAL §12, DEV_GUIDE §16, `INVENTORY.md` — **DONE** | T2.10, T2.11 | S |
| **P3** | | | |
| T3.1 | **DONE (written, not applied): `0682_ord_item_srno_barcode.sql`** + `lib/db/orders.ts` plain barcode + `order-service.ts` numbering continues (`order-item-code.service.ts`), `0678` comments refreshed. Box: tests t0681 (incl. 4×20 concurrent inserts gap-free) pass. Original text: Write `ord_item_srno_barcode` (srno body, UNIQUE, item barcode value). **Readiness 2026-10-31 (§5.9):** ship together with the `lib/db/orders.ts` barcode-value change (pulled forward from T4.5) and the `order-service.ts:2430` srno fix; also refresh the `0678` status comments (`COMMENT ON` only, §5.8.2 item 7) | P2 DONE | M |
| T3.2 | **DONE (written, not applied): `0683_ord_piece_code_human.sql`** (`fn_ord_piece_code_set`, tag UNIQUE among live pieces of open orders, `tag_released_at` + release trigger on `org_orders_mst`, normalise trigger, format + not-a-code CHECKs, tag pre-checks; A-35..A-37). Box: t0682 pass; safety test `supabase/tests/hfc_p3_codes_safety.test.sql`. Original text: Write `ord_piece_code_human` (piece_code human, UNIQUE, guard, tag UNIQUE) | T3.1 | M |
| T3.3 | **DONE:** no srno UPDATE in the app (re-checked); guard `trg_ord_item_srno_guard` ships in 0682. Original text: Remove the app's srno overwrite (if an UPDATE), then add the srno guard (conditional) | T3.1, T0.4 | S |
| T3.4 | **DONE (tag part):** `lib/validations/code-format-schemas.ts` `externalTagSchema` (A-36), `looksLikeCode` / `codeLookalikePattern` (A-37) + tests; the order/piece code schemas follow with the scan API in P3b. Original text: `code-format-schemas.ts` + tests | T2.2 | S |
| T3.5 | **DONE (P3 + P3b):** `lib/services/scan-resolve/scan-resolve.service.ts` (`ScanResolveService.resolve`, tenant-scoped, codes → order/line/piece, live tag → piece, `CMX1:` payloads via `cmx-code-payload.ts`) + tests (P3b 2026-10-31). P3 part: `lib/services/piece-code/piece-code.service.ts` (tag format, code shape with registry prefixes, live-holder lookup without final orders, batch check of every tag, DB error mapping) + batch-update check-all-first 400/409 (A-38) + `piece-tag-error.ts` EN/AR + piece scan route upper-cases the tag + tests; `ScanResolveService` → P3b. Original text: `PieceCodeService`, `ScanResolveService` + repositories + tests | T3.2, T3.4 | M |
| T3.6 | **DONE (P3b):** `POST /api/v1/scan/resolve`, `GET /api/v1/orders/lookup?code=`, `GET /api/v1/orders/pieces/lookup?code=`, `PUT|DELETE /api/v1/orders/pieces/:pieceId/external-tag`; `pieces/scan` on the resolver (same response); piece `PATCH` tag checks = batch-update; `scan-user` limiter; tests `__tests__/api/scan/*`. Original text: APIs: `scan/resolve`, `orders/lookup`, `pieces/lookup`, `external-tag`; refactor `pieces/scan` | T3.5 | M |
| T3.7 | **DONE (P3b):** `lib/hooks/use-keyboard-wedge.ts`, `src/ui/forms/cmx-scan-input.tsx` (+ stories, tests, axe); `PieceBarcodeScanner` and `assembly-scanner` use it. Original text: `useKeyboardWedge` + `CmxScanInput` (+ stories, tests); move the two scanners onto it | T3.4 | M |
| T3.8 | **DONE (P3b):** `src/ui/data-display/cmx-code-chip.tsx`, `src/ui/forms/cmx-code-search-input.tsx` (`toCodeSearch`) (+ stories, tests, axe). Original text: `CmxCodeChip`, `CmxCodeSearchInput` (+ stories, tests) | T3.4 | S |
| T3.9 | **DONE (core, 2026-10-31):** `CmxCodeChip` on order page / lines / piece cards / gift-card log, sub-order parent link, order and piece UUID shortening removed, orders search via `CmxCodeSearchInput` + resolver jump + server exact `order_no` fast path (`orderNoFromCode`), `?piece=` highlight (`src/features/orders/lib/piece-highlight.ts`), `codes.json` EN/AR; tests `__tests__/ui/scan/codes-on-screens.test.tsx`. **Done 2026-10-31 (T3.9b):** `CmxCodeChip` (order no.) on the workflow processing table, workboard, preparation list + detail, processing / ready / packing / assembly detail headers, packing / assembly / delivery lists, pickup ready list, delivery route manifest / stop / order detail, home-collection list + detail, orders / payments / financial reports, orders simple table; receipt print shows the order no. as `<bdi dir="ltr">` monospace (no button in print); chips inside links are `copyable={false}`; reconciliation screens show no order numbers (N/A). Pieces panel (`PieceList`, every pieces view): filter by piece code or live tag (`matchesPieceCodeFilter`, shown from 6 pieces, released tags ignored, Arabic-Indic digits read), with count and no-match text (`codes.json` EN/AR); tests `__tests__/ui/scan/codes-on-stations.test.tsx`. Original text: Codes shown across screens (§8.3), remove UUID shortening; order search fast path (use `toCodeSearch` + `orders/lookup`); `?piece=` highlight on the order page | T3.8 | L |
| T3.10 | **DONE (P3b):** `src/features/scan` (`GlobalScanTrigger` in `cmx-top-bar`, `GlobalScanDialog`, `LinkTagDialog`, `scan-api.ts`), flag `human_codes_scan_labels` (default off), `Ctrl+Shift+F` (TO CONFIRM, A-11), page-wide wedge; tests `__tests__/ui/scan/global-scan.test.tsx`. Original text: Global scan dialog (`src/features/scan`) behind the flag; link-tag dialog | T3.6, T3.7 | M |
| T3.11 | **DONE (P3b):** `messages/{en,ar}/scan.json`, `orders.pieces` keys, `messages/{en,ar}/codes.json` (T3.9 glossary; shared code labels moved out of `scan.json`); `check:i18n` passes. Original text: i18n EN/AR keys + `check:i18n` | T3.9, T3.10 | S |
| T3.12 | **DONE:** A-33 (HQ counters only via the 0678 trigger; `rollbackCreatingTenant` row check + 2 specs) | T2.10 | S |
| T3.13 | **DONE:** HQ wizard 409 toast title/description in EN/AR (`tenants.createWizard`) | T2.10 | S |
| T3.14 | **DONE:** UI fixes: `SortingPieceCard` tag = `barcode`; `PrintItemLabels` renders the plain serial; processing modal shows the tag errors (EN/AR) | T3.1 | S |
| T3.S / T3.D | Status → **CHECKPOINT P3** — **DONE; P3 applied by the user 2026-10-31** (local + remote, types + `prisma.schema` updated); P3b checkpoint: code done 2026-10-31 (T3.9b done the same day), waiting for user deploy/test; `SCAN_AND_PIECE_CODES.md` written 2026-10-31 | T3.1–T3.11 | S |
| **P4** | | | |
| T4.1 | **DONE 2026-10-31:** `bwip-js@^4.11.4` in `web-admin/package.json` (imported as `bwip-js/browser`: typed under `moduleResolution: bundler`, runs on the server too); `lib/utils/barcode/code128.ts` (`renderCode128Svg` / `renderCode128DataUrl`, hyphens kept) + `qr.ts` (`renderQrSvg`, ECC M); tests `__tests__/utils/barcode/*`. Original text: Add the A-07 library; `code128.ts` + tests | A-07 | S |
| T4.2 | **DONE 2026-10-31:** `cmx-code-payload.ts` reused from P3b (`CMX1:ORD:` / `CMX1:PEC:`); `lib/services/labels/label-types.ts` (pure types, sizes, `parsePieceSelection`) + `label-data.service.ts` (tenant-scoped reads of order, lines, pieces, branch, short customer name, resolved settings); `GET /api/v1/orders/[id]/label-data?pieces=none|all|<ids>` (`orders:read`, ≤ 500 ids, 400 / 404 `ORDER_NOT_FOUND`, `no-store`); tests `__tests__/services/labels/*`, `__tests__/api/order-label-data.test.ts`. Original text: `cmx-code-payload.ts` + tests; `LabelDataService`; `label-data` API | T3.5 | M |
| T4.3 | **DONE 2026-10-31:** `src/ui/print` (`CmxBarcode`, `CmxLabelRenderer` / `CmxOrderLabel` / `CmxPieceTag`, `labelPageCss`, 7 stories; import from `@ui/print`, not the `@ui` root, so bwip-js loads only where labels print); `lib/utils/print/print-react-in-iframe.ts`; `lib/hooks/use-label-print.ts`; codes LTR (`<bdi>`), labels RTL in Arabic; tests `__tests__/ui/print/*`, `__tests__/utils/print/*`. Original text: `CmxLabelRenderer` + `useLabelPrint` (+ stories) | T4.1, T4.2 | M |
| T4.4 | **DONE 2026-10-31:** `print-label-button.tsx` rebuilt on `useLabelPrint` (S12 fixed: no `window.open`/`document.write`, no phone, always enabled) + "Print piece tags" (`showPieceTags`); `PrintItemLabels` real CODE128; receipt print CODE128 (`showOrderBarcode`, from the label-data settings); settings migration `0685_add_settings_label_printing.sql` (A-16) + safety test; `messages/{en,ar}/labels.json`, `orders/printLabel.json` trimmed to the used keys. Original text: Rework `print-label-button.tsx`; piece-tag print action; settings (if A-16) | T4.3 | M |
| T4.5 | **DONE:** `lib/db/orders.ts` stores the value (done in P3, T3.1); D2 `generateBarcode` is a deprecated shim over `code128`; D3 JSON QR helpers removed (no callers); D4 image columns no longer read. Original text: `lib/db/orders.ts` stores the value; D2 shim; D3 removal | T4.1 | S |
| T4.6 | **DONE 2026-10-31 (A-46..A-49):** `0685` reworked to `sys_label_printing_cf` + `org_label_printing_cf` + `fn_label_printing_resolve` + nav `settings_labels`; safety test `hfc_p4_label_settings_safety.test.sql` rewritten; `LabelPrintingConfigService`, `label-printing-schemas.ts`, `GET`/`PUT /api/v1/settings/label-printing`; screen `app/dashboard/settings/labels` + `src/features/settings/labels` (api, model, hook, `InheritableSelectField`, screen); `LabelDataService` reads the resolver (adds `copies`, order-label QR option); `tenant-settings.service.ts` back to its pre-P4 state; `label_printing` gate removed (flag kept, `@deprecated`); `messages/{en,ar}/labelSettings.json`; tests (service, schemas, route, form model, screen) | T4.4 | M |
| T4.S / T4.D | Status → **CHECKPOINT P4** — **DONE; P4 applied by the user 2026-10-31** (`0685` local + remote, types in both repos + `prisma.schema` updated; code done 2026-10-31, label config rework T4.6 the same day; deploy and real-scanner test S6/S7/S13 are yours). Pending follow-ups (not done): retire `label_printing` from HQ; delete old `LABEL_*` settings rows if the NOTICE showed any; regenerate the platform inventory (`scripts/sync-platform-inventory.mjs`); delete `C:\Users\JHNLP\p4v2code.zip`; `USER_GUIDE_LABELS.md` written 2026-10-31, updated for Labels & Tags | T4.1–T4.6 | S |
| **P5** | | | |
| T5.1 | **DONE 2026-10-31:** `0687_fin_store_credit_note_scn.sql` + `supabase/tests/hfc_p5_scn_safety.test.sql` (T5.1a–h); box: concurrency 20/20 distinct, negatives refused. Original text: Write `fin_store_credit_note_scn` (SCN) | P1 DONE | S |
| T5.2 | **DONE 2026-10-31 (A-50, A-51):** `creditNoteNoForInsert` + `assertCreditNoteNoAssigned` in `stored-value.service.ts` (both `issueCreditNoteTx` and `issueCreditNote`), constant `STORE_CREDIT_NOTE_NUMBERING` in `lib/constants/doc-seq.ts`; jest `__tests__/services/stored-value.service.test.ts` (+5 tests). Original text: `stored-value.service.ts`: insert without a number, read back the trigger value; one-release fallback behind a constant | T5.1 | S |
| T5.3 | **DONE 2026-10-31:** 49 DOMAIN rows match INVENTORY §6 (type_prefix + owner), 17 app owner files exist, consistency 0 ERROR (CN `PREFIX_SHARED` warning gone). Original text: Verify the DOMAIN rows against the inventory; consistency 0 errors | T5.1 | S |
| T5.S / T5.D | Status → **CHECKPOINT P5** — code done 2026-10-31, WAITING FOR USER (apply `0687` → deploy); `DOMAIN_CODES_REGISTRY.md` written 2026-10-31 — **`0687` applied by the user 2026-11-01** (local + remote); deploy pending | T5.1–T5.3 | S |
| **P6** | | | |
| T6.1 | Write `permissions_doc_seq` (HQ perms + role grants) — **DONE 2026-10-31** as `0688` (no role grant, A-54) | A-08, A-09 | S |
| T6.2 | Write `navigation_doc_seq` (HQ nav; tenant nav only if A-11) — **SKIPPED** (HQ nav is code, P7; A-22, A-55) | A-11 | S |
| T6.3 | Write `ff_human_codes` (flag) — **DONE earlier** in `0684` (`human_codes_scan_labels`) | A-14 | S |
| T6.4 | Refresh the UI access contract (`rebuild-ui-access-contract`) — **NOT NEEDED** (no tenant permission change, A-55) | T6.1 | S |
| T6.S / T6.D | Status → **CHECKPOINT P6** — code done 2026-10-31, WAITING FOR USER (apply `0688` + `0689`); `PERMISSIONS.md` written; `0689` also covers A-48 (2) — **DONE; P6 applied by the user 2026-11-01** (local + remote) | T6.1–T6.4 | S |
| **P7** | | | |
| T7.1 | `doc-seq-config` NestJS module (list/get/preview) + DTOs + specs — **DONE 2026-10-31** | P1 DONE, T6.1 | M |
| T7.2 | `DocSeqConsistencyService` + endpoint + specs — **DONE 2026-10-31** | T7.1 | S |
| T7.3 | `general-config` module (GET + PATCH with audit and optimistic concurrency) + edit screen + specs — **DONE 2026-10-31** | T6.1 | M |
| T7.4 | HQ `CmxCodeChip` (create-cmx-component) — **DONE 2026-10-31** | A-15 | S |
| T7.5 | Screens: Code Types (+ drawer, preview), Consistency, General Config; nav; i18n + `i18n:split` — **DONE 2026-10-31 (`i18n:split` not needed: the new namespaces are small and `check:i18n` passes)** | T7.1–T7.4 | L |
| T7.6 | Tenant wizard prefill (A-13) — **DONE 2026-10-31 (A-62)** | T7.3 | S |
| T7.7 | `verify:schema`, typecheck, build, lint — **DONE 2026-10-31 (tsc, eslint, jest, check:i18n green; `next build` not run, see A-63)** | T7.5 | S |
| T7.S / T7.D | Status → **CHECKPOINT P7**; HQ docs — **DONE 2026-10-31 → CHECKPOINT P7** | T7.1–T7.7 | S |
| **P8** | | | |
| T8.1 | Mobile: validators, LTR display, Dart codec (if a staff scan exists) — **DONE 2026-10-31 (A-64; no staff scan in mobile yet, codec ready)** | T3.4, T4.2 | M |
| T8.2 | cmx-api: validator + codec — **N/A 2026-10-31 (A-65: cmx-api has auth + health only)** | T3.4, T4.2 | S |
| T8.3 | Notification/template check; fixes — **DONE 2026-10-31 (A-66: transition notification used the UUID, fixed)** | T0.3 | S |
| T8.4 | **Final refresh of the Human-Friendly Codes rule** (§16.1) in all §16.1 files (`.claude`, `.cursor`, `.codex`, `CLAUDE.md`, `AGENTS.md`) in both repos, so the text matches what was actually built (final prefixes, functions, scan payload). Each file needs your OK. — **DONE 2026-10-31 (A-67, 12 files)** | T1.R, P1–P5 DONE | S |
| T8.S / T8.D | Status → **CHECKPOINT P8**; client notes — **DONE 2026-10-31 → CHECKPOINT P8** | T8.1–T8.4 | S |
| **P9** | | | |
| T9.1 | Full QA S1–S20 on the deployed environments; results in `QA_TEST_GUIDE.md` — **DOCUMENTED 2026-10-31 — `QA_TEST_GUIDE.md` S1–S20, results Pending (user-run on deployed env, A-70)** | P2–P8 DONE | M |
| T9.2 | Perf measurements (§11) recorded — **DOCUMENTED 2026-10-31 — perf table in `testing_guide_and_scenarios.md`, Pending (user-run, A-70)** | T9.1 | S |
| T9.3 | Remove the D1/D2/D6 shims once `git grep` is clean — **KEPT 2026-10-31 (A-68: still referenced / rollback path; removal is a follow-up)** | T9.1 | S |
| T9.4 | Deprecated-column comments migration (optional) — **DONE in P6** as `0689` (A-56) | T9.1 | S |
| T9.5 | ADR (shared engine) — **DONE 2026-10-31 — ADR-004, Proposed (A-69)** | T9.1 | S |
| T9.6 | **Final docs:** tenant `documentation` skill (full pack) + HQ `create-feature-documentation` + `documentation-audit`; close the report — **DONE 2026-10-31 (A-70; audit 13/13 + report + QA guide)** | T9.1–T9.5 | M |
| T9.S | Final status update; all phases DONE — **DONE 2026-10-31 → plan CLOSED**; 2026-11-01: `0687`–`0689` applied by the user, waiting for deploy | T9.6 | S |
| **P11** | **Follow-ups (2026-11-01, decided by assistant, A-71..A-74)** | | |
| T11.1 | Migration `0690_hq_doc_seq_role_grants.sql` + `supabase/tests/hfc_p11_role_grants_safety.test.sql` — **DONE (code), NOT APPLIED** (A-71) | — | S |
| T11.2 | Retire `label_printing` in web-admin code — **DONE** (A-72; DB row kept, follow-up) | — | S |
| T11.3 | Mobile booking `ltrCode` — **DONE** (A-73) | — | S |
| T11.4 | `credit_note_no` notification variables + EN/AR hint — **DONE** (A-74; emit is a follow-up) | — | S |
| T11.S | Docs + status update — **DONE 2026-11-01** → WAITING FOR USER (apply `0690`, deploy, mobile release) | T11.1–T11.4 | S |

---

## 22. Consolidated TO VERIFY list (closed in P0 unless noted)

*P0 2026-10-30: each item now carries its result. Items that still need the live DB are listed as read-only SQL in `INVENTORY.md` §9 (Q1–Q12).*

1. **No DB query was run in this session**, because the connection would need a secret from `.env`. Every DB fact comes from migrations or proposal §11.3. → **Still true for P0.** DB facts are listed as read-only SQL in §9. Proposal §11.3 has earlier anonymised counts (13 test orders, 2 tenants, 0 sub-orders, 0 qr/barcode). (`INVENTORY.md` §4 #1)
2. The next free migration number at write time. → **Superseded:** numbers are assigned at creation time (rule 3); P1's actual numbers are in §1. (`INVENTORY.md` §4 #2)
3. Which table 0283 adds `credit_note_no` to, and whether it copies the store credit number. → **VERIFIED:** it is on `org_order_credit_apps_dtl`, as a snapshot copy of the store credit number. Not a generator. (`INVENTORY.md` §4 #3)
4. `pg_depend` objects on `org_order_item_pieces_dtl.piece_code` (views/functions) before `DROP EXPRESSION`. → **Partly VERIFIED:** no migration references it besides 0073. Live check: §9 Q4. (`INVENTORY.md` §4 #4)
5. Whether the app writes `order_item_srno` by INSERT or a later UPDATE (T3.3). → **VERIFIED: INSERT only.** No later UPDATE, so the guard can ship in `ord_item_srno_barcode`. (`INVENTORY.md` §4 #5)
6. Callers of `get_order_number_prefix`, `generateQRCode`/`decodeQRCode`, and `.rpc('generate_order_number'` (JWT clients). → **VERIFIED:** prefix and extract have no callers. QR helpers: `lib/db/orders.ts` and tests only. The RPC is called by legacy `splitOrder` (JWT supabase client) and the app wrapper. (`INVENTORY.md` §4 #6)
7. Whether the split flow at `order-service.ts` ~1319 already has a transaction. → **VERIFIED: no.** Neither split path has a transaction. (`INVENTORY.md` §4 #7)
8. The tenant hard-delete paths (0465 function, HQ `tenant-maintenance`). → **VERIFIED:** none. Order cleanup is `hq_mntnc_cleanup_tenant_orders`. (`INVENTORY.md` §4 #8)
9. Targets/columns/formats for the finance, tax, voucher, POS and cash-drawer DOMAIN rows; the customer number column; the `user_code` table and format. → **VERIFIED.** (`INVENTORY.md` §4 #9)
10. The project's standard `updated_at` trigger function name; the `DomainError` base class; the order audit service API. → **VERIFIED:** `update_updated_at_column()` (16 uses) and `public.trg_set_updated_at()` (newer). Use `trg_set_updated_at`. There is no DomainError; the base is `lib/errors/base-errors.ts AppError(message, code, statusCode, details)` with NotFound/Validation/Unauthorized/Forbidden/Conflict. The order audit is the `org_order_history` table (inserted by order-service, workflow-engine.service). (`INVENTORY.md` §4 #10)
11. The HQ global route prefix, the HQ nav source (API `navigation` module vs `cmx-sidebar.tsx`) and the HQ audit module API. → **VERIFIED:** `/api/hq/v1` (`main.ts:36`, `API_PREFIX`). Nav is hard-coded in `platform-web/components/layout/sidebar.tsx` (§1). Audit is `audit.service.ts log(entry: AuditLogEntry)` :111, `logSecure` :180. Existing controllers: `codes`, `audit-logs`, `navigation/components` (tenant `sys_components_cd`), `settings`. (`INVENTORY.md` §4 #11)
12. The HQ `class-validator` DTO pattern (`core-data/dto`) and the `sys_code_tables_registry` columns. → **VERIFIED:** `core-data/dto/code-value.dto.ts` uses class-validator + `@ApiProperty` + class-transformer (`@Matches(/^[A-Z_]+$/)`, `@MaxLength`). `sys_code_tables_registry`: table_name PK, display_name/2, description/2, is_editable, is_extensible, supports_tenant_override, code_pattern, max_code_length, requires_unique_name, category, display_order, current_version, last_seeded_at, metadata, audit and rec_* columns. (`INVENTORY.md` §4 #12)
13. Existing print settings, the label field set in `print-label-button.tsx`, and the receipt Arabic font. → **VERIFIED:** no `LABEL_*` settings. The only print-like setting code in migrations is `RECEIPT_VOUCHER`. Print flags exist: `label_printing`, `label_printing_58mm`, `label_printing_80mm`, `intake_label_printing`, `thermal_printing_enabled`, `qr_code_generation`, `printing` (`lib/constants/feature-flags.ts`). Label fields: §3.3. No Arabic font is bundled (Arial). (`INVENTORY.md` §4 #13)
14. The folder for shared hooks (`src/ui/hooks` vs `lib/hooks`) and the print component folder. → **VERIFIED:** hooks are in `web-admin/lib/hooks/` (there is no `src/ui/hooks`). Print components are in `src/features/orders/ui/*-print*.tsx` and `src/features/billing/ui/*-print-rprt.tsx`. **Fix §7:** put `useLabelPrint` in `lib/hooks/use-label-print.ts` and `CmxLabelRenderer` in `src/ui/print/` (new cmx folder) or `src/features/orders/ui/`. (`INVENTORY.md` §4 #14)
15. Whether pgTAP / `supabase/tests`, Playwright and jest-axe exist. → **VERIFIED:** `supabase/tests/` has plain-psql SQL tests (no pgTAP `plan()/ok()`), so new DB tests follow that style. Playwright is present (`@playwright/test ^1.40`, `e2e/`). **jest-axe is not installed** (adding it is a dev dependency; ask first). (`INVENTORY.md` §4 #15)
16. The web-admin monitoring (Sentry?) and any API rate limiter. → **VERIFIED:** there is no `@sentry/nextjs`, only `lib/utils/sentry-stub.ts`. The rate limiter is `lib/middleware/rate-limit.ts` (Upstash, optional), so reuse it for the scan and resolve endpoints. (`INVENTORY.md` §4 #16)
17. The orders list search endpoint path and implementation. → **VERIFIED:** `GET app/api/v1/orders/route.ts`, param `search`, at :294–304, plus the sort issue (S13). (`INVENTORY.md` §4 #17)
18. Whether `cmx-api` / `platform-workers` touch order identifiers; mobile order-number regexes. → **VERIFIED: none** touch order-number formats. (`INVENTORY.md` §4 #18)
19. The `platform-web/AGENTS.md` content; the `BR` token width. → **VERIFIED:** Next.js 16 ("new; read `node_modules/next/dist/docs`"). The BR token stays reserved (A-10), so no width is needed now. (`INVENTORY.md` §4 #19)
20. The exact `types:generate` script names in both repos. → **VERIFIED:** tenant root `npm run supabase:types` (local DB → `web-admin/types/database.ts`) and `npm run rebuild:platform-info-inventories`; web-admin `prisma:pull` / `prisma:generate`. HQ: `platform-api` and `platform-web` `types:generate` (both use the local Supabase DB URL). (`INVENTORY.md` §4 #20)
21. Whether any credit-note notification template exists; the longest SMS template length. → **Partly VERIFIED:** event `credit_note.issued` exists (0345:144; template seed 0382), with category INVOICE and channel IN_APP. It covers tax and finance credit notes. There is no store-credit (SCN) event. SMS max length: §9 Q12. (`INVENTORY.md` §4 #21)

---

*End of plan. Nothing in either repo or the database has been changed (P0 changed only this plan and the new `INVENTORY.md`).*
