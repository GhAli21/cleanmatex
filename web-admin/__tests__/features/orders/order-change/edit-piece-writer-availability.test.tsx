import { fireEvent, render, screen } from '@testing-library/react';
import { PreSubmissionPiecesManager } from '@features/orders/ui/pre-submission-pieces-manager';
import type { OrderChangeEditPolicyInfo } from '@/lib/types/order-change';

let mockSession: { editPolicy: OrderChangeEditPolicyInfo } | null = null;
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));
// Load the real controls without the barrel's unrelated authenticated money field.
jest.mock('@ui/primitives', () => ({
  ...jest.requireActual('@ui/primitives/cmx-button'),
  ...jest.requireActual('@ui/primitives/cmx-input'),
  ...jest.requireActual('@ui/primitives/cmx-textarea'),
  ...jest.requireActual('@ui/primitives/cmx-checkbox'),
}));
jest.mock('@features/orders/order-change/order-workspace-session', () => ({ useOrderWorkspaceSessionOptional: () => mockSession }));

const policy: OrderChangeEditPolicyInfo = {
  status: 'READY', workflowStatus: 'processing', editPolicyId: 'policy', policyRevision: 1,
  assignment: { tenantOrgId: 'tenant', assignmentId: null, profileId: null, profileCode: null, profileVersionId: null,
    versionNo: null, versionStatus: null, editPolicyId: 'policy', policyCode: null, policyName: null, policyName2: null, lifecycleStatus: 'PUBLISHED' },
  rules: [
    { operationCode: 'CHANGE_PIECE_BRAND', targetType: 'PIECE', decision: 'ALLOW', requiresReason: false },
    { operationCode: 'CHANGE_PIECE_RACK', targetType: 'PIECE', decision: 'ALLOW', requiresReason: false },
  ],
};

describe('persisted-piece writer availability in the shared workspace', () => {
  beforeEach(() => { mockSession = null; });

  it('leaves Create brand and rack entry available', () => {
    const onChange = jest.fn();
    render(<PreSubmissionPiecesManager itemId="item" pieces={[{ id: 'piece', itemId: 'item', pieceSeq: 1 }]} onPiecesChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'viewPieces' }));
    expect((screen.getByPlaceholderText('brandPlaceholder') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByPlaceholderText('rackLocationPlaceholder') as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByPlaceholderText('brandPlaceholder'), { target: { value: 'Brand' } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ brand: 'Brand' })]);
  });

  it('blocks unshipped Edit writers even when their policy cells allow them', () => {
    mockSession = { editPolicy: policy };
    const onChange = jest.fn();
    render(<PreSubmissionPiecesManager itemId="item" pieces={[{ id: 'piece', itemId: 'item', pieceSeq: 1 }]} onPiecesChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'viewPieces' }));
    expect((screen.getByPlaceholderText('brandPlaceholder') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText('rackLocationPlaceholder') as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('brandPlaceholder'), { target: { value: 'Bypass' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByText('capability.notAvailable')).toHaveLength(2);
  });
});
