# Workboard Technical Contract

## Boundary

`/dashboard/workboard` is an authenticated, tenant-scoped supervisor projection.
It has one read API, `GET /api/v1/workboard/orders`, and no command endpoint.
The page can link to an owning stage screen, but only that stage service/API can
execute a workflow transition.

## Runtime policy resolution

1. Read the tenant's `workboard` screen contract for the legacy/default status set.
2. For each compiled artifact represented by tenant orders, load that exact
   immutable artifact. A profile/version pin without artifact identity is excluded.
3. Include a semantic order only when the artifact has both active `workboard`
   membership and an enabled primary-owner stage for that status.
4. For historic/unsnapshotted orders, use the live tenant contract and live owner
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
- The `sort` query is server-owned, so header-driven ordering applies to the
  complete tenant queue rather than only the visible page.
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
- Sortable table headers cover order number, customer, stage, age, ready-by,
  priority, and assignee; sorting is reflected in the API query.
- Workboard opts into the reusable `CmxDataTable` operational-grid treatment:
  emphasized title-case headers, vertical column dividers, horizontal row
  rules, a deliberate minimum table width, and a sticky end-side action column
  for faster cross-column scanning on desktop and narrow viewports.
- Sort state is announced from the semantic column header, while the button
  remains the keyboard-operable sort control.
- Queue-focus cards use semantic stage and risk accents while remaining
  keyboard-accessible filter controls.
- Opening a stage carries the current Workboard query as an internal-only
  `returnUrl`. Stage screens use the same validated path for their Back control
  and completion redirect, preserving the supervisor's queue context.

## Verification

- `npm test -- --runInBand __tests__/services/workboard-query.service.test.ts`
- `npm run check:ui-access-contract -- --route=/dashboard/workboard --wire --verbose`
- `npm run check:i18n`
- `npm run build`
