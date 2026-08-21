# Workboard Technical Contract

## Boundary

`/dashboard/workboard` is an authenticated, tenant-scoped supervisor projection.
It has one read API, `GET /api/v1/workboard/orders`, and no command endpoint.
The page can link to an owning stage screen, but only that stage service/API can
execute a workflow transition.

## Runtime policy resolution

1. Read the tenant's `workboard` screen contract for the legacy/default status set.
2. For each V2 profile/version represented by tenant orders, load the immutable
   graph through `wf_profile_id` + `wf_version_no`.
3. Include a V2 order only when the pinned graph has both active `workboard`
   membership and active membership for one ordered stage owner.
4. For historic/unpinned orders, use the live tenant contract and live owner
   lookup. Do not backfill or rebind historical orders.
5. If no stage owner exists, omit the row and return a `configurationGaps` item.

## Security and data handling

- API and page require `workboard:read`; migration `0455` grants it only to
  supervisor/administrative roles by default.
- Every `org_*` query includes `tenant_org_id`; all stage links remain protected
  by their own page/API access contracts.
- The projection returns no payment, release, delivery proof, mutation, or
  idempotency command data.
- Server-side filters are bounded and validated with Zod. Supported filters are
  `search`, `branchId`, `assigneeId`, `priority`, `ownerScreenKey`, `blocker`,
  `sla`, `sort`, `page`, and `pageSize`.
- Pagination avoids loading an unbounded tenant order list into the browser.

## UI contract

- The Workboard remains read-only and deep-links into the owning stage only.
- Top-level overview cards are supervisor quick-focus controls for **All**, each
  owner stage, **Blocked**, and **Overdue**.
- The API summary returns both active-set counts (`total`, `blocked`,
  `overdue`) and `summary.byOwner` totals so the UI can keep owner-stage quick
  focus visible even after one owner stage is selected.
- The filter toolbar shows the current result count, active filter chips, and a
  clear-filters action.

## Verification

- `npm test -- --runInBand __tests__/services/workboard-query.service.test.ts`
- `npm run check:ui-access-contract -- --route=/dashboard/workboard --wire --verbose`
- `npm run check:i18n`
- `npm run build`
