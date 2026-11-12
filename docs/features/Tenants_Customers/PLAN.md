# Tenant Customers — One Person, Many Laundries

**Status:** Discussion draft. Nothing in this document is approved for implementation until you say so.
**Repos:** `cleanmatex` owns the schema, the tenant app, and the `hq_navigation_cd` seed. `cleanmatexsaas` owns the HQ workspace screens and the HQ-only APIs. Tenant commercial edits stay in the tenant app.
**Companion:** staff identity is a different principal. See `docs/features/Tenants_Users/PLAN.md`. A customer is never an `auth.users` row and never a `sys_users_mst` row.

## Why this exists

A customer registers with one email or one mobile and may use several laundries at the same time. The product must keep one person record and still give each laundry its own commercial account. Today the runtime stores everything on `org_customers_mst` and the global table `sys_customers_mst` is switched off: `shouldUseSysCustomers()` returns false immediately in `web-admin/lib/services/customers.service.ts`. Turning that old path back on would also revive cross-tenant search and profile copy. This plan adds a new narrow person table instead.

## Decisions

1. **One global person, many tenant accounts.** `sys_person_mst` is the person. `org_customers_mst` stays the commercial account at one laundry (orders, prices, wallets, loyalty, AR, consent, addresses).
2. **Link only after the phone or email is verified.** A walk-in or guest with no verified contact stays tenant-local. A matching name is not a link.
3. **Nothing commercial moves across laundries.** The second laundry gets a new `org_customers_mst` row with the same `person_id` and empty balances, orders, consent, and prices.
4. **Same login rule as staff.** When the person has an active account at more than one laundry, the customer app shows a small window of those laundry names and binds that account until logout or session expiry. There is no in-session switch.
5. **Staff search stays inside the current laundry.** Other laundries’ customers, and the fact that this person shops elsewhere, are invisible to staff.
6. **Existing duplicates are not auto-merged.** A report lists shared phones and emails. A link happens after verification, or after an explicit confirmation inside one tenant.
7. **No `person_main_context` column.** The person is the human. “Customer” is the existence of one or more `org_customers_mst` rows, not a type stored on `sys_person_mst`. A single value (today `CUSTOMER`, later staff, supplier, driver) cannot name a person who is a customer at three laundries and staff at one, and “main” has no owner. A future hat is a new relationship row that points at `person_id`. It is not a new enum value on the person.
8. **No person address table and no person contact table in this release.** Many addresses already belong to the laundry account through `org_customer_addresses`. A home or pickup address captured at laundry A is not copied to laundry B. Many reach numbers (a second mobile, a work email, a relative’s phone) also stay on that laundry’s account. The person keeps one verified phone and one verified email, and those two values are the only global identity keys. A second verified phone or email that must also find the same person is a later `sys_person_contact_dtl`, with the same global unique rule on verified values only. Unverified extras never go on the person.

## Model

```mermaid
flowchart TB
  subgraph person [Global person]
    SysPerson["sys_person_mst verified phone and or email"]
  end
  subgraph laundryA [Laundry A]
    AcctA["org_customers_mst account"]
    MoneyA["orders invoices wallets advances loyalty AR consent addresses"]
  end
  subgraph laundryB [Laundry B]
    AcctB["org_customers_mst account"]
    MoneyB["that laundry's own commercial rows"]
  end
  SysPerson --> AcctA
  SysPerson --> AcctB
  AcctA --> MoneyA
  AcctB --> MoneyB
```

| Record | Role |
|---|---|
| `sys_person_mst` | Portable person. Verified phone, verified email, bilingual name, verification timestamps, audit. No tenant id, no address, no balance, no consent, no context or type column. |
| `org_customers_mst` | This laundry’s account. Gains nullable `person_id`. Unique `(tenant_org_id, person_id)` where `person_id` is set. |
| `sys_customers_mst` | Legacy. Left in place. New writes do not use it. This program does not drop it. |
| Money and CRM children | Continue to reference `org_customers_mst.id`: orders, invoices, vouchers, wallets, advances, loyalty accounts, credit notes, AR, gift-card purchaser, B2B contacts and contracts, addresses, service preferences. |

