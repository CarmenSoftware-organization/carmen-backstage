import React, { useEffect, useRef, useState } from 'react';
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
  /** option ที่หน้าถืออยู่แล้วสำหรับ `value` (เช่น hydrate ไว้เองตอน Sheet ปิด) — code ตรงกัน = picker ไม่ดึงซ้ำ */
  knownOption?: BusinessUnitOption | null;
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
export function useBusinessUnitByCode(
  code: string,
  /** แถวที่ผู้เรียกถืออยู่แล้ว (เช่น option ที่ picker แจ้งมา) — code ตรงกัน = ไม่ยิง request */
  known?: BusinessUnitOption | null,
): {
  option: BusinessUnitOption | null;
  missing: boolean;
  failed: boolean;
  retry: () => void;
} {
  const { byKey, missing, failed, retry } = useHydratedOptions<BusinessUnitOption>(
    code ? [code] : [],
    keyOfOption,
    fetchByCodes,
    { known: known ? [known] : null },
  );
  const option = code ? (byKey.get(code) ?? null) : null;
  return {
    option,
    missing: !!code && !option && missing.has(code),
    failed: !!code && !option && failed.has(code),
    retry,
  };
}

/**
 * ตัวกรอง BU ที่เก็บค่าเป็น `code` (string) — ห่อ BusinessUnitPicker ที่เก็บเป็น option
 * code ที่ hydrate ไม่เจอจะ**คงค่าไว้**และแสดงเป็น code + ข้อความ not-found (ไม่ reset เป็น All)
 */
export const BusinessUnitCodePicker: React.FC<BusinessUnitCodePickerProps> = ({
  value, onChange, canSearch, id, placeholder, disabled, className, onOpenChange, knownOption,
}) => {
  const { t } = useI18n();
  const [picked, setPicked] = useState<BusinessUnitOption | null>(null);
  const pickedHere = picked && picked.code === value ? picked : null;
  const knownHere = knownOption && knownOption.code === value ? knownOption : null;
  const {
    option: hydrated,
    missing: hydrationMissing,
    failed: hydrationFailed,
    retry: retryHydrate,
  } = useBusinessUnitByCode(value, pickedHere ?? knownHere);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const reportedRef = useRef('');

  const resolved = value ? (pickedHere ?? hydrated) : null;
  const isMissing = !pickedHere && hydrationMissing;

  // hydrate เสร็จ → แจ้งชื่อให้หน้า (chip) หนึ่งครั้งต่อ code · ไม่แจ้งเมื่อ missing
  useEffect(() => {
    if (!value) { reportedRef.current = ''; return; }
    if (!resolved || reportedRef.current === value) return;
    reportedRef.current = value;
    onChangeRef.current(value, resolved);
  }, [value, resolved]);

  const pickerValue: BusinessUnitOption | null = value
    ? (resolved ?? { id: value, code: value, name: value })
    : null;

  return (
    <div className={cn('min-w-0', className)}>
      <BusinessUnitPicker
        id={id}
        value={pickerValue}
        canSearch={canSearch}
        placeholder={placeholder}
        disabled={disabled}
        onOpenChange={onOpenChange}
        onChange={(next) => {
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
        <p className="mt-1 text-xs text-muted-foreground">
          {hydrationFailed ? (
            <>
              {t('components.businessUnitPicker.loadFailed')} ·{' '}
              <button type="button" onClick={retryHydrate} className="underline hover:text-foreground">
                {t('common.action.retry')}
              </button>
            </>
          ) : (
            t('components.businessUnitPicker.notFound')
          )}
        </p>
      )}
    </div>
  );
};
