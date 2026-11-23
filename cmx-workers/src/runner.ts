/** Starts, stops and restarts pg-boss work() per queue so this process matches the registry. */
import type { Job, PgBoss } from 'pg-boss';
import type { HandlerContext, JobHandler } from './handlers/types';
import { errorText, log } from './log';
import type { QueueSetting } from './registry';

/**
 * Handler time budget: always shorter than the queue's expireInSeconds (DESIGN §18.1 B4), so a slow
 * handler fails and retries cleanly instead of pg-boss expiring it while it still runs.
 */
export function handlerBudgetMs(expireS: number): number {
  return Math.max(1000, Math.floor(Math.min(expireS * 1000 - 5000, expireS * 900)));
}

/** Runs the handler; rejects when the budget ends or pg-boss aborts the job, whichever comes first. */
export async function runWithBudget(
  handler: JobHandler,
  job: Job<unknown>,
  budgetMs: number,
  ctx: Omit<HandlerContext, 'signal'> = { finalAttempt: false, consumer: 'cmx-workers' },
): Promise<unknown> {
  const signal = AbortSignal.any([job.signal, AbortSignal.timeout(budgetMs)]);
  let onAbort = (): void => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
      ? new Error(`handler exceeded its ${budgetMs} ms budget`)
      : signal.reason ?? new Error('job aborted'));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([handler(job, { ...ctx, signal }), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

const signature = (s: QueueSetting) => `${s.localConcurrency}|${s.pollingS}|${s.expireS}|${s.retryLimit}`;

export type FinalFailure = (err: unknown, queueName: string, jobId: string) => void;

export class QueueRunner {
  private readonly running = new Map<string, string>(); // queue → settings signature
  private readonly reportedMissing = new Set<string>();

  constructor(
    private readonly boss: PgBoss,
    private readonly handlers: Readonly<Record<string, JobHandler>>,
    private readonly onFinalFailure: FinalFailure,
    private readonly consumer: string,
  ) {}

  /** Applies the registry. Returns the state to report for every registry queue this worker has a handler for. */
  async sync(settings: QueueSetting[]): Promise<{ queueName: string; enabled: boolean }[]> {
    const wanted = new Map(settings.filter((s) => s.desiredEnabled && this.handlers[s.queueName]).map((s) => [s.queueName, s]));

    for (const [name, sig] of this.running) {
      const s = wanted.get(name);
      if (s && signature(s) === sig) continue;
      await this.boss.offWork(name, { wait: true }); // lets running jobs finish; queued jobs stay queued
      this.running.delete(name);
      log('info', s ? 'queue settings changed, restarting' : 'queue paused', { queue: name });
    }
    for (const s of wanted.values()) {
      if (!this.running.has(s.queueName)) await this.start(s);
    }
    // A paused queue without a handler is expected while its code has not shipped yet.
    for (const s of settings) {
      if (!s.desiredEnabled || this.handlers[s.queueName] || this.reportedMissing.has(s.queueName)) continue;
      this.reportedMissing.add(s.queueName);
      log('error', 'registry queue has no handler; not consuming it', { queue: s.queueName });
      this.onFinalFailure(new Error(`registry queue ${s.queueName} has no handler in cmx-workers`), s.queueName, '-');
    }
    return settings.filter((s) => this.handlers[s.queueName]).map((s) => ({ queueName: s.queueName, enabled: this.running.has(s.queueName) }));
  }

  runningQueues(): string[] {
    return [...this.running.keys()];
  }

  private async start(s: QueueSetting): Promise<void> {
    const handler = this.handlers[s.queueName];
    const budgetMs = handlerBudgetMs(s.expireS);
    await this.boss.work<unknown>(
      s.queueName,
      { batchSize: 1, localConcurrency: s.localConcurrency, pollingIntervalSeconds: s.pollingS },
      async ([job]) => {
        const started = Date.now();
        const finalAttempt = job.retryCount >= s.retryLimit;
        try {
          const out = await runWithBudget(handler, job, budgetMs, { finalAttempt, consumer: this.consumer });
          log('info', 'job done', { queue: s.queueName, jobId: job.id, attempt: job.retryCount, ms: Date.now() - started });
          return out;
        } catch (err) {
          const final = finalAttempt;
          log(final ? 'error' : 'warn', final ? 'job failed, moving to dead letter' : 'job failed, will retry',
            { queue: s.queueName, jobId: job.id, attempt: job.retryCount, error: errorText(err) });
          if (final) this.onFinalFailure(err, s.queueName, job.id);
          throw err;
        }
      },
    );
    this.running.set(s.queueName, signature(s));
    log('info', 'queue started', { queue: s.queueName, concurrency: s.localConcurrency, pollingS: s.pollingS, budgetMs });
  }
}
