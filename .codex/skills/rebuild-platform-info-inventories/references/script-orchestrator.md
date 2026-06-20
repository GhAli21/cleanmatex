# Script orchestrator

Root command:

```bash
npm run rebuild:platform-info-inventories   # full pipeline
npm run check:platform-info-inventories      # validate + access-contract Jest
```

## Subcommands

`tsx scripts/docs/rebuild-platform-info-inventories.ts <command>`

| Command | Action |
|---------|--------|
| `extract-delta` | Run `docs:extract-permissions`, `docs:extract-feature-flags`, `docs:extract-settings`, `docs:extract-plan-limits` |
| `ingest` | Merge extracts + `*-access.ts` + `navigation.ts` + `FLAG_CATALOG` → `platform-info-inventory.json` |
| `reconcile` | Compare declarative vs scans → `DRIFT_REPORT.md`, `GENERATED_UNDOCUMENTED.md`, `GENERATED_ORPHANS.md` |
| `generate-views` | Write `GENERATED_GATE_MATRIX.md` (more slices in later phases) |
| `full` | extract-delta → ingest → reconcile → generate-views |
| `validate` | Assert artifacts exist; warn on new drift (strict with `PLATFORM_INVENTORIES_STRICT=1`) |

## Extract outputs (legacy paths preserved)

| Script | Output |
|--------|--------|
| `docs:extract-permissions` | `docs/platform/permissions/extracted-permissions.json` |
| `docs:extract-feature-flags` | `docs/platform/feature_flags/extracted-feature-flags-usage.json` |
| `docs:extract-settings` | `docs/platform/settings/extracted-settings-usage.json` |
| `docs:extract-plan-limits` | `docs/platform/plan_limits/extracted-plan-limits-usage.json` |

## Ingest adapters

`scripts/docs/ingest/` — JSON extracts, access contracts TS, navigation TS, flag catalog.

Bootstrap: missing extract files auto-run before ingest.

## Delta CI

- Baseline: `KNOWN_EXCEPTIONS.json`
- New drift IDs not in allowlist → warn (Phase 3–5) or fail when `PLATFORM_INVENTORIES_STRICT=1` (Phase 6+)
