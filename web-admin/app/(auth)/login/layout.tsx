import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { LoginBrandProvider } from '@features/auth/ui/login-brand'
import { DEFAULT_THEME } from '@/lib/services/ui-theme.service'
import { LAST_BRAND_COOKIE, parseLastBrand } from '@/lib/theme/last-brand'
import { themeStyleCss } from '@/lib/theme/theme-style'

/**
 * Login route shell: applies the brand of the Organization last signed in on
 * this device (colours as a style block, logo and name through context).
 * @param props - children (the login page)
 * @returns The branded login shell
 */
export default async function LoginLayout({ children }: { children: ReactNode }) {
  const storage = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')}/storage/v1/object/public/`
  const brand = parseLastBrand((await cookies()).get(LAST_BRAND_COOKIE)?.value, storage)
  const css = brand ? themeStyleCss({ ...DEFAULT_THEME, seeds: { primary: brand.primary, secondary: brand.secondary } }) : ''

  return (
    <LoginBrandProvider brand={brand}>
      {css ? <style id="cmx-login-brand" dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </LoginBrandProvider>
  )
}
