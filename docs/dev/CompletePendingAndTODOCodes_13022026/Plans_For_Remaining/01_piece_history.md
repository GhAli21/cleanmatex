# Plan: Piece History (Order Piece Audit Trail)

## Overview

Implement the piece history feature that displays an audit trail for piece status changes. Currently `PieceHistory.tsx` has a TODO and returns empty data because the backing table does not exist.

## Current State

- **File:** `web-admin/components/orders/PieceHistory.tsx`
- **Issue:** `loadHistory()` is a stub; sets `history` to empty array
- **TODO:** "Implement history API endpoint when piece_history table is created"
- **Data model:** `PieceHistoryEntry` expects: id, action, fromValue, toValue, doneBy, doneAt, notes

## Prerequisites

1. **Database migration** - Create `org_order_piece_history_tr` table
2. **Triggers or service layer** - Log piece status changes when they occur
3. **API endpoint** - `GET /api/v1/orders/pieces/:pieceId/history`

## Database Design

### Table: org_order_piece_history_tr

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| tenant_org_id | UUID | NO | FK to org_tenants_mst |
| order_piece_id | UUID | NO | FK to org_order_pieces_dtl |
| action_code | VARCHAR(50) | NO | e.g. status_change |
| from_value | TEXT | YES | Previous value |
| to_value | TEXT | YES | New value |
| done_by | UUID | YES | FK to users |
| done_at | TIMESTAMPTZ | NO | When change occurred |
| notes | TEXT | YES | Optional |
| created_at | TIMESTAMPTZ | NO | Audit |

- RLS: tenant_org_id = current user tenant
- Indexes: (tenant_org_id, order_piece_id), (order_piece_id, done_at DESC)

## Implementation Steps

### Step 1: Create migration

- File: `supabase/migrations/NNNN_org_order_piece_history.sql`
- Create table, RLS policies, indexes

### Step 2: Instrument piece updates

- Add inserts to org_order_piece_history_tr on piece status change
- Options: Postgres trigger or service-layer insert in order-piece-service

### Step 3: Create API route

- `app/api/v1/orders/pieces/[pieceId]/history/route.ts`
- GET: require auth, tenant context
- Query org_order_piece_history_tr, return history array

### Step 4: Wire PieceHistory component

- Replace TODO with fetch to API
- Map response to PieceHistoryEntry

## Acceptance Criteria

- Table exists with RLS
- Piece status changes are recorded
- API returns history, tenant-scoped
- PieceHistory displays real data

## Production Checklist

- Migration applied
- RLS tested
- Tenant isolation verified
- Build passes

## References

- web-admin/components/orders/PieceHistory.tsx
- web-admin/lib/services/order-piece-service.ts
