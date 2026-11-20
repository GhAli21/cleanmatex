/**
 * Feature Flags Settings screen
 *
 * View-only table of feature flags returned from Platform HQ.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives';

interface FeatureFlag {
  flag_key: string;
  name: string;
  name2?: string | null;
  description?: string | null;
  description2?: string | null;
  is_active: boolean;
  plan_binding_type?: string | null;
  ui_group?: string | null;
  category?: string | null;
}

/**
 *
 */
export function FeatureFlagsSettings() {
  const t = useTranslations('settings.advancedSettings');
  const tCommon = useTranslations('common');
  const [flags, setFlags] = React.useState<FeatureFlag[]>([]);
  const [filter, setFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void loadFlags();
  }, []);

  async function loadFlags() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/tenants/me/feature-flags');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.details || json?.error || t('loadErrorFlags'));
      }
      const data = (json.data?.items ?? json.data ?? []) as FeatureFlag[];
      setFlags(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('loadErrorFlags');
      cmxMessage.error(message);
    } finally {
      setLoading(false);
    }
  }

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredFlags = React.useMemo(() => {
    if (!normalizedFilter) return flags;
    return flags.filter((f) => {
      const key = f.flag_key.toLowerCase();
      const name = (f.name || '').toLowerCase();
      const desc = (f.description || '').toLowerCase();
      const category = (f.category || '').toLowerCase();
      const group = (f.ui_group || '').toLowerCase();
      return (
        key.includes(normalizedFilter) ||
        name.includes(normalizedFilter) ||
        desc.includes(normalizedFilter) ||
        category.includes(normalizedFilter) ||
        group.includes(normalizedFilter)
      );
    });
  }, [flags, normalizedFilter]);

  return (
    <CmxCard>
      <CmxCardContent className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('tabFeatureFlags')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('flagsSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CmxInput
              placeholder={t('searchFlagsPlaceholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full md:w-64"
            />
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border text-sm">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('flagColKey')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('flagColName')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('flagColCategory')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('flagColBinding')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('flagColStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border bg-card">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      {t('loadingFlags')}
                    </TableCell>
                  </TableRow>
                ) : filteredFlags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      {t('noFlagsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFlags.map((f) => (
                    <TableRow key={f.flag_key}>
                      <TableCell className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground">
                        {f.flag_key}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="text-foreground text-sm font-medium">
                          {f.name}
                        </div>
                        {f.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {f.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {f.category || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {f.plan_binding_type || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            f.is_active
                              ? 'bg-success-bg text-success-text border border-success-border'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {f.is_active ? tCommon('active') : tCommon('inactive')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}

