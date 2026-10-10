# Runbook 02 — Sender Registration

**Status: Partial.** Sender CRUD (platform and tenant-private) is implemented and tenant/channel-scoped. There is no live sender verification connector in this increment — `verification_state` cannot be changed through any exposed DTO.

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

## Operator steps — tenant-private sender

1. List: `GET /notifications/senders/tenants/:tenantOrgId?accountId=<id>` (perm: `hq_notifications:read`).
2. Create: `POST /notifications/senders/tenants/:tenantOrgId` (perm: `hq_notifications:manage`), same body shape bound to a tenant-private account.
3. Update: `PATCH /notifications/senders/tenants/:tenantOrgId/:id` (perm: `hq_notifications:manage`).

## Expected outcomes

- Success: sender row created/updated in `sys_ntf_prov_send_mst` (platform) or the tenant-private equivalent; audit event recorded.
- Failure modes verified in code: `NotFoundException` if the owning account doesn't exist; `ConflictException` if `channel_code` mismatches the account, or on a concurrent-edit version conflict.

## Rollback / abort guidance

- Deactivate (`is_active: false`) rather than delete, to preserve route/binding history that may still reference the sender.

## NOT YET IMPLEMENTED — explicit gap

- **No live sender verification exists for any provider.** Per the controller's own doc comment: *"Senders have no live verification connector in this increment; `verification_state` is never operator-settable through these DTOs."* There is no `POST /notifications/senders/:id/verify` route, unlike the account-level verify routes in Runbook 01.
- What would need to be built: a provider-specific sender check (e.g. Twilio Sender/Messaging Service lookup, Meta phone-number-ID registration check, verified email-domain check per plan section 7.1) plus a `verification_state`-writing endpoint analogous to the account verify flow, gated the same way (fail-closed, provider-specific).
- Until that exists, operators must treat a sender's `verification_state` as informational only and confirm actual deliverability out-of-band (e.g. via the provider's own console) before activating any route that uses it.

**Last verified against source:** 2026-10-10 (`provider-senders.controller.ts`, `provider-accounts.service.ts`).
