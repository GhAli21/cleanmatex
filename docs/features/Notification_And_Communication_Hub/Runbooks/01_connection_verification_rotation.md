# Runbook 01 — Connection (Provider Account) Verification & Rotation

**Status: Partial.** Live verification exists for TWILIO accounts only (platform and tenant-private). Credential *rotation* as a dedicated, auditable operation exists only for tenant-private accounts; platform account credentials are deployment secrets, changed by redeploying, not by an API call.

## Purpose

Verify that a provider account (a "connection") is correctly authenticated against the live provider before any route may use it, and safely rotate a tenant-private account's stored credential without leaving a route silently broken.

## Preconditions / permissions

- HQ operator JWT with `hq_notifications:read` (list/read) or `hq_notifications:manage` (create/update/verify/rotate).
- Enforced by `HqPermissionGuard` + `JwtAuthGuard` on `platform-api/src/modules/notifications-hq/provider-accounts/provider-accounts.controller.ts`.
- For tenant-private accounts, the HQ operator must know the exact `tenantOrgId` — every route is nested under `tenants/:tenantOrgId`.

## Part A — Platform account verification

1. List platform accounts: `GET /notifications/connections` (perm: `hq_notifications:read`).
2. Create one if needed: `POST /notifications/connections` (perm: `hq_notifications:manage`) with `provider_code`, `channel_code`, `environment_code`, `account_key`, `external_account_id`, `credential_ref`, `credential_version`. The account starts in a non-verified state.
3. Verify: `POST /notifications/connections/:id/verify` (perm: `hq_notifications:manage`).
   - Implementation: `ProviderAccountsService.verifyPlatformAccount` (`provider-accounts.service.ts:112`) calls `TwilioContentImporterService.verifyPlatformAccountCredentials`, a real Twilio Account API check.
   - **Only `TWILIO` is supported this increment.** Any other `provider_code` throws before any live check is attempted (fail-closed, not silently marked verified).
   - On success (`status === 'active'`), the account is set to `VERIFIED` via `repository.setPlatformAccountVerification` and an audit event `notification_connection.verify_platform` is written (`sourceModule: 'notifications-hq'`).
   - On failure, a `ConflictException` is thrown (`Twilio account status is '<status>', not active`) and the account's verification state is left unchanged.
4. The platform account's actual secret (`HQ_TWILIO_ACCOUNT_SID` / `HQ_TWILIO_AUTH_TOKEN`) is a deployment secret, not stored encrypted per-account in the DB. `credential_ref`/`credential_version` on the account row must match the deployment setting `NTF_TWILIO_CONTENT_CREDENTIAL_REF` (and optionally `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION`) exactly, or imports/dispatch using that account fail closed.
5. **Rotation for a platform account is not a dedicated endpoint.** To rotate: update the deployment secret, then `PATCH /notifications/connections/:id` (perm: `hq_notifications:manage`) to change `credential_ref`/`credential_version` to match, then re-run step 3.

## Part B — Tenant-private (BYO) account verification and rotation

1. List: `GET /notifications/connections/tenants/:tenantOrgId` (perm: `hq_notifications:read`).
2. Create: `POST /notifications/connections/tenants/:tenantOrgId` (perm: `hq_notifications:manage`) — no credential yet.
3. Write or rotate the credential envelope: `POST /notifications/connections/tenants/:tenantOrgId/:id/credential` (perm: `hq_notifications:manage`), body includes `credential_kind` (e.g. `TWILIO_ACCOUNT_AUTH`), `credential_version`, `payload` (plaintext secret, encrypted server-side), optional `expires_at`.
   - Implementation: `ProviderAccountsService.setPrivateAccountCredential` (`provider-accounts.service.ts:298`). The payload is AES-GCM-encrypted via `EncryptionService.encryptJson` and written to `org_ntf_prov_cred_mst` (migration `0593`).
   - **Every write — including a brand-new credential, not just a rotation — immediately resets the account's verification state to `PENDING`.** The envelope is never echoed back in the response.
4. Check non-secret credential status (never the secret itself): `GET /notifications/connections/tenants/:tenantOrgId/:id/credential` (perm: `hq_notifications:manage`).
5. Verify: `POST /notifications/connections/tenants/:tenantOrgId/:id/verify` (perm: `hq_notifications:manage`).
   - Implementation: `ProviderAccountsService.verifyPrivateAccount` (`provider-accounts.service.ts:348`). Decrypts the stored envelope, rejects if `expires_at` has passed, rejects if `provider_code !== 'TWILIO'` or `credential_kind !== 'TWILIO_ACCOUNT_AUTH'`, then performs a live Twilio Account check and requires the decrypted Account SID to equal the account's `external_account_id` before marking `VERIFIED`.
   - On success: account → `VERIFIED`, credential marked verified (`repository.markPrivateCredentialVerified`), audit event `notification_connection.verify_private`.
   - On failure: `ConflictException`, account stays `PENDING` (or whatever it already was) — no partial state.

## Expected outcomes

- Success: account `verification_state = 'VERIFIED'`; HQ audit log row with `action` matching `notification_connection.verify_platform` / `verify_private`.
- Failure: HTTP 409 (`ConflictException`) with a message naming the actual Twilio status or validation gap; account state unchanged (verify) or forced to `PENDING` (any credential write).

## Rollback / abort guidance

- A failed verify never discards the existing credential or account row — simply fix the underlying problem (expired secret, wrong Account SID, non-Twilio provider) and re-run step 5/3.
- A rotation that sets the account to `PENDING` is not itself reversible without re-verifying; until re-verified, routes referencing this account cannot be activated (the route `activate` endpoint requires immutable, verified provider evidence — see Runbook 04).

## Known gaps (explicit, not invented)

- No live verification connector exists for any provider other than `TWILIO` (Meta, SMS aggregators, email, push accounts cannot be verified through this surface).
- No scheduled/automatic re-verification or expiry alerting exists; `expires_at` is checked only at the moment of a manual verify call.

**Last verified against source:** 2026-10-10 (`provider-accounts.controller.ts`, `provider-accounts.service.ts`, `provider-senders.controller.ts`, migrations `0592`/`0593`).
