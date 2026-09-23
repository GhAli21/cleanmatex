/** @jest-environment node */

jest.mock('@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service', () => ({
  cmxTempUtilsParaService: {
    isUuidCheckEnabled: jest.fn(),
    getUuidRegex: jest.fn(),
  },
}))

import { cmxTempUtilsParaService } from '@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service'
import {
  isUuidFormat,
  isUuidIfEnabled,
} from '@/lib/validations/cmx-temp-utils-para/validators/is-uuid-if-enabled'

const mockedIsUuidCheckEnabled = cmxTempUtilsParaService.isUuidCheckEnabled as jest.Mock
const mockedGetUuidRegex = cmxTempUtilsParaService.getUuidRegex as jest.Mock

describe('isUuidFormat', () => {
  it('accepts a well-formed UUID against the default pattern', () => {
    expect(isUuidFormat('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    expect(isUuidFormat('not-a-uuid')).toBe(false)
  })

  it('uses a custom pattern when provided', () => {
    expect(isUuidFormat('abc123', '^[a-z0-9]{6}$')).toBe(true)
    expect(isUuidFormat('123e4567-e89b-12d3-a456-426614174000', '^[a-z0-9]{6}$')).toBe(false)
  })

  it('falls back to the default pattern when the custom pattern fails to compile', () => {
    expect(isUuidFormat('123e4567-e89b-12d3-a456-426614174000', '(unterminated[')).toBe(true)
    expect(isUuidFormat('not-a-uuid', '(unterminated[')).toBe(false)
  })

  it('falls back to the default pattern when given an empty string', () => {
    expect(isUuidFormat('123e4567-e89b-12d3-a456-426614174000', '')).toBe(true)
  })
})

describe('isUuidIfEnabled', () => {
  beforeEach(() => {
    mockedIsUuidCheckEnabled.mockReset()
    mockedGetUuidRegex.mockReset()
  })

  it('skips the check when chk_isuuid is false', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(false)
    await expect(isUuidIfEnabled('not-a-uuid')).resolves.toBe(true)
    expect(mockedGetUuidRegex).not.toHaveBeenCalled()
  })

  it('requires UUID format against the default pattern when uuid_regex is null', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue(null)
    await expect(isUuidIfEnabled('not-a-uuid')).resolves.toBe(false)
    await expect(isUuidIfEnabled('123e4567-e89b-12d3-a456-426614174000')).resolves.toBe(true)
  })

  it('validates against the DB-configured pattern when set', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue('^BR-[0-9]{4}$')
    await expect(isUuidIfEnabled('BR-0042')).resolves.toBe(true)
    await expect(isUuidIfEnabled('123e4567-e89b-12d3-a456-426614174000')).resolves.toBe(false)
  })

  it('allows empty values so presence checks own that concern', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue(null)
    await expect(isUuidIfEnabled('')).resolves.toBe(true)
    await expect(isUuidIfEnabled(undefined)).resolves.toBe(true)
    await expect(isUuidIfEnabled(null)).resolves.toBe(true)
  })

  it('rejects non-string values when the check is enabled', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue(null)
    await expect(isUuidIfEnabled(12345)).resolves.toBe(false)
  })

  it('fails closed (requires UUID format) when isUuidCheckEnabled rejects', async () => {
    mockedIsUuidCheckEnabled.mockRejectedValue(new Error('boom'))
    mockedGetUuidRegex.mockResolvedValue(null)
    await expect(isUuidIfEnabled('not-a-uuid')).resolves.toBe(false)
    await expect(isUuidIfEnabled('123e4567-e89b-12d3-a456-426614174000')).resolves.toBe(true)
  })
})
