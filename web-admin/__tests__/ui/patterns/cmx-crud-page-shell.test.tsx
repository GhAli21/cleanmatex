import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell'

const { findRawClasses } = require('../../../scripts/ui/codemod-classes.js') as {
  findRawClasses: (src: string) => { token: string }[]
}

describe('CmxCrudPageShell', () => {
  test('title is the page heading, actions sit beside it, slots render in frame order', () => {
    const { container } = render(
      <CmxCrudPageShell
        breadcrumb={<nav aria-label="crumbs">crumbs</nav>}
        title="Orders"
        subtitle="Manage"
        actions={<a href="/new">New</a>}
        kpis={<div>kpis</div>}
        filters={<div>filters</div>}
      >
        <table aria-label="list" />
      </CmxCrudPageShell>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toHaveClass('cmx-type-page-title')
    expect(screen.getByRole('link', { name: 'New' })).toBeInTheDocument()
    const text = container.textContent ?? ''
    expect(text.indexOf('crumbs')).toBeLessThan(text.indexOf('Orders'))
    expect(text.indexOf('kpis')).toBeLessThan(text.indexOf('filters'))
    expect(screen.getByRole('table', { name: 'list' })).toBeInTheDocument()
  })

  test('optional slots are absent when not given', () => {
    const { container } = render(<CmxCrudPageShell><p>only</p></CmxCrudPageShell>)
    expect(container.querySelector('header')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  test('uses tokens and logical classes only', () => {
    const { container } = render(
      <CmxCrudPageShell title="T" actions={<span />} filters={<span />}><p /></CmxCrudPageShell>,
    )
    expect(findRawClasses(`"${container.innerHTML.replace(/"/g, ' ')}"`)).toEqual([])
  })
})
