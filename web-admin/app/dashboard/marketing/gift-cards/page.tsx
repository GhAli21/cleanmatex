import { GiftCardListScreen } from '@/src/features/marketing/ui/gift-card-list-screen';

export const metadata = { title: 'Gift Cards — CleanMateX' };

/** /dashboard/marketing/gift-cards */
export default function GiftCardsPage() {
  return (
    <div className="container mx-auto py-6">
      <GiftCardListScreen />
    </div>
  );
}
