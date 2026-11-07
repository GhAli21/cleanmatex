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

## After each migration

- Apply the migration (local + remote), run `npm run prisma:pull`, regenerate types in both repos, then reply so the next step can start.
