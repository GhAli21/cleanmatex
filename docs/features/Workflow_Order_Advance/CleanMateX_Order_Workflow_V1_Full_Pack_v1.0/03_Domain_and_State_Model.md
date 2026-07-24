# CleanMateX Configurable Order Workflow V1 — Domain and State Model

**Document ID:** CMX-OW-V1-PACK-003  
**Version:** 1.0 Draft  
**Status:** Domain baseline  
**Configuration owner:** CleanMateX HQ Platform

---

## 1. Purpose

This document defines the complete V1 status architecture, domain ownership, allowed meanings, aggregation behavior, compatibility treatment, and customer-facing projections.

The complete state is deliberately multidimensional. The UI may show one simple headline, but the backend must preserve the separate truths required for production, finance, fulfilment, custody, outsourcing, issues, and audit.

---

## 2. State ownership matrix

| Business question | Canonical owner | Order summary field |
|---|---|---|
| Is the commercial order active or closed? | Order commercial lifecycle | `commercial_status` |
| What is the overall production condition? | Work-group/item/piece aggregation | `operational_status` physically stored in `current_status` during migration |
| What detailed stage is active? | Workflow instance/work group | None required as complete order truth |
| How much has reached the customer? | Releases/fulfilments | `fulfilment_status` |
| Who holds the outstanding physical content? | Custody events/pieces/packages | `custody_summary_status` |
| Is normal progression blocked? | Issues/holds/approvals/exceptions | `exception_status` |
| What is the payment state? | Order Fin | `payment_status` |
| What is the invoice state? | Order Fin | `invoice_status` |
| What is happening at an external vendor? | Outsource job and lines | Derived only |
| What happened during collection/delivery? | Release/delivery/pickup records | Derived only |
| What should the customer see? | Customer milestone projection | `customer_milestone_code` where cached |

---

## 3. Order-level canonical fields

Recommended V1 logical contract:

```text
commercial_status
operational_status
fulfilment_status
exception_status
custody_summary_status
payment_status
invoice_status
workflow_version_id
customer_milestone_code
```

Physical migration mapping:

```text
operational_status is the final physical/domain/API field.
Legacy current_status may be temporarily mirrored only during expand/change.

org_orders_mst.status
    temporary compatibility alias

org_orders_mst.current_stage
    temporary compatibility projection, not detailed source of truth
```

---

## 4. Commercial status

### Values

| Code | Meaning | Terminal? |
|---|---|---:|
| `draft` | Order is not confirmed and carries no full operational commitment | No |
| `pending_confirmation` | Waiting for customer, B2B, marketplace, or business approval | No |
| `confirmed` | Accepted and ready to enter active responsibility | No |
| `in_progress` | CleanMateX tenant has active service/fulfilment responsibility | No |
| `completed` | Operational and fulfilment obligations are complete | No |
| `cancelled` | Valid order stopped through controlled cancellation | Yes for original service path |
| `voided` | Invalid or erroneous transaction invalidated | Yes |
| `closed` | All applicable operational, fulfilment, financial, issue, return, and dispute obligations are closed | Yes |

### Allowed high-level transitions

```text
draft → pending_confirmation
draft → confirmed
draft → voided
pending_confirmation → confirmed
pending_confirmation → cancelled
confirmed → in_progress
confirmed → cancelled
in_progress → completed
in_progress → cancelled (only when cancellation policy permits)
completed → closed
completed → in_progress only through an explicit post-completion obligation model, not a direct status rewind
cancelled → closed
voided → closed where archival policy requires
```

A post-delivery complaint creates issue/return/rework records. It does not normally change the original commercial lifecycle backward.

---

## 5. Operational status

### Values

| Code | Meaning |
|---|---|
| `not_started` | No active operational work has started |
| `preparing` | Intake, itemization, or preparation is active |
| `processing` | One or more required work groups are actively being processed, assembled, checked, packed, or outsourced |
| `partially_ready` | At least one required releasable unit is Ready while other required units remain incomplete |
| `ready` | All outstanding required operational units are Ready |
| `operationally_completed` | No operational work obligation remains |

### Rules

