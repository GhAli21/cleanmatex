# Machine Maintenance Tracking - Development Plan & PRD

**Document ID**: 041 | **Version**: 1.0 | **Dependencies**: 021  
**FR-MCH-101**

## Overview

Implement machine registry, usage counters, maintenance schedules, and downtime analytics.

## Requirements

- Machine registry
- Usage counters
- Maintenance schedules
- Maintenance logs
- Downtime tracking
- Preventive maintenance alerts
- Service history

## Database

```sql
CREATE TABLE org_machines (
  id UUID PRIMARY KEY,
  tenant_org_id UUID,
  machine_type VARCHAR(50), -- washer, dryer, press
  model VARCHAR(255),
  serial_number VARCHAR(100),
  install_date DATE,
  usage_counter INTEGER DEFAULT 0
);

CREATE TABLE org_maintenance_logs (
  id UUID PRIMARY KEY,
  machine_id UUID,
  tenant_org_id UUID,
  maintenance_type VARCHAR(50), -- preventive, repair
  performed_at TIMESTAMP,
  performed_by VARCHAR(120),
  notes TEXT,
  cost NUMERIC(10,2)
);
```

## Implementation (2 days)

1. Machine registry (1 day)
2. Maintenance tracking (1 day)

## Acceptance

- [ ] Machines tracked
- [ ] Maintenance logged
- [ ] Alerts working

**Last Updated**: 2025-10-09
