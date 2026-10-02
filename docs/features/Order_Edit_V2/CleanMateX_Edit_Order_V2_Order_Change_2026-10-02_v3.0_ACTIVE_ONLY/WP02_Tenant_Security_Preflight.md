# WP02 Tenant Security Preflight

**Date:** 2026-10-02 (Asia/Muscat)  
**Status:** Read-only metadata and scoped foundation-security design complete; runtime/security/data proof pending.  
**Scope:** NEW Order Change objects only. This evidence supplements the existing v3.0 living implementation plan; it is not another plan and does not authorize changes to platform-wide helpers, existing RPCs, permissions, settings or deployed data.

## 1. Sources and verification boundary

Reviewed root `AGENTS.md`, `CLAUDE.md`, database/multitenancy/Supabase instructions and `docs/dev/rules/integration-contracts.md`. No nested instruction file was returned inside the related Supabase, authentication or active feature-document scope.

Fresh metadata SELECTs succeeded against both local and hosted `ndjjycdgtponhosvztdg` catalogs. The sessions are `postgres` database / `postgres` role, PostgreSQL 17.6. These sessions inspect definitions and effective grants; they do not prove application-user authorization, normal Data API behavior, production application identity, backfill quality or concurrent execution.

**Continuation baseline:** refreshed against repository HEAD `f33cff481c7a5d35fb16ad5a10983db2762c9818`. Both migration-history catalogs now contain **552 records**, with latest numeric version **0546**; repository versions 0541–0546 are cash-drawer/legacy-currency retirement and cash-change rounding work, not WP02 migrations. The helper, membership-policy, actor-key, role and default-ACL findings below were re-read after those migrations. They remain materially unchanged. Local PostgreSQL is x86_64; hosted PostgreSQL is aarch64. Equal migration versions do not prove equal catalogs: the legacy TEXT/VARCHAR actor/membership differences below persist.

Queries read catalogs/function definitions only. No migration, role switch, schema experiment, RPC execution or business-row mutation was performed. No tenant was assigned to this security preflight, so no cross-tenant business/identity data scan or historical actor aggregate was performed.

## 2. Verified identity and membership schema

Both targets agree on these relevant columns/keys:

| Object | Exact authority / columns |
|---|---|
| `auth.users` | `id UUID NOT NULL`, PK `users_pkey`; nullable `deleted_at TIMESTAMPTZ`, `banned_until TIMESTAMPTZ` also exist |
| `public.org_users_mst` | `id UUID` is tenant-membership row identity; `user_id UUID NOT NULL` references `auth.users(id)`; `tenant_org_id UUID NOT NULL` references `org_tenants_mst(id)`; UNIQUE `(user_id,tenant_org_id)`; `is_active BOOLEAN NOT NULL DEFAULT true`; `is_user BOOLEAN NOT NULL DEFAULT true`; nullable `rec_status SMALLINT DEFAULT 1` |
| `public.org_tenants_mst` | `id UUID` PK; nullable `is_active BOOLEAN DEFAULT true`; nullable `rec_status SMALLINT DEFAULT 1` |
| `public.org_order_edit_history` | `edited_by UUID NOT NULL`, FK `fk_order_edit_history_user` to `auth.users(id)` |
| `public.org_order_items_dtl` | Existing `override_by UUID` FK references `org_users_mst(id)`; it is **membership identity**, not the new authenticated actor identity |

The membership `role` column is TEXT locally and VARCHAR on the hosted target. This difference does not justify an unrelated conversion. Relevant actor audit columns are mixed legacy TEXT/VARCHAR, while legacy history uses UUID: orders `created_by/updated_by` TEXT; pieces TEXT; preferences VARCHAR; item `created_by` TEXT local/VARCHAR hosted and `updated_by` TEXT.

New `committed_by`, `edit_blocked_by`, `deleted_by` and Change `actor_user_id` follow authenticated `auth.users(id)` UUID authority. Never copy a membership ID, arbitrary legacy audit text, display name or system label into these fields. Initial nullable commitment/block/removal columns need no speculative historical actor cast. Backfill uses only verified auth-user lineage; unknown historic actors remain NULL according to the approved backfill contract. The Change master represents a real new authenticated command, so `actor_user_id` remains required.

**Data compatibility gate:** a future aggregate must be limited to an explicitly authorized tenant and must filter every tenant-bearing source by that tenant. It must separate valid auth UUID lineage, membership UUID lineage, arbitrary/system audit strings and NULLs without disclosing identity/PII. This preflight does not assert historical actors are backfill-ready.

## 3. Installed helper definitions and membership-integrity dependency

Both installed `current_tenant_id()` bodies are SECURITY DEFINER owned by postgres, have no fixed search_path and prioritize:

```text
auth.jwt() -> 'user_metadata' ->> 'tenant_org_id'
then active org_users_mst membership ordered by last_login_at
```