`sys_person_mst` is the customer equivalent of the portability idea behind `sys_users_mst`. It is our id, not a Supabase Auth id. Customer login stays the existing OTP and customer-session mechanism (`app/api/v1/public/customer/*`, `customer-mobile-session.service.ts`). It does not create `auth.users` and does not write `sys_auth_user_sessions_mst`.

Staff and customer principals stay separate even when the mobile matches. Matching phones do not grant web-admin access or customer-app access to the other principal.

Browser roles cannot `SELECT` `sys_person_mst`. A laundry key that could list the table would enumerate people across the platform. Lookup and link run in service-role or security-definer functions that take a verified phone or email and return the person id only.

## Link rules

- Guest, walk-in, and stub rows with no verified phone and no verified email keep `person_id` null. The tenant default guest customer (`TENANT_DEFAULT_GUEST_CUSTOMER_ID`) stays unlinked.
- OTP on the mobile, or a confirmed email, finds or creates `sys_person_mst` and sets `person_id` on **this** laundry’s account.
- If this laundry already has an account for that person, the visit uses that account.
- The first verified visit at another laundry inserts a new `org_customers_mst` row: same `person_id`, new account id, no copied wallet, advance, loyalty account, points, AR, orders, addresses, preferences, or consent.
- Phone uniqueness for the person is a partial unique index on the normalized verified E.164 value. Email uniqueness is the same for a verified email. `org_customers_mst.phone` stays the laundry’s copy of the contact number and is not the global key. The application-level per-tenant phone check remains, and a unique index on `(tenant_org_id, normalized phone)` where phone is present is added so two concurrent creates cannot both succeed. Rows with no phone (true guests) are allowed to repeat.

## Customer app session

1. OTP proves the phone and resolves `sys_person_mst`.
2. Load active accounts for that person: account id, tenant id, laundry display name. No balances in the picker payload.
3. One account: bind `(person_id, tenant_org_id, org_customer_id)`.
4. Several accounts: small dialog, the person chooses, the server checks the account again.
5. The customer session keeps that triple until logout or expiry. Today’s public routes take a client `tenantId` and `resolveCustomerMobileSession` trusts it (`login`, `password`, `auth-options`, `session`, `auth/refresh`, `orders`, `orders/[orderNo]`, `orders/[orderNo]/financial-view`, `booking`, `addresses`). After this release the bound triple wins. A body or query `tenantId` that disagrees with the session is rejected. A branded link may name a tenant only as a hint to skip the picker when the person already has an account there.
6. Changing laundry means logout, then sign-in, then the picker again. Escape cancels sign-in and does not choose the highlighted laundry.
7. Login proof is the person, not the account. OTP stays the proof. Where password login remains, the hash is stored once for the person. `org_customers_mst.password_hash` is not the multi-laundry credential and is not copied to the new account. Existing hashes are not auto-picked when two accounts disagree; those people use OTP until they set one person password.

A branded laundry link that already names the tenant skips the picker when this person has an account there, and still refuses to open a laundry where they have no account.

## Staff CRM

Retail customers (`app/dashboard/customers`) and B2B customers (`app/dashboard/b2b/customers`) list and edit the current tenant only. Every query keeps `tenant_org_id`. The dormant other-tenant branch inside `searchCustomersProgressive` is removed rather than enabled.

The create and upgrade screens search before they save. The cashier types the phone or email the customer gives. Lookup runs when the field is complete, and the screen offers one next step:

- No person yet: continue as a new customer at this laundry. Nothing is linked until the phone or email is verified.
- Already an account at this laundry: offer “Open this customer”. Do not insert another account. Show this laundry’s name, phone, and last visit so the cashier can see it is the right file.
- A person exists, and this laundry has no account yet: show that person’s name only, not other laundries and not their balances. The cashier confirms with the customer (“Is this you?”). Confirm creates this laundry’s new account linked to that person, with empty balances. The cashier can also choose “Not this person”. That choice cannot save the same phone or email onto a second person. The screen then asks for a different number, or saves an unverified guest with no phone and no link.
- Two staff saving the same verified phone at the same moment: the unique index keeps one person and one account at this laundry. The second save opens the account the first save created.

