# Payment Modal V4 Center Workbench Redesign Plan

## Summary
- Adopt the strongest UX recommendation: **move all editing/action work out of the right rail**.
- The center becomes the cashier’s **Payment Workbench**: “What do I need to do now?”
- The right rail becomes the compact **Receipt Brain**: “What is the payment result?”
- The expected visual target is [new_payment_modal_v4.png](f:/jhapp/cleanmatex/docs/features/Order_Payment_Model/new_payment_modal_v4.png).
- Add `payment-modal-v04-sections-definition.ts` to control center section order, visibility, labels, and default expansion.
- Preserve backend contracts, submit payloads, validation rules, payment calculations, cash drawer persistence, and settlement semantics.

## Key Changes
- Center section order:
  - **Section A: Balance Snapshot** keeps the current top remaining/change/total summary.
  - **Section B: Amount Editor** keeps active payment amount and keypad.
  - **Section C: Payment Workspace** keeps active leg details, validation fixes, method-specific fields, and required-action handling.
  - **Section E: Discounts & Credits** becomes the only edit surface for manual discounts, percent discount, promo codes, gift-card code/PIN/apply/remove, and live effect.
  - **Section F: Cash Drawer** becomes the only cash drawer work area and appears only when a cash leg exists.
  - **Section G: Financial Inspector** uses tabs for Order Value, Tax Breakdown, Discount Breakdown, Warnings, B2B/AR, and Payment Notes.
  - **Section D: Balance Policy** appears last and only when remaining balance needs policy selection.
- Right rail changes:
  - Keep Customer, Balance Result, Required Action summary, Settlement Now, and compact shortcut rows.
  - Remove editable controls from the rail.
  - Right-rail shortcuts jump/focus the matching center section instead of expanding large rail cards.
- Left rail changes:
  - Keep payment method selection, wallet/customer credit method selection, and payment legs.
  - Move cash drawer selector/session controls to Section F.

## Implementation Workflow
- Start by creating or refreshing the implementation tracker for this redesign, including the expected screenshot path, section list, decisions, and acceptance criteria.
- After each implementation step, update the tracker with status/progress, completed files, validation run, known risks, and next step.
- Implement in small safe passes:
  - Pass 1: Add section-definition types/helpers and tests.
  - Pass 2: Extract/recompose Center Workbench sections without behavior changes.
  - Pass 3: Move Discounts & Credits edit flows into center.
  - Pass 4: Move Cash Drawer work area into center.
  - Pass 5: Add Financial Inspector tabs and move read-heavy detail cards there.
  - Pass 6: Slim right rail to Receipt Brain summaries and jump links.
  - Pass 7: Polish responsive behavior, RTL, accessibility, focus, and visual consistency.
- Refresh related feature documentation during the work, not only at the end.
- Final task: use the documentation skill to generate/update all needed docs, including implementation status, UI/UX notes, i18n key inventory, test coverage, assumptions, and risks/follow-ups.

## Architecture / Interfaces
- Add a local section definition model:
  - `PaymentModalSectionId`
  - `PaymentModalSectionDefinition`
  - `PAYMENT_MODAL_V04_SECTIONS`
  - `deriveVisiblePaymentSections(context)`
- Keep `PaymentModalV4` as the state container for this pass.
- Extract center sections into co-located presentational components where safe, instead of growing the already-large modal file further.
- No API, schema, DB, migration, payload, `amountToCharge`, gateway, cash, or settlement behavior changes.
- Add EN/AR i18n keys for section titles, tab labels, helper copy, empty states, and shortcut labels.

## Test Plan
- Unit-test section order and visibility:
  - Cash Drawer appears only when a cash leg exists.
  - Balance Policy appears only when remaining balance requires policy.
  - Discounts & Credits appears when enabled, edited, or applied.
  - Financial Inspector tabs include only relevant warning/B2B/AR states.
- Regression-test cashier workflows:
  - Gift-card code Enter fetches; PIN fetches; apply amount Enter applies.
  - Manual discount amount and percent sync remains unchanged.
  - Cash drawer blockers focus Section F.
  - Right-rail shortcut focuses the correct center section.
  - Tax and order value remain readable after moving from rail to inspector tabs.
- Run typecheck, targeted Jest tests, i18n check, focused ESLint, and production build.
- Add progress notes after each validation pass to the implementation tracker.

## Assumptions
- The right rail is intentionally read-only except jump/focus shortcuts.
- Payment Notes move into the Financial Inspector.
- Balance Policy stays last visually, while Required Action can still jump to it immediately.
- This is a UX/component architecture redesign only; finance and submission semantics remain unchanged.
- Documentation must be refreshed throughout and finalized with the documentation skill before the work is considered complete.
