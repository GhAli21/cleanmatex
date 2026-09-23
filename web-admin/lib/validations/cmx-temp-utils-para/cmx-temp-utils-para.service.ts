/**
 * CmxTempUtilsPara Service
 *
 * Reads the HQ temp parameter row from cmx_p_tmp (platform HQ, service-role
 * only — not tenant-facing) and exposes its flags as simple functions to call
 * when needed, e.g. isUuidCheckEnabled(). More flags can be added to the same
 * row/table later and exposed the same way.
 *
 * cmx_p_tmp is shared with cleanmatexsaas' platform-api; only rows scoped
 * 'CMX' or 'BOTH' (is_hq_or_cmx_or_both) are visible here, lowest rec_order first.
 *
 * Missing table / row / errors -> fail-closed defaults (chk_isuuid: true).
 * Cache TTL: 30 min (module-level; warm across requests in Node.js).
 * Call invalidate() after any write to cmx_p_tmp.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type { CmxPTmpRow, CmxTempUtilsPara } from './cmx-temp-utils-para.types'

const CACHE_TTL_MS = 30 * 60_000
const TABLE_NAME = 'cmx_p_tmp'

/** cmx_p_tmp.is_hq_or_cmx_or_both values visible to this (CMX) app. */
const CMX_VISIBLE_SCOPES = ['CMX', 'BOTH'] as const

const DEFAULT_PARAMS: CmxTempUtilsPara = {
  id: '',
  chk_isuuid: true,
  is_active: true,
  rec_status: 1,
  rec_notes: null,
  uuid_regex: null,
}

interface CacheEntry {
  value: CmxTempUtilsPara
  expiresAt: number
}

class CmxTempUtilsParaService {
  private cache: CacheEntry | null = null

  /**
   * Returns the active cmx_p_tmp parameter values (cached briefly).
   * Falls back to defaults on any read failure.
   */
  async getParams(): Promise<CmxTempUtilsPara> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.value
    }

    const row = await this.readActiveRow()
    const value: CmxTempUtilsPara = row
      ? {
          id: row.id,
          chk_isuuid: row.chk_isuuid === true,
          is_active: row.is_active !== false,
          rec_status: row.rec_status,
          rec_notes: row.rec_notes,
          uuid_regex: row.uuid_regex,
        }
      : DEFAULT_PARAMS

    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  }

  /**
   * Whether conditional UUID format checks should run.
   * Fails closed: no visible row (missing/deactivated/wrong scope) or a read
   * error both resolve to true, same as an explicit chk_isuuid = true row.
   * @returns false only when a visible row exists with chk_isuuid = false
   */
  async isUuidCheckEnabled(): Promise<boolean> {
    const params = await this.getParams()
    return params.chk_isuuid === true
  }

  /**
   * The UUID pattern to validate against when isUuidCheckEnabled() is true.
   * @returns cmx_p_tmp.uuid_regex, or null when unset (caller falls back to its own default)
   */
  async getUuidRegex(): Promise<string | null> {
    const params = await this.getParams()
    return params.uuid_regex && params.uuid_regex.length > 0 ? params.uuid_regex : null
  }

  /** Call after any write to cmx_p_tmp so the next read picks up fresh values. */
  invalidate(): void {
    this.cache = null
  }

  private async readActiveRow(): Promise<CmxPTmpRow | null> {
    try {
      const supabase = createAdminSupabaseClient()
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('id, chk_isuuid, is_active, rec_status, rec_order, rec_notes, uuid_regex, is_hq_or_cmx_or_both, created_at, created_by, created_info, updated_at, updated_by, updated_info')
        .eq('is_active', true)
        .eq('rec_status', 1)
        .in('is_hq_or_cmx_or_both', CMX_VISIBLE_SCOPES)
        .order('rec_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        logger.warn(`cmx_p_tmp read failed: ${error.message}`, { feature: 'cmx-temp-utils-para' })
        return null
      }

      if (!data) {
        logger.warn(
          'cmx_p_tmp: no visible row matched (is_active/rec_status/scope) — falling back to fail-closed defaults',
          { feature: 'cmx-temp-utils-para' }
        )
      }

      return data ?? null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn(`cmx_p_tmp read threw: ${message}`, { feature: 'cmx-temp-utils-para' })
      return null
    }
  }
}

/** Singleton — import this wherever a cmx_p_tmp flag needs to be read. */
export const cmxTempUtilsParaService = new CmxTempUtilsParaService()
