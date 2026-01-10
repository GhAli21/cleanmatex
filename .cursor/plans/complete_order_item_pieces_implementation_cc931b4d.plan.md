---
name: Complete Order Item Pieces Implementation
overview: Comprehensive plan to complete all aspects of order item pieces functionality including translations, error handling, optimistic updates, testing, edge cases, performance optimizations, and additional features.
todos: []
---

# Complete Order Item Pieces Implementation Plan

## Overview

This plan covers all remaining work to fully implement and polish the order item pieces feature, including translations, error handling, testing, optimizations, and additional enhancements.

## Phase 6: Internationalization (i18n)

### 6.1 Add Translation Keys

**Files to Update:**

- `web-admin/messages/en.json`
- `web-admin/messages/ar.json`

**Translation Keys Needed:**

```json
{
  "orders": {
    "pieces": {
      "title": "Pieces",
      "piece": "Piece",
      "pieces": "Pieces",
      "noPieces": "No pieces found",
      "loading": "Loading pieces...",
      "retry": "Retry",
      "refresh": "Refresh",
      "step": "Step",
      "selectStep": "Select step",
      "ready": "Ready",
      "split": "Split",
      "notes": "Notes",
      "notesPlaceholder": "Add notes...",
      "noNotes": "No notes",
      "rackLocation": "Rack Location",
      "rackLocationPlaceholder": "Enter rack location",
      "notSet": "Not set",
      "color": "Color",
      "brand": "Brand",
      "hasStain": "Has stain",
      "hasDamage": "Has damage",
      "status": {
        "intake": "Intake",
        "processing": "Processing",
        "qa": "Quality Check",
        "ready": "Ready"
      },
      "rejected": "Rejected",
      "steps": {
        "sorting": "Sorting",
        "pretreatment": "Pretreatment",
        "washing": "Washing",
        "drying": "Drying",
        "finishing": "Finishing"
      },
      "errors": {
        "loadFailed": "Failed to load pieces",
        "updateFailed": "Failed to update piece",
        "createFailed": "Failed to create pieces",
        "deleteFailed": "Failed to delete piece"
      },
      "success": {
        "updated": "Piece updated successfully",
        "created": "Pieces created successfully",
        "deleted": "Piece deleted successfully"
      }
    }
  }
}
```

**Tasks:**

- Add all translation keys to `en.json`
- Add Arabic translations to `ar.json`
- Ensure RTL-aware translations
- Test translations in both languages

## Phase 7: Error Handling & Boundaries

### 7.1 Create Error Boundary Component

**File:** `web-admin/components/orders/PiecesErrorBoundary.tsx`**Features:**

- Wrap OrderPiecesManager and related components
- Display user-friendly error messages
- Provide retry functionality
- Log errors with context

### 7.2 Enhanced Error Handling

**Updates Needed:**

- Add try-catch blocks in all API routes
- Add error logging with tenant context
- Create custom error classes for piece operations
- Add error recovery mechanisms
- Handle network failures gracefully

**Files to Update:**

- All API routes in `app/api/v1/orders/[id]/items/[itemId]/pieces/`
- `OrderPieceService` methods
- `OrderPiecesManager` component

## Phase 8: Optimistic Updates

### 8.1 Implement Optimistic Updates

**Update OrderPiecesManager:**

- Use React Query's `onMutate` for optimistic updates
- Rollback on error
- Show loading states during updates
- Update local state immediately

**Update ProcessingModal:**

- Integrate optimistic updates for batch operations
- Show immediate feedback
- Handle rollback scenarios

## Phase 9: Testing

### 9.1 Unit Tests

**Files to Create:**

- `__tests__/services/order-piece-service.test.ts`
- `__tests__/utils/piece-utils.test.ts`

**Test Coverage:**

- CRUD operations
- Batch updates
- Sync operations
- Edge cases (empty arrays, null values, invalid IDs)
- Tenant isolation
- Error handling

### 9.2 Integration Tests

**Files to Create:**

- `__tests__/api/pieces-api.test.ts`

**Test Scenarios:**

- API endpoint responses
- Authentication/authorization
- Tenant isolation
- Data validation
- Error responses

### 9.3 Component Tests

**Files to Create:**

- `__tests__/components/orders/OrderPiecesManager.test.tsx`
- `__tests__/components/orders/PieceCard.test.tsx`

**Test Scenarios:**

- Component rendering
- User interactions
- State management
- Error states
- Loading states

## Phase 10: Edge Cases & Validation

### 10.1 Data Validation

**Add Validation:**

- Piece sequence uniqueness
- Quantity limits
- Status transitions
- Price calculations
- Barcode format validation

### 10.2 Edge Cases Handling

**Scenarios to Handle:**

