/**
 * New-device sign-in alert: only raised when the DB says one is due, never throws, one event per session.
 */
import { notifyNewDeviceSignIn, type NewDeviceNotification } from '@/lib/services/auth/session/use-cases/new-device-alert'
import { NEW_DEVICE_EVENT_CODE, SESSION_REGISTER_STATUS } from '@/lib/constants/auth-session'
import type { SessionRegistration } from '@/lib/types/auth-session'

const registration = (over: Partial<SessionRegistration> = {}): SessionRegistration => ({
  status: SESSION_REGISTER_STATUS.REGISTERED,
  sessionRowId: 'row-1',
  tenantOrgId: 'tenant-1',
  newDevice: true,
  alertNewDevice: true,
  idleTimeoutSec: 1800,
  idleWarningSec: 60,
  expiresAt: '2026-10-09T00:00:00Z',
  endedSessions: 0,
  ...over,
})

const signIn = { authUserId: 'user-1', deviceLabel: 'Chrome on Windows', ipAddress: '10.0.0.5', signedInAt: new Date('2026-10-08T12:34:56Z') }

describe('notifyNewDeviceSignIn', () => {
  it('emits the hub event with device, ip and time for the user themselves', async () => {
    const emit = jest.fn<Promise<void>, [NewDeviceNotification]>().mockResolvedValue(undefined)
    await expect(notifyNewDeviceSignIn(registration(), signIn, emit)).resolves.toBe(true)
    const event = emit.mock.calls[0][0]
    expect(event.code).toBe(NEW_DEVICE_EVENT_CODE)
    expect(event.tenantOrgId).toBe('tenant-1')
    expect(event.recipientUserIds).toEqual(['user-1'])
    expect(event.sourceEntityId).toBe('row-1')
    expect(event.variables).toEqual({
      device_label: 'Chrome on Windows',
      ip_address: '10.0.0.5',
      signed_in_at: '2026-10-08 12:34 UTC',
    })
    expect(event.actionUrl).toBe('/dashboard/account/security')
  })

  it('uses a dash when device or ip are unknown', async () => {
    const emit = jest.fn().mockResolvedValue(undefined)
    await notifyNewDeviceSignIn(registration(), { ...signIn, deviceLabel: null, ipAddress: null }, emit)
    expect(emit.mock.calls[0][0].variables).toMatchObject({ device_label: '—', ip_address: '—' })
  })

  it.each([
    ['alert not due', registration({ alertNewDevice: false })],
    ['session already registered', registration({ status: SESSION_REGISTER_STATUS.ALREADY_REGISTERED })],
    ['blocked by session limit', registration({ status: SESSION_REGISTER_STATUS.BLOCKED_SESSION_LIMIT })],
    ['no tenant', registration({ tenantOrgId: null })],
    ['no session row', registration({ sessionRowId: null })],
  ])('does nothing when %s', async (_name, reg) => {
    const emit = jest.fn().mockResolvedValue(undefined)
    await expect(notifyNewDeviceSignIn(reg, signIn, emit)).resolves.toBe(false)
    expect(emit).not.toHaveBeenCalled()
  })

  it('never throws when the hub fails', async () => {
    const emit = jest.fn().mockRejectedValue(new Error('hub down'))
    await expect(notifyNewDeviceSignIn(registration(), signIn, emit)).resolves.toBe(false)
  })
})
