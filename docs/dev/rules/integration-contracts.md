# integration-contracts.md — Cross-Project Single Source of Truth

**Applies to:** `cleanmatex` ↔ `cleanmatexsaas`
**Location (both projects):**
- `F:\jhapp\cleanmatex\docs\dev\integration-contracts.md`
- `F:\jhapp\cleanmatexsaas\docs\dev\integration-contracts.md`

> This file is the authoritative reference for all cross-project work. Both CLAUDE.md files point here. Keep both copies identical.

---

## 1. Ownership Table

| Concern | Owner | Consumer |
|---|---|---|
| Database migrations | `cleanmatex` | `cleanmatexsaas` (reads only) |
| RLS policies | `cleanmatex` | N/A (cleanmatexsaas bypasses via service role) |
| TypeScript type generation | Both (run after cleanmatex migrations) | — |
| Settings (`sys_stng_*`) | `cleanmatexsaas` | `cleanmatex` via HQ API |
| Feature Flags (`sys_feature_flags_*`) | `cleanmatexsaas` | `cleanmatex` via HQ API |
| Tenant-scoped business logic | `cleanmatex` | — |
| Cross-tenant admin operations | `cleanmatexsaas` | — |
| ADR approval | User (writes `Approved_By_Jh` in ADR file) | Both projects |

---

## 2. Feature Placement Decision Matrix

**Before implementing ANY feature**, answer these three questions:

| Q | Question | Answers |
|---|---|---|
| Q1 | Who are the primary users? | Tenant users / Platform admins / Both |
| Q2 | What is the data scope? | Single tenant / Cross-tenant / Both |
| Q3 | What is the access pattern? | RLS enforced / Service role key / Both |

**Result:**
- **Tenant Operations** (Orders, Customers, Inventory, Lite ERP) → `cleanmatex`
- **Platform Admin** (Tenant Management, Billing, Analytics) → `cleanmatexsaas`
- **Dual-Purpose** (Settings, Feature Flags, Audit Logs) → Both projects

For complex decisions: create an ADR using `.claude/docs/Dev/ADR_TEMPLATE.md` and follow `.claude/docs/Dev/ADR_PROCESS.md`.

---

## 3. Cross-Project Feature: Declare Intent First

**BEFORE any cross-project implementation**, output this analysis and wait for user approval:

```markdown
## Cross-Project Feature: [Feature Name]

### Scope Analysis

**cleanmatex Components** (Tenant App):
- Database: [migrations, tables, RLS policies, functions]
- Backend: [tenant-scoped APIs, services]
- Frontend: [tenant-facing UI components]
- Access Pattern: RLS + anon key (tenant-scoped only)

**cleanmatexsaas Components** (Platform HQ):
- Backend: [platform admin APIs, cross-tenant queries]
- Frontend: [platform admin UI, dashboards]
- Type Regeneration: [Required after cleanmatex migrations? Y/N]
- Access Pattern: Service role key (cross-tenant allowed)

**Shared Resources**:
- Database schema: [tables, functions, views]
- Settings: [new settings]
- Feature flags: [new flags]
- RLS Policies: [list policies — created in cleanmatex]

**User Confirmation Required Before Proceeding**
```

---

## 4. Context Switch Protocol

### Switching TO cleanmatex (from cleanmatexsaas)

```
─────────────────────────────────────────────
🔄 CONTEXT SWITCH: cleanmatexsaas → cleanmatex
─────────────────────────────────────────────
Active Project:   cleanmatex (Tenant-Facing Application)
Directory:        F:/jhapp/cleanmatex
Active CLAUDE.md: F:/jhapp/cleanmatex/CLAUDE.md
Active Skills:    F:/jhapp/cleanmatex/.claude/skills/
Active Standards: F:/jhapp/cleanmatex/.claude/docs/

Rules Now in Effect:
✅ Use RLS policies for ALL org_* tables
✅ Use anon key Supabase client
✅ Filter ALL queries by tenant_org_id
✅ Create migrations HERE (source of truth)
✅ Implement tenant-scoped features only
❌ NO cross-tenant queries
❌ NO service role key usage
```

### Switching TO cleanmatexsaas (from cleanmatex)

