# API clock inventory (S6, `0.1.47`)

Screen endpoints that must return the `clock` block (D21, D34; MASTER_PLAN_v2 §6.3, review row 46).
`web-admin/__tests__/lib/clock/api-clock-inventory.test.ts` reads the table below: every row's
source file must build the block with `screenClock`, `publicScreenClock` or `getPublicClockBlock`.
Add a row when a screen endpoint starts showing times or a "today"; the test fails until the
route returns the block.

- Staff endpoints return the full block (`zone`, `businessDate`, `serverNow`, `hourCycle`, `weekStart`, `tzdbVersion`, `dateFormat`) at the top level of the JSON body, next to `data`.
- Public (anon) endpoints return the public subset only (`zone`, `serverNow`, `hourCycle`, `dateFormat`; §7.16).
- A block that cannot be built is `null` and logged; the screen shows no clock (fail closed). It never fails the response.

| Endpoint | Operation zone | Scope | Block | Source |
|---|---|---|---|---|
| `GET /api/v1/orders` | `accept_order` | organization | full | `web-admin/app/api/v1/orders/route.ts` |
| `GET /api/v1/orders/[id]` | `ready_by` | order branch | full | `web-admin/app/api/v1/orders/[id]/route.ts` |
| `GET /api/v1/cash-drawers/trx` | `pos_session` | organization | full | `web-admin/app/api/v1/cash-drawers/trx/route.ts` |
| `GET /api/v1/cash-drawers/variance-report` | `pos_session` | `branchId` filter | full | `web-admin/app/api/v1/cash-drawers/variance-report/route.ts` |
| `GET /api/v1/finance/reports/orders-summary` | `accept_order` | `branchId` filter | full | `web-admin/app/api/v1/finance/reports/orders-summary/route.ts` |
| `GET /api/v1/finance/reports/payments-breakdown` | `invoice` | organization | full | `web-admin/app/api/v1/finance/reports/payments-breakdown/route.ts` |
| `GET /api/v1/finance/reports/tax-report` | `invoice` | `branchId` filter | full | `web-admin/app/api/v1/finance/reports/tax-report/route.ts` |
| `GET /api/v1/pricing/history` | `accept_order` | organization | full | `web-admin/app/api/v1/pricing/history/route.ts` |
| `GET /api/v1/public/customer/orders` | `accept_order` | organization | public | `web-admin/app/api/v1/public/customer/orders/route.ts` |
| `GET /api/v1/public/track/[token]` (S3) | `ready_by` | order branch | public | `web-admin/lib/services/public-order-tracking.service.ts` |

Server-rendered pages get the block from `getTenantClockBlock` (root `ClockProvider`, S4) and are not listed here.
Later slices add rows: S7 exports and `/health/clock`, S9 cut-over screens, S11 cmx-api (OpenAPI `ClockBlock`), S12 mobile.
