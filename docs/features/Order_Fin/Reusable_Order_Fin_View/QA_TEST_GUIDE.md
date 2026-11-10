# Reusable Order Financial View — QA test guide

Owner-runnable scenarios for every screen that shows the Order Financial View.
Run each in **English and Arabic** (language switch in the top bar), and at
**phone width (360 px), tablet and desktop**. Figures must never be computed in
the browser: every amount is the server's.

Sample order for most scenarios: create a New Order with two items, one paid
extra (for example starch), a delivery charge and a manual discount; pay part in
cash and part with the customer's wallet; leave the rest **pay on collection**.

---

## 1. Order detail → header strip and Financial summary (P6-01)

**Path:** Sidebar → Orders → open the sample order → `/dashboard/orders/{id}`.

1. The strip above the tabs shows **Balance** with a word ("Due at collection"), plus Total, Paid, Credits. No more than three figures beside the balance.
2. Tab **Financial summary**: the statement reads top-down — *Order value* (Items & extras, Charges, Discounts, Tax, then **Total**) and *Settlement* (Payments, Credits, then the balance word and amount).
3. Badges at the top: payment status ("Partially paid"), settlement type ("Pay on collection"), **Reconciled**.
4. **Detailed / Full** switch (top-end): choose Full, reload the page → Full is remembered. Open `…?fin=detailed` → the URL wins.
5. Click a row (for example Discounts) → it expands; **Expand all / Collapse all** work. Keyboard: Tab to a row, Enter/Space toggles it.
6. An extra inside the item price shows as **"Extras (included)"** under Items, in the text, not in the amount column.
7. Right column still offers **AR collection** and **Issue tax document** (unchanged actions).

## 2. Order detail → Financial details tab and the full page (P6-02)

**Paths:** the order's **Financial details** tab; and **Full view** (`/dashboard/orders/{id}/full`, tab Financial).

1. Shows the **Full** statement (records too: tax documents, vouchers, order changes, timeline). The full page also offers **Full / Audit**.
2. **Void a charge** (user with `orders:manual_charge`): the "Charges" panel under the statement lists active charges with **Void charge**. Void one → the dialog asks for a reason → after saving, the statement refreshes on its own: the charge shows struck with "Voided · not counted", the total and balance drop.

## 3. Money writes refresh the view (P6-08)

On the order detail, do each and check the statement updates **without reloading the page**:
- record a payment (Order actions → Collect payment), verify a pending payment, refund a payment, void a charge, issue a tax document, collect on the AR invoice.

## 4. Collect-payment modal (P6-05)

**Path:** order → **Collect payment**. Under the title a small pill shows **Balance 2.475 · Due at collection**. Pay it fully → after saving, the order's statement shows **Settled**.

## 5. Order workspace, ready detail, delivery detail (P6-04, P6-06)

- **Workspace** (`/dashboard/orders/{id}/workspace`): the *Financial snapshot* card shows the statement totals (no hand-added figures).
- **Ready** (`/dashboard/ready/{id}`): the *Payment* box shows the totals view; **Collect payment** still appears when money is due.
- **Delivery order detail**: a totals card above the handover card.

## 6. AR invoice detail (P6-07)

**Path:** Finance → AR invoices → open an invoice → tab **Orders**. Column **Order balance** shows each linked order's balance and word, loaded in **one** request for the whole list (browser network tab: one `financial-headers` call).

## 7. Prints (P6-03)

**Path:** Ready → order → print **Payments report** or **Invoices & payments report**. Under the report, the **Financial summary** prints with every row open, all lines, black on white, one column (A4 preview).

## 8. New Order → payment modal summary (P6-09)

**Path:** New Order → add items → **Submit** → payment modal. Button **Financial summary** (header). It opens a read-only statement marked **"Preview — not yet saved"** (dashed outline) with the quote's figures and the legs you entered. Close it → every amount you typed in the modal is unchanged.

## 9. Order Edit live card (P6-13, owner request D20)

**Path:** order → **Edit**.

1. Change only the **notes** → the card says **"No money change"** and shows the saved total; no request is sent (network tab: no `changes/quote`).
2. Change a **quantity** → after half a second the card shows **New total**, **Was** + difference, **Balance after change** and a chip ("To collect"). While it updates, the old figures stay dimmed with **"Updating…"**; typing is never blocked.
3. Remove a line so a recorded **promo** no longer applies → **Details** shows the promo struck at zero (was → now).
4. Click **Review** → the Review dialog's totals are the card's totals. The review-status message no longer repeats totals as plain text.
5. Apply → back on the order, the statement shows the new figures at once.

## 10. Public tracking link (P6-11)

**Path:** order → copy the public tracking link → open it in a private window. Below the status, the customer statement shows Items, Charges, Discounts, Tax, Total, Payments (**per method only**, no card numbers or references), Credits and the balance. Nothing else (no warnings, no staff or IDs). The pay-on-collection notice uses the same balance. A revoked or expired link shows "not found" with no statement.

## 11. Customer app (P6-12)

**Path:** customer app → sign in → Orders → open an order. Card **Payment summary**: lines to the total, paid by method, credits, and the balance with its word. With a wallet credit, the balance is total − paid − credits as the **server** states it (the old screen showed total − paid).

## 12. Edge states

- An order whose snapshot is being recalculated: yellow bar **"Figures are being recalculated."** and badge **Recalculating**.
- A cancelled order: info bar **"This order is cancelled…"**, no live balance prompt.
- An order with no snapshot: **"Financial data unavailable"**, never zeros.
- Tax-inclusive order: tax row reads **"Tax (included in prices)"** and is not added to the total.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch 2)

