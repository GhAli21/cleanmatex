import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/** A tax rule was broken; `code` is the stable key the UI translates (`taxSetup.errors.<code>`). */
export class TaxError extends Error {
  constructor(
    readonly code: string,
    readonly status = 409,
  ) {
    super(code)
    this.name = 'TaxError'
  }
}

/** Database guards raise `TAX_SOMETHING: detail`; the prefix is the code. */
const DB_TAX_CODE = /\b(TAX_[A-Z_]+):/

/**
 * Turns a thrown error into the tax API response. Known rule failures keep their
 * code; anything else is logged and answered generically, so SQL never reaches the browser.
 * @param err - The caught error
 * @param tenantId - For the log
 * @returns The JSON error response
 */
export function taxErrorResponse(err: unknown, tenantId: string): NextResponse {
  if (err instanceof TaxError) {
    return NextResponse.json({ success: false, error: err.code, code: err.code }, { status: err.status })
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return NextResponse.json({ success: false, error: 'TAX_DUPLICATE', code: 'TAX_DUPLICATE' }, { status: 409 })
  }
  const dbCode = err instanceof Error ? DB_TAX_CODE.exec(err.message)?.[1] : undefined
  if (dbCode) return NextResponse.json({ success: false, error: dbCode, code: dbCode }, { status: 409 })

  logger.error('Tax request failed', err instanceof Error ? err : new Error('Unknown tax error'), { tenantId })
  return NextResponse.json({ success: false, error: 'TAX_REQUEST_FAILED', code: 'TAX_REQUEST_FAILED' }, { status: 500 })
}

export { isoDate } from '@/lib/tax/determine'
