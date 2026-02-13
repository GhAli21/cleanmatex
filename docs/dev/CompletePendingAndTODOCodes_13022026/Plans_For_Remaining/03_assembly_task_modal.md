# Plan: Assembly Task Modal – Task Details Fetch

## Overview

The `AssemblyTaskModal` has a TODO to fetch task details when `taskId` is provided. Currently it does not load or display task metadata (items, status, progress). This plan adds the fetch and wires the modal to show real data.

## Current State

- **File:** `web-admin/src/features/assembly/ui/assembly-task-modal.tsx`
- **Issue:** `useEffect` when `taskId` exists contains `// TODO: Fetch task details`
- **Props:** `orderId`, `taskId?`, `onClose`, `onComplete`
- **Existing:** Uses `useStartAssemblyTask`, `usePackOrder` hooks
- **Service:** `AssemblyService` in `lib/services/assembly-service.ts` has methods for tasks

## Prerequisites

- `org_asm_tasks_mst` table exists (assembly system in place)
- `AssemblyService` provides or can be extended to provide task-by-ID fetch
- API route for task details or service method callable from server/client

## Data Needed for Modal

- Task: `id`, `order_id`, `task_status`, `qa_status`, `scanned_items`, `total_items`, `location_id`, `assigned_to`
- Order items / assembly items for scanning progress
- Optional: order summary (customer, order_no)

## Implementation Steps

### Step 1: Add getTaskById (or equivalent) to AssemblyService

- Method: `AssemblyService.getTaskById(taskId, tenantId)`
- Query `org_asm_tasks_mst` with `org_asm_items_dtl` (assembly items)
- Return task + items with product names
- Ensure tenant isolation

### Step 2: Create API route (if using REST)

- `GET /api/v1/assembly/tasks/[taskId]`
- Auth + tenant check
- Call `AssemblyService.getTaskById`
- Return `{ task, items }`

### Step 3: Add useAssemblyTaskDetails hook

- File: `web-admin/src/features/assembly/hooks/use-assembly.ts` (or new file)
- `useAssemblyTaskDetails(taskId)` → `{ task, items, loading, error }`
- Fetch from API when taskId present

### Step 4: Wire AssemblyTaskModal

- Replace TODO in `useEffect` with `useAssemblyTaskDetails(taskId)`
- Set `taskData` from hook result
- Render task info: status, scanned/total items, location
- Show assembly items list with scan status
- Use task status to enable/disable Start/Pack buttons

### Step 5: Handle loading and error

- Show skeleton or spinner while loading
- Show error message if fetch fails

## Acceptance Criteria

- [ ] Task details load when modal opens with taskId
- [ ] Modal shows task status, progress (scanned/total)
- [ ] Assembly items visible with scan state
- [ ] Start/Pack actions work with loaded task
- [ ] Tenant isolation enforced

## Production Checklist

- [ ] API/auth tested
- [ ] RLS on assembly tables verified
- [ ] Build passes
- [ ] i18n for any new labels

## References

- `web-admin/src/features/assembly/ui/assembly-task-modal.tsx`
- `web-admin/lib/services/assembly-service.ts`
- `web-admin/src/features/assembly/hooks/use-assembly.ts`
- PRD-009: Assembly & QA Workflow
