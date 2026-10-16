import React, { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import { ConfigCardShell, ConfigField } from './ConfigCardShell';
import platformConfigService from '../../services/platformConfigService';
import { parseApiError } from '../../utils/errorParser';
import type { ExternalApiConfig, PlatformConfig } from '../../types';
import { useI18n } from '../../hooks/useI18n';

interface UrlConfigCardProps {
  /** คีย์ใน tb_platform_config เช่น `external_api` */
  configKey: string;
  title: string;
  description: string;
  /** ตัวอย่าง URL ที่ถูกต้อง ใช้เป็น placeholder และในข้อความช่วย */
  urlExample: string;
  config: PlatformConfig | null;
  canManage: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void | Promise<void>;
  footer?: React.ReactNode;
}

/**
 * การ์ดของค่าตั้งที่มี URL ช่องเดียว และ "ว่าง" = ยังไม่ตั้ง (backend ใช้ค่าจาก env แทน)
 *
 * ใช้กับ `external_api` — root URL สาธารณะของ API gateway ไม่รวม `/api/ext/v1`
 * backend ปฏิเสธค่าที่มี `/api/ext` ฝั่ง FE จึงเตือนก่อนเพื่อ UX เท่านั้น
 */
export const UrlConfigCard: React.FC<UrlConfigCardProps> = ({
  configKey,
  title,
  description,
  urlExample,
  config,
  canManage,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSaved,
  footer,
}) => {
  const { t } = useI18n();

  const toForm = (row: PlatformConfig | null): string => {
    const value = (row?.value ?? {}) as Partial<ExternalApiConfig>;
    return typeof value.base_url === 'string' ? value.base_url : '';
  };

  const [value, setValue] = useState<string>(() => toForm(config));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = (raw: string): string => {
    const v = raw.trim();
    if (!v) return '';
    if (v.includes('/api/ext')) return t('pages.platformConfig.urlNoApiExt');
    try {
      const u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return t('pages.platformConfig.urlInvalid');
      }
      return '';
    } catch {
      return t('pages.platformConfig.urlInvalid');
    }
  };

  const handleCancel = () => {
    setValue(toForm(config));
    setError('');
    onCancelEdit();
  };

  const handleSave = async () => {
    const err = validate(value);
    if (err) {
      setError(err);
      return;
    }
    try {
      setSaving(true);
      // ตัด / ท้ายสุดออก เพื่อให้ปลายทางที่ต่อ `/api/ext/v1` ไม่มี // คั่น
      await platformConfigService.patch(configKey, {
        base_url: value.trim().replace(/\/+$/, ''),
      });
      toast.success(t('pages.platformConfig.savedToast', { title }));
      await onSaved();
    } catch (e: unknown) {
      const { message, fields } = parseApiError(e);
      if (fields?.base_url) setError(fields.base_url);
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
      footer={footer}
    >
      <ConfigField
        label={t('pages.platformConfig.baseUrl')}
        htmlFor={`${configKey}-base-url`}
        isEditing={isEditing}
        value={toForm(config)}
        mono
        error={error}
        hint={
          <>
            {t('pages.platformConfig.externalApiUrlHint')}{' '}
            <code className="font-mono">{urlExample}</code>
          </>
        }
      >
        <Input
          id={`${configKey}-base-url`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          onBlur={() => setError(validate(value))}
          className={error ? 'border-destructive' : ''}
          placeholder={urlExample}
        />
      </ConfigField>
    </ConfigCardShell>
  );
};
