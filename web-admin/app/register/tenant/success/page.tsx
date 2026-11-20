/**
 * Registration Success Page
 * Shown after successful tenant registration
 */

'use client';

import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';

/**
 *
 */
export default function RegistrationSuccessPage() {
  const router = useRouter();
  const t = useTranslations('auth.tenantRegister.success');

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <CmxCard className="p-8">
          {/* Success Icon */}
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-bg">
              <svg
                className="h-10 w-10 text-success-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-bold text-foreground">
              {t('title')}
            </h1>

            <p className="mt-2 text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>

          {/* Trial Info */}
          <CmxSummaryMessage
            type="success"
            title={t('trialTitle')}
            message={t('trialMessage')}
            className="mt-6"
          />

          {/* Next Steps */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{t('nextSteps')}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="text-primary-text me-2">1.</span>
                <span>{t('step1')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-text me-2">2.</span>
                <span>{t('step2')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-text me-2">3.</span>
                <span>{t('step3')}</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-text me-2">4.</span>
                <span>{t('step4')}</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <CmxButton
            className="mt-8 w-full"
            onClick={() => router.push('/dashboard')}
          >
            {t('goToDashboard')}
          </CmxButton>

          {/* Support Link */}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('needHelp')}{' '}
            <Link href="/docs" className="text-primary-text hover:text-primary-text/80">
              {t('viewDocs')}
            </Link>
          </p>
        </CmxCard>
      </div>
    </div>
  );
}
