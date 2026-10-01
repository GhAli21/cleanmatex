import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

/** Identifies the retired workflow-editor entry point before its canonical redirect. */
export const metadata: Metadata = { title: 'Edit Workflow' };

/**
 * Legacy JSON workflow editor. Tenant runtime is HQ live profiles only.
 */
export default function EditWorkflowPage() {
  redirect('/dashboard/settings/workflows');
}
