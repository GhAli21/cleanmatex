# Tax Engine — QA Test Guide

For the person testing the app. Each scenario gives the screen, what to do, and what you should see.

## T3 — Tax setup (organization app)

Sign in as an organization owner. Menu: **Settings › Tax Setup** (`/dashboard/settings/tax`).

| # | Do | Expect |
|---|---|---|
| 1 | Open Tax Setup | Overview shows "Waiting for confirmation", the tax kit and the package. A "Current order tax" tab holds the old profiles |
| 2 | Click **Review and confirm** (`/dashboard/settings/tax/setup`) | A sentence such as "Your customers pay VAT 5% on standard services", how prices are treated, when invoices are issued, worked examples, and a warning if the kit is not verified |
| 3 | Leave the registration numbers empty and click **Confirm tax setup** | Not activated. "Not ready yet" lists the missing registration number |
| 4 | Enter the numbers, save, confirm | "Tax setup confirmed"; Overview shows Active. Check that the organization's price mode now matches the package |
| 5 | Turn on **Advanced mode** | Tabs Tax codes, Tax rules and Item tax classes appear |
| 6 | Tax codes › change the rate of a code no order has used | Saved on the same version |
| 7 | Tax rules › add a rule that overlaps an existing one, with the same priority and the same number of conditions | Refused: "could tie with another one" |
| 8 | Tax rules › **Why this tax?** Choose a class and show the result | Shows the rule used, its codes and rates, and which other rules matched |
| 9 | Item tax classes › deactivate the default class | Refused: make another class the default first |
| 10 | Add your own rule, then turn off Advanced mode | Refused until your own rule is deactivated |
| 11 | Switch to Arabic | Every new label is Arabic and the layout is right-to-left |
| 12 | Sign in as a user with only `tax:view_config` | Everything is visible; no save, confirm or apply buttons |
| 13 | Create an order before confirming | No tax on the order: tax starts only after confirmation |

## T3 — Apply tax kit (HQ)

Tenant workspace › **Tax kit** (`/tenants/<id>/tax-kit`), with `tax_packs.manage`.

| # | Do | Expect |
|---|---|---|
| 14 | Apply a package with Activate off | "Tax kit applied"; the organization's setup is waiting for confirmation |
| 15 | Turn Activate on with no reason | Apply is disabled |
| 16 | Activate on an organization missing a registration number | Refused as not ready; the setup does not become active |
| 17 | Check HQ audit | A `tax_setup.tenant_kit_apply` row with before and after |
| 18 | Sign in with `tax_packs.view` only | Status is visible; no Apply button |

## T4 — Orders taxed by rules (organization app)

Apply `0722` first. To see the tax record, run in the database: `select tax_code, line_status, taxable_amount, tax_amount, source_doc_line_id from org_tax_lines_tr where source_doc_id = '<order id>';`

| # | Do | Expect |
|---|---|---|
| 19 | **Orders › New Order** on an organization that is still waiting for confirmation | Totals show no tax. No rows in the tax record |
| 20 | Confirm the setup, then create an order with two items (`/dashboard/orders/new`) | VAT at the kit rate. One PROVISIONAL row per item and code; the rows add up to the order's tax |
| 21 | Same, with an order discount | Tax falls with the discount. The rows still add up to the order's tax; one row has no line |
| 22 | **Catalog › Services**, open an item, set **Item tax class** to Tip, then order it | That line has no tax. Its row shows `VAT_OOS` with zero tax and its base |
| 23 | Give a customer an exemption (**Settings › Tax Setup › Exemptions**), then order for them | No tax. Rows show `VAT_EXEMPT` with zero tax |
| 24 | Advanced mode › Tax rules, deactivate every sales rule, then price a cart | Cart says no tax rule covers an item; the order cannot be placed. Reactivate the rules after |
| 25 | Edit an order and add an item | Existing items keep their tax; the new item follows today's rules. Rows are replaced, not doubled |
| 26 | Issue a tax invoice for the order | Rows become FINAL with a date and period |
| 27 | Edit that order | Old rows stay, reversal rows appear, new rows are FINAL. Net tax equals the order's tax |
| 28 | Refund part of that order | A credit note, and reversal rows for that share at the original rates |
| 29 | Organization `11111111…` after `0722`, confirm, then order | VAT 5% and the extra 2%, as before |
| 30 | **Customer app › Booking** before and after confirming | VAT shown is 0 before, the kit rate after |
| 31 | Arabic | New messages and the Item tax class field are in Arabic |

### T4 leftovers — old engine removed (M4b) and tax by code per line

Apply `0727` first, then `npm run prisma:pull` and regenerate types in both repos.

| # | Do | Expect |
|---|---|---|
| 31a | Open an order (organization `11111111…`, confirmed) › order detail › money panel › **Items**, expanded | Under each item: "Tax VAT_STD 5% 0.250" and "Tax … 2% 0.100" — one entry per code, matching the line's tax |
| 31b | Edit that order, change an item's quantity, save, open the money panel again | Each item shows its new tax by code; no doubled entries |
| 31c | Customer tracking link for that order | The money panel shows no tax-by-code entries (staff only) |
| 31d | **Settings › Tax Setup** | Tabs: Overview, (Advanced: Tax codes, Tax rules, Item classes), Tax periods, Exemptions. No old tax profile editor |
| 31e | As a user **without** `tax:manage_config`, try to add or change an exemption | Refused (permission denied); nothing saved |
| 31f | New order with **Express** speed, one service item and one retail item (e.g. hanger) | Order is accepted; the retail item keeps its normal price, the service item gets the Express price |
| 31g | **HQ › organization › Tax kit › Apply** (or Update kit now) after `0727` | Works as before; no error about `is_default` / `applies_to` |

### Kit facts verified (`0728`)

| # | Do | Expect |
|---|---|---|
| 31h | Oman organization: **Marketing › Gift Cards › Sell**, keep "When tax is charged" = **As in tax setup**, sell 10.000 | The card is single-purpose: tax lines appear at sale (VAT inside 10.000). Using the card later adds no tax |
| 31i | Saudi organization (or switch the demo kit): same | Multi-purpose: no tax at sale; tax when the card pays for an order |
| 31j | Oman organization: **Reports › VAT Return** for a period with orders and expenses | Boxes 1a–7c in the official order; 5a = 1a + 1f + 2a + 2b + 4a; 7c = 7a − 7b |
| 31k | **HQ › Tax Kits** › OM / SA / AE: version facts | Verified; "Gift cards taxed" shows At sale (OM, AE, BH) / When used (SA). New draft → **Edit facts** shows the gift card setting and saves it. BH return boxes 1–16 still marked unverified |

