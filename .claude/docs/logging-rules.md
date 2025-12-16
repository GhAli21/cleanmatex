---
version: v1.0.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# Logging Standards & Utility

**CRITICAL**: Always use the centralized logging utility (`lib/utils/logger.ts`) for all logging across the project.

---

## Log Levels

Use appropriate log levels based on severity:

- **DEBUG** (0): Detailed information for debugging (development only)
- **INFO** (1): General informational messages about application flow
- **WARN** (2): Warning messages for potential issues that don't stop execution
- **ERROR** (3): Error messages for failures that are handled
- **FATAL** (4): Critical errors requiring immediate attention

---

## Using the Logging Utility

### Basic Usage

```typescript
import { logger } from "@/lib/utils/logger";

// Info log
logger.info("Order created successfully", {
  tenantId: "tenant-123",
  userId: "user-456",
  orderId: "order-789",
});

// Warning log
logger.warn("Low inventory detected", {
  tenantId: "tenant-123",
  productId: "product-456",
  currentStock: 5,
});

// Error log
try {
  await createOrder(data);
} catch (error) {
  logger.error("Failed to create order", error as Error, {
    tenantId: "tenant-123",
    userId: "user-456",
    orderData: data, // Will be sanitized automatically
  });
}
```

### Convenience Functions

```typescript
import { log } from "@/lib/utils/logger";

// Shorter syntax
log.info("User logged in", { userId: "user-123" });
log.error("Payment failed", error, { orderId: "order-456" });
```

---

## Log Context

Always include relevant context in logs:

### Required Context Fields

- **tenantId**: Always include for multi-tenant operations
- **userId**: Include when user action is involved
- **requestId**: Include for request tracing (if available)

### Optional Context Fields

- **feature**: Feature/module name (e.g., 'orders', 'payments')
- **action**: Action being performed (e.g., 'create', 'update', 'delete')
- **resourceId**: ID of the resource being acted upon

### Example Context

```typescript
logger.info("Order status updated", {
  tenantId: "tenant-123",
  userId: "user-456",
  requestId: "req-789",
  feature: "orders",
  action: "update_status",
  orderId: "order-123",
  oldStatus: "PENDING",
  newStatus: "PROCESSING",
});
```

---

## Child Loggers

Create child loggers with pre-set context for feature-specific logging:

```typescript
import { logger } from "@/lib/utils/logger";

// Create child logger with tenant context
const orderLogger = logger.child({
  tenantId: "tenant-123",
  feature: "orders",
});

// Now all logs from orderLogger include tenantId and feature
orderLogger.info("Order created", { orderId: "order-456" });
// Logs: { tenantId: 'tenant-123', feature: 'orders', orderId: 'order-456' }
```

---

## Error Logging

### Always Log Errors with Context

```typescript
try {
  await processOrder(orderId);
} catch (error) {
  logger.error("Failed to process order", error as Error, {
    tenantId,
    userId,
    orderId,
    feature: "order_processing",
    action: "process",
  });

  // Re-throw or handle error appropriately
  throw error;
}
```

### Logging Async Errors

```typescript
// Promise rejection
promise
  .then((result) => {
    logger.info("Operation completed", { result });
  })
  .catch((error) => {
    logger.error("Operation failed", error, { context });
  });

// Async/await
try {
  const result = await asyncOperation();
  logger.info("Operation completed", { result });
} catch (error) {
  logger.error("Operation failed", error as Error, { context });
}
```

---

## What to Log

### ✅ Always Log

- **API Requests**: Log incoming requests with sanitized data
- **Database Operations**: Log queries (not full data, just summaries)
- **Authentication Events**: Login, logout, token refresh
- **Authorization Failures**: Permission denied events
- **Business Logic Errors**: Validation failures, business rule violations
- **Performance Metrics**: Slow queries, long-running operations
- **State Changes**: Order status changes, payment status updates

### ❌ Never Log

