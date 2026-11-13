---
name: Users Customers Tenancy
overview: Discussion draft split into two plans. One staff person and one customer person can each belong to many laundries with the same email or mobile. The chosen laundry stays fixed until logout. Commercial data and permissions stay inside that laundry.
todos:
  - id: users-plan-review
    content: "Review docs/features/Tenants_Users/PLAN.md (sys_users_mst, separate membership id, login picker, logout-only change, HQ and tenant app in one release)."
    status: pending
  - id: customers-plan-review
    content: "Review docs/features/Tenants_Customers/PLAN.md (sys_person_mst, per-laundry account, verify-then-link, no balance copy, logout-only laundry choice)."
    status: pending
  - id: staff-implementation
    content: "After explicit approval of the users plan only: schema, RLS, resolver, picker, HQ attach-or-create, tenant UI, tests. Do not start during discussion."
    status: pending
  - id: customer-implementation
    content: "After explicit approval of the customers plan only: sys_person_mst, person_id, link service, picker, tenant-only search, tests. Do not start during discussion."
    status: pending
  - id: later-merge-hygiene
    content: "Separate follow-up after customer identity is live: in-tenant merge of wallets, advances, loyalty accounts, AR, addresses, and B2B children."
    status: pending
isProject: false
---

# Users and Customers — Discussion Index

Still in discussion. These notes are the current best design, not an approval to build.

The full plans are:

- Staff: [docs/features/Tenants_Users/PLAN.md](docs/features/Tenants_Users/PLAN.md)
- Customers: [docs/features/Tenants_Customers/PLAN.md](docs/features/Tenants_Customers/PLAN.md)

Each plan is the scope of its own future implementation: database, services, APIs, screens, both repositories where that module actually runs, performance, tenant isolation, EN/AR, and tests. A completeness pass added the production gates: pending sign-in before a laundry is chosen, `cmx-api` no longer trusting a JWT tenant claim, customer public APIs rejecting a caller-supplied tenant, one person password, and a screen-and-endpoint inventory. Implementation starts only after you approve that plan by name.

While planning or implementing either plan: follow that repo’s `CLAUDE.md` and load the required skills, agents, rules, and docs. Use an existing shared Cmx component, or add a reusable one when the same UI will be used again. After each implementation step, update that plan’s status and progress and create or update the docs that step changed. The last task in each plan loads `/documentation` and generates the feature pack.

## What you decided

- Separate plans, under `docs/features/Tenants_Users/` and `docs/features/Tenants_Customers/`.
- A person with several active laundries sees a small window of laundry names at login. That choice is the context until logout or session expiry. Changing laundry means logging out. There is no in-session switch.
- HQ user create, attach, and delete are inside the users plan, in `cleanmatexsaas` and `cleanmatex` together. They are not a later optional approval.

## Answers kept in the users plan

**`sys_users_mst` — yes, and the id birth rule is confirmed.** It is our portable person record so a move off Supabase (Oracle, SQL Server, or another identity provider) keeps one stable id. It stores real email, verified mobile, `user_code`, status, and an identity-provider link. It does not copy passwords, tokens, or `auth.users` internals. Confirmed choice: on Supabase its id is set equal to `auth.users.id` at insert, so current `user_id` columns and `auth.uid()` stay one indexed lookup. The provider link is the piece that changes later. A fresh uuid resolved on every check was rejected.

**`org_users_mst.id` must not equal that person id.** One person at two laundries is two membership rows. The membership primary key can exist only once, so it cannot be the person id. `org_users_mst.user_id` points at `sys_users_mst.id`. `org_users_mst.id` is a new uuid per laundry.

## Customers, in one line

`sys_person_mst` is the customer person. `org_customers_mst` stays the laundry’s account. Orders, wallets, loyalty, and consent stay on the account. The same logout-only laundry choice applies in the customer app. Staff never see other laundries.
