---
version: v1.0.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# Error Handling Patterns

**CRITICAL**: Always handle errors gracefully and provide meaningful error messages to users and developers.
**CRITICAL**: in frontend UI Always use Global Message Utility (`cmxMessage`) for showing all and any messages, errors, alerts ... so on
---

## Error Types

### HTTP Status Codes

#### Client Errors (4xx)

- **400 Bad Request**: Invalid input data or malformed request
- **401 Unauthorized**: Missing or invalid authentication credentials
- **403 Forbidden**: Authenticated but insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource conflict (e.g., duplicate entry, concurrent modification)
- **422 Unprocessable Entity**: Valid request but semantic errors (validation failures)

#### Server Errors (5xx)

- **500 Internal Server Error**: Unexpected server error
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Service temporarily unavailable
- **504 Gateway Timeout**: Upstream service timeout

---

## Error Response Format

### Standard Error Response

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

### Error Code Convention

Use UPPER_SNAKE_CASE for error codes:

- `ORDER_NOT_FOUND`
- `VALIDATION_ERROR`
- `UNAUTHORIZED_ACCESS`
- `PAYMENT_FAILED`
- `TENANT_NOT_FOUND`

---

## Custom Error Classes

### Base Error Classes

```typescript
// lib/errors/base-errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(
      `${resource} with ID ${id} not found`,
      `${resource.toUpperCase()}_NOT_FOUND`,
      404,
      { resource, id }
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields: Record<string, string[]>) {
    super(message, "VALIDATION_ERROR", 422, { fields });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized access") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
  }
}
```

### Domain-Specific Errors

```typescript
// lib/errors/order-errors.ts

import { AppError } from "./base-errors";

export class OrderNotFoundError extends AppError {
  constructor(orderId: string) {
    super(`Order with ID ${orderId} not found`, "ORDER_NOT_FOUND", 404, {
      orderId,
    });
  }
}

export class OrderStatusTransitionError extends AppError {
  constructor(orderId: string, currentStatus: string, targetStatus: string) {
    super(
      `Cannot transition order from ${currentStatus} to ${targetStatus}`,
      "ORDER_STATUS_TRANSITION_ERROR",
      400,
      { orderId, currentStatus, targetStatus }
    );
  }
}

export class OrderCreationError extends AppError {
  constructor(message: string, cause?: Error) {
    super(
      message,
      "ORDER_CREATION_ERROR",
      500,
      cause ? { cause: cause.message } : undefined
    );
    if (cause) {
      this.cause = cause;
    }
  }
}
```

---

## Error Handling in Next.js

### Server Components

```typescript
// app/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import { logger } from "@/lib/utils/logger";
import { OrderNotFoundError } from "@/lib/errors/order-errors";

export default async function OrderPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    const order = await getOrder(params.id);

    if (!order) {
      logger.warn("Order not found", { orderId: params.id });
      notFound(); // Triggers not-found.tsx
    }

    return <OrderDetails order={order} />;
  } catch (error) {
    logger.error("Failed to load order", error as Error, {
      orderId: params.id,
      feature: "orders",
      action: "view_order",
    });

    // Re-throw to trigger error.tsx
    throw error;
  }
}
```

### API Routes

```typescript
// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { OrderNotFoundError, ValidationError } from "@/lib/errors/order-errors";
import { getTenantId } from "@/lib/auth/server-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = await getTenantId();
  const requestId = crypto.randomUUID();

  const apiLogger = logger.child({
    tenantId,
    requestId,
    feature: "orders_api",
  });

  try {
    if (!params.id) {
      throw new ValidationError("Order ID is required", {
        id: ["Order ID is required"],
      });
    }

    const order = await getOrder(params.id, tenantId);

    if (!order) {
      throw new OrderNotFoundError(params.id);
    }

    apiLogger.info("Order retrieved successfully", {
      orderId: order.id,
      action: "get_order",
    });

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    apiLogger.error("Failed to get order", error as Error, {
      orderId: params.id,
      action: "get_order",
    });

    // Handle known errors
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
            requestId,
          },
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
            requestId,
          },
        },
        { status: error.statusCode }
      );
    }

    // Unknown error - return generic error
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
          timestamp: new Date().toISOString(),
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
```

### Client Components

