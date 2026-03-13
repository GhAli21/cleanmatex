---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature

## Overview

B2B (Business-to-Business) enables corporate customer management, contracts, credit limits, consolidated billing, statements, and credit control. B2B customers are laundry businesses serving hotels, offices, clinics, and other corporate clients.

## Scope

- **B2B customers**: `org_customers_mst` with `type = 'b2b'` plus company_name, tax_id, credit_limit, payment_terms_days
- **Multi-contact support**: `org_b2b_contacts_dtl` for billing, delivery, primary contacts
- **Contracts**: `org_b2b_contracts_mst` — effective dates, pricing terms
- **Statements**: `org_b2b_statements_mst` — consolidated invoicing
- **Credit limit enforcement**: Warn or block orders when limit exceeded
- **Dunning**: Overdue reminders (email/SMS, optional order hold)

## Navigation

- Dashboard → B2B (gated by `b2b_contracts` feature flag)
  - Customers — list of B2B customers
  - Contracts — contract management
  - Statements — consolidated billing
- Customer detail → B2B section (company info, contacts tab, contracts, statements)
- New Order → B2B customer selection, contract selection, credit limit display

## Cross-References

- [Requirements](../../Requirments_Specifications/clean_mate_x_unified_requirements_pack_v_0.12.1.md) — FR-B2B-001, FR-B2B-002, UC14
- [Pricing](../pricing/) — B2B price list type
- [Customer Management](../003_customer_management/) — customer type extension
- [Finance/Invoices](../../dev/finance_invoices_payments_dev_guide.md) — invoice B2B extension
- [Master Plan](../../plan/master_plan_cc_01.md) — Phase 5 B2B
- [Platform](../../platform/) — permissions, feature flags, plan limits

## Key Documentation

- [Source PRD 036](technical_docs/source_prd_036.md) (moved from plan_cr)
- [Implementation Requirements](implementation_requirements.md)
- [Development Plan](development_plan.md)
- [Technical Data Model](technical_docs/tech_data_model.md)
- [API Specification](technical_docs/tech_api_specification.md)
- [B2B Feature Lookup](B2B_Feature_lookup.md)
