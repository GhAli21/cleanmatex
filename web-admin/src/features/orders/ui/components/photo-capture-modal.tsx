/**
 * Photo Capture Modal
 * Modal for capturing photos of items using device camera
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Camera, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useKeyboardNavigation, useFocusTrap } from '@/lib/hooks/use-keyboard-navigation';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { CmxButton } from '@ui/primitives/cmx-button';

interface PhotoCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photo: File) => void;
  maxPhotos?: number;
  existingPhotos?: File[];
}

/**
 * Photo Capture Modal Component
 */
export function PhotoCaptureModal({
  open,
  onClose,
  onCapture,
  maxPhotos = ORDER_DEFAULTS.LIMITS.MAX_PHOTOS,
  existingPhotos = [],
}: PhotoCaptureModalProps) {
  const t = useTranslations('newOrder.photoCapture');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap
  useFocusTrap(modalRef, open);

  // Keyboard navigation
  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  // Save previous focus when modal opens
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [open]);

  // Start camera when modal opens
  useEffect(() => {
    if (open && !stream) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  // Stop camera when modal closes
  useEffect(() => {
    if (!open) {
      stopCamera();
      setCapturedPhoto(null);
      setError(null);
    }
  }, [open]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer back camera
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to access camera. Please check permissions.';
      setError(errorMessage);
      // Camera access error is handled by setting error state
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Failed to get canvas context');
      setIsCapturing(false);
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setCapturedPhoto(dataUrl);
          setIsCapturing(false);
        } else {
          setError('Failed to capture photo');
          setIsCapturing(false);
        }
      },
      'image/jpeg',
      0.8
    );
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setError(null);
  };

  const confirmPhoto = () => {
    if (!capturedPhoto || !canvasRef.current) return;

    // Convert data URL to File
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          const file = new File(
            [blob],
            `photo-${Date.now()}.jpg`,
            { type: 'image/jpeg' }
          );
          onCapture(file);
          onClose();
        }
      },
      'image/jpeg',
      0.8
    );
  };

  const canAddMorePhotos = existingPhotos.length < maxPhotos;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-capture-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div
          className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'
            } p-6 border-b border-gray-200`}
        >
          <h2
            id="photo-capture-modal-title"
            className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'
              }`}
          >
            {t('title') || 'Capture Photo'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div
              className={`flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 ${isRTL ? 'flex-row-reverse' : ''
                }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className={isRTL ? 'text-right' : 'text-left'}>{error}</p>
            </div>
          )}

          {/* Photo Limit Warning */}
          {!canAddMorePhotos && (
            <div
              className={`flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 ${isRTL ? 'flex-row-reverse' : ''
                }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className={isRTL ? 'text-right' : 'text-left'}>
                {t('maxPhotosReached', { max: maxPhotos }) ||
                  `Maximum ${maxPhotos} photos allowed.`}
              </p>
            </div>
          )}

          {/* Camera Preview or Captured Photo */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Captured"
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!stream && !error && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>{t('startingCamera') || 'Starting camera...'}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls */}
          <div
            className={`flex items-center justify-center gap-4 ${isRTL ? 'flex-row-reverse' : ''
              }`}
          >
            {capturedPhoto ? (
              <>
                <CmxButton
                  variant="secondary"
                  onClick={retakePhoto}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('retake') || 'Retake'}
                </CmxButton>
                <CmxButton
                  variant="primary"
                  onClick={confirmPhoto}
                  disabled={!canAddMorePhotos}
                  className="flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {t('usePhoto') || 'Use Photo'}
                </CmxButton>
              </>
            ) : (
              <CmxButton
                variant="primary"
                onClick={capturePhoto}
                disabled={!stream || isCapturing}
                className="flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {isCapturing
                  ? t('capturing') || 'Capturing...'
                  : t('capture') || 'Capture Photo'}
              </CmxButton>
            )}
          </div>

          {/* Instructions */}
          <div
            className={`text-sm text-gray-600 text-center ${isRTL ? 'text-right' : 'text-left'
              }`}
          >
            <p>
              {t('instructions') ||
                'Position the item in the frame and tap Capture Photo when ready.'}
            </p>
            {existingPhotos.length > 0 && (
              <p className="mt-2">
                {t('photosCount', {
                  current: existingPhotos.length,
                  max: maxPhotos,
                }) || `${existingPhotos.length} of ${maxPhotos} photos added`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

