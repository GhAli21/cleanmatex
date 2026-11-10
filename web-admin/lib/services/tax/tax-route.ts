/** Shared request/response handling for the /api/v1/tax routes, so each route stays a few lines. */
import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { taxErrorResponse } from './tax-errors'

/**
 * The response for input that failed validation.
 * @param message - A specific code from the schema, when there is one
 * @returns 400 JSON
 */
export function taxInvalid(message?: string): NextResponse {
  const code = message?.startsWith('TAX_') ? message : 'TAX_INVALID_INPUT'
  return NextResponse.json({ success: false, error: code, code }, { status: 400 })
}

/**
 * Reads and validates a JSON body.
 * @param request - The request
 * @param schema - Validation schema
 * @returns The parsed value, or a 400 response
 */
export async function parseTaxBody<S extends z.ZodTypeAny>(request: NextRequest, schema: S): Promise<z.output<S> | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  return parsed.success ? parsed.data : taxInvalid(parsed.error.issues[0]?.message)
}

/**
 * Runs a service call and wraps its outcome.
 * @param tenantId - For error logging
 * @param run - The service call
 * @param status - Success status
 * @returns JSON `{ success, data }` or the mapped error
 */
export async function taxResponse<T>(tenantId: string, run: () => Promise<T>, status = 200): Promise<NextResponse> {
  try {
    return NextResponse.json({ success: true, data: await run() }, { status })
  } catch (err) {
    return taxErrorResponse(err, tenantId)
  }
}
