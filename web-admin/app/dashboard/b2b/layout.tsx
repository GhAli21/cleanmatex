/**
 * B2B Layout
 * Gated by b2b_contracts feature flag
 */

import { ReactNode } from 'react';
import { RequireFeature, UpgradePrompt } from '@/src/features/auth/ui/RequireFeature';

export default function B2BLayout({ children }: { children: ReactNode }) {
  return (
    <RequireFeature
      feature="b2b_contracts"
      fallback={<UpgradePrompt feature="b2b_contracts" />}
    >
      {children}
    </RequireFeature>
  );
}
