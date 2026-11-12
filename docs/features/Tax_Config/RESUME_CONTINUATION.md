# Tax Engine — Resume / Continuation (handover)

**Written:** 2026-11-12 · **Updated:** 2026-11-13 · **For:** the next agent or developer (Claude Code, Cursor, Codex, Antigravity …).
**Read first:** [STATUS.md](STATUS.md) (authoritative), [developer_guide.md](developer_guide.md), [KIT_FACTS.md](KIT_FACTS.md), root `CLAUDE.md` (rules: never apply migrations, migration number = live last + 1, `tenant_org_id` in every `org_*` query, EN/AR, Cmx UI, `cmxMessage`, no silent money mutation, the owner commits).

## 0. Start here (next agent, 2026-11-13)

All migrations up to **0733 are applied** (local + remote), Prisma pulled, types regenerated in both repos. Nothing is waiting for the owner to apply.
Next work, in order: ~~§4.1.2~~ (done 2026-11-13) → **§4.1.3** foreign-currency purchases (ERP-Lite exchange rate) → **§4.1.4** AP + withholding tax ledger posting. Each has a written design below. Then owner QA (§6).
Rules that bite: never apply migrations (write, STOP, owner applies); migration number = live last + 1 (`ls supabase/migrations`); explicit `tenant_org_id` in every `org_*` query; EN/AR + Cmx UI + `cmxMessage`; the owner commits; use the remote DB MCP for reads only.

## 1. State right now

- T0–T9 and the T4 leftovers are done; `0727` applied by the owner (local + remote).
- `0728_tax_kit_facts_verified.sql` applied by the owner (local + remote), Prisma pulled, types regenerated in both repos, and verified (§2 done 2026-11-12, see STATUS.md).
- Code that depends on 0728:
  - tenant `prisma/schema.prisma`: `sys_tax_kit_versions_mst.voucher_tax_mode` added by hand; the pull keeps it.
  - tenant `lib/services/stored-value-funding.service.ts` `kitVoucherTaxMode()`: a gift card sold without a choice takes the kit default.
  - tenant `src/features/marketing/ui/gift-card-sell-dialog.tsx`: new default option "As in tax setup" (`''`), sends `undefined`.
  - HQ `platform-api/src/modules/tax-setup/tax-setup.service.ts`: `voucherTaxMode` editable on drafts and shown in the diff.
  - HQ `platform-web`: draft dialog + version drawer + EN/AR `taxSetup.json`.

## 2. Verify after the owner applies 0728 — DONE 2026-11-12

1. Remote: `select kit_code, voucher_tax_mode, is_verified, simplified_max_amount from sys_tax_kit_versions_mst;` → OM SPV/true/500, SA MPV/true/1000, AE SPV/true/10000, BH SPV/true/500.
2. `select count(*) from sys_tax_return_box_cd where kit_code='OM_VAT'` = 20 (1a–7c).
3. `pg_get_functiondef('fn_tax_kit_version_clone'::regproc)` contains `voucher_tax_mode`.
4. Tenant: `npx tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=12288`); `npx jest __tests__/services/stored-value-funding.service.test.ts`; `npm run build`.
5. HQ: `platform-api` tsc (only the 5 old `*.spec.ts` files in §4.3 may error), `npx jest src/modules/tax-setup` (17 tests), `platform-web` tsc + `npm run check:i18n`.
6. Run the tenant VAT return for an OM organization (Reports › VAT Return) and check 5a = 1a + 1f + 2a + 2b + 4a; 7c = 7a − 7b.
7. Update STATUS.md (0728 applied, verified) and remove this §1 "expected errors" note.

## 3. Tax adviser results (2026-11-12, follow-ups F1–F6)

