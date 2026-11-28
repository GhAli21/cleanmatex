# Customer App Orders — Status

**Last updated:** 2026-11-27

## Current phase

Phase 1 — Database and authorization foundation (migration review gate).

## Phase 0 task log

| Task | State | Date | Outcome and evidence | Remaining proof/risk |
|---|---|---|---|---|
| 1. Read remote database definitions | Complete | 2026-11-27 | Read-only linked query verified global `sys_customers_mst`, tenant `org_customers_mst`, branches, and orders; migration history connection succeeded through `supabase migration list --linked`. | RLS policy definitions and dependent catalogs remain part of migration-design review. |
| 2. Record composite-key order | Complete | 2026-11-27 | Remote constraints confirm `org_customers_mst` unique `(tenant_org_id, customer_id)` and `(id, tenant_org_id)`; orders/branches use tenant-safe composite keys where scoped. | Exact request-table FK order will be designed against these verified parent keys. |
| 3. Trace current runtime paths | Complete | 2026-11-27 | Traced public password login, password-setting, tenant lookup, customer dashboard, and access contract. Current login is tenant-first, returns no protected-session bearer token, and public lookup logs identity values and returns all active branches. | New contracts must replace rather than extend these unsafe paths. |
| 4. Decide legacy credential handling | Complete | 2026-11-27 | Chosen approach: retire tenant-scoped password authority for mobile sign-in; do not merge tenant hashes into a global credential because salted hashes cannot prove a shared password. Existing users enter controlled global reset/activation. Decision recorded in `DESIGN.md`. | Migration must preserve the old fields only as non-authoritative legacy data until separately retired. |
| 5. Update feature-pack status | Complete | 2026-11-27 | Phase 0 findings, decision, evidence boundary, and phase completion recorded in this file and `PLAN.md`. | Phase 1 begins with a migration draft only; user application/review remains required. |

## Phase 1 task log

| Task | State | Date | Outcome and evidence | Remaining proof/risk |
|---|---|---|---|---|
| 1. Create foundation migration draft | Complete | 2026-11-27 | Owner applied `supabase/migrations/0854_customer_app_order_foundation.sql` locally and remotely, regenerated database types in both repositories, and pulled Prisma. A read-only remote query confirms the Customer App credential columns. | Applied request/session tables still need targeted remote catalog verification and runtime API proof. |
| 2. Add credentials and request permissions | Applied; runtime pending | 2026-11-27 | Owner confirmed all current migration files were applied locally and remotely. The migration seeds `customers:manage_credentials`, `order_requests:read`, and `order_requests:convert`. | Role-default assignment, effective-permission rebuild, and API/server-action enforcement remain pending. |
| 3. Define controlled request vocabulary | Applied; API mapping pending | 2026-11-27 | The applied schema constrains Phase 1 request type/source/status, verification, and collection values at the database boundary. | Customer-safe API mapping and future catalog governance remain pending. |
| 4. Define credential and session behavior | In progress | 2026-11-27 | Applied schema supports temporary-password expiry, failed-attempt counts, lockout instants, session-version invalidation, hashed opaque sessions, and explicit revocation reasons. | Exact lifetimes, retry thresholds, hashing implementation, cleanup job, and service logic are being implemented in Phase 2. |
| 5. Update Phase 1 status | Complete | 2026-11-27 | Recorded application confirmation, regenerated type/schema evidence, and remaining runtime boundary. | Database application was performed by the owner; API/browser/device proof is pending. |

## Phase 2 task log

