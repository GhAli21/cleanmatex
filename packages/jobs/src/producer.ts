/**
 * Producer-mode pg-boss (DESIGN §18.2): sends jobs through the caller's own Prisma connection and
 * transaction. No pool of its own, no schema migration, no maintenance, no instance row.
 *
 * Commit keeps the job, rollback removes it, so a job exists exactly when its business change does.
 */
import { PgBoss, fromPrisma, type Db, type PrismaTransactionLike } from 'pg-boss';
import { DOMAIN_EVENT_JOB, EVENT_CODE, QUEUE_PAYLOADS, type DomainEventJob, type QueueName, type QueuePayload } from './queues';

export interface EnqueueOptions {
  /**
   * Job id (any GUID). A second send with the same id to the same queue inserts nothing while the
   * first job is kept (pg-boss inserts with ON CONFLICT DO NOTHING on (name, id)). Use a stable id,
   * such as the outbox row id, to make enqueue idempotent. `singletonKey` alone does NOT deduplicate
   * on a standard queue.
   */
  id?: string;
  /** Run no earlier than this (delayed job). */
  startAfter?: Date | number | string;
  priority?: number;
}

export interface JobProducer {
  /** Validates the payload and inserts one job inside `tx`. Returns the job id, or null when `id` already exists. */
  enqueue<N extends QueueName>(tx: PrismaTransactionLike, name: N, data: QueuePayload<N>, options?: EnqueueOptions): Promise<string | null>;
  /**
   * Fans a domain event out to every enabled subscription queue (`pgboss.subscription`), inside `tx`.
   * Each job's id is the event id, so publishing the same event twice adds nothing.
   * `redeliver: true` uses new job ids instead, to run the reactions again (operator retry); a reaction
   * that already applied finds its effect row and does nothing.
   * No subscribers: no jobs, no error.
   */
  publish(tx: PrismaTransactionLike, eventCode: string, data: DomainEventJob, options?: { redeliver?: boolean }): Promise<void>;
  /** Releases the instance (tests, graceful shutdown). */
  stop(): Promise<void>;
}

/**
 * The adapter pg-boss uses for start() only (every send passes the caller's `tx`). Same as
 * `fromPrisma`, except the schema-installed check: it returns a `regclass` column, which Prisma
 * cannot deserialize, so that one query is cast to text.
 * shortcut: matches pg-boss 12.39.0's exact SQL; the integration test fails first if an upgrade changes it.
 */
function startDb(client: PrismaTransactionLike): Db {
  return {
    async executeSql(text, values) {
      const sql = text.replace(/^SELECT to_regclass\((.+)\) as name$/, (_m, arg: string) => `SELECT to_regclass(${arg})::text as name`);
      const rows = await client.$queryRawUnsafe(sql, ...(values ?? []));
      return { rows: Array.isArray(rows) ? rows : [] };
    },
  };
}

/** One producer per process, built over the app's Prisma client (`client` is only used by start()). */
export function createJobProducer(client: PrismaTransactionLike): JobProducer {
  let started: Promise<PgBoss> | undefined;

  const boss = (): Promise<PgBoss> =>
    (started ??= (async () => {
      const b = new PgBoss({ db: startDb(client), migrate: false, supervise: false, schedule: false, registerInstance: false });
      // Producer mode has no background loops; this only keeps an unexpected emit from crashing the process.
      b.on('error', (err) => console.error('[jobs] pg-boss producer error', err));
      await b.start();
      return b;
    })().catch((err) => {
      started = undefined; // next call retries instead of caching the failure
      throw err;
    }));

  return {
    async enqueue(tx, name, data, options = {}) {
      const payload = QUEUE_PAYLOADS[name].parse(data);
      return (await boss()).send(name, payload, { ...options, db: fromPrisma(tx) });
    },
    async publish(tx, eventCode, data, options = {}) {
      const code = EVENT_CODE.parse(eventCode);
      const payload = DOMAIN_EVENT_JOB.parse(data);
      await (await boss()).publish(code, payload, { ...(options.redeliver ? {} : { id: payload.eventId }), db: fromPrisma(tx) });
    },
    async stop() {
      if (!started) return;
      const b = await started.catch(() => undefined);
      started = undefined;
      await b?.stop({ graceful: false });
    },
  };
}
