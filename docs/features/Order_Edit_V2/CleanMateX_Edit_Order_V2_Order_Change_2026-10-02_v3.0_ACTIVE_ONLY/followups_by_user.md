# Order Edit V2 — follow-ups for the owner

**As of:** 2026-11-07 · WP01–WP18 code proof complete; WP17 column guard (migration 0702) applied and proved. See [WP18 report](WP18_Release_Proof_v3.0.md) and the [plan ledger](Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md). These items need you.

## 1. UI retest (the only open WP18 gate)

- [ ] Walk MAN-UI-001 to MAN-UI-014 in `F:\jhapp\cleanmatex\docs\features\Order_Edit_V2\CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_ACTIVE_ONLY\CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Manual_UI_Test_Guide.md`. Each covers the matching OC-UI-001 to 012 row in `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Test_Guide_and_Scenario_Matrix.md` (lines 211–222). No Playwright spec exists for them yet.
- [ ] The guide predates the line controls; also check in Edit: per-line and per-piece speed, line price, line and piece discount, custom line, price confirmation in Review, `LINE_SPEED_LOCKED` on a ready line.

## 2. Edit Policy manual check (Extend Edit Policy, Phase 5)

- [ ] Run the 7 steps of §11.4 in `F:\jhapp\cleanmatex\docs\features\Order_Edit_V2\CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_ACTIVE_ONLY\Extend_Order_Edit_policy_Plan.md` with the tenant app and HQ both running (HQ preview and the tenant policy panel must show the same level and decision).

## 3. HQ Edit policy rules

- [ ] Per workflow profile (HQ › Order Change › Edit Policies → new draft → publish): rules for `CHANGE_SERVICE_SPEED` on `ITEM` and `PIECE`, `CHANGE_DISCOUNT` on `ITEM` and `PIECE`, `CHANGE_ITEM_PRICE` on `ITEM`. Without them those controls stay disabled with the reason.

## 4. Later (after sign-off)

- [ ] WP19 pilot with an operator group, then the default cutover.
- [ ] WP20 cleanup once the rollback window has closed.

## 5. Commit

- [ ] `supabase/migrations/0702_oc_committed_column_guard.sql` (applied), `web-admin/lib/services/order-change/order-change-settlement-fingerprint.ts`, the Apply / preview / route changes and their tests (see the Line-Level `followups_by_user.md` §3 for the full list).

## Notes

- Every payment, credit and refund now waits on the order lock while recalculating totals (OC-CON-005). Correct, but a writer that locks a wallet row before the order could deadlock with an Apply; PostgreSQL cancels one with an error (no wrong data). Worth watching in the pilot.
