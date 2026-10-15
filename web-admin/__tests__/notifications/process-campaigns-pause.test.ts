/** @jest-environment node */
/**
 * Test-matrix row 27: a campaign paused or cancelled while a batch is being processed.
 * Drives the real POST handler against a small in-memory fake of the Supabase client.
 */
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}
/** Called after every outbox insert so a test can pause/cancel "while the batch is running". */
let afterOutboxInsert: ((count: number) => void) | null = null
let outboxInserts = 0

/** Minimal thenable query builder covering exactly what the route uses. */
function builder(table: string) {
  type Filter = (row: Row) => boolean
  const filters: Filter[] = []
  let action: 'select' | 'update' | 'insert' | 'upsert' = 'select'
  let payload: Row | Row[] = {}
  let head = false
  let wantCount = false
  let single: 'single' | 'maybe' | null = null
  let maxRows = Infinity
  let returning = false

  const run = () => {
    const rows = (db[table] ??= [])
    const matches = () => rows.filter((row) => filters.every((f) => f(row)))
    if (action === 'insert' || action === 'upsert') {
      const list = Array.isArray(payload) ? payload : [payload]
      const created = list.map((item, index) => ({ id: `${table}-${rows.length + index + 1}`, ...item }))
      rows.push(...created)
      if (table === 'org_ntf_outbox_dtl') {
        outboxInserts += created.length
        afterOutboxInsert?.(outboxInserts)
      }
      return { data: single ? created[0] : created, error: null }
    }
    if (action === 'update') {
      const hit = matches()
      hit.forEach((row) => Object.assign(row, payload))
      return { data: returning ? hit.map((row) => ({ id: row.id })) : null, error: null }
    }
    const hit = matches().slice(0, maxRows)
    if (head) return { count: wantCount ? hit.length : null, data: null, error: null }
    if (single === 'single') return { data: hit[0] ?? null, error: hit[0] ? null : { message: 'no rows' } }
    if (single === 'maybe') return { data: hit[0] ?? null, error: null }
    return { data: hit, error: null }
  }

  const api: Record<string, unknown> = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (action === 'select') {
        head = Boolean(opts?.head)
        wantCount = opts?.count === 'exact'
      } else {
        returning = true
      }
      return api
    },
    insert: (row: Row | Row[]) => { action = 'insert'; payload = row; return api },
    upsert: (row: Row[]) => { action = 'upsert'; payload = row; return api },
    update: (row: Row) => { action = 'update'; payload = row; return api },
    eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return api },
    is: (column: string, value: unknown) => { filters.push((row) => (row[column] ?? null) === value); return api },
    in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return api },
    // Phase A selects APPROVED/SCHEDULED campaigns; the fake data never contains any.
    or: () => { filters.push((row) => row.status === 'APPROVED' || row.status === 'SCHEDULED'); return api },
    limit: (n: number) => { maxRows = n; return api },
    single: () => { single = 'single'; return api },
    maybeSingle: () => { single = 'maybe'; return api },
    then: (resolve: (value: unknown) => unknown) => resolve(run()),
  }
  return api
}

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/notifications/outbox-auth', () => ({ isOutboxRequestAuthorized: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/supabase/server', () => ({ createAdminSupabaseClient: () => ({ from: (table: string) => builder(table) }) }))
const mockChannelConfig = jest.fn()
jest.mock('@lib/notifications/settings-service', () => ({
  notificationSettingsService: { getChannelConfig: (...args: unknown[]) => mockChannelConfig(...args) },
}))
jest.mock('@lib/notifications/template-renderer', () => ({ renderTemplateByCode: jest.fn() }))

import { POST } from '@/app/api/notifications/process-campaigns/route'

const TENANT = 'tenant-1'
const CAMPAIGN = 'camp-1'

const OPEN_CHANNEL = {
  channelCode: 'EMAIL', isEnabled: true, quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null,
  quietHoursTz: null, dailyLimit: null, activeProvider: null, metadata: null,
}

function seed(targetCount: number) {
  mockChannelConfig.mockResolvedValue(OPEN_CHANNEL)
  db.org_ntf_campaigns_mst = [{
    id: CAMPAIGN, tenant_org_id: TENANT, name: 'Promo', name2: null, description: 'Hello', description2: null,
    channel_code: 'EMAIL', template_code: null, target_segment: null, skip_count: 0, sent_count: 0, queued_count: 0,
    status: 'RUNNING', is_active: true,
  }]
  db.org_ntf_camp_targets_dtl = Array.from({ length: targetCount }, (_, i) => ({
    id: `t${i + 1}`, tenant_org_id: TENANT, campaign_id: CAMPAIGN, recipient_user_id: `u${i + 1}`,
    recipient_address: null, status: 'PENDING',
  }))
  db.org_ntf_user_prefs_dtl = Array.from({ length: targetCount }, (_, i) => ({
    tenant_org_id: TENANT, user_id: `u${i + 1}`, channel_code: 'EMAIL', event_code: null,
    marketing_consent: true, is_enabled: true, updated_at: '2026-01-01', created_at: '2026-01-01',
  }))
  db.org_ntf_outbox_dtl = []
  db.org_ntf_audit_dtl = []
  db.org_ntf_inbox_mst = []
  outboxInserts = 0
  afterOutboxInsert = null
}

