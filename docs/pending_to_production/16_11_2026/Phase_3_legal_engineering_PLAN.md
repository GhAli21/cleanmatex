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
| Published text | `sys_cmx_terms_docs_mst` plus immutable `sys_cmx_terms_docs_dtl`. Each catalog row carries `mandatory_level` and the handling columns below. Screens obey those columns. A version is current only when both locales exist and neither body contains `[` or `]`. A trigger rejects updates of `body` and `body_sha256`. |
| Public read | Two HQ routes, no session, service-role read. `GET .../public/{docCode}/{locale}` is the current pointer: `Cache-Control: public, max-age=60, stale-while-revalidate=300`, `ETag` = `body_sha256`. `GET .../public/{docCode}/{versionCode}/{locale}` is immutable: `max-age=31536000, immutable`. 404 when that locale is not published. No `anon` SELECT. Marketing and the Tenant app fetch on the server and keep no second copy of the body. |
| Acceptance | One event in `org_legal_accept_mst`, one line per document whose row has `record_version = true`. One current pointer `org_legal_accept_cur`, primary key `tenant_org_id`, with `accepted_versions` (jsonb, `doc_code` to `version_code`). Adding a document later adds a catalog row and a line. It does not add a column. |
| Re-accept | When at least one `blocks_new_orders` document has a current version, order create reads `org_legal_accept_cur` by primary key and compares it with those current codes, read from the catalog, not from the public page cache. A missing or older code returns 409. While no blocking document is current, existing Tenants keep creating orders. Reads of old orders stay open. The banner uses the same read. |
| Consent | `org_cust_consent_cur` is the hot row: unique `(tenant_org_id, customer_id, channel_code, purpose_code)`. `org_cust_consent_dtl` is append-only proof. Dispatch and the intake screen read the current row only. A save updates the current row and inserts history only when a value or `notice_version` changed. |
| Marketing vs staff | Walk-in consent never writes `org_ntf_user_prefs_dtl`. Every send to a customer calls one gate: `assertCustomerMayReceive(tenant, customer, channel, purpose)`. Missing marketing consent is deny. WhatsApp service sends only when the current value is granted. SMS and email service send unless the current value is exactly refused. Staff campaigns keep the user-prefs table. |
| Anonymize | One database function, one transaction, this `tenant_org_id` only. `org_customers_mst.customer_id` points at global `sys_customers_mst`. If any other Tenant row still points at that global id, set this row's `customer_id` to null and do not touch the global row. If no other row points at it, clear the global contact fields in the same transaction. Never `DELETE` the global row: the FK is `ON DELETE CASCADE` into Tenant customers. |
| Issued invoices | `org_invoice_mst` stores `customer_id` and has no buyer-name column, so print follows the live customer. Before the live name is replaced, copy the current name into new snapshot columns on invoices already issued for this customer. Print prefers the snapshot when it is set. Do not change totals, numbers, or `handed_to_*`. |

## Objective

| Item | Result |
|---|---|
| B4 | Terms, Privacy, and the data-processing page on the marketing site and in the Tenant app, English and Arabic. The Create tenant button is the acceptance. The server stores every blocking document's version, hash, and the UTC time. |
| N4 | Order intake records WhatsApp opt-in, SMS and email refusal, and a separate marketing opt-in, without wiping a choice already stored. |
| U4 | An authorized user can export a customer, then anonymize that person in one transaction. Orders, amounts, payments, and issued tax documents stay. |

Cookie notice, acceptable use, the sign-up sentence, the intake notice, and the counter notice ship in the same document register.

## Invariants

1. `Lawyer_docs` is the draft. `sys_cmx_terms_docs_dtl` is the published snapshot. A published `body` is never updated.
2. A version becomes current only when both `en` and `ar` rows exist and neither body contains `[` or `]`.
3. The marketing site and the Tenant app render the current row for the requested locale. They do not fall back to the other language. They do not keep a second copy of the legal body.
4. Sign-up stores the acceptance event, its lines, and the current pointer in the same transaction as the Tenant. If any insert fails, the Tenant is not created.
5. Creating an order on the server checks `org_legal_accept_cur` once a blocking document is current. A hidden client check is not enough. The check lives in the shared order-create service, so every entry point uses it.
6. Every `org_*` read and write filters `tenant_org_id` in that statement.
7. Anonymize changes one Tenant's customer. It does not change another Tenant, a shared global person, a money total, or an issued tax document.
8. `anon` and `authenticated` cannot insert, update, or select the document tables. Public reading is the API in the chosen design.

