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
