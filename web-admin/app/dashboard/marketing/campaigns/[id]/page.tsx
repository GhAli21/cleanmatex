import { CampaignDetailPage } from '@features/notifications/ui/campaign-detail-page';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getTranslations } from 'next-intl/server';
import { MARKETING_MARKETING_CAMPAIGNS_DETAIL_ACCESS } from '@features/marketing/access/marketing-access';

interface Props {
  params: Promise<{ id: string }>;
}

/** /dashboard/marketing/campaigns/[id] */
export default async function CampaignDetailRoute({ params }: Props) {
  const { id } = await params;
  const tCommon = await getTranslations('common');
  const required = MARKETING_MARKETING_CAMPAIGNS_DETAIL_ACCESS.page.permissions ?? [];
  const checks = await Promise.all(required.map((p) => hasPermissionServer(p)));
  const requireAll = MARKETING_MARKETING_CAMPAIGNS_DETAIL_ACCESS.page.requireAllPermissions !== false;
  const allowed = requireAll ? checks.every(Boolean) : checks.some(Boolean);

  if (!allowed) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-sm text-muted-foreground">{tCommon('error')}</p>
      </div>
    );
  }

  return <CampaignDetailPage id={id} />;
}
