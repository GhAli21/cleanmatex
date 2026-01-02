/**
 * Exception Dialog Component
 * Record missing/wrong/damaged items
 * PRD-009: Assembly & QA Workflow
 */

'use client';

import { useState } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useMessage } from '@ui/feedback/useMessage';
import { AlertTriangle, X } from 'lucide-react';

interface ExceptionDialogProps {
  taskId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const EXCEPTION_TYPES = [
  { value: 'MISSING', label: 'Missing Item' },
  { value: 'WRONG_ITEM', label: 'Wrong Item' },
  { value: 'DAMAGED', label: 'Damaged Item' },
  { value: 'EXTRA', label: 'Extra Item' },
  { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
];

const SEVERITY_LEVELS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export function ExceptionDialog({ taskId, onClose, onSuccess }: ExceptionDialogProps) {
  const [exceptionType, setExceptionType] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useMessage();

  const handleSubmit = async () => {
    if (!exceptionType || !description.trim()) {
      showError('Exception type and description are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/assembly/tasks/${taskId}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionTypeCode: exceptionType,
          severity,
          description: description.trim(),
          description2: descriptionAr.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('Exception recorded successfully');
        onSuccess?.();
        onClose();
      } else {
        showError(result.error || 'Failed to record exception');
      }
    } catch (error) {
      showError('Failed to record exception');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <CmxCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CmxCardHeader className="flex flex-row items-center justify-between">
          <CmxCardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Record Exception
          </CmxCardTitle>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Exception Type *</label>
            <select
              value={exceptionType}
              onChange={(e) => setExceptionType(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">Select type...</option>
              {EXCEPTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            >
              {SEVERITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (English) *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Describe the exception..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (Arabic)</label>
            <textarea
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="وصف الاستثناء..."
              dir="rtl"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <CmxButton variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </CmxButton>
            <CmxButton onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
              Record Exception
            </CmxButton>
          </div>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}

