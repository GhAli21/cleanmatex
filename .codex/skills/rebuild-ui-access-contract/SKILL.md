---
name: rebuild-ui-access-contract
description: Edit and validate page access contracts (*-access.ts, page-access-registry), RBAC constants, gates; sync platform inventories.
user-invocable: true
---

# Rebuild UI Access Contract

**Canonical skill:** `.claude/skills/rebuild-ui-access-contract/SKILL.md`  
**Cursor/Codex rule:** `.cursor/rules/ui-access-contract-pattern.mdc`  
**User guide:** `docs/platform/ui-access-contract/user_guide.md`

## Golden path (no gaps)

```
migration → lib/constants/permissions/{domain}-perm.ts → [nav dual-write] → scaffold → derive --apply → wire --fix → check --wire → sync
```

**Authoring `*-access.ts`:** script-first (`scaffold` + `derive --apply`) — not hand-written route blocks.

| Layer | Path |
|-------|------|
| RBAC codes | `web-admin/lib/constants/permissions/{domain}-perm.ts` |
| Route contracts | `web-admin/src/features/*/access/*-access.ts` |
| **Not** for codes | `src/features/*/access/*-permissions.ts` |

```bash
npm run scaffold:ui-access-contract -- --feature=<feature>
npm run derive:ui-access-contract -- --feature=<feature> --apply --refresh-extract
npm run wire:ui-access-contract -- --feature=<feature> --fix
npm run register:ui-access-contract -- --fix
```

## Permission hooks

- **Preferred page boundary:** `RequireAnyPermission` on `page.tsx`
- **Full codes (especially `_` in action):** `useHasPermissionCode('resource:action')`
- **Legacy:** `useHasPermission(resource, action)` — still valid; wire audit + extract both handle it
- **Hook rename only:** run `docs:extract-permissions` + `rebuild:platform-info-inventories` (entry id unchanged)

## `derive` — legacy / incomplete contract from code

Dry-run default. Infers from wire scan + `extracted-permissions.json`:

| Field | Source |
|-------|--------|
| `page.permissions` | Page boundary gates; **`config/navigation.ts`** when no page gate |
| `featureFlags` | `navigation.ts` |
| `actions.*` | Permission hooks in feature UI; `hasPermissionServer` in server actions |
| `apiDependencies` | `/api/*` literals; `@/app/actions/*` → `/app/actions/...` |

```bash
npm run derive:ui-access-contract -- --route=/dashboard/foo --verbose
npm run derive:ui-access-contract -- --feature=marketing --apply --dry-run
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --prune-stale
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --force
```

| Flag | Effect |
|------|--------|
| `--apply` | Merge into `*-access.ts` |
| `--prune-stale` | Comment stale actions/APIs not in scanned code |
| `--force` | Replace `page.permissions` on conflict |
| `--refresh-extract` | Refresh `extracted-permissions.json` first |

Skips `/api/auth/*` (global auth noise). Additive only unless `--prune-stale` or `--force`. See user guide § B3.

## Commands

```bash
npm run check:ui-access-contract [-- --feature=... --route=... --wire --verbose]
npm run features:ui-access-contract
npm run scaffold:ui-access-contract
npm run derive:ui-access-contract
npm run wire:ui-access-contract
npm run register:ui-access-contract
npm run refresh:ui-access-contract -- --route=... --permissions=... --fix
npm run sync:ui-access-contract
npm run rebuild:ui-access-contract
```

Script: `scripts/docs/rebuild-ui-access-contract.ts`

## Related

- `/rebuild-platform-info-inventories` — refresh merged inventories after contract edits
- `permissions-migration.mdc` — DB seed for new codes
