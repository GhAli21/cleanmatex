# Before Edit is the production path

**As of:** 2026-11-24
**Index:** [Remaining_Work_Index.md](Remaining_Work_Index.md)
**Comes after:** [Remaining_Before_Operators_Rely_on_Edit.md](Remaining_Before_Operators_Rely_on_Edit.md)

**Owner decision 2026-11-24:** this pilot stays on a **Pilot** Edit Policy, assigned as an organization override. Do not publish. A version default and a profile default accept only a Published policy, so steps 2 and 6 below are not part of this pilot.

Operators can use Edit on that Pilot override once the operator gate passes. The rest of this file is what would make Edit the path for organizations that have no override, and what retires the old editor afterwards. That wider path needs a Published policy. It waits until you ask to publish.

## Edit Policy parity

**Source:** [Extend_Order_Edit_policy_Plan.md](Extend_Order_Edit_policy_Plan.md) §11.4 and the runbook in [Extend_Order_Edit_policy_STATUS.md](Extend_Order_Edit_policy_STATUS.md) (“Phase 5 manual check”).

Tenant Edit and HQ Effective Preview both call `sys_oc_resolve_edit_policy`. This check proves a live order and the HQ preview still agree after clone, publish, override, and deactivate.

| Step | Do in HQ | Expect on tenant Edit after reload |
|---|---|---|
| 0 | Clone a starter policy. Leave the starter untouched. | — |
| 1 | Nothing else | Panel: no Edit Policy in force. Catalog actions closed. |
| 2 | Smart fill the clone against the pilot workflow version. Allow `ADD_ITEM` / Order at the order’s status. Publish. Set it as the version default. | Panel: profile version default. Add item open at that status. |
| 3 | Second clone denies `ADD_ITEM` at that status. Assign it as an organization-wide override. | Panel: organization override. Add item closed. |
| 4 | Change nothing | Organization override still wins. |
| 5 | Deactivate the organization override. | Version default wins. Add item open. |
| 6 | Set a platform profile default that denies Add item, on a version that has no version default of its own. | Panel: platform profile default. Add item closed for those versions. |
| 7 | Effective Preview for the same organization, profile, version, status, `ADD_ITEM`, `ORDER`, after steps 2, 3, 5, and 6. | Same level and same decision as the tenant panel each time. |

Clean up afterwards: deactivate the profile default and the version default. History rows stay.

**Result log**

| Step | Date | HQ level / decision | Tenant level / decision | Match |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |

The 2026-10-24 runbook named Demo Laundry LLC and order ORD-20261023-0003. Re-read the live order before using those ids. If that order is gone, pick any committed order on the pilot profile and write its number here.

## WP19 — pilot, then cutover

**Status:** not started.
**Depends on:** operator gate passed, and this parity check passed for the pilot profile.

| Rule | Detail |
|---|---|
| Cohort | One branch, one operator group, one workflow profile. |
| Length | One to two weeks of real orders. |
| Flag | `order_edit_v2` already defaults to on. Do not treat the pilot as the moment the flag is invented. |
| Watch | Denies, `REVIEW_CHANGED`, `VERSION_CONFLICT`, follow-up balances left uncollected, and lock errors (`55P03` or a deadlock) between Apply and a payment or credit. |
| Data rule | A cancelled deadlock leaves both sides unchanged or one side committed. It must not leave a half-written change. |
| Rollback | Turn the flag off for the cohort if the owner stops the pilot. Committed Changes stay. Do not delete history, do not run the legacy full replacement on those orders, and do not auto-refund. |

**Pilot log**

| Day | Orders edited | Defects | Deadlocks | Follow-ups left open | Decision |
|---|---|---|---|---|---|
| | | | | | |

**Exit:** the owner writes the rollback-window end date and accepts the flag for that profile.

## WP20 — cleanup after the rollback window

**Status:** not started.
**Depends on:** the date in the pilot log has passed with no open money defect.