Copy is EN and AR. The screen uses Cmx controls, inline status, and `cmxMessage` when a save is blocked. Search existing translation keys before adding new ones.

B2B stays a tenant account (`type = b2b`) with `org_b2b_contacts_dtl`. A contact may later point at `sys_person_mst`. This release does not split company and person into a new party schema.

## Merge and hygiene — later plan, not this release

Today’s merge moves orders and the `loyalty_points` column, skips wallets, advances, loyalty accounts, AR, addresses, and B2B children, and does not write `org_customer_merge_log` on the org-only path. Person linking must not call that merge.

A follow-up plan, after this identity release is in production, covers:

- In-tenant merge that moves every financial and CRM child, writes `org_customer_merge_log`, and stays inside one `tenant_org_id`.
- Retiring the embedded address columns in favor of `org_customer_addresses`.
- Retiring `org_customers_mst.loyalty_points` in favor of `org_loyalty_accounts_mst`.
- Composite foreign keys `(tenant_org_id, customer_id)` on orders and the other money tables.

Linking a person never rewrites money amounts.

## Areas this release covers

Same production bar as the users plan: explicit `tenant_org_id` on every `org_*` access, fail closed, EN/AR and RTL, Cmx components, `cmxMessage` for operational feedback, access contracts for new or changed dashboard routes and APIs, indexes for the new lookups, and no N+1 account fetch on the picker (one query, picker columns only).

### Database (new migration in `cleanmatex`, not applied by the agent)

- Create `sys_person_mst` (name within the 30-character limit) with comments and grants that block browser roles. Indexes, and no others:
  - Primary key on `id`.
  - `uq_sys_person_phone`: unique on `phone_e164` where `phone_e164` is not null. The stored value is E.164. Many rows may have a null phone.
  - `uq_sys_person_email`: unique on `email` where `email` is not null. The stored value is trimmed and lower-cased. Many rows may have a null email.
  - No index on name. A matching name is not a link, and a name index would invite a scan the lookup does not use. HQ and cashier search are equality lookups on the two unique indexes.
- Do not add `person_main_context`, `person_type`, or any other single-value role column. Customer, and any later hat, is discovered from the child relationship (`org_customers_mst` now). A column whose only legal value is `CUSTOMER` would have to be migrated the moment a second hat exists, and a check constraint on it would reject a person who also becomes staff.
- Add nullable `person_id` on `org_customers_mst`, foreign key to `sys_person_mst`, and the partial unique `(tenant_org_id, person_id)`.
- Add the per-tenant unique phone index described above, after a pre-check query that fails the migration with a clear message if one tenant already has duplicate normalized phones. Those duplicates are fixed or excluded by a reviewed data step. The migration does not auto-delete customers.
- Confirming “this is the same person” is one database transaction: create or reuse this laundry’s account, set `person_id`, and write an audit row on that account. If the audit insert fails, the link rolls back. The audit row records actor, account, person, and method. It records no balance and no other laundry.
- The cashier lookup is an authenticated API on the customer permission already used by create. It returns one of the four screen states. For a person who has no account here it returns the person’s name only. It does not return other laundries or balances. Anonymous callers cannot use it. It is rate-limited.
- Customer sign-in uses the same pending idea as staff, on the customer session store, not on `sys_auth_user_sessions_mst`. OTP success with several accounts yields a short-lived pending customer session with a person id and no account. Orders, booking, addresses, and the financial view reject that pending session. Binding writes the account and tenant into that same session. The picker list for that person returns only their own laundry names, through a security-definer function, never through a browser read of `sys_person_mst`.
- Do not backfill `person_id` by matching unverified phones across tenants.

### Services and APIs (`web-admin`)

