# Error Handling Patterns

**CRITICAL**: Always handle errors gracefully and provide meaningful error messages.
**CRITICAL**: In frontend UI always use `cmxMessage` for showing all messages, errors, alerts.

## HTTP Status Codes

### Client Errors (4xx)
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing/invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Duplicate entry, concurrent modification
- **422 Unprocessable Entity**: Validation failures

### Server Errors (5xx)
- **500 Internal Server Error**: Unexpected server error
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Temporarily unavailable

## Error Response Format

```typescript
{
  success: false,
  error: {
    code: "ORDER_NOT_FOUND",
    message: "Order with ID 123 not found",
    details: { orderId: "123", tenantId: "tenant-456" },
    timestamp: "2025-11-14T10:30:00Z",
    requestId: "req-789"
  }
}
```

## Custom Error Classes

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
    super(message, 'VALIDATION_ERROR', 422, { fields });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
```

## API Route Error Handling

```typescript
// app/api/orders/[id]/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  const requestId = crypto.randomUUID();

  try {
    const order = await getOrder(params.id, tenantId);
    if (!order) {
      throw new OrderNotFoundError(params.id);
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    logger.error('Failed to get order', error as Error, { orderId: params.id });

    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
          requestId,
        },
      }, { status: error.statusCode });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId,
      },
    }, { status: 500 });
  }
}
```

## Service Layer Error Handling

```typescript
export class OrderService {
  private serviceLogger = logger.child({ feature: 'order_service' });

  async getOrder(orderId: string, tenantId: string) {
    const opLogger = this.serviceLogger.child({ tenantId, action: 'get_order', orderId });

    try {
      opLogger.debug('Fetching order');
      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
      });

      if (!order) {
        opLogger.warn('Order not found');
        throw new OrderNotFoundError(orderId);
      }

      opLogger.info('Order retrieved successfully');
      return order;
    } catch (error) {
      if (error instanceof OrderNotFoundError) throw error;
      opLogger.error('Failed to get order', error as Error);
      throw new OrderCreationError('Failed to retrieve order', error as Error);
    }
  }
}
```

## Error Boundaries (React)

```typescript
// components/ErrorBoundary.tsx
'use client';

import { ErrorBoundary } from 'react-error-boundary';
import { logger } from '@/lib/utils/logger';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  logger.error('Error boundary caught error', error, { feature: 'error_boundary' });

  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>;
}
```

## Best Practices

### DO
- Always handle errors gracefully
- Provide meaningful error messages
- Log errors with full context
- Use custom error classes for domain errors
- Include error codes for programmatic handling
- Return appropriate HTTP status codes

### DON'T
- Don't expose sensitive data in error messages
- Don't log passwords, tokens, or credit card numbers
- Don't swallow errors silently
- Don't expose stack traces to users in production
- Don't forget to include tenant context in errors
