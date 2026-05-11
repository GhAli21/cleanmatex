# Plans for Remaining / Deferred Items

This folder contains implementation plans for each item deferred from Phase 8 (18_remaining_items.md).

Each plan is self-contained with:
- Overview and current state
- Prerequisites and dependencies
- Implementation steps
- Acceptance criteria
- Production checklist

**Last audit:** 2026-05-11

## Plan Index

| # | Plan | Item | Priority | Status |
|---|------|------|----------|--------|
| 01 | [01_piece_history.md](01_piece_history.md) | Piece history (audit trail) | High | ✅ Done (2026-05-11) — `0259_org_order_piece_hist_tr`, `GET /api/v1/orders/pieces/[pieceId]/history`, `OrderPieceService` |
| 02 | [02_payment_modal_promo_gift.md](02_payment_modal_promo_gift.md) | Legacy payment modal migration | — | ✅ Done (2026-05-07) |
| 03 | [03_assembly_task_modal.md](03_assembly_task_modal.md) | Assembly task details fetch | Medium | Pending |
| 04 | [04_workflow_average_time.md](04_workflow_average_time.md) | Workflow averageTimePerStage & checkAutoTransitions | Medium | Pending |
| 05 | [05_logger_remote_logging.md](05_logger_remote_logging.md) | Remote logging service integration | Medium | Pending — Sentry path already wired; only generic adapter missing |
| 06 | [06_usage_tracking.md](06_usage_tracking.md) | Usage tracking (storage, API calls) | Medium | Pending |
| 07 | [07_dashboard_widgets.md](07_dashboard_widgets.md) | PaymentMix, Turnaround, Issues, DriverUtilization, DeliveryRate, Alerts, TopServices | High | ✅ Done (2026-05-11) — see [dashboard-kpi-definitions.md](../../dashboard-kpi-definitions.md) |
| 08 | [08_settings_pages.md](08_settings_pages.md) | General & Branding settings API wiring | High | ✅ Done (2026-05-07) |
| 09 | [09_users_page.md](09_users_page.md) | Users/Team management API | High | ✅ Done (2026-05-11) — list/update/activate/deactivate + `createUser` invite; password reset still platform-only (UI shows info message) |
