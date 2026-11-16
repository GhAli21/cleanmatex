# 12 — Manual QA Backlog (everything still owed, one list)

Most programs passed automated checks (type check, lint, unit and DB tests, build) but **were never opened in a real browser**. That is the single biggest risk before customers. Run these on the deployed staging environment, in **English and Arabic**, on desktop and tablet width.

| # | Program | Guide | Scope | Priority |
|---|---|---|---|---|
| Q1 | New laundry from zero (new) | — (write it, file 01 B9) | Sign-up → setup → first order → payment → receipt → ready → delivered | Blocker |
| Q2 | Order Edit V2 | `Order_Edit_V2/.../Manual_UI_Test_Guide.md` + `followups_by_user.md` | MAN-UI-001–014, line controls, "Fixed 2026-11-13" list | Blocker |
| Q3 | Reusable Order Fin View | `Order_Fin/Reusable_Order_Fin_View/QA_TEST_GUIDE.md` + `e2e/order-financial-view.spec.ts` | Order detail, prints, ready, delivery, collect payment, AR invoice, payment modal, Edit live card, public tracking | Blocker |
| Q4 | Line-Level Money Snapshot | `Order_Fin/Line_Level_Money_Snapshot/QA_TEST_GUIDE.md` | All, plus Speed Pricing and a PIECE organization | Blocker |
| Q5 | POS and cash drawer | `Order_Fin/POS_Session_Cash_Drawer_Hardening/QA_TEST_GUIDE.md` | §13–§19 | Blocker |
| Q6 | Order Fin remediation leftovers | `Order_Fin/Remediation_Work_Packages/QA_TEST_GUIDE.md` | §20.21–20.25, §24, §26.11–26.13, §30.2 | Before public launch |
| Q7 | Tax engine | `Tax_Config/QA_TEST_GUIDE.md` | T3–T8, 31a–31g, 31l–31v | Blocker |
| Q8 | Service Speeds | `Service_Speeds/QA_TEST_GUIDE.md` | All, plus the Speed menu retest (F9) | Blocker |
| Q9 | Setup Health | `Setup_Health/QA_TEST_GUIDE.md` | Tenant T1–T16, HQ H1–H21 | Blocker |
| Q10 | User sessions and passwords | `User_Session_Lifecycle/QA_TEST_GUIDE.md` | Phases 0–5, §6.1–6.21, HQ H.1–H.8 | Blocker |
| Q11 | Human-Friendly Codes | `Human_Friendly_Codes/QA_TEST_GUIDE.md`, `FINAL_QA_RUNBOOK.md` | S1, S4, S13–S17; hardware S7/S8; S19; S20; HQ §8 | Blocker (S1–S17, S7/S8) |
| Q12 | Notifications and ops console | `Platform_Operations_Console/qa_test_guide.md` | T18, T19, T22, T23, T42, read-only role, PDT1–PDT33, then the staging rows | Blocker |
| Q13 | HQ Edit Policy page | `cleanmatexsaas/docs/features/Order_Edit_V2/Edit_Policy_Page_Redesign/QA_TEST_GUIDE.md` | All, after deploy | Before public launch |
| Q14 | HQ Products & Items Config | `cleanmatexsaas/docs/features/Products_Items_Config/QA_TEST_GUIDE.md` | Rows 1–24 + Playwright | Before public launch |
| Q15 | Rack & Bags | `Rack_And_Bags/testing_guide_and_scenarios.md` | All | Before public launch |
| Q16 | API route auth hardening | `API_Route_Auth_Hardening/STATUS.md` scenarios | All | Before public launch |
| Q17 | Edit Policy extension | `Order_Edit_V2/.../Extend_Order_Edit_policy_Plan.md` §11.4 | 7 steps | Before public launch |
| Q18 | Customer app | — | Payment summary, booking on a device | Before mobile launch |
| Q19 | Arabic copy review by a native speaker | All screens above; ops, security and tax screens especially | — | Before public launch |
| Q20 | Real hardware at the pilot store | — | Thermal receipt, label printer, barcode or QR scanner, cash drawer kick, tablet | Blocker |

**Tip:** QA guides are written for a tester bot as well as for people. You can run Q2–Q16 with the browser bot that already ran the HQ reports, then do Q1, Q19 and Q20 yourself.
