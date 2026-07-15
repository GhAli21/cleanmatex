# Order Fin Remediation Work Packages — Master Index

**Created:** 2026-07-15 · **Documentation only — no code, migrations, tests, config, or schema changes.**
**Source of truth:** [Authoritative Current-State Report (2026-07-15)](../../../Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md) — frozen; work packages must **not** redefine or silently contradict its confirmed findings (C1–C3, H1–H8, M1–M9, B1–B33).

## Governance rules

1. The authoritative report is the sole source of truth for **current-state** findings. Packages link to its sections; they do not restate or reinterpret them.
2. A newly discovered issue requires code verification and an **explicit addendum** to the report before any package may rely on it.
3. Only **one implementation package** should normally be active (IN_PROGRESS) at a time.
4. **Decision files (D001–D012)** contain policy and invariants only. **Backlog files (B01–B33)** contain implementation and verification work. Never merge the two.
5. An item cannot be marked `VERIFIED` until its required **financial, reconciliation, idempotency, and regression tests pass** and the completion evidence block in its file is filled.
6. Approved decisions are immutable: material policy changes require a new version or an explicit superseding decision (see [Phase 0 index](00_Phase_0_Financial_Semantics/README.md)).

## Work-package status vocabulary

```text
NOT_STARTED · DECISION_REQUIRED · READY_FOR_DESIGN · READY_FOR_IMPLEMENTATION
IN_PROGRESS · IMPLEMENTED · VERIFIED · BLOCKED · DEFERRED
```

## Dependency types used in this index

`hard` = cannot start before predecessor is VERIFIED · `policy` = requires APPROVED decision(s) · `impl` = shares code surface, sequence to avoid conflict · `test` = verification needs predecessor's facts · `opt` = optional enhancement.

## Master index (B1–B33)

Severity/classification/evidence per report §50. Status is documentation-state only — no implementation status is claimed.