```
─────────────────────────────────────────────
🔄 CONTEXT SWITCH: cleanmatex → cleanmatexsaas
─────────────────────────────────────────────
Active Project:   cleanmatexsaas (Platform HQ Console)
Directory:        F:/jhapp/cleanmatexsaas
Active CLAUDE.md: F:/jhapp/cleanmatexsaas/CLAUDE.md
Active Skills:    F:/jhapp/cleanmatexsaas/.claude/skills/
Active Standards: F:/jhapp/cleanmatexsaas/.claude/docs/

Rules Now in Effect:
✅ Use service role key Supabase client
✅ Cross-tenant queries allowed (for admin features)
✅ Regenerate types after cleanmatex migrations
✅ Implement platform admin features
❌ NEVER create migrations here
❌ NEVER use RLS-only patterns (we bypass RLS)
```

---

## 5. Database Migration Protocol

**ABSOLUTE RULES — NEVER VIOLATE:**

| Rule | cleanmatex | cleanmatexsaas |
|------|-----------|----------------|
| Create migrations | ✅ ALWAYS HERE | ❌ NEVER HERE |
| Migration location | `F:/jhapp/cleanmatex/supabase/migrations/` | N/A |
| Apply migrations | ✅ User applies | ❌ Never |
| RLS policies | ✅ MUST implement for org_* tables | ❌ Not applicable (service role bypasses) |
| Type generation | ✅ After migration | ✅ After cleanmatex migration |

**Workflow for database changes:**
1. Announce switch to cleanmatex context
2. Create migration in `F:/jhapp/cleanmatex/supabase/migrations/`
3. Add RLS policies if creating org_* tables
4. Stop and tell user to review and apply migration
5. Wait for user confirmation migration is applied
6. Announce switch to cleanmatexsaas context
7. Regenerate types: `F:/jhapp/cleanmatexsaas/scripts/dev/update-types.ps1`
8. Verify types build in cleanmatexsaas

---

## 6. Context Verification Checklist

**Before executing ANY code in a cross-project task:**

```markdown
### Current Context Verification
- Active Project:        [cleanmatex | cleanmatexsaas]
- Current Directory:     [F:/jhapp/cleanmatex | F:/jhapp/cleanmatexsaas]
- Active CLAUDE.md:      [project]/CLAUDE.md
- Active Skills Dir:     [project]/.claude/skills/
- Active Standards Dir:  [project]/.claude/docs/
- DB Access Pattern:     [RLS + anon key | Service role key]
- Tenant Filtering:      [ALWAYS filter | Filter only when tenant-specific]
- Cross-Tenant Queries:  [FORBIDDEN | ALLOWED for admin]

Action:          [What I'm about to do]
Correct Context: [✅ Yes | ❌ No — MUST SWITCH]
```

---

## 7. Skills & Standards: Never Mix Across Projects

| Context | Skills from | Standards from |
|---|---|---|
| cleanmatex | `F:/jhapp/cleanmatex/.claude/skills/` | `F:/jhapp/cleanmatex/.claude/docs/` |
| cleanmatexsaas | `F:/jhapp/cleanmatexsaas/.claude/skills/` | `F:/jhapp/cleanmatexsaas/.claude/docs/` |

---

## 8. Integration Contract Strategy (No Code Copying)

**Do not copy implementation code** between projects. Each project implements its own code with its own rules.

**Use contracts and ownership instead:**
- **Placement decision first** — confirm which project owns the behavior
- **Integration contract** — document API endpoints, request/response shapes, error shapes, auth expectations, event payloads, generated DB types, schema ownership
- **Local implementation** — cleanmatex = RLS + `tenant_org_id`; cleanmatexsaas = service role + platform admin boundaries
- **Shared implementation exception** — if strict identical implementation is proposed, stop at an ADR proposal. The ADR is approved only when the file contains the exact marker `Approved_By_Jh` written by the user. Until then, do not implement. Do not automatically create packages, copy files, or sync code.

---

## 9. Settings & Feature Flags API Contract

| Resource | Managed by | Consumed by | Access method |
|---|---|---|---|
| `sys_stng_*` (settings) | cleanmatexsaas | cleanmatex | HQ API endpoint (to be documented) |
| `sys_feature_flags_*` | cleanmatexsaas | cleanmatex | HQ API endpoint (to be documented) |

**API shapes (fill in as built):**

| Endpoint | Method | Auth | Request | Response |
|---|---|---|---|---|
| `/api/settings/{key}` | GET | tenant JWT | — | `{ key, value, type }` |
| `/api/feature-flags/{flag}` | GET | tenant JWT | — | `{ flag, enabled }` |

---

