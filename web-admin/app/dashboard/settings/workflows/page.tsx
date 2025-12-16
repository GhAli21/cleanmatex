'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WorkflowConfig {
  id: string;
  service_category_code: string | null;
  is_active: boolean;
  updated_at: string | null;
  created_at: string;
}

export default function WorkflowsPage() {
  const [data, setData] = useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/workflows/config?page=1&limit=100');
        const payload = await res.json();
        if (!payload.success) throw new Error(payload.error || 'Failed to load');
        setData(payload.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workflow Settings</h1>
        <Link href="/dashboard/settings/workflows/new" className="text-blue-600">New</Link>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Service Category</th>
              <th className="text-left p-2">Active</th>
              <th className="text-left p-2">Updated</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.service_category_code || 'DEFAULT'}</td>
                <td className="p-2">{row.is_active ? 'Yes' : 'No'}</td>
                <td className="p-2">{row.updated_at || row.created_at}</td>
                <td className="p-2">
                  <Link href={`/dashboard/settings/workflows/${row.id}/edit`} className="text-blue-600">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


