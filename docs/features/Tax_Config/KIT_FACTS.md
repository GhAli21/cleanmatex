# Tax Kit Facts — sources for the kit seeds

**Checked:** 2026-11-07 · **Used by:** M2 (rates, thresholds, invoice kinds) and M7 (return boxes), [TAX_ENGINE_PLAN.md §6.1](TAX_ENGINE_PLAN.md).
Every seeded value cites its row here in the SQL comment. Each fact has a **confidence**:

- **Official** — read on the tax authority's own site or document.
- **Consistent** — several professional sources agree, official text not opened.
- **Expected** — expert knowledge of GCC VAT practice; seeded with `is_verified = false` and listed for HQ review in Setup Health before the kit is published.

## 1. Rates and registration

| Country | Standard rate (from) | Must register above | May register above | Confidence | Source |
|---|---|---|---|---|---|
| OM | 5% (2021-04-16; VAT Law RD 121/2020, Exec. Regs RD 53/2021) | OMR 38,500 | OMR 19,250 | Official | [Tax Authority — thresholds decision](https://tms.taxoman.gov.om/portal/documents/20126/1414820/Determining+the+Mandatory+and+Voluntary+Registration+Thresholds.pdf/4c5d8dcb-5b81-34ae-a1d2-e3c6d8431988?t=1733169610184), [Tax Authority — tax rate](https://tms.taxoman.gov.om/portal/tax-rate), [Tax Authority — VAT FAQs](https://tms.taxoman.gov.om/portal/vat-faqs); start date from the [Tax Authority real-estate guide](https://tms.taxoman.gov.om/portal/documents/20126/1414820/Taxpayer+Manual+Guide+of+Real+Estate.pdf/06ee6dc8-2732-aceb-3ce7-9f8954c44b81?t=1733169611885) |
| SA | 15% (2020-07-01; 5% from 2018-01-01) | SAR 375,000 | SAR 187,500 | Official | [ZATCA FAQ 024](https://zatca.gov.sa/en/HelpCenter/FAQs/Pages/FAQ_024.aspx) |
| AE | 5% (2018-01-01) | AED 375,000 | AED 187,500 | Official | [FTA — Registration for VAT](https://tax.gov.ae/en/taxes/vat/vat.topics/registration.for.vat.aspx) |
| BH | 10% (2022-01-01; 5% from 2019-01-01) | BHD 37,500 | BHD 18,750 | Official | [NBR — VAT registration](https://www.nbr.gov.bh/vat_registration), [NBR — VAT treatments](https://www.nbr.gov.bh/VAT/vat_treatments_and_policies) |
| QA, KW | no VAT in force | — | — | Consistent | GCC VAT Agreement signed, not implemented → "no VAT" kits |
| GENERIC | tenant enters the rate | — | — | — | never marked verified |

Laundry, dry-cleaning, pressing and alteration are standard-rated in OM, SA, AE and BH: none appear on the zero-rated or exempt lists (Official: [OM tax-rate page](https://tms.taxoman.gov.om/portal/tax-rate) lists zero and exempt categories).

## 2. Invoice kinds (seeded on starter-package triggers)

| Country | Simplified (short) tax invoice allowed when | Otherwise | Confidence | Source |
|---|---|---|---|---|
| SA | customer is a consumer (B2C), any amount; or B2B supply below SAR 1,000 | full tax invoice | Consistent (B2B < SAR 1,000); Expected (B2C any amount, per ZATCA e-invoicing rules) | [Tally — KSA invoice types](https://tallysolutions.com/mena/sa/invoice-type-vat-saudi-arabia/) |
| AE | customer not VAT-registered (any amount); or registered customer and value ≤ AED 10,000 | full tax invoice | Consistent | [Meydan FZ — UAE tax invoice requirements](https://www.meydanfz.ae/blog/uae-tax-invoice-requirements), [Mondaq — tax invoice under UAE VAT law](https://webiis08.mondaq.com/sales-taxes-vat-gst/670546/tax-invoice-under-uae-vat-law) |
| BH | customer not VAT-registered; or value below BHD 500 | full tax invoice | Consistent | [Tally — Bahrain simplified invoice](https://tallysolutions.com/mena/bahrain-vat/simplified-tax-invoice-format-bahrain/) |
| OM | customer not VAT-registered (retail) | full tax invoice for registered customers | Expected | no source found; follows the common GCC pattern. HQ to confirm against the Executive Regulations |

Seed consequence: every VAT starter package issues a **simplified** invoice on order submit for consumers, and a **full** tax invoice when the customer's party class is `BUSINESS_REGISTERED` (above the country limit where one exists). The limit is a typed column on the kit (`simplified_max_amount`, NULL = no limit).

## 3. VAT return boxes (seeded in M7)

All layouts below are seeded with `is_verified = false` until HQ checks each against the authority's current form; the categories are reliable, exact numbering is the part to confirm.

**SA (ZATCA, 16 fields) — Expected numbering, Consistent categories** ([Zoho KSA return contents](https://www.zoho.com/sa/books/vat/faq/vat-returns/contents-return-form.html), [Tally sample form](https://tallysolutions.com/mena/wp-content/uploads/2018/vat/VAT%20Return.pdf), [Wafeq](https://www.wafeq.com/en-sa/tax-and-reporting/how-to-file-a-vat-return-in-saudi-arabia-online)):
1 standard-rated sales · 2 private healthcare / education to citizens · 3 zero-rated domestic sales · 4 exports · 5 exempt sales · 6 total sales · 7 standard-rated domestic purchases · 8 imports, VAT paid at customs · 9 imports, reverse charge · 10 zero-rated purchases · 11 exempt purchases · 12 total purchases · 13 VAT due for the period · 14 corrections from previous periods · 15 credit carried forward · 16 net VAT due.

**AE (FTA VAT 201) — Consistent** ([Zoho UAE return](https://www.zoho.com/ae/books/vat/guides/vat-returns-uae.html), [ERPNext UAE VAT 201](https://docs.frappe.io/erpnext/uae-vat-201-and-saudi-zatca-questions), [Tally UAE returns](https://help.tallysolutions.com/docs/te9rel66/Tax_International/GCC_VAT/file_uae_vat_returns.htm)):
1a–1g standard-rated supplies per emirate (Abu Dhabi, Dubai, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, Fujairah) · 2 tourist refunds · 3 supplies under reverse charge · 4 zero-rated · 5 exempt · 6 goods imported · 7 import adjustments · 8 totals · 9 standard-rated expenses · 10 reverse-charge input · 11 totals · 12 total tax due · 13 total recoverable tax · 14 payable tax.
**Consequence:** UAE sales must be split by emirate → `org_branches_mst.emirate_code` (typed, CHECK of the 7 codes, required when branch country = AE) added in M3; the tax line stores the branch, so the return groups by it.

**BH (NBR) — Consistent categories, Expected numbering** ([Zoho Bahrain returns](https://www.zoho.com/bh/books/vat/guides/vat-returns-bahrain.html), [Tally Bahrain returns](https://help.tallysolutions.com/docs/te9rel65/Tax_International/GCC_VAT/file_bahrain_vat_returns.htm)):
1 standard-rated sales · 2 sales to registered customers in other GCC states · 3 sales under domestic reverse charge · 4 zero-rated domestic sales · 5 exports · 6 exempt sales · 7 total sales · 8 standard-rated domestic purchases · 9 imports, VAT paid at customs · 10 imports, reverse charge · 11 purchases under domestic reverse charge · 12 purchases from non-registered suppliers / zero-rated / exempt · 13 total purchases · 14 VAT due · 15 corrections · 16 credit carried forward · 17 net VAT due.

**OM (Tax Authority) — Consistent categories only** ([Tax Authority — VAT Return Filing guide](https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409), [Deloitte — Oman return guidance](https://www.deloitte.com/middle-east/en/services/tax/perspectives/vat-return-filing-guidance-has-been-released.html), [Topnotepad Oman returns](https://topnotepad.com/om/oman-vat-returns)):
sales at 5% · sales at 0% · exempt sales · exports (GCC / non-GCC) · purchases under reverse charge · imports (customs paid / deferred) · input VAT on purchases · input VAT on imports · net VAT due. Box numbers seeded as `1a…` placeholders, `is_verified = false`; HQ reads them from the official PDF before publishing the OM kit.

## 4. Expert treatments for laundries (seeded as kit rules)

| Case | Treatment | Confidence |
|---|---|---|
| Laundry / dry-cleaning / pressing / alteration service | standard rate | Official (not on any relief list) |
| Delivery / pickup fee charged with the service | same treatment as the main service (one composite supply) | Expected (general GCC VAT principle) |
| Sale of goods (detergent, hangers, bags) | standard rate | Expected |
| Tips given voluntarily to staff | out of scope | Expected |
| Cash rounding difference | out of scope | Expected |
| Advance / deposit received before the service | tax point at receipt for the received amount (`tax_on_advance = true` in all four VAT kits) | Expected (GCC tax-point rules) |
| Gift card / prepaid credit usable only for this laundry's services | single-purpose: tax at issue (SPV); multi-purpose or cash-refundable: tax at redemption (MPV). Kit default **MPV** (never taxes twice, never taxes money that may be refunded); tenant can switch per card program | Expected |
| Discount given before / at the sale | reduces the taxable amount | Expected |
| Bad debt, write-off | no automatic tax change (needs a credit note) | Expected |
| Not VAT-registered business (`NOT_VAT_REGISTERED` segment) | charges no VAT, issues no tax invoice, receipt only | Official (below threshold cannot / need not register: SA, BH stated) |

## 5. Still to confirm — tracked in [followups_by_user.md](followups_by_user.md) F1–F6 (shown to HQ in Setup Health as `TAX_KIT_FACT_UNVERIFIED`)

- Exact return box numbers: SA, BH, OM.
- Oman simplified-invoice conditions.
- KSA B2C simplified invoice for any amount (current ZATCA e-invoicing rule).
- Voucher (SPV/MPV) rules per country.

## 6. Results of the 2026-11-12 check (applied by `0728`)

| Fact | Result | Confidence | Source |
|---|---|---|---|
| OM return boxes | 1a–1f, 2a–2b, 3a, 4a–4b, 5a = 1a+1f+2a+2b+4a, 5b, 6a–6d, 7a = 5a+5b, 7b = 6a+6b+6c+6d, 7c = 7a−7b; 1d, 1e, 2a not activated until the GCC rules apply | Official | [Tax Authority — VAT Return Filing guide, June 2021](https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT+Taxpayer+Guide+-+VAT+Return+Filing.pdf/fae31d0c-e7e7-0014-9f28-a4c506b36614?t=1733169613409) |
| OM simplified invoice | Tax Authority approval; supply value < OMR 500 excl. VAT; full invoice when the customer asks | Official (unofficial English translation of the regulation) | [Executive Regulations 53/2021, Art. 146–149](https://mzv.gov.cz/public/aa/7/49/4259098_2607346_VAT_Regulation_unofficial_english_version.pdf) |
| OM vouchers | Single-purpose: tax at issue and each resale, none at redemption; multi-purpose: tax at redemption (Art. 33–34, value Art. 36) | Official (translation) | same |
| SA return boxes | 1 standard sales · 2 private healthcare / education / first house to citizens · 3 zero-rated domestic · 4 exports · 5 exempt · 6 total sales · 7 standard domestic purchases · 8 imports VAT paid at customs · 9 imports reverse charge · 10 zero-rated purchases · 11 exempt purchases · 12 total purchases · 13 VAT due · 14 corrections (±SAR 5,000) · 15 credit carried forward · 16 net VAT due | Consistent (portal form copy) | [GAZT portal form copy](https://tallysolutions.com/mena/wp-content/uploads/2018/vat/VAT%20Return.pdf) |
| SA simplified invoice | B2C any amount | Official | [ZATCA E-Invoicing Detailed Guidelines](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf) |
| SA vouchers | Issue of a face-value voucher is not a supply; VAT at redemption; amount paid above face value taxed at issue → kit MPV | Official | [ZATCA VAT Implementing Regulations (EN)](https://zatca.gov.sa/en/RulesRegulations/Taxes/Documents/Implmenting%20Regulations%20of%20the%20VAT%20Law_EN.pdf) |
| AE vouchers | Supplied when issued (Decree-Law 8/2017); Executive Regulation Art. 28 vouchers → laundry's own card SPV | Consistent | [Decree-Law 8/2017](https://tax.gov.ae/DataFolder/Files/Pdf/VAT-Decree-Law-No-8-of-2017.pdf), [Cabinet Resolution 52/2017](https://uaelegislation.gov.ae/en/legislations/1226/download) |
| BH vouchers | Redeemable at one VAT rate → single-purpose, supply at issue | Official (NBR guide) | [NBR VAT Retail and Wholesale Guide v1.2](https://s3-me-south-1.amazonaws.com/nbrproduserdata-bh/media/iSEc2JU8NaNKMwggqtL7DNV7aWC4d0ZZ3CuRZt6a.pdf) |
| BH return | 17 lines, line 17 = net VAT (positive payable, negative refundable); titles of lines 1–16 not printed as text in the manual | Official (line 17 only) | NBR VAT Return Filing Manual v1.2 (updated 27 Feb 2025) |

**Laundry consequence:** a laundry's own prepaid gift card (usable only for its own standard-rated services) is single-purpose in OM, BH and AE, so VAT is charged when the card is **sold**; in SA it is charged when the card is **used**. The kit sets this default (`voucher_tax_mode`); the cashier can still choose per card.
