/** @jest-environment node */

jest.mock('@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service', () => ({
  cmxTempUtilsParaService: {
    isUuidCheckEnabled: jest.fn(),
    getUuidRegex: jest.fn(),
  },
}))

import { cmxTempUtilsParaService } from '@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service'
import { createOrderSchema } from '@/lib/validations/order-schema'

const mockedIsUuidCheckEnabled = cmxTempUtilsParaService.isUuidCheckEnabled as jest.Mock
const mockedGetUuidRegex = cmxTempUtilsParaService.getUuidRegex as jest.Mock

const baseInput = {
  customerId: '123e4567-e89b-12d3-a456-426614174000',
  serviceCategory: 'wash-fold',
  bagCount: 2,
}

describe('createOrderSchema.branchId', () => {
  beforeEach(() => {
    mockedIsUuidCheckEnabled.mockReset()
    mockedGetUuidRegex.mockReset()
  })

  it('stays optional regardless of chk_isuuid — missing branchId always passes', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue(null)

    const result = await createOrderSchema.safeParseAsync(baseInput)

    expect(result.success).toBe(true)
    expect(mockedIsUuidCheckEnabled).not.toHaveBeenCalled()
  })

  it('accepts a non-UUID branchId when chk_isuuid is false', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(false)

    const result = await createOrderSchema.safeParseAsync({ ...baseInput, branchId: 'MAIN-BRANCH' })

    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID branchId when chk_isuuid is true', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue(null)

    const result = await createOrderSchema.safeParseAsync({ ...baseInput, branchId: 'MAIN-BRANCH' })

    expect(result.success).toBe(false)
    if (!result.success) {
      const branchIdIssue = result.error.issues.find((i) => i.path.join('.') === 'branchId')
      expect(branchIdIssue?.message).toBe('Invalid branch ID format')
    }
  })

  it('accepts a valid UUID branchId when chk_isuuid is true', async () => {
    mockedIsUuidCheckEnabled.mockResolvedValue(true)
    mockedGetUuidRegex.mockResolvedValue(null)

    const result = await createOrderSchema.safeParseAsync({
      ...baseInput,
      branchId: '123e4567-e89b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(true)
  })
})
