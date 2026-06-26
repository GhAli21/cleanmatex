import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_DISCOUNT_RULES_ACCESS } from '@features/marketing/access/marketing-access'
import { DiscountRuleListScreen } from '@/src/features/marketing/ui/discount-rule-list-screen';

export const metadata = { title: 'Discount Rules — CleanMateX' };

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
