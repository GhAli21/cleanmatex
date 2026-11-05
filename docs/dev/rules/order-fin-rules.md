# Order Fin rules (canonical)

Applies to any work that reads, shows or calculates an order's money: views,
reports, prints, APIs, the payment modal, Order Edit, the customer app. The
skill `/order-fin` (`.claude/skills/order-fin/SKILL.md`) is the working guide;
this file is the rule text. Background: `docs/features/Order_Fin/Reusable_Order_Fin_View/` (PLAN, DESIGN, STATUS).

## 1. One source of truth

1. **The snapshot on `org_orders_mst` is the source of truth** for an order's figures (total, paid, credits, balance, overpaid, refunded, tax, discount). It is written only by the snapshot writer (`recalculateOrderFinancialSnapshotTx`, `lib/services/order-financial-write.service.ts`).
2. **One commercial calculator.** Create, the New Order quote, the payment quote, Order Edit Preview, Apply and the live Edit quote all price through `lib/commercial` (`quoteCheckout`, `quoteOrderEdit`). Never add a second calculator or a client-side estimate.
3. **One outstanding formula** (D005): `computeOutstanding` / `aggregateOrderFinancials` in `lib/services/order-financial-aggregation.ts`. Reconciliation and view warnings call the same functions.
4. **No UI arithmetic on money.** The browser and the mobile app show server figures; they never add, subtract or derive a total, balance or delta. (Formatting is not arithmetic.)
5. **On edit, re-price the commercial side and keep the settlement side.** Payments, credits and refunds are facts; an edit never moves them.
6. **Cash rounding is a payment concern.** Order, tax and invoice totals are exact to the currency's decimals (`ACCOUNTING` rules = one minor unit, DB CHECK `chk_scrr_acct_minor_unit`); only the change on a cash tender is rounded (`CASH_CHANGE` / `CASH_TENDER`, `cash-change-rounding.service.ts`).

## 2. Reading and showing money

7. **Reuse `OrderFinancialView`** (`src/features/orders/order-fin-view/ui/order-financial-view.tsx`) for every money display; never build a new financial panel. Lists use the batch header reader (`useOrderFinancialHeaders` → `POST /api/v1/orders/financial-headers`), never one request per row.
8. **Builders take normalized section input only** (`OrderFinSourceSet`), never DB rows. New data goes through a source loader + `normalize.ts`.
9. **Visible but not counted:** voided, failed, reversed and pending rows are shown (struck or muted, "not counted") and never summed (`countsInTotal`).
10. **Line roles (§6.6):** only `additive` money lines go in the amount column. Included parts (extras, speed premium, tax-inclusive tax), informational amounts (document totals, voucher face values, was → now deltas) and points go in the line text. **Points are never summed or formatted as money.**
11. **One meaning per header metric** (D31); the hero carries a word ("Due", "Due at collection", "Settled", "Overpaid"), never color alone. The badge says **"Reconciled"**, never "Balanced" (D32).
12. **No money on the Review button** (D33); the Edit live card is the only total in Order Edit.
13. **Currency and decimals come from the order** (`currency_code` + `sys_currency_cd.minor_unit`, BF-18/B15), never the tenant default and never hardcoded. Unknown currency is said ("Currency unknown"), never guessed. Comparisons use the shared tolerance constants.
14. **Money fallbacks use `??`, never `||`** (0 is a real amount).
15. **A snapshot never written shows "Financial data unavailable", never zeros.**

## 3. Security and tenancy

16. **Tenant from the session only** (staff), from the token (public tracking) or from the verified customer session (portal); never from input.
17. **Every `org_*` query filters `tenant_org_id` explicitly**, joins included (CLAUDE.md rule #4).
18. **Public data only through the server allowlist projection** (`projectOrderFinancialViewForPublic`). A browser preset is never the boundary. Public routes answer one uniform 404 for every refusal; the portal matches tenant **and** customer.
19. **No section permission tiers** (D10): the entry point decides (`orders:read`); the component and builders hold no permission logic.
20. **No maker-checker:** the permission is the only gate; the same user may act.
21. The AR link goes through `org_invoice_orders_dtl` (the order's own share), never the whole invoice.

## 4. Writing money

22. **No silent money mutation** (CLAUDE.md #15, `no-silent-money-mutation.md`).
23. **Invalidate after every money write:** `useOrderMoneyRefresh(orderId)` (router refresh + `invalidateOrderFinancial`) after payment, refund, charge void, tax-document issue, AR collection, edit apply.
24. **Constants mirror DB values** exactly (CLAUDE.md #12): statuses, codes, outcomes (`OrderChangeFinancialOutcome` as the service emits it).

## 5. Tests

25. **Golden-fixture tests are required** for any change to a writer, the aggregation or the view: the view's figures = the writer's snapshot = the reconciliation rules (`order-fin-view-sources.db.test.ts`), and the statement adds up (`statement-identity.test.ts`). Edit changes keep the parity proof green (`order-change-edit-parity.db.test.ts`: card = Review = saved after Apply).
