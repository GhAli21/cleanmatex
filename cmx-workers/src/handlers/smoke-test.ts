/** `ops.smoke_test`: proves the worker consumes, retries and dead-letters (DESIGN §10 step 3). */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import type { JobHandler } from './types';

export const smokeTest: JobHandler = async (job) => {
  const { runId, mode } = QUEUE_PAYLOADS['ops.smoke_test'].parse(job.data);
  if (mode === 'fail') throw new Error(`smoke test ${runId}: failure requested`);
  return { runId, ok: true };
};
