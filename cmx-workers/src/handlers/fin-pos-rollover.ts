/**
 * POS session rollover (Background Jobs step 6b, migration 0824): a 15-minute schedule → one
 * `fin.pos_rollover.sweep` job → the web-admin sweep, which locks and re-checks each live session in
 * its own transaction (pause / force-close + Z-report / stale flag, then notify). A session that
 * fails is logged by the sweep and found again on the next tick, so the job itself completes.
 * shortcut: one job sweeps every tenant; split into sweep → one item per session if a sweep nears the 900 s expiry.
 */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import { runPosSessionRolloverSweep } from '@/lib/services/pos-session-rollover.service';
import type { JobHandler } from './types';

export const FIN_POS_ROLLOVER_HANDLERS: Readonly<Record<string, JobHandler>> = {
  'fin.pos_rollover.sweep': async (job) => {
    QUEUE_PAYLOADS['fin.pos_rollover.sweep'].parse(job.data ?? {});
    return runPosSessionRolloverSweep();
  },
};
