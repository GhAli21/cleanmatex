/**
 * POD Capture Component
 * Proof of Delivery capture interface
 * PRD-013: Delivery Management & POD
 */

'use client';

import { useState } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useCapturePOD, useVerifyOTP } from '../hooks/use-delivery';
import { useMessage } from '@ui/feedback/useMessage';
import { CheckCircle2, Camera, PenTool } from 'lucide-react';

interface PODCaptureProps {
  stopId: string;
  orderId: string;
  onSuccess?: () => void;
}

const POD_METHODS = [
  { value: 'OTP', label: 'OTP Verification' },
  { value: 'SIGNATURE', label: 'Digital Signature' },
  { value: 'PHOTO', label: 'Photo Evidence' },
  { value: 'MIXED', label: 'Mixed (Multiple Methods)' },
];

export function PODCapture({ stopId, orderId, onSuccess }: PODCaptureProps) {
  const [podMethod, setPodMethod] = useState('OTP');
  const [otpCode, setOtpCode] = useState('');
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>();
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const { mutate: verifyOTP, isPending: isVerifyingOTP } = useVerifyOTP();
  const { mutate: capturePOD, isPending: isCapturing } = useCapturePOD();
  const { showSuccess, showError } = useMessage();

  const handleOTPVerify = () => {
    if (!otpCode.trim() || otpCode.length !== 4) {
      showError('Please enter a valid 4-digit OTP');
      return;
    }

    verifyOTP(
      { orderId, otpCode: otpCode.trim() },
      {
        onSuccess: (result) => {
          if (result.isValid) {
            showSuccess('OTP verified successfully');
            // Auto-capture POD after OTP verification
            handleCapturePOD();
          } else {
            showError('Invalid OTP code');
          }
        },
        onError: (error) => {
          showError(error.message || 'OTP verification failed');
        },
      }
    );
  };

  const handleCapturePOD = () => {
    capturePOD(
      {
        stopId,
        podMethodCode: podMethod,
        otpCode: podMethod === 'OTP' ? otpCode : undefined,
        signatureUrl: podMethod === 'SIGNATURE' ? signatureUrl : undefined,
        photoUrls: podMethod === 'PHOTO' || podMethod === 'MIXED' ? photoUrls : undefined,
      },
      {
        onSuccess: () => {
          showSuccess('POD captured successfully');
          onSuccess?.();
        },
        onError: (error) => {
          showError(error.message || 'POD capture failed');
        },
      }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // TODO: Upload to MinIO and get URLs
    // For now, create object URLs
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setPhotoUrls([...photoUrls, ...urls]);
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>Proof of Delivery</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">POD Method</label>
          <select
            value={podMethod}
            onChange={(e) => setPodMethod(e.target.value)}
            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
          >
            {POD_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        {podMethod === 'OTP' && (
          <div>
            <label className="block text-sm font-medium mb-1">OTP Code</label>
            <div className="flex gap-2">
              <CmxInput
                type="text"
                placeholder="Enter 4-digit OTP"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtpCode(value);
                }}
                maxLength={4}
                className="flex-1"
              />
              <CmxButton onClick={handleOTPVerify} loading={isVerifyingOTP} disabled={isVerifyingOTP}>
                Verify
              </CmxButton>
            </div>
          </div>
        )}

        {podMethod === 'SIGNATURE' && (
          <div>
            <label className="block text-sm font-medium mb-1">Digital Signature</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <PenTool className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-2">Signature canvas will be implemented</p>
              <CmxButton variant="outline" size="sm">
                Capture Signature
              </CmxButton>
            </div>
          </div>
        )}

        {(podMethod === 'PHOTO' || podMethod === 'MIXED') && (
          <div>
            <label className="block text-sm font-medium mb-1">Photo Evidence</label>
            <div className="space-y-2">
              <label className="cursor-pointer">
                <CmxButton variant="outline" type="button" asChild>
                  <span>
                    <Camera className="h-4 w-4 mr-2" />
                    Upload Photos
                  </span>
                </CmxButton>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {photoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photoUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`POD photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        onClick={() => setPhotoUrls(photoUrls.filter((_, i) => i !== index))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <CmxButton
          onClick={handleCapturePOD}
          loading={isCapturing}
          disabled={isCapturing || (podMethod === 'OTP' && !otpCode)}
          className="w-full"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Capture POD
        </CmxButton>
      </CmxCardContent>
    </CmxCard>
  );
}

