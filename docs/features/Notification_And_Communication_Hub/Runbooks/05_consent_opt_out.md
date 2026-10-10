# Runbook 05 — Consent / Opt-Out

**Status: Partial.** Dispatch-time consent recheck exists for WhatsApp (opt-in) and EMAIL/SMS (opt-out); PUSH has no customer consent model by design (its recipients are staff/app users, not customers). There is no bounce/complaint/opt-out-number suppression-*list* table anywhere in the schema.

## Purpose

Confirm, diagnose, and (where applicable) change whether a tenant customer will receive a notification on a given channel, and understand exactly which consent model governs which channel.

## Preconditions / permissions

- Reading/editing a customer's notification preferences uses the existing customer detail "Preferences" screen and its API (`customers:read`/`customers:update`, tenant-guarded).
- No special HQ permission is needed — this is entirely tenant-side (`web-admin`).

## Channel-by-channel model (verified in code)

| Channel | Model | Where enforced | File |
|---|---|---|---|
| WHATSAPP | **Opt-in.** Customer must explicitly set `preferences.notifications.whatsapp = true`. | Rechecked fresh at dispatch, every send. | `web-admin/lib/notifications/whatsapp-customer-eligibility.ts` |
| EMAIL | **Opt-out.** Sends unless `preferences.notifications.email === false` exactly. Absent/`true`/anything else ⇒ sends (preserves pre-existing behavior for customers who never touched the toggle). | Rechecked fresh at dispatch. | `web-admin/lib/notifications/customer-dispatch-consent.ts`, wired into `adapters/email.ts` |
| SMS | Same opt-out model as EMAIL. | Rechecked fresh at dispatch. | Same file, wired into `adapters/sms.ts` |
| PUSH | **No customer consent model.** Recipients are staff/app users via `org_ntf_push_subs_dtl` device subscriptions, not tenant customers. Its existing subscription-active/failure-count model serves the equivalent role. | N/A (reviewed and intentionally unchanged, per STATUS.md 2026-10-09). | — |
| Campaigns (marketing) | Separate `marketing_consent` flag checked during Phase B dispatch. | `app/api/notifications/process-campaigns/route.ts` (header comment: "check marketing_consent → enqueue outbox or skip"). | — |

## Operator steps — diagnose why a customer did/didn't receive a message

1. Identify the order/source entity and `tenant_org_id` for the notification in question.
2. Query the customer's current preference JSON:
   ```sql
   SELECT id, preferences FROM org_customers_mst
   WHERE tenant_org_id = '<tenant_org_id>' AND id = '<customer_id>';
   ```
3. For WhatsApp: confirm `preferences.notifications.whatsapp` is exactly `true` — anything else (missing, `false`, `null`) blocks the send by design (opt-in).
4. For EMAIL/SMS: confirm `preferences.notifications.<channel>` is **not** exactly `false` — `true`, missing, or any other value sends; only an explicit `false` blocks.
5. Cross-check the outbox row's outcome: `SELECT status, skip_reason, error_message FROM org_ntf_outbox_dtl WHERE id = '<outbox_id>' AND tenant_org_id = '<tenant_org_id>';` — a consent block records `SKIPPED` (non-retryable) or `FAILED_TEMPORARY` (retryable lookup failure, e.g. a transient DB error), never a silent drop.

## Operator steps — change a customer's consent

- Use the existing customer detail Preferences editor in the dashboard, or `PATCH` the customer preference API (plan section 13: "Existing WhatsApp opt-in/revoke control retained; approved channel-purpose consent expansion uses the same merge-safe API"). This is a tenant-side, existing, preserved surface — not new work from this plan.

## Expected outcomes

- A consent-blocked send never silently vanishes: it is always a recorded `SKIPPED` or retryable `FAILED_TEMPORARY` outbox row with an explicit reason string referencing the channel and consent state.
- Revoking consent after a notification is already queued is respected — both consent checks re-read fresh at actual dispatch time, not at enqueue time (invariant 4.1.12).

## Known gaps (explicit, not invented)

- **No bounce/complaint/opted-out-number suppression-*list* table exists** anywhere under `supabase/migrations` as of migration `0598` — confirmed by both the plan (section 11.2) and `customer-dispatch-consent.ts`'s own doc comment. Only the single per-customer preference boolean is enforced; email bounce/complaint suppression and SMS carrier opt-out codes are **not implemented**.
- Consent enforcement only applies when the outbox row is tied to a tenant customer via `source_entity_type === 'order'`. Staff-targeted notifications and the legacy EMAIL fallback-to-auth-user path (an order with no `customer_id`) have no consent gate — this is intentional, not a bug, because there is no customer to check consent for.

**Last verified against source:** 2026-10-10 (`customer-dispatch-consent.ts`, `whatsapp-customer-eligibility.ts`, `process-campaigns/route.ts`).
