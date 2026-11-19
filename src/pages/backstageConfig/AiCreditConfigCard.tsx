import React, { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '../../components/ui/input';
import { ConfigCardShell, ConfigField } from './ConfigCardShell';
import backstageConfigService from '../../services/backstageConfigService';
import { parseApiError } from '../../utils/errorParser';
import type { AiCreditConfig, BackstageConfig } from '../../types';
import { useI18n } from '../../hooks/useI18n';

interface AiCreditConfigCardProps {
  config: BackstageConfig | null;
  canManage: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void | Promise<void>;
  /** แถบ audit ท้ายการ์ด — หน้าเพจเป็นเจ้าของข้อมูล */
  footer?: React.ReactNode;
}

/** ตรงกับ registry `ai_credit` ฝั่ง backend (default 100) */
const DEFAULT_LOW_THRESHOLD = 100;
const MAX_LOW_THRESHOLD = 1_000_000;

const toValue = (config: BackstageConfig | null): AiCreditConfig => {
  const v = (config?.value ?? {}) as Partial<AiCreditConfig>;
  return { low_threshold: typeof v.low_threshold === 'number' ? v.low_threshold : DEFAULT_LOW_THRESHOLD };
};

/**
 * การ์ดเกณฑ์ "ยอด AI credit เหลือน้อย" — คีย์ `ai_credit` ฟิลด์เดียว `low_threshold`
 * เป็นเกณฑ์แสดงผลเท่านั้น (ไม่บล็อกการใช้งาน) จึงไม่มี ConfirmDialog
 */
export const AiCreditConfigCard: React.FC<AiCreditConfigCardProps> = ({
  config,
  canManage,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSaved,
  footer,
}) => {
  const { t } = useI18n();
  const [threshold, setThreshold] = useState(() => String(toValue(config).low_threshold));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const saved = toValue(config);

  const validate = (): string => {
    const n = Number(threshold);
    return threshold.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= MAX_LOW_THRESHOLD
      ? ''
      : t('pages.aiCredit.lowThresholdRange');
  };

  const handleCancel = () => {
    setThreshold(String(toValue(config).low_threshold));
    setFieldErrors({});
    onCancelEdit();
  };

  const handleSave = async () => {
    const err = validate();
    setFieldErrors({ low_threshold: err });
    if (err) return;
    try {
      setSaving(true);
      await backstageConfigService.update('ai_credit', { low_threshold: Number(threshold) });
      toast.success(t('pages.aiCredit.configSaved'));
      await onSaved();
    } catch (e: unknown) {
      const { message, fields } = parseApiError(e);
      if (fields) setFieldErrors(fields);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigCardShell
      title={t('pages.aiCredit.configTitle')}
      description={t('pages.aiCredit.configDesc')}
      canManage={canManage}
      isEditing={isEditing}
      saving={saving}
      onRequestEdit={onRequestEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      footer={footer}
    >
      <ConfigField
        label={t('pages.aiCredit.lowThreshold')}
        htmlFor="ai-credit-low-threshold"
        isEditing={isEditing}
        value={String(saved.low_threshold)}
        hint={t('pages.aiCredit.lowThresholdHint')}
        error={fieldErrors.low_threshold}
      >
        <Input
          id="ai-credit-low-threshold"
          type="number"
          min={0}
          max={MAX_LOW_THRESHOLD}
          step={1}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className={fieldErrors.low_threshold ? 'border-destructive' : ''}
        />
      </ConfigField>
    </ConfigCardShell>
  );
};
