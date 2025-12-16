# B2B Contracts & Corporate - Development Plan & PRD

**Document ID**: 036 | **Version**: 1.0 | **Dependencies**: 021, 024  
**FR-B2B-001, FR-B2B-002, UC14**

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

## Database

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
