/**
 * Help Page
 * Placeholder page for help documentation and support
 */

'use client';

import { useTranslations } from 'next-intl';
import { LifeBuoy, Book, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';

export default function HelpPage() {
  const t = useTranslations('help');
  const isRTL = useRTL();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <LifeBuoy className="h-8 w-8 text-blue-600" />
          <h1 className={`text-3xl font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('title') || 'Help & Support'}
          </h1>
        </div>
        <p className={`text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('subtitle') || 'Find answers to your questions and get support'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Documentation Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Book className="h-6 w-6 text-blue-600" />
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h2 className="text-xl font-semibold mb-2">
                {t('documentation.title') || 'Documentation'}
              </h2>
              <p className="text-gray-600 mb-4">
                {t('documentation.description') || 'Browse our comprehensive documentation and user guides'}
              </p>
              <a
                href="/api-docs"
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2"
              >
                {t('documentation.viewDocs') || 'View Documentation'}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Contact Support Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h2 className="text-xl font-semibold mb-2">
                {t('support.title') || 'Contact Support'}
              </h2>
              <p className="text-gray-600 mb-4">
                {t('support.description') || 'Get in touch with our support team'}
              </p>
              <a
                href="mailto:support@cleanmatex.com"
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {t('support.email') || 'support@cleanmatex.com'}
              </a>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Book className="h-6 w-6 text-purple-600" />
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h2 className="text-xl font-semibold mb-2">
                {t('faq.title') || 'Frequently Asked Questions'}
              </h2>
              <p className="text-gray-600 mb-4">
                {t('faq.description') || 'Find quick answers to common questions'}
              </p>
              <a
                href="/dashboard/help#faq"
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-2"
              >
                {t('faq.viewFAQ') || 'View FAQ'}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Quick Links Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <LifeBuoy className="h-6 w-6 text-orange-600" />
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h2 className="text-xl font-semibold mb-2">
                {t('quickLinks.title') || 'Quick Links'}
              </h2>
              <ul className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                <li>
                  <a href="/dashboard/orders/new" className="text-blue-600 hover:text-blue-700">
                    {t('quickLinks.newOrder') || 'Create New Order'}
                  </a>
                </li>
                <li>
                  <a href="/dashboard/settings" className="text-blue-600 hover:text-blue-700">
                    {t('quickLinks.settings') || 'Settings'}
                  </a>
                </li>
                <li>
                  <a href="/dashboard/customers" className="text-blue-600 hover:text-blue-700">
                    {t('quickLinks.customers') || 'Manage Customers'}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Status Information */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <LifeBuoy className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h3 className="font-semibold text-blue-900 mb-1">
              {t('status.title') || 'System Status'}
            </h3>
            <p className="text-blue-800 text-sm">
              {t('status.message') || 'All systems are operational. If you experience any issues, please contact support.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

