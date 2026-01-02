/**
 * QA Decision Component
 * QA pass/fail interface
 * PRD-009: Assembly & QA Workflow
 */

'use client';

import { useState } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { usePerformQA } from '../../assembly/hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { CheckCircle2, XCircle, Camera } from 'lucide-react';

interface QADecisionProps {
  taskId: string;
  onDecisionComplete?: () => void;
}

export function QADecision({ taskId, onDecisionComplete }: QADecisionProps) {
  const [decision, setDecision] = useState<'PASS' | 'FAIL' | null>(null);
  const [qaNote, setQaNote] = useState('');
  const [qaPhotoUrl, setQaPhotoUrl] = useState<string | undefined>();
  const { mutate: performQA, isPending } = usePerformQA();
  const { showSuccess, showError } = useMessage();

  const handleDecision = (decisionType: 'PASS' | 'FAIL') => {
    setDecision(decisionType);
  };

  const handleSubmit = () => {
    if (!decision) {
      showError('Please select a QA decision');
      return;
    }

    performQA(
      {
        taskId,
        decisionTypeCode: decision,
        qaNote: qaNote.trim() || undefined,
        qaPhotoUrl,
      },
      {
        onSuccess: () => {
          showSuccess(
            decision === 'PASS' ? 'QA passed successfully' : 'QA failed - order requires rework'
          );
          onDecisionComplete?.();
        },
        onError: (error) => {
          showError(error.message || 'QA decision failed');
        },
      }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Upload to MinIO and get URL
    // For now, create object URL
    const url = URL.createObjectURL(file);
    setQaPhotoUrl(url);
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>Quality Assurance Decision</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <div className="flex gap-4">
          <CmxButton
            variant={decision === 'PASS' ? 'primary' : 'outline'}
            onClick={() => handleDecision('PASS')}
            className="flex-1"
            disabled={isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Pass
          </CmxButton>
          <CmxButton
            variant={decision === 'FAIL' ? 'destructive' : 'outline'}
            onClick={() => handleDecision('FAIL')}
            className="flex-1"
            disabled={isPending}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Fail
          </CmxButton>
        </div>

        {decision && (
          <>
            {decision === 'FAIL' && (
              <div>
                <label className="block text-sm font-medium mb-1">Upload Photo (Optional)</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <CmxButton variant="outline" type="button" asChild>
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        Choose Photo
                      </span>
                    </CmxButton>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {qaPhotoUrl && (
                    <span className="text-sm text-green-600">Photo uploaded</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
              <textarea
                value={qaNote}
                onChange={(e) => setQaNote(e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Add notes about the QA decision..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <CmxButton variant="outline" onClick={() => setDecision(null)} disabled={isPending}>
                Cancel
              </CmxButton>
              <CmxButton onClick={handleSubmit} loading={isPending} disabled={isPending}>
                Submit QA Decision
              </CmxButton>
            </div>
          </>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}

