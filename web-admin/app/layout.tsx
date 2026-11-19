import type { Metadata } from "next";
import localFont from 'next/font/local';
//import { AuthProvider } from "@/lib/auth/auth-context";
import '@mdi/font/css/materialdesignicons.min.css';
import { AppProviders } from '@/lib/providers/AppProviders'
import { loadLocaleMessages } from '@/lib/i18n/load-locale-messages'
import { getLocaleFromCookies } from '@/lib/utils/locale.server';
import { getTenantTimeZone } from '@/lib/utils/tenant-timezone.server';
import { getRequestTheme } from '@/lib/services/ui-theme.service';
import { themeStyleCss } from '@/lib/theme/theme-style';
import { TenantBrandProvider } from '@/lib/theme/tenant-brand';
import "./globals.css";

// Arabic text face (Noto Sans Arabic, OFL, arabic subset, variable 400–700), committed in app/fonts.
// A local file, not next/font/google: the build must not depend on reaching Google Fonts
// (a bad download there failed the Vercel build). Latin text uses the system stack (--font-sans).
const notoSansArabic = localFont({
  src: './fonts/noto-sans-arabic-arabic-wght.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  // Keeps browser-history labels consistent while allowing each route to supply its own context.
  title: {
    default: 'CleanMateX',
    template: '%s — CleanMateX',
  },
  description: "Multi-tenant SaaS platform for laundry and dry cleaning management",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

/**
 *
 * @param root0
 * @param root0.children
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get locale from cookies (server-side compatible)
  const locale = await getLocaleFromCookies();
  const messages = await loadLocaleMessages(locale)
  const [timeZone, theme] = await Promise.all([getTenantTimeZone(), getRequestTheme()])
  const themeCss = themeStyleCss(theme)
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    // Organization theme and the person's preferences, resolved on the server, so
    // there is no flash and no theme script. Values are the UPPERCASE database codes.
    <html
      lang={locale}
      dir={dir}
      className={notoSansArabic.variable}
      data-mode={theme.mode}
      data-density={theme.density}
      data-font-scale={theme.fontScale}
      data-font={theme.fontCode}
    >
      <body
        className="antialiased"
      >
        {/* After the head stylesheets, so these values override tokens.css; empty for the plain STANDARD theme. */}
        {themeCss ? <style id="cmx-theme" dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
        <AppProviders locale={locale} messages={messages} timeZone={timeZone}>
          <TenantBrandProvider value={{ appName: theme.appName, appName2: theme.appName2, logoUrl: theme.logoUrl }}>
            {children}
          </TenantBrandProvider>
        </AppProviders>
      </body>
    </html>
  );
}
