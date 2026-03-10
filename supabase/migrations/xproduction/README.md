# Production-Like Migration Reference

This directory stores migration material intended to represent schema-focused database changes without demo seed content.

## Purpose

Use this area as a reference for:

- schema evolution
- security and RLS setup
- tenant-safe database structure
- non-seed database changes

## Important Notes

- this folder is currently named `xproduction`
- older documentation may still refer to `production/`; treat `xproduction/` as the current local folder path
- keep migration documentation aligned with the actual folder structure before reusing examples elsewhere

## Documentation Rules

When documenting migrations here:

- separate schema changes from seed/demo data
- document tenant-isolation implications clearly
- document dependencies and side effects clearly
- avoid recommending destructive reset workflows as the default path in general feature documentation

## Multi-Tenancy Rules

- `org_*` tables should include tenant-aware patterns
- RLS and tenant isolation should be documented alongside structural changes
- tenant-bound relationships should use safe key patterns

## Related Documentation

- `../../README.md`
- `../xseeds/README.md`
- `../archive/README.md`
- `../../../docs/README.md`
- `../../../CLAUDE.md`
