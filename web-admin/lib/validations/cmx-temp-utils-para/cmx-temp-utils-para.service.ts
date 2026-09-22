/**
 * CmxTempUtilsPara Service
 *
 * Reads the HQ temp parameter row from cmx_p_tmp (platform HQ, service-role
 * only — not tenant-facing) and exposes its flags as simple functions to call
 * when needed, e.g. isUuidCheckEnabled(). More flags can be added to the same
 * row/table later and exposed the same way.
 *
 * Missing table / row / errors -> safe defaults (chk_isuuid: false).
 * Cache TTL: 15 s (module-level; warm across requests in Node.js).
 * Call invalidate() after any write to cmx_p_tmp.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type { CmxPTmpRow, CmxTempUtilsPara } from './cmx-temp-utils-para.types'

const CACHE_TTL_MS = 15_000
const TABLE_NAME = 'cmx_p_tmp'

const DEFAULT_PARAMS: CmxTempUtilsPara = {
  id: '',
  chk_isuuid: false,
  is_active: true,
  rec_status: 1,
  rec_notes: null,
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
        }
      : DEFAULT_PARAMS

    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  }

  /**
   * Whether conditional UUID format checks should run.
   * @returns true only when cmx_p_tmp.chk_isuuid is true
   */
  async isUuidCheckEnabled(): Promise<boolean> {
    const params = await this.getParams()
    return params.chk_isuuid === true
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
        .select('id, chk_isuuid, is_active, rec_status, rec_order, rec_notes, created_at, created_by, created_info, updated_at, updated_by, updated_info')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        logger.warn(`cmx_p_tmp read failed: ${error.message}`, { feature: 'cmx-temp-utils-para' })
        return null
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
