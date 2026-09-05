# Order Workspace testing guide and scenarios

**Status:** Required verification guide  
**Canonical scope:** [README.md](README.md)  
**Current implementation state:** [current_status.md](current_status.md)

## Pre-test setup

- Use a tenant and user that already have access to the existing Order Details page.
- Prepare representative orders for intake, preparation, processing, QA failure, ready with balance due, ready and settled, delivered, completed, and cancelled states where supported by the existing workflow.
- Include an order with `customer_mobile_number`, one with an order-level delivery address/location, one with special instructions, and one with no optional context.
- Include payment scenarios only through existing seeded/test data and the standard payment flow. Do not alter orders or money directly through SQL.
- Test English and Arabic; test an RTL browser/layout for Arabic.

## Functional scenarios

| ID | Scenario | Expected result |
|---|---|---|
| OW-01 | Open Order workspace from an existing Order Details page | New hidden route opens; legacy page remains intact; return action returns to the safe originating location |
| OW-02 | Open workspace with a valid `section` URL value | Requested supported section is shown; invalid value safely falls back to Overview |
| OW-03 | Review Overview on an intake/preparation order | Order identity, localized state, next valid action, blockers, work progress, customer context, and financial snapshot are visible without entering a deep section |
| OW-04 | Execute an available workflow action | Existing canonical action path is used; loading prevents duplicate submission; success/error feedback is shown; data refreshes coherently |
| OW-05 | Attempt an unavailable transition | No mutation occurs; exact prerequisite/reason is understandable and non-technical |
| OW-06 | Ready order with money due | Workspace presents a context-aware Collect payment action that navigates to the existing standard payment flow; no workspace payment form or money mutation appears |
| OW-07 | Customer phone | `org_orders_mst.customer_mobile_number` is displayed when available; copy action gives localized success/failure feedback; no call/SMS/WhatsApp action is implied |
| OW-08 | Delivery context | Workspace displays only fields supplied by the canonical order-level delivery context; it does not silently substitute a customer-profile address |
| OW-09 | No address, phone, items, preferences, activity, or delivery proof | Each state uses an explanatory domain-specific empty state and never generic “No data” |
| OW-10 | Activity | Shows only proven, localized, permission-safe events; no raw codes, JSON, scan/print/tracking-copy events, or rich QA claims without a validated source |
| OW-11 | Financial data unavailable | Safe retry state appears; loaded operational context remains usable where possible |
| OW-12 | Stale state caused by another operator | User receives a clear refresh/recovery path; stale transition is not silently retried or applied |
| OW-13 | Not found or inaccessible order | Safe recovery is offered without tenant identifiers, RLS details, raw errors, or technical payloads |

## Responsive and interaction checks

| Viewport | Required check |
|---|---|
| 320px | Primary workflow action remains immediately discoverable (sticky action treatment if implemented); no page-level horizontal overflow; secondary actions use a Cmx sheet/drawer/menu |
| 768px | Header/actions wrap without losing hierarchy; section navigation remains usable; cards do not become cramped |
| 1024px | Full-width workflow rail and legible overview composition; no clipped action labels |
| 1440px | Operational column receives priority; finance does not dominate the first screen; excess whitespace does not disconnect actions from order context |

## Accessibility and localization checks

- Navigate all sections, menus, action controls, drawers/dialogs, retry controls, and copy controls with a keyboard only.
- Confirm a visible focus indicator and logical focus return after an overlay closes.
- Confirm one page `h1` (the order identifier) and meaningful section `h2` headings.
- Confirm icon-only controls have accessible names; status has icon, localized text, and semantic styling rather than color alone.
- Confirm Cmx feedback announces copy, workflow, and retry outcomes without relying on visual changes only.
- Check English and Arabic message keys together; verify RTL logical alignment, label order, and directional icon behavior.
- Check light and dark themes for WCAG AA contrast, including warning, error, success, disabled, focus, and status elements.
- Enable reduced motion and confirm no workflow animation blocks or delays action.

## Regression checks

- Existing Order Details action row still supports Print label, Full Details, Edit, and Public tracking as before.
- Workspace adds no navigation entry, feature flag, permission, migration, payment workflow, or change to tenant isolation.
- Full Details remains reachable as a fallback.
- Money totals/labels remain consistent between Workspace snapshot and existing detailed financial views for the same order.
- Existing role restrictions remain enforced on the server, including when a direct workspace URL is entered.

## Required commands

Run from the applicable package only after implementation is complete:

```powershell
cd web-admin
npx eslint . --quiet
npm run typecheck
npm run build
```

Run focused tests for the affected route/components if the repository provides them. Record command output, browser coverage, fixture/data limitations, and unresolved scenarios in [current_status.md](current_status.md).
