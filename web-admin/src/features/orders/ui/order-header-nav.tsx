/**
 * Order Header Navigation Component
 * Top bar with main application links and utility icons
 * Re-Design: PRD-010 Advanced Orders - Section 2
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, HelpCircle, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

interface NavLink {
  href: string;
  label: string;
  active?: boolean;
}

export function OrderHeaderNav() {
  const t = useTranslations('navigation');
  const tOrders = useTranslations('orders');
  const tNewOrder = useTranslations('newOrder');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const pathname = usePathname();
  
  const navLinks: NavLink[] = [
    { href: '/dashboard/orders/new', label: tNewOrder('title') },
    { href: '/dashboard/orders', label: tOrders('detail') },
    { href: '/dashboard/orders/cleaning', label: tOrders('cleaning') },
    { href: '/dashboard/orders/ready', label: tOrders('ready') },
    { href: '/dashboard/orders/pickups', label: tOrders('pickups') },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} h-16 px-6`}>
        {/* Main Navigation Links */}
        <nav className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-all text-sm
                  ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Utility Icons */}
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Search Icon */}
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('search')}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Help Icon */}
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('help')}
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* User Profile */}
          <button
            className="flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
            aria-label={t('userProfile')}
          >
            <User className="w-5 h-5" />
          </button>

          {/* CTA Button */}
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm">
            {t('joinNow')}
          </button>
        </div>
      </div>
    </header>
  );
}
