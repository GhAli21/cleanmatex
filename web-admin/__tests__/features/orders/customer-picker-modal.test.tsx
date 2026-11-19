/**
 * PR-04 Task 3: the customer picker runs on CmxDialog — one named dialog, Escape closes it,
 * arrows + Enter pick, skeleton rows while searching, phone in <bdi class="tabular-nums">.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: null, isLoading: false }) }));
jest.mock('@/lib/api/customers', () => ({ searchCustomersForPicker: jest.fn() }));
jest.mock('@features/orders/ui/customer-create-modal', () => ({ CustomerCreateModal: () => null }));

const search = { customers: [] as unknown[], isLoading: false, isFetching: false, error: null, isReady: true };
jest.mock('@/lib/hooks/use-customer-search', () => ({
  CUSTOMER_SEARCH_MIN_CHARS: 2,
  useCustomerSearch: () => search,
}));

import { CustomerPickerModal } from '@features/orders/ui/customer-picker-modal';

const P = 'newOrder.customerPicker';
const people = [
  { id: 'c1', displayName: 'Ali', firstName: 'Ali', phone: '+968 9111 1111', source: 'current_tenant', belongsToCurrentTenant: true },
  { id: 'c2', displayName: 'Sara', firstName: 'Sara', phone: '+968 9222 2222', source: 'current_tenant', belongsToCurrentTenant: true },
];

function open(over: Partial<typeof search> = {}) {
  Object.assign(search, { customers: [], isLoading: false, isFetching: false, error: null, isReady: true }, over);
  const onClose = jest.fn();
  const onSelectCustomer = jest.fn();
  render(<CustomerPickerModal open onClose={onClose} onSelectCustomer={onSelectCustomer} />);
  return { onClose, onSelectCustomer };
}

const typeSearch = () => fireEvent.change(screen.getByRole('textbox', { name: `${P}.searchPlaceholder` }), { target: { value: 'ali' } });

describe('CustomerPickerModal on CmxDialog', () => {
  it('is one dialog named by its title, with focus in the search box', async () => {
    open();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: `${P}.title` })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: `${P}.searchPlaceholder` })).toHaveFocus());
  });

  it('Escape calls onClose', () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole('textbox', { name: `${P}.searchPlaceholder` }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Arrow Down then Enter picks the second result', () => {
    const { onSelectCustomer } = open({ customers: people });
    typeSearch();
    const input = screen.getByRole('textbox', { name: `${P}.searchPlaceholder` });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectCustomer).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
  });

  it('shows skeleton rows in a busy region while searching, not a spinner', () => {
    open({ isLoading: true });
    typeSearch();
    const list = screen.getByRole('listbox');
    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(list.querySelectorAll('[data-testid="customer-skeleton-row"]')).toHaveLength(5);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('renders the phone inside <bdi class="tabular-nums">', () => {
    open({ customers: people });
    typeSearch();
    const bdi = screen.getByText('+968 9111 1111');
    expect(bdi.tagName).toBe('BDI');
    expect(bdi).toHaveClass('tabular-nums');
  });
});
