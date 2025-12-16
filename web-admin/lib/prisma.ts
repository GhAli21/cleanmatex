/**
 * Prisma Client Singleton for Next.js
 *
 * This file ensures we only instantiate one Prisma Client instance
 * during development (hot reload) and production.
 *
 * @see https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from '@prisma/client'

// Prevent multiple Prisma Client instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

// Store in global to prevent multiple instances during hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Graceful shutdown helper
 * Call this when your application is shutting down
 */
export async function disconnectPrisma() {
  await prisma.$disconnect()
}