- Replace the dead `shouldUseSysCustomers()` branch with an explicit person-link service. Delete the other-tenant search branch.
- Verification routes (`send-otp`, `verify-otp`, public customer login and session) set or reuse `person_id` under the rules above.
- Customer CRUD, addresses, preferences, loyalty, stored value, and B2B routes continue to authorize and filter by the session tenant and the **account** id, not by `sys_person_mst` alone.
- Staff merge endpoint stays as it is for this release and is not called by the linker. A merge that would move an account onto a different `person_id`, or that would cross `tenant_org_id`, is rejected.
- Every insert into `org_customers_mst` goes through the person-link use-case. That includes POS create, profile upgrade, and B2B screens that currently write Supabase from the page. The page does not embed a second copy of the link rules.
- Human-friendly customer numbers stay on the tenant account through the existing document-sequence registry. `sys_person_mst` has no customer number.
- Notification consent, preferred language, prices, and categories stay on the account. A message to laundry A checks laundry A’s consent only.
- Read-only duplicate report inside the current tenant, permission-gated, EN/AR. The cross-organization review lives only in the HQ workspace `/org-customers-manage`. The tenant app does not grow a cross-tenant browser.
- `cmx-api` has no customer controllers today. This release does not add one. Any later customer route uses the same bound session and does not accept a caller-supplied tenant as authority.
- Files this release edits stop logging raw phone candidate lists.

### UI

- Customer create, detail, and upgrade: verification state, link outcome, EN/AR, RTL, Cmx, `cmxMessage`.
- Customer app picker: small dialog, laundry names only, keyboard and screen reader, no switch control.
- Empty, loading, and “this code is invalid” states. Wrong OTP and unknown phone use the same generic failure where the channel would otherwise reveal whether a person exists, except where the laundry counter already knows they are creating a local guest.

### Tests

- Unverified guest stays unlinked.
- Verified phone creates one person and one account.
- Same verified phone at a second laundry creates a second account, same person, zero wallet and zero orders copied.
- Same phone again at the first laundry reuses the first account.
- Staff search with laundry A’s session returns none of laundry B’s rows.
- Two accounts show the picker; one account skips it; logout is required before the other laundry’s orders are visible.
- Concurrent create of the same phone in one tenant yields one row.
- Browser client cannot read `sys_person_mst` directly.
- Public orders, financial view, booking, and addresses reject a `tenantId` that does not match the bound session.
- A B2B or POS create of a verified phone uses the link use-case and does not insert a second unlinked account in the same laundry.

### Production bar

- **Separation of concerns.** Person lookup, account link, and customer session are three use-cases. Routes and screens call them. Order, wallet, loyalty, and AR code keeps using `org_customers_mst.id` and does not learn about `sys_person_mst`.
- **Same identifier rules as staff.** Email trim and lower-case, mobile E.164, with the same test vectors as `docs/features/Tenants_Users/PLAN.md`. Customers keep their own functions. No shared package.
- **Picker.** Same interaction bar as the staff picker: Cmx dialog, focus trap, keyboard, screen reader, RTL, EN/AR, loading and error, escape cancels, laundry display name from the organization, no industry hardcoded in the component. `cmxMessage` for operational feedback. Search existing translation keys before adding new ones.
- **Performance.** The picker is one query returning account id, tenant id, and display name. Customer lists do not join `sys_person_mst`. Search keeps the existing trigram phone indexes. Link is one unique lookup on the verified phone or email.
- **Audit.** A link writes an audit row on the tenant account: when, how verified, actor. The row contains no balance change.
- **Access contract.** A new dashboard report or route is gated through `customers-access.ts`, the page, and the API together.
- **Cache.** Customer account screens do not reuse a staff permission cache. A customer session cache, if added, keys by person, tenant, and account, and dies on logout.
- **After you apply the migration.** Regenerate Prisma and database types. The agent does not apply the migration.

### Screen and endpoint inventory

Staff UI: customer list, create, detail, upgrade, addresses, preferences, loyalty, stored value, consent, B2B list and detail, in-tenant duplicate report.

Public customer API, all bound to the session triple: `login`, `password`, `auth-options`, `session`, `auth/refresh`, `orders`, `orders/[orderNo]`, `orders/[orderNo]/financial-view`, `booking`, `addresses`, plus `send-otp` and `verify-otp`.

### HQ workspace `/org-customers-manage`

HQ operators get one workspace for customer persons. It is not a second cashier screen and it does not edit orders, wallets, prices, or consent.

