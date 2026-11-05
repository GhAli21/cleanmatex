# Implementation Report — Human-Friendly Codes

**Status:** CLOSED — all 17 HFC migrations applied through `0690` (`0687`–`0689` on 2026-11-01, `0690` on 2026-11-05, local + remote); types + `prisma.schema` regenerated; web-admin / `platform-api` / `platform-web` deployed 2026-11-05; waiting for smoke test, QA and the next mobile release. **Date:** 2026-10-31, updated 2026-11-05 (Asia/Muscat). **Version:** 1.0.0.
**Repos:** tenant `cleanmatex` (all migrations, `web-admin`, `cmx-api`, `cmx_mobile_apps`), HQ `cleanmatexsaas` (`platform-api`, `platform-web`).
**Plan:** [`IMPLEMENTATION_PLAN_Human_Friendly_Codes.md`](./IMPLEMENTATION_PLAN_Human_Friendly_Codes.md) (§1 status, §20 decisions, §21 tasks). **Runbook:** `DEV_GUIDE_DOC_SEQ_ENGINE.md` §22.

## 1. Summary
One doc-seq engine in the tenant DB now issues readable, unique, immutable codes for orders, sub-orders, items, pieces and store credit notes, with consistency checks, HQ configuration screens, real CODE128/QR labels, tenant-wide scanning and left-to-right display in Arabic. All 17 HFC migrations are applied by the user through `0690` (`0687`–`0689` on 2026-11-01, `0690` on 2026-11-05, local + remote); types and `prisma.schema` regenerated; web-admin / `platform-api` / `platform-web` deployed 2026-11-05. Smoke test, QA and the next mobile release remain.

## 2. Per phase — files, migrations, tests

| Phase | Main files | Migrations | Tests | State |
|---|---|---|---|---|
| P0 | `INVENTORY.md` | — | — | DONE |
| P1 | engine SQL; `DEV_GUIDE_DOC_SEQ_ENGINE.md` | `0666_sys_platform_scope_modules`, `0667_doc_seq_type_config`, `0668_hq_general_config`, `0669_doc_seq_counters`, `0670_doc_seq_engine_fns`, `0671_doc_seq_consistency`, `0672_doc_seq_code_tables_registry` | `doc_seq_engine_p1.test.sql`; box load test (DEV_GUIDE §14) | DONE, applied 2026-10-30 |
| P2 | `lib/services/order-numbering/*`, order create / split, signup cleanup; `ORDER_NUMBERING.md` | `0674_ord_order_no_engine` | `ord_order_no_engine_p2.test.sql`, `order-number-format.test.ts` | DONE, applied |
| P2.1 | split root, `registerTenant` `creating` → `trial` | `0677_ord_root_order_id`, `0678_tenant_hard_delete_guard` | `hfc_p21_split_safety.test.sql`, jest both repos | DONE, applied |
| P2.2 | HQ `TenantsService.create` | — | `tenants.service.create.spec.ts` (7) + guard spec (4) | Code done, deploy pending |
| P3 | `lib/db/orders.ts`, `order-item-code.service.ts`, batch-update tag checks, HQ A-33 check | `0682_ord_item_srno_barcode`, `0683_ord_piece_code_human` | `hfc_p3_codes_safety.test.sql`, box t0682 (54 checks), jest 26/26 | DONE, applied |
| P3b | `lib/services/scan-resolve/*`, scan APIs, `src/features/scan/*`, `CmxScanInput`, `useKeyboardWedge`, `CmxCodeChip`, `CmxCodeSearchInput`, codes on all station screens; `SCAN_AND_PIECE_CODES.md` | — (flag `0684`, applied) | `__tests__/services/scan-resolve/*`, `__tests__/api/scan/*`, `__tests__/ui/scan/*` (jest-axe) | Code done, deploy pending |
| P4 | `lib/utils/barcode/{code128,qr}.ts`, `lib/services/labels/*`, `src/ui/print/*`, label-data + label-printing APIs, Settings → Labels & Tags; `USER_GUIDE_LABELS.md` | `0685_add_settings_label_printing` | `hfc_p4_label_settings_safety.test.sql`, labels / print / barcode jest | DONE, applied; deploy + scanner test pending |
| P5 | `stored-value.service.ts`, `lib/constants/doc-seq.ts`; `DOMAIN_CODES_REGISTRY.md` | `0687_fin_store_credit_note_scn` | `hfc_p5_scn_safety.test.sql` (T5.1a–h), `stored-value.service.test.ts`, box concurrency 20/20 | Applied 2026-11-01; deploy pending |
| P6 | `PERMISSIONS.md` | `0688_hq_doc_seq_permissions`, `0689_ord_label_image_cols_deprecated` | `hfc_p6_safety.test.sql` | DONE, applied 2026-11-01 |
| P7 | HQ `platform-api` `src/modules/{doc-seq-config,general-config}/*`; `platform-web` `src/features/{doc-seq,general-config}/*`, 3 pages, sidebar, EN/AR messages, `CmxCodeChip` copy, wizard prefill | — | platform-api 5 suites / 42; platform-web 2 suites / 7; tsc/eslint/check:i18n clean | Code done, deploy pending |
| P8 | `mobile_core/lib/src/human_codes.dart`, customer app order card/detail; `app/api/v1/orders/[id]/transition/route.ts`; HFC-RULE text in 6 tenant + 6 HQ rule files | — | mobile_core 7, customer app 2, `orders-transition.route.test.ts` 5/5 | Code done, deploy / release pending |
| P9 | this pack (README, development_plan, progress_summary, current_status, developer_guide(+mermaid), user_guide(+mermaid), deploy_guide, testing_guide_and_scenarios, QA_TEST_GUIDE, CHANGELOG, version.txt, technical_docs/README, this report); HQ ADR-004 + both ADR indexes, HQ README | — | final regression 2026-10-31: web-admin HFC jest 29 suites / 237 tests pass; box chain `0666`→`0689` + P5/P6 safety PASS | DONE (docs); QA + perf user-run |
| P11 | `0690` grants; web-admin `feature-flags.ts`, `types/tenant.ts`, `lib/notifications/credit-note-variables.ts`, `whatsapp-content-variables.ts`, `messages/{en,ar}/notifications.json`; mobile `customer_order_booking_screen.dart` | `0690_hq_doc_seq_role_grants` (**applied 2026-11-05**) | `hfc_p11_role_grants_safety.test.sql`; box chain `0687`→`0690` + rerun PASS; jest + Windows `tsc` clean; `flutter analyze` clean | Applied + web/HQ deployed 2026-11-05; mobile release pending |

