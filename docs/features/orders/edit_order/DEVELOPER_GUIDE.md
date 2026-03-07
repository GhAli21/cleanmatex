# Edit Order Feature - Developer Guide

**Quick Reference for Developers**
**Last Updated:** 2026-03-07

---

## Quick Start

### Running Locally

```bash
# 1. Navigate to web-admin
cd f:/jhapp/cleanmatex/web-admin

# 2. Apply migrations (if not already done)
npx supabase migration up

# 3. Set environment variable
echo "FEATURE_EDIT_ORDER_ENABLED=true" >> .env.local

# 4. Start dev server
npm run dev

# 5. Navigate to orders list
# http://localhost:3000/dashboard/orders
```

### Testing an Edit

```bash
# Create a test order in DRAFT status
# Click "Edit Order" button
# Make changes and save
# Check database:
psql $DATABASE_URL -c "SELECT * FROM org_order_edit_history LIMIT 5;"
```

---

## Architecture Overview

### Request Flow

```
User clicks "Edit Order"
  ↓
GET /api/v1/orders/[id]/editability
  → isOrderEditable() → Check status, flags
  ↓
POST /api/v1/orders/[id]/lock
  → lockOrderForEdit() → Insert into org_order_edit_locks
  ↓
Load form with order data
  → LOAD_ORDER_FOR_EDIT action
  ↓
User edits and clicks "Save"
  ↓
PATCH /api/v1/orders/[id]/update
  → updateOrder() service
    → Validate editability
    → Check lock
    → Create before snapshot
    → Update order in transaction
    → Create after snapshot
    → createEditAudit()
    → Unlock order
  ↓
Success → Redirect to order detail
```

### State Management

```typescript
// State structure
interface NewOrderState {
  // Existing fields...

  // Edit mode additions
  isEditMode: boolean;              // True when editing
  editingOrderId: string | null;    // Order being edited
  editingOrderNo: string | null;    // For display
  originalOrderData: any | null;    // Original data reference
  lockInfo: OrderLockInfo | null;   // Lock metadata
  expectedUpdatedAt: Date | null;   // Optimistic locking
}

// Actions
ENTER_EDIT_MODE      // Switch to edit mode
LOAD_ORDER_FOR_EDIT  // Load order data into form
EXIT_EDIT_MODE       // Exit and cleanup
SET_LOCK_INFO        // Update lock status
```

---

## Key Services

### 1. Order Editability

**File:** `lib/utils/order-editability.ts`

```typescript
import { isOrderEditable, canDeleteOrder } from '@/lib/utils/order-editability';

// Check if order can be edited
const result = isOrderEditable(order);
if (!result.canEdit) {
  console.log('Cannot edit:', result.reason);
  console.log('Blockers:', result.blockers);
}

// Check if order can be deleted
const canDelete = canDeleteOrder(order);
if (!canDelete.canDelete) {
  console.log('Cannot delete:', canDelete.reason);
}
```

**Returns:**
```typescript
{
  canEdit: boolean;
  reason?: string;
  blockers?: string[];
}
```

**Blockers:**
- Invalid status (not DRAFT/INTAKE/PREPARATION)
- Preparation completed
- Split order
- Closed retail order

---

### 2. Order Lock Service

**File:** `lib/services/order-lock.service.ts`

```typescript
import {
  lockOrderForEdit,
  unlockOrder,
  checkOrderLock,
  extendLock,
  cleanupExpiredLocks
} from '@/lib/services/order-lock.service';

// Acquire lock
const lock = await lockOrderForEdit({
  orderId: 'order-id',
  tenantId: 'tenant-id',
  userId: 'user-id',
  userName: 'John Doe',
  sessionId: 'session-id',
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0...'
});

// Check lock status
const status = await checkOrderLock('order-id', 'tenant-id');
if (status.isLocked && status.lockedBy !== userId) {
  throw new Error(`Locked by ${status.lockedByName}`);
}

// Extend lock (refresh expiration)
await extendLock('order-id', 'tenant-id', 'user-id');

// Release lock
await unlockOrder({
  orderId: 'order-id',
  tenantId: 'tenant-id',
  userId: 'user-id',
  force: false  // Admin can force=true
});

// Cleanup expired locks (for cron job)
const deletedCount = await cleanupExpiredLocks();
```

**Lock TTL:** 30 minutes

**Conflict Resolution:**
- Same user → Refresh lock
- Different user → Throw error
- Admin → Can force unlock

---

### 3. Order Audit Service

**File:** `lib/services/order-audit.service.ts`

