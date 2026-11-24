# Before operators rely on Edit

**As of:** 2026-11-24
**Index:** [Remaining_Work_Index.md](Remaining_Work_Index.md)
**How to prove it:** [Remaining_Test_Guide.md](Remaining_Test_Guide.md)

WP01–WP18 are in the product and `order_edit_v2` defaults to on. Cashiers can already open Edit. These three items are what still stops that from being a reliable counter tool. None of them is new engine code.

## 1. Set the five cells on a Pilot policy

**Owner decision 2026-11-24:** do not publish. Leave the Edit Policy at **Pilot**. A Pilot policy is enforced when it is the organization’s override. A version default or a profile default accepts only a Published policy, so this pilot does not use those.

Line speed, line discount, and line price are built. Without a rule on the Pilot policy that the organization uses, those controls stay disabled and the side panel shows the reason. Header edits (notes, ready-by, add and remove item, order speed) still follow the cells that policy already has.

| Operation | Target | What the cashier does |
|---|---|---|
| `CHANGE_SERVICE_SPEED` | `ITEM` | Change one line’s speed |
| `CHANGE_SERVICE_SPEED` | `PIECE` | Change one piece’s speed |
| `CHANGE_DISCOUNT` | `ITEM` | Line discount |
| `CHANGE_DISCOUNT` | `PIECE` | Piece discount |
| `CHANGE_ITEM_PRICE` | `ITEM` | Line price override |

**Where:** HQ (the SaaS Backoffice) → Order Change → Edit Policies.

**Why the cells are hidden:** a policy cloned before these pairs existed lists only the cells it already has. All seven catalog pairs for these operations are active. The draft must be filled, not hand-typed from memory.

**Steps for each workflow profile the pilot will use:**

1. Open the policy the pilot organization already uses. If it is Published, clone it first. A Published policy cannot be edited. Stay on **Pilot**. Do not choose Publish.
2. Check coverage against the workflow version → Check → **Smart fill (missing)** (or Fill missing as deny).
3. Set the five cells to the decision you want (`ALLOW`, `ALLOW_WITH_WARNING`, `REQUIRE_OVERRIDE`, or `DENY`). Smart fill proposes deny for operations it does not already know.
4. Save. Lifecycle stays Pilot.
5. Organization Assignments → that organization → assign this Pilot policy as the organization-wide override. Do not set a version default or a profile default.
6. Reload tenant Edit on an order of that organization and confirm the five controls match the cells. The panel should say organization override, lifecycle Pilot.

Record the policy code, revision, organization, and the five decisions in the test guide result log.

## 2. Confirm who can edit

Migration `0566_order_change_v2_permissions.sql` seeded `orders:edit` and `orders:edit_override` and granted them to no default role on purpose.

| Permission | Who should hold it |
|---|---|
| `orders:edit` | Every role that opens Edit and applies a reviewed change |
| `orders:edit_override` | A small set of supervisors. A `REQUIRE_OVERRIDE` cell is closed without it |

Check the live role assignments in HQ before the first operator session. A flag that is on and a policy that allows the cell still return permission denied when the role has neither code.

`orders:discount` stays the extra gate for line discounts, the same as New Order. `orders:collect_payment` and `orders:overpayment_allocate` stay on Collect and on the overpayment follow-up. Edit does not collect or refund by itself.

## 3. Walk the open human tests

Automated proof already covers locks, tenant isolation, Preview = Apply, and the committed-column guard. It does not cover the screen.

Run [Remaining_Test_Guide.md](Remaining_Test_Guide.md) and record each row. The operator gate is closed only when:

- MAN-UI-001 to MAN-UI-014 are passed or an owner has accepted a written exception.
- The line-control checks pass on an organization whose Pilot override has the five cells.
- The 13 November retests pass, especially a preference on a new item or piece, and cash change rounding.

Layout and policy-note wording can ship with a written note. A dropped preference or a change amount that does not match what is saved cannot.

## Done when

| Check | Done |
|---|---|
| The pilot organization uses a Pilot override, and the five cells are saved on it | |
| Pilot roles have `orders:edit`; override roles are listed | |
| Test guide result log is filled and the two money rows passed | |

