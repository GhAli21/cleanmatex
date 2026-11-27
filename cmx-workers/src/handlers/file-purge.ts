/**
 * File Util byte purge (Background Jobs step 6e, migration 0847): the weekly schedule → `file.purge.sweep`
 * (up to 200 deleted files, one Storage call per bucket; a full batch queues the next page).
 */
import { QUEUE_PAYLOADS } from '@cmx/jobs';
import { purgeDeletedFiles } from '@/lib/services/file-util/file-util.service';
import type { JobHandler } from './types';

export const FILE_PURGE_HANDLERS: Readonly<Record<string, JobHandler>> = {
  'file.purge.sweep': async (job) => purgeDeletedFiles(QUEUE_PAYLOADS['file.purge.sweep'].parse(job.data ?? {}).page ?? 0),
};