| # | Fact | Result | Source |
|---|---|---|---|
| F1 | SA return boxes | 16 fields 1–16 confirmed (portal form copy) → verified | GAZT/ZATCA portal form (copy on Tally) |
| F2 | BH return lines | 17 lines; line 17 = net VAT confirmed; **titles of lines 1–16 still unconfirmed** | NBR VAT Return Filing Manual v1.2 (27 Feb 2025): the form is a screenshot, so its text can't be extracted |
| F3 | OM return boxes | Official 20 boxes 1a–7c; layout replaced in 0728 | Tax Authority VAT Return Filing guide (June 2021) |
| F4 | OM simplified invoice | Only with Tax Authority approval, value < OMR 500 excl. VAT; full invoice whenever the customer asks | Executive Regulations (53/2021) Art. 146–149 |
| F5 | SA simplified invoice B2C | Any amount; B2B only below SAR 1,000 | ZATCA E-Invoicing Detailed Guidelines |
| F6 | Gift cards / vouchers | OM SPV (Art. 33–34), BH SPV (NBR Retail guide), AE SPV (Decree-Law 8/2017 + Exec. Reg. Art. 28) — taxed at sale; SA face-value voucher taxed at redemption (MPV) | as listed |

Still open for a human (AE boxes verified by 0730): BH lines 1–16 titles (log in to the NBR portal, compare with `sys_tax_return_box_cd` BH rows, then mark them verified in HQ › Tax Kits). OM organizations must hold Tax Authority approval before issuing simplified invoices (an organization-side legal step; the kit only stores the limit).

## 4. Remaining work (in priority order)

### 4.1 Known limits — status and build plan (owner said "you decide", 2026-11-12)

Order chosen: correctness first. Each item: database (migration = live last + 1, STOP for the owner to apply), backend, HQ/tenant UI (EN/AR, Cmx), tests, docs (STATUS, QA_TEST_GUIDE, this file).

**4.1.1 Reverse charge on purchases — DONE: `0731_tax_kits_purchase_reverse_charge.sql` applied and verified 2026-11-13** (OM/SA/AE/BH v1 end 2026-11-13, v2 PUBLISHED from 2026-11-14, 7/7 worked examples ok, `IN_FOREIGN_RC` all segments, priority 50).
Finding: foreign-supplier reverse charge was already seeded (`IN_FOREIGN_RC` → `VAT_IN_RC` in OM/SA/AE/BH v1). Real gaps fixed by 0731:
- GCC suppliers (scope `GCC`, from `taxPartyScope()` in `web-admin/lib/tax/order-line-tax.ts`) fell to `IN_ANY` = local input VAT. New rule `IN_GCC_RC` → `VAT_IN_RC` (GCC states treat each other as outside the VAT area until the GCC electronic services system is live).
- Rule tie bug: `IN_FOREIGN_RC` and the class rules (`IN_STANDARD`, `IN_NON_REC`, `IN_NO_VAT`) were equally specific at priority 100 → AMBIGUOUS → a foreign purchase with an item class was refused. New precedence: `IN_NO_VAT` 40, reverse charge 50, class rules 100.
- v1 limited `IN_FOREIGN_RC` to segment ENTERPRISE (a TAX_ENGINE_PLAN illustration, not a tax fact), so SME / FRANCHISE_BASE organizations paid local input VAT on imported services. v2 covers every segment (not-registered packages use the NO_VAT kit). Found when the first 0731 run failed its worked example (2026-11-13); fixed in the unapplied file.
- New code `VAT_IN_RC_NONREC` (standard rate, 0 % recoverable, reverse charge) + rules `IN_FOREIGN_RC_NONREC`, `IN_GCC_RC_NONREC` (flow + class `PURCHASE_NON_REC` + scope).
- `fn_tax_kit_version_check` now reads optional `flow` / `country_scope` from worked examples (defaults OUTPUT / DOMESTIC = old behaviour); 5 purchase examples per kit.
- Delivered as **version 2** of each GCC kit (clone → edit → publish, effective tomorrow); organizations move with the nightly `fn_tax_kit_update` (or HQ › organization › Tax kit › Update kit now).

