/**
 * Re-export of the unified Lookup-First CustomerCreateModal from the Customers feature.
 * Eliminates the duplicated POS create modal so both Customers Dashboard and POS New Order
 * share identical lookup-first (phone/email -> sys_customers_mst -> org_customers_mst) behavior.
 */

export {
  CustomerCreateModal,
  default,
  type CustomerCreateModalProps,
} from '@/src/features/customers/ui/customer-create-modal';