- **Passwords**: Never log passwords in any form
- **Tokens**: API keys, JWT tokens, access tokens
- **Credit Card Numbers**: Full card numbers, CVV codes
- **Full User Objects**: Log IDs only, not full user data
- **Sensitive PII**: Social security numbers, full addresses
- **Request/Response Bodies**: Log summaries instead of full bodies

**Note**: The logging utility automatically sanitizes sensitive data based on pattern matching.

---

## Logging in Different Environments

### Development

```typescript
// Development: Log everything
logger.debug("Detailed debug information", { data });
logger.info("General information", { context });
```

### Production

```typescript
// Production: Log INFO and above only
// DEBUG logs are automatically filtered out
logger.info("Important operation", { context });
logger.error("Error occurred", error, { context });
```

### Configuration

The logger automatically adjusts based on `NODE_ENV`:

- **Development**: `DEBUG` level, pretty console output
- **Production**: `INFO` level, JSON format for log aggregation

---

## Integration with Error Tracking

### Sentry Integration

The logger automatically integrates with Sentry when configured:

```typescript
// Sentry is automatically initialized if NEXT_PUBLIC_SENTRY_DSN is set
logger.error("Critical error", error, {
  tenantId,
  userId,
  feature: "payments",
});
// Error is automatically sent to Sentry
```

### Custom Error Tracking

```typescript
// For custom error tracking services
logger.error("Error occurred", error, {
  tenantId,
  userId,
  // Add custom context for your tracking service
  customTrackingId: "track-123",
});
```

---

## Logging Patterns by Use Case

### API Route Logging

```typescript
// app/api/orders/route.ts
import { logger } from "@/lib/utils/logger";
import { getTenantId } from "@/lib/auth/server-auth";

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  const requestId = crypto.randomUUID();

  const apiLogger = logger.child({
    tenantId,
    requestId,
    feature: "orders_api",
  });

  try {
    apiLogger.info("Order creation request received");

    const body = await request.json();
    apiLogger.debug("Request body received", {
      itemCount: body.items?.length,
    });

    const order = await createOrder(body);

    apiLogger.info("Order created successfully", {
      orderId: order.id,
      action: "create",
    });

    return Response.json({ success: true, data: order });
  } catch (error) {
    apiLogger.error("Order creation failed", error as Error, {
      action: "create",
    });
    return Response.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
}
```

### Service Layer Logging

```typescript
// lib/services/order-service.ts
import { logger } from "@/lib/utils/logger";

export class OrderService {
  private serviceLogger = logger.child({ feature: "order_service" });

  async createOrder(data: CreateOrderDto, tenantId: string, userId: string) {
    const operationLogger = this.serviceLogger.child({
      tenantId,
      userId,
      action: "create_order",
    });

    try {
      operationLogger.info("Starting order creation", {
        customerId: data.customerId,
        itemCount: data.items.length,
      });

      // Validate
      if (!data.items || data.items.length === 0) {
        operationLogger.warn("Order creation attempted with no items", {
          customerId: data.customerId,
        });
        throw new Error("Order must have at least one item");
      }

      // Create order
      const order = await this.db.order.create({ data });

      operationLogger.info("Order created successfully", {
        orderId: order.id,
        totalAmount: order.totalAmount,
      });

      return order;
    } catch (error) {
      operationLogger.error("Order creation failed", error as Error);
      throw error;
    }
  }
}
```

### Client-Side Logging

```typescript
// components/orders/OrderForm.tsx
"use client";

import { log } from "@/lib/utils/logger";
import { useAuth } from "@/lib/auth/auth-context";

export function OrderForm() {
  const { user, tenantId } = useAuth();

  const handleSubmit = async (data: OrderFormData) => {
    try {
      log.info("Order form submitted", {
        tenantId,
        userId: user?.id,
        feature: "order_form",
        action: "submit",
      });

      const response = await fetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      log.info("Order created successfully", {
        tenantId,
        userId: user?.id,
        feature: "order_form",
        action: "submit_success",
      });
    } catch (error) {
      log.error("Order form submission failed", error as Error, {
        tenantId,
        userId: user?.id,
        feature: "order_form",
        action: "submit_error",
      });
    }
  };

  // ... rest of component
}
```