After the owner applies 0731, verify: `select kit_code, version_no, status, effective_from, effective_to from sys_tax_kit_versions_mst where kit_code in ('OM_VAT','SA_VAT','AE_VAT','BH_VAT') order by 1,2` → v1 ends the apply day, v2 PUBLISHED from the next day; `select kit_code, fn_tax_kit_version_check(id) from sys_tax_kit_versions_mst where version_no = 2` → ok true, 7 examples (2 sales + 5 purchase). No prisma pull needed (data + function only). Add QA scenarios: ERP-Lite expense from a supplier whose tax country is another GCC state → reverse-charge line; foreign supplier + item class "Standard purchase" → no longer refused; HQ › Tax Kits shows version 2 with the new rules.

**4.1.2 HQ kit drafts edit rules and item classes — DONE 2026-11-13** (0732 + HQ API + HQ dialogs + tests; owner QA 31o–31q). Files: `platform-api/src/modules/tax-setup/{tax-setup.repository,tax-setup.service,tax-setup.controller}.ts`, `__tests__/tax-setup.versions.spec.ts`; `platform-web/lib/api/tax-setup.ts`, `src/features/tax-setup/ui/{tax-kit-draft-dialogs,tax-kit-version-drawer}.tsx`, `messages/{en,ar}/taxSetup.json`. The original step list is kept below for reference.
Next steps, in order: (1) `tax-setup.repository.ts`: `saveDraftRule(versionId, rule, actor)` / `saveDraftClass(...)` calling the two RPCs, errors via `taxFail`. (2) `tax-setup.service.ts`: `saveDraftRule` / `saveDraftClass` — body validation with the existing helpers (`optText`, `oneOf`, `optBool`), map camelCase body → snake_case jsonb, call `this.draft(versionId)` first, audit `kit_version.rule_saved` / `kit_version.class_saved` with before (from `versionContent`) and after. (3) `tax-setup.controller.ts`: `PUT kit-versions/:id/rules/:ruleCode`, `PUT kit-versions/:id/item-classes/:classCode`, `@RequireHqPermission(PERMS.MANAGE)`. (4) `GET options`: add party classes (`sys_tax_party_class_cd`), segments already there, doc types used by tax (`sys_doc_seq_type_cd`). (5) Unit tests in `src/modules/tax-setup` (validation, mapping, audit, error passthrough). (6) platform-web `lib/api/tax-setup.ts` client functions + types; `tax-kit-draft-dialogs.tsx`: `KitDraftRuleDialog` (ordered tax-code multi-select filtered by flow, class picker filtered by flow, scope, party class, segments, priority, names EN/AR, active) and `KitDraftClassDialog`; open them from the rules / classes sections of `tax-kit-version-drawer.tsx` when status = DRAFT (+ 'Add rule' / 'Add class'). (7) EN/AR keys in `messages/{en,ar}/taxSetup.json` incl. error codes `TAX_KIT_RULE_CONFLICT`, `TAX_KIT_CLASS_IN_USE`, `TAX_KIT_BAD_INPUT`; `npm run check:i18n`; platform-api + platform-web tsc and build. (8) QA rows 31o–31q (create a draft, add / change a rule, tie refused, class default move, Check + Publish).
The functions take the FULL object (create-or-replace by code): rule `{rule_code, tax_flow_code, doc_type_code, tax_item_class_code, party_tax_class_code, party_country_scope, segment_codes[], priority, name, name2, is_active, tax_codes[]}`; class `{class_code, tax_flow_code, name, name2, description, description2, is_default, display_order, is_active}`. Errors: `TAX_KIT_NOT_DRAFT`, `TAX_KIT_BAD_INPUT`, `TAX_KIT_RULE_CONFLICT`, `TAX_KIT_CLASS_IN_USE` (repository `taxFail` already maps `TAX_*:` messages to their code). Add EN/AR messages for the new codes in HQ.
- DB (new migration): two functions, both draft-only (raise `TAX_KIT_NOT_DRAFT`), one transaction each:
  - `fn_tax_kit_draft_rule_save(p_version_id uuid, p_rule jsonb, p_actor text) returns jsonb`: upsert by `(kit_version_id, rule_code)`: doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope, segment_codes, priority, name, name2, is_active, and `tax_codes` (ordered text[], at least 1). Replace the `sys_tax_kit_rule_codes_dtl` rows (delete + insert seq 1..n). Validate: every code exists active in the version with `tax_flow_code` = rule flow; the item class (if set) has the same flow; refuse an overlap with another active rule of the same specificity and priority (same logic as `findTaxRuleConflict` in `web-admin/lib/tax/determine.ts`) → `TAX_KIT_RULE_CONFLICT`.
  - `fn_tax_kit_draft_class_save(p_version_id uuid, p_class jsonb, p_actor text) returns jsonb`: upsert by `(kit_version_id, class_code)`: names, descriptions, display_order, is_default (clear other defaults of the same flow), is_active (refuse deactivating a class used by an active rule → `TAX_KIT_CLASS_IN_USE`); `tax_flow_code` fixed after create.
  - Already enforced by the DB: lock (`fn_tax_kit_lock_guard`), FKs (doc type, party class, class, codes), `uq_stkr_criteria`, segments trigger. Publish re-runs the worked examples.
