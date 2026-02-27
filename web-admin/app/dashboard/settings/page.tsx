/**
 * Settings root page
 *
 * Thin redirect to the consolidated All Settings view at
 * /dashboard/settings/allsettings. The outer layout (header
 * + primary section tabs) is provided by layout.tsx.
 */

import { redirect } from 'next/navigation';

export default function SettingsRootPage() {
  redirect('/dashboard/settings/allsettings');
}
