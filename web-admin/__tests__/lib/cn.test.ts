import { cn } from '@/lib/utils'

test('later conflicting utility wins', () => {
  expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
})

test('keeps existing input shapes', () => {
  expect(cn('a', false, null, undefined, ['b', { c: true, d: false }] as never)).toBe('a b c')
})

test('arbitrary-value colour classes conflict by property', () => {
  expect(cn('bg-[rgb(var(--cmx-primary-rgb))]', 'bg-[rgb(var(--cmx-destructive-rgb))]')).toBe(
    'bg-[rgb(var(--cmx-destructive-rgb))]'
  )
})

test('logical and physical spacing are kept apart', () => {
  expect(cn('ps-2 pe-2', 'ps-4')).toBe('pe-2 ps-4')
})
