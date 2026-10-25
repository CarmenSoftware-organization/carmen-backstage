import React, { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import { ConfigCardShell, ConfigField } from './ConfigCardShell';
import { INVITATION_CONFIG_DEFAULTS } from './invitationDefaults';
import backstageConfigService from '../../services/backstageConfigService';
import { parseApiError } from '../../utils/errorParser';
import type { InvitationConfig, BackstageConfig } from '../../types';
import { useI18n } from '../../hooks/useI18n';

interface InvitationConfigCardProps {
  config: BackstageConfig | null;
  canManage: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void | Promise<void>;
  /** แถบ audit ท้ายการ์ด — หน้าเพจเป็นเจ้าของข้อมูล */
  footer?: React.ReactNode;
}

interface InvitationFormData {
  base_url: string;
  expiry_days: string;
}

const DEFAULTS = INVITATION_CONFIG_DEFAULTS;

/**
 * แปลงค่าดิบจาก API เป็นค่าในฟอร์ม — ค่าที่ backend คืนมาผ่าน Zod แล้วเสมอ
 * แต่ยังกันไว้ด้วย fallback เผื่อ backend เวอร์ชันเก่ายังไม่รู้จักคีย์นี้
 */
const toForm = (config: BackstageConfig | null): InvitationFormData => {
  const value = (config?.value ?? {}) as Partial<InvitationConfig>;
  return {
    base_url: typeof value.base_url === 'string' ? value.base_url : DEFAULTS.base_url,
    expiry_days: String(
      typeof value.expiry_days === 'number' ? value.expiry_days : DEFAULTS.expiry_days,
    ),
  };
};

export const InvitationConfigCard: React.FC<InvitationConfigCardProps> = ({
  config,
  canManage,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSaved,
  footer,
}) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<InvitationFormData>(() => toForm(config));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /**
   * ตรวจ base_url ฝั่ง FE เพื่อ UX เท่านั้น — backend ตัดสินสุดท้ายเสมอด้วย z.string().url()
   * ซึ่งอาจเข้มกว่านี้ในบางเคส ถ้าผลไม่ตรงกันให้ยึด error จาก backend
   * base URL ที่มี query string ติดมาแล้วถือว่าถูกต้อง ฝั่ง backend ประกอบ token ด้วย
   * searchParams.set() ไม่ใช่การต่อสตริง อย่าเพิ่มกฎห้าม query string ตรงนี้
   */
  const validate = (name: keyof InvitationFormData, value: string): string => {
    if (name === 'base_url') {
      if (!value.trim()) return t('pages.backstageConfig.baseUrlRequired');
      try {
        new URL(value);
        return '';
      } catch {
        return t('pages.backstageConfig.urlInvalid');
      }
    }
    const n = Number(value);
    if (!value.trim()) return t('pages.backstageConfig.daysRequired');
    if (!Number.isInteger(n) || n < 1 || n > 365) return t('pages.backstageConfig.daysRange');
    return '';
  };

  const handleChange = (name: keyof InvitationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleBlur = (name: keyof InvitationFormData) => {
    setFieldErrors((prev) => ({ ...prev, [name]: validate(name, formData[name]) }));
  };

  const handleCancel = () => {
    setFormData(toForm(config));
    setFieldErrors({});
    onCancelEdit();
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {
      base_url: validate('base_url', formData.base_url),
      expiry_days: validate('expiry_days', formData.expiry_days),
    };
    if (errors.base_url || errors.expiry_days) {
      setFieldErrors(errors);
      return;
    }
    try {
      setSaving(true);
      // patch ไม่ใช่ update: การ์ด Rate limits แก้ max_per_admin_per_hour /
      // max_per_cluster_per_day ของคีย์เดียวกันนี้อยู่คนละใบ การส่งด้วย update()
      // ซึ่งเป็น full replace จะเขียนทับค่าที่การ์ดนี้ไม่ได้แสดง
      await backstageConfigService.patch('invitation', {
        base_url: formData.base_url.trim(),
        expiry_days: Number(formData.expiry_days),
      });
      toast.success(t('pages.backstageConfig.savedInvitationToast'));
      await onSaved();
    } catch (err: unknown) {
      const { message, fields } = parseApiError(err);
      if (fields) setFieldErrors(fields);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const form = toForm(config);

  return (
    <ConfigCardShell
      title={t('pages.backstageConfig.invitationTitle')}
      description={t('pages.backstageConfig.invitationDescription')}
      canManage={canManage}
      isEditing={isEditing}
      saving={saving}
      onRequestEdit={onRequestEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      footer={footer}
    >
      <ConfigField
        label={t('pages.backstageConfig.baseUrl')}
        htmlFor="invitation-base-url"
        isEditing={isEditing}
        value={form.base_url}
        mono
        error={fieldErrors.base_url}
        hint={
          <>
            {t('pages.backstageConfig.invitationHint1')} <code className="font-mono">?token=…</code>{' '}
            {t('pages.backstageConfig.invitationHint2')}{' '}
            <code className="font-mono">https://inventory.example.com/invitations</code>.
          </>
        }
      >
        <Input
          id="invitation-base-url"
          value={formData.base_url}
          onChange={(e) => handleChange('base_url', e.target.value)}
          onBlur={() => handleBlur('base_url')}
          className={fieldErrors.base_url ? 'border-destructive' : ''}
          placeholder={t('pages.backstageConfig.invitationUrlPlaceholder')}
        />
      </ConfigField>

      <ConfigField
        label={t('pages.backstageConfig.expiryDays')}
        htmlFor="invitation-expiry-days"
        isEditing={isEditing}
        value={t('pages.backstageConfig.daysValue', { count: form.expiry_days })}
        error={fieldErrors.expiry_days}
      >
        <Input
          id="invitation-expiry-days"
          type="number"
          min={1}
          max={365}
          value={formData.expiry_days}
          onChange={(e) => handleChange('expiry_days', e.target.value)}
          onBlur={() => handleBlur('expiry_days')}
          className={fieldErrors.expiry_days ? 'border-destructive' : ''}
        />
      </ConfigField>
    </ConfigCardShell>
  );
};
