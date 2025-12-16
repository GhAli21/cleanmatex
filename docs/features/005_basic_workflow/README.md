# PRD-005: Basic Workflow & Status Transitions

**Feature Name:** Basic Workflow & Status Transitions
**Version:** v1.0.0
**Status:** Complete
**Last Updated:** 2025-10-30

---

## Overview

The Basic Workflow feature implements a comprehensive 14-stage order processing system with configurable workflows, quality gates, status history tracking, and multi-tenant isolation. This feature provides the foundation for order lifecycle management in CleanMateX.

## Purpose

- **Order Status Management**: Track orders through 14 distinct stages from draft to closed
- **Workflow Customization**: Per-tenant and per-service-category workflow configuration
- **Quality Control**: Enforce quality gates before orders can progress to ready status
- **Audit Trail**: Complete history of all status changes with user attribution
- **SLA Tracking**: Monitor overdue orders and workflow performance
- **Bulk Operations**: Update multiple orders simultaneously with transaction safety

## Key Features

### 1. 14-Stage Workflow
```
DRAFT → INTAKE → PREPARATION → SORTING → WASHING → DRYING →
FINISHING → ASSEMBLY → QA → PACKING → READY → OUT_FOR_DELIVERY →
DELIVERED → CLOSED
```

### 2. Configurable Workflows
- Per-tenant customization
- Per-service-category variants
- Example: PRESSED_IRONED skips washing/drying steps

### 3. Quality Gates (CRITICAL)
Orders CANNOT progress to READY without:
- ✅ All items assembled
- ✅ QA passed
- ✅ No unresolved issues

### 4. Complete Audit Trail
Every status change records:
- Order ID
- From/To status
- Changed by (user ID + name)
- Timestamp
- Optional notes
- Metadata (IP, user agent)

### 5. SLA Tracking
- `ready_by` date field
- Hours overdue calculation
- Overdue orders API endpoint

### 6. Bulk Operations
- Update up to 100 orders at once
- Transaction support
- Individual success/failure tracking

## Components

### Backend
- [WorkflowService](./technical_docs/workflow_service.md) - Core business logic
- [API Endpoints](./technical_docs/api_specs.md) - 6 REST endpoints
- [Database Schema](./technical_docs/database_schema.md) - 3 new tables

### Frontend
- [OrderStatusBadge](./components/OrderStatusBadge.md) - Reusable status display
- [OrderActions](./components/OrderActions.md) - Single order status updates
- [OrderTimeline](./components/OrderTimeline.md) - Status history visualization
- [BulkStatusUpdate](./components/BulkStatusUpdate.md) - Bulk operation modal
- [OverdueOrdersWidget](./components/OverdueOrdersWidget.md) - Dashboard overdue list
- [WorkflowStatsWidget](./components/WorkflowStatsWidget.md) - Dashboard statistics

## Documentation Structure

```
docs/features/005_basic_workflow/
├── README.md (this file)
├── development_plan.md
├── progress_summary.md
├── current_status.md
├── user_guide.md
├── testing_scenarios.md
├── CHANGELOG.md
├── version.txt
├── components/
│   ├── OrderStatusBadge.md
│   ├── OrderActions.md
│   ├── OrderTimeline.md
│   ├── BulkStatusUpdate.md
│   ├── OverdueOrdersWidget.md
│   └── WorkflowStatsWidget.md
└── technical_docs/
    ├── api_specs.md
    ├── workflow_rules.md
    ├── quality_gates.md
    ├── workflow_service.md
    └── database_schema.md
```

## Quick Links

- [User Guide](./user_guide.md) - How to use the feature
- [Testing Scenarios](./testing_scenarios.md) - Test cases
- [API Specifications](./technical_docs/api_specs.md) - API documentation
- [Changelog](./CHANGELOG.md) - Version history

## Related PRDs

- PRD-001: Core Database Schema
- PRD-002: Multi-Tenant Architecture
- PRD-019: Notifications (future integration)

## Support

For issues or questions:
- Check [User Guide](./user_guide.md)
- Review [Testing Scenarios](./testing_scenarios.md)
- See [Common Issues](#) (TBD)
