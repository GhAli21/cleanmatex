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
  chain.in = jest.fn(() => chain)
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

  it('fails closed (chk_isuuid true) when no row exists', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue(makeQueryChain({ data: null, error: null }))

    const params = await cmxTempUtilsParaService.getParams()

    expect(params.chk_isuuid).toBe(true)
    await expect(cmxTempUtilsParaService.isUuidCheckEnabled()).resolves.toBe(true)
  })

  it('fails closed (chk_isuuid true) and does not throw when the read errors', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue(
      makeQueryChain({ data: null, error: { message: 'table not found' } })
    )

    await expect(cmxTempUtilsParaService.isUuidCheckEnabled()).resolves.toBe(true)
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
          uuid_regex: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
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
      uuid_regex: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    })
    await expect(cmxTempUtilsParaService.isUuidCheckEnabled()).resolves.toBe(true)
    await expect(cmxTempUtilsParaService.getUuidRegex()).resolves.toBe(
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  })

  it('getUuidRegex returns null when uuid_regex is null or empty', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue(
      makeQueryChain({
        data: { id: 'row-1', chk_isuuid: true, is_active: true, rec_status: 1, rec_notes: null, uuid_regex: null },
        error: null,
      })
    )
    await expect(cmxTempUtilsParaService.getUuidRegex()).resolves.toBeNull()
  })

  it('filters to CMX/BOTH scope and orders by rec_order', async () => {
    const chain = makeQueryChain({
      data: { id: 'row-1', chk_isuuid: false, is_active: true, rec_status: 1, rec_notes: null, uuid_regex: null },
      error: null,
    })
    mockedCreateAdminSupabaseClient.mockReturnValue(chain)

    await cmxTempUtilsParaService.getParams()

    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
    expect(chain.eq).toHaveBeenCalledWith('rec_status', 1)
    expect(chain.in).toHaveBeenCalledWith('is_hq_or_cmx_or_both', ['CMX', 'BOTH'])
    expect(chain.order).toHaveBeenCalledWith('rec_order', { ascending: true })
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('caches the result and does not re-read until invalidated', async () => {
    const chain = makeQueryChain({
      data: {
        id: 'row-1',
        chk_isuuid: true,
        is_active: true,
        rec_status: 1,
        rec_notes: null,
        uuid_regex: null,
      },
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