- This is an order-level summary.
- It is not the detailed configured stage.
- It shall be derived from active work groups/items/pieces.
- During cutover it may be mirrored to `current_status`; the final schema stores `operational_status` directly.
- API clients should receive the explicit property name `operational_status`.

---

## 6. Fulfilment status

| Code | Meaning |
|---|---|
| `not_fulfilled` | No required release quantity has reached the customer/authorized recipient |
| `partially_fulfilled` | Some required quantity has been released, with outstanding required quantity remaining |
| `fully_fulfilled` | All required quantity is released or formally resolved |

Fulfilment is based on release lines and resolved obligations, not only order status.

---

## 7. Exception status

| Code | Meaning |
|---|---|
| `normal` | No active warning or blocker |
| `needs_attention` | Non-blocking issue or warning requires visibility |
| `blocked` | One or more rules prevent the requested or normal next action |
| `on_hold` | Explicit active hold suspends configured workflow actions |

Priority:

```text
on_hold > blocked > needs_attention > normal
```

Detailed reason codes remain in their domain records.

---

## 8. Custody summary status

| Code | Meaning |
|---|---|
| `not_received` | Tenant has not received physical custody |
| `customer` | Outstanding content remains with the customer |
| `driver` | Outstanding content is with a driver |
| `branch` | Outstanding content is at a branch |
| `plant` | Outstanding content is at a processing plant |
| `vendor` | Outstanding content is with an outsourcing vendor |
| `release_staging` | Content is staged/reserved for handover or dispatch |
| `mixed` | Outstanding content exists in multiple custody locations |
| `released` | All required content is released from tenant custody |
| `unknown` | Custody cannot be determined and requires investigation |

`unknown` must raise an operational exception.

---

## 9. Finance status references

Payment and invoice status are canonical in Order Fin.

Workflow stores or reads only the canonical Order Fin projection.

### Required integration behavior

- Workflow does not calculate financial totals.
- Release eligibility asks Order Fin for an explicit decision.
- Order closure asks Order Fin for financial closure eligibility.
- Financial events refresh relevant projections.
- A status mismatch is an integration defect and must be observable.

The exact values must match the approved Order Fin status catalog. No duplicate workflow-only payment enum shall be created.

---

## 10. Workflow instance status

| Code | Meaning |
|---|---|
| `pending` | Created but not started |
| `active` | Currently executable |
| `completed` | All required stages for the instance are complete |
| `cancelled` | Instance cancelled |
| `failed` | Instance cannot continue without controlled recovery |
| `superseded` | Replaced through an authorized migration or re-resolution |

A workflow instance references one immutable workflow version.

---

## 11. Work-group progress status

| Code | Meaning |
|---|---|
| `not_started` | No group item has started |
| `in_progress` | Work is active |
| `partially_completed` | Some required content completed while some remains |
| `completed` | All required group content completed |
| `cancelled` | Group obligation cancelled |
| `superseded` | Replaced by a controlled split/reassignment |

A work group also stores/references its detailed `current_stage_code`.

---

## 12. Stage codes

HQ-supported V1 stage types:

- `draft`
- `intake`
- `preparation`
- `processing`
- `assembly`
- `qa`
- `packing`
- `outsourcing`
- `ready`
- `ready_for_collection`
- `ready_for_dispatch`
- `out_for_delivery`
- `collected`
- `delivered`
- `cancelled`
- `closed`

Stage codes are not all order-level operational summaries.

HQ may configure occurrence, sequence, conditions, gates, labels, and customer mapping but cannot introduce unsupported executable code.

---

## 13. Order-item status

| Code | Meaning |
|---|---|
| `pending` | Item not started |
| `active` | Item has active work |
| `partially_completed` | Some quantity/pieces completed |
| `ready` | Full outstanding item quantity is Ready |
| `partially_released` | Some item quantity released |
| `fully_released` | All required item quantity released |
| `cancelled` | Item obligation cancelled |
| `resolved` | Item obligation closed through another authorized outcome |

Item detail also references:

- Current stage.
- QA status.
- Exception state.
- Outsourcing assignment.
- Release quantities.

---

## 14. Piece status

