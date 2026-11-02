import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BusinessUnitPicker } from './BusinessUnitPicker';
import type { BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { hydrateByKeys, useHydratedOptions } from '../hooks/useHydratedOptions';
import businessUnitService from '../services/businessUnitService';
import { useI18n } from '../hooks/useI18n';
import { cn } from '../lib/utils';
import type { BusinessUnit } from '../types';

interface BusinessUnitCodePickerProps {
  /** BU code · '' = All */
  value: string;
  onChange: (code: string, option: BusinessUnitOption | null) => void;
  canSearch: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** แจ้งเมื่อ dropdown เปิด/ปิด — ให้ Sheet/Dialog ที่ครอบอยู่กัน Escape ไม่ให้ปิดทั้งชั้น */
  onOpenChange?: (open: boolean) => void;
}

const toOption = (b: BusinessUnit): BusinessUnitOption => ({
  id: b.id,
  code: b.code,
  name: b.name,
  cluster_name: b.cluster_name ?? null,
});

// ระดับ module = stable
const fetchByCodes = (codes: string[]) =>
  hydrateByKeys<BusinessUnitOption>(codes, 'code', async ({ advance, perpage }) => {
    const res = await businessUnitService.getAll({ page: 1, perpage, advance });
    return { data: ((res.data || []) as BusinessUnit[]).map(toOption), paginate: res.paginate };
  });
const keyOfOption = (o: BusinessUnitOption) => o.code;

/** hydrate BU จาก code เดียว — ใช้ใน picker และหน้าที่ต้องแสดงชื่อตอน picker ยังไม่ mount (เช่นอยู่ใน Sheet ที่ปิด) */
export function useBusinessUnitByCode(code: string): {
  option: BusinessUnitOption | null;
  missing: boolean;
} {
  const { byKey, missing } = useHydratedOptions<BusinessUnitOption>(
    code ? [code] : [],
    keyOfOption,
    fetchByCodes,
  );
  const option = code ? (byKey.get(code) ?? null) : null;
  return { option, missing: !!code && !option && missing.has(code) };
}

/**
 * ตัวกรอง BU ที่เก็บค่าเป็น `code` (string) — ห่อ BusinessUnitPicker ที่เก็บเป็น option
 * code ที่ hydrate ไม่เจอจะ**คงค่าไว้**และแสดงเป็น code + ข้อความ not-found (ไม่ reset เป็น All)
 */
export const BusinessUnitCodePicker: React.FC<BusinessUnitCodePickerProps> = ({
  value, onChange, canSearch, id, placeholder, disabled, className, onOpenChange,
}) => {
  const { t } = useI18n();
  const [picked, setPicked] = useState<BusinessUnitOption | null>(null);
  const { option: hydrated, missing: hydrationMissing } = useBusinessUnitByCode(value);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const reportedRef = useRef('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const pickedHere = picked && picked.code === value ? picked : null;
  const resolved = value ? (pickedHere ?? hydrated) : null;
  const isMissing = !pickedHere && hydrationMissing;

  // hydrate เสร็จ → แจ้งชื่อให้หน้า (chip) หนึ่งครั้งต่อ code · ไม่แจ้งเมื่อ missing
  useEffect(() => {
    if (!value) { reportedRef.current = ''; return; }
    if (!resolved || reportedRef.current === value) return;
    reportedRef.current = value;
    onChangeRef.current(value, resolved);
  }, [value, resolved]);

  // ติดตามสถานะเปิดของ dropdown แบบประมาณ (โฟกัสเข้า = เปิด · Escape/คลิกนอก/โฟกัสออก = ปิด)
  const setOpen = useCallback((open: boolean) => onOpenChangeRef.current?.(open), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      setOpen(false);
    };
  }, [setOpen]);

  const pickerValue: BusinessUnitOption | null = value
    ? (resolved ?? { id: value, code: value, name: value })
    : null;

  return (
    <div
      ref={wrapperRef}
      className={cn('min-w-0', className)}
      onFocus={() => { if (!value) setOpen(true); }}
    >
      <BusinessUnitPicker
        id={id}
        value={pickerValue}
        canSearch={canSearch}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(next) => {
          setOpen(false);
          if (next) {
            setPicked(next);
            reportedRef.current = next.code;
            onChange(next.code, next);
          } else {
            setPicked(null);
            reportedRef.current = '';
            onChange('', null);
          }
        }}
      />
      {isMissing && (
        <p className="mt-1 text-xs text-muted-foreground">{t('components.businessUnitPicker.notFound')}</p>
      )}
    </div>
  );
};