## Publish gate

Building may proceed while brackets remain in `Lawyer_docs`. A version with a bracket cannot be set current, and the public routes stay unpublished until:

1. File 18 in both languages has the same real facts, including the Supabase region.
2. Counsel has signed `Lawyer_docs/00_README_en.txt`.
3. The Owner has adopted the N4 rule, the U4 rule, and the liability cap.
4. The seeded rows are current and both locales return from the read API.

## Version codes and handling

From `Lawyer_docs/18_SUBPROCESSORS_AND_VERSIONS_en.txt`. Do not invent codes. Behavior comes from the columns, not from the document code.

`mandatory_level`: `BLOCKING`, `ACKNOWLEDGED`, `PUBLIC`, `IN_FLOW`, `CONDITIONAL`, `INTERNAL`.

Handling columns on `sys_cmx_terms_docs_mst`:

| Column | Values | What it does |
|---|---|---|
| `is_public` | boolean | Public read API, marketing route, and Tenant-app route |
| `acceptance_mode` | `ACCEPT`, `ACKNOWLEDGE`, or null | `ACCEPT` is the contract. `ACKNOWLEDGE` is stored and is not the contract |
| `blocks_signup` | boolean | Sign-up stays closed until this current version is stored |
| `blocks_new_orders` | boolean | A newer current version returns 409 on order create |
| `present_in` | `SIGNUP`, `ORDER_INTAKE`, `COUNTER`, `INVOICE`, or null | The screen that loads this body |
| `record_version` | boolean | Write a line with `version_code` and `body_sha256` when the flow saves |
| `audience` | `TENANT` or `END_CUSTOMER` | Who the text is written for |
| `subject_party` | `TENANT`, `TENANT_USER`, `END_CUSTOMER`, or null | Who the acceptance binds. Null means nobody accepts it |

A check constraint keeps the level and the flags aligned. `BLOCKING` requires `acceptance_mode = ACCEPT` and at least one block flag. `ACKNOWLEDGED` requires `ACKNOWLEDGE`, `is_public`, and `record_version`. `PUBLIC` is public and has no acceptance and no block. `IN_FLOW` and `CONDITIONAL` are not public, have `present_in`, and do not block. `INTERNAL` is none of those and is not seeded from the lawyer drafts.

| `doc_code` | Level | Public | Mode | Blocks sign-up | Blocks orders | Shown in | Record | Audience | Version |
|---|---|---|---|---|---|---|---|---|---|
| `TOS` | `BLOCKING` | yes | `ACCEPT` | yes | yes | — | yes | `TENANT` | `tos-2026-11-17` |
| `DPA` | `BLOCKING` | yes | `ACCEPT` | yes | yes | — | yes | `TENANT` | `dpa-2026-11-17` |
| `AUP` | `BLOCKING` | yes | `ACCEPT` | yes | yes | — | yes | `TENANT` | `aup-2026-11-17` |
| `PRIVACY` | `ACKNOWLEDGED` | yes | `ACKNOWLEDGE` | yes | no | — | yes | `TENANT` | `privacy-2026-11-17` |
| `DPP` | `PUBLIC` | yes | — | no | no | — | no | `TENANT` | `dpp-2026-11-17` |
| `COOKIE` | `PUBLIC` | yes | — | no | no | — | no | `TENANT` | `cookie-2026-11-17` |
| `SIGNUP` | `IN_FLOW` | no | — | no | no | `SIGNUP` | yes | `TENANT` | `signup-2026-11-17` |
| `N4_NOTICE` | `IN_FLOW` | no | — | no | no | `ORDER_INTAKE` | yes | `END_CUSTOMER` | `n4-notice-2026-11-17` |
| `COUNTER` | `IN_FLOW` | no | — | no | no | `COUNTER` | yes | `END_CUSTOMER` | `n4-notice-2026-11-17` |
| Pack | — | — | — | — | — | — | — | — | `legal-pack-2026-11-17` |

`subject_party` on the seed: Terms, DPA, Acceptable Use, Privacy, and the sign-up sentence bind the `TENANT`. The intake notice and the counter notice bind the `END_CUSTOMER`. The data-processing page and the cookie notice bind nobody.

## World-class pattern

