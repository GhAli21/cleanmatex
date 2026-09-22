/** @jest-environment node */

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { cmxTempUtilsParaService } from '@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service'

const mockedCreateAdminSupabaseClient = createAdminSupabaseClient as jest.Mock

function makeQueryChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, jest.Mock> = {}
  chain.from = jest.fn(() => chain)
  chain.select = jest.fn(() => chain)
  chain.eq = jest.fn(() => chain)
  chain.order = jest.fn(() => chain)
  chain.limit = jest.fn(() => chain)
  chain.maybeSingle = jest.fn(async () => result)
  return chain
}

describe('cmxTempUtilsParaService', () => {
  beforeEach(() => {
    cmxTempUtilsParaService.invalidate()
    mockedCreateAdminSupabaseClient.mockReset()
  })

  it('returns chk_isuuid false when no row exists', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue(makeQueryChain({ data: null, error: null }))

    const params = await cmxTempUtilsParaService.getParams()

    expect(params.chk_isuuid).toBe(false)
    await expect(cmxTempUtilsParaService.isUuidCheckEnabled()).resolves.toBe(false)
  })

  it('returns chk_isuuid false and does not throw when the read errors', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue(
      makeQueryChain({ data: null, error: { message: 'table not found' } })
    )

    await expect(cmxTempUtilsParaService.isUuidCheckEnabled()).resolves.toBe(false)
  })

  it('returns values from the table when chk_isuuid is true', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue(
      makeQueryChain({
        data: {
          id: 'row-1',
          chk_isuuid: true,
          is_active: true,
          rec_status: 1,
          rec_notes: null,
        },
        error: null,
      })
    )

    const params = await cmxTempUtilsParaService.getParams()

    expect(params).toEqual({
      id: 'row-1',
      chk_isuuid: true,
      is_active: true,
      rec_status: 1,
      rec_notes: null,
    })
    await expect(cmxTempUtilsParaService.isUuidCheckEnabled()).resolves.toBe(true)
  })

  it('caches the result and does not re-read until invalidated', async () => {
    const chain = makeQueryChain({
      data: { id: 'row-1', chk_isuuid: true, is_active: true, rec_status: 1, rec_notes: null },
      error: null,
    })
    mockedCreateAdminSupabaseClient.mockReturnValue(chain)

    await cmxTempUtilsParaService.getParams()
    await cmxTempUtilsParaService.getParams()
    expect(mockedCreateAdminSupabaseClient).toHaveBeenCalledTimes(1)

    cmxTempUtilsParaService.invalidate()
    await cmxTempUtilsParaService.getParams()
    expect(mockedCreateAdminSupabaseClient).toHaveBeenCalledTimes(2)
  })
})
