# CleanMateX Edit Order V2 — Permissions, Security & Tenant Isolation

**Version:** 3.0

## 1. Permissions

New commercial capabilities:

- `orders:edit` — enter/use commercial Edit V2 where policy allows;
- `orders:edit_override` — satisfy authorized override decisions; never bypass hard invariants.

Both were absent from the inspected local/hosted `sys_auth_permissions` catalogs on 2026-10-02; `orders:update`, `orders:post_settlement_edit` and `pricing:override` exist. The operator applied WP05 migration `0566_order_change_v2_permissions.sql` to local and remote environments; it seeds the two codes but intentionally adds no default role grant. A catalog code is not authorization. Do not grant broadly because a role name sounds appropriate.

Reuse specialized permissions such as pricing override, discount, refund/process-refund, post-settlement legacy controls during migration, manual charge where implemented.

Do not trust client-supplied actor IDs, `overrideBy`, tenant IDs, permission claims or financial outcomes.

## 2. Role mapping

Permission seeding and role mapping are separate. WP05 deliberately leaves `sys_auth_role_default_permissions` unchanged: the current `admin`, `finance_manager`, `super_admin`, and `tenant_admin` precedent for `orders:post_settlement_edit` is evidence only, not authorization to copy grants. Before a pilot, enumerate actual current system role codes and approve exact base/override holders. Tenant custom-role administrators may assign through the normal permission framework where product policy permits.

## 3. Route security

Each new route must use current authentication, tenant context, permission and CSRF conventions. Browser-hidden controls are not authorization.

Server tenant selection must prove active server-controlled membership. `web-admin/lib/auth/server-auth.ts:47` treats user metadata as a selected-tenant hint and verifies it against `get_user_tenants()` before deriving the tenant. This lookup requires membership integrity: current org_users_mst grants/policy permit ordinary self-row writes, so lookup alone is not sufficient security proof. Actor is the authenticated user, not a submitted override/actor UUID. Preview and Apply both enforce current permission; Apply rechecks authorization/policy after obtaining the shared order lock.

## 4. Target hierarchy

Every persisted ID is validated as belonging to the authenticated tenant and same order. Piece preference must prove order→item→piece. Return generic not-found/invalid-target without leaking cross-tenant existence.

## 5. RLS

RLS is defense in depth, not a replacement for explicit tenant predicates. Initial WP02 objects deny ordinary-role direct reads and writes. Later authorized history uses a reviewed server endpoint or separately proven membership-safe SELECT policy; neither is implemented here.

### Confirmed current security gaps and required closure

Read-only live metadata inspection succeeded for local and hosted `ndjjycdgtponhosvztdg` on 2026-10-02, as database `postgres` using the `postgres` role. These are installed-definition/privilege findings; no tenant data was exposed through an exploit test and no mutation/RPC execution occurred.

| Finding | Current evidence | Required boundary before enabling V2 |
|---|---|---|
| Tenant helper trusts editable metadata | Both installed `current_tenant_id()` bodies select `auth.jwt()->'user_metadata'->>'tenant_org_id'` before membership fallback, with SECURITY DEFINER and no fixed search_path. Core order/item/piece/preference/outbox/idempotency ALL policies use this helper. Repository source: `supabase/migrations/0004_auth_rls.sql:14`, `:19`; policy adoption: `0061_fix_all_rls_policies_current_tenant_id.sql:98`. | Selected tenant must be validated against active server-controlled membership, or a reviewed trusted claim plus required freshness/membership checks. User-editable metadata is only a hint. Fixing the new routes alone leaves direct Data API authorization unsafe. Apply an independently reviewed additive hardening migration; preserve legitimate tenant switching. |
| Broad grants and defaults | Both targets grant anon/authenticated SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE on inspected order structures, legacy history, replay and outbox. Hosted public-schema table/function default ACLs grant broad rights to those roles. | Explicitly restrict new Change objects and committed commercial writers. Revoke inappropriate non-row privileges and guard permitted mixed Create/operational writers. RLS cannot be used as a substitute for grants; TRUNCATE is outside row-policy enforcement. Do not revoke required Create/Workflow/Finance access indiscriminately. |
| Repair RPC bypass | Installed `fix_order_data(uuid,text[],uuid,boolean)` is SECURITY DEFINER and executable by anon/authenticated, lacks actor/permission checks, permits a NULL tenant scope and can insert/delete pieces outside Change. Source: `0113_fix_order_data_add_dry_run.sql:17`, `:101`, `:167`. | Ordinary roles cannot execute committed repair. Privileged repair requires explicit authenticated authority, bounded tenant/order scope, dry-run, audited actor/reason and reconciliation; V2 commercial repairs use governed REPAIR where expressible. |
| HQ maintenance RPC is not privilege-isolated | Installed `hq_mntnc_cleanup_tenant_orders(...)` is SECURITY DEFINER, executable by anon/authenticated, and full inspected body has no auth/permission/role guard. `0466_rename_cleanup_tenant_orders_function.sql:9` describes service-role-only carryover, which the live ACL contradicts. | Remove ordinary execution; retain only reviewed privileged maintenance authority. Renaming to `hq_*` is not an access control. Never use this destructive RPC as Change rollback. |
| Global outbox claim RPC accessible to clients | Installed `claim_outbox_batch(integer,timestamptz)` is SECURITY DEFINER, executable by anon/authenticated, and claims/returns global outbox rows without actor/tenant checks. | Worker-only execution under reviewed grants; tenant-facing reads are scoped and authorized. No client path may claim another tenant's events. Preserve legitimate server worker behavior and prove delivery after hardening. |

