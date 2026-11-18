import { buildLastBrand, parseLastBrand } from '@/lib/theme/last-brand'
import { DEFAULT_THEME_FOR_TEST } from './theme-fixture'

const STORAGE = 'https://abc.supabase.co/storage/v1/object/public/'
const logo = `${STORAGE}tenants-cmx-public/t1/TENANT_LOGO/t1/f1.webp`
const theme = { ...DEFAULT_THEME_FOR_TEST, seeds: { primary: '#2563EB', secondary: '#0F172A' }, appName: 'Sparkle', appName2: 'سباركل' }

test('round trip: what sign-in writes, the login page reads back', () => {
  const raw = buildLastBrand(theme, logo)
  expect(parseLastBrand(raw, STORAGE)).toEqual({
    logo,
    primary: '#2563EB',
    secondary: '#0F172A',
    name: 'Sparkle',
    name2: 'سباركل',
  })
})

test('the cookie holds only the public brand: no tenant id, user or email, under 1 KB', () => {
  const raw = buildLastBrand(theme, logo)
  expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['logo', 'name', 'name2', 'primary', 'secondary'])
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