| Code | Meaning |
|---|---|
| `expected` | Piece expected but physical receipt not confirmed |
| `received` | Physical receipt confirmed |
| `active` | Piece is in active operational work |
| `ready` | Piece is operationally Ready |
| `released` | Piece released to customer/authorized recipient |
| `cancelled` | Piece obligation cancelled |
| `lost` | Piece confirmed lost under controlled issue process |
| `disposed` | Piece disposed through authorized policy |
| `resolved` | Piece obligation resolved without normal release |

Piece status is not a replacement for current stage, custody, QA, release, or exception status.

---

## 15. QA status

| Code | Meaning |
|---|---|
| `not_required` | QA not required by resolved workflow |
| `pending` | QA required but not started |
| `in_progress` | Inspection active |
| `passed` | Passed |
| `passed_with_note` | Passed with recorded non-blocking note |
| `failed` | Failed and requires resolution/rework |
| `override_approved` | Authorized override allows continuation |
| `cancelled` | QA obligation cancelled with parent obligation |

---

## 16. Piece/item release status

| Code | Meaning |
|---|---|
| `not_released` | Not assigned to an active release |
| `reserved_for_release` | Reserved in a draft/verified active release |
| `dispatched` | Left branch with an outbound delivery release |
| `released` | Handed to customer/authorized recipient |
| `returned_to_branch` | Returned after failed delivery |
| `cancelled` | Release assignment cancelled |

A unique active-assignment rule prevents overlapping releases.

---

## 17. Outsource job status

| Code | Meaning |
|---|---|
| `draft` | Job being prepared |
| `approval_pending` | Awaiting required approval |
| `approved` | Approved |
| `prepared` | Selected content verified and prepared |
| `sent_to_vendor` | Custody transferred from tenant to vendor transport/vendor |
| `vendor_received` | Vendor receipt confirmed |
| `vendor_processing` | External work active |
| `vendor_completed` | Vendor reports work complete |
| `returned` | Physical return received by tenant |
| `reconciliation_pending` | Expected and returned content not fully reconciled |
| `reconciled` | Reconciliation complete |
| `internal_qa` | Internal post-vendor QA active |
| `completed` | Outsourcing obligation complete |
| `cancelled` | Job cancelled through policy |
| `exception` | Blocking vendor/custody issue exists |

---

## 18. Outsource line status

| Code | Meaning |
|---|---|
| `assigned` | Item/piece assigned to job |
| `prepared` | Verified for sending |
| `sent` | Sent |
| `received_by_vendor` | Vendor receipt confirmed |
| `processing` | Vendor work active |
| `returned` | Returned to tenant |
| `missing` | Expected return missing |
| `damaged` | Return damage exception |
| `reconciled` | Reconciled |
| `completed` | Line obligation completed |
| `cancelled` | Assignment cancelled |

The same piece cannot belong to multiple active outsource jobs.

---

## 19. Release status

| Code | Meaning |
|---|---|
| `draft` | Release being prepared |
| `eligibility_pending` | Awaiting release-policy evaluation |
| `ready_for_verification` | Content selected and ready for recipient/dispatch verification |
| `verified` | Verification complete |
| `released` | Customer/B2B handover completed |
| `dispatched` | Loaded and dispatched for delivery |
| `out_for_delivery` | Delivery active |
| `delivered` | Delivery completed |
| `failed` | Delivery attempt failed |
| `returned_to_branch` | Failed delivery content reconciled back at branch |
| `cancelled` | Release cancelled before final handover |

### Type-specific paths

Customer collection:

```text
draft → eligibility_pending → ready_for_verification → verified → released
```

Delivery:

```text
draft → eligibility_pending → ready_for_verification → verified
→ dispatched → out_for_delivery → delivered
```

Failed delivery:

```text
out_for_delivery → failed → returned_to_branch
```

A new attempt may reuse the release only if the design explicitly supports attempt records; otherwise a new attempt references the same release.

---

## 20. Delivery status

