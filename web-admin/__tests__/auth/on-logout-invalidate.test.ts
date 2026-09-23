/** @jest-environment node */

jest.mock('@/lib/services/permission-cache', () => ({
  invalidatePermissionCache: jest.fn(),
}))

jest.mock('@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service', () => ({
  cmxTempUtilsParaService: {
    invalidate: jest.fn(),
  },
}))

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

import { invalidatePermissionCache } from '@/lib/services/permission-cache'
import { cmxTempUtilsParaService } from '@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service'
import { logger } from '@/lib/utils/logger'
import { onLogoutInvalidate } from '@/lib/auth/on-logout-invalidate'

const mockedInvalidatePermissionCache = invalidatePermissionCache as jest.Mock
const mockedCmxInvalidate = cmxTempUtilsParaService.invalidate as jest.Mock
const mockedLoggerWarn = logger.warn as jest.Mock

describe('onLogoutInvalidate', () => {
  beforeEach(() => {
    mockedInvalidatePermissionCache.mockReset()
    mockedCmxInvalidate.mockReset()
    mockedLoggerWarn.mockReset()
  })

  it('invalidates the permission cache and the cmx-temp-utils-para cache when tenantId is present', async () => {
    await onLogoutInvalidate('user-1', 'tenant-1')

    expect(mockedInvalidatePermissionCache).toHaveBeenCalledWith('user-1', 'tenant-1')
    expect(mockedCmxInvalidate).toHaveBeenCalledTimes(1)
  })

  it('skips the permission cache but still invalidates the global cache when tenantId is missing', async () => {
    await onLogoutInvalidate('user-1')

    expect(mockedInvalidatePermissionCache).not.toHaveBeenCalled()
    expect(mockedCmxInvalidate).toHaveBeenCalledTimes(1)
  })

  it('does not throw when an invalidation call fails', async () => {
    mockedInvalidatePermissionCache.mockRejectedValue(new Error('redis down'))
    mockedCmxInvalidate.mockImplementation(() => {
      throw new Error('boom')
    })

    await expect(onLogoutInvalidate('user-1', 'tenant-1')).resolves.toBeUndefined()
    expect(mockedLoggerWarn).toHaveBeenCalledTimes(2)
  })
})
