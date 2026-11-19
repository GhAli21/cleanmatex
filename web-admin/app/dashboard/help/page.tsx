/**
 * Help Page
 * Placeholder page for help documentation and support
 */

'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { LifeBuoy, Book, MessageCircle, Mail, ExternalLink, Database } from 'lucide-react';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { HELP_PERMISSIONS } from '@features/help/access/help-access';

/**
 *
 */
export default function HelpPage() {
  const t = useTranslations('help');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <LifeBuoy className="h-8 w-8 text-primary-text" />
          <h1 className="text-3xl font-bold text-start">
            {t('title') || 'Help & Support'}
          </h1>
        </div>
        <p className="text-muted-foreground text-start">
          {t('subtitle') || 'Find answers to your questions and get support'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Documentation Section */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-info-bg rounded-lg">
              <Book className="h-6 w-6 text-primary-text" />
            </div>
            <div className="flex-1 text-start">
              <h2 className="text-xl font-semibold mb-2">
                {t('documentation.title') || 'Documentation'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t('documentation.description') || 'Browse our comprehensive documentation and user guides'}
              </p>
              <a
                href="/api-docs"
                className="text-primary-text hover:text-primary-text/80 font-medium inline-flex items-center gap-2"
              >
                {t('documentation.viewDocs') || 'View Documentation'}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Contact Support Section */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-success-bg rounded-lg">
              <MessageCircle className="h-6 w-6 text-success-text" />
            </div>
            <div className="flex-1 text-start">
              <h2 className="text-xl font-semibold mb-2">
                {t('support.title') || 'Contact Support'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t('support.description') || 'Get in touch with our support team'}
              </p>
              <a
                href="mailto:support@cleanmatex.com"
                className="text-primary-text hover:text-primary-text/80 font-medium inline-flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {t('support.email') || 'support@cleanmatex.com'}
              </a>
            </div>
          </div>
        </div>

        {/* Platform Inventories (authorized staff) */}
        <RequireAnyPermission permissions={[HELP_PERMISSIONS.PLATFORM_INVENTORIES]}>
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <Database className="h-6 w-6 text-foreground" />
              </div>
              <div className="flex-1 text-start">
                <h2 className="text-xl font-semibold mb-2">
                  {t('platformInventories.title')}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {t('platformInventories.cardDescription')}
                </p>
                <Link
                  href="/dashboard/help/platform-inventories"
                  className="text-primary-text hover:text-primary-text/80 font-medium inline-flex items-center gap-2"
                >
                  {t('platformInventories.openViewer')}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </RequireAnyPermission>

        {/* FAQ Section */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-info-bg rounded-lg">
              <Book className="h-6 w-6 text-primary-text" />
            </div>
            <div className="flex-1 text-start">
              <h2 className="text-xl font-semibold mb-2">
                {t('faq.title') || 'Frequently Asked Questions'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t('faq.description') || 'Find quick answers to common questions'}
              </p>
              <a
                href="/dashboard/help#faq"
                className="text-primary-text hover:text-primary-text/80 font-medium inline-flex items-center gap-2"
              >
                {t('faq.viewFAQ') || 'View FAQ'}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Quick Links Section */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-warning-bg rounded-lg">
              <LifeBuoy className="h-6 w-6 text-warning-text" />
            </div>
            <div className="flex-1 text-start">
              <h2 className="text-xl font-semibold mb-2">
                {t('quickLinks.title') || 'Quick Links'}
              </h2>
              <ul className="space-y-2 text-start">
                <li>
                  <Link href="/dashboard/orders/new" className="text-primary-text hover:text-primary-text/80">
                    {t('quickLinks.newOrder') || 'Create New Order'}
                  </Link>
                </li>
                <li>
                  <a href="/dashboard/settings" className="text-primary-text hover:text-primary-text/80">
                    {t('quickLinks.settings') || 'Settings'}
                  </a>
                </li>
                <li>
                  <Link href="/dashboard/customers" className="text-primary-text hover:text-primary-text/80">
                    {t('quickLinks.customers') || 'Manage Customers'}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Status Information */}
      <div className="mt-8 bg-info-bg border border-info-border rounded-lg p-6">
        <div className="flex items-start gap-3">
          <LifeBuoy className="h-5 w-5 text-primary-text mt-0.5" />
          <div className="flex-1 text-start">
            <h3 className="font-semibold text-primary-text mb-1">
              {t('status.title') || 'System Status'}
            </h3>
            <p className="text-primary-text text-sm">
              {t('status.message') || 'All systems are operational. If you experience any issues, please contact support.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

