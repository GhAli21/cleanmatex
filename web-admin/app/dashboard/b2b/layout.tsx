/**
 * B2B Layout
 * Gated by b2b_contracts feature flag
 */

import { ReactNode } from 'react';
import { RequireFeature, UpgradePrompt } from '@/src/features/auth/ui/RequireFeature';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';

export default function B2BLayout({ children }: { children: ReactNode }) {
  return (
    <RequireFeature
      feature={FEATURE_FLAG_KEYS.B2B_CONTRACTS}
      fallback={<UpgradePrompt feature={FEATURE_FLAG_KEYS.B2B_CONTRACTS} />}
    >
      {children}
    </RequireFeature>
  );
}
