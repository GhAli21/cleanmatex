import { redirect } from 'next/navigation';

/** Redirects `/dashboard/b2b` to the primary B2B customers workspace. */
export default function B2bIndexPage() {
  redirect('/dashboard/b2b/customers');
}