```typescript
import {
  createEditAudit,
  getOrderEditHistory,
  compareOrderSnapshots,
  generateChangeSummary
} from '@/lib/services/order-audit.service';

// Create audit record
await createEditAudit({
  orderId: 'order-id',
  tenantId: 'tenant-id',
  userId: 'user-id',
  userName: 'John Doe',
  snapshotBefore: beforeData,
  snapshotAfter: afterData,
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0...',
  paymentAdjusted: false,
  paymentAdjustmentAmount: null,
  paymentAdjustmentType: null
});

// Get edit history
const history = await getOrderEditHistory('order-id', 'tenant-id');
// Returns: Array of edit records with snapshots and changes

// Compare snapshots (used internally)
const diff = compareOrderSnapshots(before, after);
// Returns: { fieldChanges, itemChanges, priceChanges }
```

**Audit Record Structure:**
```typescript
{
  id: string;
  order_id: string;
  edit_number: number;  // Sequential: 1, 2, 3...
  snapshot_before: any; // JSONB
  snapshot_after: any;  // JSONB
  changes: {
    fieldChanges: Array<{field, oldValue, newValue}>;
    itemChanges: {added, removed, modified};
    priceChanges: {oldTotal, newTotal, difference};
  };
  change_summary: string;  // Human-readable
  edited_by: string;
  edited_by_name: string;
  edited_at: Date;
}
```

---

### 4. Order Service (Extended)

**File:** `lib/services/order-service.ts`

```typescript
import { OrderService } from '@/lib/services/order-service';

// Update order
const updatedOrder = await OrderService.updateOrder({
  orderId: 'order-id',
  tenantId: 'tenant-id',
  userId: 'user-id',
  userName: 'John Doe',

  // Optional updates
  customerId: 'new-customer-id',
  branchId: 'branch-id',
  notes: 'Updated notes',
  readyByAt: new Date('2026-03-10'),
  express: true,

  // Customer snapshot
  customerName: 'Jane Smith',
  customerMobile: '+1234567890',
  customerEmail: 'jane@example.com',

  // Items (full replacement)
  items: [
    {
      serviceId: 'service-id',
      itemTypeId: 'item-type-id',
      quantity: 5,
      unitPrice: 10.00,
      totalPrice: 50.00,
      pieces: [
        { barcode: 'BC001', position: 1 }
      ]
    }
  ],

  // Flags
  recalculate: true,
  expectedUpdatedAt: new Date('2026-03-07T10:00:00Z')
});
```

**Transaction Steps:**
1. Validate editability
2. Check lock ownership
3. Fetch existing order
4. Create before snapshot
5. Delete old items/pieces
6. Create new items/pieces
7. Recalculate totals (if needed)
8. Update order master
9. Create after snapshot
10. Save audit record
11. Unlock order

---

## Validation Schemas

**File:** `lib/validations/edit-order-schemas.ts`

```typescript
import {
  updateOrderInputSchema,
  lockOrderInputSchema,
  unlockOrderInputSchema,
  type UpdateOrderInput,
  type UpdateOrderItem
} from '@/lib/validations/edit-order-schemas';

// Validate update input
const result = updateOrderInputSchema.safeParse(input);
if (!result.success) {
  console.error(result.error.issues);
}

// Type-safe data
const data: UpdateOrderInput = result.data;
```

**Schema Structure:**
```typescript
updateOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  readyByAt: z.coerce.date().optional(),
  express: z.boolean().optional(),

  // Customer snapshot
  customerName: z.string().optional(),
  customerMobile: z.string().optional(),
  customerEmail: z.string().email().optional(),

  // Items (full replacement)
  items: z.array(updateOrderItemSchema).optional(),

  // Flags
  recalculate: z.boolean().default(true),
  expectedUpdatedAt: z.coerce.date().optional()
});
```

---

## API Endpoints

### 1. Update Order

**Endpoint:** `PATCH /api/v1/orders/[id]/update`
**Permission:** `orders:update`
**File:** `app/api/v1/orders/[id]/update/route.ts`

```typescript
// Request
PATCH /api/v1/orders/abc-123/update
{
  "customerId": "customer-id",
  "items": [...],
  "recalculate": true,
  "expectedUpdatedAt": "2026-03-07T10:00:00Z"
}

// Response (Success)
{
  "success": true,
  "data": {
    "order": { /* updated order */ }
  }
}

// Response (Locked)
{
  "success": false,
  "error": "Order is locked by John Doe"
}  // HTTP 423

// Response (Conflict)
{
  "success": false,
  "error": "Order was modified by another user"
}  // HTTP 409
```