| Code | Meaning |
|---|---|
| `unscheduled` | Delivery required but no schedule |
| `scheduled` | Schedule confirmed |
| `assigned` | Driver/route assigned |
| `ready_for_dispatch` | Release ready to load |
| `loaded` | Verified as loaded |
| `out_for_delivery` | Driver traveling/servicing stop |
| `arrived` | Driver arrived |
| `delivery_in_progress` | Verification/POD/payment active |
| `delivered` | Delivered |
| `attempted` | Attempt recorded without success |
| `failed` | Failed and needs resolution |
| `rescheduled` | New schedule established |
| `returned_to_branch` | Physical content returned/reconciled |
| `cancelled` | Delivery cancelled |

Failure reason is a separate code, including:

- `customer_unavailable`
- `invalid_address`
- `customer_refused`
- `payment_not_resolved`
- `otp_failed`
- `package_missing`
- `driver_issue`
- `vehicle_issue`
- `other`

---

## 21. Pickup status

| Code | Meaning |
|---|---|
| `requested` | Pickup requested |
| `scheduled` | Slot confirmed |
| `assigned` | Driver/route assigned |
| `driver_en_route` | Driver traveling |
| `arrived` | Driver arrived |
| `pickup_in_progress` | Verification and handover active |
| `picked_up` | Customer-to-driver custody completed |
| `in_transit_to_branch` | Driver carrying content |
| `received_at_branch` | Branch receipt reconciled |
| `attempted` | Attempt without success |
| `failed` | Failed and needs resolution |
| `rescheduled` | New schedule confirmed |
| `cancelled` | Pickup cancelled |

Failure reasons remain separate.

---

## 22. Issue/complaint status

| Code | Meaning |
|---|---|
| `open` | Issue created |
| `under_review` | Investigation active |
| `customer_action_required` | Waiting for customer |
| `manager_action_required` | Waiting for manager |
| `resolution_approved` | Resolution authorized |
| `in_rework` | Rework active |
| `resolved` | Operational resolution completed |
| `rejected` | Claim/issue rejected with reason |
| `closed` | Administrative closure complete |
| `cancelled` | Issue cancelled as duplicate/invalid |

Issue type is separate, for example:

- `missing_item`
- `wrong_item`
- `damage`
- `stain_unresolved`
- `quality_failure`
- `delivery_issue`
- `payment_issue`
- `customer_complaint`
- `vendor_issue`
- `other`

---

## 23. Hold status

| Code | Meaning |
|---|---|
| `active` | Hold currently blocks configured actions |
| `resolved` | Hold resolved |
| `cancelled` | Hold cancelled as invalid/duplicate |
| `expired` | Time-limited hold expired under policy |

Hold reasons are separate, including:

- `customer_approval`
- `payment`
- `credit`
- `missing_information`
- `missing_piece`
- `vendor_delay`
- `quality_review`
- `delivery_exception`
- `manager_review`
- `other`

---

## 24. Approval status

| Code | Meaning |
|---|---|
| `pending` | Awaiting decision |
| `approved` | Approved |
| `rejected` | Rejected |
| `expired` | Not decided within allowed period |
| `cancelled` | No longer required |

Approval types include:

- `skip_stage`
- `qa_override`
- `release_with_balance`
- `outsourcing`
- `cancellation`
- `refund`
- `customer_risk_consent`
- `force_close`

---

## 25. Workflow configuration statuses

### Definition status

- `active`
- `retired`

### Version status

- `draft`
- `in_review`
- `approved`
- `published`
- `retired`
- `rejected`

### Assignment status

- `scheduled`
- `active`
- `expired`
- `cancelled`

Published versions are immutable.

---

## 26. Customer milestone codes

| Code | Customer meaning |
|---|---|
| `order_received` | Order/request received |
| `cleaning_in_progress` | Processing or outsourcing active |
| `final_checks` | Assembly, QA, or Packing |
| `ready` | Ready for the configured fulfilment path |
| `partially_completed` | Part of the order handed over while obligations remain |
| `out_for_delivery` | Delivery active |
| `completed` | All customer fulfilment obligations complete |
| `needs_attention` | Customer-visible action or delay exists |

Customer milestones are projections and cannot authorize workflow actions.

---

## 27. Aggregation rules

### 27.1 Operational aggregation

