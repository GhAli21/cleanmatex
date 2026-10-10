# Runbook 03 — Template Import, Submission & Approval

**Status: Partial.** Server-side import of an already-provider-approved Twilio Content template (platform and tenant-private) is fully implemented, with immutable revisions and a one-time binding command. CleanMateX never *submits* a template to a provider for approval — that step happens in the provider's own console (e.g. Twilio Content Editor / WhatsApp Manager) before anything in this runbook runs. No Meta-direct importer exists.

## Purpose

Bring an externally-approved provider template (WhatsApp Content SID today) into CleanMateX as an immutable, auditable revision, then map its provider parameter slots to typed internal variables before any route may use it.

## Preconditions / permissions

- The template must already be **approved by the provider** (e.g. Twilio WhatsApp Content approved) — this runbook only imports/observes that state, it does not request or expedite approval.
- HQ operator JWT with `hq_notifications:read` (discovery) or `hq_notifications:manage` (import/bind/refresh).
- All routes are on `platform-api/src/modules/notifications-hq/provider-templates/provider-templates.controller.ts`, mounted at `notifications/provider-template-registrations`.

## Part A — Platform (HQ-owned) import

1. Discover import candidates: `GET /notifications/provider-template-registrations/import/twilio/candidates?accountId=<id>` (perm: `hq_notifications:manage`). Returns only verified active Twilio WhatsApp accounts, their verified senders, and active canonical WhatsApp locales — no credentials or snapshots.
2. Import: `POST /notifications/provider-template-registrations/import/twilio` (perm: `hq_notifications:manage`) with `account_id`, `locale_id`, optional `sender_id`, and the Twilio `ContentSid` from the provider console.
   - Implementation: `ProviderTemplatesService.importTwilioContent` → `TwilioContentImporterService`. The API fetches Twilio Content + WhatsApp approval resources server-side, redacts/hashes the snapshot, and invokes `cmx_import_sys_ntf_prov_tmpl` atomically (migration `0586`). The browser never supplies approval status, evidence, or credentials.
   - The account must be verified and its `credential_ref` must equal deployment setting `NTF_TWILIO_CONTENT_CREDENTIAL_REF` (see Runbook 01); otherwise the import fails closed.
   - The first imported revision has **no** variable bindings yet — a route stays non-activatable until binding is complete (Part C).
3. Review registrations/revisions: `GET /notifications/provider-template-registrations` and `GET /notifications/provider-template-registrations/:registrationId/revisions` (perm: `hq_notifications:read`). Only redacted metadata is returned — no snapshots/credentials.
4. Refresh the current revision from the provider (re-observe, does not edit prior evidence): `POST /notifications/provider-template-registrations/:registrationId/revisions/:revisionId/refresh/twilio` (perm: `hq_notifications:manage`). Creates a brand-new immutable revision which itself requires re-binding before use.

## Part B — Tenant-private (BYO) import

Same lifecycle, tenant-scoped:
1. Candidates: `GET /notifications/provider-template-registrations/tenants/:tenantOrgId/private/import/twilio/candidates?accountId=<id>` (perm: `hq_notifications:manage`).
2. Import: `POST /notifications/provider-template-registrations/tenants/:tenantOrgId/private/import/twilio` (perm: `hq_notifications:manage`). Resolves only the tenant's selected verified account, decrypts its `TWILIO_ACCOUNT_AUTH` envelope server-side, requires the decrypted Account SID to equal the account's `external_account_id`, then invokes `cmx_import_org_ntf_prov_tmpl` (migration `0592`).
3. Discovery: `GET .../tenants/:tenantOrgId/private` and `.../private/:registrationId/revisions` (perm: `hq_notifications:read`).
4. Refresh: `POST .../private/:registrationId/revisions/:revisionId/refresh/twilio` (perm: `hq_notifications:manage`).

## Part C — Immutable binding (required before any route can activate)

1. Get binding candidates: `GET .../:registrationId/revisions/:revisionId/binding-candidates` (platform) or the `tenants/:tenantOrgId/private/...` equivalent (perm: `hq_notifications:manage`). Returns the ordered provider slots and only variables compatible with the revision's locale template version.
2. Define bindings **once**: `POST .../:registrationId/revisions/:revisionId/bindings` (or the private equivalent) with a complete ordered binding array (perm: `hq_notifications:manage`).
   - Implementation: `cmx_define_sys_ntf_prov_tmpl_bindings` (migration `0588`, platform) / the tenant-private equivalent (migration `0596`). Validates slot count and unique ordered positions, permits only variables owned by the represented logical template version, and **allows only the first definition** — browser roles cannot call the DB function directly; the HQ API records the audit event.
   - Corrections require a brand-new imported/refreshed revision, not an edit to this one.

## Expected outcomes

- Success: a new row in the provider-template-registration/revision tables with redacted snapshot hash; binding command returns the complete ordered slot→variable map; audit events recorded for import and binding.
- Failure: import fails closed on unverified/mismatched credential_ref, wrong account/locale, or missing sender; binding fails on incomplete/duplicate positions or an already-bound revision (immutability).

## Rollback / abort guidance

- There is no "undo import" — a bad import is simply never bound and never selected by any route; it is inert. To correct a wrong Content SID or stale approval, import/refresh a new revision rather than attempting to edit the bad one.

## Known gaps (explicit, not invented)

- **No Meta Cloud API (or any non-Twilio) importer exists.** Only Twilio Content/WhatsApp is implemented (`twilio-content-importer.service.ts`); the plan's provider-neutral coverage map (section 26) is aspirational for every other channel/provider combination.
- **No "submit for approval" API exists.** The plan's proposed `POST /provider-templates/:id/submit` (section 10.2) is not implemented; approval must be obtained directly in the provider's own console before step A2/B2 of this runbook.
- **No `POST .../validate` / `.../preview` revision-level validation or preview endpoint exists** (plan section 10.2, proposed) separate from the binding-candidates check.

**Last verified against source:** 2026-10-10 (`provider-templates.controller.ts`, migrations `0586`, `0588`, `0592`, `0593`, `0596`).