### Database Query Logging

```typescript
// lib/db/orders.ts
import { logger } from "@/lib/utils/logger";

export async function getOrders(tenantId: string, filters: OrderFilters) {
  const dbLogger = logger.child({
    tenantId,
    feature: "database",
    action: "query_orders",
  });

  const startTime = Date.now();

  try {
    dbLogger.debug("Executing orders query", {
      filters: Object.keys(filters),
      filterCount: Object.keys(filters).length,
    });

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        ...filters,
      },
    });

    const duration = Date.now() - startTime;

    dbLogger.info("Orders query completed", {
      orderCount: orders.length,
      duration: `${duration}ms`,
    });

    // Log slow queries
    if (duration > 1000) {
      dbLogger.warn("Slow query detected", {
        duration: `${duration}ms`,
        threshold: "1000ms",
      });
    }

    return orders;
  } catch (error) {
    dbLogger.error("Orders query failed", error as Error);
    throw error;
  }
}
```

---

## Performance Logging

### Log Performance Metrics

```typescript
import { logger } from "@/lib/utils/logger";

async function processOrder(orderId: string) {
  const startTime = Date.now();
  const perfLogger = logger.child({
    feature: "order_processing",
    action: "process",
    orderId,
  });

  try {
    perfLogger.debug("Starting order processing");

    // ... processing logic ...

    const duration = Date.now() - startTime;
    perfLogger.info("Order processing completed", {
      duration: `${duration}ms`,
      performance: duration < 1000 ? "good" : "slow",
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    perfLogger.error("Order processing failed", error as Error, {
      duration: `${duration}ms`,
    });
    throw error;
  }
}
```

---

## Structured Logging Format

All logs follow this structure:

```json
{
  "timestamp": "2025-11-14T10:30:00.123Z",
  "level": "INFO",
  "message": "Order created successfully",
  "context": {
    "tenantId": "tenant-123",
    "userId": "user-456",
    "orderId": "order-789",
    "feature": "orders",
    "action": "create"
  },
  "environment": "production",
  "service": "web-admin"
}
```

---

## Best Practices

### ✅ DO

- Always include `tenantId` in multi-tenant operations
- Use child loggers for feature-specific logging
- Log errors with full context
- Use appropriate log levels
- Include request IDs for tracing
- Log performance metrics for slow operations

### ❌ DON'T

- Don't log sensitive data (passwords, tokens, credit cards)
- Don't use `console.log` directly (use logger)
- Don't log full request/response bodies
- Don't log in tight loops (use sampling)
- Don't log user PII unnecessarily
- Don't use DEBUG logs in production code

---

## Migration Guide

### Replacing console.log

```typescript
// ❌ Old way
console.log("Order created", order);
console.error("Error:", error);

// ✅ New way
import { logger } from "@/lib/utils/logger";

logger.info("Order created", { orderId: order.id });
logger.error("Error occurred", error, { context });
```

### Replacing console.debug

```typescript
// ❌ Old way
console.debug("Debug info", data);

// ✅ New way
logger.debug("Debug info", { data });
```

---

## Troubleshooting

### Logs Not Appearing

1. Check log level configuration
2. Verify `NODE_ENV` is set correctly
3. Check if console output is enabled
4. Verify logger is imported correctly

### Sensitive Data in Logs

1. Check if sanitization is enabled
2. Verify sensitive patterns are matched
3. Manually sanitize if needed before logging

### Performance Issues

1. Avoid logging in tight loops
2. Use log sampling for high-frequency events
3. Consider async logging for production

---

## Return to [Main Documentation](../CLAUDE.md)
