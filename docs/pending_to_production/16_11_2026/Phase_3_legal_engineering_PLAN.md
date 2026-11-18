# Phase 3 — Legal and customer rights — Engineering plan

**Status:** Not started. Reviewed 17 Nov 2026. Chosen design recorded the same day. Engineering has not started.  
**Written:** 17 Nov 2026. **Review:** 17 Nov 2026.  
**Scope:** Roadmap Phase 3 steps 3.2, 3.6, and 3.7. Items B4, N4, and U4.  
**Repos:** `cleanmatex` (migrations, `web-admin`) and `cleanmatexsaas` (`platform-api`, `platform-web`, `marketing-web`).  
**Related:** [ROADMAP.md](ROADMAP.md) Phase 3 · [01 — Business](01_business_and_commercial_blockers.md) B4 · [07 — Notifications](07_notifications.md) N4 · [09 — Customers](09_customers_users_and_identity.md) U4 · [Go / No-Go Register](Phase_0_to_4_Go_No_Go_Register.md) rows 3.1, 3.2, 3.6, 3.7  
**Legal source:** [Lawyer_docs](Lawyer_docs/00_README_en.txt). Each document is an `_en.txt` / `_ar.txt` pair. Engineering does not rewrite that text.

This plan does not authorize applying SQL, filling the legal brackets, or putting the pages on the public internet. The Owner fills file 18, counsel signs file 00, and the Owner applies the migration.

After each step below, update this file's **Progress Log** before the next step starts. A step is not done without that row.

## Chosen design

These are the shapes to build. A wider acceptance row, a consent-history scan on every send, and a browser query of `sys_*` are not alternatives.

| Concern | Solution |
|---|---|
| HQ menu | New child of `dp_developer_portal`: `nav_code` `dp_legal_docs`, path `/developer-portal/legal-docs`, `nav_level` 2, `display_order` 304. Seed `hq_navigation_cd` in the migration. Mirror it in `FALLBACK_SECTIONS`, breadcrumbs, the command palette source, the hub card, and `layout.json` in both languages. Do not write `sys_components_cd`. |
| Published text | `sys_cmx_terms_docs_mst` plus immutable `sys_cmx_terms_docs_dtl`. `doc_kind` is `PUBLIC`, `ACCEPTANCE`, or `NOTICE`. A version is current only when both locales exist and neither body contains `[` or `]`. A trigger rejects updates of `body` and `body_sha256`. |
| Public read | Two HQ routes, no session, service-role read. `GET .../public/{docCode}/{locale}` is the current pointer: `Cache-Control: public, max-age=60, stale-while-revalidate=300`, `ETag` = `body_sha256`. `GET .../public/{docCode}/{versionCode}/{locale}` is immutable: `max-age=31536000, immutable`. 404 when that locale is not published. No `anon` SELECT. Marketing and the Tenant app fetch on the server and keep no second copy of the body. |
| Acceptance | One event in `org_legal_accept_mst`, one line per document in `org_legal_accept_dtl` (`doc_code`, `version_code`, `body_sha256`). One current pointer `org_legal_accept_cur`, primary key `tenant_org_id`. Adding a document later adds a line. It does not add a column. |
| Re-accept | Order create reads `org_legal_accept_cur` by primary key and compares TOS, DPA, and AUP with the current codes. Missing or older returns 409. Reads of old orders stay open. The banner uses the same read. |
| Consent | `org_cust_consent_cur` is the hot row: unique `(tenant_org_id, customer_id, channel_code, purpose_code)`. `org_cust_consent_dtl` is append-only proof. Dispatch and the intake screen read the current row only. A save updates the current row and inserts history only when a value or `notice_version` changed. |
| Marketing vs staff | Walk-in consent never writes `org_ntf_user_prefs_dtl`. Every send to a customer calls one gate: `assertCustomerMayReceive(tenant, customer, channel, purpose)`. Missing marketing consent is deny. WhatsApp service sends only when the current value is granted. SMS and email service send unless the current value is exactly refused. Staff campaigns keep the user-prefs table. |
| Anonymize | One database function, one transaction, this `tenant_org_id` only. `org_customers_mst.customer_id` points at global `sys_customers_mst`. If any other Tenant row still points at that global id, set this row's `customer_id` to null and do not touch the global row. If no other row points at it, clear the global contact fields in the same transaction. Never `DELETE` the global row: the FK is `ON DELETE CASCADE` into Tenant customers. |
| Issued invoices | `org_invoice_mst` stores `customer_id` and has no buyer-name column, so print follows the live customer. Before the live name is replaced, copy the current name into new snapshot columns on invoices already issued for this customer. Print prefers the snapshot when it is set. Do not change totals, numbers, or `handed_to_*`. |

