'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { CmxButton } from '@ui/primitives';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic<{ spec: any }>(
  () => import('swagger-ui-react'),
  { ssr: false }
);

/**
 *
 */
export default function ApiDocsPage() {
  const t = useTranslations('help.apiDocs');
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    fetch('/api/docs', { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`Failed to load API docs: ${res.statusText} (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('API docs loaded successfully:', data);
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error('Failed to load API docs:', err);
        if (err.name === 'AbortError') {
          setError(t('timeoutError'));
        } else {
          setError(err instanceof Error ? err.message : t('unknownError'));
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-lg text-muted-foreground">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-center">
          <div className="text-danger-text text-lg mb-2">{t('loadFailed')}</div>
          <div className="text-muted-foreground">{error}</div>
          <CmxButton
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            {t('retry')}
          </CmxButton>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-center">
          <div className="text-lg text-danger-text mb-2">{t('emptyTitle')}</div>
          <div className="text-sm text-muted-foreground">{t('emptySubtitle')}</div>
        </div>
      </div>
    );
  }

  // Check if spec has paths (if not, file scanning likely failed)
  const hasPaths = spec.paths && Object.keys(spec.paths).length > 0;

  return (
    <div className="min-h-screen bg-card">
      {!hasPaths && (
        <div className="bg-warning-bg border-s-4 border-warning p-4 mb-4">
          <div className="flex">
            <div className="ms-3">
              <p className="text-sm text-warning-text">
                <strong>{t('noteLabel')}</strong> {t('noPathsNotice')}

              </p>
            </div>
          </div>
        </div>
      )}
      <SwaggerUI spec={spec} />
    </div>
  );
}