```typescript
// components/orders/OrderForm.tsx
"use client";

import { useState } from "react";
import { logger } from "@/lib/utils/logger";
import { useAuth } from "@/lib/auth/auth-context";

export function OrderForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, tenantId } = useAuth();

  const handleSubmit = async (data: OrderFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      logger.info("Order form submitted", {
        tenantId,
        userId: user?.id,
        feature: "order_form",
        action: "submit",
      });

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle API error response
        const errorMessage = result.error?.message || "Failed to create order";
        throw new Error(errorMessage);
      }

      logger.info("Order created successfully", {
        tenantId,
        userId: user?.id,
        orderId: result.data.id,
        feature: "order_form",
        action: "submit_success",
      });

      // Redirect or show success message
      router.push(`/orders/${result.data.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";

      logger.error("Order form submission failed", err as Error, {
        tenantId,
        userId: user?.id,
        feature: "order_form",
        action: "submit_error",
      });

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {/* form fields */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Order"}
      </button>
    </form>
  );
}
```

---

## Error Handling in Services

### Service Layer Error Handling

```typescript
// lib/services/order-service.ts
import { logger } from "@/lib/utils/logger";
import {
  OrderNotFoundError,
  OrderCreationError,
} from "@/lib/errors/order-errors";

export class OrderService {
  private serviceLogger = logger.child({ feature: "order_service" });

  async getOrder(orderId: string, tenantId: string) {
    const operationLogger = this.serviceLogger.child({
      tenantId,
      action: "get_order",
      orderId,
    });

    try {
      operationLogger.debug("Fetching order");

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          tenantId, // Always filter by tenant
        },
      });

      if (!order) {
        operationLogger.warn("Order not found");
        throw new OrderNotFoundError(orderId);
      }

      operationLogger.info("Order retrieved successfully");
      return order;
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        throw error; // Re-throw known errors
      }

      operationLogger.error("Failed to get order", error as Error);
      throw new OrderCreationError("Failed to retrieve order", error as Error);
    }
  }

  async createOrder(data: CreateOrderDto, tenantId: string, userId: string) {
    const operationLogger = this.serviceLogger.child({
      tenantId,
      userId,
      action: "create_order",
    });

    try {
      // Validation
      if (!data.items || data.items.length === 0) {
        throw new ValidationError("Order must have at least one item", {
          items: ["At least one item is required"],
        });
      }

      // Business logic validation
      const customer = await this.getCustomer(data.customerId, tenantId);
      if (!customer) {
        throw new NotFoundError("Customer", data.customerId);
      }

      // Create order
      const order = await prisma.order.create({
        data: {
          ...data,
          tenantId,
          createdBy: userId,
        },
      });

      operationLogger.info("Order created successfully", {
        orderId: order.id,
      });

      return order;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error; // Re-throw known errors
      }

      operationLogger.error("Order creation failed", error as Error);
      throw new OrderCreationError("Failed to create order", error as Error);
    }
  }
}
```

---

## Error Logging

### Always Log Errors with Context

```typescript
import { logger } from "@/lib/utils/logger";

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
    logger.error("Operation failed", error as Error, {
      feature: "operation",
      action: "execute",
    });
  });

// Async/await
try {
  const result = await asyncOperation();
  logger.info("Operation completed", { result });
} catch (error) {
  logger.error("Operation failed", error as Error, {
    feature: "operation",
    action: "execute",
  });
}
```

---

## Error Boundaries (React)

### Setup Error Boundary

```typescript
// components/ErrorBoundary.tsx
"use client";

import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { logger } from "@/lib/utils/logger";

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  logger.error("Error boundary caught error", error, {
    feature: "error_boundary",
  });

  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
  );
}
```

### Usage

```typescript
// app/layout.tsx
import { AppErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppErrorBoundary>{children}</AppErrorBoundary>
      </body>
    </html>
  );
}
```

---

## Best Practices

### ✅ DO

- Always handle errors gracefully
- Provide meaningful error messages
- Log errors with full context
- Use custom error classes for domain errors
- Include error codes for programmatic handling
- Return appropriate HTTP status codes
- Sanitize error messages before exposing to users
- Use error boundaries for React components

### ❌ DON'T

- Don't expose sensitive data in error messages
- Don't log passwords, tokens, or credit card numbers
- Don't swallow errors silently
- Don't use generic error messages
- Don't expose stack traces to users in production
- Don't forget to include tenant context in errors
- Don't use `any` type for error handling

---

## Error Handling Checklist

Before deploying, ensure:

- [ ] All async operations have error handling
- [ ] Custom error classes are used for domain errors
- [ ] Errors are logged with full context
- [ ] Error messages are user-friendly
- [ ] Sensitive data is not exposed in errors
- [ ] Appropriate HTTP status codes are returned
- [ ] Error boundaries are set up for React components
- [ ] Tenant context is included in error logs

---

## Related Documentation

- [Logging Rules](./logging-rules.md) - Error logging guidelines
- [PRD Implementation Rules](./prd-implementation_rules.md) - General error handling standards
- [Code Review Checklist](./code_review_checklist.md) - Error handling review checklist

---

## Return to [Main Documentation](../CLAUDE.md)
