# Phase 3 — Legal and customer rights — Engineering plan

**Status:** Not started. Reviewed 17 Nov 2026 and rewritten. Legal text is drafted. Engineering has not started.  
**Written:** 17 Nov 2026. **Review:** 17 Nov 2026.  
**Scope:** Roadmap Phase 3 steps 3.2, 3.6, and 3.7. Items B4, N4, and U4.  
**Repos:** `cleanmatex` (migrations, `web-admin`) and `cleanmatexsaas` (`platform-api`, `platform-web`, `marketing-web`).  
**Related:** [ROADMAP.md](ROADMAP.md) Phase 3 · [01 — Business](01_business_and_commercial_blockers.md) B4 · [07 — Notifications](07_notifications.md) N4 · [09 — Customers](09_customers_users_and_identity.md) U4 · [Go / No-Go Register](Phase_0_to_4_Go_No_Go_Register.md) rows 3.1, 3.2, 3.6, 3.7  
**Legal source:** [Lawyer_docs](Lawyer_docs/00_README_en.txt). Each document is an `_en.txt` / `_ar.txt` pair. Engineering does not rewrite that text.

This plan does not authorize applying SQL, filling the legal brackets, or putting the pages on the public internet. The Owner fills file 18, counsel signs file 00, and the Owner applies the migration.

After each step below, update this file's **Progress Log** before the next step starts. A step is not done without that row.

## Review — gaps closed in this revision

| Gap in the previous plan | What this revision requires |
|---|---|
| HQ sidebar written to `sys_components_cd` | HQ navigation is `hq_navigation_cd`, plus the sidebar fallback, breadcrumbs, and `layout.json`. `sys_components_cd` is the Tenant app only. |
| `anon` may SELECT the document tables | Phase 0 is closing direct `anon` access to `sys_*`. Public pages call a read API. The API uses the service role. |
| Publish check still talks about a copied file | The body lives in `sys_cmx_terms_docs_dtl`. Publish is refused while `[` or `]` remains in the body. |
| Checkbox, intake notice, and counter notice have versions but no document row | Those strings are documents too, so the accepted version can be loaded later. |
| A new order resets every box to off | An existing customer loads the latest consent. A save appends a row only when a choice or the notice version changed. |
| Customer marketing opt-in written as if it were `org_ntf_user_prefs_dtl` | Walk-in customers are not auth users. Consent is stored on the customer. Any send to that customer reads it. Staff campaign prefs stay separate. |
| Anonymize could edit a shared person or an issued invoice | This Tenant's customer row only. A linked global person is unlinked here and not edited. Issued invoice snapshots are not rewritten. |
| Re-accept is a banner only | The server refuses a new order until the current pack is accepted. |
| No progress row after a step | Each step ends by updating the Progress Log. |

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
4. Sign-up stores acceptance in the same transaction as the Tenant. If that insert fails, the Tenant is not created.
5. Creating an order on the server checks that the Tenant has accepted the current pack. A hidden client check is not enough.
6. Every `org_*` read and write filters `tenant_org_id` in that statement.
7. Anonymize changes one Tenant's customer. It does not change another Tenant, a shared person, a money total, or an issued tax document.
8. `anon` and `authenticated` cannot insert or update the document tables.

## Publish gate

Building may proceed while brackets remain in `Lawyer_docs`. A version with a bracket cannot be set current, and the public routes stay unpublished until:

1. File 18 in both languages has the same real facts, including the Supabase region.
2. Counsel has signed `Lawyer_docs/00_README_en.txt`.
3. The Owner has adopted the N4 rule, the U4 rule, and the liability cap.
4. The seeded rows are current and both locales return from the read API.

## Version codes

From `Lawyer_docs/18_SUBPROCESSORS_AND_VERSIONS_en.txt`. Do not invent codes.

