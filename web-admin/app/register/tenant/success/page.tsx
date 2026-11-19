/**
 * Registration Success Page
 * Shown after successful tenant registration
 */

'use client';

import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import React from 'react';
import { useRouter } from 'next/navigation';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';

/**
 *
 */
export default function RegistrationSuccessPage() {
  const router = useRouter();

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
              Welcome to CleanMateX!
            </h1>

            <p className="mt-2 text-muted-foreground">
              Your account has been created successfully
            </p>
          </div>

          {/* Trial Info */}
          <CmxSummaryMessage
            type="success"
            title="14-Day Free Trial Started"
            message="You now have full access to all features. No credit card required."
            className="mt-6"
          />

          {/* Next Steps */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Next Steps:</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="text-primary-text me-2">1.</span>
                <span>Complete your tenant profile and upload your logo</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-text me-2">2.</span>
                <span>Configure your service categories and pricing</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-text me-2">3.</span>
                <span>Add your first customer and create an order</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-text me-2">4.</span>
                <span>Invite team members to collaborate</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <CmxButton
            className="mt-8 w-full"
            onClick={() => router.push('/dashboard')}
          >
            Go to Dashboard
          </CmxButton>

          {/* Support Link */}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Need help getting started?{' '}
            <a href="/docs" className="text-primary-text hover:text-primary-text/80">
              View documentation
            </a>
          </p>
        </CmxCard>
      </div>
    </div>
  );
}
