import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_DISCOUNT_RULES_ACCESS } from '@features/marketing/access/marketing-access'
import { DiscountRuleListScreen } from '@/src/features/marketing/ui/discount-rule-list-screen';
import type { Metadata } from 'next'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Discount Rules' }

/** /dashboard/marketing/discount-rules */
export default function DiscountRulesPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_DISCOUNT_RULES_ACCESS.page.permissions ?? []}>
      <div className="container mx-auto py-6">
      <DiscountRuleListScreen />
    </div>
    </RequireAnyPermission>
  );
}
