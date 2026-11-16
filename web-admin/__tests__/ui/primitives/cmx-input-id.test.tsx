import '@testing-library/jest-dom'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { CmxInput } from '@ui/primitives/cmx-input'

it('gives two inputs with the same label different ids', () => {
  render(
    <>
      <CmxInput label="Name" />
      <CmxInput label="Name" />
    </>
  )
  const [a, b] = screen.getAllByLabelText('Name')
  expect(a.id).toBeTruthy()
  expect(a.id).not.toBe(b.id)
})

it('keeps an id the caller passes', () => {
  render(<CmxInput label="Email" id="email-field" />)
  expect(screen.getByLabelText('Email').id).toBe('email-field')
})
