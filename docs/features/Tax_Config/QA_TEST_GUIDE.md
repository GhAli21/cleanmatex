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
