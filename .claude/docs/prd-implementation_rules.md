---
version: v1.1.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# PRD Implementation Rules

**CRITICAL**: Follow these rules for all code implementation across the CleanMateX platform.

---

## Don't Do This

- ❌ Don't use class components (legacy codebase reasons)
- ❌ Don't bypass our error boundary setup
- ❌ Don't write more than 500-line components (break them up!)
- ❌ Don't use `console.log` directly (use logger utility)
- ❌ Don't query without tenant filtering
- ❌ Don't hardcode secrets or API keys
- ❌ Don't skip error handling
- ❌ Don't commit code without tests for business logic

---

## Code Style

### TypeScript

- **TypeScript everywhere** (no exceptions)
- Use strict mode: `"strict": true` in tsconfig.json
- Avoid `any` type - use `unknown` or proper types
- Use type inference when possible
- Define interfaces for all data structures

### Naming Conventions

**General Rules:**

- **Variables & Functions**: `camelCase` (e.g., `getUserOrders`, `orderList`)
- **Components**: `PascalCase` (e.g., `OrderList`, `OrderCard`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_ORDER_ITEMS`, `API_BASE_URL`)
- **Types/Interfaces**: `PascalCase` (e.g., `OrderStatus`, `CreateOrderDto`)
- **Files**: `kebab-case` for components (e.g., `order-list.tsx`, `order-card.tsx`)
- **Boolean variables**: Prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasError`)

**Technology-Specific Naming:**

