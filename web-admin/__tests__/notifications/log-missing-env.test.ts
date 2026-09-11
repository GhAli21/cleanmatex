import { collectMissingEnv } from '@lib/notifications/log-missing-env'

describe('collectMissingEnv', () => {
  const original = process.env.TWILIO_ACCOUNT_SID

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TWILIO_ACCOUNT_SID
    } else {
      process.env.TWILIO_ACCOUNT_SID = original
    }
  })

  it('lists blank and unset keys only', () => {
    process.env.TWILIO_ACCOUNT_SID = '   '
    expect(collectMissingEnv(['TWILIO_ACCOUNT_SID', 'CMX_TEST_ENV_NEVER_SET'])).toEqual([
      'TWILIO_ACCOUNT_SID',
      'CMX_TEST_ENV_NEVER_SET',
    ])
  })

  it('ignores populated keys', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxx'
    expect(collectMissingEnv(['TWILIO_ACCOUNT_SID'])).toEqual([])
  })
})
