# Business Logic & Workflows Rules

## Overview
Rules for implementing business logic and order workflow management.

## Rules

### Order Lifecycle
- Complete workflow: DRAFT → INTAKE → PREPARATION → SORTING → WASHING → DRYING → FINISHING → ASSEMBLY → QA → PACKING → READY → OUT_FOR_DELIVERY → DELIVERED → CLOSED
- Workflow must be configurable based on tenant features, service category, and explicit step rules
- Store workflow configuration in `org_workflow_settings_cf` with `workflow_steps` and `status_transitions` JSONB

### Workflow Customization
- Driven by tenant features (from subscription plan)
- Driven by service category (Dry Cleaning, Laundry, Pressed/Ironed, Repairs, Alterations)
- Driven by explicit step rules
- Implement workflow logic to filter steps based on tenant capabilities

### Quality Gates (CRITICAL)
- Orders CANNOT progress to READY status without:
  - All items assembled
  - QA passed
  - No unresolved issues
- Implement validation function to check readiness before status transition
- Return blockers list when validation fails

### Pricing Calculation
- Use pricing rules based on tenant, service type, and garment type
- Apply express multiplier for express service
- Apply bulk discounts when applicable
- Calculate item price: base_price × express_multiplier × quantity × (1 - discount_percent)

### Customer Engagement Levels
- Guest: No registration, order by phone only
- Stub Profile: Phone number only, basic tracking
- Full Profile: Complete registration, app access, loyalty points
- Implement customer progression logic
- Provide upgrade incentives based on level

## Conventions
- Always validate workflow steps before status transitions
- Always check quality gates before moving to READY status
- Always calculate pricing using tenant-specific rules
- Always support customer progression from guest to full profile
