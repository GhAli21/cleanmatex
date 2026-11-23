# CleanMateX Shared Packages

This directory is reserved for shared workspace packages used across CleanMateX modules.

## Intended Scope

Typical package areas for this repository include shared:

- types
- i18n utilities
- reusable helpers
- cross-module libraries

## Current Repository State

This area currently has little or no local markdown documentation. If packages are added or expanded, each package should include a focused README that explains ownership, exports, usage, and compatibility constraints.

## Packages

- [`jobs`](jobs/README.md) (`@cmx/jobs`): the only way to create background work (pg-boss producer, payload schemas, effect helper).

## Documentation Rule

Do not assume a planned package exists just because the workspace layout allows for it. Document only the packages that are actually implemented.

## Related Documentation

- `../README.md`
- `../docs/README.md`
