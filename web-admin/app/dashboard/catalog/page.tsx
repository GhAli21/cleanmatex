import { redirect } from 'next/navigation'
import { CATALOG_CATALOG_ACCESS } from '@features/catalog/access/catalog-access'
import { hasPermissionServer } from '@/lib/services/permission-service-server'

/** Catalog index — redirect to services hub when user has admin:manage. */
export default async function CatalogPage() {
  const required = CATALOG_CATALOG_ACCESS.page.permissions ?? []
  const allowed =
    required.length > 0 ? await hasPermissionServer(required[0]!) : true
  if (!allowed) {
    redirect('/dashboard?error=insufficient_permissions')
  }

  redirect('/dashboard/catalog/services')
}
