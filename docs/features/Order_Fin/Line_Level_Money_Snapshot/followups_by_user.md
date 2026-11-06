# Line-Level Money Snapshot — follow-ups for the owner

**As of:** 2026-11-07 · Code, migrations, docs and automated proofs are done ([STATUS.md](STATUS.md)). These items need you.

## 1. QA (click-through)

- [ ] Run every scenario in `F:\jhapp\cleanmatex\docs\features\Order_Fin\Line_Level_Money_Snapshot\QA_TEST_GUIDE.md` (Arabic too).
- [ ] Open the Speed Pricing screen in a browser: sidebar Catalog & Pricing › Speed Pricing, `http://localhost:3000/dashboard/catalog/speed-pricing` (add, edit, deactivate a rule; "Which rule applies?"). It was never run in a browser.
- [ ] One PIECE organization: set Commercial level = Per piece in HQ (tenant › Tax & Pricing), create an order with a piece on Express and a piece discount, then edit it.

## 2. HQ configuration (`cleanmatexsaas`, the SaaS Backoffice)

- [ ] **Edit policy rules**, per workflow profile (Order Change › Edit Policies → new draft version → publish): allow or warn for `CHANGE_SERVICE_SPEED` on `ITEM` and `PIECE`, `CHANGE_DISCOUNT` on `ITEM` and `PIECE`, `CHANGE_ITEM_PRICE` on `ITEM`. Until then those Edit controls stay disabled with their reason.
- [ ] **Workflow profiles:** add catalog rule `INIT_MOBILE_RETAIL` (create preset `RETAIL_SOLD`) to each profile (new draft → publish). Until then online retail starts at `intake`.

## 3. Commit

- [ ] Tenant repo `F:\jhapp\cleanmatex` and HQ repo `F:\jhapp\cleanmatexsaas` together (HQ screens no longer read the dropped product columns).
- [ ] New in this stretch (tenant): `supabase/migrations/0702_oc_committed_column_guard.sql` (applied), `web-admin/lib/services/order-change/order-change-settlement-fingerprint.ts`, `web-admin/__tests__/db-integration/order-committed-column-guard.db.test.ts`, `order-change-settlement-race.db.test.ts`, `web-admin/__tests__/tenant-isolation/order-edit-tenant-predicate-scan.test.ts`, this folder's README / guides / CHANGELOG / version.
- [ ] Deleted (tenant): `app/api/v1/pricing/calculate/route.ts`, `lib/services/pricing.service.ts`, `lib/services/order-calculation.service.ts`, `lib/services/tax.service.ts` and their tests.
- [ ] Not from these plans, check before committing: `supabase/migrations/0701_hq_navigation_cd.sql`, `0703_stock_transaction_hfc.sql`, `0704_hq_nav_seed_registry_screen.sql` (untracked; confirm each is applied), the Human_Friendly_Codes docs, label and receipt files, and the deleted `web-admin/messages/ar/labels.json`.

## 4. Known red tests owned by other work

- `web-admin/__tests__/auth/platform-inventories.test.ts` — 6 navigation-vs-contract drifts (delivery, catalog preferences, roles, permissions, payment settings).
- `web-admin/__tests__/features/receipts/receipt-page.test.tsx`, `__tests__/services/labels/label-data.service.test.ts`, `__tests__/features/orders/order-receipt-print-barcode.test.tsx` (type errors) — in-progress receipt / label work.
- `web-admin/__tests__/services/overpayment-disposition.wallet.test.ts` — its mock lacks `findMany` (since P8).
- Local DB only: `__tests__/db-integration/wf-policy-issue-catalog-seed-invariants.db.test.ts` — the local SIMPLE v2 published version has no stage sequence (data drift; remote not affected).

## 5. HQ Products & Items Config (built alongside, same session)

- [ ] QA: `F:\jhapp\cleanmatexsaas\docs\features\Products_Items_Config\QA_TEST_GUIDE.md` (rows 1–24).
- [ ] Playwright: from `F:\jhapp\cleanmatexsaas\platform-web` run `npx playwright test e2e/products-items-config-responsive.spec.ts` with an HQ session.
- [ ] Give HQ roles that manage products `catalog.view` / `catalog.manage`.
