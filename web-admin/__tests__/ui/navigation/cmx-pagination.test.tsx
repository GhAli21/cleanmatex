import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import ar from '../../../messages/ar/common.json'
import { CmxPagination } from '@ui/navigation/cmx-pagination'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (ar as Record<string, unknown>)[key] ?? key,
}))

const base = { currentPage: 1, pageSize: 10, onPageChange: () => {}, onPageSizeChange: () => {} }

test('labels and range come from the locale (Arabic)', () => {
  render(<CmxPagination {...base} totalPages={3} totalItems={25} />)
  expect(screen.getByText('صفوف لكل صفحة')).toBeInTheDocument()
  expect(screen.getByText('1-10 من 25')).toBeInTheDocument()
})

test('empty list shows the translated no-data text, also on a single page', () => {
  render(<CmxPagination {...base} totalPages={1} totalItems={0} showWhenSinglePage />)
  expect(screen.getByText('لا توجد بيانات')).toBeInTheDocument()
})

test('caller labels still win', () => {
  render(<CmxPagination {...base} totalPages={1} totalItems={0} showWhenSinglePage labels={{ rowsPerPage: 'Per page', noItems: 'Nothing' }} />)
  expect(screen.getByText('Per page')).toBeInTheDocument()
  expect(screen.getByText('Nothing')).toBeInTheDocument()
})
