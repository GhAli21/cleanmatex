# B2B Contracts & Corporate - Development Plan & PRD

**Document ID**: 036 | **Version**: 1.0 | **Dependencies**: 021, 024  
**FR-B2B-001, FR-B2B-002, UC14**

*Moved from docs/plan_cr/036_b2b_contracts_corporate_dev_prd.md. See B2B_Feature plan for current implementation (org_customers_mst-centric model).*

## Overview

Implement corporate customer management, contract agreements, consolidated billing, credit management.

## Requirements

- Corporate customer setup
- Contract management
- Custom pricing agreements
- Consolidated billing (monthly)
- Credit limits & terms
- Multi-user per corporate
- Cost center tracking
- Statement generation

## Database (Original Design — Superseded by B2B_Feature Plan)

*Note: Current plan uses org_customers_mst with type='b2b' + B2B columns, and org_b2b_contacts_dtl for multi-contact. See tech_data_model.md.*

```sql
CREATE TABLE org_corporate_customers (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  company_name VARCHAR(255),
  contact_person VARCHAR(255),
  credit_limit NUMERIC(10,2),
  payment_terms INTEGER -- days
);

CREATE TABLE org_b2b_contracts (
  id UUID PRIMARY KEY,
  corporate_id UUID,
  tenant_org_id UUID,
  contract_number VARCHAR(100),
  effective_from DATE,
  effective_to DATE,
  pricing_terms JSONB
);
```

## Implementation (5 days)

1. Corporate management (2 days)
2. Contracts (2 days)
3. Consolidated billing (1 day)

## Acceptance

- [ ] Corporate setup working
- [ ] Contracts functional
- [ ] Billing consolidated

**Last Updated**: 2025-10-09
