# Seed Data Reference

This directory contains local development and testing seed-data material for CleanMateX.

## Purpose

Use this area for:

- lookup and demo data for local development
- tenant demo data used in testing
- controlled local data-loading workflows

## Important Notes

- this folder is currently named `xseeds`
- older documentation may still refer to `seeds/`; treat `xseeds/` as the current local folder path
- seed data is for local or controlled non-production use only

## Documentation Rules

When documenting seed workflows:

- make it explicit whether a step is destructive or non-destructive
- keep demo credentials and local-only data clearly labeled as development-only
- avoid treating reset-heavy workflows as the default recommendation outside local setup docs
- keep seed documentation aligned with the actual scripts in `scripts/db/`

## Working With Seeds

Typical local seed-related tasks include:

- loading lookup/demo data into an existing local schema
- preparing a local demo tenant set
- creating or repairing demo users after local setup

Use `../../scripts/db/README.md` together with this file for the current local workflow.

## Related Documentation

- `../../README.md`
- `../../scripts/db/README.md`
- `../xproduction/README.md`
- `../archive/README.md`
- `../../../docs/README.md`
