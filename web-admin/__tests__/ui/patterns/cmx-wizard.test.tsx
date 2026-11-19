import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import ar from '../../../messages/ar/common.json'
import { CmxWizard } from '@ui/patterns/cmx-wizard'

jest.mock('next-intl', () => ({
  useLocale: () => 'ar',
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const raw = (ar as Record<string, unknown>)[key]
    if (typeof raw !== 'string') return key
    if (!values) return raw
    return Object.entries(values).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      raw
    )
  },
}))

const STEPS = [
  { id: 'one', title: 'Step 1' },
  { id: 'two', title: 'Step 2', isOptional: true },
  { id: 'three', title: 'Step 3' },
]

describe('CmxWizard localization', () => {
  it('renders localized navigation and step indicator on intermediate optional step', () => {
    render(
      <CmxWizard steps={STEPS} currentStep={1} onStepChange={jest.fn()} onComplete={jest.fn()}>
        <div>Step body</div>
      </CmxWizard>
    )

    expect(screen.getByRole('button', { name: ar.back })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ar.skip })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ar.cancel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ar.next })).toBeInTheDocument()
    expect(screen.getByText(`الخطوة 2 من 3 (${ar.optional})`)).toBeInTheDocument()
  })

  it('renders localized complete label on final step', () => {
    render(
      <CmxWizard steps={STEPS} currentStep={2} onStepChange={jest.fn()} onComplete={jest.fn()}>
        <div>Final body</div>
      </CmxWizard>
    )

    expect(screen.getByRole('button', { name: ar.complete })).toBeInTheDocument()
  })
})
