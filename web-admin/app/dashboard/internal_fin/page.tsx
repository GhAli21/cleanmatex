import { redirect } from 'next/navigation';

/** Internal finance index — redirect to invoices hub. */
export default function InternalFinPage() {
  redirect('/dashboard/internal_fin/invoices');
}
