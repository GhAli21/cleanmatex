# Platform Info Inventories — Maintenance Runbook

Quarterly (or after major RBAC/nav/flag changes), refresh merged inventories and shrink the drift allowlist.

## Quick commands

```bash
# Full rebuild (extract → ingest → reconcile → GENERATED views)
npm run rebuild:platform-info-inventories

# CI gate — fails on new drift
npm run check:platform-info-inventories

# Local lenient validate (warn only)
PLATFORM_INVENTORIES_WARN_ONLY=1 npm run check:platform-info-inventories
```

## Quarterly checklist

1. Run full rebuild and commit updated `platform-info-inventory.json` + `GENERATED_*.md`.
2. Review `docs/platform/inventories/DRIFT_REPORT.md` for **new drift** (not in allowlist).
3. Fix high-signal drift in code (`*-access.ts`, `navigation.ts`) rather than expanding `KNOWN_EXCEPTIONS.json`.
4. Remove fixed items from `KNOWN_EXCEPTIONS.json`.
5. Verify Help UI at `/dashboard/help/platform-inventories` for spot checks (see [user guide](../platform/inventories/user_guide.md)).
6. Run `npm run check:access-contracts --workspace=web-admin`.

## Allowlist policy

`KNOWN_EXCEPTIONS.json` is for **documented, temporary** gaps only (e.g. nav placeholders without pages). Do not add items to silence CI without a reason and removal plan.

## Agent skill

Use `/rebuild-platform-info-inventories` with mode:

| Mode | When |
|------|------|
| `refresh` | After scoped contract/nav/flag edits |
| `repair` | Fix items listed in DRIFT_REPORT |
| `rebuild-all` | Quarterly full refresh |

See `.claude/skills/rebuild-platform-info-inventories/SKILL.md`.