**Run:** 2026-11-07 14:34 Asia/Muscat (UTC+4), Preview, Demo Laundry LLC (`11111111-1111-1111-1111-111111111111`), admin, EN/AR, 1920×1072. Returned UI evidence; no order/payment/workflow writes, no printing sent. English restored; no dirty draft.

| # | Result | Evidence |
|---|---|---|
| P6-01 / guide1 | PARTIAL | Saved figures agree on 00008 and 0003; Detailed/Full labels visible. Full remembered after reload PASS; `?fin=detailed` overrides saved Full PASS; Payments Enter collapses and re-expands PASS. Remaining strip/expand-all/Space/included-extra/actions/mixed-wallet/credit checks and full locale/device matrix not proven. |
| P6-04 / P6-06 / guide5 | PARTIAL | Ready saved line/header amounts correct on 00008, but customer identity differs on Ready/receipt versus list/detail (reference FET-LLMS-Nov07-S8-Identity in Line-Level guide). Workspace/delivery/collect action coverage pending. |
| P6-13 / guide9 | PARTIAL | Clean Edit 0003 shows No money change / saved total1.926 at rev2. No notes/quantity change, network no-quote assertion, Review equality or Apply refresh tested. |

00008 UUID `0a27746d-5667-4342-999a-055d8ced7d4d`: line0.800 tax0.056 total/paid0.856 due0, Paid/Pay in advance/Reconciled; 0003 UUID `cd4ac165-9a37-4b5e-9300-59152ca8e236`: lines0.800+1.000 tax0.126 total1.926 paid0.856 due1.070, Partially paid/Pay in advance/Reconciled, no mismatch. A4 receipt preview was closed unsent: this is NOT P6-03 Payments report or Invoices & payments report coverage.

**Evidence:** `/workspace/qa-20261107/shots/ll-s8-03-order00008-fin-detailed-query.png`, `ll-s8-04-order00008-payments-keyboard-enter.png`, `ll-s8-08-full-persisted-after-reload.png`, `reuse-01-order0003-financial-summary.png`, `reuse-02-order0003-financial-details.png`, `ll-s8-06-ready-order00008.png`, `ll-s8-07-ready-order00008-a4-receipt-preview.png`, `man001-02-order0003-edit-items-controls.png`.

**Provisional parent counts:** PARTIAL3 (guide1,5,9); no full parent PASS/FAIL claimed; remaining guide sections NOT RUN. Observed subcheck passes must not replace complete P6 coverage.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch 2)
- **P1 candidate FET-RV-Nov07-Identity:** Reference FET-LLMS-Nov07-S8-Identity: list/detail Jh Test dev21 versus Ready/receipt Test Customer2 Mohammed Ahmed on same order. Saved financial figures match, but customer identity is inconsistent; cause pending. Confirm intended display identity across financial-bearing surfaces before rollout.
- **Localization observation:** Arabic RTL and amounts observed; some headings remained English. Exact strings were not returned, so no invented translation-key diagnosis or definitive localization FAIL. Capture exact labels next pass.
- **Ancillary navigation observation:** Background `/api/navigation` HTTP504 while screens rendered; no root-cause claim.

### Test data left behind
None; no commercial/workflow/printing writes. English restored, no dirty draft.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch4: responsive financial retest)

**Retest:** 2026-11-07 15:12:44 Asia/Muscat (UTC+4), Demo Laundry/admin, Chrome actual device mode configured360/1024/1440, EN/AR; EN restored at configured1440. Configuration labels are not independently exact viewport measurements: tool1081×1040 versus screenshot1041×1002 makes the1024 evidence measurement PARTIAL. No commercial/workflow/printing writes; only preferences/locale. Prior rounds/observations preserved.

Order0003 UUID `cd4ac165-9a37-4b5e-9300-59152ca8e236`: saved/reference figures total1.926,paid0.856,due1.070 OMR; lines0.800+1.000,tax0.126,Reconciled. Correct statement shows balance-first with at most3 other figures. No POC,paidextra,delivery,discount fixture coverage claimed.

| # | Result | Evidence |
|---|---|---|
| Guide1 / P6-01 | PARTIAL | Balance-first/max3 other figures PASS; Detailed/Full, Expand all/Collapse all and Space operation PASS. Existing persistence/URL/Enter passes retained. AR collection and Issue tax document visible PASS visibility only, not executed. Same correct figures observed at configured EN/AR device modes. Included-extra/mixed-tender/credit and full scenario fixtures still pending. |
| Guide2 / P6-02 | PARTIAL | Financial Details and `/full?tab=financial` show Full/Audit/Records PASS visibility subchecks; charge-void flow not tested. |
| Guide5 / P6-04 workspace | FAIL | `/dashboard/orders/cd4ac165-9a37-4b5e-9300-59152ca8e236/workspace?returnUrl=%2Fdashboard%2Forders` header Order total0.000 vs correct saved1.926 (paid0.856,due1.070). Financial display inconsistency; raw `orders.detail.workspace.paymentPlans.pay_in_advance` shown. Other workspace/Ready/delivery coverage remains partial. |
| EN/AR responsive / shared instructions | FAIL (localization); PARTIAL (measurement) | Arabic headings `Full Order Details`, `ORDER VALUE`, `SETTLEMENT`, `RECORDS` remain English. Narrow mode horizontal scroll/clipped tab content observed; do not assign exact1024 breakpoint or universal viewport-metric claim. |

