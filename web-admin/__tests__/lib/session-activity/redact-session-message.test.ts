/**
 * Unit tests for redact-session-message
 */

import {
  redactSessionDescription,
  redactSessionTitle,
} from '@/lib/session-activity/redact-session-message'
import {
  SESSION_ACTIVITY_DESCRIPTION_MAX,
  SESSION_ACTIVITY_TITLE_MAX,
} from '@/lib/session-activity/session-activity-config'

describe('redactSessionMessage', () => {
  it('redacts bearer tokens and JWTs', () => {
    const title = redactSessionTitle(
      'Auth failed Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb'
    )
    expect(title).toContain('[REDACTED]')
    expect(title).not.toContain('eyJhbGci')
  })

  it('redacts card-like digit sequences', () => {
    const title = redactSessionTitle('Card 4111 1111 1111 1111 declined')
    expect(title).toContain('[REDACTED_CARD]')
    expect(title).not.toContain('4111')
  })

  it('truncates long titles and descriptions', () => {
    const long = 'x'.repeat(SESSION_ACTIVITY_TITLE_MAX + 50)
    expect(redactSessionTitle(long).length).toBeLessThanOrEqual(SESSION_ACTIVITY_TITLE_MAX + 1)

    const longDesc = 'y'.repeat(SESSION_ACTIVITY_DESCRIPTION_MAX + 50)
    const desc = redactSessionDescription(longDesc)
    expect(desc!.length).toBeLessThanOrEqual(SESSION_ACTIVITY_DESCRIPTION_MAX + 1)
  })
})
