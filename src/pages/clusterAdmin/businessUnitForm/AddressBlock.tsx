import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';
import { formatAddress } from './formatAddress';
import type { BusinessUnitFormData } from '../../businessUnitEdit/types';
import { useI18n } from '../../../hooks/useI18n';

interface AddressBlockProps {
  /** เลือกชุดฟิลด์: hotel_* หรือ company_* */
  prefix: 'hotel' | 'company';
  formData: BusinessUnitFormData;
  disabled?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

/**
 * ช่องกรอกแต่ละช่องกว้างตามข้อมูลที่ถือ (กริด 6 ส่วน) — เดิมทั้ง 10 ช่องกว้างเท่ากันหมด
 * รหัสไปรษณีย์ 5 หลักจึงยาวเท่าบรรทัดที่อยู่
 */
const FIELDS: { suffix: string; labelKey: string; span: string; mono?: boolean }[] = [
  { suffix: 'address_line1', labelKey: 'pages.clusterAdmin.addressLine1Label', span: 'sm:col-span-6' },
  { suffix: 'address_line2', labelKey: 'pages.clusterAdmin.addressLine2Label', span: 'sm:col-span-6' },
  { suffix: 'sub_district', labelKey: 'pages.clusterAdmin.subDistrictLabel', span: 'sm:col-span-3' },
  { suffix: 'district', labelKey: 'pages.clusterAdmin.districtLabel', span: 'sm:col-span-3' },
  { suffix: 'city', labelKey: 'pages.clusterAdmin.cityLabel', span: 'sm:col-span-3' },
  { suffix: 'province', labelKey: 'pages.clusterAdmin.provinceLabel', span: 'sm:col-span-3' },
  { suffix: 'postal_code', labelKey: 'pages.clusterAdmin.postalCodeLabel', span: 'sm:col-span-2', mono: true },
  { suffix: 'country', labelKey: 'pages.clusterAdmin.countryLabel', span: 'sm:col-span-4' },
  { suffix: 'latitude', labelKey: 'pages.clusterAdmin.latitudeLabel', span: 'sm:col-span-3', mono: true },
  { suffix: 'longitude', labelKey: 'pages.clusterAdmin.longitudeLabel', span: 'sm:col-span-3', mono: true },
];

/**
 * ที่อยู่ 10 ช่องยุบเป็นข้อความบล็อกเดียวในโหมดอ่าน คลิกจึงกางเป็นช่องกรอกเดิม
 *
 * 20 ใน 42 กล่องเทาของหน้าเดิมคือฟิลด์ที่อยู่ (hotel 10 + company 10) นี่คือตัวลด
 * ความยาวที่ใหญ่ที่สุดของการรื้อครั้งนี้ — ดู spec §7
 *
 * ป้ายของช่องกรอกใช้ทรงเดียวกับป้ายแถว InlineField (text-xs muted) — เดิมใช้ <Label>
 * ตัวหนาสีเข้มผ่าน AddrField ทำให้การ์ดเดียวมีป้ายสองแบบ AddrField ยังเป็นของหน้า platform
 */
export function AddressBlock({ prefix, formData, disabled = false, onChange }: AddressBlockProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const f = (suffix: string) => `${prefix}_${suffix}` as keyof BusinessUnitFormData;
  const v = (suffix: string) => String(formData[f(suffix)] ?? '');

  const lines = formatAddress({
    address_line1: v('address_line1'),
    address_line2: v('address_line2'),
    sub_district: v('sub_district'),
    district: v('district'),
    city: v('city'),
    province: v('province'),
    postal_code: v('postal_code'),
    country: v('country'),
  });

  const lat = v('latitude').trim();
  const lon = v('longitude').trim();
  // พิกัดแม่นกว่าข้อความที่อยู่ ใช้ก่อนถ้ามีครบทั้งคู่
  const mapQuery = lat && lon ? `${lat},${lon}` : lines.join(', ');
  const mapHref = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : '';

  if (!open) {
    return (
      // py-1.5 เท่า padding ของแถว InlineField: บรรทัดแรกของที่อยู่ตรงกับแถวแรกของกลุ่มข้างเคียง
      <div className="space-y-1.5 py-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="hover:bg-primary/5 block w-full rounded-md px-2 py-1.5 text-left text-sm leading-relaxed transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          {lines.length > 0 ? (
            lines.map((line, idx) => <span key={idx} className="block">{line}</span>)
          ) : (
            <span className="text-muted-foreground italic">{t('pages.clusterAdmin.setAddressPlaceholder')}</span>
          )}
        </button>
        {(lat || lon || mapHref) && (
          <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-4 gap-y-1 px-2 text-xs">
            {(lat || lon) && (
              <span className="flex items-baseline gap-2">
                <span>{t('pages.clusterAdmin.coordinatesLabel')}</span>
                <span className="text-foreground font-mono tabular-nums">{lat || '—'}, {lon || '—'}</span>
              </span>
            )}
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm underline-offset-2 hover:underline focus-visible:ring-1 focus-visible:outline-hidden"
              >
                {t('pages.clusterAdmin.openInMaps')}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1.5">
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-6">
        {FIELDS.map(({ suffix, labelKey, span, mono }) => {
          const id = String(f(suffix));
          const label = t(labelKey as Parameters<typeof t>[0]);
          return (
            <div key={suffix} className={cn('space-y-1', span)}>
              <label htmlFor={id} className="text-muted-foreground block text-xs">{label}</label>
              <Input
                type="text"
                id={id}
                name={id}
                value={v(suffix)}
                onChange={onChange}
                disabled={disabled}
                className={cn('h-8', mono && 'font-mono tabular-nums')}
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground text-xs underline"
      >
        {t('pages.clusterAdmin.doneButton')}
      </button>
    </div>
  );
}
