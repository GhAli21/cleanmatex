---
name: rebuild-platform-info-inventories
description: Rebuild or refresh merged platform info inventories (permissions, feature flags, settings, access contracts, navigation, plan limits) from code and declarative sources. Use after gating changes, before PRs touching access/nav/flags, or when DRIFT_REPORT shows new items.
user-invocable: true
version: 1.0.0
deprecated: false
effort: medium
references:
  - references/invoke-protocol.md
  - references/script-orchestrator.md
  - references/authority-ladder.md
  - checklists/after-gating-change.md
  - checklists/rebuild-all.md
agents:
---

# Rebuild Platform Info Inventories

Orchestrates **scripts** that merge code scans + declarative sources into committed inventories under `docs/platform/inventories/`.

**Not a mandatory preload skill.** Invoke conditionally when the trigger table matches (see `references/invoke-protocol.md`).

## Deprecated aliases

- `/rebuild-platform-inventories` → this skill (`rebuild-all`)
- `/platform-gating` → this skill

**Page contract authoring:** use **`/rebuild-ui-access-contract`** — edits `*-access.ts` + registry, then `npm run sync:ui-access-contract` to refresh inventories.

## Agent modes

| Mode | When | Example scope |
|------|------|----------------|
| `refresh` | Scoped rebuild after a localized change | `surface=page`, `route=/dashboard/marketing/campaigns` |
| `repair` | Fix items listed in `DRIFT_REPORT.md`, then re-run | items from report IDs |
| `rebuild-all` | Full pipeline | optional reason string |
| `validate-only` | CI / pre-push | — |

**Scope fields** (combine with mode): `surface`, `route`, `path`, `flagKey`, `permissionCode`, `settingCode`, `limitKey`.

> **Agent scope is documentation only** — the orchestrator has no `--route` / `--surface` flags. Map scope to commands:
> - `surface=permission` (hook rename) → `npm run docs:extract-permissions` then `npm run rebuild:platform-info-inventories`
> - `surface=page`, `route=…` (contract edit) → `npm run sync:ui-access-contract` or `check:ui-access-contract -- --route=… --wire`

Surfaces: `page`, `api`, `service`, `server_action`, `navigation`, `feature-flag`, `permission`, `plan-limit`, `plan-constraint`, `settings`.

## Workflow (agent)

1. Identify trigger (see invoke-protocol) and pick **mode + scope**.
2. Make code/contract changes first (access contracts, nav, migrations, flags).
3. After contract edits: `npm run sync:ui-access-contract` (or `rebuild:ui-access-contract` for full PR).
4. Run scripts — **never hand-edit** `GENERATED_*.md` or `platform-info-inventory.json`:
   ```bash
   npm run rebuild:platform-info-inventories          # full
   npm run check:platform-info-inventories             # validate + Jest
   ```
4. Read `docs/platform/inventories/DRIFT_REPORT.md` — fix **new** drift not in `KNOWN_EXCEPTIONS.json`.
5. For new permission codes only: use `/create-update-rbac-permission` (not `/update-rbac-role`).
6. Report: files changed, validation output, remaining allowlisted drift.

## Authority ladder

1. Runtime enforcing code
2. Declarative: `*-access.ts`, `navigation.ts`, `FLAG_CATALOG`, DB seeds
3. `platform-info-inventory.json` (committed)
4. `GENERATED_*.md` (script-only)
5. Legacy docs under `docs/platform/**` — link to GENERATED; do not duplicate tables

See `references/authority-ladder.md`.

## Key paths

| Artifact | Path |
|----------|------|
| Merged JSON | `docs/platform/inventories/platform-info-inventory.json` |
| Gate matrix | `docs/platform/inventories/GENERATED_GATE_MATRIX.md` |
| Drift | `docs/platform/inventories/DRIFT_REPORT.md` |
| Allowlist | `docs/platform/inventories/KNOWN_EXCEPTIONS.json` |
| Orchestrator | `scripts/docs/rebuild-platform-info-inventories.ts` |
| Access contracts | `web-admin/src/features/*/access/*-access.ts` |
| Registry | `web-admin/src/features/access/page-access-registry.ts` |

## RBAC split

- **New permission codes** → `/create-update-rbac-permission` + DB migration
- **Role assignment / role design** → `/update-rbac-role` (out of scope for this skill)

## Validation

```bash
npm run rebuild:platform-info-inventories
npm run check:platform-info-inventories
cd web-admin && npm run check:access-contracts
```

Strict CI drift: default for `npm run check:platform-info-inventories`. Local warn-only: `PLATFORM_INVENTORIES_WARN_ONLY=1 npm run check:platform-info-inventories`

## References

- `references/invoke-protocol.md` — trigger table + scope format
- `references/script-orchestrator.md` — subcommands and pipeline
- `checklists/after-gating-change.md` — post-change checklist
- `checklists/rebuild-all.md` — quarterly full rebuild
