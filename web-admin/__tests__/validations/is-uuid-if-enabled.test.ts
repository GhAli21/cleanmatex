/** @jest-environment node */

jest.mock('@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service', () => ({
  cmxTempUtilsParaService: {
    isUuidCheckEnabled: jest.fn(),
  },
}))

import { cmxTempUtilsParaService } from '@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service'
import {
  isUuidFormat,
  isUuidIfEnabled,
} from '@/lib/validations/cmx-temp-utils-para/validators/is-uuid-if-enabled'

const mockedIsUuidCheckEnabled = cmxTempUtilsParaService.isUuidCheckEnabled as jest.Mock

describe('isUuidFormat', () => {
  it('accepts a well-formed UUID', () => {
    expect(isUuidFormat('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    expect(isUuidFormat('not-a-uuid')).toBe(false)
  })
})

describe('isUuidIfEnabled', () => {
  beforeEach(() => {
    mockedIsUuidCheckEnabled.mockReset()
  })

  it('skips the check when chk_isuuid is false', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(false)
    await expect(isUuidIfEnabled('not-a-uuid')).resolves.toBe(true)
  })

  it('requires UUID format when chk_isuuid is true', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    await expect(isUuidIfEnabled('not-a-uuid')).resolves.toBe(false)
    await expect(isUuidIfEnabled('123e4567-e89b-12d3-a456-426614174000')).resolves.toBe(true)
  })

  it('allows empty values so presence checks own that concern', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    await expect(isUuidIfEnabled('')).resolves.toBe(true)
    await expect(isUuidIfEnabled(undefined)).resolves.toBe(true)
    await expect(isUuidIfEnabled(null)).resolves.toBe(true)
  })

  it('rejects non-string values when the check is enabled', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    await expect(isUuidIfEnabled(12345)).resolves.toBe(false)
  })
})