| `doc_code` | Version | Source |
|---|---|---|
| `TOS` | `tos-2026-11-17` | `02_TERMS_OF_SERVICE_en.txt`, `_ar.txt` |
| `PRIVACY` | `privacy-2026-11-17` | `04_PRIVACY_POLICY_en.txt`, `_ar.txt` |
| `DPA` | `dpa-2026-11-17` | `06_DATA_PROCESSING_AGREEMENT_en.txt`, `_ar.txt` |
| `DPP` | `dpp-2026-11-17` | `08_DATA_PROCESSING_PAGE_en.txt`, `_ar.txt` |
| `COOKIE` | `cookie-2026-11-17` | `10_COOKIE_NOTICE_en.txt`, `_ar.txt` |
| `AUP` | `aup-2026-11-17` | `12_ACCEPTABLE_USE_POLICY_en.txt`, `_ar.txt` |
| `SIGNUP` | `signup-2026-11-17` | file 14, the checkbox label, helper line, and lead-form line |
| `N4_NOTICE` | `n4-notice-2026-11-17` | file 15 section 3, notice and control labels |
| `COUNTER` | `n4-notice-2026-11-17` | file 17 |
| Pack | `legal-pack-2026-11-17` | column on every detail row of this seed |

The anonymize confirm text stays in Tenant i18n, version constant `u4-spec-2026-11-17`, because it is an action dialog. The rule it carries is file 16.

## Step 1 — Database

One new migration in `cleanmatex/supabase/migrations/`. List the folder and take the next number. Do not edit an old migration. Do not apply this one.

**`sys_cmx_terms_docs_mst`** — one row per `doc_code`. Columns: `doc_code` (PK), `name`, `name2`, `current_version_code`, `is_active`, audit columns. No `tenant_org_id`.

**`sys_cmx_terms_docs_dtl`** — one row per `doc_code` + `version_code` + `locale`. Unique on those three. Columns: `body` (TEXT), `body_sha256`, `published_at`, `pack_version`, `is_active`, audit columns. No update of `body` or `body_sha256` after insert. Enforce that in a trigger, not only in the UI.

**`org_legal_accept_dtl`** — append-only. `tenant_org_id`, `user_id`, `acceptance_method`, `pack_version`, one version column and one sha256 column per accepted `doc_code` (TOS, DPA, AUP, PRIVACY, SIGNUP), `accepted_at` from the database clock, `locale`, `checkbox_was_preselected`, `source_ip`, `user_agent`. Index `(tenant_org_id, accepted_at desc)`. Composite FK to the Tenant uses the parent key column order. RLS on. No password. No full body.

**`org_cust_consent_dtl`** — append-only. Fields from file 15 section 5, plus `tenant_org_id` on the row and in every index that leads. Index `(tenant_org_id, customer_id, shown_at desc)`. RLS on.

**`customers:anonymize`** — seed `sys_auth_permissions_cd` in this same migration, with the Arabic name. Grant it only to the roles the Owner names in the migration comment. Mirror the code later in `web-admin/lib/constants/permissions/`.

Grants: `anon` and `authenticated` have no INSERT, UPDATE, or DELETE on the `sys_cmx_terms_docs_*` tables. Public reading goes through the API in Step 2. Comment every new object and add `COMMENT ON`.

Seed the ten `doc_code` values and both locales from `Lawyer_docs` only after the brackets are gone. Until then the migration may create the tables and leave `current_version_code` null. A null current version means the public routes show "not published", not a draft.

**Step 1 close:** write the Progress Log row for Step 1. Do not start Step 2 in the same edit that forgets this row.

## Step 2 — HQ definition screens and API

Route: `/developer-portal/legal-docs/`. Page file: `platform-web/app/(dashboard)/developer-portal/legal-docs/page.tsx`. The `(dashboard)` layout already supplies the shell. This page does not wrap another shell.

Screens, in `platform-web/src/features/developer-portal/`:

- List: document code, English name, Arabic name, current version, missing-locale warning.
- Version screen: both locales side by side, hash, published time. Insert a new version. Set current only when both locales pass the bracket check and the hash matches the body.
- Preview uses the locale direction: `ltr` for English, `rtl` for Arabic.