- HQ API (`cleanmatexsaas/platform-api/src/modules/tax-setup`): `PUT kit-versions/:id/rules/:ruleCode` and `PUT kit-versions/:id/item-classes/:classCode` (`@RequireHqPermission(PERMS.MANAGE)`), service validation like `updateDraftCode`, repository `rpc` + `taxFail`, audit `kit_version.rule_saved` / `kit_version.class_saved`, unit tests.
- HQ web (`platform-web/src/features/tax-setup/ui`): rule dialog + item class dialog like `KitDraftCodeDialog` in `tax-kit-draft-dialogs.tsx`, opened from the rules / classes tables of `tax-kit-version-drawer.tsx` when the version is DRAFT; tax codes as an ordered multi-select; pickers from `GET options` (add doc types, party classes; item classes from the version). EN/AR in `messages/{en,ar}/taxSetup.json`; `npm run check:i18n`.

**4.1.3 Foreign-currency purchases — DB DONE: `0733_erplt_purchase_docs_fx_rate.sql` applied + verified 2026-11-13 (Prisma pulled, types regenerated). NEXT: code steps (1)–(6) below.**
Findings 2026-11-13: the posting engine already converts with the document's `exchange_rate` (`erp-lite-posting-engine.service.ts` ~L1164 `line.amount * exchange_rate`), and `org_tax_lines_tr` already has `fx_rate`, `fx_rate_date`, `fx_rate_source`, `fx_rate_id`, `base_*`. The FX resolver is `resolveRate(tenantId, { from, to, date })` in `web-admin/lib/services/fx/fx-rate-resolver.service.ts` (returns `rate` exact string, `rateDate`, `rateId`, `book`, `sourceCode`, `stale`; throws `FxError(RATE_NOT_FOUND)`; SAME_CURRENCY → rate '1').
Code steps after 0733: (1) one helper `resolveDocFxRate(tenantId, currencyCode, date)` → `{ exchangeRate, fxRateDate, fxRateSource, fxRateId }` (same currency → 1 + NULLs; no rate → a clear CommercialRuleError/ERP-Lite error with an EN/AR message pointing to Settings › Currencies & FX). (2) Use it in the four create paths (expense in `erp-lite-expenses.service.ts`; PO, AP invoice, AP payment in `erp-lite-v2.service.ts`), writing the 4 columns instead of the literal 1, and pass `exchange_rate` to the posting dispatch (already read from the document). (3) `purchase-tax.service.ts`: drop the `TAX_CURRENCY_UNSUPPORTED` refusal; `resolvePurchaseTax` takes the FX facts; `writePurchaseTaxLines` writes `base_currency_code` = organization currency, `base_taxable_amount` / `base_tax_amount` = amount × rate rounded to the base minor unit, and the 4 fx columns. (4) Petty cash (`org_fin_petty_cash_txn_tr`, cashbox currency) — check whether it can be foreign; refuse if not supported. (5) Tests: same currency unchanged; USD expense in an OMR organization → base amounts, ledger lines in base, tax lines in base; missing rate refused. (6) UI: show the rate used on the expense / invoice detail (read-only); optional manual rate override is NOT in scope (name it in docs). Original notes follow.
Finding: ERP-Lite purchase documents accept any `currency_code` but the expense insert stores `exchange_rate = 1` (`web-admin/lib/services/erp-lite-expenses.service.ts`; check PO / AP invoice / AP payment in `erp-lite-v2.service.ts` too). So a foreign-currency expense is mis-valued in base even with tax off; `purchase-tax.service.ts` refuses taxed ones (`TAX_CURRENCY_UNSUPPORTED`, marked `shortcut:`).
Build: capture the rate on each document from the Currency/FX service (completed FX program), store per the Multi-Currency Transaction Standard (`base_currency_code`, `base_amount`, `fx_rate`, `fx_rate_date`, `fx_rate_source`, `fx_rate_id`; `base = amount × fx_rate`), post the ledger in base, then in `writePurchaseTaxLines` set `base_currency_code` = organization currency and `base_taxable_amount` / `base_tax_amount` = amount × rate (rounded to the base minor unit), and remove the currency refusal. Tests: same currency unchanged (rate NULL, base = amount); foreign currency → base amounts, return boxes in base.

