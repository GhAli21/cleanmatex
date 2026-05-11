# Dashboard KPI definitions (web-admin)

**Source:** `web-admin/lib/services/dashboard.service.ts` → `getKPIOverview`.

| KPI | Definition |
|-----|------------|
| **Avg TAT (30d)** | Mean of `(delivered_at - created_at)` in hours for orders with `delivered_at` set, created in the last 30 days, excluding `CANCELLED`. |
| **On-time delivery %** | Among the same delivered set with `ready_by` set, share where `delivered_at <= ready_by`. |
| **TAT trend %** | Week-over-week change in avg TAT: current 7 days vs previous 7 days (positive = slower). |
| **Payment mix** | Bucketed by `org_payments_dtl_tr.payment_method` (last 30d by `created_at`): cash / card / online / other; percentages by **paid_amount** weights. |
| **Issues** | `org_order_item_issues`: open = `solved_at` null and `rec_status` null or 1; critical open = priority `high` or `urgent`; resolved = `solved_at` in last 30d. |
| **Drivers** | From `org_dlv_routes_mst` (last 30d): distinct `driver_id`; active = `in_progress` or `started_at` today. Utilization = active / total drivers. |
| **Delivery widget** | From `org_dlv_stops_dtl` (last 30d): success rate = `delivered` / (`delivered` + `failed`); pending = `pending` + `in_transit`. |
| **Alerts** | Overdue orders (`ready_by` before now, not terminal); open critical issues; failed stops in last 30d. |
| **Top services** | Sum of `org_order_items_dtl.total_price` by `service_category_code` for orders created in last 30d (optional `branch_id` on orders). |

**DB:** Piece audit: `org_order_piece_hist_tr` (migration `0259_org_order_piece_hist_tr.sql`), filled from `OrderPieceService.updatePiece`.
