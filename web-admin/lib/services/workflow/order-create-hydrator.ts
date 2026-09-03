import 'server-only';

import {
  getWorkflowCreatePresetDefinition,
  type WorkflowCreatePresetDefinition,
} from '@/lib/constants/workflow-create-presets';
import { WORKFLOW_PROFILE_STAFF_EN } from './workflow-profile-error-catalog';

/** Actor + optional notes supplied at create time for stamp columns. */
export interface OrderCreateHydrationActor {
  userId: string | null;
  now?: Date;
  physicalIntakeInfo?: string | null;
  receivedInfo?: string | null;
}

/** Pure column bag stamped onto org_orders_mst at create. */
export interface OrderCreateHydratedColumns {
  physical_intake_status: string;
  physical_intake_at: Date | null;
  physical_intake_by: string | null;
  physical_intake_info: string | null;
  received_at: Date | null;
  received_info: string | null;
  preparation_status: string;
  prepared_at: Date | null;
  prepared_by: string | null;
}

/** Fail-closed when Initial rule has no usable create preset. */
export class OrderCreatePresetError extends Error {
  readonly code = 'PROFILE_INITIAL_RULES_INVALID';

  constructor(message = WORKFLOW_PROFILE_STAFF_EN.PROFILE_INITIAL_RULES_INVALID) {
    super(message);
    this.name = 'OrderCreatePresetError';
  }
}

/**
 * Builds create-time intake/prep columns from an HQ create preset.
 * Pure: no DB I/O and no money fields.
 */
export function hydrateOrderCreateColumns(
  presetCode: string | null | undefined,
  actor: OrderCreateHydrationActor,
  presetOverride?: WorkflowCreatePresetDefinition | null,
): OrderCreateHydratedColumns {
  const preset = presetOverride ?? getWorkflowCreatePresetDefinition(presetCode);
  if (!preset) {
    throw new OrderCreatePresetError();
  }

  const now = actor.now ?? new Date();
  const actorId = actor.userId?.trim() || null;

  return {
    physical_intake_status: preset.physicalIntakeStatus,
    physical_intake_at: preset.stampPhysicalIntake ? now : null,
    physical_intake_by: preset.stampPhysicalIntake ? actorId : null,
    physical_intake_info: preset.stampPhysicalIntake
      ? (actor.physicalIntakeInfo ?? null)
      : (actor.physicalIntakeInfo ?? null),
    received_at: preset.stampReceived ? now : null,
    received_info: actor.receivedInfo ?? null,
    preparation_status: preset.preparationStatus,
    prepared_at: preset.stampPrepared ? now : null,
    prepared_by: preset.stampPrepared ? actorId : null,
  };
}
