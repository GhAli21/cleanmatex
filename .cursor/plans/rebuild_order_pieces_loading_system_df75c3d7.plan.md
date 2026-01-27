---
name: Rebuild Order Pieces Loading System
overview: Rebuild the order item pieces loading in the processing details modal to use a single optimized API call instead of sequential per-item requests, with React Query caching and progressive loading for smooth UX.
todos:
  - id: create-pieces-api
    content: Create new API endpoint /api/v1/orders/[id]/pieces/route.ts that uses OrderPieceService.getPiecesByOrder() to fetch all pieces in one query
    status: completed
  - id: add-react-query-hook
    content: "Add React Query hook in processing-modal.tsx to fetch all pieces with caching (queryKey: [order-pieces, orderId])"
    status: completed
    dependencies:
      - create-pieces-api
  - id: remove-sequential-loading
    content: Remove loadPiecesFromDb function and sequential loading loop, replace with React Query data
    status: completed
    dependencies:
      - add-react-query-hook
  - id: add-pieces-grouping
    content: Add useMemo to group pieces by itemId for O(1) lookup in getPiecesForItem function
    status: completed
    dependencies:
      - add-react-query-hook
  - id: implement-progressive-loading
    content: Update modal to show items immediately while pieces load in background with loading indicators
    status: completed
    dependencies:
      - add-pieces-grouping
  - id: test-performance
    content: Test with orders having multiple items, verify single API call, check React Query cache behavior
    status: completed
    dependencies:
      - implement-progressive-loading
---

#Rebuild Order Item Pieces Loading System

## Current Issues

1. **Sequential API Calls**: The modal makes separate HTTP requests for each item's pieces (N requests for N items)
2. **Blocking Load**: Modal waits for all pieces to load before showing content
3. **No Caching**: Pieces are refetched every time the modal opens
4. **Inefficient**: Uses `loadPiecesFromDb` in a loop (lines 278-341 in `processing-modal.tsx`)

## Solution Architecture

### 1. Create Optimized API Endpoint

**New Endpoint**: `/api/v1/orders/[id]/pieces/route.ts`

- Uses existing `OrderPieceService.getPiecesByOrder()` method (already exists at line 242)
- Fetches ALL pieces for ALL items in a single database query
- Returns pieces grouped by `order_item_id` for efficient client-side lookup
- Response format: `{ success: true, pieces: OrderItemPiece[], groupedByItemId: Record<string, OrderItemPiece[]> }`

### 2. Update Processing Modal Component

**File**: `web-admin/app/dashboard/processing/components/processing-modal.tsx`**Changes**:

- Replace sequential `loadPiecesFromDb` calls with a single React Query hook
- Use `useQuery` with key `['order-pieces', orderId]` for caching
- Show items immediately while pieces load in background
- Group pieces by `itemId` using `useMemo` for O(1) lookup
- Remove `loadPiecesFromDb` function (lines 81-132)
- Update `initializePieces` effect (lines 278-341) to use React Query data

### 3. Data Flow Optimization

```mermaid
flowchart TD
    A[Modal Opens] --> B[React Query Hook]
    B --> C{Check Cache}
    C -->|Cache Hit| D[Use Cached Data]
    C -->|Cache Miss| E[Single API Call]
    E --> F[/api/v1/orders/id/pieces]
    F --> G[OrderPieceService.getPiecesByOrder]
    G --> H[Single DB Query]
    H --> I[Return All Pieces]
    I --> J[Group by itemId]
    J --> K[Update React Query Cache]
    K --> L[Render Items with Pieces]
    D --> L
```



### 4. Implementation Details

#### API Endpoint Structure

```typescript
// web-admin/app/api/v1/orders/[id]/pieces/route.ts
GET /api/v1/orders/[id]/pieces
- Uses OrderPieceService.getPiecesByOrder(tenantId, orderId)
- Returns: { success: true, pieces: [], groupedByItemId: {} }
- Includes tenant validation and permission checks
```



#### React Query Integration

```typescript
// In processing-modal.tsx
const { data: piecesData, isLoading: piecesLoading } = useQuery({
  queryKey: ['order-pieces', orderId],
  queryFn: async () => {
    const res = await fetch(`/api/v1/orders/${orderId}/pieces`);
    return res.json();
  },
  enabled: isOpen && !!orderId && trackByPiece,
  staleTime: 30000, // 30 seconds
  gcTime: 5 * 60 * 1000, // 5 minutes
});

// Group pieces by itemId
const piecesByItemId = useMemo(() => {
  const grouped = new Map<string, ItemPiece[]>();
  piecesData?.pieces?.forEach(piece => {
    const itemId = piece.order_item_id;
    if (!grouped.has(itemId)) grouped.set(itemId, []);
    grouped.get(itemId)!.push(mapDbPieceToItemPiece(piece));
  });
  return grouped;
}, [piecesData]);
```



#### Progressive Loading

- Items render immediately when order data loads
- Pieces load in background and populate as they arrive
- Show loading skeleton only for pieces, not entire modal
- Use `isLoading` state to show piece-level loading indicators

### 5. Performance Benefits

- **Before**: N sequential HTTP requests (one per item)
- **After**: 1 HTTP request for all pieces
- **Caching**: React Query prevents refetching on modal reopen
- **UX**: Items visible immediately, pieces populate progressively

### 6. Files to Modify

1. **Create**: `web-admin/app/api/v1/orders/[id]/pieces/route.ts`

- New endpoint using `OrderPieceService.getPiecesByOrder()`
- Returns grouped pieces for efficient lookup

2. **Modify**: `web-admin/app/dashboard/processing/components/processing-modal.tsx`

- Remove `loadPiecesFromDb` function (lines 81-132)
- Replace sequential loading loop (lines 278-341) with React Query hook
- Add `piecesByItemId` memoized Map for fast lookup
- Update `getPiecesForItem` to use memoized Map
- Show items immediately, load pieces progressively

3. **Optional Enhancement**: `web-admin/lib/services/order-piece-service.ts`

- Consider adding method to return grouped pieces directly
- Or keep grouping logic in API endpoint

### 7. Testing Considerations

- Verify single API call is made (check Network tab)
- Test with orders having 1, 5, 10+ items
- Verify React Query cache works (reopen modal, should use cache)
- Test with `trackByPiece` enabled and disabled
- Verify pieces display correctly for each item
- Test error handling when pieces API fails

### 8. Migration Path

- Keep old `loadPiecesFromDb` function commented for rollback
- Feature flag can switch between old/new loading if needed
- Gradual rollout: test with small orders first

## Success Criteria