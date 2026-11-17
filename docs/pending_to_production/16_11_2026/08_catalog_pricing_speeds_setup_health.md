# 08 — Catalog, Pricing, Service Speeds and Setup Health

## Service Speeds (S1–S7 complete)

Source: `docs/features/Service_Speeds/followups_by_user.md`.

| # | Item | Priority | What to do |
|---|---|---|---|
| SP1 | Islamic holidays 2026–2027 for OM, SA, AE, BH, QA and KW are **estimated** (`is_estimated = true`). Official dates differ by 1–2 days. | Before public launch, and every year | Confirm them when announced (HQ bulk confirm). Make it a yearly ops task. |
| SP2 | Oman National Day dates (seeded 20–21 Nov, estimated). Is Accession Day (11 Jan) a holiday? It is not seeded. | Before public launch | Confirm and fix. |
| SP3 | Behaviour to tell customers: with a calendar, turnaround hours count as working hours, so ready-by times near closing move to the next opening. | Before public launch | Put it in the user guide or onboarding. |
| SP4 | Retest New Order › Speed menu (Next day, Express, Urgent showed no price or ready time for one tester). | Blocker | If it still happens, save the `POST /api/v1/orders/quote` response. |
| SP5 | Three demo organizations fail `SPEED_NO_EXPRESS`. | Per customer | Onboarding: add an Express rule. |
| SP6 | Decide on a public customer quote API (show price and ready time per speed before booking in the customer app). | After launch | F7 |
| SP7 | QA guide on a demo organization, EN and AR. No screen has been opened in a browser yet. | Blocker | file 12 |

## Setup Health (Plan 2 implemented, 0738 and 0740 applied)

| # | Item | Priority |
|---|---|---|
| SH1 | QA: tenant T1–T16, HQ H1–H21, including Arabic, sign-out, login autofill and load times. | Blocker |
| SH2 | Fix the demo user name "Admin Demo Lanudry" → "Admin Demo Tenant". | Before go-live (file 13) |

Setup Health is your best onboarding tool. Make "all checks green" the definition of a ready Tenant (file 01, B9).

## Catalog and pricing

| # | Item | Priority | Source |
|---|---|---|---|
| C1 | HQ Products & Items Config: QA rows 1–24, the Playwright responsive spec, and grant `catalog.view` / `catalog.manage` to HQ roles. | Before public launch | Line-Level follow-ups §5 |
| C2 | Business-type templates (`sys_business_type_template_cf`) seed a new Tenant's products. Check that the templates for your target segments (Tenant, dry clean, carpets, retail) have good EN/AR names and sensible default prices. | Blocker | First-run quality decides the first impression. |
| C3 | One PIECE-level organization end to end (Commercial level = Per piece). | Before public launch | Line-Level follow-ups §1 |
| C4 | Speed Pricing screen never opened in a browser. | Blocker | Line-Level follow-ups §1 |