This is the shape used by Stripe, Atlassian, Slack, and Twilio. One signup act by a person allowed to bind the business. Public notices stay public. End-customer consent is the customer's own act.

| What they do | Where it shows | How this plan does it |
|---|---|---|
| Shopify is stricter and closer to this product: before signup the merchant must accept the Terms, and those Terms incorporate the Acceptable Use Policy, the Privacy Policy, and the Data Processing Addendum. Only the Store Owner is the contracting party. | The Create tenant button, pressed by the Store Owner | Pressing Create tenant accepts every current document with `blocks_signup = true`: Terms, the DPA, and Acceptable Use, and it acknowledges Privacy. The sentence beside the button is the `SIGNUP` text. The first user is `tenant_admin`. Only that role may accept or re-accept. The mid-level `admin` role cannot bind the organization. |
| Stripe incorporates the DPA into the services agreement. Atlassian incorporates the privacy policy and the acceptable use policy. | The same Create tenant press, one line per document | `blocks_signup` documents are recorded together. Each still gets its own version and hash. |
| Slack splits Customer Terms from User Terms. The Primary Owner represents the customer. A member does not sign the customer contract, and an admin does not sign it instead of a member. Twilio makes the customer responsible for its users' compliance. | No per-user signature on the organization contract | Staff are bound because the Tenant accepted. This pack has no `FOR_USER` act. A later staff notice, if added, is `SELF` only. |
| Slack and Twilio publish a privacy notice and a DPA page. The DPA is also the processor contract. A cookie notice is a disclosure. | Public legal pages, no second signature | `is_public` rows. Privacy is acknowledged once at signup. The data-processing page and the cookie notice have no acceptor. |
| Twilio Messaging Policy: consent is freely given by the recipient for that sender and that subject. Consent on behalf of a third party is not valid. The customer must keep proof of who consented, when, and by which method. Staff may record a choice the customer made at the counter. | Order intake | The end customer is `SELF`. Staff store `RECORDED`, plus the staff user id and the method (`COUNTER_TABLET` or `VERBAL_RECORDED_BY_STAFF`). `RECORDED` is evidence of the customer's act. It is not the Tenant consenting in the customer's place. |

## Who may accept

`sys_cmx_doc_acpt_rule` is the allow-list, one row per allowed act. Unique on `(doc_code, acceptor_scope, representation)`.

| Column | Values |
|---|---|
| `acceptor_scope` | `TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_USER`, `END_CUSTOMER` |
| `representation` | `FOR_TENANT`, `SELF`, `RECORDED` |

The check constraint pairs them with `subject_party`:

| Bound party | Allowed act |
|---|---|
| `TENANT` | Store Owner only, `FOR_TENANT`. The `admin` role, a cashier, a customer, and a recording of someone else's choice cannot bind the organization. |
| `TENANT_USER` | That user, `SELF` only. Not seeded in this pack. |
| `END_CUSTOMER` | That customer, `SELF`. Owner, admin, or staff, `RECORDED`, and only for the notice the customer was shown. |
| null | No rule rows. |

Scope resolves to existing role codes in one service, not in the legal text:

| Scope | Roles that satisfy it |
|---|---|
| `TENANT_OWNER` | `tenant_admin`. Migration `0035` describes this role as the Tenant owner. |
| `TENANT_ADMIN` | `tenant_admin` and `admin`. |
| `TENANT_USER` | Any active staff role of this Tenant. `b2b_customer` is a customer portal role and does not qualify. |
| `END_CUSTOMER` | The customer record. It is not a staff role. |

`super_admin` is the platform-wide role from `0035`. It does not satisfy `TENANT_OWNER`.

Seed rules:

| Documents | Subject | Who may act |
|---|---|---|
| Terms, DPA, Acceptable Use, Privacy | `TENANT` | `TENANT_OWNER` only, `FOR_TENANT` |
| Intake notice, counter notice | `END_CUSTOMER` | `END_CUSTOMER` as `SELF`; `TENANT_OWNER`, `TENANT_ADMIN`, and `TENANT_USER` as `RECORDED` |

No current document binds a staff user personally. The sign-up sentence is the text beside the Create tenant button. Pressing that button must pass the rules of every `blocks_signup` document. The data-processing page and the cookie notice have no rules.

Every stored act writes `subject_party`, `acceptor_scope`, and `representation`. The server rejects the write when no active rule matches. A hidden button is not the control. The client never supplies `accepted_versions`. The server copies that object from the lines it just inserted.

