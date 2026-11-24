import '@testing-library/jest-dom'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

import { TenantPickerDialog } from '@features/auth/ui/tenant-picker-dialog'
import type { TenantChoice } from '@/types/auth'

const TENANTS: TenantChoice[] = [
  { orgUserId: 'ou-1', tenantOrgId: 't-1', name: 'Demo Laundry LLC', name2: 'شركة ديمو للغسيل' },
  { orgUserId: 'ou-2', tenantOrgId: 't-2', name: 'Demo Saudi Riyadh Dry Clean', name2: 'مغسلة الرياض تجريبي' },
]

describe('TenantPickerDialog', () => {
  it('allows choosing an organization or cancelling when idle', () => {
    const onChoose = jest.fn()
    const onCancel = jest.fn()

    render(
      <TenantPickerDialog
        open
        tenants={TENANTS}
        lastChosenTenantId="t-1"
        isSubmitting={false}
        title="Choose an organization"
        hint="Pick one"
        lastLabel="Last used"
        cancelLabel="Cancel sign-in"
        onChoose={onChoose}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Demo Laundry LLC/i }))
    expect(onChoose).toHaveBeenCalledWith('ou-1')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel sign-in' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('locks all buttons and blocks Escape/close while submitting', () => {
    const onChoose = jest.fn()
    const onCancel = jest.fn()

    render(
      <TenantPickerDialog
        open
        tenants={TENANTS}
        lastChosenTenantId="t-1"
        isSubmitting
        choosingOrgUserId="ou-1"
        title="Choose an organization"
        hint="Pick one"
        lastLabel="Last used"
        cancelLabel="Cancel sign-in"
        onChoose={onChoose}
        onCancel={onCancel}
      />,
    )

    const org1 = screen.getByRole('button', { name: /Demo Laundry LLC/i })
    const org2 = screen.getByRole('button', { name: /Demo Saudi Riyadh Dry Clean/i })
    const cancel = screen.getByRole('button', { name: 'Cancel sign-in' })

    expect(org1).toBeDisabled()
    expect(org2).toBeDisabled()
    expect(cancel).toBeDisabled()

    fireEvent.click(org2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onChoose).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
