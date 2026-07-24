# CleanMateX Order Workflow V1 — Security, Permissions, Audit, and Compliance

**Document ID:** CMX-OW-V1-PACK-012  
**Version:** 1.0  
**Status:** Implementation specification

## 1. Objectives

Tenant isolation, least privilege, HQ/tenant separation, auditability, secure evidence, replay protection, and sensitive-action approval.

## 2. Trust boundaries

Browser/mobile is untrusted. Tenant comes from authentication. RLS protects data. HQ configuration is separate. Provider callbacks are verified. Evidence uses signed URLs. Service-role access is limited and audited.

## 3. HQ permissions

- hq:workflow:view/create/edit/review/approve/publish/retire/assign/simulate/impact

## 4. Tenant operation permissions

- orders:preparation:start/complete
- orders:processing:start/complete
- orders:assembly:complete
- orders:qa:pass/fail
- orders:packing:complete
- orders:ready:mark
- orders:release:create/verify
- orders:collection:confirm
- orders:dispatch
- orders:delivery:confirm
- orders:pickup:manage
- orders:outsource:create/approve/send/receive/reconcile

## 5. Sensitive permissions

- orders:stage:skip
- orders:qa:override
- orders:release:with_balance
- orders:cancel:processed
- orders:return:create
- orders:force_close
- orders:hold:override

## 6. Mandatory reason/approval

Required for stage skip, QA override, release with balance, cancellation after work starts, manual outsourcing, force close, correction of verified release, missing-piece resolution, and active-order workflow migration.

## 7. RLS

Every org table has RLS, tenant policy, branch policy where needed, and no anonymous write. Every sys workflow draft/write path is HQ-only. Tenant may read only assigned published data.

## 8. Audit

Append-only audit covers configuration, review/publish, assignment, runtime transition, significant blocked attempts, overrides, releases, delivery, outsourcing custody, holds/approvals, cancellation/return, projection rebuild, and reset/migration.

## 9. Evidence

Photos, signatures, POD, and packing lists use private tenant-scoped storage, short-lived signed URLs, type/size validation, malware scanning where available, retention policy, and access audit.

## 10. Privacy

Minimize PII in logs/analytics. Do not store plaintext OTP. Mask phone/address where unnecessary. Limit signature access.

## 11. Webhooks

Signed verification, timestamp tolerance, replay protection, provider event uniqueness, payload hash where required, secret rotation, and delivery logs.

## 12. Security testing

Dependency/secret scanning, typecheck/lint, SQL/RLS review, authorization tests, DAST, upload validation, replay tests, and cross-tenant tests.

## 13. Threat cases

- Cross-tenant order ID
- Tenant calls HQ publish
- Replayed delivery
- Same key/different payload
- Client submits paid/status
- Legacy endpoint bypass
- Leaked evidence URL
- Unapproved support access
- Double release
- Cross-tenant vendor relation

Each requires preventive and detective controls.

## 14. Acceptance criteria

- Cross-tenant tests pass.
- Tenant cannot author workflow.
- Client cannot set canonical states.
- Sensitive actions require permission/reason.
- Evidence is private/auditable.
- Replay does not duplicate effects.