- Navigation: the same `cleanmatex` migration style as the users workspace seeds `hq_navigation_cd` for `/org-customers-manage` and the child paths. Permission codes: `hq_org_customers:read`, `hq_org_customers:review`. Tenant-app tokens receive 403.
- Shell: `platform-web/app/org-customers-manage/` uses `CmxWorkspaceNav`. Screens:
  - `/org-customers-manage` searches by exact verified phone or email.
  - `/org-customers-manage/[personId]` shows the person and each organization account: organization name, active flag, linked date. No balances on the list. Opening one account is a separate audited action and shows that account’s commercial summary read-only.
  - `/org-customers-manage/duplicates` lists verified phones or emails that match more than one person, for a human to review. It does not auto-link and it does not merge money.
- APIs live in `platform-api`, HQ identity only. Search uses the unique indexes. Every search and every account open writes an audit row with the HQ actor.
- Copy is EN and AR, RTL, Cmx, and `cmxMessage`.
- The tenant app does not link to this workspace.

### Outside this release

- The in-tenant financial merge and the address, loyalty-column, and composite-FK cleanup listed above.
- Social login, biometrics, and the rest of `docs/plan_cr/028_customer_app_onboarding_auth_dev_prd.md`.
- Using `auth.users` for customers.
- Re-enabling `sys_customers_mst` as the live identity.
- A context or party-type column on `sys_person_mst`. Supplier, driver, and B2B contact, if added later, are new tables with `person_id`.
- `sys_person_address_dtl`. Addresses stay on `org_customer_addresses` for this laundry. A person-owned address book that a customer explicitly shares with one laundry is a later product, and it does not copy itself to every laundry.
- `sys_person_contact_dtl`. Add it only when a second verified phone or a second verified email must resolve to the same person. The unique key stays global and verified-only. Until then, one `phone_e164` and one `email` on `sys_person_mst` are the identity. Extra numbers a laundry dials live on `org_customers_mst`.

## Both-repo handoff

The tenant app can be built in `cleanmatex` from this plan. The HQ workspace can be built in `cleanmatexsaas` from this plan. They meet at the schema and at these routes. Neither side invents its own.

Ship order:

1. `cleanmatex` writes the `sys_person_mst` migration, the `hq_navigation_cd` seed, and the `hq_permissions` rows, then stops for you to apply it.
2. After apply, `cleanmatex` changes web-admin and `cleanmatexsaas` adds the workspace. The workspace reads columns that do not exist until the migration is applied.

HQ-only routes, `HqIdentityGuard`, no `AllowTenantIdentity`, tenant token receives 403:

- `GET /api/hq/v1/org-customers` searches by exact verified phone or email.
- `GET /api/hq/v1/org-customers/:personId` lists organization accounts without balances.
- `GET /api/hq/v1/org-customers/:personId/accounts/:accountId` is the audited read-only commercial summary.
- `GET /api/hq/v1/org-customers/duplicates` lists conflicting persons. It does not link or merge.

Module: `cleanmatexsaas/platform-api/src/modules/org-customers-manage/`. Screens: `platform-web/app/org-customers-manage/page.tsx`, `[personId]/page.tsx`, and `duplicates/page.tsx`. Permissions in `hq_permissions`: `hq_org_customers:read`, `hq_org_customers:review`. Navigation seed stays in the `cleanmatex` migration. The cashier lookup stays a tenant API in web-admin. It is not this HQ route.

Same email and mobile normalization test vectors as the users plan. Document the routes in both `docs/dev/rules/integration-contracts.md` files.

## Risks

- A readable `sys_person_mst` is a platform-wide directory of customers. Grants and the definer lookup are part of the migration, not a follow-up.
- Linking without the cashier’s confirm step would join the wrong person to this laundry’s orders. The create screen is that step. A background job does not link existing phones.
- Unique phone per tenant will fail to apply where duplicates already exist. The migration must detect them and stop with a list, not silently keep the weaker application check.
- Customer session and staff session are different stores. Reusing `sys_auth_user_sessions_mst` for customers would mix principals and RLS. The customer session stays on its own mechanism.
