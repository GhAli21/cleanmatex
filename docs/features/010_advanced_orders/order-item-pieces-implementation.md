# Order Item Pieces Implementation

## Overview

This document describes the complete implementation of order item pieces functionality. **Pieces are always used**: every order item has corresponding rows in `org_order_item_pieces_dtl`. The former tenant setting `USE_TRACK_BY_PIECE` no longer gates piece creation or display.

## Architecture

### Database Schema

**Table:** `org_order_item_pieces_dtl`

Key features:
- UUID primary key
- Composite unique constraint on `(tenant_org_id, order_id, order_item_id, piece_seq)`
- Generated `piece_code` column
- Foreign keys to orders, items, products, and service categories
- RLS policies for tenant isolation
- Indexes for performance

### Service Layer

**File:** `web-admin/lib/services/order-piece-service.ts`

Core methods:
- `createPiecesForItem()` - Auto-creates pieces when item is created
- `getPiecesByItem()` - Fetches all pieces for an item
- `getPieceById()` - Fetches single piece
- `updatePiece()` - Updates a single piece
- `batchUpdatePieces()` - Batch updates multiple pieces
- `syncItemQuantityReady()` - Syncs quantity_ready on parent item
- `deletePiece()` - Soft deletes a piece

### API Routes

**Base Path:** `/api/v1/orders/:id/items/:itemId/pieces`

- `GET /` - List all pieces for an item
- `POST /` - Create pieces for an item
- `PATCH /` - Batch update pieces
- `GET /:pieceId` - Get single piece
- `PATCH /:pieceId` - Update single piece
- `DELETE /:pieceId` - Delete piece
- `POST /sync` - Sync quantity_ready

### UI Components

**Location:** `web-admin/components/orders/`

- `OrderPiecesManager` - Main manager component
- `PieceList` - List of pieces
- `PieceCard` - Individual piece card
- `PieceStatusBadge` - Status indicator
- `PiecesErrorBoundary` - Error boundary wrapper

## Features

### Phase 1: Service Layer + Basic CRUD APIs ✅
- Complete service layer implementation
- RESTful API routes
- Tenant isolation
- Error handling

### Phase 2: Auto-create Pieces ✅
- Automatic piece creation when items are created (always; no setting gate)
- Calculates price per piece automatically

### Phase 3: Reusable UI Components ✅
- Modular component architecture
- RTL support
- i18n ready
- Loading and error states

### Phase 4: Integration ✅
- Integrated into ProcessingModal
- Piece-level tracking is always shown; item-level view is fallback when pieces are loading

### Phase 5: Advanced Features ✅
- Batch operations
- Sync functionality
- Optimistic updates
- Error boundaries

### Phase 6: Internationalization ✅
- Complete translation keys (EN/AR)
- RTL-aware translations
- Summary messages

### Phase 7: Error Handling ✅
- Error boundary component
- Enhanced error logging
- User-friendly error messages
- Retry functionality

### Phase 8: Optimistic Updates ✅
- Immediate UI feedback
- Rollback on error
- Improved UX

### Phase 9: Testing ✅
- Unit tests for service layer
- Validation utility tests
- Test coverage for core operations

### Phase 10: Validation ✅
- Piece sequence validation
- Status transition validation
- Quantity and price validation
- Barcode format validation
- Batch update validation

### Phase 13: Integration Updates ✅
- Updated batch-update endpoint
- Always uses pieces table for updates

## Usage

### Basic Usage

```typescript
import { OrderPiecesManager } from '@/components/orders';

<OrderPiecesManager
  orderId={order.id}
  itemId={item.id}
  tenantId={tenantId}
  onUpdate={handleRefresh}
  showSplitCheckbox={splitOrderEnabled}
  rejectColor={rejectColor}
/>
```

### With Error Boundary

```typescript
import { PiecesErrorBoundary } from '@/components/orders';

<PiecesErrorBoundary>
  <OrderPiecesManager {...props} />
</PiecesErrorBoundary>
```

## Configuration

### Tenant Settings

- **Pieces:** Always used; no tenant setting gates piece creation or display. (The former `USE_TRACK_BY_PIECE` setting is no longer checked.)
- `USE_REJECT_TO_SOLVE` - Enable rejection features
- `USING_SPLIT_ORDER` - Enable split order features
- `REJECT_ROW_COLOR` - Color for rejected items/pieces

## Testing

### Run Unit Tests

```bash
npm test -- order-piece-service.test.ts
npm test -- piece-validation.test.ts
```

### Test Coverage

- Service layer: CRUD operations, batch updates, sync
- Validation: All validation functions
- Edge cases: Error handling, invalid data

## Performance Considerations

- Database indexes on frequently queried fields
- Batch operations for multiple updates
- Optimistic updates for better UX
- Efficient query patterns

## Future Enhancements

- Barcode scanning integration
- Bulk operations UI
- Piece history/audit trail
- Notifications for piece status changes
- Reporting and analytics

## Related Documentation

- [Database Conventions](../database_conventions.md)
- [Multi-Tenancy Patterns](../multitenancy.md)
- [Error Handling Rules](../error-handling-rules.md)
- [Testing Strategy](../testing.md)

