---
name: documentation
description: Documentation rules, folder structure, and standards for feature documentation. Use when creating or updating documentation.
user-invocable: true
---

# Documentation Standards

## Documentation Structure

```
docs/
  features/           # Feature documentation
    orders/
      orders_prd.md            # Product requirements
      orders_implementation.md  # Implementation status
      orders_api.md             # API documentation
    pricing/
    invoices/

  plan/               # Implementation plans
    master_plan_cc_01.md
    feature_implementation_plan.md

  dev/                # Development guides
    QUICK_START.md
    architecture_guide.md

  database/           # Database documentation
    schema.sql
    migration_guide.md

  api/                # API documentation
    api_reference.md
```

## Feature Documentation Template

```markdown
# Feature Name

## Overview
Brief description of the feature and its purpose.

## Requirements
- Requirement 1
- Requirement 2

## Database Schema
Tables, fields, relationships.

## API Endpoints
- `GET /api/v1/resource` - Description
- `POST /api/v1/resource` - Description

## UI Components
List of screens and components.

## Business Logic
Workflow, validations, calculations.

## Testing
Test scenarios and edge cases.

## Implementation Status
- [ ] Database schema
- [ ] Backend API
- [ ] Frontend UI
- [ ] Testing
- [ ] Documentation
```

## Feature Implementation Documentation Checklist

When implementing any feature, document the following in the feature's implementation documentation:

### Security & Access Control
- [ ] **Permissions** - List all used or new permissions required
  - Permission codes (e.g., `orders.create`, `invoices.view`)
  - RBAC roles that need these permissions
  - Permission scope (tenant-level, global, resource-specific)

### Navigation & UI Structure
- [ ] **Navigation Tree** - New screens/menu items to be added
  - Navigation tree ID (`sys_components_cd`)
  - Parent menu location
  - Display order and hierarchy
  - Screen route/path
  - Icon and translations (EN/AR)

### Configuration & Settings
- [ ] **Tenant Settings** - New or used tenant-level settings
  - Setting key and default value
  - Setting type (boolean, string, number, JSON)
  - Validation rules
  - UI for configuration

- [ ] **System Settings** - Global/system-level settings
  - Setting scope and purpose
  - Environment variables if applicable

### Feature Management
- [ ] **Feature Flags** - Feature toggles for gradual rollout
  - Flag key and default state
  - Rollout strategy
  - Dependency on other features

- [ ] **Plan Limits & Constraints** - Subscription/plan restrictions
  - Limit type (e.g., max orders per month, max users)
  - Enforcement logic
  - Upgrade path for users

### Internationalization
- [ ] **i18n Keys** - New translation keys added
  - Message key paths
  - EN and AR translations
  - Namespace organization

### API & Integration
- [ ] **API Routes** - New endpoints created
  - Route path and HTTP method
  - Request/response schemas
  - Authentication/authorization requirements

- [ ] **External Services** - Third-party integrations
  - Service name and purpose
  - API keys/credentials required
  - Rate limits and quotas

### Database & Schema
- [ ] **Migrations** - Database changes
  - Migration file names and version numbers
  - Tables/columns added or modified
  - Indexes created
  - RLS policies added

- [ ] **Constants & Types** - New constants or TypeScript types
  - Location (e.g., `lib/constants/payment.ts`)
  - Exported values and types
  - Validation schemas (Zod)

### Infrastructure & Environment
- [ ] **Environment Variables** - New .env variables
  - Variable name and purpose
  - Required vs. optional
  - Default values
  - Security classification

- [ ] **Dependencies** - New npm packages
  - Package name and version
  - Purpose and usage
  - License compatibility

### Monitoring & Observability
- [ ] **Logging** - New log events or categories
  - Log level and context
  - PII/sensitive data handling

- [ ] **Metrics** - Performance or business metrics tracked
  - Metric name and purpose
  - Collection method

### Documentation Template Example

```markdown
## Feature Implementation Requirements

### Permissions
- `orders.edit` - Edit order details (admin, manager roles)
- `orders.lock` - Lock/unlock orders for editing (admin only)

### Navigation Tree
- Screen: Order Edit Lock Management
- Path: `/admin/orders/edit-locks`
- Parent: Orders module
- Navigation ID: To be assigned in `sys_components_cd`

### Settings
- `order_edit_lock_timeout` (number, default: 300) - Auto-unlock timeout in seconds
- `order_edit_history_enabled` (boolean, default: true) - Enable edit history tracking

### Feature Flags
- `feature.order_edit_locks` (default: true) - Enable order editing lock mechanism

### Plan Limits
- N/A for this feature (available to all plans)

### i18n Keys
- `orders.editLock.title`
- `orders.editLock.locked`
- `orders.editLock.unlocked`

### API Routes
- `POST /api/orders/:id/lock` - Acquire edit lock
- `DELETE /api/orders/:id/lock` - Release edit lock
- `GET /api/orders/:id/edit-history` - Get edit history

### Migrations
- `0126_order_edit_locks.sql` - Create `org_order_edit_locks` table
- `0127_order_edit_history.sql` - Create `org_order_edit_history` table
- `0128_order_edit_settings.sql` - Add settings to `sys_org_settings`

### Constants & Types
- `lib/types/order-lock.ts` - `OrderLock`, `OrderEditHistory` types
- `lib/constants/order-locks.ts` - `LOCK_STATUS` constant

### Environment Variables
- N/A for this feature
```

## API Documentation Format

```markdown
### POST /api/v1/orders

Create a new order.

**Request:**
\`\`\`json
{
  "customerId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "ORD-001",
    "status": "NEW"
  }
}
\`\`\`

**Errors:**
- 400: Invalid input
- 401: Unauthorized
- 500: Server error
```

## Code Documentation

### Inline Comments

```typescript
/**
 * Calculate order total including discounts and tax
 *
 * @param items - Order items with quantities and prices
 * @param customerId - Customer ID for loyalty discounts
 * @returns Total breakdown with subtotal, discounts, tax, and total
 */
function calculateOrderTotal(
  items: OrderItem[],
  customerId: string
): OrderTotal {
  // Complex business logic here...
}
```

### README Files

Each major directory should have a README.md:

```markdown
# Orders Feature

This module handles order creation, management, and workflow.

## Structure
- `ui/` - React components
- `api/` - API client functions
- `hooks/` - React hooks
- `model/` - TypeScript types

## Usage
\`\`\`typescript
import { OrderListScreen } from '@features/orders/ui/order-list-screen';
\`\`\`
```

## Session Documentation Rules

### Capturing Remaining Work

At the end of each session, update or create:

```markdown
# Pending Work - Feature Name

## Last Session: 2025-01-29

### Completed
- [x] Database schema created
- [x] API endpoints implemented

### In Progress
- [ ] Frontend UI - 60% complete
  - Completed: List view, create form
  - Pending: Edit form, detail view

### Pending
- [ ] Testing
- [ ] Documentation
- [ ] QA review

### Blockers
- Waiting for design approval on edit form

### Next Session
1. Complete edit form UI
2. Add validation
3. Write tests
```

## Documentation Checklist

- [ ] Feature has PRD document
- [ ] Database schema documented
- [ ] API endpoints documented
- [ ] UI components documented
- [ ] Business logic explained
- [ ] Pending work captured
- [ ] README files updated

## File Naming Conventions

- Use lowercase with underscores: `feature_name_doc.md`
- Include date for plans: `plan_2025_01_29.md`
- API docs: `api_v1_reference.md`
- Feature docs: `{feature}_prd.md`, `{feature}_implementation.md`

## Additional Resources

- See [reference.md](./reference.md) for complete documentation rules