### 2. Check Editability

**Endpoint:** `GET /api/v1/orders/[id]/editability`
**Permission:** Authenticated
**File:** `app/api/v1/orders/[id]/editability/route.ts`

```typescript
// Request
GET /api/v1/orders/abc-123/editability

// Response (Can Edit)
{
  "success": true,
  "data": {
    "canEdit": true,
    "reason": null,
    "blockers": []
  }
}

// Response (Cannot Edit)
{
  "success": true,
  "data": {
    "canEdit": false,
    "reason": "Order status not editable",
    "blockers": ["STATUS_INVALID", "PROCESSING_STARTED"]
  }
}
```

### 3. Acquire Lock

**Endpoint:** `POST /api/v1/orders/[id]/lock`
**Permission:** Authenticated
**File:** `app/api/v1/orders/[id]/lock/route.ts`

```typescript
// Request
POST /api/v1/orders/abc-123/lock
{
  "sessionId": "session-id"
}

// Response (Success)
{
  "success": true,
  "data": {
    "lock": {
      "orderId": "abc-123",
      "lockedBy": "user-id",
      "lockedByName": "John Doe",
      "lockedAt": "2026-03-07T10:00:00Z",
      "expiresAt": "2026-03-07T10:30:00Z"
    }
  }
}

// Response (Locked by Other)
{
  "success": false,
  "error": "Order is currently locked by Jane Smith"
}  // HTTP 423
```

### 4. Release Lock

**Endpoint:** `POST /api/v1/orders/[id]/unlock`
**Permission:** Authenticated
**File:** `app/api/v1/orders/[id]/unlock/route.ts`

```typescript
// Request
POST /api/v1/orders/abc-123/unlock
{
  "force": false  // Admin can force=true
}

// Response (Success)
{
  "success": true,
  "data": {
    "message": "Order unlocked successfully"
  }
}
```

---

## Frontend Components

### Edit Order Button

**File:** `src/features/orders/ui/order-actions.tsx`

```tsx
// Conditionally rendered based on order status
{isEditableStatus(order.status) && (
  <Button
    variant="outline"
    onClick={() => router.push(`/dashboard/orders/${order.id}/edit`)}
  >
    <Edit className="h-4 w-4" />
    {t('orders.actions.buttons.editOrder')}
  </Button>
)}
```

### Edit Order Page

**File:** `app/dashboard/orders/[id]/edit/page.tsx`

```tsx
// 1. Load order data
const order = await fetchOrder(id);

// 2. Check editability
const editabilityCheck = await checkEditability(id);
if (!editabilityCheck.canEdit) {
  return <ErrorPage message={editabilityCheck.reason} />;
}

// 3. Acquire lock
const lock = await acquireLock(id);

// 4. Render edit screen
return <EditOrderScreen order={order} lock={lock} />;

// 5. Cleanup on unmount
useEffect(() => {
  return () => releaseLock(id);
}, [id]);
```

### Edit Order Screen

**File:** `src/features/orders/ui/edit-order-screen.tsx`

```tsx
// Transform order to form state
const formState = transformOrderToFormState(order);

// Dispatch load action
dispatch({
  type: 'LOAD_ORDER_FOR_EDIT',
  payload: {
    orderId: order.id,
    orderNo: order.order_no,
    orderData: formState,
    lockInfo: lock,
    expectedUpdatedAt: order.updated_at
  }
});

// Reuse existing form components
return (
  <NewOrderLayout>
    <NewOrderContent />
    <NewOrderModals />
  </NewOrderLayout>
);
```

### Save Handler

**File:** `src/features/orders/hooks/use-order-submission.ts`

```typescript
// Detect edit mode
if (state.isEditMode && state.editingOrderId) {
  // Call update API
  const response = await fetch(
    `/api/v1/orders/${state.editingOrderId}/update`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        expectedUpdatedAt: state.expectedUpdatedAt
      })
    }
  );

  // Handle response
  if (response.ok) {
    toast.success(t('orders.edit.success'));
    dispatch({ type: 'EXIT_EDIT_MODE' });
    router.push(`/dashboard/orders/${state.editingOrderId}`);
  }
} else {
  // Call create API (normal flow)
  // ...
}
```

---

## Database Schema

### org_order_edit_locks

```sql
CREATE TABLE org_order_edit_locks (
  order_id UUID PRIMARY KEY,
  tenant_org_id UUID NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_name TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,

  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id),
  FOREIGN KEY (tenant_org_id) REFERENCES sys_tenants_mst(id),
  FOREIGN KEY (locked_by) REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_order_edit_locks_tenant ON org_order_edit_locks(tenant_org_id);
CREATE INDEX idx_order_edit_locks_expires ON org_order_edit_locks(expires_at);
CREATE INDEX idx_order_edit_locks_user ON org_order_edit_locks(locked_by);
```

