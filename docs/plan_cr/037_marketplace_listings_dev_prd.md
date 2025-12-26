# Marketplace Listings - Development Plan & PRD

**Document ID**: 037 | **Version**: 1.0 | **Dependencies**: 021, 024  
**FR-MKT-001, UC23-24**

## Overview

Implement marketplace for tenant listings with commission/escrow handling, discovery, and cross-tenant orders.

## Requirements

- Tenant listings (profile, services, photos)
- Search & filters (location, services, ratings)
- Commission structure
- Escrow handling
- Cross-tenant order management
- Marketplace analytics

## Database

```sql
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  title VARCHAR(255),
  description TEXT,
  services_offered TEXT[],
  location_lat FLOAT,
  location_lng FLOAT,
  is_active BOOLEAN
);

CREATE TABLE marketplace_orders (
  id UUID PRIMARY KEY,
  listing_id UUID,
  customer_id UUID,
  amount NUMERIC(10,2),
  commission_rate NUMERIC(5,2),
  status VARCHAR(20)
);
```

## Implementation (5 days)

1. Listings management (2 days)
2. Discovery & search (2 days)
3. Commission handling (1 day)

## Acceptance

- [ ] Listings displaying
- [ ] Search functional
- [ ] Commission calculated

**Last Updated**: 2025-10-09
