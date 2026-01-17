/**
 * Branding Settings Tab
 * Logo upload, color scheme customization, preview
 */

'use client';

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardFooter, Button, Alert } from '@/components/ui';
import type { Tenant } from '@/lib/types/tenant';
import type { ResolvedSetting } from '@/lib/api/settings-client';

interface BrandingSettingsProps {
  tenant: Tenant;
  onUpdate: () => void;
  effectiveSettings?: ResolvedSetting[];
}

export function BrandingSettings({ tenant, onUpdate, effectiveSettings }: BrandingSettingsProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(tenant.brand_color_primary);
  const [secondaryColor, setSecondaryColor] = useState(tenant.brand_color_secondary);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
      setError('Invalid file type. Only PNG, JPG, and SVG are allowed');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size exceeds 2MB limit');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', logoFile);

      const response = await fetch('/api/v1/tenants/me/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      setSuccess('Logo uploaded successfully');
      setLogoFile(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove your logo?')) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/tenants/me/logo', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove logo');
      }

      setLogoPreview('');
      setSuccess('Logo removed successfully');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveColors = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/v1/tenants/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_color_primary: primaryColor,
          brand_color_secondary: secondaryColor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update colors');
      }

      setSuccess('Brand colors updated successfully');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update colors');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo Upload */}
      <Card>
        <CardHeader
          title="Logo"
          subtitle="Upload your business logo (max 2MB, PNG/JPG/SVG)"
        />

        {success && (
          <Alert
            variant="success"
            message={success}
            onClose={() => setSuccess('')}
            className="mb-4"
          />
        )}

        {error && (
          <Alert variant="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}

        <div className="space-y-4">
          {/* Logo Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Logo
            </label>
            <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm">No logo uploaded</p>
                </div>
              )}
            </div>
          </div>

          {/* File Input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              {logoFile && (
                <Button
                  type="button"
                  onClick={handleUploadLogo}
                  isLoading={isLoading}
                >
                  Upload
                </Button>
              )}
              {logoPreview && !logoFile && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleRemoveLogo}
                  isLoading={isLoading}
                >
                  Remove Logo
                </Button>
              )}
            </div>
            {logoFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {logoFile.name} ({(logoFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Brand Colors */}
      <Card>
        <CardHeader
          title="Brand Colors"
          subtitle="Customize your brand colors (used in receipts and invoices)"
        />

        <div className="space-y-4">
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-12 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="#3B82F6"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
              <div
                className="w-24 h-12 rounded border border-gray-300"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-12 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="#10B981"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
              <div
                className="w-24 h-12 rounded border border-gray-300"
                style={{ backgroundColor: secondaryColor }}
              />
            </div>
          </div>
        </div>

        <CardFooter>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPrimaryColor(tenant.brand_color_primary);
                setSecondaryColor(tenant.brand_color_secondary);
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSaveColors}
              isLoading={isLoading}
            >
              Save Colors
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader title="Preview" subtitle="See how your branding looks" />

        <div className="p-6 bg-gray-50 rounded-lg">
          <div className="bg-white p-6 rounded-lg shadow">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo"
                className="h-16 mb-4 object-contain"
              />
            )}
            <h3 className="text-xl font-bold mb-2">{tenant.name}</h3>
            <div className="flex gap-2">
              <div
                className="w-16 h-16 rounded"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="w-16 h-16 rounded"
                style={{ backgroundColor: secondaryColor }}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
