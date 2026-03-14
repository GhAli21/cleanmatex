/**
 * B2B Customer Tabs - Contacts, Contracts, Statements
 * Shown on customer detail when type === 'b2b'
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@ui/primitives/button';
import type { B2BContact, B2BContract, B2BStatement } from '@/lib/types/b2b';

interface CustomerB2BContactsTabProps {
  customerId: string;
}

export function CustomerB2BContactsTab({ customerId }: CustomerB2BContactsTabProps) {
  const t = useTranslations('b2b');
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['b2b-contacts', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/b2b-contacts?customer_id=${customerId}`);
      if (!res.ok) throw new Error('Failed to load contacts');
      const json = await res.json();
      return (json.data ?? []) as B2BContact[];
    },
    enabled: !!customerId,
  });

  if (isLoading) {
    return <div className="h-32 bg-gray-100 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {t('addContact')} — {t('primaryContact')} for billing and statements.
      </p>
      {!contacts?.length ? (
        <div className="py-8 text-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">{t('noCustomers') || 'No contacts yet'}</p>
          <p className="text-sm text-gray-400 mt-1">
            Add contacts via API or B2B contacts management.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
            >
              <div>
                <p className="font-medium">{c.contactName || c.contactName2 || '—'}</p>
                <p className="text-sm text-gray-500">
                  {c.email || c.phone || '—'}
                  {c.isPrimary && (
                    <span className="ml-2 text-purple-600">({t('primaryContact')})</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerB2BContractsTab({ customerId }: CustomerB2BContactsTabProps) {
  const t = useTranslations('b2b');
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['b2b-contracts', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/b2b-contracts?customer_id=${customerId}`);
      if (!res.ok) throw new Error('Failed to load contracts');
      const json = await res.json();
      return (json.data ?? []) as B2BContract[];
    },
    enabled: !!customerId,
  });

  if (isLoading) {
    return <div className="h-32 bg-gray-100 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {!contracts?.length ? (
        <div className="py-8 text-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No contracts yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create contracts from the B2B Contracts page.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.assign('/dashboard/b2b/contracts')}
          >
            {t('contracts')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
            >
              <div>
                <p className="font-medium">{c.contractNo}</p>
                <p className="text-sm text-gray-500">
                  {c.effectiveFrom ?? '—'} — {c.effectiveTo ?? '—'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.assign(`/dashboard/b2b/contracts`)}
              >
                {t('view')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerB2BStatementsTab({ customerId }: CustomerB2BContactsTabProps) {
  const t = useTranslations('b2b');
  const { data: statements, isLoading } = useQuery({
    queryKey: ['b2b-statements', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/b2b-statements?customer_id=${customerId}`);
      if (!res.ok) throw new Error('Failed to load statements');
      const json = await res.json();
      return (json.data ?? []) as B2BStatement[];
    },
    enabled: !!customerId,
  });

  if (isLoading) {
    return <div className="h-32 bg-gray-100 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {!statements?.length ? (
        <div className="py-8 text-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No statements yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Generate statements from the B2B Statements page.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.assign('/dashboard/b2b/statements')}
          >
            {t('statements')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {statements.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
            >
              <div>
                <p className="font-medium">{s.statementNo}</p>
                <p className="text-sm text-gray-500">
                  {s.periodFrom ?? '—'} — {s.periodTo ?? '—'} · {s.statusCd}
                </p>
                <p className="text-sm font-medium mt-1">
                  {t('balanceAmount')}: {Number(s.balanceAmount).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.assign(`/dashboard/b2b/statements`)}
              >
                {t('view')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
