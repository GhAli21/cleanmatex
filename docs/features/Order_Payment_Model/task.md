# Payment Modal V4 Center Workbench Redesign Tracker

## Approved Target
- Expected visual reference: `docs/features/Order_Payment_Model/new_payment_modal_v4.png`
- Product direction: move all editing/action work out of the right rail.
- Center workbench answers: "What do I need to do now?"
- Right receipt brain answers: "What is the payment result?"

## Guardrails
- No API, schema, migration, permission, navigation, payload, or settlement semantic changes.
- Preserve gateway/cash `amountToCharge`, submit behavior, validation focus, and cash drawer persistence.
- Use Cmx components only.
- Maintain EN/AR i18n and RTL support.

## Progress
- [x] Tracker refreshed before UI edits.
- [x] Pass 1: Add section-definition helper and unit tests.
- [x] Pass 2: Recompose existing center sections without behavior changes.
- [x] Pass 3: Move Discounts & Credits edit flows into center.
- [x] Pass 4: Move Cash Drawer work area into center.
- [x] Pass 5: Add Financial Inspector tabs and move read-heavy details there.
- [x] Pass 6: Slim right rail to Receipt Brain summaries and jump links.
- [x] Pass 7: Polish responsive, RTL, accessibility, spacing, states, and visual consistency.
- [x] Documentation refresh and final documentation-skill pass.

## Validation Ledger
- Passed: `npm run test --workspace=web-admin -- __tests__/features/orders/payment-modal-v04-sections-definition.test.ts --runInBand`.
- Passed: `npm run typecheck --workspace=web-admin`.
- Passed: `npm run check:i18n --workspace=web-admin`.
- Passed: `npm run test --workspace=web-admin -- __tests__/features/orders/payment-modal-v04-sections-definition.test.ts __tests__/features/orders/payment-modal-v4.right-rail.test.ts __tests__/features/orders/payment-modal-v4.utils.test.ts --runInBand`.
- Passed: focused ESLint on touched payment modal files and tests.
- Passed: `npm run build --workspace=web-admin`.

## Risks / Follow-Ups
- `payment-modal-v4.tsx` is large; keep passes surgical and avoid finance logic rewrites.
- The right rail must remain read-only except for focus/jump shortcuts.
- Validate split-payment, gift-card, cash-drawer, B2B/AR, and deferred-policy scenarios after layout changes.
