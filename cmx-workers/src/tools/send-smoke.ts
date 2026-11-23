/**
 * Sends one `ops.smoke_test` job and waits for its outcome, to prove a deployed worker end to end.
 *   npm run smoke --workspace=cmx-workers            → expects "completed"
 *   npm run smoke --workspace=cmx-workers -- fail    → expects "failed" after 3 attempts, then a dead letter
 * Uses JOBS_DATABASE_URL (+ JOBS_DATABASE_CA_CERT for remote), the same values as the worker.
 */
import { randomUUID } from 'node:crypto';
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import { PgBoss } from 'pg-boss';
import { jobsDbSsl, loadJobsDbConfig } from '../config';

const config = loadJobsDbConfig();
const mode = process.argv[2] === 'fail' ? 'fail' : 'ok';
const payload = QUEUE_PAYLOADS['ops.smoke_test'].parse({ runId: randomUUID(), mode });

const boss = new PgBoss({
  connectionString: config.JOBS_DATABASE_URL,
  ssl: jobsDbSsl(config),
  max: 2, migrate: false, supervise: false, schedule: false, registerInstance: false,
});
await boss.start();
try {
  const id = await boss.send('ops.smoke_test', payload);
  console.log(`sent ops.smoke_test ${id} runId=${payload.runId} mode=${mode}; waiting up to 3 minutes`);
  const db = boss.getDb();
  const end = Date.now() + 180_000;
  for (;;) {
    const { rows } = await db.executeSql(`SELECT state, retry_count FROM pgboss.job WHERE name = 'ops.smoke_test' AND id = $1`, [id]);
    const job = rows[0] as { state: string; retry_count: number } | undefined;
    if (job && (job.state === 'completed' || job.state === 'failed')) {
      const dead = await db.executeSql(`SELECT id FROM pgboss.job WHERE name = 'dead_letter' AND data->>'runId' = $1`, [payload.runId]);
      console.log(`state=${job.state} attempts=${job.retry_count + 1} deadLetter=${(dead.rows[0] as { id?: string } | undefined)?.id ?? 'none'}`);
      process.exitCode = job.state === (mode === 'ok' ? 'completed' : 'failed') ? 0 : 1;
      break;
    }
    if (Date.now() > end) {
      console.log(`no outcome yet (state=${job?.state ?? 'missing'}): is the worker running and the queue not paused?`);
      process.exitCode = 1;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
} finally {
  await boss.stop({ graceful: false });
}
