import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
//import { AuthProvider } from "@/lib/auth/auth-context";
import { AppProviders } from '@/components/providers/AppProviders'
import { getLocaleFromCookies } from '@/lib/utils/locale.server';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CleanMateX - Laundry Management System",
  description: "Multi-tenant SaaS platform for laundry and dry cleaning management",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get locale from cookies (server-side compatible)
  const locale = await getLocaleFromCookies();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders initialLocale={locale}>
         {children}
        </AppProviders>
      </body>
    </html>
  );
}
