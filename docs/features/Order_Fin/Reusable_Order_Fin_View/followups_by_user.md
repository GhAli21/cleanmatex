# Reusable Order Financial View — follow-ups for the owner

**As of:** 2026-11-07 · Engineering complete (P0–P9); the three open findings were closed on 2026-11-07 ([STATUS.md](STATUS.md)). These items need you.

## 1. QA (click-through)

- [ ] Run every scenario in `F:\jhapp\cleanmatex\docs\features\Order_Fin\Reusable_Order_Fin_View\QA_TEST_GUIDE.md` (order detail, full page, prints, ready, delivery, workspace, collect payment, AR invoice, payment modal, Order Edit live card, public tracking, customer app; Arabic too).
- [ ] New since the guide: an Order Edit on a cash order paid with change (e.g. 20 on 15, 5 handed back) — the live card shows Settled, not Overpaid.

## 2. Live end-to-end run

- [ ] From `F:\jhapp\cleanmatex\web-admin` run:

  ```bash
  E2E_LOGIN_EMAIL=<staff email> E2E_LOGIN_PASSWORD=<password> E2E_FIN_ORDER_ID=<an order id> npx playwright test e2e/order-financial-view.spec.ts
  ```

  Spec: `F:\jhapp\cleanmatex\web-admin\e2e\order-financial-view.spec.ts`.

## 3. Mobile

- [ ] Customer app (`cmx_mobile_apps/apps/customer_app`): open an order's payment summary (P6-12) on a device.

## 4. Commit

- [ ] Commit with the Line-Level changes (same files: `lib/services/order-change/order-change-preview-reads.ts`, `order-change-preview.service.ts`, `lib/services/order-financial-aggregation.ts`, `order-financial-write.service.ts`, and their tests).