## 10. Error Recovery Protocol

**If context is violated** (e.g. migration created in cleanmatexsaas, service role used in cleanmatex):

1. User flags violation: "Wrong context!"
2. Immediately stop and acknowledge error
3. Delete/revert incorrect work
4. Announce correct context switch
5. Re-do work in correct context with correct rules

---

## 11. Cross-Project Feature Checklist (Quick Summary)

For the full 200+ checkpoint list: `.claude/docs/Dev/CROSS_PROJECT_FEATURE_CHECKLIST.md`

- [ ] Feature placement determined (Feature Placement Guide)
- [ ] ADR created if complex (ADR Template + ADR Process)
- [ ] Scope analysis completed and user-approved
- [ ] Context switches announced explicitly
- [ ] Migrations created in cleanmatex (if needed)
- [ ] RLS policies added in cleanmatex (if new org_* tables)
- [ ] User applied migrations
- [ ] Types regenerated in both projects
- [ ] Integration contract strategy followed
- [ ] cleanmatex implementation follows cleanmatex rules
- [ ] cleanmatexsaas implementation follows cleanmatexsaas rules
- [ ] Both projects build successfully
- [ ] No context violations occurred

---

## 12. Project Quick Reference

| Aspect | cleanmatex | cleanmatexsaas |
|--------|-----------|----------------|
| Purpose | Tenant-facing application | Platform admin console |
| Users | Tenant users | Platform administrators |
| DB Access | Anon key + RLS | Service role key (bypasses RLS) |
| Tenant Scope | Single tenant only | All tenants (cross-tenant admin) |
| Migrations | ✅ Create here | ❌ Never create |
| RLS Policies | ✅ REQUIRED | ❌ Not applicable |
| Query Filtering | ALWAYS by `tenant_org_id` | Only when tenant-specific |
| Port | 3000 | 3001 (web), 3002 (api) |
| CLAUDE.md | `F:/jhapp/cleanmatex/CLAUDE.md` | `F:/jhapp/cleanmatexsaas/CLAUDE.md` |

---

## 13. Port Reference

| Project | Service | Port |
|---|---|---|
| cleanmatex | web-admin (Next.js) | 3000 |
| cleanmatexsaas | platform-web (Next.js) | 3001 |
| cleanmatexsaas | platform-api (NestJS) | 3002 |
| Shared | Supabase API | 54321 |
| Shared | Supabase DB | 54322 |
| Shared | Supabase Studio | 54323 |

---

## 14. Notification HQ Service Auth (Phase B0)

### Service-to-Service Authentication

Internal calls from `cleanmatex` platform-api to `cleanmatexsaas` platform-api (e.g. dispatch proxy) use a **shared Bearer secret**, not a user JWT:

```
Authorization: Bearer <HQ_SERVICE_ROLE_KEY>
```

- `HQ_SERVICE_ROLE_KEY` lives only in `cleanmatexsaas` platform-api env and in `cleanmatex` env (as a caller credential). It is **never** in the database, never in `platform-web`, and never logged.
- Guard: `ServiceRoleGuard` (timing-safe via SHA-256 hash comparison). Fail-closed: returns 503 if the key is not configured rather than allowing open access.
- HQ admin UI calls (JwtAuthGuard) and tenant-runtime calls (TenantRuntimeJwtGuard) are distinct — `ServiceRoleGuard` never accepts JWTs.

### Encryption Key

- `HQ_ENCRYPTION_MASTER_KEY`: base64-encoded 32-byte AES-256-GCM master key. Lives in `cleanmatexsaas` platform-api env only. Used by `EncryptionService` for BYO provider creds stored in `org_ntf_channel_provider_cf.config`. Never stored in DB; never transmitted to `cleanmatex`.
- Envelope format: `{v:1, iv, tag, ct}` (base64-wrapped JSON). The `v` version field enables key rotation without breaking existing ciphertext.

### Audit Logging

All HQ notification operations write to `hq_audit_logs` via `AuditService`:
- `log(entry)` — caller guarantees no secrets in metadata.
- `logSecure(entry)` — strips known secret field names (`apiKey`, `secret`, `password`, `config`, `token`, etc.) before insert. Use for any operation that may have credentials in scope.
- `hq_audit_logs` is HQ-only; no RLS; service-role access only.

### Required Env Vars (cleanmatexsaas platform-api)

