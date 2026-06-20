# Authority ladder

When docs and code disagree, resolve in this order:

1. **Runtime truth** — what API routes, services, and UI actually enforce
2. **Declarative sources** — `*-access.ts`, `web-admin/config/navigation.ts`, `FLAG_CATALOG`, permission/flag DB seeds
3. **Merged inventory** — `docs/platform/inventories/platform-info-inventory.json` (committed; regenerate via scripts)
4. **Generated views** — `docs/platform/inventories/GENERATED_*.md` (never hand-edit)
5. **Legacy platform docs** — `docs/platform/permissions/*`, `feature_flags/*`, etc. — add header linking to GENERATED; do not maintain duplicate tables

## Agent rule

If you need current gating state: run `npm run rebuild:platform-info-inventories` and read `GENERATED_GATE_MATRIX.md` + `DRIFT_REPORT.md` — do not grep legacy markdown inventories as primary source.