## Objective

| Item | Result |
|---|---|
| B4 | Terms, Privacy, and the data-processing page on the marketing site and in the Tenant app, English and Arabic. One unchecked sign-up box. The server stores the version codes, the body hashes, and the UTC time. |
| N4 | Order intake records WhatsApp opt-in, SMS and email refusal, and a separate marketing opt-in, without wiping a choice already stored. |
| U4 | An authorized user can export a customer, then anonymize that person in one transaction. Orders, amounts, payments, and issued tax documents stay. |

Cookie notice, acceptable use, the sign-up sentence, the intake notice, and the counter notice ship in the same document register.

## Invariants

1. `Lawyer_docs` is the draft. `sys_cmx_terms_docs_dtl` is the published snapshot. A published `body` is never updated.
2. A version becomes current only when both `en` and `ar` rows exist and neither body contains `[` or `]`.
3. The marketing site and the Tenant app render the current row for the requested locale. They do not fall back to the other language. They do not keep a second copy of the legal body.
4. Sign-up stores the acceptance event, its lines, and the current pointer in the same transaction as the Tenant. If any insert fails, the Tenant is not created.
5. Creating an order on the server checks `org_legal_accept_cur`. A hidden client check is not enough.
6. Every `org_*` read and write filters `tenant_org_id` in that statement.
7. Anonymize changes one Tenant's customer. It does not change another Tenant, a shared global person, a money total, or an issued tax document.
8. `anon` and `authenticated` cannot insert, update, or select the document tables. Public reading is the API in the chosen design.

## Publish gate

Building may proceed while brackets remain in `Lawyer_docs`. A version with a bracket cannot be set current, and the public routes stay unpublished until:

1. File 18 in both languages has the same real facts, including the Supabase region.
2. Counsel has signed `Lawyer_docs/00_README_en.txt`.
3. The Owner has adopted the N4 rule, the U4 rule, and the liability cap.
4. The seeded rows are current and both locales return from the read API.

## Version codes

From `Lawyer_docs/18_SUBPROCESSORS_AND_VERSIONS_en.txt`. Do not invent codes.

| `doc_code` | `doc_kind` | Version | Source |
|---|---|---|---|
| `TOS` | `PUBLIC` | `tos-2026-11-17` | `02_TERMS_OF_SERVICE_en.txt`, `_ar.txt` |
| `PRIVACY` | `PUBLIC` | `privacy-2026-11-17` | `04_PRIVACY_POLICY_en.txt`, `_ar.txt` |
| `DPA` | `PUBLIC` | `dpa-2026-11-17` | `06_DATA_PROCESSING_AGREEMENT_en.txt`, `_ar.txt` |
| `DPP` | `PUBLIC` | `dpp-2026-11-17` | `08_DATA_PROCESSING_PAGE_en.txt`, `_ar.txt` |
| `COOKIE` | `PUBLIC` | `cookie-2026-11-17` | `10_COOKIE_NOTICE_en.txt`, `_ar.txt` |
| `AUP` | `PUBLIC` | `aup-2026-11-17` | `12_ACCEPTABLE_USE_POLICY_en.txt`, `_ar.txt` |
| `SIGNUP` | `ACCEPTANCE` | `signup-2026-11-17` | file 14, checkbox label, helper line, and lead-form line |
| `N4_NOTICE` | `NOTICE` | `n4-notice-2026-11-17` | file 15 section 3 |
| `COUNTER` | `NOTICE` | `n4-notice-2026-11-17` | file 17 |
| Pack | — | `legal-pack-2026-11-17` | column on every detail row of this seed |

