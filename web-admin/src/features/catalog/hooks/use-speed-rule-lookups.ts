'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { useServiceSpeeds } from '@features/orders/hooks/use-service-speeds';
import { fetchSpeedRuleBranches, fetchSpeedRuleCategories } from '../api/speed-rules-api';

/** Branches and categories change rarely; one read per visit is enough. */
const LOOKUP_STALE_MS = 5 * 60 * 1000;

/**
 * The menu options of the Speed Pricing screen. Branches are scoped to the
 * authenticated tenant, so their cache key carries it. STANDARD is left out of the
 * speeds: it has no premium, and the database refuses a rule for it.
 * @returns speeds, branches and categories as `{ value, label }`, with label lookups
 * @example const { speedOptions, branchLabel } = useSpeedRuleLookups();
 */
export function useSpeedRuleLookups() {
  const locale = useLocale();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const { speeds, labelOf: speedLabel } = useServiceSpeeds();
  const pick = (en: string | null | undefined, ar: string | null | undefined) => (locale === 'ar' ? ar || en : en || ar) ?? '';

  const branches = useQuery({
    queryKey: ['speed-rules', 'branches', tenantId],
    queryFn: ({ signal }) => fetchSpeedRuleBranches(signal),
    // Prevent the query before the tenant is confirmed.
    enabled: !!tenantId,
    staleTime: LOOKUP_STALE_MS,
  });
  const categories = useQuery({
    queryKey: ['speed-rules', 'categories', tenantId],
    queryFn: ({ signal }) => fetchSpeedRuleCategories(signal),
    enabled: !!tenantId,
    staleTime: LOOKUP_STALE_MS,
  });

  const branchOptions = useMemo(
    () => (branches.data ?? []).map((b) => ({ value: b.id, label: pick(b.branch_name ?? b.name, b.branch_name2 ?? b.name2) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pick` only reads locale
    [branches.data, locale],
  );
  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.service_category_code, label: pick(c.ctg_name, c.ctg_name2) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pick` only reads locale
    [categories.data, locale],
  );
  const standardRank = speeds.find((s) => s.code === SERVICE_SPEEDS.STANDARD)?.display_order ?? 0;
  const speedOptions = speeds
    .filter((s) => s.code !== SERVICE_SPEEDS.STANDARD)
    .map((s) => ({
      value: s.code,
      label: speedLabel(s.code),
      defaultUnit: s.default_turnaround_unit,
      // A speed ranked below Standard may be cheaper (D3); the server checks it again.
      allowsDiscount: s.display_order < standardRank,
    }));

  return {
    speedOptions,
    branchOptions,
    categoryOptions,
    speedLabel,
    branchLabel: (id: string) => branchOptions.find((o) => o.value === id)?.label ?? id,
    categoryLabel: (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code,
  };
}