| ID | Title | Sev | Class | Status | Required decisions | Dependencies | Blocks | Seq | Work package | Commit | Reviewer | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | Refund lineage + reopen-due | CRITICAL | BLOCKS_PRODUCTION | DECISION_REQUIRED | D002 D003 D004 D005 D010 | — | B2 B9 B28 (test) | 1 | [B01](B01_Refund_Lineage_And_Reopen_Due.md) | — | — | — |
| B2 | Shared financial aggregation | CRITICAL | BLOCKS_PRODUCTION | NOT_STARTED | D005 | B1 (hard) | B20 B33 (impl) | 2 | [B02](B02_Shared_Financial_Aggregation.md) | — | — | — |
| B3 | Stored-value funding capture | CRITICAL | BLOCKS_PRODUCTION | NOT_STARTED | D007 D008 D010 | — | B6 (GC/wallet events, impl) | 6 | [B03](B03_Stored_Value_Funding_Capture.md) | — | — | — |
| B4 | Later collection BVM parity | HIGH | BLOCKS_PRODUCTION | NOT_STARTED | D001 D007 | — | B5 B31 (hard); B6 (impl) | 4 | [B04](B04_Later_Collection_BVM_Parity.md) | — | — | — |
| B5 | Later collection idempotency | HIGH | BLOCKS_PRODUCTION | NOT_STARTED | D010 | B4 (hard) | — | 4 | [B05](B05_Later_Collection_Idempotency.md) | — | — | — |
| B6 | ERP order-to-cash event wiring | HIGH | CONTROL_GAP | NOT_STARTED | D007 D008 D012 (partial) | B4 (impl); B3 (impl, funding events) | B24 B25 (hard) | 8 | [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) | — | — | — |
| B7 | Financial outbox processor | HIGH | CONTROL_GAP | NOT_STARTED | D010 | — | B19 (hard); B30 (history only, opt) | 5 | [B07](B07_Financial_Outbox_Processor.md) | — | — | — |
| B8 | Gateway lifecycle integration | HIGH | BLOCKS_FEATURE | NOT_STARTED | D001 D009 D010 | B30 (impl, shares transitions) | — | 9 | [B08](B08_Gateway_Lifecycle_Integration.md) | — | — | — |
| B9 | Refund execution parity | HIGH | CONTROL_GAP | NOT_STARTED | D004 D007 | B1 (hard, classification) | — | 7 | [B09](B09_Refund_Execution_Parity.md) | — | — | — |
| B10 | Payment reversal + void | HIGH | BLOCKS_FEATURE | NOT_STARTED | D001 D004 | — | B13 (hard) | 7 | [B10](B10_Payment_Reversal_And_Void.md) | — | — | — |
| B11 | Tax-inclusive calculation | HIGH | BLOCKS_FEATURE | NOT_STARTED | — | B12 (impl, item-edit overlap) | — | 10 | [B11](B11_Tax_Inclusive_Calculation.md) | — | — | — |
| B12 | Order amendment + financial delta | HIGH | BLOCKS_FEATURE / MAINTENANCE_RISK | NOT_STARTED | D011 D003 D010 | — | B14 (impl, tax-doc adjust) | 11 | [B12](B12_Order_Amendment_And_Financial_Delta.md) | — | — | — |
| B13 | Voucher reversal operational unwind | HIGH | CONTROL_GAP | NOT_STARTED | D004 D006 D007 | B10 (hard) | — | 8 | [B13](B13_Voucher_Reversal_Operational_Unwind.md) | — | — | — |
| B14 | Tax document runtime integration | HIGH | BLOCKS_FEATURE | NOT_STARTED | D007 D011 | — | B12 (partial, credit notes) | 11 | [B14](B14_Tax_Document_Runtime_Integration.md) | — | — | — |
| B15 | Currency defaults + tolerances | MEDIUM | CONTROL_GAP | NOT_STARTED | — | — | — | 3 | [B15](B15_Currency_Defaults_And_Tolerances.md) | — | — | — |
| B16 | Drawer filtering + variance approval | MEDIUM | CONTROL_GAP | NOT_STARTED | D001 | — | — | 3 | [B16](B16_Cash_Drawer_Filtering_And_Variance_Approval.md) | — | — | — |
| B17 | Currency rounding runtime | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | — | B15 (impl) | — | 10 | [B17](B17_Currency_Rounding_Runtime.md) | — | — | — |
| B18 | Order charge write path | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | — | — | — | 10 | [B18](B18_Order_Charge_Write_Path.md) | — | — | — |
| B19 | Expiry + idempotency jobs | MEDIUM | CONTROL_GAP | NOT_STARTED | D008 D010 | B7 (hard) | — | 9 | [B19](B19_Expiry_And_Idempotency_Jobs.md) | — | — | — |
| B20 | Missing reconciliation checks | MEDIUM | CONTROL_GAP | NOT_STARTED | D005 | B2 (hard) | — | 3 | [B20](B20_Missing_Reconciliation_Checks.md) | — | — | — |
| B21 | Loyalty conversion rate | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | — | — | — | 9 | [B21](B21_Loyalty_Conversion_Rate.md) | — | — | — |
| B22 | Financial registry consolidation | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | D001 | — | — | 9 | [B22](B22_Financial_Registry_Consolidation.md) | — | — | — |
| B23 | Legacy financial path retirement | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | — | B12 (impl, item-edit path) | — | 12 | [B23](B23_Legacy_Financial_Path_Retirement.md) | — | — | — |
| B24 | AR allocation, write-off, period controls | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | D007 | B6 (hard, GL) | — | 12 | [B24](B24_AR_Allocation_Writeoff_And_Period_Controls.md) | — | — | — |
| B25 | Revenue recognition + contract liability | LOW→HIGH at GA | FUTURE_ENTERPRISE | NOT_STARTED | D012 D008 | B6 (hard) | — | 13 | [B25](B25_Revenue_Recognition_And_Contract_Liability.md) | — | — | — |
| B26 | Enterprise FX, bank, gateway, ECL | LOW | FUTURE_ENTERPRISE | NOT_STARTED | D001 D012 | B8 (impl) | — | 13 | [B26](B26_Enterprise_FX_Bank_Gateway_And_ECL.md) | — | — | — |
| B27 | Financial permissions + approvals | MEDIUM | CONTROL_GAP | NOT_STARTED | — | — | B30 (impl, action perms) | 5 | [B27](B27_Financial_Permissions_And_Approvals.md) | — | — | — |
| B28 | Financial regression test coverage | HIGH | CONTROL_GAP | NOT_STARTED | — | B1–B5 (test, grows per wave) | — | continuous | [B28](B28_Financial_Regression_Test_Coverage.md) | — | — | — |
| B29 | Stale documentation correction | LOW | MAINTENANCE_RISK | NOT_STARTED | — | — | — | 3 | [B29](B29_Stale_Documentation_Correction.md) | — | — | — |
| B30 | Pending-payment back-office lifecycle | HIGH | BLOCKS_FEATURE / CONTROL_GAP | NOT_STARTED | D001 D009 D010 | B7 (opt — outbox-based durable history only; worklist and transitions independent); B27 (impl, permissions) | B8 (impl) | 6 | [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) | — | — | — |
| B31 | Later collection default status | MEDIUM | CONTROL_GAP | NOT_STARTED | D001 | B4 (hard) | — | 4 | [B31](B31_Later_Collection_Default_Status.md) | — | — | — |
| B32 | Drawer status gating + status override | LOW | CONTROL_GAP | NOT_STARTED | D001 | — | — | 6 | [B32](B32_Drawer_Status_Gating_And_Status_Override.md) | — | — | — |
| B33 | Pending-payment warning semantics | MEDIUM | CONTROL_GAP | NOT_STARTED | D001 D005 (policy) | B2 (impl, formula alignment); independent of B30 worklist | — | 2 | [B33](B33_Pending_Payment_Warning_Semantics.md) | — | — | — |

## Recommended master implementation sequence

Backlog numeric order is **not** implementation order.

```text
Seq 1  Phase 0 core approvals: D002 D003 D004 D005 D010  →  B1
Seq 2  B2 (shared aggregation)  →  B33
Seq 3  Low-risk parallel wave: B15 B16 B20 B29
Seq 4  B4 → B5, B31
Seq 5  B7, B27
Seq 6  B3, B30, B32
Seq 7  B9, B10
Seq 8  B6 → B13
Seq 9  B8, B19, B21, B22
Seq 10 B11, B17, B18
Seq 11 B12, B14
Seq 12 B23, B24
Seq 13 B25, B26
Cont.  B28 grows with every wave; a wave is not VERIFIED until its B28 slice passes
```

## Phase 0 decisions

Policy decisions live in [00_Phase_0_Financial_Semantics/](00_Phase_0_Financial_Semantics/README.md) (D001–D012). **B1 blockers:** D002, D003, D004, D005, D010.
