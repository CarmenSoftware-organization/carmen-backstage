import React from 'react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { CollapsibleSection } from '../shared';
import { useI18n } from '../../../hooks/useI18n';
import type { SectionFieldProps } from '../types';
import {
  ATTACHMENT_DEFAULT_MAX_MB,
  ATTACHMENT_DEFAULT_TYPES,
  ATTACHMENT_KEYS,
  ATTACHMENT_MAX_MB,
  ATTACHMENT_TYPE_GROUPS,
  type AttachmentTypeCode,
} from '../../../constants/attachmentTypes';

export interface AttachmentPolicyValue {
  allowed_types: AttachmentTypeCode[];
  max_size_mb: number;
}

interface AttachmentPolicySectionProps extends SectionFieldProps {
  /** null = คืนค่าเริ่มต้น (ลบสอง entry ทิ้ง ให้ตามค่าเริ่มต้นของระบบ) */
  onAttachmentPolicyChange: (next: AttachmentPolicyValue | null) => void;
}

const VALID_CODES: readonly string[] = ATTACHMENT_TYPE_GROUPS.map((g) => g.code);

/** อ่านค่าจาก config — ค่าที่เป็นสตริง (แก้ผ่านตัวแก้ทั่วไปมาก่อน) ก็อ่านได้ */
export const readAttachmentPolicy = (
  config: { key: string; value?: unknown }[],
): AttachmentPolicyValue | null => {
  const types = config.find((c) => c.key === ATTACHMENT_KEYS.allowedTypes)?.value;
  const size = config.find((c) => c.key === ATTACHMENT_KEYS.maxSizeMb)?.value;
  if (types === undefined && size === undefined) return null;
  let parsed: unknown = types;
  if (typeof types === 'string') {
    try { parsed = JSON.parse(types); } catch { parsed = []; }
  }
  // ค่าที่ผู้ใช้เพิ่งแก้ในฟอร์มต้องคงไว้ตามจริง (ว่าง / 0 / นอกช่วง) เพื่อให้แสดง error และบล็อก Save —
  // ใช้ค่าเริ่มต้นแทนเฉพาะเมื่อ entry หายหรืออ่านไม่ออกเท่านั้น
  const allowed = Array.isArray(parsed)
    ? parsed.filter((v): v is AttachmentTypeCode => typeof v === 'string' && VALID_CODES.includes(v))
    : [...ATTACHMENT_DEFAULT_TYPES];
  const n = size === undefined || size === null || size === '' ? NaN : Number(size);
  return {
    allowed_types: allowed,
    max_size_mb: Number.isNaN(n) ? ATTACHMENT_DEFAULT_MAX_MB : n,
  };
};

const AttachmentPolicySection: React.FC<AttachmentPolicySectionProps> = ({ formData, editing, onAttachmentPolicyChange }) => {
  const { t } = useI18n();
  const current = readAttachmentPolicy(formData.config);
  const effective: AttachmentPolicyValue = current ?? {
    allowed_types: [...ATTACHMENT_DEFAULT_TYPES],
    max_size_mb: ATTACHMENT_DEFAULT_MAX_MB,
  };
  const toggle = (code: AttachmentTypeCode, on: boolean) => {
    const next = on
      ? [...effective.allowed_types, code]
      : effective.allowed_types.filter((c) => c !== code);
    onAttachmentPolicyChange({ ...effective, allowed_types: ATTACHMENT_TYPE_GROUPS.map((g) => g.code).filter((c) => next.includes(c)) });
  };
  const typesError = effective.allowed_types.length === 0;
  const sizeError = !Number.isInteger(effective.max_size_mb) || effective.max_size_mb < 1 || effective.max_size_mb > ATTACHMENT_MAX_MB;
  const hasOffice = effective.allowed_types.some((c) => c === 'excel' || c === 'word');

  return (
    <CollapsibleSection title={t('pages.businessUnits.attachmentPolicyTitle')} description={t('pages.businessUnits.attachmentPolicyDescription')} forceOpen>
      <div className="space-y-4">
        {!current && <p className="text-sm text-muted-foreground">{t('pages.businessUnits.attachmentDefaultHint')}</p>}
        <div className="space-y-2">
          <Label>{t('pages.businessUnits.attachmentTypesLabel')}</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ATTACHMENT_TYPE_GROUPS.map((g) => (
              <label key={g.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!editing}
                  checked={effective.allowed_types.includes(g.code)}
                  onChange={(e) => toggle(g.code, e.target.checked)}
                />
                {t(g.labelKey)}
              </label>
            ))}
          </div>
          {editing && typesError && <p className="text-sm text-destructive">{t('pages.businessUnits.attachmentTypesRequired')}</p>}
          {hasOffice && <p className="text-sm text-muted-foreground">{t('pages.businessUnits.attachmentMacroWarning')}</p>}
        </div>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="attachment-max-size">{t('pages.businessUnits.attachmentMaxSizeLabel')}</Label>
          <Input
            id="attachment-max-size"
            type="number"
            min={1}
            max={ATTACHMENT_MAX_MB}
            step={1}
            disabled={!editing}
            value={effective.max_size_mb}
            onChange={(e) => onAttachmentPolicyChange({ ...effective, max_size_mb: Number(e.target.value) })}
          />
          {editing && sizeError && <p className="text-sm text-destructive">{t('pages.businessUnits.attachmentMaxSizeRange')}</p>}
        </div>
        {editing && current && (
          <Button type="button" variant="outline" size="sm" onClick={() => onAttachmentPolicyChange(null)}>
            {t('pages.businessUnits.attachmentReset')}
          </Button>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default AttachmentPolicySection;
