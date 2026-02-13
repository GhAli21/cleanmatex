# i18n Migration Checklist

Step-by-step checklist for the i18n enhancement migration.

## Phase 1: Formatting and Tooling

- [ ] Pretty-print en.json and ar.json (2-space indentation)
- [ ] Create and run check-i18n-parity.js
- [ ] Add `check:i18n` to package.json
- [ ] Create docs/dev/i18n_docs/ (README, style-guide, future-suggestions, migration-checklist, common-keys-reference)

## Phase 2: Common Keys Consolidation

- [ ] Add `page`, `of`, `showing`, `to` to common in both en.json and ar.json
- [ ] Migrate invoice-filters-bar, payment-filters-bar to tCommon('clearFilters')
- [ ] Migrate refund-payment-dialog, create-payment-form, ready-date-picker-modal, split-confirmation-dialog, settings/users to tCommon('cancel')
- [ ] Migrate order-tracking-page, customer-picker-modal, processing/page, OrderPiecesManager, PieceHistory to tCommon('loading')
- [ ] Migrate product-form, catalog services/categories/pricing, import-modal, order-timeline, customer-edit-modal to tCommon
- [ ] Migrate customer-type-badge to use customers.types
- [ ] Migrate customers/[id]/page tab labels and type labels
- [ ] Migrate reports/layout and reports/print to use reports.table.*
- [ ] Verify customers namespace has profile, addresses, orderHistory, loyalty, types.*
- [ ] Remove duplicate keys from feature namespaces

## Phase 3: ICU Pluralization

- [ ] Update orders.bulkStatusUpdate (subtitle, confirmationMessage, successMessage, successWithFailures) to ICU
- [ ] Update order-table ordersSelected to ICU
- [ ] Update order-summary-panel, catalog/pricing/[id] item/items to ICU
- [ ] Update UsageWidget Warning/Warnings to ICU
- [ ] Update ar.json with Arabic plural forms where needed

## Phase 4: Error Messages Pattern

- [ ] Document error conventions in style-guide.md
- [ ] Optional: Audit common.errors namespace

## Phase 5: Validation Messages

- [ ] Audit components using generic validation strings
- [ ] Migrate to use validation namespace where applicable

## Phase 6: AI Coder Rules

- [ ] Update .cursor/rules/i18n.mdc
- [ ] Update .claude/skills/i18n/SKILL.md
- [ ] Update .cursor/rules/aicoderfrontendinstructions.mdc
- [ ] Update CLAUDE.md UI Quick Rules

## Phase 7: Verify

- [ ] Run npm run check:i18n
- [ ] Fix any parity issues
- [ ] Run npm run build
- [ ] Manual verify EN and AR flows
