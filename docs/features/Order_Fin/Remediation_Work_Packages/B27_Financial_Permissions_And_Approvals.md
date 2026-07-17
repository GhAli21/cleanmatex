# B27 — Financial Permissions and Approvals

## Metadata
Backlog ID: B27 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: §43, §50-B27
Required decisions: none (thresholds may reference D001 transitions)
Dependencies: none · Blocks: [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) (impl — action permissions)
Recommended phase: Seq 5

## Confirmed problem
Missing permission codes for: price override, manual-discount thresholds, manual charge, cash adjustment/variance approval, wallet/gift-card adjustment, credit issue, payment cancel/fail, order reopen, post-settlement edit, journal reversal, backdated/closed-period adjustment, rate override (§43 matrix NOT_FOUND rows).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| lib/constants/permissions/*-perm.ts | refund pair, collect, verify, adjustment, voucher-reverse, write-off exist | listed actions ungated or ride broad codes |
| §43 | no threshold approvals anywhere | maker-checker limited to refunds/write-off |

## Required outcome
New `resource:action` codes (CRITICAL RULE 13) + seeding migration (RULE 11) for each gap; guards wired via `requirePermission`; threshold-approval pattern (amount-based) for discounts/variance; reason-mandatory on sensitive actions; RBAC role mapping via `/update-rbac-role` flow.

## Scope
Permission constants + migration + route guards + role seeds + inventories refresh (`/rebuild-platform-info-inventories`).

## Out of scope
The features the permissions gate (each Bxx wires its own guard usage); UI approval dialogs beyond pattern components.

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | NO |
| Customer receipt | NO |
| Audit/outbox | YES (approval records) |

## Acceptance criteria
Every §43 NOT_FOUND action has a seeded, enforced code; permission inventory drift report clean.

## Required tests
API (403 paths), database (seeds), regression, access-contract checks.

## Dependencies and sequencing
Early (Seq 5) so B30/B16/B12 consume real codes.

## Delivery surfaces

Backend services: permission constants (lib/constants/permissions) + `requirePermission` guard wiring on the gated routes; threshold-approval helper
Database/schema: permission seed migration (RULE 11) + role-mapping updates (`/update-rbac-role` flow)
API/endpoints: guarded existing endpoints; no new business endpoints
Frontend page/screen/dialog/action: approval dialog pattern component (reason + approver) consumed by B12/B16/B24/B30/B34; role-admin screens (existing RBAC UI) show the new codes with bilingual descriptions; gated actions render disabled-with-reason for unauthorized users
Reusable components/helpers: RequirePermission components (existing); threshold-approval dialog
Permissions: this package defines them — price override, manual-discount threshold, manual charge, cash adjustment, variance approval, SV adjustments, credit issue, payment cancel/fail, order reopen (incl. the REFUND_AND_REBILL gate required by D003 v2 — B01 rejects rebill until this code is seeded and wired; B34 shows the action only to holders), post-settlement edit, journal reversal, backdated/closed-period, rate override
Validation: `resource:action` format (RULE 13); permission↔migration parity check
i18n/RTL: EN/AR permission descriptions
Accessibility: disabled-state reasons exposed as text
Audit trail: approval records (actor, reason, threshold) via the shared dialog contract
Observability: permission inventory drift report clean (`check:platform-info-inventories`)
Jobs/workers: none
Feature flag: none — seeded codes are inert until consuming packages wire guards
Rollout: constants + migration [stop-and-wait] → guards per consuming package → inventories refresh
Rollback: roles can be unmapped; codes remain seeded (harmless)

## End-to-end operational flow (admin + gated-action user)

- **Trigger:** operator — tenant admin opens the existing role-management screen to map the new codes; end-user trigger — any user attempts a gated financial action (price override, manual discount over threshold, cash adjustment, rebill/order reopen, journal reversal, backdated adjustment, rate override, …).
- **Permissions:** this package defines them — all codes follow `resource:action` (CRITICAL RULE 13), seeded by migration (RULE 11), mapped to roles via the `/update-rbac-role` flow; role administration itself stays behind the existing RBAC admin permissions.
- **API/system action:** no new business endpoints — existing endpoints gain `requirePermission` guards; threshold-sensitive actions route through the threshold-approval helper (amount-based) before executing.
- **Backend execution:** guard evaluates the actor's effective permissions server-side (UI state is advisory only); threshold approvals persist the approving actor, reason, and threshold crossed before the underlying action runs; sensitive actions refuse to execute without a mandatory reason.
- **Success path:** authorized user completes the action through the approval dialog where thresholds apply; the approval record links to the resulting financial fact; role admin sees the new codes with bilingual descriptions.
- **Failure handling:** unauthorized API call → explicit 403 (tested); UI renders the action disabled with the reason text; a missing-permission attempt never partially executes; misconfigured roles fail closed (deny by default).
- **Retry logic:** permission denials are not retried automatically — after a role change the user's next attempt re-evaluates; approval-dialog submissions are double-click-safe (per-attempt key on the underlying action).
- **Audit logging:** every threshold approval and sensitive action records actor, reason, threshold, and timestamp via the shared dialog contract; role-mapping changes carry the standard RBAC audit fields.
- **Observability:** permission inventory drift report clean (`check:platform-info-inventories`); 403-rate per code surfaces mis-mapped roles; approval-volume per threshold reviewed for threshold tuning.
- **Recovery procedures:** over-granted role → unmap the code (seeded codes remain, harmless); missing grant blocking legitimate work → role update through `/update-rbac-role` with audit; guard misconfiguration → the gated feature's own flag (owned by its consuming package) can disable the surface while the guard is fixed; inventories refreshed after every repair.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
