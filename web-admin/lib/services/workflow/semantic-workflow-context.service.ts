import 'server-only';

import type { SemanticWorkflowArtifact } from '@/lib/services/workflow/semantic-workflow-artifact.service';

/**
 * Minimal server-derived workflow context for legacy clients that still need
 * display-only stage capability hints. It never authorizes an action or picks
 * a destination; consumers must use available-actions for that.
 */
export interface SemanticWorkflowContextView {
  profileId: string;
  profileVersionNo: number;
  policyRevision: number;
  enabledScreenKeys: string[];
  primaryOwnerScreenKeys: string[];
  assemblyEnabled: boolean;
  qaEnabled: boolean;
  packingEnabled: boolean;
}

function normalizedScreenKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Projects immutable artifact modules into a read-only compatibility context.
 * Keeping the projection here prevents legacy template flags from silently
 * steering semantic-order UI while the remaining clients are migrated.
 *
 * @example
 * deriveSemanticWorkflowContext(artifact).enabledScreenKeys
 * // ['processing', 'qa', 'ready_release']
 */
export function deriveSemanticWorkflowContext(
  artifact: SemanticWorkflowArtifact,
): SemanticWorkflowContextView {
  const enabledModules = artifact.modules.filter((module) => module.is_enabled);
  const enabledScreenKeys = enabledModules
    .map((module) => normalizedScreenKey(module.screen_key))
    .sort();
  const primaryOwnerScreenKeys = enabledModules
    .filter((module) => module.module_mode === 'primary_owner')
    .map((module) => normalizedScreenKey(module.screen_key))
    .sort();
  const enabledScreens = new Set(enabledScreenKeys);

  return {
    profileId: artifact.profile_id,
    profileVersionNo: artifact.profile_version_no,
    policyRevision: artifact.policy_revision,
    enabledScreenKeys,
    primaryOwnerScreenKeys,
    assemblyEnabled: enabledScreens.has('assembly'),
    qaEnabled: enabledScreens.has('qa'),
    packingEnabled: enabledScreens.has('packing'),
  };
}