API on `platform-api`, module shape of `developer-portal`, under `/api/hq/v1/legal-docs`:

- `GET` list and `GET` one document with its versions. HQ session required.
- `POST` a version. Reject a body containing `[` or `]`. Compute `body_sha256` on the server.
- `POST` set current. Reject when either locale is missing.
- No `PATCH` of `body`.

Navigation, all of these together:

- `hq_navigation_cd` seed in the same migration family (`nav_code` under `dp_developer_portal`, path `/developer-portal/legal-docs`, EN and AR labels, `nav_level = 2`)
- `FALLBACK_SECTIONS` in `platform-web/src/ui/navigation/cmx-sidebar.tsx`
- Breadcrumb key in `cmx-auto-breadcrumbs.tsx`
- Hub card in `developer-portal-hub-screen.tsx`
- Keys in `platform-web/messages/en/layout.json` and `messages/ar/layout.json`

Do not insert a Tenant-app row in `sys_components_cd` for this screen.

Cache the public read separately from this admin API. Admin writes invalidate that cache key.

**Step 2 close:** update the Progress Log before Step 3.

## Step 3 — Public pages, sign-up, and re-accept (B4)

**Read API.** `GET /api/hq/v1/legal-docs/public/:docCode?locale=en|ar` returns the current body, version, and hash. No session. Cache for a short TTL and vary on `docCode` and `locale`. 404 when that locale is not current. The response is the legal text only.

**Marketing site.** Locale routes for the six public documents. Footer links in `marketing-web/src/components/layout/site-footer.tsx`. The page fetches the read API. Early-access and contact forms use the `SIGNUP` lead line and store `privacy` version, hash, and time on the lead row. That store does not create a Tenant.

**Tenant app.** The same six routes are public, so sign-up can open them before an account exists. Signed-in footer links to the same routes. Fetch through the server, not with a browser key that queries `sys_*` directly.

**Sign-up.** `web-admin/app/register/tenant/page.tsx`. One checkbox, unchecked on load. The label and helper come from `SIGNUP` for the screen locale. Submit stays disabled until it is checked. `POST /api/v1/tenants/register` writes `org_legal_accept_dtl` in the same transaction, after the Tenant and the user exist, and rolls back if the current versions cannot be read or the row cannot be inserted. `checkbox_was_preselected` is stored as false.

**Re-accept.** When `current_version_code` for TOS, DPA, or AUP is newer than the Tenant's latest acceptance, the next admin session sees an unchecked box. The order-create API returns a conflict until a new acceptance row exists. Reading existing orders stays allowed.

Cookie page states that non-essential analytics are off. Do not load an analytics script.

**Step 3 close:** update the Progress Log before Step 4.

## Step 4 — Order intake (N4)

Screen: `web-admin/app/dashboard/orders/new/page.tsx` and the customer block on that flow. Also the customer profile, for a later change.

Load `N4_NOTICE` and `COUNTER` for the screen locale. Show the counter notice on the block.

- New customer: every box starts unticked.
- Existing customer: show the latest `org_cust_consent_dtl` row. Do not display a granted choice as off.
- No mobile: hide WhatsApp and SMS, store `NOT_APPLICABLE`, do not send.
- No email: hide email, store `NOT_APPLICABLE`, do not send.
- Channel off for the Tenant: hide that marketing box.

On save, update `preferences.notifications` and append one history row only if a value changed or `notice_version` changed. Map exactly as file 15:

| Choice | Stored result | Basis |
|---|---|---|
| WhatsApp service on | `preferences.notifications.whatsapp = true` | `CONSENT` |
| WhatsApp service off | `false` | `CONSENT` |
| SMS refusal off, number present | SMS not `false` | `CONTRACT` |
| SMS refusal on | `preferences.notifications.sms = false` | `CONTRACT` |
| Email, same pattern | `preferences.notifications.email` | `CONTRACT` |
| Marketing on | customer marketing consent true for that channel | `CONSENT` |
| Marketing off | `DENIED` | `CONSENT` |

