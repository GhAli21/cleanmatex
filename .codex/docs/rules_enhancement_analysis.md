---
version: v1.0.0
last_updated: 2025-11-14
author: Claude AI Assistant
---

# Rules Files Enhancement Analysis & Recommendations

## Executive Summary

This document analyzes all rules files in `.claude/docs/` and provides specific enhancement recommendations to improve consistency, completeness, and usability.

---

## Current State Assessment

### ✅ Strengths

- **Comprehensive coverage**: Rules exist for all major technologies (Next.js, NestJS, Flutter, Supabase)
- **Multi-tenancy focus**: Strong emphasis on security and tenant isolation
- **Documentation structure**: Well-organized modular approach
- **Testing guidance**: Clear testing strategy documented
- **i18n support**: Comprehensive bilingual support rules

### ⚠️ Areas Needing Enhancement

1. **Inconsistent depth**: Some files are minimal (flutter-rules.md, supabase-rules.md)
2. **Missing patterns**: Error handling, logging, API versioning not standardized
3. **Cross-references**: Limited linking between related rules
4. **Examples**: Some rules lack practical code examples
5. **Security gaps**: Beyond multi-tenancy, general security practices need expansion

---

## Detailed Enhancement Recommendations

### 1. PRD Implementation Rules (`prd-implementation_rules.md`)

**Current State**: Very minimal (25 lines)

**Enhancements Needed**:

#### Add Error Handling Standards

```markdown
## Error Handling

- Use custom error classes extending base Error
- Always include context (tenant_id, user_id, request_id)
- Log errors with structured logging
- Never expose sensitive data in error messages
- Use error boundaries in React
- Handle async errors with try-catch or .catch()
```

#### Add Logging Standards

```markdown
## Logging

- Use structured logging (JSON format)
- Include: timestamp, level, message, context, tenant_id
- Never log passwords, tokens, or PII
- Use appropriate log levels: DEBUG, INFO, WARN, ERROR
- Centralize logging configuration
```

#### Add API Versioning Rules

```markdown
## API Versioning

- All APIs must be versioned: /api/v1/orders
- Breaking changes require new version
- Deprecate old versions with 6-month notice
- Document version changes in CHANGELOG
```

#### Add Git Commit Conventions