## T5 — Purchases taxed by rules (organization app, ERP-Lite)

Needs ERP-Lite expenses, PO and AP turned on, and a confirmed tax setup. Tax record: `select tax_code, tax_flow_code, line_status, taxable_amount, tax_amount, recoverable_amount from org_tax_lines_tr where source_doc_id = '<document id>';`

| # | Do | Expect |
|---|---|---|
| 32 | **ERP-Lite › Expenses** (`/dashboard/erp-lite/expenses`): amount 100, tax blank, class blank | Tax 5% of 100. One FINAL `VAT_IN_STD` row, recoverable = tax |
| 33 | Same with tax typed one minor unit off (e.g. 5.001 in OMR) | Saved with the typed tax |
| 34 | Same with tax 7 | Refused: the message shows the expected tax; nothing saved |
| 35 | Same with class **Purchase, not recoverable** | Tax 5%; row recoverable 0 |
| 36 | Same with class **No VAT** and tax blank | Tax 0; row `VAT_IN_NONE` |
| 37 | **ERP-Lite › Purchase Orders** (`/dashboard/erp-lite/po`): PO with tax blank | Total includes 5%. No tax rows (a PO is not a tax document) |
| 38 | **ERP-Lite › Accounts Payable** (`/dashboard/erp-lite/ap`): supplier invoice, tax blank | FINAL INPUT row on the invoice |
| 39 | Pay that invoice | Payment saved; one WITHHOLDING row `WHT_NONE` with 0 tax |
| 40 | Expense in another currency while tax is on | Refused: must be in the organization currency |
| 41 | Organization still waiting for confirmation: expense with tax 3 typed | Saved with 3; no tax rows |
| 42 | Arabic | Item tax class, supplier and refusal messages in Arabic |

## T6 — Advances and gift cards (organization app)

Needs a confirmed tax setup with an OM/SA/AE/BH kit (they tax advances). Tax record: `select source_doc_type_code, tax_code, line_status, taxable_amount, tax_amount, reverses_tax_line_id from org_tax_lines_tr where party_id = '<customer id>' or source_doc_id in ('<card id>', '<invoice id>') order by created_at;`

| # | Do | Expect |
|---|---|---|
| 43 | **Customers › customer › Stored value**: receive an advance of 105 by cash | One FINAL `VAT_STD` row on the receipt voucher: taxable 100, tax 5 |
| 44 | Pay a new order of 105 from that advance, then issue its invoice | Order rows FINAL (tax 5); one reversal row on the invoice taking back 5 from the advance. Net tax 5, not 10 |
| 45 | Issue the invoice first, then pay the order from the advance | Same rows; the reversal appears when the payment is made |
| 46 | Pay only 52.500 from the advance | Reversal takes back 2.500; 2.500 stays on the advance |
| 47 | Reverse the advance receipt voucher before it is used | A reversal row on the reversal voucher takes back the 5 |
| 48 | Organization with the generic kit (no tax on advances): receive an advance | No tax rows |
| 49 | **Marketing › Gift cards › Sell card** (`/dashboard/marketing/gift-cards`), mode **Multi-purpose**, 105 | No tax rows at sale. Paying an order with it: order taxed as usual, no reversal |
| 50 | Sell a **Single-purpose** card of 105 | One FINAL row on the card: taxable 100, tax 5; no card code in `source_doc_no` |
| 51 | Pay an order of 105 with that card and issue the invoice | Reversal row on the invoice takes back 5 from the card |
| 52 | Reverse the sale of an unused single-purpose card | Its tax is taken back on the reversal voucher |
| 53 | Arabic | The "When tax is charged" field and its help in Arabic |

## T7 — VAT return, tax periods, tax postings, withholding (organization app)

Needs a confirmed tax setup with a VAT kit, and ERP-Lite on for the posting checks. Postings: **ERP-Lite › Journals** or `select * from org_fin_post_log_tr where source_doc_type_code = 'TAX_LINE' order by created_at desc;`

