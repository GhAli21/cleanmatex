# CleanMateX Edit Order V2 active source index

Use the [v3.0 README](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_README.md) for the exact authority order and active specialized source links. The sole living plan is [Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md](Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md).

All WP work must also follow [Implementation Governance](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md), which owns reuse-first discovery, domain ownership, separation of concerns, legacy Edit migration/deprecation, architecture verification, documentation synchronization, and the WP Definition of Done.

**Edit money (since 2026-10-28):** Edit preview and apply price the order on the shared commercial calculator (ADR-060), not on the WP08 adapter. The rules are in [Line-Level Money Snapshot PLAN](../../Order_Fin/Line_Level_Money_Snapshot/PLAN.md) (L24 prices, D22 tax, EC-08 header-only edits) and the progress in its [STATUS](../../Order_Fin/Line_Level_Money_Snapshot/STATUS.md) (P6-01). `order-change-calculation.service.ts` was deleted. Orders from before the calculator are refused for money edits with `ORDER_NEEDS_RECOMPUTE`. The real-database proof is `web-admin/__tests__/db-integration/order-change-edit-parity.db.test.ts`.

Verification work must use [Test Guide and Scenario Matrix](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Test_Guide_and_Scenario_Matrix.md). Use [Manual UI Test Guide](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Manual_UI_Test_Guide.md) only for genuinely human visual/usability/RTL/accessibility/device checks; it is not a substitute for missing automation.

Only the reconciled v3.0 Markdown sources and matching CSV views are active. The duplicate plan filename is a redirect. DOCX/ZIP files are supplied reference snapshots pending regeneration; they must not override the current Markdown contracts. v2.x and older Codex plans are superseded and excluded from active reasoning.

Do not create another implementation plan. Review evidence is in [the final validation report](../Edit_Order_V2_v3.0_Final_Validation_Report_Codex.md). Current WP progress/authorization is recorded only in the living plan. The governance update itself authorizes no new implementation. WP07–WP09 require the documented retroactive governance audit before unqualified DONE status is restored.