Independent reload00008 confirms customer identity mismatch: detail Jh Test dev21; Ready Test Customer2 Mohammed Ahmed. Ready amounts correct. Reference FET-LLMS-Nov07-S8-Identity; no cause asserted.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch4)
- **P1 FET-RV-Nov07-WorkspaceTotal:** Header0.000 conflicts with same order's saved/reference total1.926; ensure workspace consumes authoritative snapshot consistently and add regression coverage after diagnosis. Raw payment-plan key also needs localization mapping. No current source root-cause claim.
- **P2 FET-RV-Nov07-ARHeadings:** Translate exact English headings above in Arabic financial/full routes; confirm correct catalogs after source diagnosis, not invented keys.
- **P2 candidate FET-RV-Nov07-Responsive:** Horizontal scroll/clipped tab content in narrow device mode. Re-measure actual CSS viewport and identify affected control/breakpoint before assigning precise responsive root cause.

**Evidence** under `/workspace/qa-20261107/shots/`: `reuse-device-en-1440-summary-detailed.png`, `reuse-device-en-1440-summary-full.png`, `reuse-device-en-1440-financial-details-tab.png`, `reuse-device-en-1440-fullroute-financial.png`, `reuse-device-en-1440-fullroute-audit.png`, `reuse-device-en-1440-workspace-mismatch.png`; device series `reuse-device-en-360-*`, `reuse-device-en-1024-*`, `reuse-device-ar-360-*`, `reuse-device-ar-1024-*`, `reuse-device-ar-1440-*`; independent reload `reuse-device-en-1440-00008-detail-reload-loaded.png` and `reuse-device-en-1440-00008-ready-recheck-loaded.png`.

**Provisional guide-parent counts:** FAIL1 (guide5,workspace discrepancy); PARTIAL3 (guide1,2,9); NOT RUN8; no full parent PASS. Shared localization FAIL and viewport-measurement PARTIAL tracked separately, not double-counted as guide parents.

### Test data left behind
No order/payment/workflow/printing changes; preferences/locale only; EN restored. No policy cloning/publication outcome recorded: still in progress outside this batch.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch6: Create preview)

**Run:** 2026-11-07 15:51 Asia/Muscat (UTC+4), Demo admin, Main Branch2, EN1440×985 CSS. Existing POS/drawer untouched. Existing customer Jh Test dev21, Counter/in-branch, one Bathrobe Standard1.800 +tax0.126 =total1.926 OMR.

**Observed prerequisite resolution:** Ready By absent kept Submit disabled in THIS flow; applying Nov8 16:00 Asia/Muscat enabled Ready to submit. No disabled-Submit bug claimed. This establishes the observed-flow explanation only, not a retrospective diagnosis of every earlier disabled state.

**Cart regression PASS:** override2.100 with reason `QA-20261107 override preview` preserved under Express; reset under Express2.250; restoring Standard1.800. Payment modal showed Pay later Applied / Pay on Collection available (as observed labels), not evidence of a saved settlement type. Cash0.500 typed: unsaved preview settled0.500, remaining1.426; Financial summary agrees, closing it preserves typed0.500. No payment/order submitted. Line-discount options inspected then canceled, no discount coverage claimed.

**Evidence** under `/workspace/qa-20261107/shots/`: `create-preview-baseline-cart.png`, `create-preview-readyby-picker.png`, `create-preview-readyby-enabled.png`, `create-preview-override-standard.png`, `create-preview-express-override.png`, `create-preview-express-reset.png`, `create-preview-standard-restored.png`, `create-preview-payment-poc.png`, `create-preview-cash-partial.png`, `create-preview-financial-summary.png`, `create-preview-discount-dialog.png`, `create-preview-final-empty.png`.

| # | Result | Evidence |
|---|---|---|
| Guide8 / P6-09 | PARTIAL parent; simple preview subchecks PASS | Unsaved simple-order quote and typed Cash0.500 legs agree: total1.926,settled0.500,remaining1.426. Closing Financial summary preserves0.500. No paidextra/delivery/manual-discount/mixed-wallet fixture or full locale/device coverage claimed. No saved-settlement assertion. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch6)
- **FET-RV-Nov07-P6-09:** Preserve simple unsaved-summary/tender retention regression evidence; complete richer sample fixture coverage before full P6-09 signoff. No new product defect established by this batch.

**Provisional guide-parent counts:** FAIL1 (guide5),PARTIAL4 (guide1,2,8,9),NOT RUN7; no full parent PASS. Earlier localization/measurement/identity results preserved separately.

### Test data left behind
No saved order/payment/customer/workflow changes. Modal canceled and cart discarded:0 items,customer cleared,Standard restored,notes cleared. Ready By remains displayed only as unsaved form state. POS/drawer unchanged. No policy change outcome recorded.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch7: dedicated POC fixture)

**Created:** 2026-11-07 16:02 Asia/Muscat (UTC+4); inspected16:17, Demo Laundry admin/Main Branch2, EN1440×985 CSS. Authoritative detailed fixture ledger: `/workspace/qa-20261107/create-poc-ledger.md` (note caveat below supersedes any unqualified lost-data interpretation).

