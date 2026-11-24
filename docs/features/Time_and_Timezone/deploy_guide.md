# Deploy guide

This pack does not deploy anything. Each work package that needs a migration produces a new SQL file and stops for review.

## Before any migration is applied

1. Read the provenance note inside that migration. It must say whether the naive values are UTC wall clocks or `Asia/Muscat` wall clocks, and which sample rows were checked.
2. Apply on a copy or local database first. Compare a known row (a lockout, a Ready By, a scheduled send) before and after.
3. Do not apply the next domain batch until that comparison matches the real-world time.

## Apply order

The order is the phase order in [`development_plan.md`](./development_plan.md). Phase 1 has no migration. Phase 2 migrations are lockout, then notification schedule, then Ready By backfill. Later domain batches do not share a file with those three.

## After the user applies a migration

From the repo root:

```bash
npm run prisma:pull
```

That includes the post-pull `@ignore` patch. Then typecheck the touched `web-admin` code.

## Database session

New instant columns are `timestamptz`, so they store UTC regardless of session `TimeZone`. Setting the database and role `TimeZone` to `UTC` is a separate reviewed operations change. Do it before Phase 5 so new naive writes cannot keep appearing while old audit columns are converted. Do not combine that setting change with a data conversion in the same unattended step.

## Rollback

Prefer a forward migration that restores a column only if the conversion was proven wrong. Do not edit the applied file. A dropped legacy column (`ready_by`) is not part of the first release, so the first release can keep reading the twin if the new column is wrong.

## HQ

Workers and cron that live in `cleanmatexsaas` are not deployed from this pack. If a tenant migration changes a column those workers read, stop and name the HQ reader before apply.
