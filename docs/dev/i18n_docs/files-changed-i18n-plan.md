# i18n Enhancement Plan — Files Created or Modified

Complete list of files created or modified during implementation of the i18n enhancement plan.

---

## New Files (Created)

| # | File Path |
|---|-----------|
| 1 | `web-admin/scripts/check-i18n-parity.js` |
| 2 | `docs/dev/i18n_docs/README.md` |
| 3 | `docs/dev/i18n_docs/style-guide.md` |
| 4 | `docs/dev/i18n_docs/future-suggestions.md` |
| 5 | `docs/dev/i18n_docs/migration-checklist.md` |
| 6 | `docs/dev/i18n_docs/common-keys-reference.md` |
| 7 | `docs/dev/i18n_docs/manual-verification-en-ar.md` |
| 8 | `docs/dev/i18n_docs/files-changed-i18n-plan.md` *(this file)* |

---

## Modified Files

### Translation & Config

| # | File Path |
|---|-----------|
| 9 | `web-admin/messages/en.json` |
| 10 | `web-admin/messages/ar.json` |
| 11 | `web-admin/package.json` |

### Billing / Invoices

| # | File Path |
|---|-----------|
| 12 | `web-admin/app/dashboard/billing/invoices/components/invoice-filters-bar.tsx` |
| 13 | `web-admin/app/dashboard/billing/payments/components/payment-filters-bar.tsx` |
| 14 | `web-admin/app/dashboard/billing/payments/components/refund-payment-dialog.tsx` |
| 15 | `web-admin/app/dashboard/billing/payments/new/create-payment-form.tsx` |

### Orders

| # | File Path |
|---|-----------|
| 16 | `web-admin/app/dashboard/orders/components/bulk-status-update.tsx` |
| 17 | `web-admin/app/dashboard/orders/components/order-table.tsx` |
| 18 | `web-admin/app/dashboard/orders/components/order-timeline.tsx` |
| 19 | `web-admin/app/dashboard/orders/new/components/order-summary-panel.tsx` |
| 20 | `web-admin/app/dashboard/orders/new/components/ready-date-picker-modal.tsx` |
| 21 | `web-admin/app/dashboard/orders/new/components/customer-picker-modal.tsx` |
| 22 | `web-admin/app/dashboard/orders/new/components/customer-edit-modal.tsx` |

### Catalog

| # | File Path |
|---|-----------|
| 23 | `web-admin/app/dashboard/catalog/services/page.tsx` |
| 24 | `web-admin/app/dashboard/catalog/services/[id]/page.tsx` |
| 25 | `web-admin/app/dashboard/catalog/services/components/product-form.tsx` |
| 26 | `web-admin/app/dashboard/catalog/services/components/import-modal.tsx` |
| 27 | `web-admin/app/dashboard/catalog/categories/page.tsx` |
| 28 | `web-admin/app/dashboard/catalog/pricing/page.tsx` |
| 29 | `web-admin/app/dashboard/catalog/pricing/[id]/page.tsx` |

### Customers

| # | File Path |
|---|-----------|
| 30 | `web-admin/app/dashboard/customers/components/customer-type-badge.tsx` |
| 31 | `web-admin/app/dashboard/customers/[id]/page.tsx` |

### Reports

| # | File Path |
|---|-----------|
| 32 | `web-admin/app/dashboard/reports/layout.tsx` |
| 33 | `web-admin/app/dashboard/reports/print/page.tsx` |

### Processing & Settings

| # | File Path |
|---|-----------|
| 34 | `web-admin/app/dashboard/processing/page.tsx` |
| 35 | `web-admin/app/dashboard/processing/components/split-confirmation-dialog.tsx` |
| 36 | `web-admin/app/dashboard/settings/users/page.tsx` |

### Shared Components

| # | File Path |
|---|-----------|
| 37 | `web-admin/components/orders/OrderPiecesManager.tsx` |
| 38 | `web-admin/components/orders/PieceHistory.tsx` |
| 39 | `web-admin/components/dashboard/UsageWidget.tsx` |

### Features (Public)

| # | File Path |
|---|-----------|
| 40 | `web-admin/src/features/orders/public/order-tracking-page.tsx` |

### Rules & Documentation

| # | File Path |
|---|-----------|
| 41 | `.cursor/rules/i18n.mdc` |
| 42 | `.cursor/rules/aicoderfrontendinstructions.mdc` |
| 43 | `.claude/skills/i18n/SKILL.md` |
| 44 | `CLAUDE.md` |

---

## Summary

| Category | Count |
|----------|-------|
| **New files** | 8 |
| **Modified – translation/config** | 3 |
| **Modified – components** | 32 |
| **Modified – rules** | 4 |
| **Total** | **47** |

---

## By Phase

| Phase | Files |
|-------|-------|
| Phase 1 (Tooling) | check-i18n-parity.js, package.json, en.json, ar.json, i18n_docs/* |
| Phase 2 (Common Consolidation) | 19+ components, en.json, ar.json |
| Phase 3 (ICU Pluralization) | bulk-status-update, order-table, order-summary-panel, pricing/[id], UsageWidget, en.json, ar.json |
| Phase 4–5 (Docs) | style-guide.md |
| Phase 6 (AI Rules) | i18n.mdc, SKILL.md, aicoderfrontendinstructions.mdc, CLAUDE.md |
| Phase 7 (Remaining) | en.json, ar.json (parity fixes), manual-verification-en-ar.md |
