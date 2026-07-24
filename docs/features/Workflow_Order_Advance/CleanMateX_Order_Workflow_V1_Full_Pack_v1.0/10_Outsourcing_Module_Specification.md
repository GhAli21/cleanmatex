# CleanMateX Order Workflow V1 — Outsourcing Module Specification

**Document ID:** CMX-OW-V1-PACK-010  
**Version:** 1.0  
**Status:** Implementation specification

## 1. Goal

Track selected items or pieces sent to an external vendor without losing custody, readiness, cost, or workflow visibility.

## 2. Ownership

HQ controls workflow behavior. Tenant manages vendor records, contacts, supported services, turnaround, notes, and branch availability.

## 3. Scope

Job may contain entire work group, selected items, selected pieces, or quantities when pieces are not tracked. A piece cannot belong to more than one active job.

## 4. Lifecycle

```text
draft
→ approval_pending
→ approved
→ prepared
→ sent_to_vendor
→ vendor_received
→ vendor_processing
→ vendor_completed
→ returned
→ reconciliation_pending
→ reconciled
→ internal_qa
→ completed
```

Controlled exception/cancellation paths also exist.

## 5. Required data

Tenant, order/group, vendor, processing location, selected content, vendor service, expected return, estimated/actual cost, currency, vendor reference, send/receive evidence, custody events, reconciliation, QA, notes, and history.

## 6. Approval

HQ profile determines approval. Manual outsourcing requires permission, reason, vendor, expected return, and selected content.

## 7. Send

Verify approval/content, scan/select, record counts, capture evidence, create custody event, update lines/job, and emit outbox.

## 8. Vendor receipt

May be staff-confirmed or later provider-confirmed. Discrepancy creates issue.

## 9. Return/reconciliation

Compare expected and returned pieces/quantities, wrong, missing, damaged, and unscannable content. Completion is blocked until resolved.

## 10. Internal QA

HQ profile may require QA. Failure routes to vendor resend, internal rework, manager decision, or issue.

## 11. Cost

Store estimated and actual cost, currency, notes, and vendor invoice reference. Full AP/vendor settlement is outside V1.

## 12. SLA

Expected return is required. Show warning/overdue, escalate, update ready-by risk, and generally keep customer milestone as Cleaning in Progress.

## 13. Cancellation

Before send: normal controlled cancellation. After send: return/reconcile or exception resolution; custody cannot disappear.

## 14. Security

Tenant-scoped jobs/vendors, branch permissions, cost visibility permission, approval permission, signed evidence URLs, and custody audit.

## 15. Tests

Uniqueness, counts, missing/wrong/damaged return, retry, concurrency, cancellation, QA fail, RLS, and overdue notification.

## 16. Acceptance criteria

- No duplicate active assignment.
- Job cannot complete before reconciliation.
- Discrepancies block and remain visible.
- Cost recording does not duplicate accounting.
- Mixed internal/outsourced order aggregates correctly.