```text
IF no required work group has started
    operational_status = not_started

ELSE IF preparation is the only active required work
    operational_status = preparing

ELSE IF all outstanding required releasable units are Ready
    operational_status = ready

ELSE IF at least one required releasable unit is Ready
     AND at least one required unit remains incomplete
    operational_status = partially_ready

ELSE IF no operational obligation remains
    operational_status = operationally_completed

ELSE
    operational_status = processing
```

The exact precedence must prevent `operationally_completed` from being hidden by historical completed groups.

### 27.2 Fulfilment aggregation

```text
released_required_quantity = 0
    → not_fulfilled

released_required_quantity > 0
AND outstanding_required_quantity > 0
    → partially_fulfilled

outstanding_required_quantity = 0
    → fully_fulfilled
```

Cancelled/disposed/lost/resolved quantities count only according to approved resolution policy.

### 27.3 Exception aggregation

```text
IF any active blocking hold
    exception_status = on_hold
ELSE IF any active blocking issue/approval/delivery/vendor exception
    exception_status = blocked
ELSE IF any active non-blocking warning
    exception_status = needs_attention
ELSE
    exception_status = normal
```

### 27.4 Custody aggregation

```text
IF no required physical content is received
    custody_summary_status = not_received or customer

ELSE IF all outstanding physical content has the same custody owner class
    custody_summary_status = that class

ELSE IF outstanding physical content spans owner classes
    custody_summary_status = mixed

ELSE IF no outstanding required physical content remains in tenant responsibility
    custody_summary_status = released

ELSE
    custody_summary_status = unknown
```

### 27.5 Commercial aggregation

Commercial status may be command-driven at early stages and policy-derived at completion.

```text
confirmed → in_progress
    when active responsibility begins

in_progress → completed
    when operational and fulfilment completion policies pass
    and no unresolved customer obligation remains

completed → closed
    when financial closure and issue/return/dispute closure policies pass
```

---

## 28. Ready and release matrix

| Operational | Financial/release eligibility | Fulfilment | Allowed presentation/action |
|---|---|---|---|
| `ready` | Allowed | `not_fulfilled` | Release/dispatch action available |
| `ready` | Payment required | `not_fulfilled` | Show Ready; block release with payment action |
| `partially_ready` | Allowed for selected units | `not_fulfilled` | Partial release may be available |
| `ready` | Allowed | `partially_fulfilled` | Release remaining units |
| `operationally_completed` | Allowed | `fully_fulfilled` | Commercial completion evaluation |
| Any | Blocked/hold | Any | Show blocker; no prohibited action |

---

## 29. Mixed-service examples

### Example A — Internal and outsourced work

Order:

```text
commercial_status = in_progress
operational_status = processing
fulfilment_status = not_fulfilled
custody_summary_status = mixed
exception_status = normal
```

Work groups:

```text
Laundry group:
  current_stage_code = qa
  progress_status = in_progress

Carpet group:
  current_stage_code = outsourcing
  progress_status = in_progress
  custody = vendor
```

### Example B — Partial fulfilment

```text
commercial_status = in_progress
operational_status = partially_ready
fulfilment_status = partially_fulfilled
custody_summary_status = mixed
exception_status = normal
```

### Example C — Ready but unpaid

```text
operational_status = ready
fulfilment_status = not_fulfilled
payment_status = Order Fin pending/pay-on-collection representation
exception_status = normal
release eligibility = payment_required
```

### Example D — Vendor delay

```text
operational_status = processing
fulfilment_status = not_fulfilled
custody_summary_status = vendor
exception_status = needs_attention or blocked according to severity
```

---

## 30. UI projection

The operational UI should normally show:

```text
Headline: In Progress
Current activity: Quality Check
Progress: 8 of 12 pieces Ready
Attention: Vendor return delayed
Primary action: Review Order
```

The UI does not need to display every raw status field together.

Detailed tabs:

- Work
- Fulfilment
- Payment
- Issues
- History

---

## 31. Compatibility map