| Do | Leave |
|---|---|
| Remove unreachable full-replacement edit paths and synthetic id updates | Applied migrations |
| Keep history readers | Stored Change rows |
| Document closed operations, permissions, the flag, and follow-up | A physical rename of workflow tables |
| Refresh support notes in the feature pack through the documentation skill | Unrelated module cleanup |

Calculator orders already refuse legacy money updates. WP20 removes the leftover path so a later change cannot reopen it. Doing it during the pilot removes the rollback you still need.

## Importance

| Item | When it matters |
|---|---|
| Parity check | Before a second organization uses a different override or default |
| WP19 | Before you tell every branch that Edit is the only way to change a committed order |
| WP20 | After you no longer need to turn the flag off |

---

## Financial_Expert_Tester status — run oe1 2026-11-24 (observe only)

Full evidence is in [Remaining_Test_Guide.md](Remaining_Test_Guide.md) under "Financial_Expert_Tester Results — run oe1".

- **Parity check: BLOCKED (not started).** Steps 2 and 6 need Publish plus a version default and a profile default. The 2026-11-24 owner decision in Remaining_Before_Operators_Rely_on_Edit.md says do not publish, so this needs an explicit owner go-ahead. Current state for reference: Demo Laundry has organization override `ORDER_CHANGE_STANDARD_V1` (Pilot r3, In effect). HQ Effective Preview for Processing / ADD_ITEM / ORDER returns "Require override · Organization override · CAPABILITY_POLICY_OVERRIDE_REQUIRED", which matches the tenant Edit panel on ORD-20261123-00002 (`oe1-HQ-EffectivePreview-1.png`). Step 1 ("no Edit Policy in force") can't be shown without removing that override. ORD-20261023-0003 was not used; the live order used was ORD-20261123-00002.
- **WP19: NOT RUNNABLE.** It needs the operator gate passed and a 1–2 week live pilot.
- **WP20: NOT RUNNABLE.** It needs the WP19 rollback-window date.
- **FET-OE2-Nov24-EffectivePreviewUncoveredStatuses (P2):** see the test guide.

---

## Financial_Expert_Tester status — oe2 approved-writes run (2026-11-24)

Full evidence is in [Remaining_Test_Guide.md](Remaining_Test_Guide.md) under "Financial_Expert_Tester — oe2 approved-writes run (2026-11-24)". The oe1 status above is unchanged.

- **Parity check: BLOCKED (not started).** The owner approved writes 1–3 on 2026-11-24 but **did not approve write 4** (parity check with Publish). Nothing was published, and no version default or profile default was set. Current state for reference:
  - Demo Laundry LLC's organization override is now `QA_OE2_PILOT_V1` (Pilot, revision 5, In effect). It replaced `ORDER_CHANGE_STANDARD_V1`.
  - HQ Effective Preview (Processing, Change Discount / Item and Change Item Price / Item) returns "Decision: Allow · Organization override · QA_OE2_PILOT_V1 · CAPABILITY_POLICY_ALLOWED · Uncovered statuses: —" (`oe2-Gate1-EffectivePreview-1.png`, `oe2-Gate1-EffectivePreview-2.png`).
  - Tenant Edit on ORD-20261124-00001 agreed: line speed and line discount were open and applied.
  - This is a single-level (organization override) agreement only, not steps 1–7.
- **WP19: NOT RUNNABLE.** The operator gate has not passed. Open items: P0 FET-OE2-Nov24-CollectTxnTimeout, P1 preference on a new item or piece, P1 split payment remaining mismatch, and P1 add item INTERNAL_ERROR. Gate item 2 (roles) is also not done.
- **WP20: NOT RUNNABLE.** It needs the WP19 rollback-window date.
- **Watch item for WP19:** the oe2 Collect failure is an interactive-transaction timeout ("Transaction already closed … timeout 5000 ms, however 5025 ms passed", then "Transaction not found"). That is the same lock-and-payment path the pilot log watches ("lock errors between Apply and a payment or credit"). Recheck it under the pilot load once it is fixed.
