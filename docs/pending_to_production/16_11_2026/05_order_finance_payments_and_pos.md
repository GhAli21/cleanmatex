# 05 — Order Finance, Payments and POS

Engineering is largely complete across the Order Fin programs: remediation work packages, Line-Level Money Snapshot, the Reusable Order Fin View, POS and cash drawer hardening, and collect payment. What is left is mainly QA, plus two real capability gaps (P1, P2).

| # | Item | Priority | Evidence | What to do |
|---|---|---|---|---|
| P1 | **No real online payment gateway.** `getGatewayAdapter()` returns one generic HMAC adapter for every gateway type. The comment says "none of the three named vendors has a real integration". Card payments today are recorded manually (an external terminal, with the cashier entering the result). | Blocker for online or app payments; OK for counter-only pilots | `web-admin/lib/services/gateway/gateway-webhook-adapter.ts:141-150` | Pick the GCC gateway(s) for your first markets (for example Thawani/Tap in Oman, HyperPay/Moyasar/Tap in Saudi Arabia, Network/Tap in the UAE). Build its adapter, checkout session and refund call. Run sandbox, then live. |
| P2 | **Settlement automation (B12)** was skipped by the owner; settlements use a manual Payments-tab redirect. | After launch | Remediation RESUME 2026-09-17 | Revisit when a gateway exists (P1). |
| P3 | Tax-document **Cancel / Supersede UI** is not built. Cancelling has no service, and the database immutability trigger blocks it. | Before public launch (Saudi); After launch elsewhere | Remediation RESUME B14 addendum | Design a credit note or supersede flow (ties to file 06). |
| P4 | **QA, Order Fin View**: every scenario in `Reusable_Order_Fin_View/QA_TEST_GUIDE.md`, plus the live Playwright run `e2e/order-financial-view.spec.ts`, plus the customer-app payment summary on a device. | Blocker | Fin View `followups_by_user.md` | See file 12. |
| P5 | **QA, Line-Level Money Snapshot**: every scenario, including Speed Pricing (never opened in a browser) and one PIECE-level organization. | Blocker | Line-Level `followups_by_user.md` | See file 12. |
| P6 | **QA, POS and cash drawer** §13–§19. Force-close the two stuck CLOSING sessions (drawers ac312993 / 65546cc7). | Blocker | POS `REMAINING_WORK.md` | See files 12 and 13. |
| P7 | **QA, cash rounding and change** (2026-11-13 fixes): rounded change in every dialog; cash prefill only when coins can pay the amount. | Blocker | Order Edit follow-ups "Fixed 2026-11-13" | See file 12. |
| P8 | Dead switch on Cash Control Settings: `cashDropRequiresDest` is saved but read by nothing. | Before public launch | POS optional #9 | Hide it, or drop the column in a new migration. |
| P9 | `schema.prisma` has reverted by itself before (losing `org_cash_drawer_transit_tr` and `timezone_code`). | Before public launch | POS RESUME | Check it after every `prisma:pull`. |
| P10 | Remaining remediation QA: §20.21–20.25 (loyalty FIFO), §24 (charge void), §26.11–26.13 (tax doc print), §30.2 reverse voucher retest. | Before public launch | Remediation RESUME 2026-09-17 | See file 12. |
| P11 | Z-report archive has no sidebar entry; it is reached by a button on POS Sessions. | After launch | POS optional #6 | Navigation dual-write if wanted. |
| P12 | ERP-Lite (GL, AP, expenses, bank reconciliation) is complete per its tracker (phases 0–10). Before using it with tax: map the Input VAT account (`VAT_INPUT`), plus `WHT_PAYABLE` and `AP_CONTROL` if suppliers have withholding. | Before public launch for organizations that use ERP-Lite | Tax `followups_by_user.md` | Add it to the onboarding checklist (file 01, B9). |
