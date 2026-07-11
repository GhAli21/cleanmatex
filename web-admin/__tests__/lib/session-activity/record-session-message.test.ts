/**
 * Unit tests for record-session-message capture policy
 */

import {
  recordSessionMessage,
  shouldCaptureSessionMessage,
} from '@/lib/session-activity/record-session-message'
import { sessionActivityStore } from '@/lib/session-activity/session-activity-store'

describe('shouldCaptureSessionMessage', () => {
  it('captures error and warning for toast/alert', () => {
    expect(shouldCaptureSessionMessage({ type: 'error', title: 'x', method: 'toast' })).toBe(true)
    expect(shouldCaptureSessionMessage({ type: 'warning', title: 'x', method: 'alert' })).toBe(true)
  })

  it('skips success, info, loading by default', () => {
    expect(shouldCaptureSessionMessage({ type: 'success', title: 'x', method: 'toast' })).toBe(false)
    expect(shouldCaptureSessionMessage({ type: 'info', title: 'x', method: 'toast' })).toBe(false)
    expect(shouldCaptureSessionMessage({ type: 'loading', title: 'x', method: 'toast' })).toBe(false)
  })

  it('skips inline and console', () => {
    expect(shouldCaptureSessionMessage({ type: 'error', title: 'x', method: 'inline' })).toBe(false)
    expect(shouldCaptureSessionMessage({ type: 'error', title: 'x', method: 'console' })).toBe(false)
  })

  it('honors skipSessionLog and forceSessionLog', () => {
    expect(
      shouldCaptureSessionMessage({
        type: 'error',
        title: 'x',
        method: 'toast',
        skipSessionLog: true,
      })
    ).toBe(false)
    expect(
      shouldCaptureSessionMessage({
        type: 'info',
        title: 'x',
        method: 'toast',
        forceSessionLog: true,
      })
    ).toBe(true)
  })
})

describe('recordSessionMessage', () => {
  beforeEach(() => {
    sessionActivityStore.resetForTests()
  })

  it('appends error entries and dedupes within window', () => {
    recordSessionMessage({ type: 'error', title: 'Payment failed', method: 'toast' })
    recordSessionMessage({ type: 'error', title: 'Payment failed', method: 'toast' })

    expect(sessionActivityStore.getSnapshot().entries).toHaveLength(1)
    expect(sessionActivityStore.getUnreadCount()).toBe(1)
  })

  it('does not append success without force', () => {
    recordSessionMessage({ type: 'success', title: 'Saved', method: 'toast' })
    expect(sessionActivityStore.getSnapshot().entries).toHaveLength(0)
  })
})
