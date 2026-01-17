/**
 * Prisma Client Export (Legacy)
 *
 * @deprecated This file is deprecated and will be removed in a future version.
 * 
 * **Migration Required**: Update all imports to use '@/lib/db/prisma' instead.
 * 
 * **Why**: This file exists only for backward compatibility. The centralized
 * Prisma client with middleware is located at '@/lib/db/prisma'.
 * 
 * **Migration Steps**:
 * 1. Find: `import { prisma } from '../prisma'` or `import { prisma } from '@/lib/prisma'`
 * 2. Replace with: `import { prisma } from '@/lib/db/prisma'`
 * 
 * **Removal Date**: TBD (after all imports are migrated)
 * 
 * @see lib/db/prisma.ts - Main Prisma client instance
 * @see lib/db/PRISMA_SETUP.md - Setup and usage guide
 */

export { prisma } from './db/prisma';
