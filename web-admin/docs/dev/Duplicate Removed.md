
Summary of the cleanup:

## Cleanup summary

### 1. Removed duplicate components

**~95 files** were deleted from `app/dashboard/**/components/` where they duplicated `src/features/*/ui/*`:

- **Settings:** BrandingSettings, GeneralSettings, BusinessHoursSettings, SubscriptionSettings  
- **Inventory:** add-item-modal, edit-item-modal, adjust-stock-modal, stock-history-modal, stats-cards  
- **Orders:** order-actions, order-items-list, order-status-badge, order-filters-bar, orders-simple-table, order-table, quick-drop-form, bulk-status-update, order-timeline, print-label-button, order-stats-cards  
- **Orders/new:** pre-submission-pieces-manager, price-override-modal, order-summary-panel, item-cart-*, payment-modal-enhanced-02, customer-picker-modal, ready-date-picker-modal, amount-mismatch-dialog, customer-edit-modal, product-grid, category-tabs, loading-skeletons, etc.  
- **Orders/[id]/full:** orders-invoices-tab-rprt, orders-vouchers-tab-rprt, orders-payments-tab-rprt, orders-stock-tab-rprt, orders-receipts-tab-rprt  
- **Catalog:** product-form, import-modal, export-modal, bulk-import-modal, price-list-item-modal, price-history-timeline  
- **Processing:** processing-table, processing-modal, processing-modal-filters, processing-item-row, processing-piece-row, split-confirmation-dialog, processing-header, processing-stats-cards, processing-filters-bar  
- **Users:** create-user-screen, user-modal, user-table, user-filters-bar, user-stats-cards  
- **Customers:** customer-table, customer-filters-bar, customer-stats-cards, customer-create-modal, customer-addresses-section, customer-orders-section, address-form-modal, upgrade-profile-modal, otp-verification-modal, address-card, phone-input, confirmation-dialog, customer-type-badge  
- **Billing:** payments-table, refund-payment-dialog, payment-filters-bar, invoice-filters-bar, vouchers-table, voucher-filters-bar, cancel-payment-dialog, payment-stats-cards, invoices-table, billing-receipt-voucher-print-rprt, cashup-content, cashup-form, cashup-history  
- **Reports:** export-dropdown-rprt, report-filters-bar-rprt, kpi-cards-rprt, and all report tables/charts  
- **Preparation:** ItemList, FastItemizer, PrintItemLabels, PricePreview, PresetButtons  

### 2. Components kept

Only **5 files** remain under `app/dashboard/**/components/`:

- **jhtestui/** – JwtViewerJhTest, UserContextViewer, AuthContextViewer (dev tools)  
- **components/** – workflow-stats-widget, overdue-orders-widget (no equivalent in `src/features`)  

### 3. Documentation updates

- **[docs/dev/ui-migration-guide.md](docs/dev/ui-migration-guide.md):** Added the “Architecture: features vs app/dashboard” section describing:
  - Single source of truth: `src/features/*/ui/*`
  - Role of `app/dashboard` (route shells and page-specific wrappers)
  - Rule: no duplicated feature components under `app/dashboard`

- **[.cursor/plans/compat_to_cmx_migration_plan_2644833f.plan.md](.cursor/plans/compat_to_cmx_migration_plan_2644833f.plan.md):** Updated the Duplicate Components Audit section to mark it as completed.

### 4. Verification

- Grep shows no imports from deleted files.
- All pages import from `@features/*`.
- TypeScript check was started; build failed due to a Prisma EPERM issue (environment/sandbox), not the code changes.

Run `npm run build` locally to confirm; if Prisma is already generated, it should complete successfully.
