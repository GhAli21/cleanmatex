# 10 — HQ (the SaaS Backoffice, `cleanmatexsaas`)

The HQ roadmap file `new_roadmap_09032026/ROADMAP_PRIORITIZED_2026.md` (March 2026) is out of date. For example, it shows Communications & Notifications at 0%, but the Notification Hub is now built. Treat it only as a list of PRD titles.

## What HQ needs on day one of selling

| # | Item | Priority | Evidence | What to do |
|---|---|---|---|---|
| H1 | Commit the 3 uncommitted files. Deploy platform-api and platform-web together. | Blocker | `git status` 16 Nov | — |
| H2 | **Billing collection** (see file 01, B2/B3): the dunning gateway retry and email are TODOs. | Blocker for self-serve | `billing/services/dunning.service.ts` | — |
| H3 | **HQ role matrix and grants** before a second HQ user (file 02, S4). | Blocker | — | — |
| H4 | **Tenant lifecycle**: suspend, reactivate and delete a laundry, and export its data on exit (contract end). Tenant Maintenance has check-and-fix tools and Delete Orders. A full "offboard and export" was not found. | Before public launch | `Tenant_Managment/Tenant_Maintenance/progress_status.md` | Define offboarding: export (CSV/Excel of customers, orders, invoices), then suspend, then delete after the retention period. |
| H5 | Edit Policy page phases 3.1 (Arabic tab direction, phone-width fix) and 5 (Assignment & resolution tab): in the working tree, not deployed. | Blocker (deploy) | `Order_Edit_V2/Edit_Policy_Page_Redesign/STATUS.md` | Deploy, then run its QA guide. |
| H6 | HQ Edit Policy rules for speed, discount and price (file 04, E3); `INIT_MOBILE_RETAIL` on each profile (file 04, W6). | Blocker | — | — |
| H7 | Tax kit facts to verify (file 06, T4); check the kit v2 rollout. | Blocker for BH/OM filing | — | — |
| H8 | Human-Friendly Codes doc-seq console: deploy, then `FINAL_QA_RUNBOOK.md` §8. Proposals P-1 (counter correction) and P-2 (delete the old dialog) wait for approval. | Before public launch | HFC `current_status.md` | — |
| H9 | Products & Items Config QA (file 08, C1). | Before public launch | — | — |
| H10 | `system-codes/code-locking.service.ts` uses a table that does not exist (`hq_code_locks`). The system-codes registry lists dropped tables (`sys_billing_cycle_cd`, …). | Before public launch | POS `REMAINING_WORK.md` HQ section | Remove the dead lock feature and the dropped tables from the registry, so no HQ screen errors. |
| H11 | Old payment-setup cash-drawer table, hooks and endpoints are used only by a route-less screen. | After launch | `Cash_Pos_Catalogs/progress_status.md` | Delete them together. |
| H12 | HQ Workflow Engine: operator soak (file 04, W1). | Before public launch | — | — |
| H13 | Analytics (PRD-0004), Support (0005), Import/Export and migration (0016), Webhooks (0017), Multi-region (0021), Compliance (0023). | After launch / Later | Roadmap | **Import (0016)** matters early: new laundries will want to import their existing customer list and prices. Consider a simple CSV import before public launch. |
