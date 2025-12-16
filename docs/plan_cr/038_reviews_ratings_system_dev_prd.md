# Reviews & Ratings System - Development Plan & PRD

**Document ID**: 038 | **Version**: 1.0 | **Dependencies**: 037  
**FR-CX-REV-001, UC25**

## Overview

Implement verified reviews system with moderation queue, ratings aggregation, and response management.

## Requirements

- Verified reviews (order-based)
- Star ratings (1-5)
- Review text
- Photo attachments
- Moderation queue
- Tenant responses
- Rating aggregation

## Database

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  order_id UUID,
  tenant_org_id UUID,
  customer_id UUID,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  photos TEXT[],
  status VARCHAR(20), -- pending, approved, hidden
  is_verified BOOLEAN,
  created_at TIMESTAMP
);
```

## Implementation (3 days)

1. Review submission (1 day)
2. Moderation queue (1 day)
3. Display & aggregation (1 day)

## Acceptance

- [ ] Reviews submittable
- [ ] Moderation working
- [ ] Ratings accurate

**Last Updated**: 2025-10-09
