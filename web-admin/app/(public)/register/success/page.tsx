/**
 * Registration Success Page
 * Shown after successful tenant registration
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Alert } from '@/components/ui';

export default function RegistrationSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card padding="lg">
          {/* Success Icon */}
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg
                className="h-10 w-10 text-green-600"
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

            <h1 className="mt-6 text-3xl font-bold text-gray-900">
              Welcome to CleanMateX!
            </h1>

            <p className="mt-2 text-gray-600">
              Your account has been created successfully
            </p>
          </div>

          {/* Trial Info */}
          <Alert
            variant="success"
            title="14-Day Free Trial Started"
            message="You now have full access to all features. No credit card required."
            className="mt-6"
          />

          {/* Next Steps */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Next Steps:</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">1.</span>
                <span>Complete your tenant profile and upload your logo</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">2.</span>
                <span>Configure your service categories and pricing</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">3.</span>
                <span>Add your first customer and create an order</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">4.</span>
                <span>Invite team members to collaborate</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <Button
            fullWidth
            className="mt-8"
            onClick={() => router.push('/dashboard')}
          >
            Go to Dashboard
          </Button>

          {/* Support Link */}
          <p className="mt-4 text-center text-sm text-gray-500">
            Need help getting started?{' '}
            <a href="/docs" className="text-blue-600 hover:text-blue-700">
              View documentation
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}
