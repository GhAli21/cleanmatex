# S0 authenticated allowlist

**Status:** Reviewed for the drafted migrations. Not applied.  
**Date:** 17 Nov 2026  
**Remote:** `project-0-cleanmatex-supabase_remote`  
**Table allowlist:** empty. No `sys_*`, `hq_*`, or `crm_track_test` policy is granted to `anon` or `authenticated`.  
**FORCE ROW LEVEL SECURITY:** on. `postgres` (Prisma and HQ `DATABASE_URL`) and `service_role` (web-admin admin client, HQ server clients, workers) have `rolbypassrls`. `anon` and `authenticated` do not.

The block below is the machine-readable list. `0746` and `scripts/db/check-s0-privileges.sql` must grant exactly these signatures to `authenticated`.

```s0-allowlist
public.fix_order_data(p_tenant_org_id uuid, p_steps text[], p_order_id uuid, p_dry_run boolean)
public.fn_auth_own_tenants()
public.fn_auth_session_choose_tenant(p_org_user_id uuid)
public.fn_auth_session_open_picker(p_remember_me boolean, p_ip_address inet, p_user_agent text, p_device_label text, p_device_id_hash text)
public.fn_auth_session_validate(p_touch boolean, p_ip_address inet)
public.fn_label_printing_resolve(p_tenant_id uuid, p_branch_id uuid)
public.get_user_permissions()
public.get_user_roles()
public.get_user_tenants()
public.has_all_permissions(p_permissions text[])
public.has_any_permission(p_permissions text[])
public.has_permission(p_permission text)
public.has_resource_permission(p_permission text, p_resource_type text, p_resource_id uuid)
```

These two are not API functions. Organization row-security policies call them as the session role. `0746` revoked them, and every organization query then failed with `permission denied for function current_tenant_id`. `0748` grants them again. Neither accepts a caller-supplied user or tenant. No JWT session makes `current_tenant_id()` return NULL and `is_admin()` return false.

```s0-rls-helpers
public.current_tenant_id()
public.is_admin()
```

These two entry points read the settings catalog, which stays closed to the public key. `0749` makes them run as the owner. A signed-in session may pass only its own organization. `service_role` may pass the organization it was given. `anon` is revoked.

```s0-settings-resolvers
public.fn_stng_resolve_all_settings(p_tenant_id uuid, p_branch_id uuid, p_user_id uuid)
public.fn_stng_resolve_setting_value(p_tenant_id uuid, p_setting_code text, p_branch_id uuid, p_user_id uuid)
```

## Why these functions stay

| Signature | Caller | Caller check |
|---|---|---|
| `fn_auth_session_validate(boolean, inet)` | Browser session touch and the bearer permission route | `auth.uid()` and the JWT session id |
| `get_user_tenants()` | Browser, proxy, login user client | `user_id = auth.uid()` |
| `get_user_permissions()` | Browser and server session client | `user_id = auth.uid()` and the current tenant |
| `get_user_roles()` | Browser | `auth.uid()` |
| `has_permission(text)` | Browser and server | Calls `cmx_can`, which uses `auth.uid()`. `cmx_can` itself is not granted |
| `has_any_permission(text[])` | Browser and server | Same wrapper rule |
| `has_all_permissions(text[])` | Browser and server | Same wrapper rule |
| `has_resource_permission(text, text, uuid)` | Browser and server | Same wrapper rule |
| `fn_auth_own_tenants()` | Login user client | Caller owns the session |
| `fn_auth_session_choose_tenant(uuid)` | Choose-tenant user client | Caller owns the session |
| `fn_auth_session_open_picker(...)` | Login user client | Caller owns the session |
| `fn_label_printing_resolve(uuid, uuid)` | Label config service on the request client | JWT role is `authenticated`, then the tenant is checked |
| `fix_order_data(uuid, text[], uuid, boolean)` | `POST /api/v1/orders/[id]/fix-order-data` after the route permission check | Raises unless `auth.uid()` is an active user of that tenant |

`anon` is not granted any of these. `service_role` can execute every SECURITY DEFINER function because the owner grant is not enough for that role: it does not own the functions and it does not bypass a missing `EXECUTE` grant.

## Rejected

| Name | Why it is not granted to `authenticated` |
|---|---|
| `get_user_permissions_jh(uuid, uuid)` | `COALESCE(p_cur_user_id, auth.uid())` lets the caller pass another user. `GET /api/navigation` now calls it with the service role after the route has resolved the session user. |
| `get_navigation_with_parents_jh(text[], text, jsonb)` | Trusts the permission array it is given. The navigation service now calls it with the service role. It only reads the menu catalog. |
| `cmx_rebuild_user_permissions(uuid, uuid)` | Does not check the caller, and `anon` can execute it today. The server rebuild now uses the service role. |
| `cmx_can(...)` | Accepts arbitrary user ids. The `has_*` wrappers are definers, so their owner can still call it. |
| `cmx_ord_canceling_transition`, `cmx_ord_returning_transition`, `cmx_ord_execute_transition`, `cmx_ord_order_workflow_flags` | Already not executable by `anon` or `authenticated`. Not re-granted. |
| `generate_order_number(uuid)`, `fn_ord_next_sub_order_no(uuid, uuid)` | Called by Prisma as `postgres`, not by a user JWT. `fn_ord_next_sub_order_no` does not check `auth.uid()`. |
| `fn_org_user_code_next()` | HQ `platform-api` calls it with the service role. No `auth.uid()` check. |
| `fn_shc_guard_tenant(uuid)`, `fn_tenant_general_value(uuid, text)` | No production `.rpc` caller. Tests are not a reason to keep a public-key grant. |

## Catalog reads moved off the user JWT

`sys_*` statements in the tenant app now go through `catalogReadClient`. Outside Jest that is the service role, and only for that statement. `org_*` queries stay on the session client. The browser currency minor-unit read goes through `readCurrencyMinorUnits`, a server action, so the service-role key is not bundled.

**Regression scan (tenant app):** `npm run check:s0-session-catalog-reads` (`scripts/db/scan-s0-session-catalog-reads.py`) fails when a session client still `.from('sys_*'|'hq_*')`, embeds those tables, or calls a non-allowlisted RPC without `catalogReadClient` / `createAdminSupabaseClient`. Admin-bound clients and org-only RPCs such as `resolve_item_preferences` are suppressed. Migration allowlist drift: `npm run check:s0-privilege-sources`.

`platform-api`, `platform-web` server, and `platform-workers` already use the service role. `platform-web` browser code has no `.rpc` and no `sys_` / `hq_` `.from`. No HQ code change.