```markdown
## Git Commit Messages

- Format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Scope: feature name or module
- Example: `feat(orders): add order status filter`
- Reference issues: `fix(auth): resolve login bug (#123)`
```

#### Add Performance Guidelines

```markdown
## Performance

- Components: Max 500 lines, break into smaller pieces
- Queries: Always paginate, avoid N+1, use indexes
- Bundle size: Monitor and optimize imports
- Images: Use Next.js Image component
- Code splitting: Use dynamic imports for large modules
```

---

### 2. Flutter Rules (`flutter-rules.md`)

**Current State**: Very minimal (26 lines)

**Enhancements Needed**:

#### Expand Architecture Section

```markdown
## Architecture

- Use Riverpod for state management (mandatory)
- Structure: `lib/screens/`, `lib/widgets/`, `lib/providers/`, `lib/services/`
- Follow Clean Architecture: Presentation → Domain → Data
- Use dependency injection with Riverpod providers
- Separate business logic from UI widgets
```

#### Add State Management Patterns

```markdown
## State Management (Riverpod)

- Use `StateProvider` for simple state
- Use `FutureProvider` for async data fetching
- Use `StateNotifier` for complex state logic
- Use `Provider` for dependency injection
- Always dispose providers properly
- Use `ref.watch()` for reactive updates
- Use `ref.read()` for one-time reads
```

#### Add Widget Guidelines

```markdown
## Widget Guidelines

- Prefer `const` constructors when possible
- Use `StatelessWidget` unless state is needed
- Extract reusable widgets to separate files
- Use `ListView.builder` for long lists
- Implement proper error boundaries
- Add loading states for async operations
```

#### Add Form Handling

```markdown
## Forms

- Use `flutter_form_builder` or `reactive_forms`
- Validate inputs with `validator` functions
- Show clear error messages
- Support RTL for Arabic forms
- Use proper keyboard types (phone, email, etc.)
```

#### Add Testing Patterns

```markdown
## Testing

- Unit tests for business logic (80% coverage target)
- Widget tests for UI components
- Integration tests for critical flows
- Mock external dependencies
- Test RTL layouts separately
```

---

### 3. Supabase Rules (`supabase-rules.md`)

**Current State**: Very minimal (25 lines)

**Enhancements Needed**:

#### Expand RLS Patterns

```markdown
## Row-Level Security (RLS)

- Enable RLS on ALL org\_\* tables
- Create policies for SELECT, INSERT, UPDATE, DELETE
- Use JWT claims for tenant isolation
- Test policies with different user roles
- Document policy logic in migration comments
- Use service role key only for admin operations
```

#### Add Migration Best Practices

```markdown
## Migrations

- Name migrations: `YYYYMMDDHHMMSS_description.sql`
- One logical change per migration
- Always test migrations locally first
- Include rollback instructions in comments
- Never modify existing migrations (create new ones)
- Use transactions for multi-step migrations
- Add indexes after data migration
```

#### Add Function Guidelines

```markdown
## Database Functions

- Use PostgreSQL functions for complex logic
- Expose via Supabase RPCs
- Document function parameters and return types
- Handle errors gracefully
- Use SECURITY DEFINER only when necessary
- Test functions with various inputs
```

#### Add Client Usage Patterns

```markdown
## Supabase Client Usage

- Always filter by tenant_org_id
- Use select() to limit returned columns
- Use pagination for large datasets
- Handle errors with proper error types
- Use realtime subscriptions sparingly
- Cache frequently accessed data
```

---

### 4. Frontend Next.js Rules (`frontend-nextjs-rules.md`)

**Current State**: Comprehensive (914 lines)

**Minor Enhancements Needed**:

#### Add Tenant Filtering Reminder

```markdown
## Multi-Tenant Queries

⚠️ CRITICAL: Always filter by tenant_org_id in every query

// ✅ CORRECT
const { data } = await supabase
.from('org_orders_mst')
.select('\*')
.eq('tenant_org_id', tenantId);

// ❌ WRONG - Missing tenant filter
const { data } = await supabase
.from('org_orders_mst')
.select('\*');
```

#### Add Accessibility Section

```markdown
## Accessibility (a11y)

- Use semantic HTML elements
- Add ARIA labels for interactive elements
- Ensure keyboard navigation works
- Test with screen readers
- Maintain color contrast (WCAG AA minimum)
- Provide alt text for images
- Use focus indicators
```

---

### 5. UI/UX Rules (`uiux-rules.md`)

**Current State**: Good foundation (60 lines)

**Enhancements Needed**:

#### Expand Accessibility Details

```markdown
## Accessibility (WCAG 2.1 AA)

- Color contrast: 4.5:1 for text, 3:1 for UI components
- Keyboard navigation: All interactive elements accessible
- Screen readers: Use semantic HTML, ARIA attributes
- Focus management: Visible focus indicators
- Error messages: Clear, actionable, associated with inputs
- Skip links: Provide skip navigation links
- Alt text: Descriptive alt text for all images
```

#### Add Component Patterns

```markdown
## Component Patterns

- Loading states: Skeleton screens preferred over spinners
- Empty states: Helpful messages with action prompts
- Error states: Clear error messages with retry options
- Success feedback: Toast notifications for actions
- Form validation: Inline validation with clear errors
- Data tables: Sortable, filterable, paginated
```

#### Add Responsive Breakpoints

```markdown
## Responsive Breakpoints

- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px - 1439px
- Large Desktop: 1440px+
- Test on real devices, not just browser resize
```

---

### 6. Code Review Checklist (`code_review_checklist.md`)

**Current State**: Good but brief (24 lines)

**Enhancements Needed**:

#### Expand Each Section with Examples

```markdown
## Security Checklist

- [ ] Tenant filter present: `.eq('tenant_org_id', tenantId)`
- [ ] RLS policies tested and documented
- [ ] No secrets in code (use env variables)
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize user input)
- [ ] CSRF protection enabled
- [ ] Authentication required for protected routes
- [ ] Authorization checks for user actions
- [ ] Rate limiting considered for public APIs

## Multi-Tenant Isolation

- [ ] Composite FKs used for tenant-scoped joins
- [ ] Cross-tenant access impossible (tested)
- [ ] Tenant context set in all queries
- [ ] RLS policies enforce tenant boundaries
- [ ] No hardcoded tenant IDs
- [ ] Tenant switching tested
```

---

### 7. New Rules File: Error Handling Patterns

**Create**: `.claude/docs/error-handling-rules.md`

````markdown
# Error Handling Patterns

## Error Types

### Client Errors (4xx)

- 400 Bad Request: Invalid input data
- 401 Unauthorized: Missing or invalid authentication
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource doesn't exist
- 409 Conflict: Resource conflict (e.g., duplicate)

### Server Errors (5xx)

- 500 Internal Server Error: Unexpected server error
- 502 Bad Gateway: Upstream service error
- 503 Service Unavailable: Service temporarily unavailable

## Error Response Format

```typescript
{
  success: false,
  error: {
    code: "ORDER_NOT_FOUND",
    message: "Order with ID 123 not found",
    details: {
      orderId: "123",
      tenantId: "tenant-456"
    },
    timestamp: "2025-11-14T10:30:00Z",
    requestId: "req-789"
  }
}
```
````

## Error Handling in Next.js

### Server Components

```typescript
// app/orders/[id]/page.tsx
export default async function OrderPage({ params }) {
  try {
    const order = await getOrder(params.id);
    if (!order) {
      notFound(); // Triggers not-found.tsx
    }
    return <OrderDetails order={order} />;
  } catch (error) {
    error("Failed to load order"); // Triggers error.tsx
  }
}
```

### Client Components

```typescript
"use client";

