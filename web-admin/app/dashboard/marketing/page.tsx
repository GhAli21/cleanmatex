import { redirect } from 'next/navigation';

/** Marketing index — redirect to promo codes sub-page. */
export default function MarketingPage() {
  redirect('/dashboard/marketing/promos');
}
