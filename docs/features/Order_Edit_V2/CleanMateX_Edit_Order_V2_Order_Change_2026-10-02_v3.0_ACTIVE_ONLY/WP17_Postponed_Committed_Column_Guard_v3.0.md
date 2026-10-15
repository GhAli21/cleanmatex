# WP17 postponed — committed commercial column guard

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** POSTPONED. WP17 is closed without this item. Resume it before pilot, from this file. It is not part of WP18.
**Decision:** Do not revoke `anon`, `authenticated`, or `service_role` grants. The tenant app writes through `authenticated`. Revoking that role would stop Create, processing, and finance.

## What was found

On the local database, `anon`, `authenticated`, and `service_role` can `INSERT`, `UPDATE`, and `DELETE` these tables:

- `org_orders_mst`
- `org_order_items_dtl`
- `org_order_item_pieces_dtl`
- `org_order_preferences_dtl`
- `org_order_charges_dtl`

Row security limits which organization a session can see. It does not stop a session inside that organization from changing quantity, price, or preferences on a committed order through the data API. The route guards do not cover that path.

## What to build later

Add one new migration. Do not edit `0113` or `0627`.

- While `committed_at` is empty, the trigger does nothing. Create keeps working.
- After the order is committed, reject a change to quantity, product, price, notes, stain, damage, packing, or preference content.
- Leave readiness, scan, rack, piece stage, and processing confirmation open. Those stay with workflow.
- Edit Order Apply, charge void, preference-charge repair, and the financial snapshot set a transaction-local flag before they write. The trigger allows that transaction through.

Review the migration before it is applied. Prove Create, a readiness save, a charge void, and a refused direct price update before treating the guard as active.

## Not in this postponement

Route closure, structural Apply, the processing echo check, the order lock, and the applied `0627` repair-function refusal stay in the closed WP17 report.