The anonymize confirm text stays in Tenant i18n, version constant `u4-spec-2026-11-17`. The rule it carries is file 16. Only `PUBLIC` documents get a marketing route. `ACCEPTANCE` and `NOTICE` are loaded by the screen that shows them.

## Step 1 — Database

One new migration in `cleanmatex/supabase/migrations/`. List the folder and take the next number. Do not edit an old migration. Do not apply this one.

**`sys_cmx_terms_docs_mst`** — one row per `doc_code`. Columns: `doc_code` (PK), `doc_kind`, `name`, `name2`, `current_version_code`, `is_active`, audit columns. No `tenant_org_id`.

**`sys_cmx_terms_docs_dtl`** — one row per `doc_code` + `version_code` + `locale`. Unique on those three. Columns: `body` (TEXT), `body_sha256`, `published_at`, `pack_version`, `is_active`, audit columns. Trigger rejects an update of `body` or `body_sha256`.

**`org_legal_accept_mst`** — one acceptance event. `tenant_org_id`, `user_id`, `acceptance_method`, `pack_version`, `accepted_at` from the database clock, `locale`, `checkbox_was_preselected`, `source_ip`, `user_agent`. Index `(tenant_org_id, accepted_at desc)`.

**`org_legal_accept_dtl`** — lines of that event. `doc_code`, `version_code`, `body_sha256`. Composite FK to the event uses the parent key column order. RLS on. No password. No full body.

**`org_legal_accept_cur`** — one row per Tenant, primary key `tenant_org_id`. Holds the pack version and the TOS, DPA, and AUP version codes from the latest event. Written in the same transaction as the event.

**`org_cust_consent_cur`** — unique `(tenant_org_id, customer_id, channel_code, purpose_code)`. Holds the current value, basis, notice version, and time.

**`org_cust_consent_dtl`** — append-only proof. Fields from file 15 section 5, plus `tenant_org_id` on the row and in every index that leads. Index `(tenant_org_id, customer_id, shown_at desc)`. RLS on.

**`customers:anonymize`** — seed `sys_auth_permissions_cd` in this same migration, with the Arabic name. Grant it only to the roles the Owner names in the migration comment. Mirror the code later in `web-admin/lib/constants/permissions/`.

**Invoice snapshot** — add `buyer_name` and `buyer_name2` (TEXT, nullable) on `org_invoice_mst`. Print reads the snapshot when it is set, otherwise the live customer. New issues write the snapshot at issue time.

Grants: `anon` and `authenticated` have no privileges on the `sys_cmx_terms_docs_*` tables. Comment every new object and add `COMMENT ON`.

Seed the nine `doc_code` values and both locales from `Lawyer_docs` only after the brackets are gone. Until then the migration may create the tables and leave `current_version_code` null. A null current version means the public routes show "not published", not a draft.

**Step 1 close:** write the Progress Log row for Step 1. Do not start Step 2 in the same edit that forgets this row.

## Step 2 — HQ definition screens and API

Route: `/developer-portal/legal-docs/`. Page file: `platform-web/app/(dashboard)/developer-portal/legal-docs/page.tsx`. The `(dashboard)` layout already supplies the shell. This page does not wrap another shell.

Screens, in `platform-web/src/features/developer-portal/`:

- List: document code, kind, English name, Arabic name, current version, missing-locale warning.
- Version screen: both locales side by side, hash, published time. Insert a new version. Set current only when both locales pass the bracket check and the hash matches the body.
- Preview uses the locale direction: `ltr` for English, `rtl` for Arabic.

API on `platform-api`, module shape of `developer-portal`, under `/api/hq/v1/legal-docs`:

- `GET` list and `GET` one document with its versions. HQ session required.
- `POST` a version. Reject a body containing `[` or `]`. Compute `body_sha256` on the server.
- `POST` set current. Reject when either locale is missing.
- No `PATCH` of `body`.
- Public current and public immutable routes as in the chosen design. Rate-limit the public routes. Return the legal text only.

Navigation, all of these together:

