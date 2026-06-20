# Checklist — after gating change

- [ ] Code/contract change complete (`*-access.ts`, nav, API guard, flag check, permission migration)
- [ ] New permission codes: `/create-update-rbac-permission` migration created (not TS-only)
- [ ] Nav changes: dual-write `navigation.ts` + `sys_components_cd` migration
- [ ] `npm run rebuild:platform-info-inventories`
- [ ] `npm run check:platform-info-inventories`
- [ ] Review `DRIFT_REPORT.md` — fix **new** drift; update `KNOWN_EXCEPTIONS.json` only for documented legacy debt
- [ ] Commit updated `platform-info-inventory.json` + GENERATED files with PR
