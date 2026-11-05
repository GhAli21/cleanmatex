# Human-Friendly Codes — P0 Inventory (read-only)

| Field | Value |
|---|---|
| Phase | P0: inventory and seed lists (read-only) |
| State | **DONE — used by P1–P3** (2026-10-30; P3 applied 2026-10-31, P3b written 2026-10-31, Asia/Muscat). Findings S7, S8 and the scanner notes in §2 are handled by P3 / P3b (see plan §1); the assembly scan backend uses the shared resolver after its own barcodes since 2026-10-31 (A-42) |
| Plan | `IMPLEMENTATION_PLAN_Human_Friendly_Codes.md` (§1, §3, §5.3, §5.9, §5.12, §20, §22 updated from this file) |
| Proposal | `PROPOSAL_Human_Friendly_Codes.md` |
| Method | Read-only scan of both repos. Tenant repo `F:\jhapp\cleanmatex` covers migrations, web-admin, cmx-api and cmx_mobile_apps. HQ repo `F:\jhapp\cleanmatexsaas` covers platform-api, platform-web and platform-workers. **No DB query was run in P0**, because a connection would need a secret from `.env`. DB-only facts are in §9 as read-only SQL. |
| Changes made | This file and the plan only. No code, migration, config or DB change. |

Everything marked **PROPOSED** needs your approval before P1 writes it into a migration.

---

## 1. Migration numbering (updated 2026-10-30)

- Other people add migrations at the same time, so migrations are referred to by **name**; each number is assigned at creation time (re-list `supabase/migrations/` immediately before creating each file, re-check for collisions after the last file).
- P1 names and actual numbers: `scope_modules` `0666_sys_platform_scope_modules.sql`, `doc_seq_type_config` `0667_doc_seq_type_config.sql`, `hq_general_config` `0668_hq_general_config.sql`, `doc_seq_counters` `0669_doc_seq_counters.sql`, `doc_seq_engine_fns` `0670_doc_seq_engine_fns.sql`, `doc_seq_consistency` `0671_doc_seq_consistency.sql`, `doc_seq_code_tables_registry` `0672_doc_seq_code_tables_registry.sql`.
- Later phases: `ord_order_no_engine`, `ord_item_srno_barcode`, `ord_piece_code_human`, `fin_store_credit_note_scn`, `permissions_doc_seq`, `ff_human_codes` (numbers assigned at creation time).
- Assigned so far (2026-10-31): `ord_order_no_engine` `0674`, `ord_root_order_id` `0677`, `tenant_hard_delete_guard` `0678`, `ord_item_srno_barcode` **`0682`**, `ord_piece_code_human` **`0683`** (`0675`, `0676`, `0679`–`0681` are other work; P3 was renumbered on 2026-10-31 when `0681_fin_view_tenant_order_idx.sql` appeared).
- **No HQ nav migration (APPROVED 2026-10-30):** the HQ sidebar is hard-coded in `platform-web/components/layout/sidebar.tsx` (routes array, lines 58–109), so HQ nav is a code edit in P7/P8. `navigation_doc_seq` is skipped; no number is reserved.

---

## 2. Surprises that change the plan (each with its fix)

