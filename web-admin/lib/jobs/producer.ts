import 'server-only';

import { createJobProducer } from '@cmx/jobs';
import { prisma } from '@/lib/db/prisma';

/**
 * The app's one background-job producer (docs/features/Background_Jobs/DESIGN.md §5.3, §18.2).
 * Jobs are written through the caller's Prisma transaction, so they exist exactly when the
 * business change commits. `prisma` is used only for pg-boss's one-time start checks.
 */
export const jobs = createJobProducer(prisma);
