/**
 * Prisma Client Instance
 *
 * Singleton pattern for Prisma client to prevent multiple instances in development.
 * Includes logging configuration and connection pooling.
 */

import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client with logging
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Save to global in development to prevent hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
