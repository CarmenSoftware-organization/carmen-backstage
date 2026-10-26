import React, { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import { ConfigCardShell, ConfigField } from './ConfigCardShell';
import backstageConfigService from '../../services/backstageConfigService';
import { parseApiError } from '../../utils/errorParser';
import type { BackstageConfig } from '../../types';
import { useI18n } from '../../hooks/useI18n';

/** หนึ่งช่องในการ์ด — `url` ตรวจรูปแบบ URL, `text` แค่ตัดช่องว่างหัวท้าย */
export interface TextFieldSpec {
  /** ชื่อฟิลด์ใน value ของคีย์นั้น เช่น `client_id` */
  name: string;
  kind: 'url' | 'text';
  label: string;
  hint?: React.ReactNode;
  placeholder?: string;
}

interface TextFieldsConfigCardProps {
  /** คีย์ใน tb_backstage_config เช่น `google_oauth` */
  configKey: string;
  title: string;
  description: React.ReactNode;
  fields: TextFieldSpec[];
  config: BackstageConfig | null;
  /**
   * สองคีย์ที่ใช้การ์ดนี้ (`google_oauth`, `frontend_urls`) เขียนได้เฉพาะ **super-admin** ฝั่ง backend
   * (`backstage_configs.controller.ts` → `writeKeyDenial`) ส่ง canManage ที่ผ่อนกว่านั้นมาจะได้ปุ่ม Edit
   * ที่กด Save แล้ว 403 เสมอ
   */
  canManage: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void | Promise<void>;
  /** ข้อความใต้หัวการ์ดที่ต้องอ่านได้ตลอด ไม่ใช่แค่ตอนแก้ */
  note?: React.ReactNode;
  footer?: React.ReactNode;
}

type FormState = Record<string, string>;

/**
 * การ์ดของค่าตั้งที่เป็นช่องข้อความ/URL หลายช่อง และ "ว่าง" = ยังไม่ตั้ง (ไม่มี env fallback)
 *
 * ใช้กับ `google_oauth` (client id + URL สาธารณะของ gateway) และ `frontend_urls` (origin ของ
 * frontend ที่ browser กลับไปหลัง Google sign-in) — ค่าทั้งสองคีย์เคยเป็น env ของ backend-gateway
 *
 * กฎ URL ตรงกับ `OriginLikeUrlSchema` ฝั่ง micro-cluster: http/https เท่านั้น ห้ามมี query หรือ fragment
 * (gateway ต่อ `/login?...` และ `/api/auth/...` เอง) ฝั่ง FE ตรวจก่อนเพื่อ UX เท่านั้น backend ตรวจซ้ำ
 */
export const TextFieldsConfigCard: React.FC<TextFieldsConfigCardProps> = ({
  configKey,
  title,
  description,
  fields,
  config,
  canManage,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSaved,
  note,
  footer,
}) => {
  const { t } = useI18n();

  const toForm = (row: BackstageConfig | null): FormState => {
    const value = (row?.value ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
      fields.map((f) => [f.name, typeof value[f.name] === 'string' ? (value[f.name] as string) : '']),
    );
  };

  const [formData, setFormData] = useState<FormState>(() => toForm(config));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const saved = toForm(config);

  const validate = (field: TextFieldSpec, raw: string): string => {
    const v = raw.trim();
    if (!v || field.kind === 'text') return '';
    if (v.includes('?') || v.includes('#')) return t('pages.backstageConfig.urlNoQuery');
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:' ? '' : t('pages.backstageConfig.urlInvalid');
    } catch {
      return t('pages.backstageConfig.urlInvalid');
    }
  };

  const handleCancel = () => {
    setFormData(toForm(config));
    setErrors({});
    onCancelEdit();
  };

  const handleSave = async () => {
    const nextErrors = Object.fromEntries(
      fields.map((f) => [f.name, validate(f, formData[f.name] ?? '')]).filter(([, e]) => e),
    );
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    try {
      setSaving(true);
      // ตัด / ท้าย URL ออก เพื่อให้ปลายทางที่ gateway ต่อ path เองไม่มี // คั่น
      const payload = Object.fromEntries(
        fields.map((f) => {
          const v = (formData[f.name] ?? '').trim();
          return [f.name, f.kind === 'url' ? v.replace(/\/+$/, '') : v];
        }),
      );
      await backstageConfigService.patch(configKey, payload);
      toast.success(t('pages.backstageConfig.savedToast', { title }));
      await onSaved();
    } catch (e: unknown) {
      const { message, fields: fieldErrors } = parseApiError(e);
      if (fieldErrors) {
        setErrors(
          Object.fromEntries(fields.filter((f) => fieldErrors[f.name]).map((f) => [f.name, fieldErrors[f.name]])),
        );
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigCardShell
      title={title}
      description={description}
      canManage={canManage}
      isEditing={isEditing}
      saving={saving}
      onRequestEdit={onRequestEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      note={note}
      footer={footer}
    >
      {fields.map((field) => {
        const id = `${configKey}-${field.name}`;
        const error = errors[field.name] ?? '';
        return (
          <ConfigField
            key={field.name}
            label={field.label}
            htmlFor={id}
            isEditing={isEditing}
            value={saved[field.name] || t('pages.backstageConfig.notSetValue')}
            mono={Boolean(saved[field.name])}
            error={error}
            hint={field.hint}
          >
            <Input
              id={id}
              value={formData[field.name] ?? ''}
              disabled={saving}
              onChange={(e) => {
                setFormData({ ...formData, [field.name]: e.target.value });
                setErrors({ ...errors, [field.name]: '' });
              }}
              onBlur={() => setErrors({ ...errors, [field.name]: validate(field, formData[field.name] ?? '') })}
              className={error ? 'border-destructive' : ''}
              placeholder={field.placeholder}
            />
          </ConfigField>
        );
      })}
    </ConfigCardShell>
  );
};

export default TextFieldsConfigCard;