Both installed `get_user_tenants()` bodies are SECURITY DEFINER owned by postgres, have no fixed search_path and select tenant membership for `u.user_id = auth.uid()`, `u.is_active = true`, `t.is_active = true`. Unlike `current_tenant_id()`, they filter authenticated membership rather than trusting a selected-tenant metadata value. Their effective EXECUTE ACLs include PUBLIC, anon, authenticated and service_role.

Orders, items, pieces and preferences have RLS enabled, not forced, and postgres ownership on both targets. Their permissive tenant ALL policies use `current_tenant_id()`; pieces and preferences additionally have service-role ALL policies. This establishes **RLS enabled**, not **membership-safe authorization proven**. The inspection did not execute those policies under a browser identity.

The NEW objects must not copy `tenant_org_id = current_tenant_id()` as their authorization predicate. Existing `web-admin/lib/auth/server-auth.ts:47` treats selected-tenant metadata as a hint and checks it against membership. This remains the application convention, but the membership table itself needs separate integrity proof.

**Newly verified dependency:** both `org_users_mst` catalogs contain permissive policy `tenant_isolation_org_users_mst`:

```text
FOR ALL
USING (user_id = auth.uid() AND tenant_org_id = current_tenant_id())
WITH CHECK (user_id = auth.uid() AND tenant_org_id = current_tenant_id())
```

Both also grant anon/authenticated table-wide INSERT/UPDATE/DELETE and other privileges. Separate admin policies do not narrow a permissive ALL policy. This permits self-row role changes in the currently selected legitimate tenant at the policy/grant level; the installed `cmx_can(...)` grants tenant-wide admin bypass based on active `org_users_mst.role IN ('super_admin','tenant_admin')`. No attack or mutation was executed. The metadata/RLS combination also creates a membership-manufacturing risk whose full Auth/Data API behavior needs dedicated negative tests.

Both `auth.users` catalogs contain trigger `trg_ensure_jwt_tenant_context`, invoking `ensure_jwt_tenant_context_on_auth_user()` before INSERT or UPDATE of raw_user_meta_data. It can overwrite changed tenant metadata from an existing active membership, but leaves supplied metadata when no active membership is found; it is not membership/permission revocation enforcement for already issued JWTs. Do not ignore this installed trigger or claim a performed forged-JWT exploit.

A NEW helper can avoid raw metadata and recursive RLS, but merely checking membership is not proof that existing membership/role rows are server-controlled. WP02 does not fix the old policy/helper/RPC surfaces. Their integrity/direct-access closure remains a prerequisite for granting NEW ordinary direct reads or enabling V2.

## 4. Exact scoped NEW-object security design

### 4.1 Foundation privilege boundary

After creating the two NEW Change tables, remove their inherited PUBLIC/anon/authenticated/service_role rights explicitly, then grant service_role only SELECT and INSERT. Neither ordinary role receives direct SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER rights in the disabled foundation deployment. The configured Prisma owner path can SELECT/INSERT; owner-path append-only protection requires the unconditional guards below.

| Authority | Initial NEW-table access | Enforcement / limitation |
|---|---|---|
| Owner `postgres` | Owner SELECT/INSERT; normal UPDATE/DELETE/TRUNCATE rejected | RLS bypasses; unconditional immutable-history triggers required |
| `service_role` | Explicit SELECT, INSERT only after REVOKE ALL | BYPASSRLS; server authentication, permissions and explicit tenant predicates still required |
| `authenticated`, `anon`, PUBLIC | No direct table privileges; no ordinary policies | RLS default denial plus explicit revocation of inherited ACLs |
| Administrative owner/superuser DDL | Can intentionally disable/drop protection | Outside normal command authority; reviewed maintenance protocol and release gate |

Withholding authenticated SELECT is a foundation/cutover gate, not a replacement for the approved eventual authorized tenant-read behavior. A later reviewed grant may enable it only after membership/permission integrity and real-role tests pass. API history/context readers use server-derived tenant/actor and current permission guards; no server route bypass is justified by this foundation design.

Enable RLS on both NEW tables. No ordinary INSERT/UPDATE/DELETE policy is created. A future authenticated SELECT policy can be defined using the scoped helper below, but must not become reachable through a SELECT grant until its dependency gates pass. Do not invent a JWT/custom-GUC marker to unlock DML.

WP02's initial authored foundation must create **neither** the eventual membership helper **nor** an authenticated SELECT policy. Section 4.2 is the later gated contract; it is not an extra WP02 object or permission seed. No helper can certify membership integrity while the underlying self-write policy remains permissive.

### 4.2 Scoped membership predicate for eventual authorized reads