| Task | State | Date | Outcome and evidence | Remaining proof/risk |
|---|---|---|---|---|
| 1. Replace tenant-first credential lookup | In progress | 2026-11-27 | Added the parallel global `POST /api/v1/public/customer/auth/login` contract. It accepts E.164 country-code/mobile or normalized email and never accepts a tenant identifier. | Mobile client and legacy tenant-first routes have not yet been migrated or retired. |
| 2. Global session lifecycle | In progress | 2026-11-27 | Added opaque access/refresh token issuance, one-use refresh rotation, generic credential failure, five-attempt 15-minute lockout, 24-hour temporary-password expiry, forced change, session-version invalidation, logout, and staff reset. `POST /api/v1/customers/[id]/customer-app-password` is CSRF-protected and requires `customers:manage_credentials`; it returns a new six-digit value exactly once. Targeted ESLint has no errors; `tsc --noEmit` passed. | Automated behavior tests, cleanup of expired sessions, deployment Node 24 runtime confirmation, and device proof remain pending. |
| 3. Membership and branch eligibility APIs | Migration review pending | 2026-11-27 | Added forward-only draft `0856_customer_app_membership_read.sql` for a service-role-only membership projection, replacing unauthenticated phone lookup. It returns only relationships for the already-authenticated global customer plus tenant-scoped active/history counts. | Owner review/application, regenerated types, authenticated API implementation, and branch eligibility proof remain pending. |
| 4. Customer hide/unhide API | Not started | 2026-11-27 | No change. | Requires an authenticated membership resolution contract. |
| 5. Remove identity values from logs | In progress | 2026-11-27 | The new global-auth service deliberately logs only action and customer UUID where needed, never mobile/email/password/token values. | Legacy tenant-discovery and password services still log identity data and must be retired/refactored with their callers. |
| 6. Update Phase 2 status | In progress | 2026-11-27 | Recorded actual API contract, static verification, and unresolved security/deployment proof. | Phase remains incomplete. |

## Phase 3 task log

| Task | State | Date | Outcome and evidence | Remaining proof/risk |
|---|---|---|---|---|
| 1. Add customer-detail credential action | In progress | 2026-11-27 | Added the permission-gated Create or reset app password action to the existing customer-detail page. It confirms the security impact, shows the six-digit value once in component memory, provides EN/AR text, and sends CSRF plus stale-Organization protection. Focused Cmx UI review reports 0 errors and 0 warnings; i18n parity passed. | Browser proof, role assignment, and live endpoint proof remain pending. Repository-wide `check:ui` still fails on two unrelated ERP Lite raw-form violations. |
| 2. Add request handoff UI | Not started | 2026-11-27 | No change. | Depends on authenticated customer request/membership APIs. |
| 3. Configure access contract | In progress | 2026-11-27 | A dry-run access-contract derive found the new customer password route but cannot infer its POST method/permission from the dynamic feature API client. | The existing customer access-contract file is already dirty outside this feature; reconcile the generated contract without overwriting concurrent work. |

## Mandatory update protocol

After every numbered task in `PLAN.md`, update this file before beginning the next task. Each entry must state phase/task, date, state, changed artifacts, actual validation evidence, unresolved risk, and whether database/browser/device/deployment proof remains pending. A task is not complete merely because code or a migration draft exists.

| Phase/task | State | Date | Outcome and evidence | Remaining proof/risk |
|---|---|---|---|---|
| Plan pack creation | Complete | 2026-11-27 | Plan/design/testing/status pack created; `git diff --check` passed. | No implementation evidence; all phases remain unstarted. |

## Completed

- Documented approved product direction for global customer credential, email-or-phone login, customer-controlled tenant visibility, branch availability, Fast Quick Drop requests, staff conversion, and request/order tracking.
- Identified existing repository evidence: global `sys_customers_mst`, tenant `org_customers_mst`, existing Quick Drop order fields, and current tenant-first customer password implementation conflict.

## Not started

- Dashboard UI.
- Mobile implementation.
- Automated and device validation.

## Blocking decisions before later phases

1. Temporary PIN maximum lifetime and retry/lockout policy.
2. Whether active-order tenants may be hidden immediately or only after closure.
3. Branch assignment policy when the customer does not choose a branch.
4. Request status catalog ownership and which staff roles can convert a request.
5. Whether a request can ever create more than one order. Current proposal is exactly one.

## Verification boundary

The Phase 1 migration was applied by the owner. The new global-auth API has only static verification (`eslint` with zero errors and `tsc --noEmit`); no integration test, browser/runtime, mobile device, deployment, or token-cleanup proof has been recorded yet.
