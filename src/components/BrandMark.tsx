import { useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

/**
 * คำนำหน้าที่ backend ใส่ให้รหัส BU ที่สร้างตั้งแต่ 2026-10-01 (`BU-7K3M9Q2X`) — ไม่ใช่ตัวอักษร
 * ที่บอกตัวตนของหน่วยนั้น ถ้าปล่อยไว้ ทุก BU ใหม่จะได้โมโนแกรม "BU" ซ้ำกันหมดในตาราง / switcher /
 * การ์ด branding จึงตัดออกก่อนหยิบตัวอักษร BU เก่าไม่มีคำนำหน้าและ cluster ไม่เคยมี → ไม่กระทบ
 * The `BU-` prefix the backend stamps on business-unit codes created since 2026-10-01. It is not
 * identity, so it is stripped before the initials are taken — otherwise every new BU would wear the
 * same "BU" monogram. Older BU codes and cluster codes never carry it and are unaffected.
 */
const BU_CODE_PREFIX = /^BU-/i;

/**
 * Identity token of up to three characters. A non-empty alias (business units only) wins and is
 * capped at 3 — legacy rows may still hold up to 10. Otherwise the code wins over the name (two
 * characters) because a code is already the short form people scan a list for ("ACME"); a name
 * still has to be abbreviated to get there.
 */
export const brandInitials = (name?: string, code?: string, alias?: string | null): string => {
  const fromAlias = (alias ?? '').trim();
  if (fromAlias) return fromAlias.slice(0, 3).toUpperCase();
  const fromCode = (code ?? '').replace(BU_CODE_PREFIX, '').replace(/[^A-Za-z0-9]/g, '');
  if (fromCode) return fromCode.slice(0, 2).toUpperCase();
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

export type BrandMarkSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<BrandMarkSize, { box: string; text: string; radius: string }> = {
  xs: { box: 'h-6 w-6', text: 'text-[10px]', radius: 'rounded-md' },   // table rows
  sm: { box: 'h-8 w-8', text: 'text-sm', radius: 'rounded-lg' },       // mobile header
  md: { box: 'h-9 w-9', text: 'text-base', radius: 'rounded-xl' },     // sidebar brand
  lg: { box: 'h-20 w-20', text: 'text-xl', radius: 'rounded-xl' },     // branding card
};

// One step smaller per size, used when the token is 3 characters so it fits the box.
const SIZES_LONG: Record<BrandMarkSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

interface BrandMarkProps {
  /** Entity name — an initials source only; never rendered as text. */
  name?: string;
  /** Entity code — the preferred initials source. */
  code?: string;
  /** Business-unit alias — wins over code/name for the initials when non-empty. */
  alias?: string | null;
  /** Presigned branding image. A missing, expired, or broken URL falls back to the initials. */
  src?: string;
  size?: BrandMarkSize;
  shape?: 'square' | 'circle';
  /** `primary` is reserved for the application's own mark; entities use `muted`. */
  tone?: 'primary' | 'muted';
  className?: string;
}

/**
 * The identity token for a cluster, a business unit, or the application itself.
 *
 * Its image-less state is deliberately *not* a placeholder: initials are a real and permanent
 * identity, so a mark with nothing uploaded still looks finished rather than broken. Only the
 * upload slot is allowed to look unfilled — see the dashed logo frame in `BrandingImageUpload`.
 */
export const BrandMark = ({
  name,
  code,
  alias,
  src,
  size = 'xs',
  shape = 'square',
  tone = 'muted',
  className,
}: BrandMarkProps) => {
  const { box, text, radius: squareRadius } = SIZES[size];
  const initials = brandInitials(name, code, alias);
  const radius = shape === 'circle' ? 'rounded-full' : squareRadius;

  return (
    <Avatar
      className={cn('shrink-0', box, radius, tone === 'muted' && 'border border-border', className)}
    >
      {/* Decorative: every placement sits next to the name it stands for, so announcing it
       *  again would only duplicate. Radix swaps in the fallback when the URL fails to load,
       *  which is what keeps an expired presigned link from rendering a broken image. */}
      {src && <AvatarImage src={src} alt="" className={cn('object-cover', radius)} />}
      <AvatarFallback
        className={cn(
          'font-semibold tracking-tight',
          radius,
          initials.length >= 3 ? SIZES_LONG[size] : text,
          tone === 'primary'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

interface BrandLogoProps {
  /** Presigned wide logo. Absent, expired, or failing to load → `fallback` renders instead. */
  src?: string;
  /** What to show when there is no usable logo — normally the square `BrandMark`. */
  fallback: ReactNode;
  className?: string;
}

/**
 * A cluster's wide logo at its natural aspect ratio, for the shell's brand slot.
 *
 * The logo is landscape (uploads are capped at 500px wide), so it cannot go through `BrandMark`:
 * the square avatar frame would crop it. Height is fixed by the caller and width follows the
 * image up to a cap, so a very wide logo cannot push the name out of the sidebar.
 *
 * A load failure is remembered per URL rather than reset in an effect: the next presigned URL
 * is a different string, so it gets its own attempt without a state sync.
 */
export const BrandLogo = ({ src, fallback, className }: BrandLogoProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return (
    // Decorative for the same reason as BrandMark: the wrapping link already carries the name.
    <img
      src={src}
      alt=""
      onError={() => setFailedSrc(src)}
      className={cn('w-auto max-w-24 shrink-0 object-contain object-left', className)}
    />
  );
};
