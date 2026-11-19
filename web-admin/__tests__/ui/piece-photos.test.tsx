import '@testing-library/jest-dom';
import type React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetchFiles = jest.fn();
let mockPermissions: string[] = [];

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ currentTenant: { tenant_id: 'tenant-1' }, permissions: mockPermissions }),
}));
jest.mock('@/lib/hooks/use-has-permission', () => ({
  useHasPermission: (resource: string, action: string) => mockPermissions.includes(`${resource}:${action}`),
}));
jest.mock('@features/file-util/api/file-util-api', () => ({
  fetchFiles: (...args: unknown[]) => mockFetchFiles(...args),
}));
jest.mock('@features/file-util', () => ({ FileAttachments: () => null }));
// Keep the test on the control: plain stand-ins for the shared button and dialog.
jest.mock('@ui/primitives', () => ({
  CmxButton: ({ children, onClick, 'aria-label': label }: { children: React.ReactNode; onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} aria-label={label}>{children}</button>
  ),
}));
jest.mock('@ui/overlays', () => ({
  CmxDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CmxDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CmxDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CmxDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import { PiecePhotosControl } from '@/src/features/orders/ui/pieces/piece-photos';

const ORDER = 'order-1';

function renderControl(pieceId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PiecePhotosControl orderId={ORDER} refId={pieceId} label="P-1" source="ORDER_PROCESSING" />
    </QueryClientProvider>,
  );
}

describe('PiecePhotosControl', () => {
  beforeEach(() => {
    mockFetchFiles.mockReset();
  });

  it('renders nothing and fetches nothing without orders:read', () => {
    mockPermissions = [];
    const { container } = renderControl('piece-a');
    expect(container).toBeEmptyDOMElement();
    expect(mockFetchFiles).not.toHaveBeenCalled();
  });

  it('counts only the photos tagged to this piece, from one order-wide list', async () => {
    mockPermissions = ['orders:read'];
    mockFetchFiles.mockResolvedValue([
      { id: '1', refTypeCode: 'ORDER_PIECE', refId: 'piece-a' },
      { id: '2', refTypeCode: 'ORDER_PIECE', refId: 'piece-a' },
      { id: '3', refTypeCode: 'ORDER_PIECE', refId: 'piece-b' },
      { id: '4', refTypeCode: 'ORDER_ISSUE', refId: 'piece-a' },
      { id: '5', refTypeCode: null, refId: null },
    ]);
    renderControl('piece-a');
    expect(await screen.findByText('piecePhotosCount:{"count":2}')).toBeInTheDocument();
    expect(mockFetchFiles).toHaveBeenCalledWith('ORDER_FILE', [ORDER], undefined, expect.anything());
  });

  it('counts item photos (ORDER_ITEM) when used for an item, not piece photos with the same id', async () => {
    mockPermissions = ['orders:read'];
    mockFetchFiles.mockResolvedValue([
      { id: '1', refTypeCode: 'ORDER_ITEM', refId: 'item-a' },
      { id: '2', refTypeCode: 'ORDER_PIECE', refId: 'item-a' },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PiecePhotosControl orderId={ORDER} refType="ORDER_ITEM" refId="item-a" label="Shirt" source="ORDER_QA" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('piecePhotosCount:{"count":1}')).toBeInTheDocument();
  });

  it('offers to add photos when the piece has none', async () => {
    mockPermissions = ['orders:read'];
    mockFetchFiles.mockResolvedValue([]);
    renderControl('piece-a');
    expect(await screen.findByText('piecePhotosAdd')).toBeInTheDocument();
  });
});
