'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic<{ spec: any }>(
  () => import('swagger-ui-react'),
  { ssr: false }
);

export default function ApiDocsPage() {
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
          setError('Request timeout - The API documentation is taking too long to generate. This might be due to file scanning. Please try again.');
        } else {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading API documentation...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Failed to load API documentation</div>
          <div className="text-gray-600">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-red-500 mb-2">No API documentation available</div>
          <div className="text-sm text-gray-600">The API spec could not be loaded</div>
        </div>
      </div>
    );
  }

  // Check if spec has paths (if not, file scanning likely failed)
  const hasPaths = spec.paths && Object.keys(spec.paths).length > 0;

  return (
    <div className="min-h-screen bg-white">
      {!hasPaths && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Note:</strong> API route scanning may have failed. This is common on Vercel due to file system limitations. 
                The documentation structure is available, but individual endpoint details may be missing.
              </p>
            </div>
          </div>
        </div>
      )}
      <SwaggerUI spec={spec} />
    </div>
  );
}

