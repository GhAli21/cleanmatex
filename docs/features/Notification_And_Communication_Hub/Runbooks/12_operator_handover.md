# Runbook 12 — Operator Handover

**Status: Not implemented as a dedicated artifact — this is the first one.** No standing handover checklist for the Notification & Communication Hub existed anywhere in either repo before this set was written. This file, together with the other 11 runbooks and the [index](./index.md), is intended to become that packet.

## Purpose

Give an incoming operator (or an on-call engineer who has never touched this feature) everything needed to understand current state, current gaps, and where to look next — without re-deriving it from source.

## What to hand over

### 1. Read in this order

1. [`index.md`](./index.md) — the status table for all 12 topics.
2. [`notification-hub-production-implementation-plan.md`](../notification-hub-production-implementation-plan.md) — canonical planning authority; sections 2 (ownership), 8 (durable runtime), 11 (authz/privacy), 21 (observability/runbooks), 26 (provider coverage map) are the densest.
3. [`STATUS.md`](../STATUS.md) — more precise and current than the plan's prose in places; its dated entries are the actual delivery record. Its own header states: *"The current implementation authority is the plan... the dated entries below are historical delivery records."* When the two disagree (see Runbook 11's discrepancy), treat STATUS.md's code-backed claims as more trustworthy and flag the plan as needing an update rather than trusting either blindly.
4. This Runbooks folder, topic by topic, especially the "Known gaps" sections — those are the honest inventory of what is *not* safe to assume works.

### 2. Permission codes in active use (verified, not aspirational)

- Tenant (`web-admin`): `notifications:read`, `notifications:manage`, `notifications:view_log`, `notifications:configure` — used directly as string literals passed to `requirePermission(...)` across `web-admin/app/api/v1/notifications/**`. `notifications:send_test` is named in the plan but not found enforced anywhere in the current route tree (Runbook 06 discrepancy).
- HQ (`platform-api`): `hq_notifications:read` (class-level default on every notifications-hq controller examined — connections, senders, routes, provider-templates) and `hq_notifications:manage` (method-level override for every write/verify/import/bind/activate action). Enforced by `HqPermissionGuard` + `JwtAuthGuard`.

### 3. Environment variables an operator must know about

| Variable | Where used | Purpose |
|---|---|---|
| `NOTIFICATIONS_OUTBOX_SECRET` | `process-outbox`, `reconcile-outbox`, `process-campaigns` routes (tenant) | Shared bearer secret authorizing internal scheduler-only calls; also stored as the `app.outbox_secret_key` Postgres GUC read by the pg_cron jobs. |
| `NTF_QUEUE_ENABLED` | `dispatch.service.ts` (HQ) | Deploy-time switch between BullMQ-queued and synchronous HQ dispatch. |
| `NTF_TWILIO_CONTENT_CREDENTIAL_REF` / `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` | Twilio import flow (HQ) | Must exactly match the platform account's stored `credential_ref`/`credential_version`, or import/verify fails closed (Runbooks 01/03). |
| `HQ_TWILIO_ACCOUNT_SID` / `HQ_TWILIO_AUTH_TOKEN` | HQ deployment secret injection | Backs the platform Twilio account's live verification and import calls. |
| `HQ_TWILIO_WEBHOOK_URL` | Twilio callback verification | Must equal the exact HTTPS URL registered in Twilio, or callbacks are rejected before persistence (per STATUS.md 2026-10-03 P1 entry). |
| `HQ_ENCRYPTION_MASTER_KEY` | `EncryptionService` (HQ) | Backs AES-GCM encryption for tenant-private credential envelopes (`org_ntf_prov_cred_mst`). |

### 4. The single most important thing a new operator must understand

**The new route-based delivery system (provider accounts, senders, immutable template revisions/bindings, and the full route lifecycle — Runbooks 01–04) is fully built and API/UI-complete, but it is wired SHADOW-ONLY.** It does not send anything to any customer today. The only thing actually sending WhatsApp messages to customers right now is the original, pre-plan, direct-Twilio `order.created` path. Do not assume that activating a route, verifying an account, or completing a binding changes live customer-facing behavior — it does not, until an explicit, separately-gated cutover (plan section 22 step 5) happens. This single fact resolves most "why didn't my change do anything" confusion.

### 5. Standing operational gaps to disclose to any new owner (cross-referenced)

| Gap | Runbook |
|---|---|
| No pg_cron schedule for reconciliation; must be invoked manually | 07 |
| No reconciliation lookup for META_WHATSAPP/EMAIL/SMS/PUSH — dead-letters only | 07 |
| No incident pause/drain control; manual config toggles + cron unschedule only | 08 |
| No provider-outage health signal or failover; only one live route per channel exists | 09 |
| No restore drill or retention/cleanup job of any kind for notification tables | 10 |
| No pre-send quota reservation; cross-command race not fully closed | 11 |
| No provider-invoice billing reconciliation | 11 |
| No sender-level live verification for any provider | 02 |
| No non-Twilio template importer (Meta, etc.) | 03 |
| No generic preview/test-send API outside one campaign-scoped test route | 06 |

### 6. Who to ask / where decisions are pending

The plan's section 23 ("Decisions and follow-ups with explicit gates") lists every unresolved architectural decision with its required gate — retention/residency/compliance policy, quota/charge-timing accounting policy, capacity/SLO thresholds, and the shared-implementation-package question all remain open and require explicit business/owner sign-off, not an engineering default. Hand this table to whoever is accountable for signing off on production rollout.

## What this runbook is not

This is not an incident response contact list or an on-call rotation document — no such roster exists in either repo's documentation, and this task does not invent one. If the organization needs a literal "who do I call" list, that is a separate, explicitly-scoped addition.

**Last verified against source:** 2026-10-10 (cross-references Runbooks 01–11, `STATUS.md`, and the plan; permission/env-var claims verified directly against the route/service files cited in each).
