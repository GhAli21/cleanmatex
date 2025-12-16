# Sustainability Metrics - Development Plan & PRD

**Document ID**: 043 | **Version**: 1.0 | **Dependencies**: 021  
**FR-SUS-001, UC21**

## Overview

Track water/energy usage estimates, eco badge system, carbon footprint, and sustainability reporting.

## Requirements

- Water usage estimates (per service type)
- Energy usage tracking
- Eco badge criteria
- Carbon footprint calculator
- Green packaging options
- Sustainability reports
- Customer impact dashboard

## Database

```sql
CREATE TABLE org_sustainability_metrics (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  metric_type VARCHAR(50), -- water, energy, carbon
  metric_value NUMERIC(10,2),
  unit VARCHAR(20),
  recorded_at TIMESTAMP,
  order_id UUID
);

CREATE TABLE sustainability_badges (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  badge_type VARCHAR(50), -- eco_friendly, green_certified
  criteria JSONB,
  awarded_at TIMESTAMP
);
```

## Implementation (2 days)

1. Metrics tracking (1 day)
2. Badge system & reports (1 day)

## Acceptance

- [ ] Metrics tracked
- [ ] Badges awarded
- [ ] Reports available

**Last Updated**: 2025-10-09
