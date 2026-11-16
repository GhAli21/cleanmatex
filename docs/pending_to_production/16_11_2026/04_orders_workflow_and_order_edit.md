# 04 — Orders, Workflow and Order Edit

## Workflow Order Advance (engine, floor screens, delivery)

Engineering V1.0 is closed. ADR accepted 2026-09-11, canary and rollback rehearsed, S10 delivery canary signed. Source: `docs/features/Workflow_Order_Advance/current_status.md`.

| # | Item | Priority | What to do |
|---|---|---|---|
| W1 | **HQ soak**: the only remaining operator item. | Before public launch | Run the pilot laundries on `WF_V2_SIMPLE` v4 (or FULL_PATH) for 1–2 weeks and watch Workboard and order history. |
| W2 | Readiness checklist items still unchecked (`13_Production_Readiness_Checklist.md`): profile capability flags as server-side gates; tenant navigation from server workflow context with EN/AR unavailable states; legacy `preparation` status rows normalized; the profile runtime acceptance suite. | Before public launch | Re-verify each against the code, then tick it or turn it into a task. |
| W3 | OTP retry and expiry controls for delivery are deferred to VNext. | After launch | — |
| W4 | 46 planned Check-policy codes are parked (HQ). | Later | `future_work_in_wf/05_PLANNED_CHECK_POLICY_CODES_ROLLOUT_PLAN.md` |
| W5 | V10x-M3: migrating an open order to a newer profile version. | Later | Open orders stay on their pinned version (safe). |
| W6 | Every workflow profile needs the catalog rule `INIT_MOBILE_RETAIL` (create preset `RETAIL_SOLD`). Until then online retail orders start at `intake`. | Blocker if you sell retail online | HQ › workflow profile › new draft → publish. |

## Order Edit V2

WP01–WP18 code proof is complete. Flag `order_edit_v2` defaults to **on** (`lib/constants/feature-flags.ts`). Source: `docs/features/Order_Edit_V2/.../followups_by_user.md`.

| # | Item | Priority | What to do |
|---|---|---|---|
| E1 | Manual UI test MAN-UI-001 to 014, plus the line controls (speed, price, discount, custom line, `LINE_SPEED_LOCKED`). No Playwright spec exists. | Blocker | See file 12. |
| E2 | Retest the 2026-11-13 fixes: a preference on a new item or piece, the edit header, the policy notes, rounded change, cash prefill only when coins can pay it, and the HQ permission pages. | Blocker | Same follow-ups file, "Fixed 2026-11-13". |
| E3 | **HQ Edit Policy rules** are missing for `CHANGE_SERVICE_SPEED` (item and piece), `CHANGE_DISCOUNT` (item and piece) and `CHANGE_ITEM_PRICE` (item). Until they exist those Edit controls stay disabled. | Blocker | For each profile: Check coverage → Smart fill → set the five cells → publish. |
| E4 | The Edit Policy manual check (§11.4, 7 steps, tenant and HQ side by side). | Before public launch | — |
| E5 | WP19 pilot with an operator group, then cutover; WP20 cleanup after the rollback window. | WP19 = the pilot; WP20 After launch | — |
| E6 | Deadlock watch: payments and credits lock the order while recalculating. A writer that locks a wallet first could deadlock with an Apply. PostgreSQL cancels one side with an error, so data stays correct. | After launch (monitor) | Watch logs during the pilot. |

## Other order surfaces

| # | Item | Priority | Source |
|---|---|---|---|
| O1 | Rack & Bags: code complete; manual QA pending. | Before public launch | `Rack_And_Bags/STATUS.md` |
| O2 | Human-Friendly Codes P12: deploy, the stock-engine safety test report, QA S1/S4/S13–S17, hardware QA S7/S8 (printers, scanners), flag-off S19, performance S20. P10 supplier backfill waits on live samples. | Blocker (deploy + S1–S17); hardware QA before the first pilot store | `Human_Friendly_Codes/current_status.md` |
| O3 | Receipt and label printing on the pilot's real thermal printer and label printer, including the Arabic layout and QR or barcode. | Blocker | HFC S7/S8; red receipt and label tests (file 03, I10) |
| O4 | Customer app retail and booking changes were uncommitted on 13 Nov (they are now committed). Check the booking → order path once on a device. | Before public launch | file 11 |
