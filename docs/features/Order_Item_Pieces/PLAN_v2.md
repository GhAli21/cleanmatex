# Payment Modal V4 Center Workbench Redesign Execution Plan

## Summary
- Implement the approved visual target: [new_payment_modal_v4.png](f:/jhapp/cleanmatex/docs/features/Order_Payment_Model/new_payment_modal_v4.png).
- Apply the strongest recommendation: **all editing/action work moves out of the right rail**.
- Center becomes the **Payment Workbench** for cashier actions; right rail becomes the compact read-only **Receipt Brain**.
- Keep finance semantics unchanged: no API/schema/migration/payload changes, no changes to gateway/cash `amountToCharge`, submit behavior, settlement calculations, validation rules, or cash drawer persistence.
- Track progress after every step and refresh documentation continuously, with a final documentation-skill pass before completion.

## Implementation Changes
- Add `payment-modal-v04-sections-definition.ts` with:
  - `PaymentModalSectionId`
  - `PaymentModalSectionDefinition`
  - `PAYMENT_MODAL_V04_SECTIONS`
  - `deriveVisiblePaymentSections(context)`
- Implement center sections in this order:
  - **Section A: Balance Snapshot**: existing remaining/change/total summary.
  - **Section B: Amount Editor**: existing active amount field and keypad.
  - **Section C: Payment Workspace**: active leg, required action, method details, validation fixes.
  - **Section E: Discounts & Credits**: manual discount, percent discount, promo, gift-card code/PIN/apply/remove, live effect.
  - **Section F: Cash Drawer**: drawer/session management, cash retained, change returned; visible only when a cash leg exists.
  - **Section G: Financial Inspector**: Cmx tabs for Order Value, Tax Breakdown, Discount Breakdown, Warnings, B2B/AR, Payment Notes.
  - **Section D: Balance Policy**: last section, visible only when remaining balance needs a policy.
- Slim right rail to read-only Receipt Brain:
  - Customer, sticky Balance Result, Required Action summary, Settlement Now, compact shortcuts.
  - Shortcuts jump/focus matching center sections.
  - Remove editable controls and large detail cards from the right rail.
- Keep left rail focused on payment tools:
  - Payment methods, wallet/customer credit selection, payment legs.
  - Move cash drawer selection/session controls to Section F.
- Use Cmx components only, preserve RTL, keyboard accessibility, focus-to-error behavior, responsive behavior, and current V4 visual language.

## Execution Workflow
- Create or refresh an implementation tracker for this redesign before code work.
- After each pass, update tracker status/progress with completed scope, files touched, validation run, risks, and next step.
- Pass 1: Add section-definition helper and unit tests.
- Pass 2: Extract/recompose existing center sections without behavior changes.
- Pass 3: Move Discounts & Credits edit flows into center.
- Pass 4: Move Cash Drawer work area into center.
- Pass 5: Add Financial Inspector tabs and move read-heavy details there.
- Pass 6: Slim right rail to Receipt Brain summaries and jump links.
- Pass 7: Polish responsive, RTL, accessibility, spacing, states, and visual consistency.
- Refresh related documentation during the work.
- Final task: use the documentation skill to generate/update all needed docs, including implementation status, UI/UX notes, i18n inventory, tests, assumptions, and risks/follow-ups.

## Test Plan
- Unit tests:
  - Section order and visibility.
  - Cash Drawer section only appears with a cash leg.
  - Balance Policy appears only when needed.
  - Discounts & Credits appears when enabled, edited, or applied.
  - Financial Inspector tabs include only relevant B2B/AR and warning states.
- Regression tests:
  - Gift-card Enter/fetch/PIN/apply amount flow.
  - Manual discount amount/percent sync.
  - Promo apply/remove.
  - Cash drawer blockers focus Section F.
  - Right-rail shortcuts focus correct center sections.
  - Tax/order value/payment notes remain readable in Financial Inspector.
  - Submit confirmation, blocked submit focus, and footer summary remain intact.
- Validation:
  - `npm run typecheck --workspace=web-admin`
  - Targeted Jest tests for payment modal helpers/section definitions
  - `npm run check:i18n --workspace=web-admin`
  - Focused ESLint on touched files
  - `npm run build --workspace=web-admin`

## Assumptions
- This is a UI/component architecture redesign only.
- Right rail is read-only except shortcut/focus actions.
- Payment Notes move to Financial Inspector.
- Required Action can jump to any center section, even if Balance Policy remains visually last.
- No database, backend, permission, navigation, feature-flag, or migration work is required.
