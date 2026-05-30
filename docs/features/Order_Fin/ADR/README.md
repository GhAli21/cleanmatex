# CleanMateX Order Finance ADR Decision Pack

**Generated:** 2026-05-30

This pack contains one ADR file per finalized decision across Order Fin, Gift Card, Business Voucher, AR Invoice, Tax Documents, Order Details UI, Order Edit, and schema cleanup.

## Index

- [ADR-001-order-total-full-sale-value.md — Order Total Is Full Sale Value Before Settlement](./ADR-001-order-total-full-sale-value.md)
- [ADR-002-gift-card-credit-application-not-discount.md — Gift Card Redemption Is a Credit Application, Not a Discount](./ADR-002-gift-card-credit-application-not-discount.md)
- [ADR-003-real-payments-vs-credit-applications.md — Separate Real Payments from Credit Applications](./ADR-003-real-payments-vs-credit-applications.md)
- [ADR-004-business-voucher-wiring-owns-effects.md — Business Voucher Wiring Owns Payment and Credit Effect Rows](./ADR-004-business-voucher-wiring-owns-effects.md)
- [ADR-005-business-voucher-phase-1a.md — Business Voucher Wiring Phase 1A Scope](./ADR-005-business-voucher-phase-1a.md)
- [ADR-006-ar-invoice-receivable-only.md — AR Invoice Is Receivable-Only](./ADR-006-ar-invoice-receivable-only.md)
- [ADR-007-tax-documents-separate.md — Tax Documents Are Separate from AR Invoices](./ADR-007-tax-documents-separate.md)
- [ADR-008-pay-on-collection-not-ar.md — PAY_ON_COLLECTION Is Operational Outstanding, Not AR](./ADR-008-pay-on-collection-not-ar.md)
- [ADR-009-ar-receivable-display-source.md — AR Receivable Display Uses Invoice Outstanding When Invoice Exists](./ADR-009-ar-receivable-display-source.md)
- [ADR-010-order-details-ui-separation.md — Order Details UI Separates Order Value, Settlement, Receivable, and Tax](./ADR-010-order-details-ui-separation.md)
- [ADR-011-extras-in-items-base-current-mode.md — Current Mode Includes Piece/Preference Extras in Items Base Amount](./ADR-011-extras-in-items-base-current-mode.md)
- [ADR-012-piece-preference-breakdowns-visible.md — Piece and Preference Extra Prices Remain Visible as Breakdowns](./ADR-012-piece-preference-breakdowns-visible.md)
- [ADR-013-total-credit-applied-canonical.md — total_credit_applied_amount Is Canonical for Credits](./ADR-013-total-credit-applied-canonical.md)
- [ADR-014-total-discount-canonical.md — total_discount_amount Is Canonical for Commercial Discounts](./ADR-014-total-discount-canonical.md)
- [ADR-015-total-tax-canonical.md — total_tax_amount Is Canonical for Order Tax](./ADR-015-total-tax-canonical.md)
- [ADR-016-canonical-order-fin-columns.md — Canonical Order Financial Snapshot Columns](./ADR-016-canonical-order-fin-columns.md)
- [ADR-017-rename-net-receivable.md — Rename net_receivable_amount to ar_receivable_amount](./ADR-017-rename-net-receivable.md)
- [ADR-018-safe-legacy-drop.md — Legacy Order Financial Columns Must Be Dropped Safely](./ADR-018-safe-legacy-drop.md)
- [ADR-019-conservative-gift-card-backfill.md — Backfill Gift Card Affected Orders Conservatively](./ADR-019-conservative-gift-card-backfill.md)
- [ADR-020-recalculate-payment-status.md — Payment Status Must Be Recalculated After Financial Repair](./ADR-020-recalculate-payment-status.md)
- [ADR-021-mobile-payment-real-payment.md — MOBILE_PAYMENT Is a Real External Payment Method](./ADR-021-mobile-payment-real-payment.md)
- [ADR-022-credit-source-required.md — Credit Application Source Reference Is Required](./ADR-022-credit-source-required.md)
- [ADR-023-stored-value-not-tax-discount.md — Stored-Value Credits Do Not Reduce Taxable Amount](./ADR-023-stored-value-not-tax-discount.md)
- [ADR-024-refund-respects-stored-value.md — Refund Paths Must Respect Stored-Value Settlement](./ADR-024-refund-respects-stored-value.md)
- [ADR-025-reports-use-canonical-fields.md — Financial Reports Must Use Canonical Order Fin Fields](./ADR-025-reports-use-canonical-fields.md)
- [ADR-026-order-edit-delta-model.md — Order Edit Uses Financial Delta Model](./ADR-026-order-edit-delta-model.md)
- [ADR-027-order-edit-lock-history.md — Order Edit Requires Lock and History](./ADR-027-order-edit-lock-history.md)
- [ADR-028-tax-documents-immutable.md — Issued Tax Documents Are Immutable](./ADR-028-tax-documents-immutable.md)
- [ADR-029-debug-tab-admin-only.md — Order Details Raw Financial Snapshot Belongs in Admin Debug Tab](./ADR-029-debug-tab-admin-only.md)
- [ADR-030-currency-required.md — Order Currency Code Is Required and Has No Hardcoded Default](./ADR-030-currency-required.md)
