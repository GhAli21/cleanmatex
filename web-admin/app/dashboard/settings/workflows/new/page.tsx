"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_WORKFLOW_CONFIG = {
  service_category_code: null,
  workflow_steps: ['INTAKE', 'PREPARATION', 'SORTING', 'WASHING', 'DRYING', 'FINISHING', 'ASSEMBLY', 'QA', 'PACKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  status_transitions: {
    DRAFT: ['INTAKE', 'CANCELLED'],
    INTAKE: ['PREPARATION', 'CANCELLED'],
    PREPARATION: ['SORTING', 'CANCELLED'],
    SORTING: ['WASHING', 'FINISHING', 'CANCELLED'],
    WASHING: ['DRYING', 'CANCELLED'],
    DRYING: ['FINISHING', 'CANCELLED'],
    FINISHING: ['ASSEMBLY', 'PACKING', 'CANCELLED'],
    ASSEMBLY: ['QA', 'CANCELLED'],
    QA: ['PACKING', 'WASHING', 'CANCELLED'],
    PACKING: ['READY', 'CANCELLED'],
    READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'READY', 'CANCELLED'],
    DELIVERED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
  },
  quality_gate_rules: {
    READY: {
      requireAllItemsAssembled: true,
      requireQAPassed: true,
      requireNoUnresolvedIssues: true,
    },
  },
  is_active: true,
};

export default function NewWorkflowPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState(JSON.stringify(DEFAULT_WORKFLOW_CONFIG, null, 2));

  async function onCreate() {
    try {
      setError(null);
      const body = JSON.parse(json);
      const res = await fetch('/api/v1/workflows/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error || 'Create failed');
      router.push('/dashboard/settings/workflows');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">New Workflow Configuration</h1>
      {error && <div className="p-4 bg-red-50 text-red-800 rounded">{error}</div>}
      <div className="space-y-2">
        <label className="text-sm font-medium">Workflow JSON Configuration</label>
        <textarea
          className="w-full h-96 border rounded p-2 font-mono text-sm"
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Set <code className="bg-gray-100 px-1 rounded">service_category_code</code> to <code className="bg-gray-100 px-1 rounded">null</code> for default workflow, or specify a category code for category-specific workflow.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
        <button onClick={onCreate} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
      </div>
    </div>
  );
}

