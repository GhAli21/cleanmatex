# Plan: Usage Tracking (Storage and API Calls)

## Overview

The `usage-tracking.service.ts` has two TODOs:
1. Storage usage (storageMb) - "Implement when file storage is added"
2. API calls count (apiCalls) - "Implement API usage tracking"

## Current State

- **File:** `web-admin/lib/services/usage-tracking.service.ts`
- **Method:** `calculateUsage()` returns `storageMb: 0`, `apiCalls: 0`
- **Table:** `org_usage_tracking` stores orders_count, users_count, branches_count, storage_mb, api_calls
- **Context:** Usage drives plan limits and billing

## Prerequisites

- File storage: MinIO or similar (see Phase 3 MinIO integration)
- API usage: Middleware or proxy that can count requests per tenant
- `org_usage_tracking` schema supports storage_mb and api_calls

## Implementation Steps

### Part A: Storage Usage

#### 1. Define storage scope

- What counts: order photos, receipts, attachments, logos?
- Bucket/path structure: e.g. `orders/{tenantId}/`, `logos/{tenantId}/`

#### 2. Query MinIO (or storage backend)

- List objects under tenant prefix
- Sum object sizes (or use bucket analytics if available)
- Convert to MB for storage_mb
- Cache result to avoid expensive list on every calculateUsage

#### 3. Integrate into calculateUsage

- Replace `storageMb = 0` with call to storage usage helper
- Handle MinIO not configured: keep 0
- Optional: Background job for daily storage aggregation

### Part B: API Usage

#### 1. Choose measurement approach

- **Option A:** Middleware increments counter per tenant per request (Redis/DB)
- **Option B:** API gateway / proxy logs processed later
- **Option C:** Per-tenant request log table with periodic aggregation

#### 2. If middleware approach

- Add `usage-tracking.middleware.ts` or extend existing API middleware
- On each API request: increment tenant's api_calls for current period
- Store in Redis (fast) or DB table with upsert
- `calculateUsage` reads current period total

#### 3. Integrate into calculateUsage

- Replace `apiCalls = 0` with read from counter/store
- Ensure period alignment (monthly) with usage_tracking.period_start/end

#### 4. Consider exclusions

- Health checks, static assets, webhooks from external systems may be excluded
- Document what counts as billable API call

## Acceptance Criteria

- [ ] storageMb reflects actual tenant storage when MinIO configured
- [ ] apiCalls reflects tenant API usage (or clearly scoped subset)
- [ ] calculateUsage upserts correct values to org_usage_tracking
- [ ] No regression when storage/API tracking not configured (graceful 0)

## Production Checklist

- [ ] Storage paths and tenant isolation verified
- [ ] API counter does not add significant latency
- [ ] Period boundaries and timezone handled correctly
- [ ] Build passes

## References

- web-admin/lib/services/usage-tracking.service.ts
- web-admin/lib/storage/upload-photo.ts (MinIO)
- docs/dev/CompletePendingAndTODOCodes_13022026/10_minio_integration.md
