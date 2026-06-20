import { redirect } from 'next/navigation';

/** Catalog index — redirect to services hub. */
export default function CatalogPage() {
  redirect('/dashboard/catalog/services');
}
