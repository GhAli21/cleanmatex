import { getTranslations } from 'next-intl/server';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { POS_SESSIONS_DASHBOARD_ACCESS } from '@features/pos-sessions/access/pos-sessions-access';
import { PosSessionsScreen } from '@features/pos-sessions/ui/pos-sessions-screen';

export default async function PosSessionsPage() {
  const t = await getTranslations('posSessions');
  const requiredPermission = POS_SESSIONS_DASHBOARD_ACCESS.page.permissions?.[0] ?? 'pos_session:view';
  const canView = await hasPermissionServer(requiredPermission);

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">{t('accessDeniedTitle')}</h2>
          <p className="mt-1">{t('accessDeniedDescription', { permission: requiredPermission })}</p>
        </div>
      </div>
    );
  }

  return <PosSessionsScreen />;
}