Keep the current gates in `whatsapp-customer-eligibility.ts` and `customer-dispatch-consent.ts`. A customer marketing send reads the latest customer consent, not `org_ntf_user_prefs_dtl`. Staff campaign prefs stay on that user table. A missing customer preference is not marketing consent.

Withdrawal from the profile appends a row. The next dispatch reads the latest row.

**Step 4 close:** update the Progress Log before Step 5.

## Step 5 — Anonymize (U4)

Before writing the action, inventory the print path. Record in the Progress Log whether issued invoices store a buyer-name snapshot or read the live customer name. If they read the live name, the action writes the snapshot first, then replaces the live name. It does not regenerate the issued document.

Screen: `web-admin/app/dashboard/customers/[id]/page.tsx`.

Permission `customers:anonymize` on the page, the export route, and the anonymize route. One constant. Access contract actions for export and anonymize. API: permission check, CSRF, tenant predicate, rate limit on anonymize.

1. **Export** returns only this `tenant_org_id`: identity, addresses, communication choices, consent history, order totals, payments, invoices. No password, card, or session token. No other Tenant.
2. **Anonymize** uses the confirm text for `u4-spec-2026-11-17`. Second confirm required. The dialog states that orders, payments, and issued tax documents stay.

Refuse with no write when the row is the default guest, a B2B company, any order is not terminal, a wallet, advance, loyalty value, or receivable is not zero, or a draft tax document still points at this customer. The action does not zero a balance.

One transaction:

- Clear the contact fields in file 16 sections 5 to 7, including order `customer_mobile_number`, `customer_email`, and contact keys inside `customer_details`.
- Set `name` and `display_name` to `Anonymized customer` and `name2` to `عميل مجهّل`. `is_anonymized = true`.
- If a global person link exists, unlink it on this Tenant's row only. Do not update the shared person.
- Append consent method `ANONYMIZE` and turn future sends off.
- Do not change money columns, invoice numbers, tax snapshots, or a stored PDF or XML.
- Audit row: user, reason code, request reference, time. No old name, phone, or email.
- Second call returns success and writes nothing.

**Step 5 close:** update the Progress Log before Step 6.

## Step 6 — Contracts, language, performance, and proof

- Tenant access contracts for the register acceptance write and the customer export and anonymize actions. `npm run check:ui-access-contract` for those routes. No new Tenant sidebar entry.
- i18n chrome in both apps and both languages. Legal bodies stay in the document table. Run `npm run check:i18n` where message files change.
- Cmx components, `cmxMessage`, visible labels, keyboard access, and RTL on the Arabic preview and the intake block.
- Public read is cached. Anonymize is one transaction, not a per-table round trip from the browser. Consent append is one insert.
- Tests: sign-up with the box off creates no Tenant; sign-up with the box on stores versions and hashes; re-accept blocks a new order until stored; existing consent is not cleared by a later order; WhatsApp left off does not send; marketing off does not send; anonymize cases in file 16 section 11; a second Tenant is unchanged; a body update is rejected; set-current fails with one locale; public GET does not return a draft.
- `npm run build` in `web-admin`, `platform-web`, `platform-api`, and `marketing-web` for the apps this step touched.

**Step 6 close:** update the Progress Log, then the register rows 3.2, 3.6, and 3.7 only with the evidence above.

## Progress Log

| Step | Status | Evidence |
|---|---|---|
| Review 17 Nov 2026 | Done | This revision. Gaps in the table above are now steps. |
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
- Rewriting an issued tax document.
- Zeroing a wallet or a receivable inside anonymize.
- Editing `sys_person` data shared with another Tenant.

## Done when

- Progress Log rows 1 through 6 are filled with evidence.
- `/developer-portal/legal-docs/` can insert an immutable version and cannot edit a published body.
- The public pages render the current locale from the read API.
- Sign-up stores one acceptance row or creates no Tenant.
- Intake writes consent without wiping an earlier grant.
- Anonymize strips contact fields, keeps money figures, and refuses the cases in Step 5.

Public launch still waits on the publish gate.
