# Logging Standards

**CRITICAL**: Always use the centralized logging utility (`lib/utils/logger.ts`) for all logging.

## Log Levels

- **DEBUG** (0): Detailed debugging info (development only)
- **INFO** (1): General informational messages
- **WARN** (2): Potential issues that don't stop execution
- **ERROR** (3): Handled failures
- **FATAL** (4): Critical errors requiring immediate attention

## Basic Usage

```typescript
import { logger } from '@/lib/utils/logger';

// Info log
logger.info('Order created successfully', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  orderId: 'order-789',
});

// Warning log
logger.warn('Low inventory detected', {
  tenantId: 'tenant-123',
  productId: 'product-456',
  currentStock: 5,
});

// Error log
try {
  await createOrder(data);
} catch (error) {
  logger.error('Failed to create order', error as Error, {
    tenantId: 'tenant-123',
    userId: 'user-456',
  });
}
```

## Required Context Fields

- **tenantId**: Always include for multi-tenant operations
- **userId**: Include when user action is involved
- **requestId**: Include for request tracing (if available)

## Child Loggers

```typescript
// Create child logger with pre-set context
const orderLogger = logger.child({
  tenantId: 'tenant-123',
  feature: 'orders',
});

// All logs include tenantId and feature automatically
orderLogger.info('Order created', { orderId: 'order-456' });
```

## API Route Logging

```typescript
export async function POST(request: Request) {
  const tenantId = await getTenantId();
  const requestId = crypto.randomUUID();

  const apiLogger = logger.child({
    tenantId,
    requestId,
    feature: 'orders_api',
  });

  try {
    apiLogger.info('Order creation request received');
    const order = await createOrder(body);
    apiLogger.info('Order created successfully', { orderId: order.id });
    return Response.json({ success: true, data: order });
  } catch (error) {
    apiLogger.error('Order creation failed', error as Error);
    return Response.json({ success: false }, { status: 500 });
  }
}
```

## Performance Logging

```typescript
async function processOrder(orderId: string) {
  const startTime = Date.now();

  try {
    // ... processing logic ...
    const duration = Date.now() - startTime;

    logger.info('Order processing completed', {
      duration: `${duration}ms`,
      performance: duration < 1000 ? 'good' : 'slow',
    });

    if (duration > 1000) {
      logger.warn('Slow operation detected', { duration: `${duration}ms` });
    }
  } catch (error) {
    logger.error('Order processing failed', error as Error, {
      duration: `${Date.now() - startTime}ms`,
    });
    throw error;
  }
}
```

## What to Log

### ALWAYS Log
- API Requests (sanitized)
- Database Operations (summaries, not full data)
- Authentication Events
- Authorization Failures
- Business Logic Errors
- Performance Metrics
- State Changes

### NEVER Log
- Passwords
- Tokens (API keys, JWTs)
- Credit Card Numbers
- Full User Objects (log IDs only)
- Sensitive PII
- Full Request/Response Bodies

## Replacing console.log

```typescript
// OLD (don't use)
console.log('Order created', order);
console.error('Error:', error);

// NEW
import { logger } from '@/lib/utils/logger';

logger.info('Order created', { orderId: order.id });
logger.error('Error occurred', error, { context });
```

## Structured Log Format

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
