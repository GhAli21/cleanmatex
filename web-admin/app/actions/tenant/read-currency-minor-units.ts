'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/server'

const CODE_PATTERN = /^[A-Za-z0-9]{3,8}$/
const MAX_CODES = 32

export type CurrencyMinorUnitRow = {
  code: string
  minor_unit: number
}

export type CurrencyMinorUnitResult =
  | { ok: true; rows: CurrencyMinorUnitRow[] }
  | { ok: false; message: string }

/**
 * Reads `sys_currency_cd.minor_unit` for the given codes.
 *
 * The currency catalog is closed to the public key. Browser hooks and public
 * booking both need the minor unit, and neither may hold the service-role key,
 * so this server action is the only door. The payload is the global minor-unit
 * list, not tenant balances. No session is required because public order
 * tracking and booking resolve currency before a staff session exists.
 * @param codes - Currency codes from the tenant currency profile
 * @returns Matching catalog rows, or a failure the caller turns into a currency error
 */
export async function readCurrencyMinorUnits(codes: string[]): Promise<CurrencyMinorUnitResult> {
  if (!Array.isArray(codes) || codes.length > MAX_CODES) {
    return { ok: false, message: 'currency catalog request was rejected' }
  }
  const normalized = [...new Set(codes.map((code) => code.trim().toUpperCase()))]
  if (normalized.some((code) => !CODE_PATTERN.test(code))) {
    return { ok: false, message: 'currency catalog request was rejected' }
  }
  if (normalized.length === 0) {
    return { ok: true, rows: [] }
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('sys_currency_cd')
    .select('code, minor_unit')
    .in('code', normalized)

  if (error) {
    return { ok: false, message: 'currency catalog is unavailable' }
  }

  const rows = (data ?? []).flatMap((row) => {
    if (typeof row.code !== 'string' || typeof row.minor_unit !== 'number') return []
    return [{ code: row.code, minor_unit: row.minor_unit }]
  })
  return { ok: true, rows }
}
