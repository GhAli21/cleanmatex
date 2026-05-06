import { DiscountRuleListScreen } from '@/src/features/marketing/ui/discount-rule-list-screen';

export const metadata = { title: 'Discount Rules — CleanMateX' };

/** /dashboard/marketing/discount-rules */
export default function DiscountRulesPage() {
  return (
    <div className="container mx-auto py-6">
      <DiscountRuleListScreen />
    </div>
  );
}