- `hq_navigation_cd` seed: `dp_legal_docs` under `dp_developer_portal`, path `/developer-portal/legal-docs`, EN and AR labels, `nav_level` 2, `display_order` 304
- `FALLBACK_SECTIONS` in `platform-web/src/ui/navigation/cmx-sidebar.tsx`
- Breadcrumb and command palette, which read `hq_navigation_cd`
- Hub card in `developer-portal-hub-screen.tsx`
- Keys in `platform-web/messages/en/layout.json` and `messages/ar/layout.json`

Do not insert a Tenant-app row in `sys_components_cd` for this screen.

Setting a version current changes the pointer. The immutable URL does not need to be purged. The current URL expires inside 60 seconds.

**Step 2 close:** update the Progress Log before Step 3.

## Step 3 — Public pages, sign-up, and re-accept (B4)

**Marketing site.** Locale routes for the six `PUBLIC` documents. Footer links in `marketing-web/src/components/layout/site-footer.tsx`. The page fetches the current public route on the server. Early-access and contact forms use the `SIGNUP` lead line and store the privacy version, hash, and time on the lead row. That store does not create a Tenant.

**Tenant app.** The same six routes are public, so sign-up can open them before an account exists. Signed-in footer links to the same routes. Fetch on the server.

**Sign-up.** `web-admin/app/register/tenant/page.tsx`. One checkbox, unchecked on load. The label and helper come from `SIGNUP` for the screen locale. Submit stays disabled until it is checked. `POST /api/v1/tenants/register` writes `org_legal_accept_mst`, one line per accepted document, and `org_legal_accept_cur` in the same transaction, after the Tenant and the user exist, and rolls back if the current versions cannot be read or a row cannot be inserted. `checkbox_was_preselected` is stored as false.

**Re-accept.** When the current TOS, DPA, or AUP version differs from `org_legal_accept_cur`, the next admin session sees an unchecked box. The order-create API returns 409 until the pointer is updated. Reading existing orders stays allowed. The lookup is the primary key. There is no history scan on the order path.

Cookie page states that non-essential analytics are off. Do not load an analytics script.

**Step 3 close:** update the Progress Log before Step 4.

## Step 4 — Order intake (N4)

Screen: `web-admin/app/dashboard/orders/new/page.tsx` and the customer block on that flow. Also the customer profile, for a later change.

Load `N4_NOTICE` and `COUNTER` for the screen locale. Show the counter notice on the block.

- New customer: every box starts unticked. No current row exists.
- Existing customer: load `org_cust_consent_cur` for this Tenant and customer. Do not display a granted choice as off.
- No mobile: hide WhatsApp and SMS, store `NOT_APPLICABLE`, do not send.
- No email: hide email, store `NOT_APPLICABLE`, do not send.
- Channel off for the Tenant: hide that marketing box.

On save, upsert the current rows that changed and append one history row for each change, including a notice-version change. One transaction. Map exactly as file 15:

| Choice | Current value | Basis |
|---|---|---|
| WhatsApp service on | granted | `CONSENT` |
| WhatsApp service off | refused | `CONSENT` |
| SMS refusal off, number present | not refused | `CONTRACT` |
| SMS refusal on | refused | `CONTRACT` |
| Email, same pattern | email current row | `CONTRACT` |
| Marketing on | granted for that channel | `CONSENT` |
| Marketing off | `DENIED` | `CONSENT` |

`assertCustomerMayReceive` is the only send decision. It reads `org_cust_consent_cur` by the unique key. It does not read `org_ntf_user_prefs_dtl` and it does not scan history. The existing helpers in `whatsapp-customer-eligibility.ts` and `customer-dispatch-consent.ts` call that gate. A missing customer preference is not marketing consent.

Withdrawal from the profile updates the current row and appends history. The next dispatch reads the current row.

**Step 4 close:** update the Progress Log before Step 5.

## Step 5 — Anonymize (U4)

Screen: `web-admin/app/dashboard/customers/[id]/page.tsx`.

Permission `customers:anonymize` on the page, the export route, and the anonymize route. One constant. Access contract actions for export and anonymize. API: permission check, CSRF, tenant predicate, rate limit on anonymize. The write is one SQL function so the browser does not walk tables.