**Saved dedicated order:** `ORD-20261107-00001`, UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9`, existing Jh Test dev21; Counter(in branch),Standard,Ready By Nov8 16:00 Asia/Muscat. Processing/preparation pending,revision1,Edit access OPEN; no workflow transition/Edit Apply performed.

**Correct persisted money:** Bathrobe override2.100 (baseline1.800), reason entered `QA-20261107 persisted override`; Shirt Ironing Only catalog0.300,10% discount **0.030**,net **0.270** (NOT a0.270 discount). Full Items &extras2.400 minus line discount0.030=subtotal2.370;VAT0.119+Municipal0.047=tax0.166;total2.536 OMR. No charges/delivery. Paid0,credits0,due at collection2.536; explicit Pay later applied/Pay on Collection confirmed,Reconciled/PENDING COLLECTION. Confirmation accepted once,success toast/cart reset; no real payment taken.

**Notes observation, provisional FAIL:** `QA-20261107-CREATE-POC-01` appeared in pre-submit Notes but was absent from saved Notes after reload. Notes Save had been enabled; whether required explicit Save/apply was omitted is NOT isolated. Missing explicit Save is a plausible alternative to a product persistence defect. Do not diagnose lost-data code defect until next controlled note-control check.

**Duplicate-selection boundary:** second identical Bathrobe merged into Create quantity2, then reduced to1 and distinct Shirt selected. Expected Create behavior, not evidence of an Edit duplicate-line targeting failure.

**Evidence** `/workspace/qa-20261107/shots/`: `create-poc-override-dialog.png`, `create-poc-shirt-catalog.png`, `create-poc-pre-submit-panel.png`, `create-poc-payment-poc-zero.png`, `create-poc-confirm-zero-poc.png`, `create-poc-order-created.png`, `create-poc-order-header.png`, `create-poc-items-after-reload.png`, `create-poc-reconciled-after-reload.png`, `create-poc-full-records.png`, `create-poc-edit-status.png`, `create-poc-duplicate-merge.png`.

| # | Result | Evidence |
|---|---|---|
| Guide1 / P6-01 fixture extension | PARTIAL parent | Reconciled saved POC total2.536 paid0/credits0/due2.536; tax and line-discount figures agree above. No paid-extra/delivery/wallet split fixture coverage. |
| Saved POC financial readers | PASS observed money subcheck | Reload/full records retain exact2.536 due with0 payments/credits/refunds/overpayment/receivable; tax documents/vouchers/loyalty/adjustments/order changes none. Not an executed money-write refresh, AR, refund or collection test. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch7)
- **FET-RV-Nov07-POCFixture:** Use dedicated saved POC UUID above for future balance/live-Edit tests; no fabricated paid-extra/delivery/discount-orderwide coverage.
- **FET-RV-Nov07-Notes-Provisional:** Pre-submit note absent saved; explicit Notes Save semantics not isolated. Keep provisional observation separate from financial snapshot correctness; no source root cause claimed.

**Guide-parent counts unchanged:** FAIL1(guide5),PARTIAL4(guide1,2,8,9),NOT RUN7. New money leaf PASS does not sign off richer sample or untouched AR/payment actions.

### Test data left behind
One dedicated saved order UUID/code above,2.536 OMR unpaid POC,initial processing/pending,revision1 OPEN. No payment/refund/collection/workflow/Edit Apply/print/message made. POS/drawer unchanged. Override reason entered and discount persisted; note absent with explicit-Save caveat. No other new order in this batch.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch8: controlled core Edit)

**Retest r5/core Edit:** 2026-11-07 16:37:44 Asia/Muscat (UTC+4), Demo Laundry/admin, EN1440×985 CSS; AR clean-context check then EN restored. Only dedicated `ORD-20261107-00001` UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9` changed. Detailed returned evidence `/workspace/qa-20261107/man-core-edit-ledger.md`.

| # | Result | Evidence |
|---|---|---|
| Guide9/P6-13 | FAIL live updating/refresh subchecks; other coverage PARTIAL | New/was/delta/balance correct and equal Review; Updating>25s, stale after successful Apply until independent reload. No notes-only no-quote network assertion or promo-removal check. |

Bathrobe quantity1→2 preserves override2.100/unit,line4.200; Shirt.300−discount.030=net.270 retained. Live card new4.783/was2.536/delta+2.247/balance4.783/To collect. Review matches numbers, but Updating persisted>25s and stale after Apply. Independent reload total4.783,tax.313,paid0,credits0,due4.783 POC/Reconciled; processing/preparation pending unchanged.

History exactly1Change#1,2ops,reason `QA-20261107 controlled quantity retest`,source order-edit,revision1→2,workflow version1; Applied by Unknown user. ItemUUID `2e052d4b-0c4e-4f20-a408-c29988ccbc80`; added pieceUUID `db4b929d-e1aa-4e96-8d2c-fd39428f7da6`,piece2/processing/expected. Single Apply click proves only observed single record, NOT lost-response retry or durable idempotency.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch8)
- **P1 FET-RV-Nov07-LiveCard:** Updating remains>25s despite totals; post-Apply editor remains prior revision/dirty/Updating while independent data correct. Reset loading/baseline from committed result after diagnosis; no current code cause claimed.
- **P1 candidate FET-RV-Nov07-AuditActor:** History Applied by Unknown user; reason present, DB actor absence not proven.

Provisional guide-parent totals: FAIL2(5,9),PARTIAL3(1,2,8),NOT RUN7; no full parent PASS. Live numbers/Review equality and independent saved figures pass, not immediate UI-refresh behavior.

