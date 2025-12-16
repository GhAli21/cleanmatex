# Shared Types Package - Development Plan & PRD

**Document ID**: 049 | **Version**: 1.0 | **Dependencies**: 002

## Overview

Create shared TypeScript types package for database types, API contracts, and common interfaces.

## Requirements

- Database types (from Prisma/Supabase)
- API request/response types
- Enum definitions
- Validation schemas (Zod)
- Shared interfaces

## Structure

```
packages/types/
├── src/
│   ├── database.ts      # Generated from DB
│   ├── api.ts           # API contracts
│   ├── enums.ts         # Shared enums
│   └── index.ts
├── package.json
└── tsconfig.json
```

## Types to Include

- Order, OrderItem, Customer
- Invoice, Payment
- User, Tenant, Branch
- Workflow states
- API DTOs

## Implementation (2 days)

1. Package setup (0.5 day)
2. Type definitions (1 day)
3. Export & publish (0.5 day)

## Acceptance

- [ ] Types accurate
- [ ] Package published
- [ ] Apps consuming it

**Last Updated**: 2025-10-09
