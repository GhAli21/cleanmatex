# Access Contract Rollout (Codex pointer)

**Canonical:** `.claude/skills/rebuild-ui-access-contract/references/access-contract-rollout.md`  
**Rule:** `.cursor/rules/ui-access-contract-pattern.mdc`

## Quick checklist

1. [ ] DB migration (new permission only)
2. [ ] `lib/constants/permissions/{domain}-perm.ts` — `{DOMAIN}_PERMISSIONS`
3. [ ] `*-access.ts` — import constants; `page`, `actions`, `apiDependencies`
4. [ ] `page-access-registry.ts` (new module)
5. [ ] `page.tsx` gate + API `requirePermission`
6. [ ] `npm run check:ui-access-contract -- --route=... --wire`
7. [ ] `npm run sync:ui-access-contract`

**Legacy / incomplete contract:** `npm run derive:ui-access-contract -- --route=... --verbose` then `--apply` (optional `--prune-stale`, `--force`). See user guide § B3.

```bash
npm run scaffold:ui-access-contract -- --feature=<feature>
npm run derive:ui-access-contract -- --feature=<feature> --apply --refresh-extract
npm run wire:ui-access-contract -- --feature=<feature> --fix
npm run check:ui-access-contract -- --route=... --wire
npm run sync:ui-access-contract
npm run rebuild:ui-access-contract
```
