import { redirect } from 'next/navigation';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { MARKETING_MARKETING_ACCESS } from '@features/marketing/access/marketing-access';

/** Marketing index — gate then redirect to promo codes. */
export default async function MarketingPage() {
  const required = MARKETING_MARKETING_ACCESS.page.permissions ?? [];
  const checks = await Promise.all(required.map((p) => hasPermissionServer(p)));
  const requireAll = MARKETING_MARKETING_ACCESS.page.requireAllPermissions !== false;
  const allowed = requireAll ? checks.every(Boolean) : checks.some(Boolean);
  if (!allowed) {
    redirect('/dashboard');
  }
  redirect('/dashboard/marketing/promos');
}