| # | Finding (evidence) | Impact | Fix (where in plan) |
|---|---|---|---|
| S1 | `org_tenants_mst` **already has** `date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY'`, `time_format VARCHAR(5) DEFAULT '24h'` and `first_day_of_week INTEGER DEFAULT 6` (`0039_create_tenant_lifecycle_tables.sql:150–156`). `language VARCHAR(10) DEFAULT 'en'` and `timezone` also exist. There is no `locale_code`, `current_fiscal_year` or `fiscal_year_start_month`. | §5.3 `ALTER TABLE … ADD COLUMN date_format/time_format/first_day_of_week/language_code` would add duplicate columns, or no-op under `IF NOT EXISTS`. Every existing row is non-NULL, so the "NULL = inherit HQ" rule can't hold for these columns. | **§5.3:** add only `current_fiscal_year TEXT`, `fiscal_year_start_month SMALLINT` and `locale_code VARCHAR(10)`, all NULL = inherit. Reuse `language` (no `language_code`). Keep the values **lowercase `'24h'/'12h'`**, which match the data and the HQ DTO. `first_day_of_week` runs 0=Sunday … 6=Saturday. CHECKs must accept today's values (preflight §9 Q8). Decide whether to `DROP DEFAULT` on the 3 existing columns so new tenants inherit HQ (recommended; existing rows keep their values). |
| S2 | HQ **already edits** these columns: `platform-api/src/modules/tenants/dto/update-tenant-locale-settings.dto.ts` (DATE_FORMATS `DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD`; TIME_FORMATS `24h, 12h`; LANGUAGES `en, ar`; first_day_of_week 0–6) and `tenants.service.ts:320–404` (get/update locale settings, fallbacks OM / +968 / Asia/Muscat / en / DD/MM/YYYY / 24h / 6). | The new `TenantGeneralConfigService` would duplicate this. | **§6 / P7:** extend the existing tenants locale-settings service and DTO with the 3 new columns and the HQ-default fallback. Do not add a second endpoint for the same columns. `hq_general_config` gets its own module. |
| S3 | The wizard defaults are `platform-web/src/features/tenants/hooks/use-tenant-creation-wizard.ts:24–55`: OM, **OMR**, Asia/Muscat, en, FREE_TRIAL, **trial_days 30**, monthly. The create service (`tenants.service.ts:60–95`) requires a currency (`assertCurrencyEnabled`; `org_currency_cf` is the authority, mirrored by `trg_orgcur_sync_tenant_ccy`). Plans also carry `trial_days`. | The plan seed `USD` / 14 days is wrong. | **§5.3 seed / A-21:** OMR and 30 days. The wizard prefill (A-13) reads `hq_general_config`; a plan's own `trial_days` overrides it. |
| S4 | `current_tenant_id()` (`0563:120`) reads `org_users_mst WHERE user_id = auth.uid()`. It is **NULL for Prisma and service-role connections**. | **Confirms** the plan's role-based check (§5.6 line ~479, §13): the check runs only when `auth.role() = 'authenticated'`. It must never be written as a bare `p_tenant IS DISTINCT FROM current_tenant_id()` without the role test, or every Prisma call would fail. | **§5.6:** keep it as planned. Add a DB test where a service-role call with a NULL `auth.uid()` passes and a JWT call for another tenant raises `DOC_SEQ_TENANT_MISMATCH`. |
| S5 | **Generators with SECURITY DEFINER that are open to every role.** `fn_next_fin_doc_no` (0214:98) and `generate_cash_drawer_sess_no` (0519:73) have no `REVOKE` and no `SET search_path`; PostgreSQL's default is EXECUTE to PUBLIC. `generate_order_number` is granted to `authenticated` (0012:198). All of them take an arbitrary tenant UUID. | Any JWT user (and maybe `anon` through PostgREST) could advance another tenant's finance counters (`fn_next_fin_doc_no` writes) or read another tenant's daily order volume. | **`doc_seq_engine_fns` (engine) or `ord_order_no_engine`:** `REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE … TO service_role, postgres`, and `ALTER FUNCTION … SET search_path = pg_catalog, public, pg_temp` for `fn_next_fin_doc_no(uuid,text)`, `generate_cash_drawer_sess_no(uuid)`, `generate_order_number(uuid)` (keep the `authenticated` grant only if a JWT RPC caller remains; see §5 of this file) and `generate_customer_number`. Check the live grants first with §9 Q11. |
| S6 | **Item srno is broken today.** The trigger is `before_ins_set_order_item_srno` → `trg_set_order_item_srno()` → `fn_next_order_item_srno(uuid, uuid)` (0015:30). Its regex `'^\\d+$'` in a standard-conforming string never matches a digit string, so the trigger always returns `'001'`. App writers set `<order_no>-<n>` at INSERT: `order-service.ts:861`, `:2727`, and `order-change-structural-write.ts:208` (serial from `facts.nextItemSerial`). `lib/db/orders.ts addOrderItems` and `splitOrderByPieces` (`order-service.ts` ~2283) rely on the trigger and get `'001'`. | The §5.9 preflight "raise if srno duplicated per tenant" will **fail** on any tenant that used those paths. The plan also names a zero-argument `fn_next_order_item_srno()`, but the real function takes `(uuid, uuid)`. | **§5.9:** (a) replace the body of `trg_set_order_item_srno()` and of `fn_next_order_item_srno(uuid,uuid)`, keeping the signatures; (b) **backfill** duplicate or non-canonical srno to `<order_no>-<n>` (ordered by `created_at, id`) **before** `uq_ord_item_srno`, and report rather than fail; (c) the guard can ship in `ord_item_srno_barcode`, because no code UPDATEs srno after insert (VERIFIED; all writes are INSERT data). |
| S7 | Item `barcode` holds an **SVG data URL**. `lib/db/orders.ts` addOrderItems UPDATEs it after insert. | The §5.9 note "expected count is 0" is not safe. Also `barcode = order_item_srno` from a broken `'001'` srno would collide under the new UNIQUE. | **§5.9:** run the barcode backfill **after** the srno backfill. Set `barcode = NULL` (or the canonical srno) where it is `LIKE 'data:%'`. Remove the writer in `lib/db/orders.ts` in P3. Count with §9 Q1. |
| S8 | `piece_code` is `GENERATED ALWAYS` from UUIDs (0073). No other migration references it. `SortingPieceCard.tsx:83` uses `hasTag = Boolean(piece.piece_code)`, so it is always "tag assigned". | Once `piece_code` becomes human, this UI bug stays. | **P3:** `hasTag = Boolean(piece.barcode)`. Check `pg_depend` live with §9 Q4. App consumers to retest: `processing-piece-map.ts:40`, `processing-modal.tsx:115`, `processing-piece-row.tsx:191`, `piece-export.ts:29`, `order-piece.mapper.ts:20`, `edit-review-changes.tsx:14`. |
| S9 | **Two split paths.** Legacy `splitOrder` (`order-service.ts:1298`) uses an RPC for a new ORD number, `order_type 'split_child'`, no transaction, and some writes **lack a tenant filter**. `splitOrderByPieces` (`:2167`) uses `-S${Date.now().slice(-6)}` and `'split'`, with no transaction (supabase-js calls). `parent_order_id` has a single-column FK; there is no root column. | A-19 (number under the root) needs a single path. The timestamp suffix can collide and is not human. | **P2/P3:** one transactional split service (Prisma `$transaction`) calling `fn_ord_next_sub_order_no`. Every write gets `tenant_org_id`. Retire the legacy path or route it to the same service. Optionally add `root_order_id` plus a composite FK `(parent_order_id, tenant_org_id)` (Prisma-safe order, no `ON DELETE SET NULL`). **Done:** single transactional split in P2; `root_order_id` with composite FK `fk_ord_root_order` (`ON DELETE SET NULL (root_order_id)`, PG15+) in P2.1 `0677` (A-28). |
| S10 | Two voucher generators write **one table** (`org_fin_vouchers_mst`, `uq_fin_voucher_tenant_no`) with different prefixes and lock keys. `voucher-service.ts:60 generateVoucherNo` gives VCR-RCP / REF / CRN / VCR-PAY / VCR-ADJ, `PFX-YYYY-00001`. `voucher-number.service.ts generateBizVoucherNo` gives RV / PV / RF / ADJ / TR / VCH, `PFX-YYYY-000001`. Both use lexical MAX and the server year. | `ADJ-2026-…` could come from both (pad 5 vs 6) and the locks don't serialise each other. | **Register both as DOMAIN now** (§6). P10: move vouchers to the engine with one lock. Until then, the consistency view flags shared prefixes in the same target column. |
| S11 | **Prefix clashes** in human terms: **INV** (tax invoice `INV-<FY>-000001`, retail inventory item `INV-00001`, HQ billing invoice `INV-YYYY-000001`); **CN** (tax credit note vs legacy store credit `CN-<tenant8>-n`); **REF** (`fn_next_fin_doc_no` REFUND `REF-` vs legacy voucher `REF-YYYY-`); **ADJ** (both voucher generators); **CRN** (legacy credit-note voucher vs ERP cost run `CRN-YYYYMM-`); **CMX** (gift cards `CMX-XXXX-…` vs HQ lead codes `CMX-YYYYMMDD-…`). | A global `uq_doc_seq_type_prefix` cannot be created over the DOMAIN rows. | **§5.2:** make `uq_doc_seq_type_prefix` a **partial** unique index on `(prefix) WHERE manage_by_level = 'GENERAL' AND prefix IS NOT NULL`. DOMAIN rows may share a prefix, and `vw_doc_seq_consistency` reports them as WARN, not ERROR. The prefix CHECK (`^[A-Z]{2,5}$`) applies to GENERAL rows only, because DOMAIN prefixes include `VCR-RCP`, `Z-` and `U`. |
| S12 | `print-label-button.tsx` interpolates `order.qr_code`, `order.barcode`, the customer name and other values **raw into HTML** in `window.open` (an XSS sink). Nothing writes `org_orders_mst.qr_code/barcode`, so the button is always disabled. | Security plus a dead feature. | **P4:** render from `order_no` with the payload codec plus bwip-js/qrcode, and HTML-escape every interpolated value (or use a React print root). **DONE 2026-10-31 (P4):** React print root in a hidden iframe (`printReactInIframe`), values from `GET /api/v1/orders/[id]/label-data`, no phone printed, button always enabled. |
| S13 | `generate_order_number` uses `CURRENT_DATE` (DB `TimeZone = Asia/Muscat`, per proposal §11.3), not the tenant's timezone. MAX+1 has no lock and `LPAD 4` truncates after 9999. | Known. | Unchanged (`ord_order_no_engine`). **New:** the orders list sorts by `order_no` lexically (`app/api/v1/orders/route.ts` validSortColumns). With growing padding, `…-10000` sorts before `…-9999`. **Fix:** sort `order_no` as `(created_at, order_no)` or by a numeric suffix expression. |
| S14 | Tenant cleanup `hq_mntnc_cleanup_tenant_orders` (0465 → renamed in 0466; called by HQ `tenant-maintenance-delete-orders.service.ts:75`) deletes orders, items, pieces, credit notes and more. There is no tenant hard-delete anywhere. | If the counters were reset, numbers would be reused after cleanup. | **Decision (PROPOSED):** cleanup does **not** reset `org_doc_seq_mst`. This is documented in the function comment and in the HQ screen text. `org_doc_seq_mst.tenant_org_id` FK `ON DELETE RESTRICT` is fine. |
| S15 | `generate_customer_number` (0011:166) writes `sys_customers_mst.customer_number` (a **global** table) keyed by `first_tenant_org_id`, with MAX+1, no lock and LPAD 5. There is no org-level column. Caller: `customers.service.ts:183`. | The A-02 target `org_customers_mst.<column>` is wrong. | **A-02 CUSTOMER row:** target `sys_customers_mst.customer_number`, DOMAIN. The race fix is a P10 decision. |
| S16 | Side note (out of scope): `platform-api … marketing-leads.repository.ts:56` interpolates the raw search term into a PostgREST `.or()` filter (filter injection). | Security. | Separate ticket: escape `,()` and `%_\` the same way `app/api/v1/orders/route.ts:296` does. |
| S17 | **Two generators on `org_product_data_mst.product_code`.** `catalog.service.ts:191` gives `PROD-00001` (lexical MAX over all products; takes the first `\d+`). `inventory-service.ts:73` gives `INV-00001` (retail items, `LIKE 'INV-%'`). | Two DOMAIN rows share one target. | Register both, with rows 25/26 in §7. P10 can merge them into one engine type with a per-category prefix. |
| S18 | Plan §5.2 constraints **reject the real DOMAIN rows.** `uq_doc_seq_type_target UNIQUE(target_table, target_column)` blocks tax INV/SIM/CN/DN (one column), the 7 voucher prefixes (one column) and PROD/INV (one column). `prefix ~ '^[A-Z]{2,5}$'` blocks `U`, `Z` and `VCR-RCP`. `parts_format` must end in `SEQ\|RAND`, which blocks Z-report `PARENT`. `uq_doc_seq_type_prefix` blocks the S11 clashes. | The `doc_seq_type_config` seed would fail. | **§5.2:** (a) `uq_doc_seq_type_target` and `uq_doc_seq_type_prefix` become **partial unique indexes `WHERE manage_by_level = 'GENERAL'`**. `vw_doc_seq_consistency` raises ERROR if any DOMAIN row shares a GENERAL row's target or prefix, and WARN for DOMAIN↔DOMAIN shares. (b) The prefix CHECK becomes `prefix IS NULL OR (manage_by_level = 'GENERAL' AND prefix ~ '^[A-Z]{2,5}$') OR (manage_by_level <> 'GENERAL' AND prefix ~ '^[A-Z][A-Z0-9-]{0,11}$')`. (c) The `parts_format` CHECK also allows `PARENT` as the last token (the GENERAL shape CHECK still forbids it). |

---

## 3. Code and generator inventory (every human code found)

Columns: code, example, generator and where, target column, scope, quality and risk, P0 classification.

### 3.1 In scope of this plan (GENERAL or changed)

| Code | Example | Generator (evidence) | Target | Risk today | Plan |
|---|---|---|---|---|---|
| Order no | `ORD-20261030-0007` | `generate_order_number(uuid)` 0012:144–198; app wrapper `lib/utils/order-number-generator.ts` | `org_orders_mst.order_no` (UNIQUE tenant) | MAX+1 without a lock; DB-day; LPAD 4 truncates; granted to authenticated | GENERAL ORDER (`ord_order_no_engine`) |
| Sub-order | `ORD-…-S482913` (timestamp) / new ORD (legacy) | `splitOrderByPieces` :2167; `splitOrder` :1298 | `order_no` | Collision-prone; no transaction | `fn_ord_next_sub_order_no` → `<root>-S<n>` |
| Item srno | `ORD-…-2` or `001` | App INSERTs (S6) plus the trigger (broken) | `org_order_items_dtl.order_item_srno` | Duplicates `'001'` | DOMAIN, fixed in `ord_item_srno_barcode` |
| Item barcode | SVG data URL | `lib/db/orders.ts` | `org_order_items_dtl.barcode` | Image in a text column | Value or NULL (`ord_item_srno_barcode`) |
| Piece code | `<uuid>-<uuid>-1` | Generated column (0073) | `org_order_item_pieces_dtl.piece_code` | Not printable | DOMAIN, trigger `<srno>-<piece_seq>` (`ord_piece_code_human`) |
| Piece tag | NULL | Edit flows; scan `app/api/v1/…/pieces/scan` (eq barcode within item) | `org_order_item_pieces_dtl.barcode` | Never printed | External tag, unique per tenant (`ord_piece_code_human`) |
| Store credit note | `CN-1a2b3c4d-00001` | `stored-value.service.ts:414/472` (count+1, part of the tenant UUID) | `org_credit_notes_mst.credit_note_no` (`uq_credit_note_no`, 0286) | Race; leaks part of the tenant UUID | GENERAL `SCN-YYYY-000001` (`fin_store_credit_note_scn`). `org_order_credit_apps_dtl.credit_note_no` (0283:13) is a **snapshot copy**, so it is not a generator. |

### 3.2 Existing generators to register as DOMAIN (unchanged in this plan)

| Code | Format | Generator | Target | Notes |
|---|---|---|---|---|
| Journal | `000001` (prefix NULL) | `fn_next_fin_doc_no(t,'JOURNAL')` 0214; posting engine :1038/1052 | `org_fin_journal_mst.journal_no` (`uq_ofj_tenant_no`) | Auto-inserts a row with prefix NULL, pad 6; LPAD truncates; S5 |
| AR invoice | `ARI-000001` | `fn_next_fin_doc_no(t,'AR_INV')`; `ar-invoice.service.ts:150/1383/1600` | `org_invoice_mst.invoice_no` | Prefix seeded only for existing tenants (0314). New tenants get NULL, so the number has **no prefix** |
| Refund | `REF-000001` | `fn_next_fin_doc_no(t,'REFUND')`; `order-refund.service.ts:596` | `org_order_refunds_dtl.refund_no` | Same NULL-prefix risk (0387) |
| Tax invoice / simplified / credit / debit | `INV-2026-000001`, `SIM-…`, `CN-…`, `DN-…` | `tax-document-sequence.service.ts:24 allocateTaxDocumentSequence` (locked counter `org_tax_doc_seq_counters`, PK tenant+type+fiscal_year) | `org_tax_documents_mst.document_no` | **Good pattern.** Keep it |
| Vouchers (legacy) | `VCR-RCP-2026-00001`, `REF-…`, `CRN-…`, `VCR-PAY-…`, `VCR-ADJ-…` | `voucher-service.ts:60` | `org_fin_vouchers_mst.voucher_no` | S10 |
| Vouchers (BVM) | `RV-2026-000001`, `PV`, `RF`, `ADJ`, `TR`, `VCH` | `voucher-number.service.ts` (`voucher-biz.service.ts:394`, `voucher-line-reversal.service.ts:157`) | same | S10 |
| Cash drawer session | `SES-20261030-0001` | `generate_cash_drawer_sess_no` 0519 (advisory lock) | `org_cash_drawer_sessions_mst.session_no` | No search_path; open grants (S5); LPAD 4 |
| Cash drawer trx | `CDT-20261030-0001` | `generate_cash_drawer_trx_no` 0527:308 (lock, search_path, revoked) | `org_cash_drawer_trx_mst.trx_no` (`uq_ocdt_trx_no`) | LPAD 4 truncates |
| POS session | `POS-20261030-AB12CD34` | `pos-session.service.ts:215` (random) | `org_pos_sessions_mst.session_no` | Random part; RAND token |
| Z-report | `Z-<session_no>` | `pos-shift-report.service.ts:350`, prefix `lib/constants/pos-shift-report.ts:28` | `org_pos_shift_z_rpt_tr.report_no` | Derived (PARENT) |
| Customer | `CUST-00001` | `generate_customer_number` 0011:166; `customers.service.ts:183` | `sys_customers_mst.customer_number` | S15 |
| User | `U000001` | `fn_org_user_code_next()` 0563 (global `org_user_code_seq`, skips manual codes) | `org_users_mst.user_code` (column default) | Platform-wide, scope SYS |
| Product | `PROD-00001` | `catalog.service.ts:191` lexical MAX, `\d+` | `org_product_data_mst.product_code` | Race |
| Inventory item | `INV-00001` | `inventory-service.ts:73` lexical MAX `LIKE 'INV-%'` | `org_product_data_mst.product_code` (retail) | INV clash (S11) |
| Gift card | `CMX-XXXX-XXXX-XXXX` | `gift-card-service.ts:261` random | `gift_card_code` | CMX clash (HQ leads) |
| Delivery route | `RT-2026-001` | `delivery-route-command.service.ts:212`, counter `org_dlv_route_seq_cf` upsert RETURNING | `route_number` | **Good pattern**; pad 3 grows |
| B2B contract | `CON-202610-0001` | `b2b-contracts.service.ts:99` count+1 | `contract_no` | Race; manual override allowed |
| B2B statement | `STMT-202610-0001` | `b2b-statements.service.ts:81` count+1 | `statement_no` | Race |
| AR dispute | `ARD-20261030123456-AB12` | `ar-dispute.service.ts:66` UTC time + random | `dispute_no` | RAND |
| Dunning run | integer | `ar-dunning-ops.service.ts:74` MAX+1 per customer | `run_no` | PER_PARENT |
| AR reconciliation | `RECON-2026-001` | `reconciliation.service.ts:261` count+1 | `run_no` | Race |
| ERP expense | `EXP-202610-00001` | `erp-lite-expenses.service.ts:1139` COUNT+1, UTC month | `org_fin_exp_mst.expense_no` | Race |
| Petty cashbox / txn / recon | `PCB-…`, `PCT-…`, `PCR-…` | same | `org_fin_cashbox_mst.cashbox_code`, `org_fin_cash_txn_tr.txn_no`, `org_fin_cash_rec_mst.recon_no` | Race |
| Supplier / PO / AP invoice / AP payment / bank / bank stmt / bank recon | `SUP`, `PO`, `API`, `APP`, `BNK`, `BST`, `BRC` + `-YYYYMM-00001` | `erp-lite-v2.service.ts:2425` (constants :146–152) | `org_fin_supp_mst.supplier_code`, `org_fin_po_mst.po_no`, `org_fin_ap_inv_mst.ap_inv_no`, `org_fin_ap_pmt_mst.ap_pmt_no`, `org_fin_bank_acct_mst.bank_code`, `org_fin_bank_stmt_mst.import_batch_no`, `org_fin_bank_recon_mst.recon_code` | Race |
| Alloc rule / alloc run / cost component / cost run | `ALR`, `APR`, `CMP`, `CRN` | `erp-lite-phase10.service.ts:838` | `rule_code`, `org_fin_alloc_run_mst.run_no`, `comp_code`, `org_fin_cost_run_mst.run_no` | Race; CRN clash |
| HQ billing invoice | `INV-2026-000001` | `sys_bill_generate_invoice_number` 0041:778 (global `seq_invoice_number`) | HQ billing invoice | Scope HQ; INV clash |
| HQ marketing lead | `CMX-20261030-000032` | `hq_crm_marketing_lead_code_next()` 0229 (counter `hq_crm_marketing_lead_daily_seq` FOR UPDATE) | lead code | Scope HQ; good pattern |

### 3.3 Order-number consumers (callers and parsers)

- **DB:** `generate_order_number` (the RPC from legacy `splitOrder`, plus the app wrapper). `get_order_number_prefix` and `extract_order_sequence` have **no app callers**; they appear only in the generated types.
- **web-admin:** `order-number-generator.ts` (`isValidOrderNumber` `^ORD-\d{8}-\d{4}$`, `parseOrderNumber`). Order search is `app/api/v1/orders/route.ts:294–304` (`order_no.ilike %q%`, escaped) and the sort is at :324 (S13). `getOrderByReference` uses case-insensitive mode.
- **cmx-api, platform-workers, cmx_mobile_apps:** **no** order-number regexes or `ORD-` parsing (VERIFIED by grep). Nothing to change there.
- **Scanners:**
  - Piece scan route: eq `barcode` within one item.
  - Assembly scan: matches the assembly item or the order-item `barcode`, so it never matches data URLs.
  - Both move to the tenant-wide resolver in P3.
  - **Update 2026-10-31 (P3b):** the piece scan route now uses `ScanResolveService` (tenant-wide: piece code, `CMX1:` QR, live tag), with the same response. The assembly scan UI uses `CmxScanInput`, and since 2026-10-31 `AssemblyService.scanItem` falls back to `ScanResolveService` (piece / line code, QR, live tag of the task's order) after its own barcodes (A-42). Order and piece UUID shortening on order screens was replaced by `order_no` / `order_item_srno` / `piece_code` (T3.9). Since T3.9b (2026-10-31) the station, pickup, delivery, home-collection and report screens show `order_no` as `CmxCodeChip`, and `PieceList` filters by piece code or live tag.
- **Labels / QR:**
  - `print-label-button.tsx` (4in×6in; fields order_no, qr_code, barcode, ready_by, customer name) has the S12 problem.
  - `barcode-generator.ts` is fake CODE128. Its `generateQRCode/decodeQRCode` leak the tenant UUID and phone, and only `lib/db/orders.ts` and tests use them. Retire it.
  - `qr-code-generator.ts` produces the tracking-URL QR (`receipt-service.ts:205/220/589`). Keep it.
  - Receipt HTML font is `Arial, sans-serif` (`receipt-service.ts:546`). There is no bundled Arabic font, so labels need the system fallback or a bundled Noto Naskh/Tajawal (P4 decision).
  - `qrcode ^1.5.4` is installed. bwip-js is not (A-07 adds it).

---

## 4. §22 TO VERIFY — resolution

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | No DB query run | **Still true for P0.** DB facts are listed as read-only SQL in §9. Proposal §11.3 has earlier anonymised counts (13 test orders, 2 tenants, 0 sub-orders, 0 qr/barcode). | §9 |
| 2 | Next free migration | **Superseded:** numbers assigned at creation time (§1). | `supabase/migrations/` |
| 3 | 0283 `credit_note_no` | **VERIFIED:** it is on `org_order_credit_apps_dtl`, as a snapshot copy of the store credit number. Not a generator. | `0283_harden_credit_apps_refunds.sql:13` |
| 4 | `pg_depend` on `piece_code` | **Partly VERIFIED:** no migration references it besides 0073. Live check: §9 Q4. | grep of migrations |
| 5 | srno INSERT vs UPDATE | **VERIFIED: INSERT only.** No later UPDATE, so the guard can ship in `ord_item_srno_barcode`. | S6 |
| 6 | Callers of `get_order_number_prefix`, `generateQRCode/decodeQRCode`, `.rpc('generate_order_number'` | **VERIFIED:** prefix and extract have no callers. QR helpers: `lib/db/orders.ts` and tests only. The RPC is called by legacy `splitOrder` (JWT supabase client) and the app wrapper. | §3.3 |
| 7 | Split transaction | **VERIFIED: no.** Neither split path has a transaction. | S9 |
| 8 | Tenant hard-delete | **VERIFIED:** none. Order cleanup is `hq_mntnc_cleanup_tenant_orders`. **Update 2026-10-31 (P2.1):** the only tenant row delete is the web-admin signup rollback; `0678` now allows it only for status `creating` (A-31). **Update 2026-10-31 (P2.2):** HQ `platform-api` `TenantsService.create` (the only HQ create path; `platform-workers` creates no tenants) also inserts `creating` and hard-deletes its own `creating` row when a required create step fails. No other tenant delete path exists in either repo. | S14 |
| 9 | DOMAIN targets and formats; customer column; user_code | **VERIFIED.** | §3.2, §6 |
| 10 | `updated_at` trigger fn; DomainError; order audit | **VERIFIED:** `update_updated_at_column()` (16 uses) and `public.trg_set_updated_at()` (newer). Use `trg_set_updated_at`. There is no DomainError; the base is `lib/errors/base-errors.ts AppError(message, code, statusCode, details)` with NotFound/Validation/Unauthorized/Forbidden/Conflict. The order audit is the `org_order_history` table (inserted by order-service, workflow-engine.service). | migrations; `lib/errors` |
| 11 | HQ prefix, nav, audit | **VERIFIED:** `/api/hq/v1` (`main.ts:36`, `API_PREFIX`). Nav is hard-coded in `platform-web/components/layout/sidebar.tsx` (§1). Audit is `audit.service.ts log(entry: AuditLogEntry)` :111, `logSecure` :180. Existing controllers: `codes`, `audit-logs`, `navigation/components` (tenant `sys_components_cd`), `settings`. | HQ repo |
| 12 | HQ DTO pattern; registry columns | **VERIFIED:** `core-data/dto/code-value.dto.ts` uses class-validator + `@ApiProperty` + class-transformer (`@Matches(/^[A-Z_]+$/)`, `@MaxLength`). `sys_code_tables_registry`: table_name PK, display_name/2, description/2, is_editable, is_extensible, supports_tenant_override, code_pattern, max_code_length, requires_unique_name, category, display_order, current_version, last_seeded_at, metadata, audit and rec_* columns. | HQ repo; prisma |
| 13 | Print settings; label fields; Arabic font | **VERIFIED:** no `LABEL_*` settings. The only print-like setting code in migrations is `RECEIPT_VOUCHER`. Print flags exist: `label_printing`, `label_printing_58mm`, `label_printing_80mm`, `intake_label_printing`, `thermal_printing_enabled`, `qr_code_generation`, `printing` (`lib/constants/feature-flags.ts`). Label fields: §3.3. No Arabic font is bundled (Arial). **Update 2026-10-31:** label options now in `sys_label_printing_cf` / `org_label_printing_cf` (A-46); `label_printing` no longer checked (A-47). | |
| 14 | Hooks and print folders | **VERIFIED:** hooks are in `web-admin/lib/hooks/` (there is no `src/ui/hooks`). Print components are in `src/features/orders/ui/*-print*.tsx` and `src/features/billing/ui/*-print-rprt.tsx`. **Fix §7:** put `useLabelPrint` in `lib/hooks/use-label-print.ts` and `CmxLabelRenderer` in `src/ui/print/` (new cmx folder) or `src/features/orders/ui/`. | |
| 15 | pgTAP, Playwright, jest-axe | **VERIFIED:** `supabase/tests/` has plain-psql SQL tests (no pgTAP `plan()/ok()`), so new DB tests follow that style. Playwright is present (`@playwright/test ^1.40`, `e2e/`). **jest-axe is not installed** (adding it is a dev dependency; ask first). | |
| 16 | Sentry; rate limiter | **VERIFIED:** there is no `@sentry/nextjs`, only `lib/utils/sentry-stub.ts`. The rate limiter is `lib/middleware/rate-limit.ts` (Upstash, optional), so reuse it for the scan and resolve endpoints. | |
| 17 | Orders search | **VERIFIED:** `GET app/api/v1/orders/route.ts`, param `search`, at :294–304, plus the sort issue (S13). | |
| 18 | cmx-api / workers / mobile | **VERIFIED: none** touch order-number formats. | grep |
| 19 | platform-web AGENTS.md; BR width | **VERIFIED:** Next.js 16 ("new; read `node_modules/next/dist/docs`"). The BR token stays reserved (A-10), so no width is needed now. | |
| 20 | `types:generate` scripts | **VERIFIED:** tenant root `npm run supabase:types` (local DB → `web-admin/types/database.ts`) and `npm run rebuild:platform-info-inventories`; web-admin `prisma:pull` / `prisma:generate`. HQ: `platform-api` and `platform-web` `types:generate` (both use the local Supabase DB URL). | `package.json` files |
| 21 | Credit-note notification; SMS length | **Partly VERIFIED:** event `credit_note.issued` exists (0345:144; template seed 0382), with category INVOICE and channel IN_APP. It covers tax and finance credit notes. There is no store-credit (SCN) event. SMS max length: §9 Q12. | |

---

## 5. Problems found → fixes (checklist for P1–P5)

1. **Order generator:** engine in `ord_order_no_engine` (counter row lock, tenant timezone, growing pad). Regex `^ORD-\d{8}-\d{4,}(?:-S\d+)?$`. Deprecate `get_order_number_prefix`/`extract_order_sequence`. Fix the lexical sort (S13).
2. **srno:** body fix plus backfill plus UNIQUE plus guard (S6).
3. **Item barcode:** stop writing the image, backfill after srno, CHECK (S7).
4. **piece_code:** DROP EXPRESSION, trigger, backfill; fix the SortingPieceCard tag (S8).
5. **Splits:** one transactional service with the tenant filter on every write (S9).
6. **Labels:** escape HTML, render from values (S12). Retire the leaky QR helper.
7. **Finance doc seq:** NULL prefix for new tenants. **Fix:** seed `AR_INV 'ARI-'` and `REFUND 'REF-'` at tenant init (or a COALESCE default in `fn_next_fin_doc_no`). Change `LPAD` to grow. REVOKE, search_path (S5). Run the §9 Q3 count first.
8. **Grants and search_path** on all old definer generators (S5).
9. **SCN** replaces `CN-<tenant8>` (`fin_store_credit_note_scn` = `0687_fin_store_credit_note_scn.sql`, written 2026-10-31, applied by the user 2026-11-01; row 4 is now GENERAL; DOMAIN list: `DOMAIN_CODES_REGISTRY.md`).
10. **Vouchers:** register both generators as DOMAIN; unify in P10 (S10).
11. **COUNT/MAX generators** (ERP, B2B, catalog, inventory, recon): register as DOMAIN now; engine migration in P10 waves.
12. **Prefix and target uniqueness, prefix and parts CHECKs:** partial unique indexes and CHECKs for GENERAL rows only (S11, S18).
13. **Customer number:** DOMAIN on `sys_customers_mst.customer_number` (S15).
14. **Engine tenant check** for Prisma callers (S4).
15. **§5.3 columns** (S1–S3).
16. **Cleanup does not reset counters** (S14).

---

## 6. APPROVED A-01 — scopes, modules, sub-systems (2026-10-30)

**APPROVED 2026-10-30** with the user's changes: `short_code` (2-5 capital letters, UNIQUE; length per plan A-27) on all three tables; journals belong to ERP; ORG modules incl. notification, auth, RBAC, settings, audit, reports, integrations; HQ-only modules ops, billing, tenants, plans, support, marketing (HQ_CRM) and the HQ copies of the platform modules. Reason: one lookup for every module that owns numbered records plus the platform modules. Source of truth: migration `scope_modules`.

| scope_code | short_code | name | name2 | description |
|---|---|---|---|---|
| TENANT_ORG | ORG | Organization | المنشأة | Data owned by one tenant organization (tenant_org_id). |
| SYS | SYS | Platform-wide | على مستوى المنصة | Platform-wide data shared by all tenants (no tenant_org_id). |
| HQ | HQ | Platform administration | إدارة المنصة | HQ / SaaS back-office data, used by the HQ console only. |

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

<details><summary>P0 PROPOSED draft (superseded 2026-10-30)</summary>

**PROPOSED (needs approval).** Codes are UPPER_SNAKE. Names are EN / AR.

`sys_saas_scope_cd`

| code | name | name2 |
||||
| TENANT_ORG | Organization | المنشأة |
| SYS | Platform-wide | على مستوى المنصة |
| HQ | Platform administration | إدارة المنصة |

`sys_modules_cd`

| code | name | name2 | Covers |
|||||
| ORDERS | Orders | الطلبات | orders, items, pieces |
| FIN | Finance | المالية | journal, AR, refunds, vouchers, store credit, gift cards, AR ops |
| TAX | Tax | الضرائب | tax documents |
| POS | Point of sale | نقاط البيع | POS sessions, cash drawers, Z-reports |
| CRM | Customers | العملاء | customers |
| CATALOG | Catalog | الكتالوج | products |
| INVENTORY | Inventory | المخزون | stock items |
| B2B | Business clients | عملاء الأعمال | contracts, statements |
| DELIVERY | Delivery | التوصيل | routes |
| ERP | ERP Lite | تخطيط الموارد | expenses, petty cash, procurement, AP, bank, allocation, costing |
| CORE | Core | الأساسي | users |
| HQ_BILLING | Platform billing | فوترة المنصة | SaaS invoices (HQ) |
| HQ_CRM | Platform marketing | تسويق المنصة | marketing leads (HQ) |

`sys_module_sub_systems_cd` (module/code)

| Module | Sub-systems |
|||
| ORDERS | ORDER, ORDER_ITEM, ORDER_PIECE |
| FIN | JOURNAL, AR, REFUND, VOUCHER, STORE_CREDIT, GIFT_CARD, AR_OPS (disputes, dunning, reconciliation) |
| TAX | TAX_DOC |
| POS | POS_SESSION, CASH_DRAWER, Z_REPORT |
| CRM | CUSTOMER |
| CATALOG | PRODUCT |
| INVENTORY | STOCK_ITEM |
| B2B | CONTRACT, STATEMENT |
| DELIVERY | ROUTE |
| ERP | EXPENSE, PETTY_CASH, PROCUREMENT, AP, BANK, ALLOCATION, COSTING |
| CORE | USER |
| HQ_BILLING | SAAS_INVOICE |
| HQ_CRM | LEAD |

</details>

---

## 7. APPROVED A-02 — `sys_doc_seq_type_cd` rows (2026-10-30)

**APPROVED 2026-10-30.** 51 rows; every row has a unique `type_prefix` (3-5 letters; the type key in `CMX1:<type_prefix>:<code>`). Child codes keep their own format (ORDER_ITEM / ORDER_PIECE print no prefix). Printed-prefix and target uniqueness stay partial (GENERAL only). All rows are DOMAIN in P1 (DOMAIN-first); P2 switches ORDER and P5 STORE_CREDIT_NOTE to GENERAL. `STOCK_TRANSACTION` (STK) was added in P1. Full `implement_description` per row: migration `doc_seq_type_config`.

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

<details><summary>P0 PROPOSED draft (superseded 2026-10-30)</summary>

**PROPOSED (needs approval, row by row).**
- GENERAL means the engine generates the number.
- DOMAIN means it is registered only; the existing generator stays and nothing changes.
- Pads marked "grows" never truncate.

| # | doc_type_code | Prefix | Scope | Module/Sub | Category | parts_format / pad | Reset | Level | Target | Draft `implement_description` |
||||||||||||
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

---

## 8. APPROVED A-16 — label settings and APPROVED A-21 — `hq_general_config` defaults (2026-10-30)

### A-16 (APPROVED 2026-10-30)

There are no `LABEL_*` settings today, so these are new. The sizes match the existing `label_printing_58mm` / `label_printing_80mm` flags.

| setting_code | Type | Default | Allowed | Notes |
|---|---|---|---|---|
| LABEL_ORDER_SIZE | TEXT | `4x6in` | `4x6in`, `80mm`, `58mm`, `A6` | Today's button uses 4in×6in |
| LABEL_PIECE_TAG_SIZE | TEXT | `58x30mm` | `58x30mm`, `50x25mm`, `80x40mm` | Heat-seal and paper tags |
| LABEL_PIECE_TAG_QR | BOOLEAN | `false` | — | QR on large tags only (Q9) |
| RECEIPT_ORDER_CODE128 | BOOLEAN | `true` | — | CODE128 of `order_no` on the receipt |
| LABEL_SHOW_CUSTOMER_NAME | BOOLEAN | `true` | — | Privacy option for shared counters |
| External tag charset | rule | printable ASCII 0x21–0x7E, trimmed, length 1–64 | — | `ck_ord_piece_barcode_fmt`; confirm against a real tag sample |

Settings are gated by the existing `label_printing` flags and the new `human_codes_scan_labels` flag (A-14).

**Superseded 2026-10-31 (plan A-46..A-48):** these options are stored in `sys_label_printing_cf` (system defaults, values above) and `org_label_printing_cf` (tenant / branch overrides), resolved by `fn_label_printing_resolve` (branch → tenant → system), migration `0685` (applied 2026-10-31). No `sys_tenant_settings_cd` rows. `label_printing` is not checked any more (available to all; flag kept in the catalog, `@deprecated` in `feature-flags.ts`); the size flags are not checked per size. Remaining `label_printing` references: `lib/constants/feature-flags.ts`, `lib/types/tenant.ts` (types only), `scripts/flag-catalog-db.json`, seeds 0066/0067, platform inventories JSON, docs.

### A-21 (APPROVED 2026-10-30; defaults on `date_format`, `time_format`, `first_day_of_week` dropped — verified safe in P1)

These values come from the current wizard, the HQ DTO and the tenant column defaults.

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

---

## 9. Read-only SQL to run before P1/P2/P3 (TO VERIFY)

Run these from Supabase Studio or psql with your own session. Never paste credentials into a chat. Each query is SELECT-only.

```sql
-- Q1 item barcodes stored as images
SELECT tenant_org_id, count(*) FROM org_order_items_dtl WHERE barcode LIKE 'data:%' GROUP BY 1;

-- Q2 srno shape and duplicates
SELECT CASE WHEN order_item_srno IS NULL OR order_item_srno='' THEN 'empty'
            WHEN order_item_srno ~ '^[0-9]+$' THEN 'digits'
            WHEN order_item_srno ~ '^ORD-[0-9]{8}-[0-9]+(-S[0-9]+)?-[0-9]+$' THEN 'canonical'
            ELSE 'other' END AS shape, count(*)
FROM org_order_items_dtl GROUP BY 1;
SELECT tenant_org_id, order_item_srno, count(*) FROM org_order_items_dtl
GROUP BY 1,2 HAVING count(*) > 1 ORDER BY 3 DESC LIMIT 50;

-- Q3 finance doc-seq rows with no prefix (new tenants)
SELECT doc_type_code, count(*) FILTER (WHERE prefix IS NULL) AS null_prefix, count(*) FROM org_fin_doc_seq_mst GROUP BY 1;

-- Q4 dependencies on piece_code
SELECT DISTINCT d.classid::regclass, d.objid, pg_describe_object(d.classid, d.objid, d.objsubid)
FROM pg_depend d JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE d.refobjid = 'public.org_order_item_pieces_dtl'::regclass AND a.attname = 'piece_code';

-- Q5 order_no patterns, duplicates, max daily sequence
SELECT regexp_replace(order_no, '[0-9]', '9', 'g') AS pattern, count(*) FROM org_orders_mst GROUP BY 1;
SELECT tenant_org_id, order_no, count(*) FROM org_orders_mst GROUP BY 1,2 HAVING count(*) > 1;
SELECT max(substring(order_no FROM '^ORD-[0-9]{8}-([0-9]+)')::int) FROM org_orders_mst;

-- Q6 piece barcode duplicates per tenant (`ord_piece_code_human` preflight)
SELECT tenant_org_id, barcode, count(*) FROM org_order_item_pieces_dtl
WHERE barcode IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;

-- Q7 live generator bodies vs migrations
SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
WHERE p.proname IN ('generate_order_number','fn_next_order_item_srno','trg_set_order_item_srno',
 'fn_next_fin_doc_no','generate_cash_drawer_sess_no','generate_cash_drawer_trx_no',
 'generate_customer_number','fn_org_user_code_next','get_order_number_prefix','extract_order_sequence');

-- Q8 tenant locale values (CHECK preflight for §5.3)
SELECT date_format, time_format, first_day_of_week, language, timezone, count(*)
FROM org_tenants_mst GROUP BY 1,2,3,4,5;

-- Q9 voucher prefix overlap
SELECT split_part(voucher_no, '-', 1) AS p1, length(voucher_no), count(*) FROM org_fin_vouchers_mst GROUP BY 1,2 ORDER BY 1;

-- Q10 legacy store credit numbers
SELECT count(*) FILTER (WHERE credit_note_no LIKE 'CN-%') AS legacy, count(*) FROM org_credit_notes_mst;

-- Q11 who can execute the definer generators (S5)
SELECT p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
CROSS JOIN pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND p.proname IN ('fn_next_fin_doc_no','generate_cash_drawer_sess_no','generate_order_number','generate_customer_number');

-- Q12 longest SMS template body (for the SCN message)
SELECT max(length(body)) AS en_max, max(length(body2)) AS ar_max FROM sys_ntf_template_ver_dtl;  -- templates are per event (0346/0382); SMS channel rows in sys_ntf_template_chan_dtl
```

---

*P0 is read-only. Nothing in code, migrations, config or the database was changed.*
