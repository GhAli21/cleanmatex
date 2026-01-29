/**
 * Loading UI for Invoices list page
 * Reuses the same centered-spinner pattern as preparation/delivery list pages.
 */

export default function InvoicesLoading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
    </div>
  );
}
