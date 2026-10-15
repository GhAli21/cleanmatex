/** @jest-environment node */
/**
 * Delivery policy (R11): consent and quiet-hours decisions with an injected clock, so the rules that
 * events, campaigns and test sends share are pinned without fake timers.
 */
import { computeScheduledAt, decideDelivery } from '@lib/notifications/delivery-policy'
import type { ChannelConfig } from '@lib/notifications/settings-service'

const CONFIG: ChannelConfig = {
  channelCode: 'EMAIL', isEnabled: true, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00',
  quietHoursTz: 'UTC', dailyLimit: null, activeProvider: null, metadata: null,
}
const at = (iso: string) => new Date(iso)

describe('computeScheduledAt', () => {
  it('sends immediately outside the quiet window', () => {
    const now = at('2026-10-15T12:00:00Z')
    expect(computeScheduledAt(CONFIG, 'NORMAL', false, now)).toEqual(now)
  })

  it('defers an overnight window to its end, before and after midnight', () => {
    expect(computeScheduledAt(CONFIG, 'NORMAL', false, at('2026-10-15T23:30:00Z'))).toEqual(at('2026-10-16T07:00:00Z'))
    expect(computeScheduledAt(CONFIG, 'NORMAL', false, at('2026-10-15T03:00:00Z'))).toEqual(at('2026-10-15T07:00:00Z'))
  })

  it('handles a same-day window', () => {
    const day = { ...CONFIG, quietHoursStart: '13:00', quietHoursEnd: '15:00' }
    expect(computeScheduledAt(day, 'NORMAL', false, at('2026-10-15T14:00:00Z'))).toEqual(at('2026-10-15T15:00:00Z'))
    expect(computeScheduledAt(day, 'NORMAL', false, at('2026-10-15T15:00:00Z'))).toEqual(at('2026-10-15T15:00:00Z'))
  })

  it('is immediate for transactional events and for URGENT / CRITICAL priority', () => {
    const now = at('2026-10-15T23:30:00Z')
    expect(computeScheduledAt(CONFIG, 'NORMAL', true, now)).toEqual(now)
    expect(computeScheduledAt(CONFIG, 'URGENT', false, now)).toEqual(now)
    expect(computeScheduledAt(CONFIG, 'CRITICAL', false, now)).toEqual(now)
  })

  it('is immediate when quiet hours are disabled or incomplete', () => {
    const now = at('2026-10-15T23:30:00Z')
    expect(computeScheduledAt({ ...CONFIG, quietHoursEnabled: false }, 'NORMAL', false, now)).toEqual(now)
    expect(computeScheduledAt({ ...CONFIG, quietHoursEnd: null }, 'NORMAL', false, now)).toEqual(now)
  })

  it('evaluates the window in the tenant timezone', () => {
    // 20:30 UTC is 00:30 in Muscat (UTC+4): inside 22:00-07:00 local, ends 07:00 local = 03:00 UTC next day.
    const muscat = { ...CONFIG, quietHoursTz: 'Asia/Muscat' }
    expect(computeScheduledAt(muscat, 'NORMAL', false, at('2026-10-15T20:30:00Z'))).toEqual(at('2026-10-16T03:00:00Z'))
  })
})

describe('decideDelivery', () => {
  const noon = at('2026-10-15T12:00:00Z')

  it('skips a missing or disabled channel with CHANNEL_DISABLED', () => {
    expect(decideDelivery({ channelConfig: null, isTransactional: true, hasMarketingConsent: null, now: noon })).toMatchObject({
      action: 'SKIP', skipReason: 'CHANNEL_DISABLED',
    })
    expect(decideDelivery({ channelConfig: { ...CONFIG, isEnabled: false }, isTransactional: true, hasMarketingConsent: null, now: noon })).toMatchObject({
      action: 'SKIP', skipReason: 'CHANNEL_DISABLED',
    })
  })

  it('sends transactional events without consulting consent', () => {
    expect(decideDelivery({ channelConfig: CONFIG, isTransactional: true, hasMarketingConsent: false, now: noon })).toEqual({ action: 'SEND', scheduledAt: noon })
  })

  it('requires explicit marketing consent: false and unknown both skip with NO_MARKETING_CONSENT', () => {
    for (const consent of [false, null]) {
      expect(decideDelivery({ channelConfig: CONFIG, isTransactional: false, hasMarketingConsent: consent, now: noon })).toMatchObject({
        action: 'SKIP', skipReason: 'NO_MARKETING_CONSENT',
      })
    }
  })

  it('sends consented marketing, deferred to the end of the quiet window', () => {
    const night = at('2026-10-15T23:30:00Z')
    expect(decideDelivery({ channelConfig: CONFIG, isTransactional: false, hasMarketingConsent: true, priority: 'NORMAL', now: night })).toEqual({
      action: 'SEND', scheduledAt: at('2026-10-16T07:00:00Z'),
    })
  })

  it('test mode may bypass consent but never the channel switch', () => {
    expect(decideDelivery({ channelConfig: CONFIG, isTransactional: false, hasMarketingConsent: false, bypassConsent: true, now: noon })).toMatchObject({ action: 'SEND' })
    expect(decideDelivery({ channelConfig: { ...CONFIG, isEnabled: false }, isTransactional: false, hasMarketingConsent: true, bypassConsent: true, now: noon })).toMatchObject({
      action: 'SKIP', skipReason: 'CHANNEL_DISABLED',
    })
  })
})