### org_order_edit_history

```sql
CREATE TABLE org_order_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  edit_number INTEGER NOT NULL,
  snapshot_before JSONB NOT NULL,
  snapshot_after JSONB NOT NULL,
  changes JSONB,
  change_summary TEXT,
  payment_adjusted BOOLEAN DEFAULT FALSE,
  payment_adjustment_amount DECIMAL(19,4),
  payment_adjustment_type TEXT,
  edited_by UUID NOT NULL,
  edited_by_name TEXT NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (order_id, edit_number),
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id),
  FOREIGN KEY (tenant_org_id) REFERENCES sys_tenants_mst(id),
  FOREIGN KEY (edited_by) REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_order_edit_history_order ON org_order_edit_history(order_id, edit_number DESC);
CREATE INDEX idx_order_edit_history_tenant ON org_order_edit_history(tenant_org_id);
CREATE INDEX idx_order_edit_history_date ON org_order_edit_history(edited_at);
CREATE INDEX idx_order_edit_history_user ON org_order_edit_history(edited_by);

-- GIN indexes for JSONB
CREATE INDEX idx_order_edit_history_changes_gin ON org_order_edit_history USING GIN (changes);
CREATE INDEX idx_order_edit_history_before_gin ON org_order_edit_history USING GIN (snapshot_before);
CREATE INDEX idx_order_edit_history_after_gin ON org_order_edit_history USING GIN (snapshot_after);
```

---

## Database Functions

### Get Next Edit Number

```sql
-- Automatically get next sequential edit number
SELECT get_next_order_edit_number('order-id');
-- Returns: 1, 2, 3, ...
```

### Get Edit Summary

```sql
-- Get aggregate edit statistics
SELECT * FROM get_order_edit_summary('order-id');
-- Returns:
{
  edit_count: 5,
  last_edited_at: '2026-03-07T10:00:00Z',
  last_edited_by_name: 'John Doe',
  total_payment_adjustments: 150.00
}
```

### Check Feature Flag

```sql
-- Check if feature enabled for tenant/branch
SELECT can_edit_orders_feature('tenant-id', 'branch-id');
-- Returns: true/false

-- Get detailed status
SELECT * FROM get_order_edit_feature_status('tenant-id', 'branch-id');
-- Returns:
{
  is_enabled: true,
  global_enabled: true,
  tenant_enabled: true,
  branch_enabled: true,
  disabled_reason: null
}
```

### Cleanup Expired Locks

```sql
-- Manually cleanup (normally runs via pg_cron)
SELECT cleanup_expired_order_edit_locks();
-- Returns: count of deleted locks
```

---

## Environment Variables

```bash
# .env.local or production environment

# Global feature flag (default: true)
FEATURE_EDIT_ORDER_ENABLED=true
```

---

## Common Development Tasks

### Add New Editable Field

1. **Update validation schema:**
   ```typescript
   // lib/validations/edit-order-schemas.ts
   export const updateOrderInputSchema = z.object({
     // ...existing fields
     newField: z.string().optional()
   });
   ```

2. **Update service logic:**
   ```typescript
   // lib/services/order-service.ts
   if (params.newField !== undefined) {
     updateData.new_field = params.newField;
   }
   ```

3. **Update frontend state:**
   ```typescript
   // src/features/orders/model/new-order-types.ts
   // Add field to NewOrderState if needed
   ```

4. **Update snapshot comparison:**
   ```typescript
   // lib/services/order-audit.service.ts
   // Field will be auto-captured in snapshot
   // Optionally add to change detection logic
   ```

### Add New Editability Rule

```typescript
// lib/utils/order-editability.ts
export function isOrderEditable(order: Order): EditabilityResult {
  // ... existing checks

  // Add new check
  if (order.custom_field === 'blocked') {
    return {
      canEdit: false,
      reason: 'Order is blocked for editing',
      blockers: ['CUSTOM_BLOCK']
    };
  }

  return { canEdit: true };
}
```

### Extend Lock Duration

```typescript
// lib/services/order-lock.service.ts
const LOCK_DURATION_MINUTES = 30;  // Change to desired minutes

// Or make it configurable
const lockDuration = parseInt(process.env.ORDER_LOCK_DURATION_MINUTES || '30');
```

---

## Debugging

### Enable Debug Logging

