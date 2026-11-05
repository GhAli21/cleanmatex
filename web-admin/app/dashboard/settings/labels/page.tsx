/**
 * Labels & Tags settings route shell (HFC P4, A-49): order label, piece tag and receipt barcode settings for all
 * branches or one branch. Server-rendered so the page contract's `settings:read` requirement is enforced before
 * the client screen loads data. Saving needs `settings:update` (screen + API).
 */
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { LabelPrintingSettingsScreen } from '@features/settings/labels/ui/label-printing-settings-screen';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Labels & Tags' };

/** Enforces the route contract before rendering the label settings. */
export default async function LabelSettingsRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer(SETTINGS_PERMISSIONS.READ);

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{tCommon('error')}</div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <LabelPrintingSettingsScreen />
    </Suspense>
  );
}
