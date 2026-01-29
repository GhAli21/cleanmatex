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