- **Next.js**: See [Frontend Next.js Rules](./frontend-nextjs-rules.md#naming-conventions)
- **NestJS**: See [Backend NestJS Rules](./backend-nestjs-rules.md#naming-conventions)
- **Flutter**: See [Flutter Rules](./flutter-rules.md#naming-conventions)
- **Database**: See [Database Conventions](./database_conventions.md#naming-patterns)
- **Supabase**: See [Supabase Rules](./supabase-rules.md#naming-conventions)

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Line length**: Max 100 characters
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes for strings, double quotes for JSX attributes
- **Trailing commas**: Use in multi-line objects/arrays

### Component Patterns

- **Functional components with hooks only** - For JavaScript family languages
- Use arrow functions for components: `const Component = () => {}`
- Extract custom hooks for reusable logic
- Keep components focused and single-purpose

---

## Error Handling

### Always Handle Errors

```typescript
// ✅ Good: Try-catch with proper error handling
try {
  const order = await createOrder(data);
  logger.info("Order created", { orderId: order.id });
  return order;
} catch (error) {
  logger.error("Failed to create order", error as Error, {
    tenantId,
    userId,
    orderData: data,
  });
  throw new OrderCreationError("Failed to create order", { cause: error });
}

// ❌ Bad: No error handling
const order = await createOrder(data);
return order;
```

### Custom Error Classes

```typescript
// Create custom error classes for better error handling
export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order with ID ${orderId} not found`);
    this.name = "OrderNotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public fields: string[]) {
    super(message);
    this.name = "ValidationError";
  }
}
```

### Error Context

Always include context when logging errors:

- `tenantId`: Always include for multi-tenant operations
- `userId`: Include when user action is involved
- `requestId`: Include for request tracing
- Feature/action context

### Error Boundaries (React)

```typescript
// Use error boundaries for component error handling
"use client";

import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

---

## Logging

**CRITICAL**: Always use the centralized logging utility (`lib/utils/logger.ts`)

### Use Logger Utility

```typescript
// ✅ Good: Use logger utility
import { logger } from "@/lib/utils/logger";

logger.info("Order created", {
  tenantId,
  userId,
  orderId: order.id,
});

logger.error("Order creation failed", error, {
  tenantId,
  userId,
  orderData: data,
});

// ❌ Bad: Direct console usage
console.log("Order created", order);
console.error("Error:", error);
```

### Log Levels

- **DEBUG**: Detailed debugging info (development only)
- **INFO**: General informational messages
- **WARN**: Warning messages for potential issues
- **ERROR**: Error messages for failures
- **FATAL**: Critical errors requiring immediate attention

### Logging Best Practices

- Always include `tenantId` in multi-tenant operations
- Never log passwords, tokens, or sensitive data
- Use child loggers for feature-specific logging
- Log errors with full context
- See [Logging Rules](./logging-rules.md) for detailed guidelines

---

## Git Commit Conventions

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build, etc.)
- **perf**: Performance improvements
- **ci**: CI/CD changes

### Examples

```bash
# Feature
feat(orders): add order status filter

# Bug fix
fix(auth): resolve login redirect issue (#123)

# Documentation
docs(api): update API endpoint documentation

# Refactoring
refactor(orders): extract order validation logic

# With body
feat(payments): add payment gateway integration

Add support for HyperPay and PayTabs payment gateways.
Includes error handling and retry logic.

Closes #456
```

### Scope Examples

- `orders`: Order management feature
- `auth`: Authentication/authorization
- `payments`: Payment processing
- `customers`: Customer management
- `ui`: UI components
- `api`: API routes
- `db`: Database operations

---

## API Versioning

### Version All APIs

```typescript
// ✅ Good: Versioned API
/api/1v /
  orders /
  api /
  v1 /
  customers /
  api /
  v2 /
  orders / // Breaking changes
  // ❌ Bad: Unversioned API
  api /
  orders;
```

### Versioning Rules

- **Breaking changes** require new version (v1 → v2)
- **Non-breaking changes** can be added to existing version
- **Deprecate** old versions with 6-month notice
- **Document** version changes in CHANGELOG.md

### Versioning Strategy

- **v1**: Initial API version
- **v2**: Breaking changes (field removals, type changes)
- **v1.1**: Non-breaking additions (new endpoints, optional fields)

---

## Performance Guidelines

### Component Size

- **Max 500 lines** per component (break into smaller components)
- Extract reusable logic into custom hooks
- Split large components into smaller, focused components

### Database Queries

- **Always paginate** large result sets
- **Avoid N+1 queries** - use joins or `include` in Prisma
- **Use indexes** for frequently queried fields
- **Monitor query performance** - log slow queries (>1s)

```typescript
// ✅ Good: Paginated query
const orders = await prisma.order.findMany({
  where: { tenantId },
  skip: (page - 1) * limit,
  take: limit,
});

// ✅ Good: Avoid N+1 with include
const orders = await prisma.order.findMany({
  where: { tenantId },
  include: {
    customer: true,
    items: true,
  },
});

// ❌ Bad: N+1 query problem
const orders = await prisma.order.findMany({ where: { tenantId } });
for (const order of orders) {
  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId },
  });
}
```

### Bundle Size

- **Monitor bundle size** - use `npm run build` to check
- **Code splitting** - use dynamic imports for large modules
- **Tree shaking** - import only what you need
- **Optimize images** - use Next.js Image component

```typescript
// ✅ Good: Dynamic import
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Loading />,
});

// ✅ Good: Tree shaking
import { debounce } from "lodash-es"; // Not import _ from 'lodash'
```

### Performance Monitoring

- Log slow operations (>1s)
- Use performance marks for critical paths
- Monitor Core Web Vitals

---

## Architecture Notes

### State Management

- **React**: Use Zustand only (no Redux, Context API for simple state)
- **Flutter**: Use Riverpod only
- **One technique per language** - maintain consistency

### API Calls

- Use custom API client in `/lib/api/` or `/lib/utils/api.ts`
- Never use `fetch` directly in components
- Centralize API error handling
- Include tenant context in all API calls

### Testing

- **New components need tests** alongside them
- **Business logic** must have unit tests (80% coverage target)
- **Integration tests** for critical flows
- **E2E tests** for user journeys

### Code Organization

- **Feature-first** folder structure
- Group related files together
- Keep components close to where they're used
- Extract shared utilities to `/lib/utils/`

### Code Reuse

**CRITICAL**: Always extract reusable code to avoid duplication.

**Reuse Patterns:**

- Extract reusable components/widgets
- Extract common business logic to services
- Extract validation logic to utilities
- Extract API calls to centralized clients
- Extract constants to dedicated files
- Extract common types/interfaces

**Technology-Specific Reuse Patterns:**

- **Next.js**: See [Frontend Next.js Rules](./frontend-nextjs-rules.md#code-reuse-patterns)
- **NestJS**: See [Backend NestJS Rules](./backend-nestjs-rules.md#code-reuse-patterns)
- **Flutter**: See [Flutter Rules](./flutter-rules.md#code-reuse-patterns)
- **Database**: See [Database Conventions](./database_conventions.md#code-reuse-patterns)
- **Supabase**: See [Supabase Rules](./supabase-rules.md#code-reuse-patterns)

---

## Security Best Practices

### Multi-Tenant Security

- **Always filter by `tenant_org_id`** in every query
- **Use composite foreign keys** for tenant-scoped joins
- **Test tenant isolation** in unit tests
- **Never expose** tenant data across boundaries

### Input Validation

- **Validate all inputs** before processing
- **Sanitize user input** to prevent XSS
- **Use parameterized queries** to prevent SQL injection
- **Validate file uploads** (type, size, content)

### Secrets Management

- **Never hardcode** secrets or API keys
- **Use environment variables** for configuration
- **Never commit** `.env` files
- **Rotate secrets** regularly

### Authentication & Authorization

- **Always authenticate** protected routes
- **Check permissions** before actions
- **Use role-based access control** (RBAC)
- **Log authorization failures**

---

## Code Review Checklist

Before submitting code for review, ensure:

- [ ] TypeScript types are correct (no `any`)
- [ ] Error handling is implemented
- [ ] Logging is added (using logger utility)
- [ ] Tenant filtering is present in queries
- [ ] Tests are written and passing
- [ ] No sensitive data in logs or code
- [ ] Performance considerations addressed
- [ ] Documentation updated if needed
- [ ] Git commit message follows conventions

---

## Related Documentation

- [Logging Rules](./logging-rules.md) - Detailed logging guidelines
- [Error Handling Rules](./error-handling-rules.md) - Error handling patterns
- [Database Conventions](./database_conventions.md) - Database standards
- [Multi-Tenancy](./multitenancy.md) - Multi-tenant security
- [Code Review Checklist](./code_review_checklist.md) - Review guidelines

---

## Return to [Main Documentation](../CLAUDE.md)
