# Closed unless a workflow needs them

**As of:** 2026-11-24
**Index:** [Remaining_Work_Index.md](Remaining_Work_Index.md)
**Plan rule:** [Remaining_Implementation_Plan.md](Remaining_Implementation_Plan.md) step 5

These are not unfinished work packages. The request schema accepts the codes so Preview and Apply can refuse them with `OPERATION_NOT_AVAILABLE` before any write. An Allow cell in HQ does not enable them. The list is `ORDER_CHANGE_UNAVAILABLE_OPERATION_CODES` in `web-admin/lib/constants/order-change.ts`.

## Catalog operations with no writer

| Operation | If someone asks | Importance |
|---|---|---|
| `CHANGE_CUSTOMER` | Reassign the order to another customer | Real counter need. Build only when a profile must allow it. |
| `CHANGE_BRANCH` | Move the order to another branch | Same. Branch is also a commercial fact. |
| `CHANGE_ORDER_TYPE` | Change the order type after commit | Same, and it can change pricing rules. |
| `CHANGE_ITEM_PRODUCT` | Swap the product on a saved line | Same. Today the cashier removes the line and adds another. |
| `CHANGE_ITEM_SERVICE` | Swap the service on a saved line | Same. |
| `CHANGE_PIECE_BRAND` | Edit the brand on a piece | Low. Only if brand is corrected after intake often enough to justify a writer. |
| `CHANGE_PIECE_RACK` | Edit rack from the Edit screen | Low. Rack and stage stay on workflow. |
| `CHANGE_ORDER_SOURCE` | Change where the order came from | Low. |
| `CHANGE_B2B_REFERENCE` | Contract, cost center, or PO after commit | Low until a B2B profile requires it. |
| `CHANGE_PHYSICAL_INTAKE` | Physical intake status from Edit | Low. Intake stays on its own flow. |
| `CHANGE_QUICK_DROP` | Turn quick drop on or off after commit | Low. |
| `CHANGE_EXPRESS` | A separate express flag | Do not build. Service speed already covers it. |
| `CHANGE_PAYMENT_NOTES` | Payment notes from Edit | Low. |
| `CHANGE_PAYMENT_TYPE` | Change how the order is paid | Keep closed. Payment type is a finance fact. Collect, refund, and overpayment allocation own it. |

`CHANGE_UNLISTED` is not in this list. It is the residual writer for a field that has no catalog operation. Known fields must use their own operation. Do not route customer, price, or payment type through it.

## Writer checklist (only after a written decision)

The decision names one operation, the profiles, and `ALLOW` or `REQUIRE_OVERRIDE`. Then:

1. Confirm the catalog pair already exists. Do not invent a code.
2. Add a bounded writer beside the existing Apply writers. Filter every `org_*` read and write by `tenant_org_id`.
3. Remove that code from `ORDER_CHANGE_UNAVAILABLE_OPERATION_CODES` only when the writer is the one Preview and Apply both call.
4. Price through the shared commercial calculator when the field changes money. Show the delta in Review. Do not rewrite a typed amount as a side effect.
5. Re-resolve policy under the order lock, the same as every shipped writer.
6. Extend `order-change-edit-parity.db.test.ts` so Preview = Apply = the stored row.
7. Save the HQ cell on the Pilot policy and keep that policy as the organization override. Do not publish. Until that cell exists the control stays disabled, which is correct.

Stop before applying any migration. Payment type is not a candidate for this checklist.

## Financial follow-up that stays where it is

WP16 is done for what Finance already owns.

| Situation | Where it is handled |
|---|---|
| Balance due on pay-on-collection | Existing collect-payment route. Edit only points at it. |
| Extra amount with a customer | Advance, credit, or wallet, for the exact cap shown. |
| Any other original payment type | Shown as unavailable. The payment type is not changed. |
| Cash or gateway refund | The refund screen. Edit does not start a refund. |

Building a refund inside the Edit dialog is a finance change, not a missing Edit writer.

## Measured items

`CHANGE_ITEM_MEASURE` is not in the Order Edit catalog list above. It belongs to Measured Pricing phase P5 (`docs/features/Measured_Pricing/`).

Edit currently refuses a measured add or a re-weigh. That matters when the organization sells by weight, length, or area. It does not block piece-count laundry. Implement it in that plan: schemas, the priced-operation set, preview, apply, review, and a policy cell. The money delta is shown and confirmed.

## Importance

Leave this file closed during the pilot. Open one row only when an operator cannot finish a real order with the writers that already ship (add, remove, quantity, speed, price, discount, preference, notes, ready-by, customer snapshot).