**4.1.4 Withholding tax not posted to the ledger — NOT STARTED (needs AP posting first).**
Finding: ERP-Lite posts only order, payment, refund, expense, petty cash, gift card, cash and tax-advance events (`ERP_LITE_TXN_EVENT_CODES` in `web-admin/lib/constants/erp-lite-posting.ts`). Supplier invoices and supplier payments are not posted at all, so withheld tax has nowhere to go.
Build: new events `AP_INVOICE_POSTED` (Dr expense / Input VAT, Cr AP control) and `AP_PAYMENT_RECORDED` (Dr AP control, Cr cash/bank, Cr WHT payable for the withheld part); governance seed migration (event codes, mapping rules, policy rows, account usage codes `AP_CONTROL`, `WHT_PAYABLE`, like migrations 0424 / 0725); dispatchers in `erp-lite-auto-post.service.ts` called inside the AP invoice / payment transactions in `erp-lite-v2.service.ts`; tests; QA. New ERP-Lite identifiers carry `erplt` where CLAUDE.md requires.

**4.1.5 Fixed-amount / document-level tax codes — DECIDED: not built.** No GCC kit uses them; `TAX_CODE_UNSUPPORTED` stays as an explicit refusal. Build only when a country kit needs one.

### 4.2 Navigation vs access-contract drift — DONE (0729, owner-approved 2026-11-12)

`__tests__/auth/platform-inventories.test.ts` fails on 6 `nav_contract_permission_mismatch` items. The live menu gate is ONE `sys_components_cd.main_permission_code` per row, but the page contracts need several:

| Route | Menu (DB + navigation.ts) | Page contract |
|---|---|---|
| `/dashboard/delivery` (2 rows: `delivery`, `orders_delivery`) | `orders:read` | `drivers:read` AND `orders:read` |
| `/dashboard/catalog/preferences` | `config:preferences_manage` | any of `orders:service_prefs_view`, `orders:read`, `config:preferences_manage` |
| `/dashboard/settings/roles`, `/permissions` | `settings:read` | `*:*` or `settings:*` |
| `/dashboard/settings/payments` | `settings:read` | `payment_config` view permission |

