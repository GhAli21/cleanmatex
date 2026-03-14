---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature Current Status

## State

**Implementation**: Core B2B flows implemented. Migrations 0147–0153 applied (user applies 0152, 0153 manually).

## Implemented

- **Database**: org_customers_mst B2B columns, is_credit_hold; org_b2b_contacts_dtl, org_b2b_contracts_mst, org_b2b_statements_mst; org_orders_mst credit_limit_override_by/at
- **APIs**: b2b-contacts, b2b-contracts, b2b-statements (CRUD + generate), overdue-statements, run-dunning-actions
- **Permissions**: b2b_customers, b2b_contacts, b2b_contracts, b2b_statements (view/create)
- **Navigation**: B2B section (Customers, Contracts, Statements) gated by b2b_contracts
- **Credit limit**: Check on order creation; B2B_CREDIT_LIMIT_MODE (warn/block); plan cap enforcement; override audit on order
- **Credit hold**: Block new orders when is_credit_hold (set by dunning hold_orders)
- **Invoice filter**: By invoice_type_cd (RETAIL vs B2B)
- **Statement print**: B2BStatementsPrintRprt, statement detail page with print
- **Dunning**: Overdue statements UI; B2B_DUNNING_LEVELS; executeDunningActions (email, sms, hold_orders)
- **Tenant settings**: B2B_CREDIT_LIMIT_MODE, B2B_DUNNING_LEVELS (migration 0149)

## Blockers

- None.

## Dependencies

- Invoices & Payments — implemented; extended for B2B
- Customer Management — extended for B2B type
- Feature flag `b2b_contracts` — gates nav and APIs
