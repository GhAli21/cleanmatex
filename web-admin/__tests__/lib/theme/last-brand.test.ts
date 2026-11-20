import { buildLastBrand, LAST_MODE_COOKIE, parseLastBrand, parseLastMode } from '@/lib/theme/last-brand'
import { DEFAULT_THEME_FOR_TEST } from './theme-fixture'

const STORAGE = 'https://abc.supabase.co/storage/v1/object/public/'
const logo = `${STORAGE}tenants-cmx-public/t1/TENANT_LOGO/t1/f1.webp`
const theme = { ...DEFAULT_THEME_FOR_TEST, seeds: { primary: '#2563EB', secondary: '#0F172A' }, appName: 'Sparkle', appName2: 'سباركل' }

test('round trip: what sign-in writes, the login page reads back', () => {
  const raw = buildLastBrand(theme, logo)
  expect(parseLastBrand(raw, STORAGE)).toEqual({
    logo,
    logoDark: null,
    primary: '#2563EB',
    secondary: '#0F172A',
    name: 'Sparkle',
    name2: 'سباركل',
  })
})

test('the cookie holds only the public brand: no tenant id, user or email, under 1 KB', () => {
  const raw = buildLastBrand(theme, logo)
  expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['logo', 'logoDark', 'name', 'name2', 'primary', 'secondary'])
  expect(raw.length).toBeLessThan(1024)
})

test('a logo outside our public storage, a bad colour or broken JSON is dropped', () => {
  expect(parseLastBrand(buildLastBrand(theme, 'https://evil.example/x.png'), STORAGE)).toBeNull()
  expect(parseLastBrand(JSON.stringify({ logo: null, primary: 'red', secondary: '#0F172A', name: null, name2: null }), STORAGE)).toBeNull()
  expect(parseLastBrand('{not json', STORAGE)).toBeNull()
  expect(parseLastBrand(undefined, STORAGE)).toBeNull()
})

test('no logo is fine; an unbranded STANDARD Organization stores nothing worth showing', () => {
  expect(parseLastBrand(buildLastBrand(theme, null), STORAGE)?.logo).toBeNull()
})

test('the dark logo travels in the cookie and is host-checked; an older cookie without it still reads', () => {
  const dark = `${STORAGE}tenants-cmx-public/t1/TENANT_LOGO/t1/f2.webp`
  expect(parseLastBrand(buildLastBrand(theme, logo, dark), STORAGE)?.logoDark).toBe(dark)
  expect(parseLastBrand(buildLastBrand(theme, logo, 'https://evil.example/x.png'), STORAGE)).toBeNull()
  const old = JSON.stringify({ logo, primary: '#2563EB', secondary: '#0F172A', name: null, name2: null })
  expect(parseLastBrand(old, STORAGE)?.logo).toBe(logo)
})

test('parseLastMode accepts valid color modes and rejects arbitrary values', () => {
  expect(LAST_MODE_COOKIE).toBe('cmx_last_mode')
  expect(parseLastMode('DARK')).toBe('DARK')
  expect(parseLastMode('LIGHT')).toBe('LIGHT')
  expect(parseLastMode('SYSTEM')).toBe('SYSTEM')
  expect(parseLastMode('dark')).toBeNull()
  expect(parseLastMode('INVALID')).toBeNull()
  expect(parseLastMode('')).toBeNull()
  expect(parseLastMode(undefined)).toBeNull()
})
