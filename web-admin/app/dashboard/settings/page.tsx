/**
 * Settings root page
 *
 * Thin redirect to the consolidated All Settings view at
 * /dashboard/settings/allsettings. The outer layout (header
 * + primary section tabs) is provided by layout.tsx.
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

/** Identifies the settings entry point before its canonical redirect. */
export const metadata: Metadata = { title: 'Settings' };

/**
 *
 */
export default function SettingsRootPage() {
  redirect('/dashboard/settings/allsettings');
}