Migration numbering: latest HFC file `0697` (applied 2026-11-05 evening with `0693`/`0695`/`0696`); next free `0698`. `0680`, `0681`, `0686`, and `0691_speed_pricing_nav_audit.sql` (Speed Pricing nav/audit) are not HFC files.

## 3. Decisions (A-01..A-74)
Full text: plan §20 (and PROPOSAL §12). Rows A-50..A-74 were decided while the user was away and are reversible; **reviewed + accepted by Jehad Ali 2026-11-05** (on assistant expert recommendation). See plan §20 and `FOLLOWUPS_APPROVAL.md` #13.

| Id | Topic | Status |
|---|---|---|
| A-01 | Seed for scopes, modules and sub-systems (table below) | Approved / decided by user |
| A-02 | Seed for doc types (table below) | Approved / decided by user |
| A-03 | Overlap with deactivated settings | Decided (see plan §20) |
| A-04 | Customers: the existing `generate_customer_number` (`CUST-00001`, MAX+1) vs the proposal seed `CUS` GENERAL on `customer_code` | Approved / decided by user |
| A-05 | Engine details: `p_fy_start` for fiscal-year tokens; `next` returns the formatted code; PARENT/RAND tokens and PER_PARENT for non-GENERAL rows; separa | Approved / decided by user |
| A-06 | `get_order_number_prefix()`: STABLE now, drop later if unused | Approved / decided by user |
| A-07 | CODE128 library | Approved / decided by user |
| A-08 | HQ permission style: colon (`hq_doc_seq:read`, `hq_general_config:read`) | Approved / decided by user |
| A-09 | Optional tenant permissions (`orders:scan`, `orders:print_labels`, `orders:link_tag`) | Approved / decided by user |
| A-10 | `BR` (branch) token | Approved / decided by user |
| A-11 | A tenant Scan page + nav entry, and the keyboard shortcut | Approved / decided by user |
| A-12 | HQ General Config edit screen + `hq_general_config:manage` | Decided (see plan §20) |
| A-13 | HQ tenant wizard prefills from `hq_general_config` | Approved / decided by user |
| A-14 | Feature flag `human_codes_scan_labels` (UI only, default off) | Approved / decided by user |
| A-15 | Shared code between repos (`cmx-code-chip`, `cmx-code-payload`): copy vs a shared package | Decided (see plan §20) |
| A-16 | Label settings (`LABEL_ORDER_SIZE`, `LABEL_PIECE_TAG_SIZE`, `LABEL_PIECE_TAG_QR`, receipt CODE128 on/off) and the external-tag charset (printable ASCI | Approved / decided by user |
| A-17 | Glossary terms (AR): رقم الطلب / رمز القطعة / بطاقة / إشعار رصيد المتجر | Approved / decided by user |
| A-18 | A weekly consistency alert (routine or HQ worker) | Decided (see plan §20) |
| A-19 | Splitting a sub-order: reject (`ORD_PARENT_IS_SUB`) vs number it under the root parent (`-S3`) | Approved / decided by user |
| A-20 | Register `user_code` (0563, platform-wide) as DOMAIN, scope `SYS` | Approved / decided by user |
| A-21 | `hq_general_config` values: `date_format` allowed list, `default_trial_days`, VAT default, `locale_code`, `time_format`, `first_day_of_week`, `current | Approved / decided by user |
| A-22 | HQ nav migration (`navigation_doc_seq`) | Approved / decided by user |
| A-23 | Drop the defaults on `org_tenants_mst.date_format`, `time_format`, `first_day_of_week` | Approved / decided by user |
| A-24 | Tenant cleanup and counters | Approved / decided by user |
| A-25 | `jest-axe` devDependency for a11y tests | Approved / decided by user |
| A-26 | `short_code` on scopes, modules, sub-systems; unique `type_prefix` on every doc type | Approved / decided by user |
| A-27 | `short_code` length on `sys_saas_scope_cd`, `sys_modules_cd`, `sys_module_sub_systems_cd` | Approved / decided by user |
| A-28 | Root of a sub-order | Approved / decided by user |
| A-29 | Money on a split | Approved / decided by user |
| A-30 | When an order takes its number | Decided by agent as expert (delegated) |
| A-31 | Which tenant may be hard-deleted ("creating stage") | Approved / decided by user |
| A-32 | Which HQ create steps must succeed before leaving `creating` | Decided by agent as expert (delegated) |
| A-33 | Counter cleanup when HQ deletes a tenant | Decided by agent as expert (delegated) |
| A-34 | Backfill of code columns on busy tables | Decided by agent as expert (delegated) |
| A-35 | When an external tag is freed | Decided by agent as expert (delegated) |
| A-36 | Tag format | Decided by agent as expert (delegated) |
| A-37 | Tags that look like our codes | Decided by agent as expert (delegated) |
| A-38 | Batch-update with tags | Decided by agent as expert (delegated) |
| A-39 | P3 review choices | Approved / decided by user |
| A-40 | P3b scan design | Decided by agent as expert (delegated) |
| A-41 | Global scan shortcut | Approved / decided by user |
| A-42 | Assembly scan backend | Approved / decided by user |
| A-43 | Scan rate limit | Approved / decided by user |
| A-44 | `CmxDialog` accessible name | Approved / decided by user |
| A-45 | P4 label design | Decided by agent as expert (delegated) |
| A-46 | Label options storage | Approved / decided by user |
| A-47 | `label_printing` flag | Approved / decided by user |
| A-48 | P4 open recommendations | Approved / decided by user |
| A-49 | Labels settings screen | Decided by agent as expert (delegated) |
| A-50 | P5 fallback switch | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-51 | P5 missing-number guard | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-52 | P5 counter start | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-53 | P5 trigger type and order | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-54 | P6 HQ role grants | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-55 | P6 tenant side | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-56 | P6 deprecated image columns | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-57 | P7 HQ API shape | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-58 | General Config concurrency and audit | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-59 | Consistency and preview | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-60 | HQ screens and nav | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-61 | General Config edit safety | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-62 | Wizard prefill (A-13) | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-63 | P7 test tooling | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-64 | P8 mobile code helpers | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-65 | P8 cmx-api | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-66 | P8 notifications | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-67 | P8 rule refresh (T8.4) | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-68 | P9 shims (T9.3) | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-69 | ADR-004 for the shared engine (T9.5) | **Accepted by Jehad Ali 2026-11-05** (ADR-004; #13a) |
| A-70 | P9 docs pack layout, QA/perf as user-run (T9.1, T9.2, T9.6) | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-71 | P11 `0690` A-54 role grants | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-72 | P11 `label_printing` removed from code | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-73 | P11 mobile booking `ltrCode` | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |
| A-74 | P11 `credit_note_no` variables | **Reviewed + accepted by Jehad Ali 2026-11-05** (expert recommendation; originally decided while user away) |

### 3.1 New in P9
- **A-68 (T9.3 shims):** `lib/utils/order-number-generator.ts` KEPT (still imported by `lib/services/order-service.ts` and tests; P2 rollback path). `lib/utils/barcode-generator.ts` KEPT (only its own test imports it; removing means deleting tracked files — follow-up). The A-50 `LEGACY` credit-note fallback KEPT (parent/user instruction); removal is a dated follow-up (~2026-12-01, after one release with `0687` applied).
- **A-69 (T9.5):** ADR-004 in HQ `docs/Dev/ADRs/` (Status Proposed, scope Both), number chosen to clash with neither HQ index; both indexes updated, next ADR-005.
- **A-70 (T9.6):** pack files added next to the existing docs (no move, links kept); `QA_TEST_GUIDE.md` holds S1–S20 (plan name) and `testing_guide_and_scenarios.md` is the pack testing guide; T9.1/T9.2 are documented with results "Pending (user-run on deployed env)"; the reference docs stay at the folder root and `technical_docs/README.md` indexes them.

### 3.2 New in P11 (2026-11-01)
- **A-71:** `0690_hq_doc_seq_role_grants.sql` grants the A-54 codes (TECH_ADMIN: all 3; SUPPORT: `hq_doc_seq:read`) in `hq_role_permissions` and the `hq_roles.permissions` JSON; skips a missing role with a NOTICE; safe to rerun. Replaces DEV_GUIDE §22 step 6a's manual SQL.
- **A-72:** `label_printing` removed from web-admin catalog, keys and tenant type. DB row, plan mappings, `scripts/flag-catalog-db.json` and the generated inventory JSON kept (removal needs approval).
- **A-73:** mobile booking success message uses `ltrCode`.
- **A-74:** `buildCreditNoteIssuedNotificationVariables()` (`credit_note_no`, `invoice_number` alias, `amount`, `currency`) + WhatsApp key + EN/AR hint; not emitted yet.

## 4. Apply / deploy steps from `0687` onwards (in order)
Same as `DEV_GUIDE_DOC_SEQ_ENGINE.md` §22 (the source of truth). **Steps 1, 2, 4, 5, 6 and 6a are DONE** (`0687`–`0690` applied; types/`prisma.schema` regenerated; web-admin + HQ deployed 2026-11-05). **Next: smoke test (step 7), mobile release (6b), QA.**
1. Pre-checks (read-only): DEV_GUIDE §20 (six for `0687`) and §21 (three for `0688`/`0689`).
2. Apply on local: `0687_fin_store_credit_note_scn.sql` → `0688_hq_doc_seq_permissions.sql` → `0689_ord_label_image_cols_deprecated.sql`.
3. Safety tests on local: `hfc_p5_scn_safety.test.sql`, `hfc_p6_safety.test.sql`.
4. Types / Prisma — **DONE 2026-11-05** (regenerated both repos; `prisma.schema` pulled).
5. Remote: repeat 1–2.
6. Deploy web-admin — **DONE 2026-11-05** (P3b, P4, P5, P8, P11 code).
7. Deploy HQ `platform-api` then `platform-web` — **DONE 2026-11-05** (P2.2, P7).
8. **P11 `0690`** — **DONE 2026-11-05** (applied local + remote; A-71). Affected HQ users may need to sign in again.
9. Mobile release (step 6b).
10. Smoke test (step 7), then QA S1–S20 and the performance checks.

## 5. Validation done by the assistant
- Box scratch Postgres only (never the user's DB). The one read-only `npm run verify:schema` run by mistake is disclosed in A-63.
- File hashes checked between the box and the Windows working tree before and after every write; nothing was committed or pushed to git.

## 6. Gaps / not done
- T9.1 QA and T9.2 performance need deployed environments (user-run).
- `credit_note.issued` is not emitted yet; the variables exist (A-74).
- Customer-app booking test "shows grouped preferences on booking step two" **fixed 2026-11-05** (#15); was not caused by P11; follow-up).

## 7. Follow-ups that need the user's approval
1. Retire the `label_printing` flag (A-47): code part done in P11 (A-72); still open: deactivate/delete the DB row + plan mappings, then `npm run rebuild:platform-info-inventories`.
2. Delete old `sys_tenant_settings_cd` `LABEL_*` / `RECEIPT_ORDER_CODE128` rows (only if the `0685` NOTICE reported any).
3. Run `scripts/sync-platform-inventory.mjs`.
4. Delete the stray `C:\Users\JHNLP\p4v2code.zip`.
5. Drop `org_orders_mst.qr_code` / `barcode` (deprecated by `0689`; destructive).
6. Remove the A-50 `LEGACY` fallback (branch, constant, `CN-` line in `stored-value.service.ts`) ~2026-12-01.
7. Delete the `barcode-generator.ts` shim and its test; retire `order-number-generator.ts` once `order-service.ts` no longer imports it (A-68).
8. ~~A-54 HQ role grants~~ — `0690` applied 2026-11-05 (A-71).
9. Install `jest-axe` in `platform-web` (A-63).
10. ~~`ltrCode` on the mobile booking screen~~ — done (A-73).
11. `credit_note_no` variables done (A-74); still open: emit `credit_note.issued` and change the `0382` template text (sends customer messages).
12. Run QA S1–S20 and the performance checks (T9.1, T9.2).
13. Review every "DECIDED BY ASSISTANT WHILE USER AWAY" decision (A-50..A-74) and ADR-004 (Proposed → Accepted).
14. P10 backfill waves for other tables (plan §5.13), one approval per table.
15. Fix or update the failing customer-app booking test "shows grouped preferences on booking step two" (not caused by P11).
