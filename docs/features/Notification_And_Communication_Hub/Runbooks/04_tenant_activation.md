# Runbook 04 — Tenant Activation (Route Lifecycle)

**Status: Partial — API/UI complete, but SHADOW-ONLY.** The full route lifecycle (create DRAFT → activate → suspend → retire) is implemented end-to-end with UI wiring. Critically, **activating a route today does not change what is actually sent to any customer.** The legacy direct-Twilio path remains the only thing that sends; the new route-based resolver only runs in a shadow comparison that logs, never sends.

## Purpose

Assign a tenant to a specific, immutable, verified provider/account/sender/template-revision/binding combination for one `(event, channel, language)` tuple, and move that assignment through its lifecycle.

## Preconditions / permissions

- HQ operator JWT with `hq_notifications:read` (list) or `hq_notifications:manage` (create/update/activate/suspend/retire).
- Guarded on `platform-api/src/modules/notifications-hq/routes/notification-routes.controller.ts`, mounted at `notifications/tenants/:tenantOrgId/routes`.
- The referenced account, sender, and template revision must already be verified/bound (Runbooks 01–03) — `activate` checks provider evidence, sender compatibility, and template locale/event/channel/language agreement before allowing `ACTIVE`.

## Operator steps

1. List existing routes for a tenant: `GET /notifications/tenants/:tenantOrgId/routes` (perm: `hq_notifications:read`).
2. Create a complete route in `DRAFT`: `POST /notifications/tenants/:tenantOrgId/routes` (perm: `hq_notifications:manage`). Mixed platform/private resource selections (e.g. a platform account with a private sender) are rejected before persistence.
3. Edit the draft if needed: `PATCH /notifications/tenants/:tenantOrgId/routes/:id` (perm: `hq_notifications:manage`) using optimistic version checking (`expected_version` conflicts return a version-mismatch error, not a silent overwrite).
4. Activate: `POST /notifications/tenants/:tenantOrgId/routes/:id/activate` with `{"expected_version": <n>}` (perm: `hq_notifications:manage`).
   - Implementation: `NotificationRoutesService.activate` (`notification-routes.service.ts`). Validates optimistic version, immutable provider evidence, sender compatibility, template locale/event/channel/language agreement, and binding-count agreement before setting `ACTIVE`.
5. Suspend without discarding configuration: `PATCH /notifications/tenants/:tenantOrgId/routes/:id/suspend` with `{"expected_version": <n>}` (perm: `hq_notifications:manage`).
6. Retire permanently (removes from future dispatch selection): `PATCH /notifications/tenants/:tenantOrgId/routes/:id/retire` with `{"expected_version": <n>}` (perm: `hq_notifications:manage`).
7. **UI path:** the Tenant Configuration screen's "Routes" dialog (per STATUS.md 2026-10-09) exposes create/edit/activate/suspend/retire, reusing the provider-template registration/revision discovery hooks for revision selection, and enforces the platform/private mutual-exclusivity guard client-side in addition to the server check.

## Expected outcomes

- Success: route row status transitions `DRAFT → ACTIVE → SUSPENDED/RETIRED`; every mutation is audit-logged; every `org_*` read/write includes an explicit `tenant_org_id` predicate (confirmed in the controller/service).
- **Even after a successful `activate`, no live customer-facing send behavior changes today.** `web-admin/lib/notifications/route-resolver.ts` (`ResolveEffectiveNotificationRoute`) reads the single ACTIVE row for an explicit `(tenant, event, channel, language)` tuple and returns the pinned identity or a distinct `NO_ACTIVE_ROUTE`/`LOOKUP_ERROR` — but it is wired **SHADOW-ONLY** for `order.created → WHATSAPP` via `web-admin/lib/notifications/shadow-route-comparison.ts`, which calls the resolver *in addition to, never instead of*, the existing direct-Twilio path inside `deliverWhatsAppOutbox` (`adapters/whatsapp.ts`). It never sends, never reserves/charges quota, never touches the outbox claim/lease machinery a second time, and any internal failure in the shadow comparison is swallowed so the legacy send is unaffected. The comparison result is a single structured `logger.info`/`logger.warn` line (`feature: 'notifications', shadow: true`) — not a database table.

## Rollback / abort guidance

- `suspend` is the safe, reversible stop for a route that was never actually live (since nothing is live yet) or, after a future cutover, for pausing one tenant/event/channel without touching any other tenant's routes.
- A failed `activate` call (version conflict, incompatible binding, unverified account) leaves the prior route state untouched — no partial activation is possible by construction (the DB function validates everything before flipping status).

## Known gaps (explicit, not invented) — before any real cutover

1. **No recipient-language signal exists** anywhere in the current legacy event-emitter/orchestrator/outbox-row contract — confirmed absent. The shadow comparison therefore lists every language with an ACTIVE route for the tuple and compares each, rather than guessing a recipient language (per invariant "no default locale").
2. **No preview/test-send rendering uses the route resolver yet** — Runbook 06 (Safe test) only exercises the legacy campaign test path.
3. **No recorded pilot evidence or explicit cutover gate has been executed** (plan section 22 step 5 — "Activate a controlled tenant/event/channel cohort").
4. **Only one live route per channel exists today (the legacy direct-Twilio path)** — there is no tooling yet to actually switch a tenant's live traffic onto the resolved route, which is why Runbook 09 (Provider outage) cannot offer a "switch provider" procedure.

**Last verified against source:** 2026-10-10 (`notification-routes.controller.ts`, `route-resolver.ts`, `shadow-route-comparison.ts`, STATUS.md 2026-10-09 entries).