---

## Financial_Expert_Tester status — run oe1 2026-11-24 (observe only)

Full evidence, screenshots and findings are in [Remaining_Test_Guide.md](Remaining_Test_Guide.md) under "Financial_Expert_Tester Results — run oe1".

| Check | oe1 state |
|---|---|
| Pilot profiles have the five cells | **Not done.** Demo Laundry override `ORDER_CHANGE_STANDARD_V1` (Pilot r3) has no CHANGE_SERVICE_SPEED ITEM/PIECE, CHANGE_DISCOUNT ITEM/PIECE or CHANGE_ITEM_PRICE ITEM cell (FET-OE2-Nov24-LineCellsMissing). Note: §3 and the Done-when row still say "published"; the 2026-11-24 owner decision says Pilot. |
| Pilot roles have `orders:edit`; override roles listed | **Not done.** HQ shows `orders:edit` and `orders:edit_override` on 0 roles; only admin-wildcard roles hold them (FET-OE2-Nov24-OrdersEditZeroRoles, P1). |
| Test guide result log filled; two money rows passed | **Not yet.** oe1: 6 PASS, 1 FAIL, 7 PARTIAL; line controls BLOCKED; preference and cash-rounding rows NOT RUN pending write approval. |

---

## Financial_Expert_Tester status — oe2 approved-writes run (2026-11-24)

Full evidence, screenshots and findings are in [Remaining_Test_Guide.md](Remaining_Test_Guide.md) under "Financial_Expert_Tester — oe2 approved-writes run (2026-11-24)". The oe1 status above is unchanged.

| Check | oe2 state |
|---|---|
| Pilot profiles have the five cells | **Done for the pilot (07:32–07:37 Asia/Muscat).** `ORDER_CHANGE_STANDARD_V1` was cloned to `QA_OE2_PILOT_V1` "QA OE2 Pilot line controls". Fill missing only added 508 rules, giving 738 of 738. CHANGE_SERVICE_SPEED ITEM/PIECE, CHANGE_DISCOUNT ITEM/PIECE and CHANGE_ITEM_PRICE ITEM are **Allow** at Preparing, Processing, Packing and Ready. Lifecycle **Pilot**, revision 5, not published. It is assigned as the Demo Laundry LLC organization override, replacing `ORDER_CHANGE_STANDARD_V1`, with toast "Override replaced.". Effective Preview shows Allow · Organization override · CAPABILITY_POLICY_ALLOWED (`oe2-Gate1-Cells-2.png`, `oe2-Gate1-OrgAssign-1.png`, `oe2-Gate1-EffectivePreview-1.png`). Leftover: the owner should decide whether to restore `ORDER_CHANGE_STANDARD_V1` as the override. |
| Pilot roles have `orders:edit`; override roles listed | **Not done.** Not retested in oe2. FET-OE2-Nov24-OrdersEditZeroRoles (P1) is still open. The operator sign-in still needs the owner to update CREDENTIALS_AND_ENVIRONMENTS.md. |
| Test guide result log filled; two money rows passed | **Not passed.** The combined oe1 + oe2 result is PASS 12, FAIL 8, PARTIAL 7, BLOCKED 5, NOT RUN 1. **Both blocking rows fail:** <br>1. A preference on a new item or piece gives "Review result: OPERATION_NOT_AVAILABLE" (FET-OE2-Nov24-PrefNewItemNotAvailable, P1). <br>2. The change and saved amounts do not match. Collect fails with a Prisma 5000 ms transaction timeout (FET-OE2-Nov24-CollectTxnTimeout, **P0**). The split payment confirm said Remaining 0.000 but saved Paid 1.424 / Balance 2.000 (FET-OE2-Nov24-SplitPaymentRemainingMismatch, P1). The Collect cash step rounds 0.003 to 0.010 (FET-OE2-Nov24-CashRoundingStep, P1). <br>New Order cash change passed (0.646 → 0.650, saved 0.650). **Operator gate: not passed.** |
