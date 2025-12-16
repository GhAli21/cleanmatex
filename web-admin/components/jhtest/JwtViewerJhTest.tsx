'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import { Clock, Copy, CheckCircle, AlertCircle, User, Building2, Key, RefreshCw } from 'lucide-react';

interface DecodedJWT {
  header: any;
  payload: any;
  signature: string;
  raw: string;
}

export default function JwtViewerJhTest() {
  const [decodedToken, setDecodedToken] = useState<DecodedJWT | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showRawToken, setShowRawToken] = useState(false);
  const supabase = createClientComponentClient<Database>();

  const decodeJWT = (token: string): DecodedJWT | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      const signature = parts[2];

      return {
        header,
        payload,
        signature,
        raw: token,
      };
    } catch (err) {
      console.error('JWT decode error:', err);
      return null;
    }
  };

  const loadToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        setError('No active session found. Please log in.');
        setDecodedToken(null);
        return;
      }

      const decoded = decodeJWT(session.access_token);
      if (!decoded) {
        setError('Failed to decode JWT token');
        return;
      }

      setDecodedToken(decoded);
    } catch (err: any) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToken();
  }, []);

  // Update time remaining countdown
  useEffect(() => {
    if (!decodedToken?.payload?.exp) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = decodedToken.payload.exp;
      const remaining = exp - now;

      if (remaining <= 0) {
        setTimeRemaining('Expired');
      } else {
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [decodedToken]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Token</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!decodedToken) {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900">No Token Available</h3>
            <p className="text-sm text-yellow-700 mt-1">Please log in to view JWT token.</p>
          </div>
        </div>
      </div>
    );
  }

  const { header, payload, signature, raw } = decodedToken;
  const isExpired = payload.exp && Math.floor(Date.now() / 1000) > payload.exp;

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">JWT Token Viewer</h2>
          <p className="text-sm text-gray-600 mt-1">Decode and inspect your Supabase authentication token</p>
        </div>
        <button
          onClick={loadToken}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Token Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          Token Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Issuer</label>
            <p className="text-sm text-gray-900 mt-1">{payload.iss || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Subject (User ID)</label>
            <p className="text-sm text-gray-900 mt-1 font-mono text-xs break-all">{payload.sub || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Issued At</label>
            <p className="text-sm text-gray-900 mt-1">{payload.iat ? formatDate(payload.iat) : 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Expires At</label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-green-600'}`} />
              <p className="text-sm text-gray-900">{payload.exp ? formatDate(payload.exp) : 'N/A'}</p>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Time Remaining</label>
            <p className={`text-lg font-semibold mt-1 ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
              {timeRemaining}
            </p>
          </div>
        </div>
      </div>

      {/* User Claims */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          User Claims
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <p className="text-sm text-gray-900 mt-1">{payload.email || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <p className="text-sm text-gray-900 mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {payload.role || 'N/A'}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email Confirmed</label>
            <p className="text-sm text-gray-900 mt-1">
              {payload.email_confirmed_at ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Yes
                </span>
              ) : (
                <span className="text-yellow-600">No</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <p className="text-sm text-gray-900 mt-1">{payload.phone || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Tenant Context */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Tenant Context
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Tenant Org ID</label>
            <p className="text-sm text-gray-900 mt-1 font-mono text-xs break-all">
              {payload.tenant_org_id || payload.user_metadata?.tenant_org_id || 'N/A'}
            </p>
          </div>
          {payload.app_metadata && (
            <div>
              <label className="text-sm font-medium text-gray-700">App Metadata</label>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 mt-1 overflow-x-auto">
                {JSON.stringify(payload.app_metadata, null, 2)}
              </pre>
            </div>
          )}
          {payload.user_metadata && (
            <div>
              <label className="text-sm font-medium text-gray-700">User Metadata</label>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 mt-1 overflow-x-auto">
                {JSON.stringify(payload.user_metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Full Payload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Full Token Payload</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Header</label>
            <pre className="text-xs bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
              {JSON.stringify(header, null, 2)}
            </pre>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Payload</label>
            <pre className="text-xs bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Signature</label>
            <p className="text-xs bg-gray-50 p-4 rounded border border-gray-200 font-mono break-all">
              {signature}
            </p>
          </div>
        </div>
      </div>

      {/* Raw Token */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Raw Token</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRawToken(!showRawToken)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showRawToken ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => copyToClipboard(raw, 'token')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        {showRawToken ? (
          <pre className="text-xs bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto break-all whitespace-pre-wrap">
            {raw}
          </pre>
        ) : (
          <p className="text-sm text-gray-600 italic">
            Click "Show" to reveal the full raw token
          </p>
        )}
      </div>
    </div>
  );
}