export function OrderForm() {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data) => {
    try {
      await createOrder(data);
    } catch (err) {
      setError(err.message);
      // Log to error tracking service
      Sentry.captureException(err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}
      {/* form fields */}
    </form>
  );
}
```

## Error Logging

### Structured Logging

```typescript
logger.error("Order creation failed", {
  error: error.message,
  stack: error.stack,
  context: {
    tenantId,
    userId,
    orderData,
    requestId,
  },
});
```

### Never Log

- Passwords
- API keys or tokens
- Credit card numbers
- Full request/response bodies (log summaries instead)

````

---

### 8. New Rules File: Logging Standards

**Create**: `.claude/docs/logging-rules.md`

```markdown
# Logging Standards

## Log Levels

- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages
- **WARN**: Warning messages for potential issues
- **ERROR**: Error messages for failures
- **FATAL**: Critical errors requiring immediate attention

## Structured Logging Format

```typescript
{
  timestamp: "2025-11-14T10:30:00.123Z",
  level: "ERROR",
  message: "Order creation failed",
  context: {
    tenantId: "tenant-123",
    userId: "user-456",
    requestId: "req-789",
    feature: "orders",
    action: "create"
  },
  error: {
    name: "ValidationError",
    message: "Invalid customer ID",
    stack: "..."
  }
}
````

## What to Log

### Always Log

- API requests/responses (sanitized)
- Database operations (queries, not data)
- Authentication events
- Authorization failures
- Business logic errors
- Performance metrics

### Never Log

- Passwords or tokens
- Credit card numbers
- Full user objects (log IDs only)
- Sensitive PII (log hashed versions)

## Logging in Different Environments

### Development

- Log level: DEBUG
- Console output: Yes
- Format: Pretty-printed JSON

### Production

- Log level: INFO
- Console output: No
- Format: JSON (for log aggregation)
- Destination: Centralized logging service (Sentry, DataDog, etc.)

````

---

### 9. New Rules File: API Design Standards

**Create**: `.claude/docs/api-design-rules.md`

```markdown
# API Design Standards

## RESTful Conventions

### Endpoints
- Use nouns, not verbs: `/orders` not `/getOrders`
- Use plural nouns: `/orders` not `/order`
- Use kebab-case for multi-word: `/order-items` not `/orderItems`
- Version all APIs: `/api/v1/orders`

### HTTP Methods
- GET: Retrieve resources
- POST: Create resources
- PUT: Replace entire resource
- PATCH: Partial update
- DELETE: Delete resource

## Request/Response Format

### Request Headers
````

Authorization: Bearer <token>
Content-Type: application/json
X-Request-ID: <unique-request-id>
X-Tenant-ID: <tenant-id>

````

### Response Format
```typescript
// Success
{
  success: true,
  data: { ... },
  meta: {
    timestamp: "2025-11-14T10:30:00Z",
    requestId: "req-123"
  }
}

// Error
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human-readable message",
    details: { ... }
  }
}
````

## Pagination

```typescript
// Query parameters
?page=1&limit=20&sort=created_at&order=desc

// Response
{
  data: [...],
  meta: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8,
    hasNext: true,
    hasPrev: false
  }
}
```

## Filtering & Sorting

```typescript
// Filtering
?status=pending&customer_id=123&created_after=2025-01-01

// Sorting
?sort=created_at&order=desc
?sort=total_amount,created_at&order=desc,asc
```

## API Versioning

- URL versioning: `/api/v1/orders`
- Breaking changes require new version
- Deprecate old versions with 6-month notice
- Document version changes in CHANGELOG

````

---

### 10. Update CLAUDE.md

**Add cross-references**:

```markdown
## 📦 Modular Imports (Authoritative)

[... existing imports ...]

- **Error Handling Patterns** → @.claude/docs/error-handling-rules.md
- **Logging Standards** → @.claude/docs/logging-rules.md
- **API Design Standards** → @.claude/docs/api-design-rules.md
````

---

## Priority Recommendations

### High Priority (Implement First)

1. ✅ Expand `prd-implementation_rules.md` with error handling, logging, git conventions
2. ✅ Expand `flutter-rules.md` with comprehensive patterns
3. ✅ Expand `supabase-rules.md` with RLS and migration best practices
4. ✅ Create `error-handling-rules.md`
5. ✅ Create `logging-rules.md`

### Medium Priority

6. ✅ Expand `code_review_checklist.md` with detailed examples
7. ✅ Add tenant filtering reminders to Next.js rules
8. ✅ Expand accessibility details in UI/UX rules
9. ✅ Create `api-design-rules.md`

### Low Priority (Nice to Have)

10. ✅ Add more code examples to all rules files
11. ✅ Create visual diagrams for complex patterns
12. ✅ Add "Quick Reference" sections to each file
13. ✅ Create rules validation script

---

## Implementation Plan

1. **Week 1**: Enhance high-priority files
2. **Week 2**: Create new rules files
3. **Week 3**: Update cross-references and CLAUDE.md
4. **Week 4**: Review and refine based on usage

---

## Success Metrics

- All rules files have minimum 100 lines of content
- Each file includes practical code examples
- Cross-references between related rules
- Consistent formatting and structure
- Regular updates based on project needs

---

**Last Updated**: 2025-11-14
**Next Review**: 2025-02-16
