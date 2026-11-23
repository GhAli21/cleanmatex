import type { Job } from 'pg-boss';

export interface HandlerContext {
  /** Aborted when the handler's time budget ends or pg-boss stops; pass it to anything cancellable. */
  signal: AbortSignal;
  /** True on the last attempt: a throw now moves the job to dead_letter. */
  finalAttempt: boolean;
  /** This worker's instance name, recorded on effect rows. */
  consumer: string;
}

/** Runs one job. Throw to fail (pg-boss retries, then dead-letters). Return value is stored as the job output. */
export type JobHandler = (job: Job<unknown>, ctx: HandlerContext) => Promise<unknown>;
