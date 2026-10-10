# Runbook 11 — Billing / Usage Reconciliation

**Status: Partial.** Atomic, idempotent usage metering and concurrency-safe quota reads are implemented and (per `STATUS.md`) applied to both local and remote databases. A true pre-send reservation (so two concurrent commands can never both pass a hard cap) and any reconciliation against actual provider-invoiced charges are both explicitly out of scope so far — not bugs, declared scope boundaries.

**Discrepancy found and reported (not silently corrected):** the plan document's own section 16 callout, dated 2026-10-09, states migration `0598_ntf_usage_metering_atomic_idempotent.sql` is "created, **not yet applied**." `STATUS.md`'s top entry, also dated 2026-10-09, states the opposite: *"Migration status — APPLIED... applied by the user to both local and remote databases (2026-10-09)... database types/Prisma... were regenerated and confirmed to include `fn_ntf_meter_usage_atomic`, `fn_ntf_quota_usage_locked`, and `org_ntf_usage_apply_evt`."* Source-code evidence supports STATUS.md: `metering.service.ts` calls `client.rpc('fn_ntf_meter_usage_atomic', ...)` directly with no bridging type cast (the cast was explicitly removed per STATUS.md once generated types included the function) — a stale bridging cast would be expected if the migration were genuinely unapplied and types were never regenerated against it. This runbook treats the migration as **applied**, per STATUS.md and the code evidence, and flags the plan's own section 16 prose as stale.

## Purpose

Verify usage metering is counting correctly and without double-counting, and understand exactly what quota/billing guarantees do and do not exist today.

## What is implemented (verified in code)

1. **Atomic increment.** `fn_ntf_meter_usage_atomic` (migration `0598`) performs one indivisible `INSERT ... ON CONFLICT DO UPDATE SET col = col + delta` against `org_ntf_usage_daily`, replacing the old SELECT-then-UPDATE pattern in `MeteringService.meter()` (`platform-api/.../dispatch/metering.service.ts`) that could lose increments under concurrency.
2. **Idempotency.** Every metering call now carries a required `idempotencyKey` (the same value already globally unique on `hq_ntf_dispatch_log`). A new ledger table `org_ntf_usage_apply_evt` (migration `0598`) claims that key before any increment — `UNIQUE(idempotency_key)` makes usage application at-most-once per logical dispatch command; a repeated call (BullMQ retry/redelivery) is a no-op (`applied: false`), not an error, not a double count.
3. **Concurrency-safe quota read.** `fn_ntf_quota_usage_locked` (migration `0598`) takes the same per-`(tenant_org_id, channel_code)` Postgres advisory lock as the increment function before summing `sent_count`, so `QuotaRepository.getUsageInPeriod()` can never read a half-applied concurrent increment for the same tenant+channel.
4. **Worker-side fix.** `platform-workers/src/notifications/dispatch.processor.ts`'s old `onConflict` upsert target had silently stopped matching any real constraint since migration `0366` added `currency_code` to the natural key — every queued-channel metering call had been broken since then. It now calls the same `fn_ntf_meter_usage_atomic` RPC with its result actually checked/logged.
5. **Redelivery-safe dispatch.** The same increment found a separate bug: the BullMQ worker sent to the provider unconditionally on every job execution with no status check, so a redelivered job for an already-`SENT` command could send to the real customer twice. Fixed by checking `hq_ntf_dispatch_log.status` for `(idempotency_key, tenant_org_id)` before any provider call, returning early when already `SENT`/`PERMANENT_FAILURE` (but not `PENDING`/`FAILED`, which are legitimate in-flight/retrying states).

## Operator steps — verify metering is working correctly for a tenant/channel/day

1. Confirm the day's aggregate:
   ```sql
   SELECT tenant_org_id, channel_code, usage_date, provider_code, currency_code, sent_count
   FROM org_ntf_usage_daily
   WHERE tenant_org_id = '<tenant_org_id>' AND usage_date = CURRENT_DATE;
   ```
2. Confirm idempotency — count distinct applied events vs. attempted dispatch commands for the same window:
   ```sql
   SELECT idempotency_key, applied, created_at
   FROM org_ntf_usage_apply_evt
   WHERE tenant_org_id = '<tenant_org_id>'
   ORDER BY created_at DESC LIMIT 50;
   ```
   A given `idempotency_key` should appear at most once with `applied = true`; any subsequent attempt for the same key recorded as `applied = false` is the no-op path working correctly, not a bug.
3. Cross-check against `hq_ntf_dispatch_log` for the same `idempotency_key`/tenant to confirm one logical command maps to exactly one applied usage event.

## Expected outcomes

- No lost increments under concurrent load for the same `(tenant, channel, date, provider, currency)` bucket.
- No double-counted usage from a BullMQ retry/redelivery of the same logical command.
- Hard-cap quota reads cannot observe a half-applied increment for the same tenant+channel.

## Known, explicitly-declared gaps (not bugs — scope boundaries)

1. **No true pre-send reservation exists.** `QuotaService.checkAndReserve` (pre-send check) and `MeteringService.meter` (post-send record) remain two separate calls separated by real provider-call I/O time. Two *different* concurrent dispatch commands can still both pass the pre-send check before either one's usage is recorded, potentially exceeding a hard cap in that narrow window. Closing this fully requires a reservation/expiry/release ledger — explicitly deferred to future M6 scope per the user's own instruction ("row lock OR atomic increment," not a full reservation system).
2. **No reconciliation against actual provider-invoiced charges exists.** Nothing in either repo compares internal `sent_count`/usage records against, e.g., an actual Twilio monthly invoice or billing export. "Separate estimated provider cost, actual reconciled provider charge, and tenant sell price" (plan section 16) has no implementation — there is no provider-charge import, no variance report, and no alerting on drift between internal usage and provider-billed amounts.
3. `platform-workers`'s Supabase client has no `Database` generic (no `database.types.ts` of its own), so its `.rpc()` calls to the new functions cannot be argument-type-checked regardless of what `platform-api`'s generated types contain — a deliberately retained bridging interface there, not an oversight.

## Rollback / abort guidance

- This is a pure concurrency-correctness fix; no quota value, price, plan default, or override was changed. There is nothing to "roll back" behaviorally — if migration `0598` itself needed reverting, that would require a new forward migration dropping the new function/table/index (never editing `0598` in place), which has not been requested or done.

**Last verified against source:** 2026-10-10 (`metering.service.ts`, migration `0598_ntf_usage_metering_atomic_idempotent.sql` file presence confirmed on disk, `STATUS.md` 2026-10-09 top entry, plan section 16).
