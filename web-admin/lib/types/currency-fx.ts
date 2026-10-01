/**
 * Frontend-safe re-exports of the `lib/services/fx/*` row/input types.
 * Type-only, so the `server-only` guard on those service files is erased at
 * compile time and this file is safe to import from client components —
 * matches the existing `lib/types/payment.ts` pattern (CLAUDE.md: types live
 * in `lib/types/`, re-exported for single-import usage).
 */

export type {
  CurrencyPortfolioRow,
  CurrencyActor,
  CurrencyContextInput,
  FxPolicyInput,
  AddCurrencyInput,
  UpdateCurrencyInput,
} from '@/lib/services/fx/org-currency.service';

export type {
  FxRateRow,
  CreateRateInput,
  UpdateRateInput,
  RateListFilters,
} from '@/lib/services/fx/fx-rate.service';

export type { FxSettingsRow, UpdateFxSettingsInput } from '@/lib/services/fx/fx-settings.service';

export type {
  SelectableCurrency,
  FxRateTypeOption,
  FxRateSourceOption,
} from '@/lib/services/fx/fx-lookups.service';

export type {
  HqCopyPreviewRow,
  HqCopyPreviewResult,
  HqCopyCommitResult,
} from '@/lib/services/fx/fx-import.service';

export type { ResolvedRate } from '@/lib/services/fx/fx-rate-resolver.service';