| Variable | Purpose |
|---|---|
| `HQ_SERVICE_ROLE_KEY` | Shared secret for S2S auth (ServiceRoleGuard) |
| `HQ_ENCRYPTION_MASTER_KEY` | 32-byte base64 AES key for BYO cred encryption |
| `HQ_RESEND_API_KEY` | Platform Resend API key (PLATFORM dispatch mode — email) |
| `HQ_RESEND_FROM_EMAIL` | Platform sender address for Resend |

### Required Env Vars (cleanmatex — caller side)

| Variable | Purpose |
|---|---|
| `NTF_DISPATCH_VIA_HQ` | `true` to route email sends through HQ dispatch proxy (kill-switch) |
| `NTF_HQ_SERVICE_ROLE_KEY` | Bearer secret for calling HQ dispatch endpoint |
| `NTF_HQ_DISPATCH_URL` | Full URL of HQ dispatch endpoint (default: `http://localhost:3002/api/hq/v1/notifications/dispatch`) |

### Dispatch Proxy Contract (B1)

**Endpoint:** `POST /api/hq/v1/notifications/dispatch`
**Guard:** `ServiceRoleGuard` (Bearer `HQ_SERVICE_ROLE_KEY`)
**Rate limit:** 300 req/min

**Request body:**
```json
{
  "idempotencyKey": "<uuid>",
  "tenantOrgId":   "<uuid>",
  "channel":       "EMAIL",
  "recipient":     "user@example.com",
  "payload":       { "subject": "...", "html": "..." },
  "requestId":     "<optional-uuid>"
}
```

**Response (200):**
```json
{
  "idempotencyKey": "<uuid>",
  "tenantOrgId":   "<uuid>",
  "channel":       "EMAIL",
  "providerCode":  "RESEND",
  "status":        "SENT",
  "providerMessageId": "...",
  "durationMs":    42,
  "cached":        false
}
```

- `cached: true` → idempotency cache hit; no second send was attempted.
- `status` values: `SENT | FAILED | PERMANENT_FAILURE | PENDING`
- **SECURITY:** Response never contains `encrypted_config`, API keys, or any credential.
- Duplicate `idempotencyKey` within 24 h returns cached result without re-sending.

### Governance Endpoints Contract (B1)

**Base:** `/api/hq/v1/notifications/governance`
**Guard:** `JwtAuthGuard` (HQ admin JWT)

| Method | Path | Description |
|---|---|---|
| GET | `/providers` | List all providers |
| GET | `/providers/:code` | Get single provider |
| PATCH | `/providers/:code` | Update provider (is_active, name2) |
| GET | `/channels` | List all channels |
| GET | `/channels/:code` | Get single channel |
| PATCH | `/channels/:code` | Update channel (is_active, name2, description) |
| GET | `/tenant-config` | List all tenant channel configs (read-only) |
| GET | `/tenant-config/:id` | Get single tenant config (read-only) |

- **SECURITY:** `encrypted_config` is never returned by any governance endpoint. The `GovernanceRepository` excludes it from all SELECT queries; `GovernanceService._stripSecrets()` provides double safety.

### Schema Changes (B1 — applied via migrations 0366 + 0367)

**`org_ntf_channel_provider_cf`** (in cleanmatex schema):
- `dispatch_mode TEXT NOT NULL DEFAULT 'PLATFORM' CHECK (dispatch_mode IN ('PLATFORM','BYO'))`
- `encrypted_config TEXT` — AES-256-GCM envelope for BYO provider creds; NULL for PLATFORM rows

**`org_ntf_usage_daily`** (in cleanmatex schema):
- `currency_code TEXT NOT NULL DEFAULT 'USD'`
- Natural-key index rebuilt to include `currency_code`

**`hq_ntf_dispatch_log`** (HQ-only, no RLS):
- Idempotency/dedupe table; `idempotency_key TEXT UNIQUE`
- Status lifecycle: `PENDING → SENT | FAILED | PERMANENT_FAILURE`
- `recipient_hash TEXT` — SHA-256 only; plaintext recipient never stored

---

## 16. Workflow Engine Config — HQ Endpoints

**Base:** `/api/hq/v1/workflow-engine-config`  
**Module:** `cleanmatexsaas/platform-api/src/modules/workflow-engine-config/`  
**Swagger tag:** `Workflow Engine Config` (HQ local: `http://localhost:3002/api/docs`)  
**Full reference:** `cleanmatexsaas/docs/features/SAAS_Platform_Management/Workflow_Engine_HQ/apis.md`

