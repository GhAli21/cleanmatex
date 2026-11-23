/**
 * Publishes unfinished domain events to their reactions (Background Jobs step 4, DESIGN §22.2).
 * Used once after 0809 and the step 4 code ship, for events written before publishing existed;
 * safe to run again at any time.
 *
 *   npm run publish-events --workspace=cmx-workers -- --dry-run   → counts only
 *   npm run publish-events --workspace=cmx-workers                → publishes
 *
 * - PENDING rows: published with the event id as job id, so a rerun adds nothing.
 * - FAILED / DEAD_LETTERED rows (old processor's failures, or a reaction's last failed attempt):
 *   set back to PENDING and published with new job ids, like the outbox monitor's Retry.
 * Either way a reaction that already applied finds its effect row and does nothing.
 * One tenant at a time, every org_* statement filtered by tenant_org_id.
 * Uses JOBS_DATABASE_URL (+ JOBS_DATABASE_CA_CERT for remote), the same values as the worker.
 */
import { DOMAIN_EVENT_JOB, EVENT_CODE } from '@cmx/jobs';
import { PgBoss } from 'pg-boss';
import { jobsDbSsl, loadJobsDbConfig } from '../config';

const BATCH = 500;
const dryRun = process.argv.includes('--dry-run');
const config = loadJobsDbConfig();

const boss = new PgBoss({
  connectionString: config.JOBS_DATABASE_URL,
  ssl: jobsDbSsl(config),
  max: 2, migrate: false, supervise: false, schedule: false, registerInstance: false,
});
await boss.start();
const db = boss.getDb();

interface Row { id: string; event_type: string; status: string }
const counts = new Map<string, number>();

try {
  const { rows: tenants } = await db.executeSql(`SELECT id::text AS id FROM public.org_tenants_mst ORDER BY id`);
  for (const { id: tenantOrgId } of tenants as { id: string }[]) {
    let after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const { rows } = await db.executeSql(
        `SELECT o.id::text AS id, o.event_type, o.status
           FROM public.org_domain_events_outbox o
          WHERE o.tenant_org_id = $1::uuid
            AND o.status IN ('PENDING', 'FAILED', 'DEAD_LETTERED')
            AND o.id > $2::uuid
            AND EXISTS (SELECT 1 FROM pgboss.subscription s WHERE s.event = o.event_type)
          ORDER BY o.id
          LIMIT ${BATCH}`,
        [tenantOrgId, after],
      );
      const batch = rows as Row[];
      if (!batch.length) break;
      after = batch[batch.length - 1].id;

      for (const row of batch) {
        counts.set(`${row.event_type} ${row.status}`, (counts.get(`${row.event_type} ${row.status}`) ?? 0) + 1);
        if (dryRun) continue;
        const data = DOMAIN_EVENT_JOB.parse({ tenantOrgId, eventId: row.id });
        const redeliver = row.status !== 'PENDING';
        await boss.publish(EVENT_CODE.parse(row.event_type), data, redeliver ? {} : { id: row.id });
        if (redeliver) {
          await db.executeSql(
            `UPDATE public.org_domain_events_outbox SET status = 'PENDING', attempts = 0, error_message = NULL
              WHERE tenant_org_id = $1::uuid AND id = $2::uuid AND status IN ('FAILED', 'DEAD_LETTERED')`,
            [tenantOrgId, row.id],
          );
        }
      }
    }
  }

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  for (const [k, n] of [...counts].sort()) console.log(`${String(n).padStart(6)}  ${k}`);
  console.log(`${dryRun ? 'would publish' : 'published'} ${total} event(s) across ${tenants.length} organization(s)`);
} finally {
  await boss.stop({ graceful: false });
}
