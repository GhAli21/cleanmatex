import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

import { CmxDataTable } from '@ui/data-display/cmx-datatable'

type SampleRow = {
  id: string
  label: string
  amount: string
  legacyAmount: string
}

describe('CmxDataTable logical align and density CSS variables', () => {
  it('maps logical and deprecated align values to logical CSS alignment classes and density variables', () => {
    const { container } = render(
      <CmxDataTable<SampleRow>
        data={[{ id: '1', label: 'Shirt', amount: '12.500', legacyAmount: '5.000' }]}
        columns={[
          { key: 'label', header: 'Item', render: (r) => r.label, align: 'start', sortable: false },
          { key: 'amount', header: 'Amount', render: (r) => r.amount, align: 'end', sortable: false },
          { key: 'legacyAmount', header: 'Legacy', render: (r) => r.legacyAmount, align: 'right', sortable: false },
        ]}
      />
    )

    const amountCell = screen.getByText('12.500').closest('td')
    const legacyCell = screen.getByText('5.000').closest('td')
    expect(amountCell).toHaveClass('text-end', 'px-[var(--cmx-cell-px)]')
    expect(legacyCell).toHaveClass('text-end')
    expect(legacyCell).not.toHaveClass('text-right')

    const bodyRow = container.querySelector('tbody tr')
    expect(bodyRow).toHaveClass('h-[var(--cmx-row-h)]')
  })
})
