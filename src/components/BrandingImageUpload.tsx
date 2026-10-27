import React, { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { BrandMark } from './BrandMark';
import { devLog, parseApiError } from '../utils/errorParser';
import { resizeImageToMaxWidth } from '../utils/resizeImage';
import { AvatarCropDialog } from './AvatarCropDialog';
import { useI18n } from '../hooks/useI18n';

const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
/** ค่าตั้งต้นของทุกหน้า: โลโก้กว้างไม่เกิน 500px, avatar ตัดวงกลมไม่เกิน 250px */
const DEFAULT_LOGO_MAX_WIDTH = 500;
const DEFAULT_AVATAR_SIZE = 250;

interface BrandingImageUploadProps {
  label: string;
  value?: string; // current presigned URL (empty when none)
  disabled?: boolean;
  shape?: 'rect' | 'square';
  /**
   * Slot-only rendering: the preview *is* the button, with the label carried on `aria-label`
   * and the format/size help dropped. Built for the cluster identity plate, where the two
   * marks sit beside the cluster's name and a labelled 20px-tall upload card each would turn
   * a one-line plate into a form. Every other call site keeps the full slot.
   */
  compact?: boolean;
  maxSizeMB?: number;
  /**
   * `shape="rect"` (โลโก้): ย่อให้กว้างไม่เกินค่านี้ (px) ฝั่ง browser ก่อนอัปโหลด คงสัดส่วนเดิม
   * ค่าตั้งต้น 500 · `0` = อัปโหลดไฟล์ตามที่เลือก ตรวจ `maxSizeMB` กับไฟล์ *หลัง* ย่อ
   */
  maxWidth?: number;
  /**
   * `shape="square"` (avatar): เปิด dialog ให้ตัดเป็นวงกลมก่อนอัปโหลด แล้วได้ไฟล์จัตุรัสด้านละไม่เกิน
   * ค่านี้ (px) ค่าตั้งต้น 250 · `0` = ไม่ตัด อัปโหลดไฟล์ตามที่เลือก
   */
  avatarSize?: number;
  accept?: string[];
  /** Entity name behind this branding — feeds the square slot's initials fallback. */
  fallbackName?: string;
  /** Entity code behind this branding — preferred over the name for initials. */
  fallbackCode?: string;
  // Uploads the file (the parent calls the dedicated endpoint and stores the returned URL).
  onUpload: (file: File) => Promise<void>;
}

export const BrandingImageUpload: React.FC<BrandingImageUploadProps> = ({
  label,
  value,
  disabled = false,
  shape = 'rect',
  compact = false,
  maxSizeMB = 5,
  maxWidth = DEFAULT_LOGO_MAX_WIDTH,
  avatarSize = DEFAULT_AVATAR_SIZE,
  accept = DEFAULT_ACCEPT,
  fallbackName,
  fallbackCode,
  onUpload,
}) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Branding URLs are presigned and expire; a cluster whose links have aged out used to
   * render two empty frames — the <img> hid itself on error and left its border behind, so
   * a page that should have said "CL" said "the image is broken". Tracking the failure
   * lets the slot fall back to the same empty state it shows when nothing was uploaded,
   * which is what `BrandMark`'s contract already promised ("a missing, expired, or broken
   * URL falls back to the initials").
   */
  const [broken, setBroken] = useState(false);
  // A fresh upload (or a re-presigned URL for the same image) deserves a fresh attempt.
  useEffect(() => setBroken(false), [value]);

  const crops = shape === 'square' && avatarSize > 0;
  const resizes = shape === 'rect' && maxWidth > 0;
  // ไฟล์ที่รอผู้ใช้ตัดใน dialog — null = dialog ปิด
  const [cropFile, setCropFile] = useState<File | null>(null);

  const clearInput = () => { if (inputRef.current) inputRef.current.value = ''; };

  const handleFile = (picked: File) => {
    if (!accept.includes(picked.type)) {
      toast.error(t('common.upload.unsupportedType', { types: accept.map((t2) => t2.replace('image/', '')).join(', ') }));
      clearInput();
      return;
    }
    if (crops) {
      setCropFile(picked);
      return;
    }
    void upload(picked);
  };

  const upload = async (picked: File) => {
    setBusy(true);
    try {
      let file = picked;
      if (resizes) {
        try {
          file = await resizeImageToMaxWidth(picked, maxWidth);
        } catch (e) {
          // ย่อไม่ได้ก็ยังอัปโหลดไฟล์เดิมได้ — backend ตรวจชนิด/ขนาดของมันเองอยู่แล้ว
          devLog('BrandingImageUpload.resize', e);
        }
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(t('common.upload.tooLarge', { size: maxSizeMB }));
        return;
      }
      await onUpload(file);
      toast.success(t('common.upload.updated', { label }));
    } catch (e) {
      toast.error(t('common.upload.uploadFailed', { label }), { description: parseApiError(e).message });
    } finally {
      setBusy(false);
      clearInput();
    }
  };

  const cropDialog = crops && (
    <AvatarCropDialog
      file={cropFile}
      label={label}
      outputSize={avatarSize}
      onCancel={() => { setCropFile(null); clearInput(); }}
      onConfirm={async (cropped) => {
        await upload(cropped);
        setCropFile(null);
      }}
    />
  );

  const frameClass = compact
    ? shape === 'square'
      ? 'h-12 w-12 rounded-full'
      : 'h-12 w-20 rounded-md'
    : shape === 'square'
      ? 'h-20 w-20 rounded-full'
      : 'h-20 w-auto max-w-[160px] rounded-md';
  const fitClass = shape === 'square' ? 'object-cover' : 'object-contain';

  /* Two different empty states, on purpose. A square slot falls back to initials — a real
   * identity the platform can keep using forever — so it renders solid and finished. A logo has
   * no substitute, so its empty state is a dashed frame at the footprint the image will occupy:
   * it reads as "nothing here yet" instead of "this is the branding". */
  const renderPreview = () => {
    if (value && !broken) {
      return (
        <div className={cn('flex shrink-0 items-center justify-center overflow-hidden border bg-muted/30', frameClass)}>
          <img
            src={value}
            alt={label}
            className={cn('h-full w-full', fitClass)}
            onError={() => setBroken(true)}
          />
        </div>
      );
    }
    if (shape === 'square') {
      return (
        <BrandMark
          size="lg"
          shape="circle"
          name={fallbackName}
          code={fallbackCode}
          className={cn(compact && 'h-12 w-12 text-base')}
        />
      );
    }
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/30',
          compact ? 'h-12 w-20' : 'h-20 w-[160px]',
        )}
      >
        <ImagePlus className={cn('text-muted-foreground/70', compact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden />
      </div>
    );
  };

  const fileInput = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {cropDialog}
    </>
  );

  if (compact) {
    if (disabled) return <div className="shrink-0">{renderPreview()}</div>;
    return (
      <div className="shrink-0">
        {fileInput}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={
            value
              ? t('common.upload.replaceLabel', { label: label.toLowerCase() })
              : t('common.upload.uploadLabel', { label: label.toLowerCase() })
          }
          className="group focus-visible:ring-ring relative block rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        >
          {renderPreview()}
          {/* The affordance is the overlay, not a separate button: it only has to appear on the
              way to the click, and a permanent "Replace" caption under each mark would be more
              chrome than the marks themselves. focus-visible keeps it reachable by keyboard. */}
          <span
            className={cn(
              'bg-foreground/55 absolute inset-0 grid place-items-center transition-opacity',
              shape === 'square' ? 'rounded-full' : 'rounded-md',
              busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            {busy ? (
              <Loader2 className="text-background h-4 w-4 animate-spin" />
            ) : (
              <Upload className="text-background h-4 w-4" />
            )}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center gap-3">
        {renderPreview()}
        {!disabled && (
          <div className="space-y-1.5">
            {fileInput}
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {busy
                ? t('common.busy.uploading')
                : value
                  ? t('common.upload.replaceLabel', { label: label.toLowerCase() })
                  : t('common.upload.uploadLabel', { label: label.toLowerCase() })}
            </Button>
            <p className="text-xs text-muted-foreground">
              {accept.map((mime) => mime.replace('image/', '').toUpperCase()).join(', ')} ·{' '}
              {t('common.upload.maxSizeHint', { size: maxSizeMB })}
              {resizes && ` · ${t('common.upload.maxWidthHint', { width: maxWidth })}`}
              {crops && ` · ${t('common.upload.avatarHint', { size: avatarSize })}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