Proposed helper contract: `public.cmx_ord_chg_member(p_tenant UUID) -> BOOLEAN` (18-character identifier). It is read-only/STABLE and accepts the tenant being tested, **never a caller-supplied actor ID**. It does not call `current_tenant_id()`, read user_metadata or accept role claims.

Its exact membership predicate is:

```text
p_tenant IS NOT NULL
AND auth.uid() IS NOT NULL
AND EXISTS (
  public.org_users_mst u
  JOIN public.org_tenants_mst t ON t.id = u.tenant_org_id AND t.id = p_tenant
  WHERE u.tenant_org_id = p_tenant
    AND u.user_id = auth.uid()
    AND u.is_active = true
    AND t.is_active = true
)
```

The tenant row has no `tenant_org_id` column; its explicit tenant filter is `t.id = p_tenant`. Do not add unapproved rec_status/is_user/ban lifecycle semantics merely because these columns exist; align any future expansion with the existing auth/membership domain and explicit policy.

If authored, this helper uses narrowly justified SECURITY DEFINER ownership to read membership without invoking its existing recursive/unsafe RLS. Set `search_path = ''`, schema-qualify every reference/function, return only a boolean, prohibit DML/dynamic SQL and explicitly revoke PUBLIC/anon/authenticated EXECUTE inherited from defaults. The future authenticated SELECT policy calls it with the NEW row's `tenant_org_id`; helper EXECUTE and table SELECT must be deliberately enabled together after the integrity gates. Current service_role/postgres backend reads bypass RLS and still require explicit tenant predicates in their query.

No existing private/internal helper schema was returned by the scoped namespace lookup. This design adds no generic authorization/policy-table forest or global replacement helper. If an isolated unexposed schema is selected during reviewed authoring, it is a scoped new-object deployment choice requiring explicit schema USAGE/function grants, not an assumed existing namespace.

Membership alone is not a new permission engine. Future direct-read permission scope must remain aligned with the existing Order Change history/context contract and reviewed RBAC. The current `cmx_can` can accept explicit tenant/auth IDs, but its admin-bypass dependency above means passing explicit IDs alone does not certify it safe against manufactured role facts.

### 4.3 Append-only enforcement despite BYPASSRLS

For each NEW applied-history table, unconditional row-level BEFORE UPDATE OR DELETE and statement-level BEFORE TRUNCATE guards reject the operation. The guard function is SECURITY INVOKER, fixes search_path, performs no table query and always raises a stable immutable-history error. Revoke ordinary direct EXECUTE; do not provide a role, custom GUC or metadata exception.

Postgres and service_role command DML must hit these guards too. Immutable master insertion remains one final INSERT after canonical facts/snapshot, using only the new deferred removal-lineage existence checks; no shell UPDATE is needed. No-op commands create no history. RLS and table REVOKEs alone cannot enforce this on the owner/BYPASSRLS path.

No database guard can make a superuser/table-owner unable to intentionally disable/drop the guard. Administrative DDL/maintenance is outside normal Change authority and requires the reviewed maintenance/repair protocol. WP02 must not introduce an ordinary bypass flag or reuse destructive HQ cleanup as rollback. A migration reviewer/operator remains privileged to apply reviewed schema; the application should not rely on that privilege as proof of authorization.

### 4.4 Actor/server authority

Normal command actor comes from verified server authentication, and tenant comes from reviewed active membership/selection. API input cannot set actor, override author or tenant. An auth-user FK proves identity existence, not current tenant membership or permission: Apply must revalidate those under its command transaction/policy boundary. Prisma postgres connections do not automatically populate `auth.uid()`; do not default a mandatory new command actor from a NULL database auth context.

## 5. Runtime/role evidence without secrets

| Surface | Verified evidence | Limit |
|---|---|---|
| Supabase cookie/bearer client | `lib/supabase/server.ts:23` reads public anon key; cookie/bearer access token provides the authenticated PostgREST context | Actual runtime JWT/REST exposure behavior not exercised |
| Supabase admin client | `server.ts:195` uses server-only service-role key and no user cookies | No key printed; deployed access/config not probed |
| Prisma | `prisma/schema.prisma:7` uses DATABASE_URL; `lib/db/prisma.ts:36` constructs client; no role/JWT session initialization in that inspected client | Does not prove deployed process connection state |
| Configured local URLs | Credential-safe URI parsing of root .env, web-admin/.env and web-admin/.env.local finds username postgres; no password, URI or token printed | Configuration-only evidence |
| Live postgres | Both pg_roles: LOGIN, BYPASSRLS, non-superuser | Metadata MCP session; table ownership still privileged |
| Live service_role | Both: BYPASSRLS, NOLOGIN | PostgREST role identity, not direct login |
| Live anon/authenticated | Both: NOLOGIN, no BYPASSRLS | Effective role policy behavior still needs dedicated fixture tests |
| Live supabase_admin | Both: LOGIN, SUPERUSER, BYPASSRLS | Administrative authority outside normal application guarantee |

