# CleanMateX Scripts

This directory contains local helper scripts for development, environment setup, database support, and maintenance tasks.

## Main Areas

- `scripts/dev/`: service startup, shutdown, and local environment helpers
- `scripts/db/`: database-oriented helper scripts and notes
- `feature-readme-template.md`: documentation helper template

## Common Usage

From the repo root:

```bash
npm run services:start
npm run services:stop
npm run test:smoke
npm run validate:env
```

Windows service helpers:

```powershell
.\scripts\dev\start-services.ps1
.\scripts\dev\stop-services.ps1
```

## Database Script Guidance

Database-specific helper documentation lives in `scripts/db/README.md`.

Important documentation rule:

- do not recommend destructive reset flows as the default path in feature docs
- if a reset or reseed workflow is truly required for local development, label it clearly as intentional local-only usage

## Writing New Scripts

When adding a script:

- keep it idempotent where possible
- provide clear error handling and readable output
- document prerequisites, side effects, and expected inputs
- update this README or the closest local README so the script is discoverable

## Secrets And Environment Data

Do not hardcode real secrets in documentation. Use placeholders or refer to local environment files and secure secret-management practices.

## Related Documentation

- `../README.md`
- `../docs/README.md`
- `db/README.md`
- `../supabase/README.md`
