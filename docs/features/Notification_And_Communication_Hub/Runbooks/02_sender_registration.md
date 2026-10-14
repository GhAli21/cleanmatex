# Runbook 02 — Sender Registration

**Status: Implemented (R5, 2026-10-14).** Sender CRUD (platform and tenant-private) is tenant/channel-scoped, and a sender can now be live-verified with the provider. `verification_state` still cannot be set through any create/update DTO — it changes only through the verify action.

## Purpose

Register a sender identity (WhatsApp phone/sender ID, SMS originator, email From address, etc.) bound to an already-created provider account, so a route can later select a compatible account+sender pair.

## Preconditions / permissions

- HQ operator JWT with `hq_notifications:read` (list) or `hq_notifications:manage` (create/update).
- Guarded by `JwtAuthGuard` + `HqPermissionGuard` on `platform-api/src/modules/notifications-hq/provider-accounts/provider-senders.controller.ts`.
- The owning provider account must already exist (Runbook 01) — `createPlatformSender`/`createPrivateSender` validate the account exists and that `account.channel_code === dto.channel_code` before insert.

## Operator steps — platform sender

1. List (optionally filtered): `GET /notifications/senders?accountId=<id>` (perm: `hq_notifications:read`).
2. Create: `POST /notifications/senders` (perm: `hq_notifications:manage`) with `account_id`, `channel_code`, `sender_key`, `external_sender_id`, `sender_address` (optional), `sender_kind`, `name`.
   - Implementation: `ProviderAccountsService.createPlatformSender` (`provider-accounts.service.ts:154`). Audit event `notification_sender.create_platform` is written on `sys_ntf_prov_send_mst`.
3. Update descriptive/capability fields or deactivate: `PATCH /notifications/senders/:id` (perm: `hq_notifications:manage`), e.g. `{"is_active": false}` to retire a sender without deleting its history.
4. **Verify live** (after the owning account is VERIFIED — Runbook 01):
   - HQ UI: **Notifications → Providers/Connections → select the account → Senders → Verify live** on the sender row.
   - API: `POST /notifications/senders/:id/verify` (platform) or `POST /notifications/senders/tenants/:tenantOrgId/:id/verify` (tenant-private); perm `hq_notifications:manage`.
   - What is checked: Twilio SMS — the number is an incoming number of the account and SMS-capable, or the Messaging Service exists with at least one sender; Twilio WhatsApp — the sender is registered and `ONLINE`; Resend email — the sender domain (or its parent) is `verified`.
   - Result: `VERIFIED` only on positive provider evidence. Otherwise HTTP 409 with the provider status (e.g. `NOT_FOUND`, `OFFLINE`, `SMS_NOT_CAPABLE`) and nothing changes — except that a sender that was `VERIFIED` and is no longer usable is moved to `SUSPENDED`. Re-run after fixing it at the provider.
   - Audit events: `notification_sender.verify`, `notification_sender.suspend_on_verify` (provider status only; no credentials).

## Operator steps — tenant-private sender

1. List: `GET /notifications/senders/tenants/:tenantOrgId?accountId=<id>` (perm: `hq_notifications:read`).
2. Create: `POST /notifications/senders/tenants/:tenantOrgId` (perm: `hq_notifications:manage`), same body shape bound to a tenant-private account.
3. Update: `PATCH /notifications/senders/tenants/:tenantOrgId/:id` (perm: `hq_notifications:manage`).
4. Verify live: `POST /notifications/senders/tenants/:tenantOrgId/:id/verify` (perm: `hq_notifications:manage`) — decrypts the tenant credential server-side (Twilio only); same fail-closed rules as above.

## Expected outcomes

- Success: sender row created/updated in `sys_ntf_prov_send_mst` (platform) or the tenant-private equivalent; audit event recorded.
- Failure modes verified in code: `NotFoundException` if the owning account doesn't exist; `ConflictException` if `channel_code` mismatches the account, or on a concurrent-edit version conflict.

## Rollback / abort guidance

- Deactivate (`is_active: false`) rather than delete, to preserve route/binding history that may still reference the sender.

## Known limits

- Meta Cloud API senders and tenant-private Resend (BYO) senders have no verification connector; the verify action rejects them (409) rather than marking them verified. Confirm those out-of-band.
- Provider response shapes follow the documented Twilio Senders / IncomingPhoneNumbers / Messaging Services APIs and the Resend Domains API. **Operator: click Verify live once on a real SMS sender and a real WhatsApp sender** and report any unexpected 409 — the WhatsApp Sender API status vocabulary is the most likely thing to need adjustment. The Twilio WhatsApp *sandbox* number is not in the Senders API and will correctly stay unverified.
- A sender whose owning account is not VERIFIED, or that is REVOKED, cannot be verified.

**Last verified against source:** 2026-10-14 (`provider-senders.controller.ts`, `provider-accounts.service.ts`, `sender-verifier.service.ts`).