1. **Export** returns only this `tenant_org_id`: identity, addresses, communication choices, consent history, order totals, payments, invoices. No password, card, or session token. No other Tenant. No global-person row that another Tenant still links.
2. **Anonymize** uses the confirm text for `u4-spec-2026-11-17`. Second confirm required. The dialog states that orders, payments, and issued tax documents stay.

Refuse with no write when the row is the default guest, a B2B company, any order is not terminal, a wallet, advance, loyalty value, or receivable is not zero, or a draft tax document still points at this customer. The action does not zero a balance.

One transaction, this Tenant only:

- For each issued invoice of this customer, set `buyer_name` and `buyer_name2` from the live name when the snapshot is still null. Do not change money columns, invoice numbers, tax amounts, or `handed_to_*`.
- Clear the contact fields in file 16 sections 5 to 7, including order `customer_mobile_number`, `customer_email`, and contact keys inside `customer_details`. Clear `password_hash`.
- Set `name` and `display_name` to `Anonymized customer` and `name2` to `عميل مجهّل`. `is_anonymized = true`.
- If another `org_customers_mst` row still has this `customer_id`, set this row's `customer_id` to null and leave `sys_customers_mst` unchanged. If none does, clear that global row's contact fields. Do not delete it.
- Upsert consent current rows to refused and append method `ANONYMIZE`.
- Audit row: user, reason code, request reference, time. No old name, phone, or email.
- Second call returns success and writes nothing.

**Step 5 close:** update the Progress Log before Step 6.

## Step 6 — Contracts, language, performance, and proof

- Tenant access contracts for the register acceptance write and the customer export and anonymize actions. `npm run check:ui-access-contract` for those routes. No new Tenant sidebar entry.
- i18n chrome in both apps and both languages. Legal bodies stay in the document table. Run `npm run check:i18n` where message files change.
- Cmx components, `cmxMessage`, visible labels, keyboard access, and RTL on the Arabic preview and the intake block.
- Proof of cost: order create reads one current-acceptance row by primary key. A send reads one consent row by unique key. Public current responses are cacheable for 60 seconds. Immutable version responses are cacheable for a year. Anonymize is one function call.
- Tests: sign-up with the box off creates no Tenant; sign-up with the box on stores the event, the lines, and the pointer; re-accept returns 409 until the pointer moves; an existing current consent row is not cleared by a later order; WhatsApp left off does not send; marketing off does not send; anonymize cases in file 16 section 11; a second Tenant is unchanged; a shared `sys_customers_mst` row is not edited; an unshared global row is cleared and not deleted; an issued invoice keeps its snapshot and its totals; a body update is rejected; set-current fails with one locale; public GET does not return a draft.
- `npm run build` in `web-admin`, `platform-web`, `platform-api`, and `marketing-web` for the apps this step touched.

**Step 6 close:** update the Progress Log, then the register rows 3.2, 3.6, and 3.7 only with the evidence above.

## Progress Log

| Step | Status | Evidence |
|---|---|---|
| Review 17 Nov 2026 | Done | Gaps closed. Chosen design recorded. |
| 1 Database | Not started | |
| 2 HQ screens and API | Not started | |
| 3 Public pages and sign-up | Not started | |
| 4 Order intake | Not started | |
| 5 Anonymize | Not started | |
| 6 Proof | Not started | |

## Out of this plan

- Filling brackets, signing file 00, and choosing governing law.
- Saudi Arabia, card charging, analytics scripts, and a carrier STOP keyword list.
- Applying the migration.
- Rewriting an issued tax document or zeroing a balance inside anonymize.
- Deleting `sys_customers_mst`, or editing it while another Tenant still links it.

## Done when

- Progress Log rows 1 through 6 are filled with evidence.
- `/developer-portal/legal-docs/` can insert an immutable version and cannot edit a published body.
- The public pages render the current locale from the cached read API.
- Sign-up stores one acceptance event or creates no Tenant.
- Intake writes the current consent row without wiping an earlier grant.
- Anonymize strips contact fields, keeps money figures, and refuses the cases in Step 5.

Public launch still waits on the publish gate.
