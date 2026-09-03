/**
 * Create-time hydration presets — mirror of sys_wf_create_presets_cd.
 * DB is authority; these codes must stay verbatim.
 */

export const WORKFLOW_CREATE_PRESETS = {
  REMOTE_DRAFT: 'REMOTE_DRAFT',
  POS_IN_HAND: 'POS_IN_HAND',
  POS_QUICK_DROP: 'POS_QUICK_DROP',
  RETAIL_SOLD: 'RETAIL_SOLD',
  STAFF_IN_HAND: 'STAFF_IN_HAND',
  HOME_COLLECTION_PENDING: 'HOME_COLLECTION_PENDING',
  BRANCH_DEFAULT: 'BRANCH_DEFAULT',
} as const;

export type WorkflowCreatePresetCode =
  (typeof WORKFLOW_CREATE_PRESETS)[keyof typeof WORKFLOW_CREATE_PRESETS];

/** Column stamps applied when a create preset is selected. */
export interface WorkflowCreatePresetDefinition {
  createPresetCode: WorkflowCreatePresetCode;
  physicalIntakeStatus: 'pending_dropoff' | 'received' | 'not_applicable';
  stampPhysicalIntake: boolean;
  stampReceived: boolean;
  preparationStatus: 'pending' | 'in_progress' | 'completed';
  stampPrepared: boolean;
}

/** Seed mirror used when the DB preset row is not yet loaded into the resolver. */
export const WORKFLOW_CREATE_PRESET_DEFINITIONS: Record<
  WorkflowCreatePresetCode,
  WorkflowCreatePresetDefinition
> = {
  REMOTE_DRAFT: {
    createPresetCode: 'REMOTE_DRAFT',
    physicalIntakeStatus: 'pending_dropoff',
    stampPhysicalIntake: false,
    stampReceived: false,
    preparationStatus: 'pending',
    stampPrepared: false,
  },
  POS_IN_HAND: {
    createPresetCode: 'POS_IN_HAND',
    physicalIntakeStatus: 'received',
    stampPhysicalIntake: true,
    stampReceived: true,
    preparationStatus: 'pending',
    stampPrepared: false,
  },
  POS_QUICK_DROP: {
    createPresetCode: 'POS_QUICK_DROP',
    physicalIntakeStatus: 'received',
    stampPhysicalIntake: true,
    stampReceived: true,
    preparationStatus: 'pending',
    stampPrepared: false,
  },
  RETAIL_SOLD: {
    createPresetCode: 'RETAIL_SOLD',
    physicalIntakeStatus: 'received',
    stampPhysicalIntake: true,
    stampReceived: true,
    preparationStatus: 'completed',
    stampPrepared: true,
  },
  STAFF_IN_HAND: {
    createPresetCode: 'STAFF_IN_HAND',
    physicalIntakeStatus: 'received',
    stampPhysicalIntake: true,
    stampReceived: true,
    preparationStatus: 'pending',
    stampPrepared: false,
  },
  HOME_COLLECTION_PENDING: {
    createPresetCode: 'HOME_COLLECTION_PENDING',
    physicalIntakeStatus: 'pending_dropoff',
    stampPhysicalIntake: false,
    stampReceived: false,
    preparationStatus: 'pending',
    stampPrepared: false,
  },
  BRANCH_DEFAULT: {
    createPresetCode: 'BRANCH_DEFAULT',
    physicalIntakeStatus: 'received',
    stampPhysicalIntake: true,
    stampReceived: true,
    preparationStatus: 'pending',
    stampPrepared: false,
  },
};

/**
 * Resolves a preset definition from a code string.
 * @returns Definition or null when the code is unknown/inactive.
 */
export function getWorkflowCreatePresetDefinition(
  code: string | null | undefined,
): WorkflowCreatePresetDefinition | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!(trimmed in WORKFLOW_CREATE_PRESET_DEFINITIONS)) return null;
  return WORKFLOW_CREATE_PRESET_DEFINITIONS[trimmed as WorkflowCreatePresetCode];
}
