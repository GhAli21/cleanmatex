/**
 * The "last brand" cookie: the public brand of the Organization last signed in
 * on this device, so the login page shows it before anyone signs in (design 5.2).
 * It holds no ids or personal data, and is re-validated whenever it is read,
 * because a browser can send any cookie value.
 *
 * @module lib/theme/last-brand
 */

import { z } from 'zod'
import { UI_COLOR_MODES, type UiColorMode } from '@/lib/constants/ui-theme'
import type { ResolvedTheme } from '@/lib/types/ui-theme'

export const LAST_BRAND_COOKIE = 'cmx_last_brand'
export const LAST_MODE_COOKIE = 'cmx_last_mode'
/** 180 days: the brand of a counter tablet rarely changes. */
export const LAST_BRAND_MAX_AGE_SEC = 180 * 24 * 60 * 60

const modeSchema = z.enum(UI_COLOR_MODES)

/**
 * Validate the remembered color mode cookie before letting it set `<html data-mode>`.
 * @param raw - Cookie value
 * @returns A known UiColorMode, or null when unset or invalid
 */
export function parseLastMode(raw: string | undefined): UiColorMode | null {
  if (!raw) return null
  const parsed = modeSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const name = z.string().min(1).max(80).nullable()

const schema = z
  .object({ logo: z.string().url().max(500).nullable(), logoDark: z.string().url().max(500).nullable().optional(), primary: hex, secondary: hex, name, name2: name })
  .strict()

export type LastBrand = z.infer<typeof schema>

/**
 * Cookie value for one Organization's resolved theme and published logo URL.
 * @param theme - The Organization's resolved theme (no user preferences needed)
 * @param logoUrl - `org_tenants_mst.logo_url` (File Util's published MAIN logo), or null
 * @param logoDarkUrl - `org_tenants_mst.logo_dark_url` (published DARK logo), or null
 * @returns JSON text for the cookie
 */
export function buildLastBrand(theme: ResolvedTheme, logoUrl: string | null, logoDarkUrl: string | null = null): string {
  const value: LastBrand = {
    logo: logoUrl || null,
    logoDark: logoDarkUrl || null,
    primary: theme.seeds.primary,
    secondary: theme.seeds.secondary,
    name: theme.appName,
    name2: theme.appName2,
  }
  return JSON.stringify(value)
}

/**
 * Read the cookie back; anything malformed, or a logo outside our public storage, gives null.
 * @param raw - Cookie value
 * @param publicStoragePrefix - `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
 * @returns The brand, or null
 */
export function parseLastBrand(raw: string | undefined, publicStoragePrefix: string): LastBrand | null {
  if (!raw) return null
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    if (parsed.data.logo && !parsed.data.logo.startsWith(publicStoragePrefix)) return null
    if (parsed.data.logoDark && !parsed.data.logoDark.startsWith(publicStoragePrefix)) return null
    return parsed.data
  } catch {
    return null
  }
}