Supabase explicitly documents that user metadata is user-editable and unsafe as authorization authority ([RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)). PostgreSQL documents that TRUNCATE is not subject to row security ([PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)). These platform facts explain the impact of the verified installed definitions; they do not claim a performed exploit.

For every new/replaced SECURITY DEFINER function: justify the privilege boundary, schema-qualify references, set a reviewed fixed search_path, explicitly revoke PUBLIC/ordinary EXECUTE, grant only intended roles and enforce tenant/actor authority inside any user-callable command. Audit effective privileges, including inherited/default grants, not merely explicit GRANT text. Normal backend queries still need visible tenant predicates.

WP02 must design new-object grants and avoid copying the unsafe helper as a trusted membership proof. WP17 owns writer/RPC closure; WP18 owns real role/claim/direct-access proof; WP19 pilot/cutover remains blocked until these confirmed gaps are closed for enabling scope. Catalog inspection as postgres cannot pass those runtime gates.

### WP02 creation-time boundary

[Tenant Security Preflight](WP02_Tenant_Security_Preflight.md) owns exact current role/default ACL/RPC evidence. Membership integrity is a platform dependency: org_users_mst permissive ALL self-row policy and ordinary INSERT/UPDATE/DELETE grants persist; cmx_can has membership-role admin bypass. A new EXISTS/get_user_tenants lookup over writable membership is insufficient. No exploit was executed. Close and prove the dependency without indiscriminately changing existing policies in WP02.

NEW0548 sets postgres ownership, enables RLS with no ordinary policies, revokes ALL table rights from PUBLIC/anon/authenticated/service_role, then grants only service_role SELECT/INSERT. Normal owner/BYPASSRLS UPDATE/DELETE/TRUNCATE is rejected by immutable-history triggers. No role-claim GUC exemption or user-callable definer function is introduced. Trigger functions are SECURITY INVOKER with fixed pg_catalog search_path and ordinary EXECUTE revoked. Later service-role/Prisma queries require server-derived tenant/actor and explicit tenant predicates. Configured Prisma postgres role is configuration, not deployed runtime proof. Owner/DBA schema administration remains a separately audited limitation.

Initial commitment stamping and edit_state_version/direct commercial writes on existing order tables are not privilege-closed by new-object revokes. Their mixed Create/Workflow/Finance ownership must be secured and tested before V2 enablement in WP17/WP18.0547/0548 are now operator-applied; read-only catalogs prove new-object ACLs/RLS/guards match the reviewed default-deny design. Global membership integrity/runtime authorization remains unproven. The agent applied no migration.

## 6. Immutable facts

Normal Edit V2 cannot rewrite:

- payment/voucher/receipt history;
- issued fiscal documents;
- commitment timestamp/source;
- applied Change/operation rows;
- customer identity/branch/currency in V1;
- permanent edit block through ordinary override.

## 7. Sensitive data

Before/after JSON and metadata must exclude payment secrets, PAN/CVV, credentials, tokens, unnecessary PII and large binary payloads. Store identifiers/safe display snapshots only when needed for audit.

## 8. Threat cases required in tests

- forged tenant/order/item/piece/preference UUID;
- guessed foreign-tenant ID;
- client actor/override spoofing;
- stale signed review/gate proof replay;
- same idempotency key different payload;
- direct Data API/RPC mutation bypass;
- CSRF on mutation routes;
- direct legacy committed full-replacement attempt after V2 enablement;
- authorization changes between Preview and Apply;
- permanent block bypass attempt.

- forged selected-tenant metadata with no membership, inactive/revoked membership and supported tenant switching;
- ordinary-role EXECUTE denial for repair, HQ cleanup and global outbox claim RPCs;
- effective table/default privileges, including TRUNCATE denial, checked without mutating production data;
- application database-role privilege tests that preserve allowed Create/Workflow/Finance behavior while denying committed commercial bypass.

Run negative security cases against dedicated fixtures/identities. A mocked permission callback or postgres catalog query is insufficient. Record actual REST/RPC exposure configuration, connection role and JWT/tenant context before counting a proof as passed.