```typescript
// Add to service methods
console.log('[OrderLock] Acquiring lock:', { orderId, userId });
console.log('[OrderAudit] Creating audit:', { editNumber, changesCount });
```

### Check Lock Status

```sql
-- View all active locks
SELECT * FROM org_order_edit_locks WHERE expires_at > NOW();

-- View locks for specific order
SELECT * FROM org_order_edit_locks WHERE order_id = 'order-id';

-- View expired locks (should be cleaned up)
SELECT * FROM org_order_edit_locks WHERE expires_at < NOW();
```

### Check Edit History

```sql
-- View all edits for an order
SELECT
  edit_number,
  edited_by_name,
  edited_at,
  change_summary
FROM org_order_edit_history
WHERE order_id = 'order-id'
ORDER BY edit_number DESC;

-- View specific edit details
SELECT
  snapshot_before,
  snapshot_after,
  changes
FROM org_order_edit_history
WHERE order_id = 'order-id' AND edit_number = 1;
```

### Common Issues

**Lock not releasing:**
```sql
-- Force unlock
DELETE FROM org_order_edit_locks WHERE order_id = 'order-id';
```

**Edit button not showing:**
- Check order status
- Check feature flags
- Check user permissions
- Check browser console for errors

**Validation errors:**
- Check Zod schema
- Check browser console for details
- Check network tab for API response

---

## Testing

### Unit Tests (Example)

```typescript
// __tests__/services/order-lock.service.test.ts
describe('Order Lock Service', () => {
  it('should acquire lock for order', async () => {
    const lock = await lockOrderForEdit({
      orderId: 'test-order-id',
      tenantId: 'test-tenant-id',
      userId: 'test-user-id',
      userName: 'Test User'
    });

    expect(lock).toBeDefined();
    expect(lock.orderId).toBe('test-order-id');
  });

  it('should throw error if locked by another user', async () => {
    // First lock
    await lockOrderForEdit({
      orderId: 'test-order-id',
      tenantId: 'test-tenant-id',
      userId: 'user-1',
      userName: 'User 1'
    });

    // Try to lock with different user
    await expect(
      lockOrderForEdit({
        orderId: 'test-order-id',
        tenantId: 'test-tenant-id',
        userId: 'user-2',
        userName: 'User 2'
      })
    ).rejects.toThrow('locked by User 1');
  });
});
```

### Integration Test (Example)

```typescript
// e2e/edit-order.spec.ts
test('should edit order successfully', async ({ page }) => {
  // Navigate to orders list
  await page.goto('/dashboard/orders');

  // Find a DRAFT order
  const firstDraftOrder = page.locator('[data-status="DRAFT"]').first();

  // Click Edit button
  await firstDraftOrder.locator('[data-action="edit"]').click();

  // Wait for edit page
  await page.waitForURL(/\/edit$/);

  // Make changes
  await page.fill('[name="notes"]', 'Updated notes');

  // Save
  await page.click('[data-action="save"]');

  // Verify success
  await expect(page.locator('[role="alert"]')).toContainText('Order updated successfully');
});
```

---

## Performance Considerations

### Database Query Optimization

```sql
-- Use indexes for lock checks
EXPLAIN ANALYZE
SELECT * FROM org_order_edit_locks
WHERE order_id = 'order-id' AND expires_at > NOW();

-- Use covering index for edit history
EXPLAIN ANALYZE
SELECT edit_number, change_summary
FROM org_order_edit_history
WHERE order_id = 'order-id'
ORDER BY edit_number DESC;
```

### Caching Strategy

```typescript
// Cache editability check result (short TTL)
const cacheKey = `editability:${orderId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = isOrderEditable(order);
await redis.setex(cacheKey, 60, JSON.stringify(result));  // 60 seconds
```

---

## Security Checklist

- [ ] RLS policies enforce tenant isolation
- [ ] Permission checks on all API endpoints
- [ ] CSRF validation on mutating endpoints
- [ ] Lock ownership verified before save
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevented (Prisma parameterized queries)
- [ ] XSS prevented (React escaping)
- [ ] Audit trail captures all changes
- [ ] No sensitive data in client logs

---

## Related Documentation

- [Implementation Guide](./edit_order_implementation.md)
- [Test Plan](./EDIT_ORDER_TEST_PLAN.md)
- [Status Report](./STATUS.md)
- [Future Enhancements](./FUTURE_ENHANCEMENTS.md)
- [README](./README.md)

---

**Questions?** Check the main [README](./README.md) or handoff document at `.claude/handoff-edit-order-implementation.md`
