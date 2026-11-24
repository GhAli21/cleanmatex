# Plan for the remaining Order Edit V2 work

**As of:** 2026-11-24
**Index:** [Remaining_Work_Index.md](Remaining_Work_Index.md)

This is the sequence for what is still open. The sole work-package authority remains [Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md](Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md). Do not open a WP21 from this file. When a step changes a package, update that package’s row on the living ledger.

## What kind of work is left

| Kind | Items | Code? |
|---|---|---|
| HQ data | Five policy cells on a Pilot policy, assigned as the organization override. Do not publish. Role grants. | No |
| Human proof | [Remaining_Test_Guide.md](Remaining_Test_Guide.md) | No, unless a row fails |
| Live parity | Seven-step policy check | No |
| Operations | WP19 pilot, then WP20 cleanup | Runbook and, after the rollback window, removal of the retired edit path |
| Product backlog | Fourteen operations with no writer; measured-item edit | Only after a written decision. See [Remaining_Closed_Unless_Needed.md](Remaining_Closed_Unless_Needed.md) |

## Order

Do them in this order. A later step does not start because an earlier one is inconvenient.

### Step 1 — Operator gate

File: [Remaining_Before_Operators_Rely_on_Edit.md](Remaining_Before_Operators_Rely_on_Edit.md).

1. Save the five cells on the Pilot policy and assign it as that organization’s override. Do not publish, and do not set a version default or a profile default.
2. Assign `orders:edit` and list who holds `orders:edit_override`.
3. Run the remaining test guide. Fix only the rows that fail. A money mismatch or a dropped preference is a defect in the current writer, not a new feature.

**Exit:** the test guide pass rule is met on the pilot organization. The policy lifecycle is still Pilot.

### Step 2 — One-profile production check

File: [Remaining_Before_Production_Path.md](Remaining_Before_Production_Path.md), section “Edit Policy parity”.

Run the seven steps with the tenant app and HQ both open. Record the level and decision at steps 2, 3, 5, and 6. They must match Effective Preview.

**Exit:** the runbook table in the Extend Edit Policy status file has a result on every step, or this file’s result log does.

### Step 3 — WP19 pilot

Same file, section “WP19”.

1. One branch, one operator group, one profile, for one to two weeks.
2. Watch denies, `REVIEW_CHANGED`, version conflicts, and follow-up balances that nobody collected or allocated.
3. Watch deadlocks: a payment or credit that locks a wallet before the order can collide with Apply. PostgreSQL cancels one side. The order must stay consistent and the cashier must be able to retry.
4. Rollback, if used, keeps every committed Change. It does not delete history or recreate the order.

**Exit:** the pilot log has no open money defect, and the owner accepts the default-on flag for that profile.

The flag already defaults to on. This step is a watched cohort, not a switch from off to on.

### Step 4 — WP20 cleanup

Same file, section “WP20”. Start only after the rollback window the owner names in the pilot log.

1. Remove unreachable full-replacement edit paths.
2. Keep history readers.
3. Refresh the support notes: permissions, flag, policy, follow-up, and the operations that stay closed.
4. Invoke the documentation skill for the release pack named on the living plan’s WP20 row. Do not copy this file into a second living plan.

**Exit:** no doc tells a cashier to use the legacy full-replacement update for a calculator order.

### Step 5 — Closed operations, only when asked

File: [Remaining_Closed_Unless_Needed.md](Remaining_Closed_Unless_Needed.md).

There is no schedule. A request names one operation, the profiles, and the decision (`ALLOW` or `REQUIRE_OVERRIDE`). Implementation then follows the writer checklist in that file. Payment-type change stays out of Edit.

Measured re-weigh is Measured Pricing P5 (`CHANGE_ITEM_MEASURE`), owned by `docs/features/Measured_Pricing/`. It is not an Order Edit work package. Start it there when measured products are sold.

## Owners

| Step | Owner |
|---|---|
| 1 Pilot policy cells and role grants | HQ operator |
| 1 and 2 test logs | Tester, with an engineer only on a failed row |
| 3 pilot | Store supervisor plus the engineer on call for denies and deadlocks |
| 4 cleanup | Engineer, after the owner closes the rollback window |
| 5 a new writer | Engineer, after a written product decision |

## Out of scope for this plan

- Rebuilding WP01–WP18, the column guard, or Edit Policy phases 1–4. See [Remaining_Already_Finished.md](Remaining_Already_Finished.md).
- A second calculator. Edit already uses the shared commercial calculator.
- Automatic cash or gateway refunds from the Edit follow-up dialog. Refunds stay on the refund screen.
- Applying database migrations. None of steps 1–3 needs one. A new writer in step 5 stops after the SQL file is written and waits for review.
