/**
 * CmxCameraCaptureDialog — take a photo with the device camera (back camera preferred).
 * Promoted from the orders PhotoCaptureModal so every feature captures photos the same way.
 * Hands a JPEG File to `onCapture`; uploading is the caller's job.
 * @module ui/overlays
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Check, RotateCcw } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from './cmx-dialog';

/** JPEG quality of captured frames; the upload step downscales further if needed. */
const CAPTURE_QUALITY = 0.9;

export interface CmxCameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the confirmed photo; the dialog then closes. */
  onCapture: (photo: File) => void;
  /** Overrides the default title. */
  title?: string;
}

/**
 * Camera dialog: live preview → capture → retake or use.
 * @param props see CmxCameraCaptureDialogProps
 */
export function CmxCameraCaptureDialog({ open, onOpenChange, onCapture, title }: CmxCameraCaptureDialogProps) {
  const t = useTranslations('common.files');
  const tCommon = useTranslations('common');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [state, setState] = React.useState<'starting' | 'live' | 'error'>('starting');
  const [shot, setShot] = React.useState<{ blob: Blob; url: string } | null>(null);

  // Camera lifecycle follows `open`: an external resource, so an effect is the right tool.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setState('live');
      })
      .catch(() => !cancelled && setState('error'));
    if (!navigator.mediaDevices) queueMicrotask(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState('starting');
      setShot((s) => (s && URL.revokeObjectURL(s.url), null));
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && setShot({ blob, url: URL.createObjectURL(blob) }), 'image/jpeg', CAPTURE_QUALITY);
  };

  const retake = () => setShot((s) => (s && URL.revokeObjectURL(s.url), null));

  const use = () => {
    if (!shot) return;
    onCapture(new File([shot.blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    onOpenChange(false);
  };

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{title ?? t('cameraTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="relative aspect-video overflow-hidden rounded-[var(--cmx-radius-md,0.375rem)] bg-black">
          {/* The video stays mounted so the live stream survives a retake. */}
          <video ref={videoRef} autoPlay playsInline muted className={shot ? 'hidden' : 'h-full w-full object-cover'} aria-label={t('cameraPreview')} />
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable asset
            <img src={shot.url} alt={t('capturedPreview')} className="h-full w-full object-contain" />
          )}
          {!shot && state !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white" role="status">
              <Camera className="h-10 w-10 opacity-60" aria-hidden />
              <p className="text-sm">{state === 'error' ? t('cameraUnavailable') : t('cameraStarting')}</p>
            </div>
          )}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="secondary" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </CmxButton>
          {shot ? (
            <>
              <CmxButton variant="outline" onClick={retake}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t('retake')}
              </CmxButton>
              <CmxButton onClick={use}>
                <Check className="h-4 w-4" aria-hidden />
                {t('usePhoto')}
              </CmxButton>
            </>
          ) : (
            <CmxButton onClick={capture} disabled={state !== 'live'}>
              <Camera className="h-4 w-4" aria-hidden />
              {t('capture')}
            </CmxButton>
          )}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
