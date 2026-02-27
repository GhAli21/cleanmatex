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
            <h2 className="text-lg font-semibold text-gray-900">Feature Flags</h2>
            <p className="text-sm text-gray-500">
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

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Key</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Category</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Binding</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Loading feature flags...
                    </td>
                  </tr>
                ) : filteredFlags.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      No feature flags found.
                    </td>
                  </tr>
                ) : (
                  filteredFlags.map((f) => (
                    <tr key={f.flag_key}>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-800">
                        {f.flag_key}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 text-sm font-medium">
                          {f.name}
                        </div>
                        {f.description && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {f.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {f.category || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {f.plan_binding_type || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            f.is_active
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-50 text-gray-500 border border-gray-200'
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

