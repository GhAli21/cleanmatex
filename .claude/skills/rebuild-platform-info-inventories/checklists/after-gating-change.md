# Checklist — after gating change

- [ ] Code/contract change complete (`*-access.ts`, nav, API guard, flag check, permission migration)
- [ ] **Contract refresh (script-first)** — do not hand-edit large contract blocks; use `/rebuild-ui-access-contract`:

```bash
npm run derive:ui-access-contract -- --feature=<feature> --apply    # or --route=/dashboard/...
npm run wire:ui-access-contract -- --feature=<feature> --fix
npm run check:ui-access-contract -- --feature=<feature> --wire --verbose
```

- [ ] Hook rename only (`useHasPermission` → `useHasPermissionCode`, same code): `npm run docs:extract-permissions` then `npm run rebuild:platform-info-inventories` (no `*-access.ts` edit)
- [ ] New permission codes: `/create-update-rbac-permission` migration created (not TS-only)
- [ ] Nav changes: dual-write `navigation.ts` + `sys_components_cd` migration **before** `derive --apply` (derive reads `navigation.ts`)
- [ ] `npm run sync:ui-access-contract` (typical) or `npm run rebuild:platform-info-inventories`
- [ ] `npm run check:platform-info-inventories`
- [ ] Review `DRIFT_REPORT.md` — fix **new** drift; update `KNOWN_EXCEPTIONS.json` only for documented legacy debt
- [ ] Commit updated `platform-info-inventory.json` + GENERATED files with PR
