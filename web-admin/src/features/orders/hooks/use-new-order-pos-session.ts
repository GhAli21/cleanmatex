'use client';

import { useState, type Dispatch } from 'react';
import { useQuery } from '@tanstack/react-query';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  fetchMyActivePosSession,
  posSessionActiveQueryKey,
} from '@features/pos-sessions/api/pos-session-api';
import type { NewOrderAction } from '@features/orders/model/new-order-types';
import type { PosSessionWithContext } from '@/lib/types/pos-session';

export type NewOrderPosSessionMode = 'loading' | 'open' | 'paused' | 'none' | 'error';

/**
 * Keeps a new order inside the cashier's current POS session.
 * An open session locks the branch. A different session clears the draft.
 */
export function useNewOrderPosSessionGate(input: {
  isEditMode: boolean;
  dispatch: Dispatch<NewOrderAction>;
}): {
  mode: NewOrderPosSessionMode;
  session: PosSessionWithContext | null;
  /** Branch the order must use. Null when there is no active session. */
  lockBranchId: string | null;
} {
  const query = useQuery({
    queryKey: posSessionActiveQueryKey('cashier-entry', true),
    enabled: !input.isEditMode,
    queryFn: () => fetchMyActivePosSession({ includeContext: true }),
    staleTime: 15_000,
  });

  const session = query.data?.type === 'ACTIVE' ? query.data.session as PosSessionWithContext : null;
  const mode: NewOrderPosSessionMode = input.isEditMode
    ? 'open'
    : query.isLoading
      ? 'loading'
      : query.isError
        ? 'error'
        : session?.status === POS_SESSION_STATUS.OPEN
          ? 'open'
          : session?.status === POS_SESSION_STATUS.PAUSED
            ? 'paused'
            : 'none';
  const lockBranchId = session?.branch_id ?? null;
  const identity = !input.isEditMode && !query.isLoading && !query.isError
    ? (session?.id ?? 'none')
    : null;

  const [seenIdentity, setSeenIdentity] = useState<string | null>(null);
  if (identity && identity !== seenIdentity) {
    const reset = seenIdentity !== null && seenIdentity !== identity;
    setSeenIdentity(identity);
    input.dispatch({
      type: 'ALIGN_CASHIER_SESSION',
      payload: { branchId: lockBranchId, reset },
    });
  }

  return { mode, session, lockBranchId };
}
