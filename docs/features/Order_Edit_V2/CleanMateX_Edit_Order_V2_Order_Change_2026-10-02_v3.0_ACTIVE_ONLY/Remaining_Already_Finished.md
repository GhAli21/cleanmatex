# Already finished — do not rebuild

**As of:** 2026-11-24
**Index:** [Remaining_Work_Index.md](Remaining_Work_Index.md)

The living plan’s older paragraphs still say the Edit Policy extension is partial, the column guard is postponed, and WP18 has not started. The evidence below is later and wins. Use it before scheduling engineering.

| Topic | Evidence | State |
|---|---|---|
| WP01–WP16 | Ledger rows in the living plan, plus each WP report | Done for the scope each report names |
| Edit money | Shared commercial calculator. `order-change-calculation.service.ts` deleted. Pre-calculator orders refuse money edits with `ORDER_NEEDS_RECOMPUTE`. | Done. Proof: `web-admin/__tests__/db-integration/order-change-edit-parity.db.test.ts` |
| Line controls in the product | Line-level plan P6-02 (speed, price, discount, custom line, price confirmation) | Done in code. They stay disabled until the five cells are saved on the Pilot organization override. Publishing is not required for that override. |
| WP17 writers | [WP17_Committed_Writer_Closure_v3.0.md](WP17_Committed_Writer_Closure_v3.0.md) | Closed for the delivered writers |
| Committed-column guard | Migration `0702_oc_committed_column_guard.sql`. [WP17_Postponed_Committed_Column_Guard_v3.0.md](WP17_Postponed_Committed_Column_Guard_v3.0.md) status CLOSED 2026-11-07 | Applied and proved. `authenticated` cannot change committed money or lines. Workflow fields and Prisma writers still can. |
| WP18 code proof | [WP18_Release_Proof_v3.0.md](WP18_Release_Proof_v3.0.md) | Concurrency, tenant scan, permission denials, settlement fingerprint under the order lock. Open item is the human UI retest only. |
| Edit Policy phases 1–4 | [Extend_Order_Edit_policy_STATUS.md](Extend_Order_Edit_policy_STATUS.md) | Database, tenant resolver, HQ API, and HQ screens are done. The seven-step live check is the remaining proof. |
| Historical backfill | WP02 recheck and the WP18 report | No legacy cohort left to convert |
| Flag | `order_edit_v2` in `web-admin/lib/constants/feature-flags.ts` | Default on |

## Stale sentences to ignore

- Living plan progress row “Edit Policy resolution extension / PARTIAL” still mentions HQ phases 3–4 as open. The status file closed them on 2026-10-23.
- Living plan WP17 section still says the column guard is postponed. The postponement note was closed on 2026-11-07.
- Living plan WP18 section body still says partial, and the v3.0 README still says WP18 is not started. The ledger summary row and the WP18 report say code proof is complete.
- WP16 report “Next package: WP17 is not started” is historical. WP17 and the column guard are closed.

Correct those sentences on the living ledger only when the owner asks for a documentation pass. Until then, this file is the reading rule so the stale lines do not start a second implementation.
