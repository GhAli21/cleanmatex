import type { Database } from '@/types/database'

/** Row shape for public.cmx_p_tmp (HQ temp parameter table, service-role only). */
export type CmxPTmpRow = Database['public']['Tables']['cmx_p_tmp']['Row']

/** Domain values returned by cmxTempUtilsParaService. */
export interface CmxTempUtilsPara {
  id: string
  chk_isuuid: boolean
  is_active: boolean
  rec_status: number | null
  rec_notes: string | null
}
