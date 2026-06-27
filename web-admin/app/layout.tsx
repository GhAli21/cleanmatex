import type { Metadata } from "next";
//import { AuthProvider } from "@/lib/auth/auth-context";
import '@mdi/font/css/materialdesignicons.min.css';
import { AppProviders } from '@/lib/providers/AppProviders'
import { loadLocaleMessages } from '@/lib/i18n/load-locale-messages'
import { getLocaleFromCookies } from '@/lib/utils/locale.server';
import "./globals.css";

export const metadata: Metadata = {
  title: "CleanMateX - Laundry Management System",
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
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body
        className="antialiased"
      >
        <AppProviders locale={locale} messages={messages}>
         {children}
        </AppProviders>
      </body>
    </html>
  );
}