| Existing value/field | V1 treatment |
|---|---|
| `current_status` | Physical operational-summary field during migration |
| `status` | Temporary dual-written compatibility alias |
| `current_stage` | Temporary order-level compatibility projection |
| `preparing` | Canonical operational summary for active Preparation |
| `preparation` | Compatibility alias mapped to `preparing` where evidence confirms equivalent meaning |
| `processing` | Maps to operational `processing`; detailed stage remains separate |
| `assembly` / `qa` / `packing` | Detailed stage values; order operational summary generally `processing` |
| `ready` | Operational `ready` when all required outstanding content is Ready |
| `out_for_delivery` | Delivery/release detail; order fulfilment still not/partially fulfilled |
| `delivered` | Delivery outcome; order fulfilment aggregation determines full/partial |
| `completed` | Must be contextually classified before migration; no global blind mapping |
| `closed` | Commercial `closed` only where existing meaning is verified |
| `cancelled` | Commercial cancellation plus detailed domain cancellation as applicable |

---

## 32. Data integrity invariants

1. Exactly one current commercial status per order.
2. Exactly one operational summary per order.
3. Exactly one fulfilment summary per order.
4. Detailed stages belong to active workflow instances/work groups.
5. A work group references one immutable workflow version.
6. A piece has one current custody owner class.
7. A piece cannot belong to overlapping active releases.
8. A piece cannot belong to overlapping active outsource jobs.
9. Released quantity cannot exceed required releasable quantity.
10. Fulfilment summary is rebuildable from release obligations.
11. Operational summary is rebuildable from work groups/items/pieces.
12. Exception summary is rebuildable from active issues/holds/approvals.
13. Customer milestone is rebuildable from canonical states.
14. Clients cannot directly set aggregation fields.
15. Terminal configuration versions are immutable.
16. Every transition and override is audited.
17. Tenant IDs must match across all related records.
18. Cross-tenant relationships are forbidden.
19. Status codes must exist in the approved catalog.
20. Unsupported status combinations must be rejected or flagged.

---

## 33. Status combination validation examples

Invalid or suspicious combinations:

| Combination | Result |
|---|---|
| `commercial_status = closed` and active release exists | Reject/repair required |
| `fulfilment_status = fully_fulfilled` and unreleased required piece exists | Drift defect |
| `custody_summary_status = released` and active vendor job holds a piece | Drift defect |
| `operational_status = ready` and blocking QA failure exists | Reject unless approved override |
| Piece `released` and active outsource line exists | Reject |
| Release `delivered` without required POD when policy requires it | Reject |
| Workflow version `published` modified in place | Reject |
| Customer milestone `completed` while fulfilment not full | Reject projection |
| `exception_status = normal` with active blocking hold | Rebuild projection |

---

## 34. Required APIs and events

All new APIs must expose explicit fields rather than a generic status-only response.

Minimum event facts:

- Action code.
- Entity type/id.
- Previous and new domain state.
- Updated projections.
- Workflow version.
- Actor.
- Tenant.
- Correlation/idempotency IDs.
- Rule trace.
- Override/approval.
- Release/outsource/delivery references where applicable.

---

## 35. Testing matrix for state architecture

Required tests:

- Every legal commercial transition.
- Every illegal commercial transition.
- Operational aggregation across mixed work groups.
- Partial-ready aggregation.
- Fulfilment aggregation across multiple releases.
- Custody aggregation across branch/vendor/driver.
- Exception priority.
- Ready with payment due.
- Partial fulfilment with remaining outsourced piece.
- QA failure/rework.
- Failed delivery return to branch.
- Post-delivery issue without lifecycle rewind.
- Duplicate release prevention.
- Duplicate outsourcing prevention.
- Projection rebuild.
- Legacy compatibility mapping.
- Cross-tenant isolation.
- Concurrent transition and projection update.
- Idempotent retries.
- Arabic customer milestone rendering.

---

## 36. Implementation sequencing

1. Add code catalogs and contracts.
2. Add new order summary columns without removing legacy fields.
3. Add work-group/workflow-instance state.
4. Add aggregation service and drift metrics.
5. Migrate facade callers.
6. Add fulfilment/release details.
7. Add outsourcing details.
8. Backfill only verified data.
9. Switch APIs/UI to explicit domain fields.
10. Retire legacy fields only after measurable zero dependency.

---

## 37. Final rule

`current_status` is not retained in the final V1 schema. `operational_status` is the explicit order-level operational projection, and it is not the complete state architecture.

All V1 technical designs must conform to the ownership and status catalogs in this document.