| # | Do | Expect |
|---|---|---|
| 54 | **Settings › Tax Setup › Tax periods** (`/dashboard/settings/tax`) as an owner: add 1–30 of this month | Period listed as Open |
| 55 | Add a period that overlaps it | Refused: "This period overlaps another tax period" |
| 56 | Close the period that contains today, then issue a tax invoice for an order | Refused with "This tax period is closed…" (final tax lines are dated today); reopen asks for a reason (at least 3 characters), then the invoice issues |
| 57 | A user without `tax:manage_periods` (e.g. branch manager) | Sees the periods, no Add / Close / Reopen buttons |
| 58 | **Reports › VAT Return** (`/dashboard/reports/tax-return`): choose the period | Boxes in form order under Sales, Purchases and Tax due; the "Box numbers to confirm" warning shows |
| 59 | After a taxed order of 105 (5%) and a refund of it | Standard-rated sales box: amount and tax net to 0 |
| 60 | After an expense with recoverable input tax | Purchases box shows its amount and recoverable tax; Tax due = sales tax − recoverable |
| 61 | Click a box number | The lines behind it open, newest first, with reversals marked |
| 62 | UAE organization with a branch that has no emirate | Its sales appear under "Tax lines not on this return" |
| 63 | **Export CSV** | File `vat-return-<from>-<to>.csv` opens in Excel with Arabic names readable |
| 64 | Receive an advance of 105 (T6 #43) with ERP-Lite on | A journal moves 5 from Customer Advance Liability to Output VAT |
| 65 | Use it on an invoiced order | A journal moves 5 back from Output VAT to the advance liability |
| 66 | Single-purpose gift card sale / use | Same two journals on Gift Card Liability |
| 67 | **ERP-Lite › Expenses**: expense of 100 + 5 recoverable tax | Journal: Dr expense 100, Dr Input VAT 5, Cr cash 105. An expense without the tax engine still posts the full total to the expense |
| 68 | Supplier with a withholding rule above 0%: **ERP-Lite › AP** pay 1,000 at 10% | Payment saved; list shows "Withheld 100 · paid to supplier 900"; invoice settled by 1,000; bank match accepts up to 900 |
| 69 | Arabic | Periods tab, VAT Return and the withholding note read correctly right-to-left |

## T8 — Tax health checks, kit versions, kit updates, onboarding (both apps)

| # | Do | Expect |
|---|---|---|
| 70 | Organization app with a pending tax setup: open the dashboard | Banner "Orders are not taxed: tax setup is not confirmed" with a link to Review tax setup |
| 71 | **Settings › Setup Health** (organization) | Tax section lists the checks; registration and document-rule checks show "not applicable" until tax is active |
| 72 | Confirm the tax setup, then clear the registration number on the organization and a branch | "Tax registration number missing" fails for that branch |
| 73 | Product with no tax class (or an inactive class) | "Products without a tax class" fails, link opens the catalog |
| 74 | HQ › tenant › Setup Health | Also shows "Tax kit facts not verified" (HQ only) for OM/SA/AE/BH kits |
| 75 | HQ › **Master System Codes › Tax Kits** (`/system-codes/tax-kits`), open OM_VAT | Version picker; on a published version: "New draft from this version" (needs `tax_packs.manage`) |
| 76 | Create the draft; edit facts with an effective date in the past | Refused: "Choose today or a later date" |
| 77 | In the draft change VAT_STD rate to 6, then **Check examples** | Examples fail (expected 0.500, got 0.600) |
| 78 | Edit the two examples to the new tax (0.600 / 0.566 inclusive) and check again | All pass |
| 79 | **Compare with previous** | Shows VAT_STD rate 5 → 6 and the changed examples |
| 80 | **Publish** with a date of tomorrow | Published; version 1 now ends today. Try editing version 1 in the database: refused (`TAX_KIT_VERSION_LOCKED`) |
| 81 | Next day (or HQ › tenant › Tax kit › **Update kit now**) | OM organizations move to version 2; an active setup stays active; Setup Health "Tax setup update needs review" is OK, or lists conflicts if the organization had edited VAT_STD |
| 82 | Discard a draft | Draft gone; published versions untouched |
| 83 | HQ: create a new organization (country OM) | Its tax setup exists as "waiting for confirmation" with the OM default package |
| 84 | Arabic | HQ kit draft screens, dialogs and messages read correctly right-to-left |

### Purchase reverse charge (`0731`, kit version 2 from 2026-11-14)

| # | Do | Expect |
|---|---|---|
| 31l | **HQ › Tax Kits** › OM (also SA, AE, BH) | Version 2 Published from 2026-11-14, version 1 ends 2026-11-13; version 2 rules include `IN_GCC_RC`, `IN_FOREIGN_RC_NONREC`, `IN_GCC_RC_NONREC`; code `VAT_IN_RC_NONREC`; Check passes 7 examples |
| 31m | Organization on version 2 (any segment, e.g. SME): **ERP-Lite › Expenses › New**, supplier whose tax country is another GCC state (e.g. Oman organization, Saudi supplier), item class "Standard purchase", 100 | Tax line uses `VAT_IN_RC` (reverse charge): due tax and recoverable tax both shown; the VAT return counts it in the reverse-charge boxes (OM 2b, AE 3 + 10, SA 9, BH reverse-charge lines) |
| 31n | Same, supplier tax country outside the GCC, item class "Standard purchase" | Reverse charge (`VAT_IN_RC`), not refused as ambiguous; with item class "Not reclaimable" → `VAT_IN_RC_NONREC` (recoverable 0); with "No VAT" → no tax |

### Foreign-currency purchases (`0733`)

| # | Do | Expect |
|---|---|---|
| 31r | Organization currency OMR. **ERP-Lite › Expenses › New**, currency USD, date with an approved USD→OMR rate in Settings › Currencies & FX | Saved. The expense list shows Exchange Rate with that rate, its date and source (`HQ:…` or `TENANT:…`). The ledger lines are in OMR (amount × rate). Tax lines, if tax is on, store the document amount in USD and the base amount in OMR |
| 31s | Same expense on a date with no approved rate | Refused, in EN and AR, pointing to Settings › Currencies & FX. Nothing is saved |
| 31t | Petty cash box or transaction in USD | Refused. Petty cash stays in OMR |

### Supplier invoices and payments on the ledger (`0735` applied)

| # | Do | Expect |
|---|---|---|
| 31u | Organization on the standard chart. **ERP-Lite › AP**: supplier invoice 100 + 5 recoverable VAT, then a bank payment of 105 with no withholding | Invoice journal: Dr expense 100, Dr Input VAT 5, Cr Accounts Payable 105. Payment journal: Dr Accounts Payable 105, Cr bank 105. Amounts are in the organization currency (× the document rate when the invoice is in another currency) |
| 31v | Same invoice, payment whose withholding rule is not 0% (or a test rule that withholds) | The invoice is settled in full. Cash or bank is credited with amount − withheld. Withholding Tax Payable (`212003`) is credited with the withheld amount |

### HQ draft rules and item classes (`0732`)

| # | Do | Expect |
|---|---|---|
| 31o | **HQ › Tax Kits** › OM › version 2 › **New draft from this version** | Draft version 3; the Item classes and Rules sections show **Add** buttons and an **Edit** button on each row (not on published versions) |
| 31p | Draft › Rules › **Add rule**: code `IN_TEST`, Purchases, Party country "Outside the GCC", priority 50, tax code `VAT_IN_RC`, save | Refused: "Another rule can apply… same priority" (ties with `IN_FOREIGN_RC`). Change priority to 60 → saved; the rule shows in the table. Edit `IN_GCC_RC`, untick its code → Save stays disabled until one code is ticked |
| 31q | Draft › Item classes › **Add item class** `PURCHASE_TEST` (Purchases), turn on Default → saved; `PURCHASE_STANDARD` is no longer default. Edit `PURCHASE_NON_REC`, switch off Active | Refused: an active rule uses the class. Then **Check examples** → pass; **Discard draft** → draft gone |
## Financial_Expert_Tester Results

Round 1 observe: 2026-11-13 00:21–00:28 Asia/Muscat, Demo Laundry admin then viewer on [cmx.cleanmatex.com](https://cmx.cleanmatex.com) and HQ SAAS Admin on [hqsaas.cleanmatex.com](https://hqsaas.cleanmatex.com). Remote only. FET made no writes (tax was **Waiting for confirmation** on that pass; Confirm not clicked; registration 10001 untouched; no period/exemption/order/draft). Retest r1 02:10–02:17 after a deploy: tenant tax still Waiting; HQ Tax Kits still doubled-path. Retest r2 04:55–05:05 after a later deploy: HQ Tax Kits **FIXED** (list and OM/SA/AE/BH v2 facts load); Demo Laundry tax became **Active** as part of the **owner's deploy** (owner confirmed this in chat; FET did not click Confirm). Price mode on Overview changed from "Before tax" (02:17) to "Including tax" (05:04). Kit on the tenant is still Oman VAT **v1** (HQ v2 in force from 2026-11-14). Mutate and high-impact (publish, new org, Pay, kit draft, #72 clear registration) were not approved and were not run while the owner was away. Customer-app URL still unknown (#30, #31c). ERP-Lite is not enabled (purchase/expense scenarios blocked).

Recount (observe + retests): runnable observe items as in the table. Many T4–T8 create/pay/publish steps remain NOT RUN.

| # | Result | Evidence |
|---|---|---|
| #1 Overview | PARTIAL, then **Active** | 00:21 `/dashboard/settings/tax`: "Waiting for confirmation"; "Tax kit: Oman VAT · v1"; "Starter package: Oman — Small / medium"; "Prices are entered: Before tax"; "Contents: 9 tax codes, 13 rules, 10 item classes." "Review and confirm"; Advanced off. "Change tax kit" (8 packages, Apply not clicked). Registration Organization = 10001 already stored; both branch fields empty; Save not used. **No "Current order tax" tab** — likely stale after 0727 (#31d: no old profile editor). **Retest r1 02:17 unchanged.** **Retest r2 05:04:** Status **Active**; still Oman VAT · v1; "Prices are entered: Including tax"; "Tax is on" ON; same 9/13/10; reg 10001. FET did not Confirm — owner's deploy. |
| #2 Review | PARTIAL | 00:21 `/dashboard/settings/tax/setup`: "Your customers pay VAT standard rate 5% + Municipal Fee 2% 2% on standard services" (duplicated 2%). **"Your prices will be treated as including tax."** contradicted Overview "Before tax" at that time. "A Simplified Invoice is issued: On order submit." Examples: "Laundry service OMR 10.000 before VAT → VAT 0.500" and "OMR 10.500 including VAT → VAT 0.500" with raw "tax=0.500 · taxable=10.000 · tax_code=VAT_STD"; neither includes the 2% fee. No "kit not verified" warning. Confirm looked enabled — **not clicked.** **Retest r1 STILL BROKEN** (same wording). **Retest r2 05:04:** green "Already active • This setup has been confirmed." Confirm button gone. Yellow "Rows you changed were kept": OUT_ADVANCE, OUT_DELIVERY, OUT_GOODS, OUT_LAUNDRY, OUT_ANY — FET did not change these. PriceModeContradiction **FIXED in current state** (Overview now also "Including tax"; may be a settings change with the deploy, not a Review-copy fix). MunicipalFeeDuplicate **STILL BROKEN**. ExamplesOmit2pct **STILL BROKEN**. Live cart tax at 05:03 **does** include the 2% (0.144 on 2.200 = 7% inclusive). |
| #3 Confirm empty | NOT RUN | Mutate (should refuse). Not approved. |
| #4 Enter numbers and confirm | NOT RUN | High-impact; and tax is now already Active from the owner deploy. |
| #5–#10 Advanced / rules | NOT RUN | Mutate. Advanced not turned on. |
| #11 Arabic | PARTIAL | 00:21–00:26. RTL; "مراجعة الإعداد الضريبي", "تأكيد الإعداد الضريبي." Leftover EN: sidebar Dashboard/Orders/Catalog & Pricing/B2B, "Enterprise", "super_admin", "v1", raw tax=… tax_code=VAT_STD. Banner and Overview title cut off under the right sidebar; tab row only "نظرة عامة." Plurals: "9 رمز ضريبة، 10 فئة أصناف." Switched back to English. |
| #12 Viewer `tax:view_config` | FAIL | Viewer redirected to `/dashboard/orders/new` ("POS session could not be checked"). `/dashboard/settings/tax` blank except the banner after ~15s; no Save/Confirm (and no content). Signed out. Same family as FET-SH-Nov12-ViewerBlankPage. |
| #13 / #19 New order before confirm | PASS (first pass) | 00:26 and r1 02:17: Main Branch 2, 1 Blouse 2.200 OMR; "Subtotal 2.200" and "Total 2.200" only — no tax line. Item removed; no order. **After owner confirm (r2 05:03):** cart "Subtotal 2.200 OMR / Tax (included) 0.144 OMR." Pre-confirm case can no longer be retested on this org. |
| #14–#18 HQ Apply kit | NOT RUN | Writes / needs `tax_packs.view`-only user for #18. |
| #20–#31g order / invoice / refund / Express+retail | NOT RUN | Need creating orders (mutate). Demo still has Total Orders 0 (05:05). |
| #30 / #31c Customer app | BLOCKED | Customer-app URL not provided. Asked once. |
| #31d Tabs | PASS | Overview, Tax periods, Exemptions. No Advanced tabs (Advanced off, not turned on). No old tax profile editor. Periods: one Open row 2026-11-01 to 2026-11-30, reason "—". Exemptions: one GOVERNMENT_ENTITY (raw code), certificate GOV-OM-2024-001, valid from 1/1/2024, "No Expiry"; edit/delete and Add present, not used. |
| #31h–#31j Gift cards / VAT boxes with data | NOT RUN | Mutate (sell cards) and/or ERP-Lite; ERP-Lite is not enabled. |
| #31k / #75 HQ Tax Kits | BLOCKED, then **PASS** with gaps | 00:28 BLOCKED: `/en/system-codes/tax-kits` red error **"Cannot GET /api/hq/v1/hq/v1/tax-setup/kits"** (doubled `hq/v1`). Same after Retry and hard reload. **Retest r1 02:13 STILL BROKEN.** Sidebar Tax kit at `/en/tenants/undefined/tax-kit` also "Cannot GET /api/hq/v1/hq/v1/tax-setup/tenants/undefined." **Retest r2 04:56 FIXED:** list loaded ~6s, no error. OM_VAT, SA_VAT, AE_VAT, BH_VAT each **v2**, in force from **2026-11-14**, Verified. NO_VAT v1 from 2000-01-01, Verified. "Showing 1 to 5 of 6." **OM v2:** picker Version 2 Published from 2026-11-14 and Version 1 from 2021-04-16. "New draft from this version" visible — **not clicked.** PUBLISHED, OMR, must register 38,500, may 19,250, simplified 500 OMR, LINE / HALF_UP, advances taxed Yes, Gift cards **"At sale (single-purpose)"**, checked 2026-11-13. VAT_STD 5%. **Contradiction:** rule "Sales · GIFT_CARD → VAT_OOS" is explained as "Gift card sale is not taxed; tax is charged when it is used" vs fact "At sale." **Official source** points at a Czech site: `https://mzv.gov.cz/.../VAT_Regulation_unofficial_english_version.pdf`. **SA:** Verified v2, SAR 375,000 / 187,500, simplified 1,000, Gift cards "When used (multi-purpose)", 15%, zatca.gov.sa. **AE:** AED 375,000 / 187,500, 10,000, "At sale", 5%, tax.gov.ae. **BH:** BHD 37,500 / 18,750, 500, "At sale", 10%, nbr.gov.bh; notes "Return lines 1-16: titles still to confirm… (line 17 = net VAT confirmed…)." **No return-box / SPV / MPV verification section in the drawer**, so #31k box status could not be fully confirmed. No draft created. |
| #31l HQ kits v2 RC facts (`0731`) | PARTIAL (observe) | Retest r2 04:56: OM/SA/AE/BH each **Version 2 · Published · from 2026-11-14**, Verified; version picker also showed OM Version 1 · Published · from 2021-04-16 (end date of v1 not read off the picker). Gift-card facts and rates recorded (see #31k/#75). **Not verified in this pass:** presence of rules `IN_GCC_RC`, `IN_FOREIGN_RC_NONREC`, `IN_GCC_RC_NONREC`; code `VAT_IN_RC_NONREC`; "Check examples" passing 7 examples (Check was not clicked). |
| #31m–#31n Reverse-charge expenses | NOT RUN | Mutate; needs ERP-Lite (not enabled on Demo) and a GCC/foreign supplier. |
| #31o–#31q HQ draft rules / item classes | NOT RUN | "New draft from this version" was visible on OM v2; not clicked (mutate / would create draft v3). |
| #31r–#31t Foreign-currency purchases | NOT RUN | Mutate; ERP-Lite not enabled. |
| #31u–#31v AP invoice journals | NOT RUN | Mutate; ERP-Lite not enabled. |
| #32–#42 Purchases / ERP-Lite | BLOCKED | ERP-Lite module is not enabled on Demo Laundry (Setup Health / Fix page). |
| #43–#53 Advances / gift cards | NOT RUN | Mutate; need ERP-Lite for some posting checks. |
| #54–#57 Tax periods writes | NOT RUN | A Nov 2026 Open period already exists (observe only). |
| #58 VAT Return | PASS (gaps) | 00:26 `/dashboard/reports/tax-return`, period 2026-11-01→2026-11-30. Boxes 1a, 1b, 1c, 2b, 6a, 5a, 7a, 7b, 7c = 0.000. Boxes 1d, 1e, 1f, 2a, 3a, 4a, 4b, 5b, 6b, 6c, 6d = "—" with "Not recorded in the system; enter it on the tax authority portal if it applies." Footer "0 tax lines in OMR." **No "Box numbers to confirm" warning.** Reports tab row has no VAT Return tab. Banner loaded late and pushed the page (first dropdown click hit Payments — navigation only). Not re-run after tax became Active (still 0 orders). |
| #59–#69 | NOT RUN | Need taxed orders / expenses / ERP-Lite. |
| #70 Banner | PARTIAL, then N/A | 00:26 and r1: exact "Setup problem: some features will not work correctly • Orders are not taxed: tax setup is not confirmed." **No "Review tax setup" link** — only "Open Setup Health" → `/dashboard/setup-health`. **Retest r2 05:04:** banner gone (tax Active). Link could not be rechecked; disappearance is from the confirm, not shown to be a code fix. Alerts "No alerts – All systems are running smoothly." |
| #71 Setup Health Tax (tenant) | PASS | ~9s. Unconfirmed: Blocker "Orders are not taxed…"; Tax registration number missing Not applicable; Products without a tax class OK; Documents with no tax rule Not applicable; Expired tax exemptions OK; Tax setup update needs review OK. After owner confirm (05:04): 0 blockers · 2 warnings (Accounting still a warning). |
| #72–#73 | NOT RUN | Mutate (clear registration / strip tax class). |
| #74 HQ Setup Health tax | PARTIAL | First passes: page empty (see Setup Health H1). **Retest r2 04:58:** TAX_KIT_FACT_UNVERIFIED OK; tax-not-confirmed was Blocker, then inconsistently OK at 04:59 (FET-SH-Nov13-HqHealthInconsistent). |
| #76–#82 Kit draft / publish / discard | NOT RUN | High-impact (publish) / mutate (draft). "New draft" was visible on r2; not clicked. |
| #83 Create OM org | NOT RUN | High-impact. |
| #84 HQ kit Arabic | NOT RUN | Blocked by the list error on the first pass; not done after the fix. |

**Test data left behind:** FET created none (cart emptied). Demo Laundry tax is **Active**, prices **Including tax**, with a "Rows you changed were kept" list on Review — all from the owner's 13 Nov deploy, not FET. Org registration 10001 unchanged. Language English. HQ no draft.

### Financial_Expert_Tester suggestions

- **P0 FET-TX-Nov13-HqKitsPathDoubled:** `GET /api/hq/v1/hq/v1/tax-setup/kits` (doubled `hq/v1`) blocked the kits list and showed a raw API path. **Retest r2 04:56 FIXED** (not reproduced). The same doubled path appeared on `/tenants/undefined/tax-kit` at 02:13 (FET-TX-Nov13-HqTaxKitUndefinedPath) — also gone on r2.
- **P1 FET-TX-Nov13-PriceModeContradiction:** Overview "Before tax" vs Review "Your prices will be treated as including tax" at 00:21–02:17. **Retest r2:** both say including tax after the owner deploy changed Overview (and confirmed tax). Re-check if Overview is set back to Before tax — Review copy may still be hard-coded.
- **P1 FET-TX-Nov13-OmGiftCardFactVsRule (new r2):** OM VAT v2 fact "Gift cards taxed: At sale (single-purpose)" vs rule text "Sales · GIFT_CARD → VAT_OOS" / "Gift card sale is not taxed; tax is charged when it is used." Align the fact, the rule, and the explanation.
- **P1 FET-TX-Nov13-ViewerTaxBlank:** Viewer Tax Setup is blank except the banner (~15s). Viewer also lands on New Order with "POS session could not be checked" (FET-TX-Nov13-ViewerNewOrderPos).
- **P2 FET-TX-Nov13-MunicipalFeeDuplicate:** Review still "Municipal Fee 2% 2%" on Retest r2 05:04.
- **P2 FET-TX-Nov13-ExamplesOmit2pct:** Worked examples still VAT 5% only, raw `tax_code=VAT_STD`, omitting the Municipal 2% — while the live cart correctly charges 0.144 on 2.200 (7% inclusive). Examples should include the 2% or explain why they do not.
- **P2 FET-TX-Nov13-OmOfficialSourceCz (new r2):** OM kit official-source link points at `mzv.gov.cz` (Czech MFA unofficial VAT PDF), not an Omani source.
- **P2 FET-TX-Nov13-NoReviewTaxLink:** Banner had no "Review tax setup" link (only "Open Setup Health") while tax was unconfirmed. Untestable after confirm.
- **P2 FET-TX-Nov13-ArabicRtlCutoff:** In Arabic, banner and Overview title cut off under the right sidebar; tab row clipped; plurals "9 رمز ضريبة، 10 فئة أصناف."
- **P3 FET-TX-Nov13-NoCurrentOrderTaxTab:** #1 still expects a "Current order tax" tab; gone after 0727. Guide may be stale.
- **P3 FET-TX-Nov13-VatReturnNoBoxWarning:** #58 expected "Box numbers to confirm"; absent. No VAT Return tab in the Reports tab row.
- **P3 FET-TX-Nov13-KitDrawerNoReturnBoxes (new r2):** Published kit drawer has no return-box / SPV / MPV verification section, so #31k box facts cannot be checked in the UI (only BH review notes mention lines 1–16 still to confirm).

### Financial_Expert_Tester Results — Retest r3 2026-11-17 (remote; approved writes on QA orders / QA org only)

**Environment:** remote only — tenant `https://cmx.cleanmatex.com` (Demo Laundry LLC, OMR 3 decimals) and HQ `https://hqsaas.cleanmatex.com` (Incognito). Run window 2026-11-17 ~04:40–09:20 Asia/Muscat (UTC+4). UI only (mouse/keyboard and browser page tools); no direct API calls, no page JS that changes data, no DB writes. Read-only `SELECT`s only where stated. Jest skipped.
**Accounts by role (no passwords; see `CREDENTIALS_AND_ENVIRONMENTS.md` / vault):** Demo Laundry admin `admin@demo-laundry.example` (shows role `super_admin`); operator `operator@demo-laundry.example`; viewer `viewer@demo-laundry.example`; HQ System Administrator `admin@cleanmatex.com`. No shared password was changed.
**Deploy caveats (2026-11-17):** (1) S0 privilege-lockdown migrations 0745–0749 were applied ~04:00–05:15; during that window New Order broke (403 `fn_stng_resolve_all_settings`, 400 `/api/v1/categories`, 500 `/api/v1/lookups/service-speeds`, "Failed to fetch customers", empty sidebar) and it was working again by ~05:38. (2) From ~05:00 Processing shows the raw error `permission denied for table sys_order_sources_cd` and an empty queue (regression; blocks Ready/Delivery/prints). (3) From ~07:00 All Orders fails with `Invalid prisma.org_orders_mst.findMany() invocation: The column org_orders_mst.photo_urls does not exist in the current database`, order detail pages show "Order not found" and New Order submit returns `ORDER_SUBMIT_FAILED`, after migration `0751_file_util_drop_photo_url_columns` dropped the column while the deployed app still reads it (still failing at 08:44). Rows that needed an order after ~07:00 are BLOCKED for that reason.
**Approved writes used:** QA orders `ORD-20261117-00005` / `-00006` (create, pay cash, issue a tax document, refund request), a QA tax rule on Demo (added, then deactivated), Advanced mode on, an HQ OM VAT **v3 draft** (edited, then **discarded** — **nothing published**), and an OM_SME kit apply on the QA org only. Demo's registration 10001 and its live kit assignment were not touched. Source ledgers on the tester box: `/workspace/qa-20261117/backlog/obs/B7-Q7.md` (tenant, 06:15–07:05) and `B8-Q7HQ.md` (HQ, 07:45–07:53). Rows above are unchanged. Tenant kit is now Oman VAT **v2** (10 tax codes, 17 rules).

**Recount (Retest r3 2026-11-17, rows in the table below):** PASS 9 · FAIL 4 · PARTIAL 13 · BLOCKED 7 · NOT RUN 1.

| # | Verdict | Evidence |
|---|---|---|
| #12 Viewer `tax:view_config` | FAIL (still) | 06:15:06 viewer `/dashboard/settings/tax`: header "Tax Setup", main content blank (no overview/tabs/controls, no error). Viewer My Permissions: `Page access: Missing`, `tax:view_config: Missing`. |
| #1 Overview | PARTIAL | 06:38 Active, Oman VAT v2, Oman — Small / medium; **"Prices are entered: Before tax"** again while Review says prices include tax; no "Current order tax" tab. Registration untouched. |
| #2 Review | PARTIAL | "Already active • This setup has been confirmed."; "VAT standard rate 5% + Municipal Fee 2% 2%" (duplicate); "Your prices will be treated as including tax"; examples show only VAT_STD 5%. Confirm not used. |
| #5–#10 Advanced / own rules | PARTIAL | Advanced on ("Tax settings saved"; tabs appear). Own rule `QA_20261117` "QA Tax Test 2026-11-17" (Sales, Main Branch 2, Outside the GCC, Retail Items, VAT_STD): Why this tax → "Rule used: QA Tax Test 2026-11-17", VAT 5%, "Also matched, but less specific: OUT_ANY". Rule deactivated (Show inactive → "Activate"). **Advanced off refused 3 times (last 07:05):** "You have your own rules or classes. Deactivate them before returning to Basic." although the only own rule is inactive; no delete option. Advanced left ON. |
| #11 Arabic | PARTIAL | RTL; sidebar/settings translated; Review headings ("Review tax setup", "Tax registration numbers", "Worked examples") and `tax_code` strings stay English. |
| #20 / #29 / #31a Order tax by code | PASS | `ORD-20261117-00005` (Jh Test dev21, Main Branch 2, Blouse 2.200 + Standard Bra 0.700, note QA-20261117-TAX): subtotal 2.900; VAT_STD 5% 0.145 (0.110 + 0.035); LEGACY_05 Municipal 2% 0.058 (0.044 + 0.014); tax 0.203; total 3.103; paid cash, `RV-2026-000120`. Financial panel shows per-item code/rate/amount. |
| #21 Order discount | PARTIAL | `ORD-20261117-00006`, same items, manual discount 0.100: paid cash 2.996, `RV-2026-000121`. Order tax 0.196 (VAT 0.140 + Municipal 0.056) but item-code detail still 0.154 + 0.049 = 0.203 — does not reconcile. |
| #22 Item tax class change | BLOCKED | Opening BLOUSE_DC from Catalog › Services showed "Access not granted — You need the admin:manage permission to view Catalog & Pricing." (role of that session not recorded; re-check as admin). No class changed. |
| #23 Customer exemption | BLOCKED | Add Exemption defaulted to CUSTOMER_EXEMPT with no customer selector / Customer ID field; cancelled. Existing GOVERNMENT_ENTITY (GOV-OM-2024-001) untouched. |
| #24 Rule deactivation | PARTIAL | QA rule inactive; read-only Why this tax (Retail Items, Outside the GCC) → "Goods sold are taxed at the standard rate", VAT 5% + Municipal 2%. No-coverage cart case NOT RUN (no active sales rule deactivated). |
| #25 / #27 / #31b Item edits | BLOCKED | -00005 Edit: "Add an item, Remove an item, Change item quantity, Add a piece, and Remove a piece: needs an override before it can be saved." -00006 qty 1→2 preview: 2.996→3.720, tax 0.196→0.244, discount −0.100→−0.124; Review `CAPABILITY_POLICY_OVERRIDE_REQUIRED`; reason "QA-20261117" entered, still no Apply/override control. Reverted. Retry after 07:00: "Order not found" / `photo_urls`. |
| #26 Tax document | FAIL | `SIM-2026-000003` (sequence 2026 / 000003, total 3.103, tax 0.203, 06:36:35). Print view: customer "Test Customer2 Mohammed Ahmed" (order shows Jh Test dev21); item taxes 0.154/0.049; tax table "No tax lines recorded on this document."; no Arabic option. |
| #28 Refund | PARTIAL | `REF-000012` 0.100 from the CASH payment on -00005 (record-only), `PENDING_APPROVAL` (second user required). No credit note or tax reversal while pending; documents still only `SIM-2026-000003`. |
| #31c Public tracking | PARTIAL | Incognito tracking for -00005: total 3.103, paid, 2 items, aggregate tax 0.203, no per-code breakdown (correct). Shows a customer identity/contact that does not match the order's QA customer. |
| #31d Tabs | PASS | Advanced off: Overview, Tax periods, Exemptions. Advanced on: + Tax codes, Tax rules, Item tax classes. No old profile editor. |
| #31e Exemption permission | BLOCKED | Viewer cannot reach the form (Tax Setup blank, `tax:view_config` missing), so the `tax:manage_config` denial cannot be tested. |
| #31f Express + retail | FAIL | Express Blouse 2.750 (2.200 + 0.550), tax 0.193, total 2.943. Adding retail "Cleaning Tool For Sale" refused: "Orders cannot mix retail items and service items. Please add only one type per order." No order created. |
| #31g / #14–#17 HQ Apply kit | PASS (QA org) | 07:51 HQ Tax kit for `QA-20261117 Catalog Org` (6556b8f3-…, OM): "Oman — Small / medium (country default)", Activate now OFF → "Tax kit applied". Audit #883 07:51:03 `tax_setup.tenant_kit_apply`, `org_tax_config_cf`, Success 201, activate false, package OM_SME, status before PENDING_CONFIRMATION, mode BASIC; 0 rows added/updated/deactivated on reapply. Demo not touched. |
| #18 View-only `tax_packs.view` user | BLOCKED | HQ users and roles pages: "You do not have permission to open this". None created. |
| #31k / #75 / #31o HQ kit draft | PASS | Existing OM VAT v3 DRAFT (from 2026-11-18) resumed; list still OM_VAT v2 Verified in force 2026-11-14. Draft pre-edits vs v2: VAT_STD 5→6%, PR class default, EXCL_10/INCL_10 expected values changed. Draft shows Add / Edit for item classes and rules. |
| #76 Effective date | PASS | 2026-11-16 → inline "Choose today or a later date."; Save disabled. |
| #31p Draft rule | FAIL | IN_TEST (Purchases, Outside the GCC, VAT_IN_RC, priority 50) → expected tie refusal "Another rule can apply to the same purchase or sale with the same priority…". At priority 60 → raw "Could not save: duplicate key value violates unique constraint `uq_stkr_criteria`"; not added. Untick only VAT_IN_RC on IN_GCC_RC → Save disabled (PASS); cancelled. |
| #31q Draft item class | PASS | PURCHASE_TEST added and made default (PR lost default). Deactivating PURCHASE_NON_REC refused: "An active rule uses this class. Change or switch off that rule first." |
| #77 / #78 Check examples | PARTIAL | EXCL_10 0.500 → "expected VAT_STD 0.500/10.000 · got VAT_STD 0.600/10.000" (draft VAT 6%); 0.600 passes. Guide INCL_10 0.566/9.434 fails ("got 0.594/9.906") because the example input is 10.500 inclusive; 0.594/9.906 passes all 7. Example descriptions still say VAT 0.500. |
| #79 Compare | PASS | Shows VAT 5→6, +PURCHASE_TEST, +PR, PURCHASE_STANDARD default true→false. |
| #80–#82 Publish / discard | PARTIAL | Discard confirmed ("The draft and everything in it is deleted. No organization uses a draft."); list back to OM_VAT v2 only. Publish not clicked (not needed; v2 left live). v2 recheck: PUBLISHED, all 7 examples pass, VAT_STD 5%, PURCHASE_STANDARD default. |
| #83 Create OM org | PARTIAL | Wizard step 1 only: country OM, OMR, Asia/Muscat defaults, cities Muscat/Salalah/Sohar/Nizwa/Sur; Next disabled until required fields; not submitted. (The QA org created in Q14 was used for #14–#17.) |
| #58 VAT Return | PARTIAL | Nov 2026 period: Sales 1a 5.000 / 0.175; 1b/1c 0; 2b 0; 6a 0; 5a 0.175, 7a 0.175, 7b 0, 7c 0.175; "4 tax lines in OMR. Credit notes and reversals are already netted." No "Box numbers to confirm" warning. (Observed 06:38, before -00005/-00006.) |
| #70 Banner | PARTIAL | Tile "0 blockers · 1 warning · 0 info"; no not-taxed banner (tax Active). |
| #71 Setup Health Tax | PASS | Tax setup is confirmed OK; registration number set OK; all products have a tax class OK; Documents with no tax rule N/A; no expired exemptions OK; "Tax setup update needs review" Warning, 5 items. |
| #31l HQ kits v2 RC facts | PASS | 07:49 the v3 draft copied from v2 carries VAT_IN_RC / VAT_IN_RC_NONREC and Purchases GCC / FOREIGN reverse-charge rules (priority 50) incl. non-reclaimable equivalents; HQ Tax Kits list loads (r2 path fix holds). |
| #74 HQ Setup Health tax | NOT RUN | Not rechecked today (see Setup Health guide H-rows). |
| #32–#42, #31m/n/r–v ERP-Lite | BLOCKED | No ERP-Lite menu on Demo; module not enabled. |
| #30 Customer app | BLOCKED | No customer-app URL. |

Prior findings, Retest r3 2026-11-17: **FET-TX-Nov13-ViewerTaxBlank STILL BROKEN.** **FET-TX-Nov13-PriceModeContradiction STILL BROKEN / back** (Overview "Before tax" vs Review "including tax"). **FET-TX-Nov13-MunicipalFeeDuplicate STILL BROKEN.** **FET-TX-Nov13-ExamplesOmit2pct STILL BROKEN.** **FET-TX-Nov13-OmGiftCardFactVsRule STILL BROKEN** (v2 and draft). **FET-TX-Nov13-OmOfficialSourceCz STILL BROKEN** (mzv.gov.cz). **FET-TX-Nov13-KitDrawerNoReturnBoxes STILL BROKEN.** **FET-TX-Nov13-VatReturnNoBoxWarning STILL BROKEN.** **FET-TX-Nov13-HqKitsPathDoubled** fix holds.

### Financial_Expert_Tester suggestions — Retest r3 2026-11-17
- **P1 FET-TX-Nov17-TaxDocPrint:** `SIM-2026-000003` print shows another customer's name and "No tax lines recorded on this document" while item taxes print; no Arabic document. Issued documents are permanent, so this needs fixing before pilot.
- **P1 FET-TX-Nov17-DiscountTaxMismatch:** With an order discount, order tax 0.196 but item-code tax lines 0.203 (−00006). Spread the discount to lines before tax, or re-compute the per-code lines after the discount.
- **P1 FET-TX-Nov17-TrackingWrongCustomer:** Public tracking for a QA order shows a different customer's identity/contact (see Q3 FET-RV-Nov17-CustomerIdentityMismatch).
- **P2 FET-TX-Nov17-AdvancedOffRefused:** Cannot return to Basic while only an **inactive** own rule exists, and own rules cannot be deleted. Ignore inactive rows in the check, or allow deleting unused own rules. **Leftover on Demo: Advanced mode ON.**
- **P2 FET-TX-Nov17-HqRuleDuplicateKeyRaw:** HQ draft rule at priority 60 fails with raw `duplicate key value violates unique constraint uq_stkr_criteria`. Map it to the same plain "another rule has the same conditions" message.
- **P2 FET-TX-Nov17-ExemptionNoCustomerPicker:** Add Exemption (CUSTOMER_EXEMPT) has no customer selector.
- **P2 FET-TX-Nov17-MixedRetailServiceBlocked:** Guide #31f expects Express service + retail on one order; app refuses mixed orders. Product decision needed; update guide or app.
- **P3 FET-TX-Nov17-GuideInclExample:** Guide INCL_10 expects 0.566/9.434 (10.000 inclusive); kit example input is 10.500 inclusive. Align guide and kit; example descriptions still say 0.500.

### Blocked
- #22 (permission), #23 (no customer picker), #25/#27/#31b (override required; then `photo_urls`), #31e (viewer cannot reach form), #18 (HQ users page denied), ERP-Lite rows, #30.

### Test data left behind
- `ORD-20261117-00005` — paid 3.103 cash (`RV-2026-000120`), tax document `SIM-2026-000003` (permanent), refund `REF-000012` 0.100 PENDING_APPROVAL.
- `ORD-20261117-00006` — paid 2.996 cash, `RV-2026-000121`, note QA-20261117-TAX, no tax document.
- Demo tax **Advanced mode left ON** (app refuses Basic while inactive rule `QA_20261117` exists) — owner action needed.
- HQ: OM VAT v3 draft **discarded**; OM_VAT v2 still live. QA org `QA-20261117 Catalog Org` has OM_SME applied with Activate off (audit #883). No other org touched.
