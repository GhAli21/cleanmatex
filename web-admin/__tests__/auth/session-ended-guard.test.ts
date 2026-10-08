/**
 * Global SESSION_ENDED detector: reacts only to 401 + SESSION_ENDED from same-origin calls, leaves the body readable.
 */
import { installSessionEndedGuard, isSessionEndedAnswer } from '@features/auth-session/model/session-ended-guard'

describe('isSessionEndedAnswer', () => {
  it('matches only 401 with the SESSION_ENDED code', () => {
    expect(isSessionEndedAnswer(401, { code: 'SESSION_ENDED' })).toBe(true)
    expect(isSessionEndedAnswer(403, { code: 'SESSION_ENDED' })).toBe(false)
    expect(isSessionEndedAnswer(401, { code: 'OTHER' })).toBe(false)
    expect(isSessionEndedAnswer(401, null)).toBe(false)
    expect(isSessionEndedAnswer(401, 'SESSION_ENDED')).toBe(false)
  })
})

describe('installSessionEndedGuard', () => {
  const realFetch = window.fetch
  afterEach(() => {
    window.fetch = realFetch
  })

  /** jsdom has no Response; the guard only needs status/clone()/json(). */
  const fakeResponse = (status: number, body: unknown) => {
    const res = { status, clone: () => res, json: async () => body }
    return res
  }
  const respond = (status: number, body: unknown) =>
    (window.fetch = jest.fn().mockResolvedValue(fakeResponse(status, body)) as unknown as typeof window.fetch)

  it('signals once for a SESSION_ENDED answer and keeps the body readable for the caller', async () => {
    respond(401, { code: 'SESSION_ENDED', error: 'x' })
    const onEnded = jest.fn()
    const uninstall = installSessionEndedGuard(onEnded)
    const res = await window.fetch('/api/orders')
    expect(onEnded).toHaveBeenCalledTimes(1)
    await expect(res.json()).resolves.toMatchObject({ code: 'SESSION_ENDED' })
    uninstall()
  })

  it('ignores other 401s, other statuses and cross-origin calls', async () => {
    const onEnded = jest.fn()
    const uninstall = installSessionEndedGuard(onEnded)
    respond(401, { code: 'INVALID_CREDENTIALS' })
    await window.fetch('/api/auth/login')
    respond(200, { code: 'SESSION_ENDED' })
    await window.fetch('/api/orders')
    respond(401, { code: 'SESSION_ENDED' })
    await window.fetch('https://example.com/api')
    expect(onEnded).not.toHaveBeenCalled()
    uninstall()
  })

  it('restores fetch on uninstall', () => {
    const before = respond(200, {})
    const uninstall = installSessionEndedGuard(jest.fn())
    expect(window.fetch).not.toBe(before)
    uninstall()
    expect(window.fetch).toBe(before)
  })
})
