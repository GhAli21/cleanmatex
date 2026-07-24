# CleanMateX Order Workflow V1 — Web Admin UI/UX Specification

**Document ID:** CMX-OW-V1-PACK-009  
**Version:** 1.0  
**Status:** Implementation specification  
**Frontend:** Next.js, React, TypeScript, TailwindCSS, i18n

## 1. Principle

Keep the business interface simple while the platform handles complexity behind it.

## 2. Visible summary

```text
Order #CMX-1050
In Progress
Current activity: Quality Check
8 of 12 pieces ready
Needs attention: Vendor return delayed
```

Do not show all raw status dimensions together.

Detailed tabs:

- Work
- Fulfilment
- Payment
- Issues
- Timeline

## 3. One primary action

- Preparation: Complete Preparation
- Processing: Complete Processing
- QA: Pass Quality Check
- Packing: Complete Packing
- Ready: Collect / Prepare Delivery
- Outsourcing: Receive from Vendor
- Driver: Confirm Delivery

Secondary actions use a menu or secondary zone.

## 4. Backend-driven actions

Pages render `available-actions`. Frontend does not calculate the next stage. Disabled actions display blockers and suggested resolution.

## 5. Orders list

Columns:

- Order number
- Customer
- Main status
- Current activity
- Progress
- Ready-by
- Fulfilment method
- Attention
- Balance summary
- Branch
- Primary action

Advanced filters are collapsible.

## 6. Order workspace

Header shows customer/order, visible status, ready-by, payment, attention, and primary action.

Tabs:

- Overview
- Items & Pieces
- Work
- Fulfilment
- Payment
- Issues
- Timeline

## 7. Queue pages

Preparation, Processing, Assembly, QA, Packing, Ready, Outsourcing, Dispatch, Delivery exceptions, and Pickup. Each queue shows only relevant fields.

## 8. Preparation

Quick Drop declared/actual counts, itemization, services, preferences, stains/damage, photos, price/ready-by impact, customer approval, and outsourcing decision.

## 9. Processing

Work group, items/pieces, steps, scans, preferences, ready-by, and issues.

## 10. QA

Checklist, piece status, observations, photos, pass/fail, rework destination, and override. Primary is Pass Quality Check; Report Problem is secondary.

## 11. Packing

Fold/hang, optional package, label, packing list, storage/rack, and missing-piece warning.

## 12. Ready/collection

Ready and remaining items, balance, release eligibility, recipient verification, OTP/PIN, and partial selection. Primary adapts to Collect Payment and Hand Over or Hand Over Selected Items.

## 13. Partial fulfilment

Categories:

- Ready and eligible
- Ready but blocked
- Not ready
- Already released

Show selected count/value, release method, and remaining count before confirmation.

## 14. Outsourcing

Queue card shows vendor, order/group, piece count, status, expected return, overdue, and next action. Workspace includes lines, service, costs, custody, reconciliation, internal QA, and history.

## 15. HQ workflow area

- Workflow catalog
- Version editor
- Stage list
- Rule builder
- Gates
- Milestones
- Simulation
- Validation
- Impact preview
- Review/approve/publish
- Assignments
- Version history

Tenant area is read-only/limited.

## 16. Rule builder

```text
IF [Service Category] [equals] [Carpet]
AND [Outsourcing Required] [is true]
THEN [Outsourcing]
Priority [10]
```

No code editor.

## 17. Blockers

```text
Cannot hand over
• OMR 8.500 outstanding
• Customer PIN required

[Open Payment] [Send PIN Again]
```

Use actionable messages.

## 18. Progressive disclosure

Normal staff see headline, activity, action, and blockers. Managers/support may inspect work groups, rule trace, and history. Raw codes are not shown to operators.

## 19. RTL/Arabic

- Mirrored layout
- Arabic alignment
- Order/barcode identifiers remain LTR
- Locale-aware numbers/currency
- English/Arabic action/status/error/reason labels
- Mixed-script testing

## 20. Accessibility

Keyboard navigation, visible focus, semantic buttons, associated errors, screen-reader labels, no color-only status, appropriate touch targets, and RTL focus order.

## 21. Reusable components

- OrderStatusSummary
- OperationalActivityBadge
- AttentionIndicator
- WorkflowPrimaryAction
- AvailableActionsMenu
- WorkflowBlockerPanel
- WorkGroupProgress
- PieceSelectionTable
- ReleaseEligibilitySummary
- CustomerVerificationPanel
- OutsourceJobStatus
- WorkflowTimeline
- HqWorkflowStageEditor
- ConditionalRuleBuilder

Keep files separated by feature and concern.

## 22. States

Every page supports loading, empty, permission denied, stale conflict, partial failure, retry, and offline driver status where applicable.

## 23. Acceptance criteria

- One primary action.
- No arbitrary status dropdown.
- Backend supplies actions.
- Partial fulfilment is understandable in one workspace.
- HQ configuration is separate.
- Critical screens pass RTL/accessibility.
