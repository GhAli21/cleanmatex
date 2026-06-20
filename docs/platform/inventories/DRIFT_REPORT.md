# DRIFT REPORT

> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.

Generated: 2026-06-20T08:04:04.177Z

## Summary

| Metric | Count |
| --- | --- |
| Total drift items | 9 |
| Errors | 0 |
| Warnings | 9 |
| Known exceptions (suppressed) | 9 |
| New drift (not in allowlist) | 0 |

## Known exceptions (suppressed)

| ID | Severity | Kind | Path | Reason |
| --- | --- | --- | --- | --- |
| nav_missing_contract:/dashboard/drivers | warn | nav_missing_contract | /dashboard/drivers | Drivers nav section placeholder — no dashboard page routes yet |
| nav_missing_contract:/dashboard/drivers/routes | warn | nav_missing_contract | /dashboard/drivers/routes | Driver routes nav placeholder — page not implemented |
| nav_missing_contract:/dashboard/catalog | warn | nav_missing_contract | /dashboard/catalog | Catalog section nav path is a parent-only route without page.tsx |
| nav_missing_contract:/dashboard/internal_fin | warn | nav_missing_contract | /dashboard/internal_fin | Internal finance section nav path is parent-only without page.tsx |
| nav_contract_permission_mismatch:/dashboard/internal_fin/invoices/new | warn | nav_contract_permission_mismatch | /dashboard/internal_fin/invoices/new | Nav uses invoices:write; contract uses broader finance gate — align in Phase 6 |
| nav_contract_permission_mismatch:/dashboard/internal_fin/vouchers/reports | warn | nav_contract_permission_mismatch | /dashboard/internal_fin/vouchers/reports | Nav permission set differs from voucher reports contract — align in Phase 6 |
| nav_contract_permission_mismatch:/dashboard/erp-lite/periods | warn | nav_contract_permission_mismatch | /dashboard/erp-lite/periods | Nav erp_lite:view vs contract erp_lite_periods:view — intentional finer contract gate |
| nav_contract_feature_flag_mismatch:/dashboard/marketing/campaigns_missing_in_contract | warn | nav_contract_feature_flag_mismatch | /dashboard/marketing/campaigns | Nav requires CAMPAIGNS_ENABLED; contract missing page.featureFlags — fix in Phase 6 |
| nav_missing_contract:/dashboard/inventory/machines | warn | nav_missing_contract | /dashboard/inventory/machines | Inventory machines nav entry — page route not yet implemented |