**Evidence** `/workspace/qa-20261107/shots/`: `man-core-baseline.png`, `man-core-note-review.png`, `man-core-note-discarded.png`, `man-core-quantity-staged.png`, `man-core-quantity-review-required.png`, `man-core-review-reason-required.png`, `man-core-review-reason-entered.png`, `man-core-review-ready.png`, `man-core-post-apply-balance.png`, `man-core-change-history.png`, `man-core-final-items.png`, `man-core-ar-context.png`, `man-core-final-en.png`.

### Test data left behind / current fixture state
Dedicated order now revision2,total4.783/tax.313/paid0/due4.783 OMR,POC,processing/pending,OPEN; Bathrobeqty2 atoverride2.100 and Shirtqty1 net.270;3pieces;one change/twoops/above reason. Note-only draft discarded. No other order/policy/payment/collection/refund/workflow/print/message changes. Final independent EN detail, no dirty draft. Original Create ledger remains historical baseline, not current total.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch11: stale guard and navigation)

**Run:** returned17:17 Asia/Muscat (UTC+4), underlying16:57–17:15 about18minutes (exceeded15minbound). Demo admin,own `ORD-20261107-00001` UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9`; EN,final reportedCSS1920×1072/computer capture1280×800. Authoritative `/workspace/qa-20261107/man-stale-nav-ledger.md` read completely. Finalone clean detailtab `/dashboard/orders/{UUID}?tab=change_history`.

| # | Result | Evidence |
|---|---|---|
| Guide9/P6-13 notes-only | PARTIAL subcheck; earlier parentFAIL retained | Anotes-onlystage shows No money change,total4.783. SingleacknowledgednotesApply persisted revision3,delta0,moneyunchanged. NO networkcapture,no changes/quote absence assertion; no promo check or immediate-refresh claim. Earlier quantityUpdating>25s/postApplystale findings not retested/resolved. |

Only relevant live-card/notes evidence: noteWARNack thenREADY,current4.783/projected4.7830; saved total4.783,tax0.313,paid0,due4.783. No collection/payment. A savednote `QA-20261107-STALE-A-COMMIT`; B/nav drafts discarded. Creator-note absence not resolved by this distinctEditflow. Duplicate/stale/nav details remain in Manual/matrix,not inferred financialcoverage.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch11)
- **FET-RV-Nov07-NotesNoMoney:** Retain observed notes-onlyNo money change and persistedunchangedmoney; verify noquote/network separately. EarlierUpdating/stalebaseline failures remain open.

**Evidence** `/workspace/qa-20261107/shots/`: `man-stale-b-review-stale.webp`,`man-stale-b-ready-review.webp`,`man-stale-concurrent-edit-block.webp`,`man-stale-a-ready-review.webp`,`man-stale-a-applied-balance.webp`,`man-stale-a-history.webp`,`man-stale-final-en.webp`,`man-nav-draft-staged.webp`,`man-nav-back-prompt.webp`,`man-nav-back-stay.webp`,`man-nav-draft-discarded.webp`.

### Test data left behind / latest fixture
Revision3,total4.783,tax0.313,paid0,due4.783,POCprocessing/pending;2totalChanges(2oldqtyops+1newnotesop). A note intentionallysaved,B/NAVnot;onecleanENdetailtab. No other saved changes. These actualstates supersede expectedrevision3 in brief,not historicalrecords. No Arabiccheck thisbatch.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch14: reviewed read-only diagnosis)

**Supportingreadmethod:**2026-11-07 17:35:04–17:36:05 and17:37:26 Asia/Muscat(UTC+4),remoteDBviaestablisheduser-machinepsql;serverdefault_transaction_read_only=on verified,statementtimeout20s,onlyminimalcatalog/tenant-orderSELECTs. Credentialvaluesneverprinted/copied,sessionsecretcleared. No source/APIinspection,DBmutations or policy/role/taxwrites. Parentreviewed supporting `/workspace/qa-20261107/db-diagnosis.md`;sanitizedqueryresults`db-diagnosis-data1/2/3.txt`and`db-diagnosis-workspace.txt`. This adds diagnosiscontext,notnewUIrun/changedverdict.

### Tester suggestions / supporting evidence — customer display inconsistency
**FET-Nov07-CustomerDisplay-Clarification:** Both own`cce8a46e-a8f4-4346-8ca1-790182d1e1d9` andolder`0a27746d-5667-4342-999a-055d8ced7d4d` reference samecorrecttenantorgcustomer`264a0321-daac-4e88-a17f-d423134c7fad`,sameDemo1111tenant;globalrelationshipresolves. Ordercustomer_name snapshot andorgdisplay_name `Jh Test dev21`;orglegacyname/globaldisplay_name/globalname `Test Customer2 Mohammed Ahmed`. Olddetailmatchesordersnapshot/orgdisplay;Ready/receiptmatcheslegacy/globalname. CurrentUIinconsistencyFAILremainsvalid,butNOTproofwrongcustomerUUID/cross-tenantleak. DBshowsnamefielddivergence,NOTwhichUIpath/fieldisread. Ownfixturehasidenticalstorednamedivergence;exactcurrentUIcrosscheckseparate.
One-linefixrecommendation: renderoneconsistenttenant-facingdisplayidentitycontract acrossdetail/Ready/receipt,verifyrenderpathbeforechoosingfallback;noDBcustomerbulkoverwrite orassertedcodefilecause.

### Supporting evidence — actual workspace failure order storage
At17:37:26 readonlySELECTspecifically`cd4ac165-9a37-4b5e-9300-59152ca8e236`/Demo confirmsrevision2,CURRENT,subtotal1.8000,discount0,tax0.1260,total_amount1.9260,paid0.8560,due1.0700. Nested`financial_calculation_snapshot.derivedTotals` matches1.926/1.8/0/.126/.856/1.07. Thus actualearlierworkspaceheader0.000 conflictswithnonzerosavedcanonicaldataonSAMEorder;notjusta cross-ordercomparison. NoUIcodecauseproved. Recommendationworkspaceconsumesauthoritativesavedfinancialsnapshotconsistentlyandshowsunavailableinsteadofinventedzero,afterverifyingactualmapping.
Ownrevision3storedtotal4.783,tax.313,paid0,due4.783;older00008stored.856/tax.056/paid.856/due0;theirderivedtotalsandnonzerolinesconsistent. Threeordersnowseparatelyverified;no assumptionworkspaceonownfixturewasretested.

### Notes / unchanged data boundary
Currentowninternal_notes`QA-20261107-STALE-A-COMMIT`persisted;customer_notesempty. CannotrecoverunwrittenCreate-notehistoryorresolveoriginalCreateabsencefromcurrentEditnote. OriginalCreatefindingremainsprovisional,separateflow. No changesmade:ownlastverifiedrevision3,total/due4.783,tax.313,paid0,2Changes;priorUIverdictsandtestcountsunchanged.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch15: public tracking and small Edit subset)

**Follow-up:**17:33–17:41:29 Asia/Muscat(UTC+4),Demo admin,ownrev3ordercce8a46e-a8f4-4346-8ca1-790182d1e1d9;EN,final1920×1072CSS. ActualChromeUIincognito/clipboardpaste/device-toolbarused;noShellclipboard/API. Authoritativeupdated`/workspace/qa-20261107/public-fin-customitem-ledger.md`. No savedchanges;existingcustomdraftalreadyloggednotdoublecounted.

| # | Result | Evidence |
|---|---|---|
| Guide10/P6-11 | PARTIAL | Copyanonymousroute/money/limitedstaff-ID-referenceprivacyPASS;nonzeromethod/credit/chargeandrevoked-expiredlinkstatesuntested. |

**Copy/publicroute subchecks PASS:** No toast is not failure. NormalCtrl+Vincognitoaddressbarconfirmedcopied`https://cmx.cleanmatex.com/track/[redacted]`;authorizedexistingtokenloadedanonymousCleanMateX/TrackYourOrder. No token/contactvaluesretainedinQAtext/screenshots. Signed-incontextrestoredafterincognitoclosed.
**Financialamounts PASS onthisfixture:** Items&extras4.500,discount−.030,tax+.313,total4.783,paid0,balance/due4.783;POCnoticeProcessing/remaining4.783consistent. TaxinclusivelinefiguresBathrobe4.494/Shirt.289sum4.783. No paid/creditentries;Charges/Credits/paymentmethodrowsnotdisplayed.
**Privacy limited PASS:** no staffwarnings/UUID/paymentreferencesobserved. Trackingpagealsohasnormalorder/status/timing/item/customersections;thesearenotautomaticallyfinancial-blockleakageorcrosscustomerdata. Guide10saysfinancialstatementshowscategoriesandNothingelse;availableguidetextdoesNOTexplicitlyrequireeveryzeroCharges/CreditsroworpermethodrowswhennoPayments. ThereforemissingzerorowsisP2contract-clarificationcandidate,NOTconfirmedfinancialgap/privacyFAIL. Do notadopttheledger'sunqualifiedwhole-pagefinancial-fields-onlyfailureinterpretation. Needstatement-boundaryandnonzerofixturebeforestrictminimizationconclusion.
Evidence`/workspace/qa-20261107/shots/public-fin-link-control.png`,`public-fin-statement.png`,`public-fin-balance.png`privacycropped.

