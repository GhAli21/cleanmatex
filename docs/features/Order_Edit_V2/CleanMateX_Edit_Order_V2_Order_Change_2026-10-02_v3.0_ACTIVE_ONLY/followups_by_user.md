# Order Edit V2 — follow-ups for the owner

**As of:** 2026-11-07 · WP01–WP18 code proof complete; WP17 column guard (migration 0702) applied and proved. See [WP18 report](WP18_Release_Proof_v3.0.md) and the [plan ledger](Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md). These items need you.

## 1. UI retest (the only open WP18 gate)

- [ ] Walk MAN-UI-001 to MAN-UI-014 in `F:\jhapp\cleanmatex\docs\features\Order_Edit_V2\CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_ACTIVE_ONLY\CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Manual_UI_Test_Guide.md`. Each covers the matching OC-UI-001 to 012 row in `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Test_Guide_and_Scenario_Matrix.md` (lines 211–222). No Playwright spec exists for them yet.
- [ ] The guide predates the line controls; also check in Edit: per-line and per-piece speed, line price, line and piece discount, custom line, price confirmation in Review, `LINE_SPEED_LOCKED` on a ready line.

### Fixed 2026-11-13 — retest these

- [ ] **Preference on a new item / new piece** (was `PREFERENCE_PARENT_NOT_PERSISTED`): add an item, give it (or one of its pieces) a preference, Review → Apply. Expected: saved; the preference sits on the new line/piece. Apply attaches it to the new row's id (`order-change-commercial-write.ts` `localParents`), and Review signs the same parent (`order-change-review-audit.ts`). A preference on a local row that is not added in the same change is still refused.
- [ ] **Edit header**: no empty band beside the financial card. Title + Review result on the left, Exit / Discard / Review above the card on the right (`edit-order-context-bar.tsx`).
- [ ] **Policy notes in the side panel** name their operations ("Change service speed: needs an override…", "Add an item, Remove an item…: Review will ask you to confirm a warning…") instead of two unlabeled lines under Speed (`edit-control-notice.tsx`, keys `capability.overrideOperations` / `warningOperations`).
- [ ] **Payment modal (New Order, cash)**: the "Change Returned" box under the amount shows the rounded change (e.g. SAR 2.20), the same as the summary, not the exact 2.17. Full view leg change uses the same figure. The split-tender dialog still shows exact per-leg change.

## 2. Edit Policy manual check (Extend Edit Policy, Phase 5)

- [ ] Run the 7 steps of §11.4 in `F:\jhapp\cleanmatex\docs\features\Order_Edit_V2\CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_ACTIVE_ONLY\Extend_Order_Edit_policy_Plan.md` with the tenant app and HQ both running (HQ preview and the tenant policy panel must show the same level and decision).

## 3. HQ Edit policy rules

- [ ] Per workflow profile (HQ › Order Change › Edit Policies → new draft → publish): rules for `CHANGE_SERVICE_SPEED` on `ITEM` and `PIECE`, `CHANGE_DISCOUNT` on `ITEM` and `PIECE`, `CHANGE_ITEM_PRICE` on `ITEM`. Without them those controls stay disabled with the reason.
- [ ] How to reach those cells (checked 2026-11-13): the rules list shows only cells the policy already has, so a policy cloned before these pairs existed hides them. In the draft: "Check coverage against a workflow version" → Check → **Smart fill (missing)** (or "Fill missing as deny"), then set the five cells. All seven catalog pairs are active on remote.

## 4. Later (after sign-off)

- [ ] WP19 pilot with an operator group, then the default cutover.
- [ ] WP20 cleanup once the rollback window has closed.

## 5. Commit

- [ ] `supabase/migrations/0702_oc_committed_column_guard.sql` (applied), `web-admin/lib/services/order-change/order-change-settlement-fingerprint.ts`, the Apply / preview / route changes and their tests (see the Line-Level `followups_by_user.md` §3 for the full list).

## Notes

- Every payment, credit and refund now waits on the order lock while recalculating totals (OC-CON-005). Correct, but a writer that locks a wallet row before the order could deadlock with an Apply; PostgreSQL cancels one with an error (no wrong data). Worth watching in the pilot.
