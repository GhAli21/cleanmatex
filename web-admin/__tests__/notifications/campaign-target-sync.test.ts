/** @jest-environment node */
import {
  mapOutboxStatusToCampaignTargetStatus,
  resolveCampaignTargetForOutbox,
} from '@lib/notifications/campaign-target-sync'
import { createAdminSupabaseClient } from '@lib/supabase/server'
import { OUTBOX_STATUS } from '@lib/notifications/types'

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedCreateAdminSupabaseClient = createAdminSupabaseClient as jest.Mock

describe('mapOutboxStatusToCampaignTargetStatus', () => {
  it('maps SENT to SENT', () => {
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.SENT)).toBe('SENT')
  })

  it('maps FAILED_PERMANENT to FAILED', () => {
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.FAILED_PERMANENT)).toBe('FAILED')
  })

  it('maps SKIPPED to SKIPPED', () => {
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.SKIPPED)).toBe('SKIPPED')
  })

  it('returns null for FAILED_TEMPORARY (still retrying — not a campaign-target terminal transition)', () => {
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.FAILED_TEMPORARY)).toBeNull()
  })

  it('returns null for PROCESSING/QUEUED/CANCELLED/DELIVERED/READ', () => {
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.PROCESSING)).toBeNull()
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.QUEUED)).toBeNull()
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.CANCELLED)).toBeNull()
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.DELIVERED)).toBeNull()
    expect(mapOutboxStatusToCampaignTargetStatus(OUTBOX_STATUS.READ)).toBeNull()
  })
})

describe('resolveCampaignTargetForOutbox', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns true and passes the expected RPC args when the DB function resolves a matching QUEUED target', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null })
    mockedCreateAdminSupabaseClient.mockReturnValue({ rpc })

    const result = await resolveCampaignTargetForOutbox('tenant-1', 'outbox-1', 'SENT', null)

    expect(result).toBe(true)
    expect(rpc).toHaveBeenCalledWith('fn_ntf_camp_target_resolve', {
      p_outbox_id: 'outbox-1',
      p_tenant_org_id: 'tenant-1',
      p_target_status: 'SENT',
      p_skip_reason: null,
    })
  })

  it('returns false (no throw) when the DB function reports no matching QUEUED row — safe no-op for a duplicate/redelivered call', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null })
    mockedCreateAdminSupabaseClient.mockReturnValue({ rpc })

    const result = await resolveCampaignTargetForOutbox('tenant-1', 'outbox-1', 'FAILED', 'Some error')

    expect(result).toBe(false)
  })

  it('returns false and logs (does not throw) when the RPC call itself errors', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    mockedCreateAdminSupabaseClient.mockReturnValue({ rpc })

    const result = await resolveCampaignTargetForOutbox('tenant-1', 'outbox-1', 'SKIPPED', 'reason')

    expect(result).toBe(false)
  })
})