- Item deleted while pieces exist
- Order deleted while pieces exist
- Concurrent updates
- Network failures during updates
- Invalid piece IDs
- Missing required fields
- Duplicate piece creation

### 10.3 Migration & Data Integrity

**Tasks:**

- Create migration script for existing orders
- Handle orders created before pieces feature
- Validate data consistency
- Add database constraints
- Create cleanup scripts

## Phase 11: Performance Optimizations

### 11.1 Query Optimizations

**Improvements:**

- Add database indexes (already done in migration)
- Implement pagination for large piece lists
- Use select() to fetch only needed fields
- Cache frequently accessed data
- Batch database operations

### 11.2 Frontend Optimizations

**Improvements:**

- Implement virtual scrolling for large lists
- Debounce piece updates
- Use React.memo for components
- Optimize re-renders
- Lazy load piece details

### 11.3 API Optimizations

**Improvements:**

- Add response caching headers
- Implement request batching
- Use database transactions for batch updates
- Optimize N+1 queries

## Phase 12: Additional Features

### 12.1 Barcode Scanning

**Features:**

- Scan barcode to update piece
- Barcode generation for pieces
- Barcode lookup API
- QR code support

**Files to Create:**

- `app/api/v1/orders/[id]/items/[itemId]/pieces/scan/route.ts`
- `components/orders/PieceBarcodeScanner.tsx`

### 12.2 Bulk Operations

**Features:**

- Select multiple pieces
- Bulk status update
- Bulk reject/resolve
- Bulk rack location assignment
- Export piece data

### 12.3 Piece History & Audit

**Features:**

- Track piece status changes
- Log all piece updates
- Display piece history
- Audit trail component

**Database:**

- Consider adding `org_order_piece_history_tr` table

### 12.4 Notifications

**Features:**

- Notify when piece is ready
- Notify when piece is rejected
- Notify on status changes
- Email/SMS notifications (future)

### 12.5 Reporting & Analytics

**Features:**

- Piece-level statistics
- Processing time per piece
- Rejection rates
- Step completion times
- Performance metrics

## Phase 13: Integration Updates

### 13.1 Update Batch Update Endpoint

**File:** `app/api/v1/orders/[id]/batch-update/route.ts`**Changes:**

- Update to use pieces table when `USE_TRACK_BY_PIECE` is enabled
- Maintain backward compatibility
- Sync quantity_ready automatically

### 13.2 Update Split Order Logic

**File:** `app/api/v1/orders/[id]/split/route.ts`**Changes:**

- Handle piece-level splitting
- Move pieces to new order
- Update piece references
- Maintain data integrity

### 13.3 Update Other Screens

**Screens to Update:**

- Order Detail Page - Show pieces if enabled
- Preparation Screen - Display pieces
- QA Screen - Piece-level QA decisions
- Assembly Screen - Piece-level assembly

## Phase 14: Documentation

### 14.1 API Documentation

**Create:**

- OpenAPI/Swagger spec for piece endpoints
- API usage examples
- Error code reference
- Rate limiting documentation

### 14.2 Component Documentation

**Create:**

- Storybook stories for components
- Usage examples
- Props documentation
- Integration guides

### 14.3 User Documentation

**Create:**

- User guide for piece tracking
- Feature explanation
- Workflow diagrams
- FAQ section

## Phase 15: Real-World Testing

### 15.1 Test Scenarios

**Scenarios:**

- Create order with pieces
- Update pieces in processing
- Reject pieces
- Split order with pieces
- Complete order with pieces
- Multi-user concurrent access
- Large orders (100+ pieces)
- Network failure recovery

### 15.2 Performance Testing

**Tests:**

- Load testing with 1000+ pieces
- Concurrent update testing
- Database query performance
- API response times
- Frontend rendering performance

### 15.3 User Acceptance Testing

**Tasks:**

- Test with real users
- Gather feedback
- Fix usability issues
- Optimize workflows

## Implementation Priority

1. **High Priority** (Must Have):

- Phase 6: Translations
- Phase 7: Error handling
- Phase 9: Unit tests
- Phase 10: Edge cases
- Phase 13: Integration updates

2. **Medium Priority** (Should Have):

- Phase 8: Optimistic updates
- Phase 11: Performance optimizations
- Phase 12.1-12.2: Barcode & bulk operations
- Phase 14: Documentation

3. **Low Priority** (Nice to Have):

- Phase 12.3-12.5: Advanced features
- Phase 15: Extended testing

## Dependencies

- Existing `USE_TRACK_BY_PIECE` setting
- Database migration `0073_org_order_item_pieces_dtl.sql`
- OrderPieceService and API routes (Phase 1-2)
- UI components (Phase 3)

## Success Criteria

- All translation keys added and tested
- Error boundaries catch and handle errors g
- Allracefully
- Optimistic updates provide instant feedback
- Unit tests achieve 80%+ coverage