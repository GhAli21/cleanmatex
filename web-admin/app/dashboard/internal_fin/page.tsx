import type { Metadata } from 'next';

/** Names the internal-finance entry route before it redirects to its workspace. */
export const metadata: Metadata = { title: 'Internal Finance' };

import { redirect } from 'next/navigation';

/** Internal finance index — redirect to invoices hub. */
export default function InternalFinPage() {
  redirect('/dashboard/internal_fin/invoices');
}
