"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditWorkflowPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/workflows/config?page=1&limit=100');
        const payload = await res.json();
        if (!payload.success) throw new Error(payload.error || 'Failed to load');
        const row = (payload.data as any[]).find((r) => r.id === params.id);
        if (!row) throw new Error('Config not found');
        setJson(
          JSON.stringify(
            {
              service_category_code: row.service_category_code,
              workflow_steps: row.workflow_steps,
              status_transitions: row.status_transitions,
              quality_gate_rules: row.quality_gate_rules,
              is_active: row.is_active,
            },
            null,
            2
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  async function onSave() {
    try {
      setError(null);
      const body = JSON.parse(json);
      const res = await fetch('/api/v1/workflows/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error || 'Save failed');
      router.push('/dashboard/settings/workflows');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Edit Workflow</h1>
      <textarea
        className="w-full h-96 border rounded p-2 font-mono text-sm"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <div className="flex gap-2">
        <button onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
        <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  );
}


