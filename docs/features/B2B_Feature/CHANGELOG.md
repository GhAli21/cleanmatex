# B2B Feature Changelog

## [v1.1.0] - 2026-03-14

### Added

- Migration 0152: credit_limit_override_by, credit_limit_override_at on org_orders_mst
- Migration 0153: is_credit_hold on org_customers_mst
- Credit limit override audit: when admin overrides in payment modal, order stores override_by/at
- Credit hold: block new orders when customer is_credit_hold (B2B_CREDIT_HOLD error)
- Dunning actions automation: executeDunningActions (email, sms, hold_orders)
- POST /api/v1/b2b/run-dunning-actions (manual with b2b_statements:create, or cron with CRON_SECRET + x-tenant-id)
- Integration test: createWithPaymentRequestSchema (creditLimitOverride, B2B fields)

### Changed

- create-with-payment: accepts creditLimitOverride; bypasses credit check when override
- credit-limit.service: returns isCreditHold; blocks when customer is_credit_hold
- dunning.service: executeDunningActions sends email/SMS, sets is_credit_hold

## [v1.0.0] - 2026-03-13

### Added

- Initial B2B feature documentation structure
- Implementation plan and technical specifications
- Data model: org_customers_mst B2B columns, org_b2b_contacts_dtl, org_b2b_contracts_mst, org_b2b_statements_mst
- Implementation requirements checklist
- Migration 0147: B2B tables and org_invoice_mst extensions
- Migration 0148: B2B navigation and permissions
- Migration 0149: B2B tenant settings (B2B_CREDIT_LIMIT_MODE, B2B_DUNNING_LEVELS)
- B2B API routes: contacts, contracts, statements (CRUD + generate), overdue-statements
- B2B services: b2b-contacts, b2b-contracts, b2b-statements, credit-limit, dunning, credit-limit-plan-cap
- B2B pages: customers, contracts, statements, statement detail with print
- Credit limit check in payment modal (warn vs block, override checkbox)
- Plan cap enforcement for credit_limit when creating B2B customer
- Invoice list filter by invoice_type_cd (RETAIL vs B2B)
- Statement print component (B2BStatementsPrintRprt) and detail page
- Dunning: overdue statements section with B2B_DUNNING_LEVELS (days → action) in UI
- Tenant settings: getSettingValueJson for JSONB settings (e.g. B2B_DUNNING_LEVELS)
- Unit tests: credit-limit-plan-cap (capCreditLimitToPlan), dunning (evaluateDunningLevels)
- jest.setup.js: minimal setup for Jest (fixes missing file error)