### 16.1 Ownership

| Concern | Owner | Consumer |
|---|---|---|
| `sys_wf_*` global catalogs | `cleanmatexsaas` (HQ UI + API) | `cleanmatex` WorkflowEngine (read) |
| `sys_wf_profiles_*` + `org_wf_profile_assign_cf` | `cleanmatexsaas` | `cleanmatex` effective profile resolution |
| Legacy `sys_workflow_template_*`, `org_tenant_workflow_*` | `cleanmatexsaas` | `cleanmatex` until V2 cutover |
| `org_ord_screen_contracts_cf` | `cleanmatexsaas` (system + tenant override) | `cleanmatex` worklist / ActionBar |
| Migrations | `cleanmatex` only | `cleanmatexsaas` regenerates types |

**cleanmatex MUST NOT** mutate `sys_wf_*`, profile, or assign tables from tenant admin UI. Runtime reads only.

### 16.2 Endpoint groups

| Group | Paths | Notes |
|---|---|---|
| V2 catalogs | `/statuses`, `/screens`, `/screen-status`, `/actions`, `/transitions`, `/action-maps`, `/gates`, `/initial-rules`, `/screen-contracts` | Soft-deactivate; code fields immutable after create; new transitions/action-maps default inactive until explicitly activated (validate gate) |
| Tools | `POST /validate`, `POST /simulate`, `POST /effective-preview` | Simulate and effective-preview accept optional `tenant_org_id`, `branch_id`, `service_code` |
| Legacy | `/presets`, `/legacy-assignments/*` | Template assign default uniqueness per tenant |
| V2 profiles | `/profiles`, `/profile-assignments` | Publish requires validate green; published versions immutable (409) |

### 16.3 Tenant consumption pattern

- **Effective profile:** HQ `POST /effective-preview` mirrors `cleanmatex/web-admin/lib/services/workflow-profile.service.ts` assign scoring.
- **Feature flag:** `workflow_engine_v2` — when off, tenant stays on legacy template path; HQ writes remain safe.
- **OpenAPI:** Export from HQ Swagger for approved-list / effective-profile consume contracts when tenant HQ API wiring is implemented.

### 16.4 Auth & audit

- **Auth:** `JwtAuthGuard` on all endpoints today; indicative permissions `hq_wf:read|catalog|preset|draft|validate|publish|assign` (see HQ `permissions.md`).
- **Audit:** All mutations log via HQ `AuditService` with `sourceModule: workflow-engine-config`; assign rows include `tenantOrgId`.

---

## 17. Cash-control settings and currency catalogs (POS Session & Cash Drawer Hardening)

