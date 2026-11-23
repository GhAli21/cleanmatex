# @cmx/jobs

The only way to create background work in CleanMateX. Design: [docs/features/Background_Jobs/DESIGN.md](../../docs/features/Background_Jobs/DESIGN.md) (§5.3, §18.2, §20.4, §22).

## Exports

| Export | Use |
|---|---|
| `createJobProducer(prisma)` | One per process. Producer-mode pg-boss over the app's Prisma client: no own pool, no schema migration, no maintenance. |
| `producer.enqueue(tx, queue, payload, { id?, startAfter?, priority? })` | Inserts one job inside `tx`. Payload is validated by the queue's strict Zod schema (ids only). Pass a stable `id` to make it idempotent; returns `null` when that id already exists. |
| `producer.publish(tx, EVENT_CODE, { tenantOrgId, eventId })` | One job per enabled subscription of the event (`pgboss.subscription`, synced from `sys_ops_job_event_subs_cf`). Job id = event id, so publishing twice adds nothing. |
| `claimEffect(tx, { tenantOrgId, effectKey, queueName, jobId, appliedBy })` | First call inside a handler's transaction. `true` = do the writes; `false` = already applied, return. |
| `QUEUE_PAYLOADS`, `DOMAIN_EVENT_JOB`, `EVENT_CODE`, `DEAD_LETTER_QUEUE`, `zId` | Queue names and schemas. |

```ts
const jobs = createJobProducer(prisma);
await prisma.$transaction(async (tx) => {
  // ...business writes...
  await jobs.publish(tx, 'ORDER_SUBMITTED', { tenantOrgId, eventId });
});
```

## Rules

- Commit keeps the job, rollback removes it. Always pass the business transaction.
- Add a queue to `QUEUE_PAYLOADS` only in the change that ships its migration (`pgboss.create_queue` + `sys_ops_job_cf` + `sys_ops_job_queue_cf`). Sending to a missing queue throws.
- Deduplicate with the job id. `singletonKey` alone does nothing on a standard queue.
- pg-boss is pinned to **12.39.0**. Every producer and consumer (web-admin, cmx-workers, HQ API) uses the same version; the schema is installed by migration and every process runs `migrate: false`.
- Node 22.12 or newer.
- Web-admin code must not import `pg-boss` directly (ESLint).

## Test

Needs local Supabase with migrations through 0808 (`JOBS_TEST_DATABASE_URL` overrides the default local URL):

```bash
npm test --workspace=@cmx/jobs
npm run typecheck --workspace=@cmx/jobs
```