### Tester suggestions — Financial_Expert_Tester(batch15)
- **P2 clarification FET-RV-Nov07-PublicZeroRows:** Confirmzero-category/permethod-emptydisplaycontractandfinancialblockboundarybeforeclaimingomissiondefect;noP0contactexposureclaimorwholetrackingpageremovalrecommendation.

### Test data left behind
None;ownrev3,total/due4.783,tax.313,paid0,processing/pending,twoChanges;customdraftdiscarded(noadditionalcustomattemptcount). ENcleandetail,incognitoclosed,desktoprestored. No messages/linksend/revoke/payment/workflow/printing/policy/settings.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch18: long bilingual Review and financial previews)

**Run:**2026-11-07 17:54:09–18:06:54 Asia/Muscat(UTC+4),12m45s(2m45over10minbound);owncce8a46e-a8f4-4346-8ca1-790182d1e1d9,EN/AR→EN1440×985CSS. Fullauthoritative`/workspace/qa-20261107/man014-oc009-p6-05-p6-03-ledger.md`read. No Apply/payment/taxdoc/refund/void/credit/workflow/printing/PDFsave.

| # | Result | Evidence |
|---|---|---|
| Guide4/P6-05 | PARTIAL; balancepill/modal subchecksPASS |CollectPaymentbalance/due4.783/outstanding4.783,paid0;defaultCash/amountfieldsuntouched,Cancelclosedunchanged. NOsavedsettlement/fullpay→Settledproof. |
| Guide7/P6-03 | PARTIAL; in-appreport subchecksPASS |ActualReadyPrintInvoices&Payments(A4)selected(notreceipt). In-apppreviewA4layout,blackwhiteonecolumn,financial/nestedrowsopen;nativeprintdialog/pagedPDFnotopened,noprint/save/send. |

