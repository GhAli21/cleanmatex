/**
 * Feature Flags Settings screen
 *
 * View-only table of feature flags returned from Platform HQ.
 */

'use client';

import React from 'react';
import { cmxMessage } from '@ui/feedback';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxInput } from '@ui/primitives';

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
        throw new Error(json?.details || json?.error || 'Failed to load feature flags');
      }
      const data = (json.data?.items ?? json.data ?? []) as FeatureFlag[];
      setFlags(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load feature flags';
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
            <h2 className="text-lg font-semibold text-foreground">Feature Flags</h2>
            <p className="text-sm text-muted-foreground">
              View all active feature flags defined in Platform HQ that may affect this tenant.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CmxInput
              placeholder="Search flags..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full md:w-64"
            />
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-foreground">Key</th>
                  <th className="px-4 py-2 text-start font-medium text-foreground">Name</th>
                  <th className="px-4 py-2 text-start font-medium text-foreground">Category</th>
                  <th className="px-4 py-2 text-start font-medium text-foreground">Binding</th>
                  <th className="px-4 py-2 text-start font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Loading feature flags...
                    </td>
                  </tr>
                ) : filteredFlags.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No feature flags found.
                    </td>
                  </tr>
                ) : (
                  filteredFlags.map((f) => (
                    <tr key={f.flag_key}>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground">
                        {f.flag_key}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground text-sm font-medium">
                          {f.name}
                        </div>
                        {f.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {f.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {f.category || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {f.plan_binding_type || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            f.is_active
                              ? 'bg-success-bg text-success-text border border-success-border'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {f.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}