## Release rules

These rules stop the build from shipping a legal gate that breaks signup, a cache that delays a block, or a column the database does not have.

1. **Before the pack is current, nothing new is required.** If every `blocks_signup` and `blocks_new_orders` row has a null `current_version_code`, signup stays as it is today and order create does not return 409. Once those rows are current, the Create tenant button records them.
2. **Fail closed once publishing starts.** If any `blocks_signup` document is current, every `blocks_signup` document must be current in both locales. Signup stores all of them or creates no Tenant. The same rule applies to `blocks_new_orders` on the order path.
3. **The order gate does not use the public HTTP cache.** It reads the current codes from `sys_cmx_terms_docs_mst` through the catalog reader, plus one primary-key read of `org_legal_accept_cur`. The 60-second cache is only for public pages. Setting a version current is visible to the next order create.
4. **A new blocking document blocks old Tenants.** A current code that is absent from `accepted_versions` is not accepted. The Store Owner confirms with a later button. Existing orders stay readable.
5. **One screen, one body.** A partial unique index allows only one active row for each non-null `present_in`.
6. **`NOT_APPLICABLE` never sends.** The send gate treats it as do-not-send. It must not fall through the SMS and email rule that allows a send when the value is merely not `false`.
7. **Anonymize locks the customer row** with `FOR UPDATE` inside the one function. A second concurrent call waits, then returns the idempotent success.
8. **`is_anonymized` does not exist yet.** The migration adds `is_anonymized boolean not null default false` on `org_customers_mst`. The invoice snapshot columns ship in the same release as the print change. A reprint after anonymize uses the snapshot.
9. **Catalog tables stay closed.** `anon` and `authenticated` have no privileges on `sys_cmx_terms_docs_mst`, `sys_cmx_terms_docs_dtl`, or `sys_cmx_doc_acpt_rule`. Application reads of those tables use the catalog reader. Every new `org_*` table has RLS, and every statement still filters `tenant_org_id`.
10. **Placeholder check.** Publish rejects an unfilled token shaped like `[LEGAL_ENTITY_NAME]`. A bracket that is not that kind of token does not block a finished sentence.
11. **Early-access leads.** The existing lead submission stores the privacy version, the hash, and the time on that same record. It does not create a Tenant and it does not write `org_legal_accept_mst`.

The counsel memo, the README, the subprocessors register, and the anonymize spec are not catalog rows. A later pilot order form would be one `CONDITIONAL` row with `present_in = INVOICE`. The anonymize confirm text stays in Tenant i18n, version constant `u4-spec-2026-11-17`.

## Step 1 — Database

One new migration in `cleanmatex/supabase/migrations/`. List the folder and take the next number. Do not edit an old migration. Do not apply this one.

**`sys_cmx_terms_docs_mst`** — one row per `doc_code`. Columns: `doc_code` (PK), `name`, `name2`, `current_version_code`, `mandatory_level`, `is_public`, `acceptance_mode`, `blocks_signup`, `blocks_new_orders`, `present_in`, `record_version`, `audience`, `subject_party`, `is_active`, audit columns. No `tenant_org_id`. Check constraint as in the handling section. All codes are TEXT and match the constants exactly.

**`sys_cmx_doc_acpt_rule`** — allow-list. Columns: `doc_code`, `acceptor_scope`, `representation`, `is_active`, audit columns. Unique on the three business columns. Check constraint as in "Who may accept". A `BLOCKING` or `ACKNOWLEDGED` document has at least one active rule. A public page with a null subject has none.

**`sys_cmx_terms_docs_dtl`** — one row per `doc_code` + `version_code` + `locale`. Unique on those three. Columns: `body` (TEXT), `body_sha256`, `published_at`, `pack_version`, `is_active`, audit columns. Trigger rejects an update of `body` or `body_sha256`.

**`org_legal_accept_mst`** — one acceptance event. `tenant_org_id`, `user_id`, `subject_party`, `acceptor_scope`, `representation`, `acceptance_method`, `pack_version`, `accepted_at` from the database clock, `locale`, `checkbox_was_preselected`, `source_ip`, `user_agent`. Index `(tenant_org_id, accepted_at desc)`. For this pack the subject is `TENANT` and the representation is `FOR_TENANT`.

