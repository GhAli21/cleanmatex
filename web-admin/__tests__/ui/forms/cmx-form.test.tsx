import '@testing-library/jest-dom'
import * as React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

import { CmxForm } from '@ui/forms/cmx-form'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxInput } from '@ui/primitives/cmx-input'

interface DemoValues {
  email: string
}

function DemoForm({
  onSubmit,
  isPending = false,
}: {
  onSubmit: (values: DemoValues) => Promise<void> | void
  isPending?: boolean
}) {
  const form = useForm<DemoValues>({ defaultValues: { email: 'user@example.com' } })
  return (
    <CmxForm form={form} onSubmit={onSubmit} isPending={isPending}>
      <CmxInput label="Email" {...form.register('email')} />
      <CmxButton type="submit">Submit</CmxButton>
    </CmxForm>
  )
}

describe('CmxForm submit lock', () => {
  it('disables all nested controls while submitting and blocks duplicate submits', async () => {
    let resolveSubmit!: () => void
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        }),
    )

    render(<DemoForm onSubmit={onSubmit} />)

    const input = screen.getByLabelText('Email')
    const button = screen.getByRole('button', { name: 'Submit' })

    expect(input).toBeEnabled()
    expect(button).toBeEnabled()

    // Trigger rapid double submit before the first promise resolves
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(input).toBeDisabled()
      expect(button).toBeDisabled()
    })

    await act(async () => {
      resolveSubmit()
    })

    await waitFor(() => {
      expect(input).toBeEnabled()
      expect(button).toBeEnabled()
    })
  })

  it('keeps controls locked when isPending is true (e.g. during post-submit redirect)', () => {
    const onSubmit = jest.fn()
    render(<DemoForm onSubmit={onSubmit} isPending />)

    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })
})
