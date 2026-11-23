/** Builds the consuming pg-boss instance and keeps its queues in step with the registry. */
import { PgBoss } from 'pg-boss';
import { jobsDbSsl, type WorkerConfig } from './config';
import type { JobHandler } from './handlers/types';
import { errorText, log } from './log';
import { readRegistry, reportApplied } from './registry';
import { type FinalFailure, QueueRunner } from './runner';

export interface RunningWorker {
  boss: PgBoss;
  runner: QueueRunner;
  /** Reads the registry and applies it now (tests; the loop does this every REGISTRY_POLL_SECONDS). */
  syncNow(): Promise<void>;
  /** Stops fetching, lets running jobs finish for up to 30 s (DESIGN §8.4), closes the pool. */
  stop(): Promise<void>;
}

export async function startWorker(
  config: WorkerConfig,
  handlers: Readonly<Record<string, JobHandler>>,
  onFinalFailure: FinalFailure,
): Promise<RunningWorker> {
  const boss = new PgBoss({
    connectionString: config.JOBS_DATABASE_URL,
    ssl: jobsDbSsl(config), // local: none; otherwise verified against the Supabase CA (required by loadConfig)
    max: config.JOBS_DB_POOL_MAX,
    application_name: config.WORKER_INSTANCE_NAME,
    instanceName: config.WORKER_INSTANCE_NAME,
    migrate: false, // schema comes only from repo migrations (DESIGN §18.1 B2); start fails on a version mismatch
  });
  boss.on('error', (err) => log('error', 'pg-boss error', { error: errorText(err) }));
  await boss.start();

  const runner = new QueueRunner(boss, handlers, onFinalFailure, config.WORKER_INSTANCE_NAME);
  const db = boss.getDb();
  const syncNow = async () => {
    const applied = await runner.sync(await readRegistry(db));
    await reportApplied(db, config.WORKER_INSTANCE_NAME, applied);
  };

  let stopping = false;
  let timer: NodeJS.Timeout | undefined;
  const loop = async () => {
    try {
      await syncNow();
    } catch (err) {
      log('error', 'registry sync failed', { error: errorText(err) });
    } finally {
      if (!stopping) timer = setTimeout(loop, config.REGISTRY_POLL_SECONDS * 1000);
    }
  };
  try {
    await syncNow(); // a broken registry or missing permission fails the deploy instead of idling silently
  } catch (err) {
    await boss.stop({ graceful: false });
    throw err;
  }
  timer = setTimeout(loop, config.REGISTRY_POLL_SECONDS * 1000);
  log('info', 'worker started', { instance: config.WORKER_INSTANCE_NAME, version: config.RENDER_GIT_COMMIT, queues: runner.runningQueues() });

  return {
    boss,
    runner,
    syncNow,
    async stop() {
      stopping = true;
      clearTimeout(timer);
      await boss.stop({ graceful: true, timeout: 30_000 });
      log('info', 'worker stopped', { instance: config.WORKER_INSTANCE_NAME });
    },
  };
}