Reportfiguresexact:items4.500(Bathrobe4.200,Shirt.300),charges0,discount−.030,VAT.224/Municipal.089/tax.313,total4.783;payments/credits/refunds/overpayment/receivable0,due4.783. InvoiceNo data available;recordsTaxdocs/vouchers/loyalty/adjustments/currency/receiptsNone,orderchanges/timelinevisible. No paymentmethodwrite/nativeprinteroutputclaim.

### Tester suggestions — Financial_Expert_Tester(batch18)
- **FET-RV-Nov07-CollectPreview:** Preservepillcorrectnesswithoutclaimingpaidsettlement;dedicatedsyntheticfinancialfixture/custodyneededforfullpay.
- **FET-RV-Nov07-A4Scope:** RetainactualInvoices&Paymentsin-apppreviewcoverage;nativeA4pagination/renderingrequiresseparatepreviewtest,noprinterjobsrequired.

Evidence`/workspace/qa-20261107/shots/collect-preview-balance-pill.png`,`collect-preview-modal.png`,`financial-report-preview-options.png`,`financial-report-preview-top.png`,`financial-report-preview-middle.png`,`financial-report-preview-records.png`.

### Test data left behind
No savedchanges;alldraftsdiscarded,ownrev3/Bathrobeqty2,total4.783,tax.313,paid0,due4.783,POCprocessing/pending,twoChanges. EN1440×985cleandetail,nomodal;no printing/payment. Priorfailures/roundstextpreserved.

Cumulative provisional ledger recount: PASS 0 / FAIL 2 / PARTIAL 6 / BLOCKED 0 / NOT RUN 4: RV-03, RV-06, RV-11, RV-12 (12 parent scenarios). Subcheck PASS does not imply parent PASS.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch20: external customer-app environment preflight)

**Environment preflight only — 2026-11-07 Asia/Muscat (UTC+4).** No customer-app UI attempt, sign-in, OTP, service startup, source/API/SCM access or mutation. Narrow user-machine scan of `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` (33 lines): documented environment hosts only `https://cmx.cleanmatex.com` (line6) and `https://hqsaas.cleanmatex.com` (line18). No customer/mobile/Android/iOS/Flutter/Expo/TestFlight/APK/IPA reference found by metadata scan; no customer-app login entry identified. The credentials document was NOT copied; no account/contact/credential values emitted or requested. Memory and available QA notes supplied no genuine customer-app address/build. Existing QA rounds already record missing customer mobile build. This establishes missing access inputs for this run, NOT that no customer application exists. Tenant web-admin at phone width and public tracking are not customer-app substitutes.

| # | Result | Evidence |
|---|---|---|
| RV-11 / guide11 / P6-12 | BLOCKED — environment preflight, not UI failure | Guide path is customer app→sign in→Orders→order→Payment summary. No documented customer app build/openable entry/backend setup identified in scoped evidence; no fake app attempt. Need actual distribution/URL, platform/environment mapping, authorized customer-session entry and customer-owned order; wallet-credit fixture additionally needed for total−paid−credits check. Public tracking does not satisfy this subject. |

### Tester suggestions — Financial_Expert_Tester (batch20)
- **P2 FET-RV-Nov07-CustomerAppPreflight:** Add non-secret build/access/environment and supported test-session instructions for P6-12. Keep wallet-credit fixture prerequisite explicit; do not report UI FAIL from missing app access.

**Cumulative12-parent counts:** PASS0 / FAIL2 / PARTIAL6 / BLOCKED1 / NOT RUN3: RV-03, RV-06, RV-12. Earlier preview/localization findings preserved, no full-web-QA blockage implied.

### Test data left behind
No changes, app sessions or OTPs initiated. Own order remains rev3/total4.783/tax.313/paid0/due4.783 OMR.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch22: AR and edge-state fixture inventory)

**Run:**2026-11-07 18:26:55–18:35:13 Asia/Muscat(UTC+4),8m18s; Demo tenant admin, EN desktop. Full authoritative `/workspace/qa-20261107/ll-promo-ar-edge.md` read. This batch completed read-only inventory, NOT the missing financial behavioral tests. No rules/promos/invoices/payments/tax documents/snapshots created, saved, disabled, issued, posted, collected, cancelled or deleted. Previous findings preserved unchanged.

| # | Result | Evidence |
|---|---|---|
| RV-06 / guide6 / P6-07 | BLOCKED — AR invoice fixture missing | Internal Finance exposed New Invoice, AR Aging, Customer Balances and AR Ledger, no visible invoices list. `/dashboard/internal_fin/ar/ledger` required customer: `Choose a customer from the AR customers page to open the tenant-scoped ledger`. Browse AR Customers→`/dashboard/internal_fin/ar/customers`:0customers,0.0000outstanding/0.0000unappliedcredit, `No customers currently have AR invoices or AR ledger activity.` No invoice created. Invoice Orders-tab balances/words and single financial-headers request NOT tested; empty inventory is not proof of failed invoice feature or PASS. |
| RV-12 / guide12 | BLOCKED — all four special-state fixtures missing | Orders list9rows:8Processing/1Delivered, no cancelled row; status filter Draft/Intake/Preparation/Processing/Ready/Ready for Pickup/Out for Delivery/Delivered, no Cancelled option observed. Own normal order no snapshot/tax-inclusive/recalculating text. No eligible cancelled, no-snapshot, tax-inclusive or recalculating fixture found. No expected exceptional-state banner/tax behavior can be judged from normal order; no manufactured missing-badge failure. |

