/**
 * T13 — Tenant cannot edit workflow transitions (authz-by-redirect).
 *
 * The tenant-side legacy JSON workflow editors are retired: `/dashboard/
 * settings/workflows/new` and `/dashboard/settings/workflows/[id]/edit` must
 * unconditionally redirect to the read-only hub rather than render an editor.
 * HQ-side authoring is separately enforced by `rejectLegacyWorkflowMutation()`
 * (`LEGACY_WORKFLOW_RETIRED`, cleanmatexsaas); this proves the tenant-repo
 * half of that contract: there is no reachable tenant UI path to mutate a
 * workflow transition at all.
 */

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import NewWorkflowPage from '@/app/dashboard/settings/workflows/new/page';
import EditWorkflowPage from '@/app/dashboard/settings/workflows/[id]/edit/page';

describe('T13 — tenant workflow editors redirect instead of rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects /dashboard/settings/workflows/new to the read-only hub', () => {
    expect(() => NewWorkflowPage()).toThrow(
      'NEXT_REDIRECT:/dashboard/settings/workflows',
    );
  });

  it('redirects /dashboard/settings/workflows/[id]/edit to the read-only hub', () => {
    expect(() => EditWorkflowPage()).toThrow(
      'NEXT_REDIRECT:/dashboard/settings/workflows',
    );
  });
});
