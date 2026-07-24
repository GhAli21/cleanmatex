# CleanMateX Order Workflow V1 — Production Readiness Checklist

**Document ID:** CMX-OW-V1-PACK-017  
**Version:** 1.0  
**Status:** Release gate

## A. Decisions
- [ ] PRD/ADR/status catalogs/HQ governance/migration strategy approved
- [ ] Order Fin integration approved

## B. Database
- [ ] Empty replay succeeds
- [ ] No duplicate migration number
- [ ] RLS and tenant FKs
- [ ] Constraints/indexes
- [ ] Reference data
- [ ] Projection rebuild
- [ ] Contract migration
- [ ] Backup/restore

## C. Backend
- [ ] All actions use facade
- [ ] No direct writer
- [ ] Idempotency/concurrency
- [ ] History/outbox atomic
- [ ] Finance gateway
- [ ] Errors/observability

## D. HQ configuration
- [ ] Draft/review/approve/publish
- [ ] Immutability
- [ ] Resolution/simulation/impact
- [ ] Tenant cannot author

## E. Runtime
- [ ] Preparation/Processing/Assembly/QA/Packing/Ready
- [ ] Holds/approvals
- [ ] Cancellation/return
- [ ] Mixed work groups

## F. Outsourcing
- [ ] Vendor/job/custody/reconciliation/QA/cost/overdue
- [ ] Duplicate assignment prevented

## G. Fulfilment
- [ ] Collection/delivery/partial fulfilment/mixed methods
- [ ] Verification/POD/failure/return
- [ ] Double release prevented

## H. UI/UX
- [ ] One primary action
- [ ] Backend actions
- [ ] Actionable blockers
- [ ] Responsive/RTL/accessibility
- [ ] No raw status editor

## I. Security
- [ ] RLS/permissions/HQ separation
- [ ] Replay/signed evidence/webhooks
- [ ] SAST/DAST/secrets

## J. Testing
- [ ] Unit/database/API/Playwright/Flutter/performance/security/migration/rollback

## K. Operations
- [ ] Dashboards/alerts/runbook/dead letter/projection repair/support/release tag

## Release rule

No critical/high defect remains. Any exception requires owner, impact, mitigation, approval, and expiry.
