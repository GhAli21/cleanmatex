import { redirect } from 'next/navigation';

/**
 * Legacy JSON workflow editor. Tenant runtime is HQ live profiles only.
 */
export default function NewWorkflowPage() {
  redirect('/dashboard/settings/workflows');
}
