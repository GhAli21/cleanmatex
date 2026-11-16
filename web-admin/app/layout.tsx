import type { Metadata } from "next";
import { Noto_Sans_Arabic } from 'next/font/google';
//import { AuthProvider } from "@/lib/auth/auth-context";
import '@mdi/font/css/materialdesignicons.min.css';
import { AppProviders } from '@/lib/providers/AppProviders'
import { loadLocaleMessages } from '@/lib/i18n/load-locale-messages'
import { getLocaleFromCookies } from '@/lib/utils/locale.server';
import { getTenantTimeZone } from '@/lib/utils/tenant-timezone.server';
import "./globals.css";

// Arabic text face, self-hosted at build time so no request leaves for a font CDN.
// Latin text uses the system font stack (see --font-sans in globals.css).
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
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
  const timeZone = await getTenantTimeZone()
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    // Theme attributes are fixed until the theme resolver (PR-07) supplies the
    // Organization and user values. Values are UPPERCASE to match the database codes.
    <html
      lang={locale}
      dir={dir}
      className={notoSansArabic.variable}
      data-mode="LIGHT"
      data-density="COMFORTABLE"
      data-font-scale="MD"
    >
      <body
        className="antialiased"
      >
        <AppProviders locale={locale} messages={messages} timeZone={timeZone}>
         {children}
        </AppProviders>
      </body>
    </html>
  );
}
