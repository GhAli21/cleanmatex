# 06 — Tax and E-Invoicing

The tax engine is built: kits for OM, SA, AE and BH, rules, VAT return, purchases, foreign-currency purchases, AP and withholding journals. Migrations up to 0735 are applied. Source: `docs/features/Tax_Config/STATUS.md`, `RESUME_CONTINUATION.md`, `followups_by_user.md`.

| # | Item | Priority | What to do |
|---|---|---|---|
| T1 | **Saudi e-invoicing (ZATCA Phase 2: Fatoora integration).** Today only the document layout exists (`lib/payments/adapters/zatca.adapter.ts`: "Live ZATCA submission/clearance, cryptographic stamping, QR/XML signing is a tracked follow-up"). The tax document QR is a generic verification code, not ZATCA's QR format. | **Blocker for any Saudi VAT-registered customer** | Build CSID onboarding, UBL 2.1 XML, signing, hash chain, clearance (B2B) and reporting (B2C), plus the ZATCA QR. Or integrate a certified ZATCA middleware provider. Until then, market outside Saudi Arabia or to non-VAT-registered shops only. |
| T2 | **Other GCC e-invoicing mandates** (UAE, Oman) are being phased in. | Before public launch (check) | Confirm the current go-live dates and thresholds for the UAE and Oman with a tax adviser. If a pilot customer falls in scope, plan the integration. |
| T3 | **Every organization must confirm its tax setup.** Until it does, new orders carry no tax (ADR-061). All 4 demo organizations were unconfirmed on 2026-11-13. | Blocker (per new customer) | Make it step 1 of onboarding (file 01, B9). Setup Health already flags it. |
| T4 | **Facts that still need a person.** Bahrain VAT return lines 1–16 titles (NBR portal). The Oman simplified invoice needs each Oman customer to hold Tax Authority approval (Art. 146–148). The Oman VAT return box codes in some layouts are placeholders. | Blocker for BH and OM customers who file from the system | HQ › Tax Kits › BH return boxes → correct and mark verified. Tell Oman customers about the approval. |
| T5 | **Kit version 2 rollout.** Check that OM/SA/AE/BH organizations moved to kit v2 (nightly update from 2026-11-14), or press "Update kit now". | Before public launch | Then QA 31l–31n. |
| T6 | **Owner QA** 31l–31v: kit v2, purchase reverse charge, HQ rule and class editing, foreign-currency purchases, supplier invoice and payment journals with withholding. Also T3–T8 and the T4 leftovers 31a–31g. | Blocker | `Tax_Config/QA_TEST_GUIDE.md` |
| T7 | **Decisions for a tax adviser**: tax on advances at receipt; expired single-purpose gift card balances; reverse-charge VAT inside the AP total; reverse-charge tax added to "VAT due" on the SA/BH layouts; exports versus domestic zero-rated sales on the return (manual entry). | Before public launch | Book one adviser session and record the answers in `Tax_Config/KIT_FACTS.md`. |
| T8 | Demo organization `11111111…` adds 2% on every order (`LEGACY_05`). | Before go-live | Deactivate it if it was test data (file 13). |
| T9 | Not built: a manual exchange-rate override on purchase documents; reverse-charge purchase rules per country (`VAT_IN_RC` exists, nothing selects it). | After launch | — |
| T10 | Every UAE branch needs its emirate set, or its lines drop out of boxes 1a–1g. | Blocker for UAE customers | Add it to onboarding. |
| T11 | Tax periods: each organization must add its tax periods and close them after filing. | Before public launch | Add it to onboarding. |
