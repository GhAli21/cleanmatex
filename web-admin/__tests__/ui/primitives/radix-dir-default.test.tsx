import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { CmxTabs, CmxTabsList, CmxTabsTrigger } from '@ui/primitives/tabs'

describe('Radix wrappers follow the page direction (PR-05)', () => {
  afterEach(() => document.documentElement.removeAttribute('dir'))

  const tabs = (dir?: 'ltr' | 'rtl') => (
    <CmxTabs defaultValue="a" dir={dir}>
      <CmxTabsList>
        <CmxTabsTrigger value="a">A</CmxTabsTrigger>
        <CmxTabsTrigger value="b">B</CmxTabsTrigger>
      </CmxTabsList>
    </CmxTabs>
  )

  test('CmxTabs takes rtl from <html dir="rtl">', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    const { container } = render(tabs())
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl')
  })

  test('an explicit dir still wins', () => {
    document.documentElement.setAttribute('dir', 'rtl')
    const { container } = render(tabs('ltr'))
    expect(container.firstElementChild).toHaveAttribute('dir', 'ltr')
  })
})
