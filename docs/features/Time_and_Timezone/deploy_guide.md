# Deploy guide

This pack does not deploy anything. Each work package that needs a migration produces a new SQL file and stops for review.

## Before any migration is applied

1. Read the provenance note inside that migration. It must name one proven stored clock, UTC wall or `Asia/Muscat` wall, and the sample rows that were checked. A note that assumes UTC without those rows is not ready. Mixed or unproven columns stay out of the file. The rollout is expand-and-contract: twin, dual-write, bounded backfill, then readers. The old column is dropped only in a later migration.
2. Apply on a copy or local database first. Compare a known row (a lockout, a Ready By, a scheduled send) before and after.
3. Do not apply the next domain batch until that comparison matches the real-world time.

## Apply order

The order is the phase order in [`development_plan.md`](./development_plan.md). Phase 1 has no migration. Phase 2 migrations are lockout, then notification schedule, then Ready By backfill. Later domain batches do not share a file with those three.

## After the user applies a migration

From the repo root:

```bash
npm run prisma:pull
```

That includes the post-pull `@ignore` patch. Then typecheck the touched `web-admin` code. Update `progress_summary.md` and `current_status.md` from Written, not applied to Applied by user.

## Database session

New instant columns are `timestamptz`, so they store UTC regardless of session `TimeZone`. Setting the database and role `TimeZone` to `UTC` is a separate reviewed operations change. Do it before Phase 5 so new naive writes cannot keep appearing while old audit columns are converted. Do not combine that setting change with a data conversion in the same unattended step.

## Rollback

Prefer a forward migration that restores a column only if the conversion was proven wrong. Do not edit the applied file. `0833` dropped `ready_by` and `ready_by_override`. A restore is a new migration. Readers use `ready_by_at`.

## HQ

Workers and cron that live in `cleanmatexsaas` are not deployed from this pack. If a tenant migration changes a column those workers read, stop and name the HQ reader before apply.
