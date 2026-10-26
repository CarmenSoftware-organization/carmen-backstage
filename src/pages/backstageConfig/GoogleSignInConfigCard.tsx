import React, { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { ConfigCardShell, ConfigField } from './ConfigCardShell';
import backstageConfigService from '../../services/backstageConfigService';
import { parseApiError } from '../../utils/errorParser';
import type { GoogleSignInConfig, BackstageConfig } from '../../types';
import { useI18n } from '../../hooks/useI18n';

interface GoogleSignInConfigCardProps {
  config: BackstageConfig | null;
  /** `backstage_config.manage` อย่างเดียว — คีย์นี้ไม่มีด่านที่สองฝั่ง backend */
  canManage: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void | Promise<void>;
  /** แถบ audit ท้ายการ์ด — หน้าเพจเป็นเจ้าของข้อมูล */
  footer?: React.ReactNode;
}

/** `=== true` ไม่ใช่ truthy — ตรงกับ GoogleSignInFlagService ฝั่ง gateway ที่ถือว่าค่าเพี้ยน = ปิด */
const toForm = (config: BackstageConfig | null): GoogleSignInConfig => {
  const value = (config?.value ?? {}) as Partial<GoogleSignInConfig>;
  return { backstage: value.backstage === true, app: value.app === true };
};

/**
 * สวิตช์ปุ่ม "Continue with Google" แยกต่อแอป — ปิดแล้ว gateway ซ่อนปุ่มและปฏิเสธ flow ด้วย
 * (redirect กลับ `/login?error=google_disabled`) ปุ่มจะขึ้นจริงก็ต่อเมื่อตั้ง `google_oauth` และ
 * `frontend_urls` ครบด้วย (สองการ์ดที่อยู่คู่กันในหน้านี้) เปิดสวิตช์ตอนที่ยังไม่ตั้งจึงไม่มีผล
 */
export const GoogleSignInConfigCard: React.FC<GoogleSignInConfigCardProps> = ({
  config,
  canManage,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSaved,
  footer,
}) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<GoogleSignInConfig>(() => toForm(config));
  const [saving, setSaving] = useState(false);
  const saved = toForm(config);

  const handleCancel = () => {
    setFormData(toForm(config));
    onCancelEdit();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await backstageConfigService.patch('google_sign_in', {
        backstage: formData.backstage,
        app: formData.app,
      });
      toast.success(t('pages.backstageConfig.googleSignInSavedToast'));
      await onSaved();
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const stateBadge = (on: boolean) => (
    <Badge variant={on ? 'success' : 'secondary'}>
      {on ? t('pages.backstageConfig.googleSignInOn') : t('pages.backstageConfig.googleSignInOff')}
    </Badge>
  );

  const field = (target: keyof GoogleSignInConfig, label: string, hint: string) => (
    <ConfigField
      label={label}
      htmlFor={`google-sign-in-${target}`}
      isEditing={isEditing}
      value={stateBadge(saved[target])}
      badge={isEditing ? stateBadge(saved[target]) : undefined}
      hint={hint}
    >
      <label className="flex items-center gap-2 rounded-md border border-input p-2 text-sm">
        <input
          id={`google-sign-in-${target}`}
          type="checkbox"
          className="h-4 w-4"
          checked={formData[target]}
          disabled={saving}
          onChange={(e) => setFormData({ ...formData, [target]: e.target.checked })}
        />
        {t('pages.backstageConfig.googleSignInCheckbox')}
      </label>
    </ConfigField>
  );

  return (
    <ConfigCardShell
      title={t('pages.backstageConfig.googleSignInTitle')}
      description={t('pages.backstageConfig.googleSignInDesc')}
      canManage={canManage}
      isEditing={isEditing}
      saving={saving}
      onRequestEdit={onRequestEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      footer={footer}
    >
      {field(
        'backstage',
        t('pages.backstageConfig.googleSignInBackstage'),
        t('pages.backstageConfig.googleSignInBackstageHint'),
      )}
      {field('app', t('pages.backstageConfig.googleSignInApp'), t('pages.backstageConfig.googleSignInAppHint'))}
    </ConfigCardShell>
  );
};