const campaign = () => db.org_ntf_campaigns_mst[0]
const statusCount = (status: string) => db.org_ntf_camp_targets_dtl.filter((t) => t.status === status).length
const call = () => POST(new NextRequest('http://localhost/api/notifications/process-campaigns', { method: 'POST' }))

describe('process-campaigns: pause / cancel while a batch is running (matrix row 27)', () => {
  it('sends every target and completes a campaign nobody touched (control)', async () => {
    seed(3)
    const body = await (await call()).json()
    expect(body.targetsQueued).toBe(3)
    expect(db.org_ntf_outbox_dtl).toHaveLength(3)
    expect(campaign().status).toBe('COMPLETED')
  })

  it('stops sending as soon as the campaign is paused mid-batch; the rest stay PENDING and it is NOT completed', async () => {
    seed(5)
    afterOutboxInsert = (count) => { if (count === 2) campaign().status = 'PAUSED' }
    await call()
    expect(db.org_ntf_outbox_dtl).toHaveLength(2)
    expect(statusCount('QUEUED')).toBe(2)
    expect(statusCount('PENDING')).toBe(3)
    expect(campaign().status).toBe('PAUSED')
  })

  it('stops on cancel as well and never flips a CANCELLED campaign to COMPLETED', async () => {
    seed(3)
    afterOutboxInsert = (count) => { if (count === 3) campaign().status = 'CANCELLED' }
    await call() // all three were sent before the cancel landed; the completion write must not overwrite it
    expect(campaign().status).toBe('CANCELLED')
    expect(db.org_ntf_audit_dtl.some((row) => (row.new_value as Row | undefined)?.status === 'COMPLETED')).toBe(false)
  })

  it('does not touch a paused campaign on a later run, and resumes the remaining targets once it is RUNNING again', async () => {
    seed(4)
    afterOutboxInsert = (count) => { if (count === 1) campaign().status = 'PAUSED' }
    await call()
    expect(db.org_ntf_outbox_dtl).toHaveLength(1)

    afterOutboxInsert = null
    await call() // still PAUSED: phase B only selects RUNNING campaigns
    expect(db.org_ntf_outbox_dtl).toHaveLength(1)

    campaign().status = 'RUNNING'
    await call()
    expect(db.org_ntf_outbox_dtl).toHaveLength(4)
    expect(campaign().status).toBe('COMPLETED')
  })
})

describe('process-campaigns: shared delivery policy (R11)', () => {
  afterEach(() => jest.useRealTimers())

  it('defers marketing outbox rows to the end of the tenant quiet window (campaigns now honour quiet hours)', async () => {
    seed(2)
    jest.useFakeTimers({ now: new Date('2026-10-15T23:30:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] })
    mockChannelConfig.mockResolvedValue({ ...OPEN_CHANNEL, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', quietHoursTz: 'UTC' })
    await call()
    expect(db.org_ntf_outbox_dtl).toHaveLength(2)
    for (const row of db.org_ntf_outbox_dtl) expect(row.scheduled_at).toBe('2026-10-16T07:00:00.000Z')
  })

  it('sends immediately outside the quiet window', async () => {
    seed(1)
    jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] })
    mockChannelConfig.mockResolvedValue({ ...OPEN_CHANNEL, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', quietHoursTz: 'UTC' })
    await call()
    expect(db.org_ntf_outbox_dtl[0].scheduled_at).toBe('2026-10-15T12:00:00.000Z')
  })

  it('skips recipients without marketing consent with the policy reason, and defers the whole batch when the channel is disabled', async () => {
    seed(2)
    db.org_ntf_user_prefs_dtl[1].marketing_consent = false
    await call()
    expect(db.org_ntf_camp_targets_dtl.find((t) => t.id === 't2')).toMatchObject({ status: 'SKIPPED', skip_reason: 'NO_MARKETING_CONSENT' })
    expect(db.org_ntf_outbox_dtl).toHaveLength(1)

    seed(2)
    mockChannelConfig.mockResolvedValue({ ...OPEN_CHANNEL, isEnabled: false })
    await call()
    expect(db.org_ntf_outbox_dtl).toHaveLength(0)
    expect(statusCount('PENDING')).toBe(2)
    expect(campaign().status).toBe('RUNNING')
  })
})