**Normal order baseline only:** `/dashboard/orders/cce8a46e-a8f4-4346-8ca1-790182d1e1d9`, total/due4.783/paid0, manual Line Discount.030,tax.313(VAT.224/Municipal.089), AR invoiceNone/receivable0. Absence of badge/text or UUID shape does NOT establish absent snapshot, tax inclusion or recalculation. No snapshot/cancellation mutation.

### Tester suggestions — Financial_Expert_Tester(batch22)
- **P2 FET-RV-Nov07-ARFixtureInventory:** Supply a designated AR invoice with linked orders and authorized invoice-detail route before checking Orders balance words and one batched financial-headers request. Zero AR customers is prerequisite evidence, not invoice-functional FAIL.
- **P2 FET-RV-Nov07-EdgeFixtureInventory:** Supply designated fixtures for recalculating/cancelled/no-snapshot/tax-inclusive states. Verify exact expected banners/no-live-prompt/unavailable-not-zeros/included-tax-not-added only on matching fixtures. Do not damage normal orders to manufacture state coverage.

Evidence under `/workspace/qa-20261107/shots/`: `reuse-ar-empty-customers.png`, `reuse-edge-own-financial-summary.png`, `reuse-edge-orders-filters.png`. Ledger contains no network/request-count evidence; none claimed.

**Cumulative12parents:** PASS0 / FAIL2(RV-05,RV-09) / PARTIAL6 / BLOCKED3(RV-06,RV-11,RV-12) / NOT RUN1(RV-03). Prior leaf findings remain; empty inventory is not full behavioral execution.

### Test data left behind
No new/saved records, invoices, rules, promos or special-state snapshots. Own order unchanged rev3/discount.030/total-due4.783/paid0, EN clean detail, no modal. No money/workflow actions.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch23: money-refresh prerequisite notes only)

No new UI/money action executed. Read `/workspace/qa-20261107/remaining-edit-view-preflight.md`.

| # | Result | Evidence boundary |
|---|---|---|
| RV-03 / P6-08 | NOT RUN target behavior | Guide requires statement refresh without page reload after EACH: record payment, verify pending payment, refund payment, void charge, issue tax document, collect AR invoice. Existing Collect modal Cancel, unsaved tender preview and Edit/reload evidence are not six write-refresh proofs. |

Missing dedicated synthetic tender/order and confirmed cash custody; pending-payment verification fixture/role; refundable synthetic transaction/approved rail; active disposable manual charge and orders:manual_charge; designated fiscal-issuance fixture/approval; AR invoice/linked order and synthetic collection custody (AR customers previously0). No financial custody fixtures established; absence is not UI FAIL. EN/AR and viewport scope remain unproved for these writes.

### Tester suggestions — Financial_Expert_Tester (batch23)
- **P2 FET-RV-Nov07-MoneyRefreshPrereqs:** Establish six action-specific disposable fixtures and custody/issuance permissions before actual refresh tests. Record no-reload statement transition per action; neither presence of a button nor ordinary reload can sign off mutation-driven refresh.

**Counts unchanged:** PASS0/FAIL2/PARTIAL6/BLOCKED3/NOT RUN1:RV-03. Own order rev3/total-due4.783/paid0 unchanged. No payments/refunds/voids/tax issuance/collection/cancellation/workflow changes or API/DB/source/spec actions.

### Test data left behind
None; prerequisite notes only. Earlier result text preserved.


## Financial_Expert_Tester Results — 2026-11-07 (FINAL reconciliation: INCOMPLETE)

**INCOMPLETE — NO OVERALL PASS.** Original requested QA pass stopped after the completed evidence below; no further testing. Parent PARTIAL/BLOCKED/NOT RUN are unresolved coverage, and NOT RUN0 never means all subchecks passed. Earlier rounds/leaf FAILs remain unchanged. This is own final reconciliation, not an edit of author requirements or other editors' results. No source/spec additions or execution.

**Final parent counts:** PASS 0 / FAIL 2 / PARTIAL 6 / BLOCKED 3 / NOT RUN 1.

**FAIL IDs:** RV-05, RV-09
**PARTIAL IDs:** RV-01, RV-02, RV-04, RV-07, RV-08, RV-10
**BLOCKED IDs:** RV-06, RV-11, RV-12
**NOT RUN IDs:** RV-03

### Qualified unresolved findings / recommendations
- P1 FET-FINAL-RV: Workspace0.000 vs nonzero stored snapshot, cross-surface customer labels, stale Edit live-card Updating and after-save display remain actual observations; server/UI root cause not established. Audit/identity DB evidence must not be described as proven wrong-PK UI join.
- P2 FET-FINAL-RV-Localization: AR headings/raw keys and responsive clipping remain findings. Six RV03 money-action no-reload refresh tests NOT RUN; no financial custody fixtures. Collect Cancel/report in-app previews are not full settlement/native print proof. AR/customer-app/special edges require matching fixtures; missing badges on normal order not FAIL.
### Test data left behind
Own order rev3,total/due4.783,tax.313,paid0,manualdiscount.030 unchanged; no payments/refunds/collection/fiscal issuance/cancellation/workflow changes. No messages/actual printing/password changes. Source order-financial-view.spec.ts inspected earlier but never executed/edited by this workstream; no new spec.