**`org_legal_accept_dtl`** — lines of that event. `doc_code`, `version_code`, `body_sha256`. Composite FK to the event uses the parent key column order. RLS on. No password. No full body.

**`org_legal_accept_cur`** — one row per Tenant, primary key `tenant_org_id`. Holds `pack_version` and `accepted_versions` jsonb (`doc_code` to `version_code`) for every line of the latest event. Written in the same transaction as the event. No per-document columns.

**`org_cust_consent_cur`** — unique `(tenant_org_id, customer_id, channel_code, purpose_code)`. Holds the current value, basis, notice version, `acceptor_scope`, `representation`, and time. `SELF` means the customer acted. `RECORDED` means staff stored the customer's own choice, and the staff user id is stored with the method.

**`org_cust_consent_dtl`** — append-only proof. Fields from file 15 section 5, plus `tenant_org_id` on the row and in every index that leads. Index `(tenant_org_id, customer_id, shown_at desc)`. RLS on.

**`customers:anonymize`** — seed `sys_auth_permissions_cd` in this same migration, with the Arabic name. Grant it only to the roles the Owner names in the migration comment. Mirror the code later in `web-admin/lib/constants/permissions/`.

**Invoice snapshot** — add `buyer_name` and `buyer_name2` (TEXT, nullable) on `org_invoice_mst`. Print reads the snapshot when it is set, otherwise the live customer. New issues write the snapshot at issue time.

Grants: `anon` and `authenticated` have no privileges on `sys_cmx_terms_docs_mst`, `sys_cmx_terms_docs_dtl`, or `sys_cmx_doc_acpt_rule`. Comment every new object and add `COMMENT ON`. RLS is on for `org_legal_accept_mst`, `org_legal_accept_dtl`, `org_legal_accept_cur`, `org_cust_consent_cur`, and `org_cust_consent_dtl`.

**Customer flag** — add `is_anonymized boolean not null default false` on `org_customers_mst`.

Seed the nine `doc_code` values and both locales from `Lawyer_docs` only after the brackets are gone. Until then the migration creates the tables, the allow-list, and the handling flags, and leaves `current_version_code` null. A null current version means the public routes show "not published", signup is unchanged, and order create is unchanged.

**Step 1 close:** write the Progress Log row for Step 1. Do not start Step 2 in the same edit that forgets this row.

## Step 2 — HQ definition screens and API

Route: `/developer-portal/legal-docs/`. Page file: `platform-web/app/(dashboard)/developer-portal/legal-docs/page.tsx`. The `(dashboard)` layout already supplies the shell. This page does not wrap another shell.

Screens, in `platform-web/src/features/developer-portal/`:

- List: document code, mandatory level, who it binds, who may accept, public flag, block flags, where it is shown, English name, Arabic name, current version, missing-locale warning. Handling columns and allow-list rows may be updated. A published body stays immutable.
- Version screen: both locales side by side, hash, published time. Insert a new version. Set current only when both locales pass the bracket check and the hash matches the body.
- Preview uses the locale direction: `ltr` for English, `rtl` for Arabic.

API on `platform-api`, module shape of `developer-portal`, under `/api/hq/v1/legal-docs`:

- `GET` list and `GET` one document with its versions. HQ session required.
- `POST` a version. Reject a body containing `[` or `]`. Compute `body_sha256` on the server.
- `POST` set current. Reject when either locale is missing.
- No `PATCH` of `body`.
- Public current and public immutable routes as in the chosen design. They return a row only when `is_public` is true. Rate-limit the public routes. Return the legal text only.

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

**Marketing site.** One locale route per catalog row with `is_public = true`. Footer links in `marketing-web/src/components/layout/site-footer.tsx` are built from that list. The page fetches the current public route on the server. Early-access and contact forms use the row with `present_in = SIGNUP` for the lead line, and store the privacy version, hash, and time on the lead row. That store does not create a Tenant.

**Tenant app.** The same public rows are available before an account exists. Signed-in footer links come from the same list. Fetch on the server.

