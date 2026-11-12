# Tax Engine — Follow-ups for the owner / HQ

Items a person must do; the code cannot settle them. Facts and sources: [KIT_FACTS.md](KIT_FACTS.md). Status: [STATUS.md](STATUS.md).

## Before publishing the OM, SA and BH kits (verify facts seeded with `is_verified = false`)

| # | Item | Where to check | Then |
|---|---|---|---|
| F1 | Exact VAT return box numbers — Saudi Arabia (16 boxes) | ZATCA portal, current VAT return form | HQ › Tax Packs & Kits › SA kit › return boxes: correct numbers, mark verified |
| F2 | Exact VAT return box numbers — Bahrain (17 boxes) | NBR portal, current VAT return form | same for BH kit |
| F3 | Exact VAT return box numbers — Oman | [Tax Authority VAT Return Filing guide (PDF)](https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409) | replace the `1a…` placeholders, mark verified |
| F4 | Oman simplified tax invoice conditions (who / up to what amount) | Oman VAT Executive Regulations (RD 53/2021) or a local tax adviser | set OM kit `simplified_max_amount` + mark verified |
| F5 | Saudi Arabia: simplified invoice to consumers for any amount (current ZATCA e-invoicing rule) | ZATCA e-invoicing rules | confirm SA kit rule, mark verified |
| F6 | Gift card / voucher tax timing per country (tax at issue vs at redemption) | each authority's voucher guidance or a tax adviser | confirm kit default (MPV = tax at redemption) or change per country |

Until each item is done, HQ Setup Health shows `TAX_KIT_FACT_UNVERIFIED` for that kit.

## Waiting for you



- From 2026-11-14: check that organizations on OM/SA/AE/BH moved to kit version 2 (nightly kit update), or press HQ › organization › Tax kit › Update kit now. Then QA 31l–31n.

- Bahrain: log in to the NBR portal, compare VAT return lines 1–16 with HQ › Tax Kits › BH return boxes, correct any title, mark them verified (the last open fact; line 17 is already verified).
- Oman organizations: a simplified tax invoice needs the Tax Authority's approval (Executive Regulations Art. 146–148). Each Oman customer must apply for it before using simplified invoices.

- Done 2026-11-12: `0727_tax_drop_legacy_columns.sql` applied. It drops `org_tax_profiles_cf.applies_to`, `org_tax_profiles_cf.is_default` and `org_product_data_mst.tax_supply_code` and re-creates `fn_tax_kit_apply` without them. `schema.prisma` already has the fields removed; after applying, run `npm run prisma:pull` and regenerate types in both repos.

## After each migration

- Apply the migration (local + remote), run `npm run prisma:pull`, regenerate types in both repos, then reply so the next step can start.

## Testing

- Run the scenarios in [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) for T3–T8, including the T4 leftovers (31a–31g).

## Decisions to check

- Demo organization `11111111…` charges an extra 2% on every order (old profile `LEGACY_05`). `0722` keeps it as a rule code so nothing changes on confirmation. If that 2% was only test data, deactivate it in Advanced mode › Tax rules.
- Until an organization confirms its tax setup, its new orders carry no tax (ADR-061). All 4 organizations are waiting for confirmation today.
- Supplier withholding: every kit's withholding rule is 0% (`WHT_NONE`). After T7 a real rate is recorded on the payment (cash paid = amount − withheld) and on the return; ERP-Lite does not post supplier payments to the ledger at all, so the withheld liability is not journalled.
- Foreign-currency purchases cannot be taxed yet: ERP-Lite records no exchange rate. Decide whether ERP-Lite should store a rate, then the limit can go.
- No kit has a reverse-charge purchase rule (foreign supplier of services). `VAT_IN_RC` exists but nothing selects it; add rules per country after checking the law.
- Advances are taxed when received (kits OM/SA/AE/BH `tax_on_advance = true`). Confirm with a tax adviser whether a checkout overpayment kept as advance should be taxed at receipt in each country (T6 taxes it).
- Gift cards default to Multi-purpose (tax when used). Choose Single-purpose at sale only for cards usable just for your own services (F6).
- A single-purpose card's unused balance that expires keeps its sale tax (no reversal). Confirm the treatment of expired balances per country.
- Map the **Input VAT** account in ERP-Lite (usage `VAT_INPUT`) before using the tax engine on expenses: expense postings now debit it with the recoverable tax.
- Add your first tax periods (Settings › Tax Setup › Tax periods) to match your filing frequency, and close each one after filing.
- VAT return boxes (T7) are all marked "to confirm": check each layout against the authority's current form before filing (SA/BH/OM numbering, OM box codes are placeholders).
- The return cannot tell exports from domestic zero-rated sales (both are "zero-rated" lines); the export boxes stay for manual entry on the portal. Same for imports and tourist refunds.
- Reverse-charge tax due is added to "VAT due" on the SA, BH and generic layouts (their forms have no separate box for it). Confirm with a tax adviser.
- UAE: a branch without an emirate is left out of boxes 1a–1g; the report lists those lines under "not on the return". Set the emirate on every UAE branch.
- Kit drafts copy rules and item classes as they are; editing those in a draft is not built yet. Decide whether HQ needs it (rate changes, names and examples are editable).
- A data-fix migration that must change a published kit has to `SET LOCAL app.tax_kit_seed = 'on'` (published kits are locked).