Recommended: make the contract the single truth. Set each menu row's main permission to the contract's gating code (payments → the payment-config view code; roles/permissions → `settings:*`; preferences → `orders:read`), and remove the duplicate `orders_delivery` menu row. Dual-write: `navigation.ts` + a `sys_components_cd` migration (`/navigation` skill). Delivery needs all-of; either keep `orders:read` and accept a refused page for users without `drivers:read`, or add a `main_permission_mode` column. Changes which roles see menu items, so the owner decides.

### 4.3 Old test debt — DONE 2026-11-12 (see STATUS)

- HQ `platform-api`: 5 spec files have never compiled since 2026-02 (`tenant-runtime-jwt.guard.spec.ts`, `tenant-permission.service.spec.ts`, `stng-tenant-overrides.service.spec.ts`, `tenant-runtime.service.spec.ts`, `tenant-runtime.integration.spec.ts`): Supabase mock typing and changed signatures. Rewrite the mocks; no product code change.
- Tenant `web-admin` full jest (2026-11-12): 5146 / 5150 pass. Fixed in this session: placeholder Supabase env in `jest.setup.js`, `order-change-mutation` client mock, receipt-page fetch mock, label `publicTrackingPath` null, overpayment mock. Remaining: the platform-inventories nav drift in §4.2.

## 5. Files changed in this last session (uncommitted)

Tenant: `supabase/migrations/0728_tax_kit_facts_verified.sql` (new), `web-admin/prisma/schema.prisma`, `lib/services/stored-value-funding.service.ts`, `src/features/marketing/ui/gift-card-sell-dialog.tsx`, `messages/{en,ar}/marketing.json`, `jest.setup.js`, `lib/services/labels/label-data.service.ts`, tests (`stored-value-funding`, `order-change-mutation`, `receipt-page`, `overpayment-disposition.wallet`), Tax docs.
HQ: `platform-api/src/modules/products-items-config/bulk/bulk.columns.ts` (`tax_supply_code` → `tax_item_class_code`, needed after 0727), `platform-api/src/modules/tax-setup/tax-setup.service.ts`, `platform-web/lib/api/tax-setup.ts`, `platform-web/src/features/tax-setup/ui/tax-kit-draft-dialogs.tsx`, `tax-kit-version-drawer.tsx`, `platform-web/messages/{en,ar}/taxSetup.json`.

### 5.1 Changed 2026-11-12 / 13 (uncommitted)

Tenant: `supabase/migrations/0729_nav_menu_gates_follow_contracts.sql`, `0730_tax_ae_return_boxes_verified.sql`, `0731_tax_kits_purchase_reverse_charge.sql` (all applied); `web-admin/config/navigation.ts` (menu gates = page contracts, duplicate top-level Delivery removed); `web-admin/src/features/settings/access/settings-access.ts` (Roles/Permissions page code `roles:update`); regenerated `docs/platform/inventories/*` + `web-admin/data/platform/platform-info-inventory.json`; Tax docs.
HQ: `platform-api/src/common/services/tenant-permission.service.ts` (cmx_can gets tenant + user; `allow` column) + its spec rewritten; `platform-api/src/common/guards/tenant-runtime-jwt.guard.ts` (403 context errors no longer become 401) + spec; `tenant-runtime-api/__tests__/tenant-runtime.service.spec.ts`; `settings/services/__tests__/stng-tenant-overrides.service.spec.ts`; integration spec moved to `platform-api/test/tenant-runtime.e2e-spec.ts` (git mv).

## 6. Then close the plans

Owner QA with the three QA guides (Service Speeds, Setup Health, Tax Config incl. 31a–31g and the 0728 scenarios 31h–31k), then mark each STATUS "CLOSED".