**Sign-up.** `web-admin/app/register/tenant/page.tsx`. The Create tenant button is the acceptance. The sentence beside it comes from the current `SIGNUP` row for the screen locale, with links to each `blocks_signup` document. There is no second checkbox. `POST /api/v1/tenants/register` creates the Tenant and the first user as `tenant_admin` in the same transaction. `acceptance_method` is `CREATE_TENANT`. The server checks that this user matches `TENANT_OWNER` + `FOR_TENANT`, then writes one line for every current `blocks_signup` document and one line for the `SIGNUP` sentence, then writes `org_legal_accept_cur`. Terms, the DPA, and Acceptable Use are stored as `ACCEPT`. Privacy is stored as `ACKNOWLEDGE`. It rolls back if a required current version cannot be read, the allow-list does not match, or a row cannot be inserted. `checkbox_was_preselected` is stored as false. A later re-accept uses the same allow-list, so only `tenant_admin` can clear the block.

**Re-accept.** When any `blocks_new_orders` document is current, the shared order-create service reads those current codes from the catalog and compares them with `org_legal_accept_cur.accepted_versions`. Any miss asks the `tenant_admin` to confirm with a button. That press records the new versions. The order-create service returns 409 until the pointer is updated. Reading existing orders stays allowed. The Tenant lookup is the primary key. There is no history scan and no use of the public page cache. While no blocking document is current, order create is unchanged.

Cookie page states that non-essential analytics are off. Do not load an analytics script.

**Step 3 close:** update the Progress Log before Step 4.

## Step 4 — Order intake (N4)

Screen: `web-admin/app/dashboard/orders/new/page.tsx` and the customer block on that flow. Also the customer profile, for a later change.

Load the current row with `present_in = ORDER_INTAKE` and the current row with `present_in = COUNTER` for the screen locale. Show the counter notice on the block. Store `notice_version` from the intake row because `record_version` is true.

- New customer: every box starts unticked. No current row exists.
- Existing customer: load `org_cust_consent_cur` for this Tenant and customer. Do not display a granted choice as off.
- No mobile: hide WhatsApp and SMS, store `NOT_APPLICABLE`, do not send.
- No email: hide email, store `NOT_APPLICABLE`, do not send.
- Channel off for the Tenant: hide that marketing box.
- `NOT_APPLICABLE` is do-not-send. It is not a grant and it is not the SMS or email "not refused" state.

On save, the server checks `sys_cmx_doc_acpt_rule` for the intake document. Customer self is `END_CUSTOMER` + `SELF`. Staff recording a choice the customer made is `RECORDED` and requires `TENANT_OWNER`, `TENANT_ADMIN`, or `TENANT_USER`. `b2b_customer` cannot record it. Upsert the current rows that changed and append one history row for each change, including a notice-version change. One transaction. Store the scope and the representation on the current row and the history row. Map exactly as file 15:

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

Permission `customers:anonymize` on the page, the export route, and the anonymize route. One constant. Access contract actions for export and anonymize. API: permission check, CSRF, tenant predicate, rate limit on anonymize. The write is one SQL function. It locks the customer row `FOR UPDATE`. The browser does not walk tables. The print path that prefers `buyer_name` ships in the same release.

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
- Tests: a register request after the pack is current that is not the Create tenant action creates no Tenant; sign-up before any current version still creates a Tenant and writes no acceptance; pressing Create tenant after the pack is current stores one line per `blocks_signup` document, the `SIGNUP` line, the pointer, and `CREATE_TENANT`; the `admin` role cannot clear a re-accept block; `b2b_customer` cannot record end-customer consent; an existing current consent row is not cleared by a later order; `NOT_APPLICABLE` does not send; WhatsApp left off does not send; marketing off does not send; anonymize cases in file 16 section 11; a second concurrent anonymize returns success without a second write; a second Tenant is unchanged; a shared `sys_customers_mst` row is not edited; an unshared global row is cleared and not deleted; an issued invoice keeps its snapshot and its totals; a body update is rejected; set-current fails with one locale; public GET does not return a draft; order create does not read the public page cache.
- `npm run build` in `web-admin`, `platform-web`, `platform-api`, and `marketing-web` for the apps this step touched.

**Step 6 close:** update the Progress Log, then the register rows 3.2, 3.6, and 3.7 only with the evidence above.

## Progress Log

| Step | Status | Evidence |
|---|---|---|
| Review 19 Nov 2026 | Done | Release rules added. Unpublished pack does not block. Order gate bypasses the public cache. `is_anonymized` is a new column. |
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
- Sign-up stores one acceptance event for every blocking document, or creates no Tenant.
- Intake writes the current consent row without wiping an earlier grant.
- Anonymize strips contact fields, keeps money figures, and refuses the cases in Step 5.

Public launch still waits on the publish gate.