Both public-schema default ACL catalogs grant broad table and function rights to anon/authenticated/service_role for postgres and supabase_admin-created objects. NEW-object revokes are mandatory even if no explicit broad GRANT appears in the new migration. Do not alter global default ACLs or other tables/functions within this WP02 scope.

### 5.1 Repair/maintenance RPC closure handoff

Fresh function-definition and effective `has_function_privilege` inspection agrees on both targets:

| RPC | Installed authority / tenant behavior | V2 revision risk | Required later gate |
|---|---|---|---|
| `fix_order_data(UUID,TEXT[],UUID,BOOLEAN)` | postgres-owned SECURITY DEFINER, `search_path=public`; anon/authenticated EXECUTE; tenant argument defaults NULL and outer predicate then matches every tenant; piece subqueries and trim DELETE lack explicit tenant predicates | Inserts/deletes persisted pieces without a governed Change or edit-version increment; it does not inspect commitment | WP17/WP18 close ordinary execution and require scoped, audited governed repair; do not use this RPC for WP02 proof/backfill |
| `hq_mntnc_cleanup_tenant_orders(...)` | postgres-owned SECURITY DEFINER, `search_path=public`; anon/authenticated EXECUTE; requires tenant argument and scopes principal targets, but no caller membership/permission guard appears in its body | Destructive structural, payment, voucher, tax/history cleanup; no V2 commitment/revision guard | WP17/WP18 restrict authority and define protected-history maintenance; this is never a migration rollback or V2 cleanup route |
| `claim_outbox_batch(INTEGER,TIMESTAMPTZ)` | postgres-owned SECURITY DEFINER, `search_path=public`; anon/authenticated EXECUTE; intentionally global worker claim without tenant predicate | Caller can claim/update worker events; default search path and ordinary EXECUTE are not a trusted worker boundary | WP17/WP18 restrict to reviewed worker authority and prove normal delivery behavior; no outbox runtime change in WP02 |

No RPC was invoked, including dry-run modes. The findings are installed-body/ACL evidence, not a demonstrated exploit. Adding protected-history RESTRICT FKs must fail destructive history deletion rather than authorizing this existing cleanup body; it does not remove the ordinary EXECUTE exposure itself. There is no platform-wide RLS/RPC repair in this WP02 artifact.

## 6. Required proof and handoff

Before calling WP02 security complete or enabling a cohort, record:

- reviewed NEW table/function/trigger definitions, grants/revokes, owner and helper search_path;
- actual application/Prisma connection identity and effective privileges;
- authenticated users with valid, absent, inactive and revoked membership; supported multi-tenant switching; forged selected-tenant metadata;
- self-membership role/tenant manufacture denial in dedicated Auth/Data API fixtures before enabling ordinary NEW direct reads;
- no ordinary direct history INSERT/UPDATE/DELETE/TRUNCATE, with service-role and configured postgres UPDATE/DELETE/TRUNCATE guards also tested;
- valid one-shot master/ops insert, deferred missing-master rejection and rollback through the real ORM transaction path;
- legitimate Create/Workflow/Finance behavior retained, and no privileged repair/global-outbox/HQ RPC bypass in enabling scope;
- tenant-bound historical actor/backfill compatibility if a concrete authorized tenant is supplied.

This document proves metadata/design only. Runtime security, historical data and deployed application role checks remain PENDING. No database change was applied.

## 7. Primary references

The conclusions above use current catalog/source evidence. Platform behavior was checked against [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase function security](https://supabase.com/docs/guides/database/functions) and [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html). RLS does not replace table grants or protect TRUNCATE; definer helpers require fixed/schema-qualified resolution and narrowly justified privileges.

## 8. Installed-object verification after operator application — 2026-10-02

Fresh read-only catalogs now confirm0547/0548 installed on local and hosted (555 migration records/latest0549). Both history tables: ownerpostgres, RLSenabled, zero policies, no effective anon/authenticated table privileges; service_role SELECT/INSERTonly. Three invoker functions have fixed pg_catalog search_path and direct EXECUTEonlypostgres; eight guards enabled. Exact definitions/157 comments match reviewed SQL. Fourteen NOT VALID constraints remain intentional; installation is not runtime JWT/transaction/rollback proof. No migration/function/business-data write was executed by this verification.

Existing current_tenant_id and org_users_mst membership-integrity dependencies are unchanged. The installed new-object boundary does not secure old membership/committed-writer/RPC authority. [WP02 report](WP02_Foundation_Preparation_v3.0.md) sections17/18 record deployment/type evidence and completed user-authorized Prisma sync. Generated ORM types do not enforce permissions/tenant predicates. WP02 security/data/runtime acceptance remains partial; WP03 is not started.