- **Currency / denomination catalogs are HQ-owned, tenant-consumed.** `sys_currency_cd`, `sys_currency_rounding_rules_cf` and `sys_currency_denominations_cd` are managed in `cleanmatexsaas` (and seeded by this project's migrations because this project owns all migrations). The tenant app only **reads** them. A tenant's own choices are sparse overrides in tenant tables: `org_currency_cf` (which currencies it uses) and `org_currency_denom_cf` (which notes/coins it counts, and their grid order). HQ data is never edited from the tenant app.
- **Cash-control settings are the deliberate exception to "settings come from the HQ API".** The `cash_*`, `pos_session_*`, `variance_*`, `opening/closing_count_mode`, `shared_session_mode` and `shift_z_report_required` settings live in the finance-owned, tenant-scoped table `org_fin_cash_ctrl_stng_cf` (ADR-056) with their own scope ladder (drawer → user → branch → tenant → default) and audit trail, because they gate posting inside a finance transaction and need row-level scope. Do not query that table directly: use `getCashControlSettings` / `updateCashControlSettings` only. `sys_stng_*` is still consumed through the HQ API.
- **Notification events** `pos_session.stale` and `pos_session.rolled_over` are catalog rows in `sys_ntf_*` registered by this project's migration 0558; HQ can edit their templates through the Notification Hub catalog.
- **Navigation / permissions:** every screen of this program is dual-written (`config/navigation.ts` + `sys_components_cd`); no permission code is HQ-defined.

## 18. User Session Lifecycle (sign-in identity, session policy, revocation)

**Owner of tables/functions:** this project (migrations 0561, 0563, 0568, 0570, 0573, 0575, 0576, 0577, 0581, 0584, 0585). HQ consumes them with the service-role client; it never creates migrations.

| Concern | Contract |
|---|---|
| Sign-in identity | `org_users_mst.user_code` is globally unique, case-insensitive (`^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$`) and auto-generated when omitted (`fn_org_user_code_next()`). One auth account per membership (`UNIQUE(user_id)`). |
| HQ user creation | `POST /tenants/:id/users` accepts optional `user_code` and optional `email`. Without an email the Supabase login is the synthetic `<user_code lower-cased>@users.invalid` and `org_users_mst.email` stays NULL. Keep `user_metadata.tenant_org_id` (legacy readers). |
| Admin password reset | HQ first checks the candidate against the tenant's effective policy (strength items + `fn_auth_pwd_reuse_check(auth_user_id, password, history_count)` + breached-password check), then `auth.admin.updateUserById`, then sets `org_users_mst.pwd_must_change` (filtered by `tenant_org_id`), then calls `fn_auth_sessions_revoke(p_auth_user_id, p_tenant_org_id, 'PASSWORD_CHANGED', NULL, p_actor)` (service_role only; `p_actor` must be a uuid or omitted). A failed revoke is reported to the admin. A password is never emailed: `notify_user` sends a notice only, `POST …/password-link` sends a one-time `{TENANT_APP_URL}/auth/confirm?token_hash=…` link. |
| Password history & policy | `sys_auth_pwd_history_dtl` is filled by trigger `trg_auth_pwd_capture` on `auth.users` (any writer, tenant app or HQ); `fn_auth_pwd_reuse_check` is service_role only. Policy items are the `PASSWORD` group of the config catalog (`AUTH_PWD_REQUIRE_CURRENT`, `AUTH_PWD_FRESH_SIGNIN_MIN`, `AUTH_PWD_HISTORY_COUNT`, `AUTH_PWD_BREACH_CHECK` — the last is platform-only). |
| Unlock / forced change | `POST /tenants/:id/users/:userId/unlock` calls the lockout unlock function and writes `ACCOUNT_UNLOCKED`; `pwd_must_change` makes the tenant app redirect to `/change-password` and reject API calls with 403 `PASSWORD_CHANGE_REQUIRED`. HQ audit events carry `details.actor_type = HQ`. |
| Deactivation | HQ only flips `org_users_mst.is_active`; the DB trigger ends the user's sessions. Hard delete cascades through `auth.users`. |
| Policy catalog | `sys_auth_admin_config_cf` (HQ edits value, bounds, `is_allow_tenant_change`) and `org_auth_admin_config_cf` (tenant overrides, soft-deactivated to reset). DB triggers validate type/bounds and the allow switch; `fn_auth_config_effective(tenant)` resolves value + source (service_role only). HQ endpoints: `/api/hq/v1/auth-config/*` (permissions `auth_config.view` / `auth_config.manage`). |
| Plan gate | Tenant admins may edit overrides only with plan flag `session_timeout_control` (+ `auth_config:update`). HQ is not gated. Clearing a tenant's overrides after a plan downgrade is an explicit HQ action (`POST /auth-config/tenants/:id/overrides/clear-without-plan`); it is **not** wired into plan-change/renewal code (billing behavior needs separate approval). |
| Audit | Auth events go to `sys_auth_audit_log` (append-only); HQ changes are additionally written to `hq_audit_logs` via `AuditService`. |

## Update Log

| Date | Change | Author |
|---|---|---|
| 13-05-2026 | Initial creation — migrated cross-project protocol from both CLAUDE.md files to Option B structure | Jh |
| 16-06-2026 | §14 added — Notification HQ Service Auth contracts (B0: ServiceRoleGuard, EncryptionService, AuditService, hq_audit_logs) | Claude |
| 16-06-2026 | §14 extended — B1 dispatch proxy + governance contracts, schema changes (0366+0367), env var table updated | Claude |
| 14-08-2026 | §16 added — Workflow Engine Config HQ endpoints, ownership, tenant consume notes (synced from cleanmatexsaas) | Claude |
| 08-10-2026 | §18 added — User Session Lifecycle contracts (user_code, synthetic email, session revoke on password reset, auth config catalog/overrides, plan gate) | Claude |
| 09-10-2026 | §18 extended — password management (policy check before HQ reset, history trigger, forced change, link/notice, unlock; migrations 0581/0584/0585). Also repaired a corrupted copy of this file (a full duplicate of §1–§17 had been pasted into the §18 table by a bad replace) | Claude |
