import React, { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { ChipInput } from '../../components/ui/chip-input';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ConfigCardShell, ConfigField } from './ConfigCardShell';
import backstageConfigService from '../../services/backstageConfigService';
import { parseApiError } from '../../utils/errorParser';
import { BYTES_PER_GB, bytesToGbInput, formatBytes, isValidQuotaInput } from '../../utils/storageQuota';
import type { StorageQuotaConfig, BackstageConfig } from '../../types';
import { useI18n } from '../../hooks/useI18n';

interface StorageQuotaConfigCardProps {
  config: BackstageConfig | null;
  canManage: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void | Promise<void>;
  footer?: React.ReactNode;
}

interface FormData {
  default_db_gb: string;
  default_file_gb: string;
  team_emails: string;
  enforce: boolean;
  grace_days: string;
}

/** ตรงกับ registry `storage_quota` ของ micro-cluster (5 GB / 5 GB / 7 วัน / ไม่บังคับ) */
const DEFAULTS: StorageQuotaConfig = {
  default_db_bytes: 5 * BYTES_PER_GB,
  default_file_bytes: 5 * BYTES_PER_GB,
  team_emails: [],
  enforce: false,
  grace_days: 7,
};

const toValue = (config: BackstageConfig | null): StorageQuotaConfig => {
  const v = (config?.value ?? {}) as Partial<StorageQuotaConfig>;
  return {
    default_db_bytes: typeof v.default_db_bytes === 'number' ? v.default_db_bytes : DEFAULTS.default_db_bytes,
    default_file_bytes: typeof v.default_file_bytes === 'number' ? v.default_file_bytes : DEFAULTS.default_file_bytes,
    team_emails: Array.isArray(v.team_emails) ? v.team_emails : DEFAULTS.team_emails,
    // `=== true` ให้ตรงกับผู้อ่านฝั่ง backend: ค่าเพี้ยน = ไม่บังคับ
    enforce: v.enforce === true,
    grace_days: typeof v.grace_days === 'number' ? v.grace_days : DEFAULTS.grace_days,
  };
};

const toForm = (config: BackstageConfig | null): FormData => {
  const v = toValue(config);
  return {
    default_db_gb: bytesToGbInput(v.default_db_bytes),
    default_file_gb: bytesToGbInput(v.default_file_bytes),
    team_emails: v.team_emails.join(','),
    enforce: v.enforce,
    grace_days: String(v.grace_days),
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * การ์ดนโยบายโควตาพื้นที่เก็บข้อมูลต่อ BU — คีย์ `storage_quota` (เก็บเป็นไบต์ แสดง/กรอกเป็น GB,
 * 1 GB = 1024³) การบันทึกส่งทั้งก้อนด้วย PUT เพราะการ์ดนี้เป็นเจ้าของทุกฟิลด์ของคีย์
 */
export const StorageQuotaConfigCard: React.FC<StorageQuotaConfigCardProps> = ({
  config,
  canManage,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSaved,
  footer,
}) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<FormData>(() => toForm(config));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const saved = toValue(config);

  const validateGb = (value: string): string => {
    return isValidQuotaInput(value, false) ? '' : t('pages.storageQuota.quotaMin');
  };

  const validateAll = (): Record<string, string> => {
    const days = Number(formData.grace_days);
    const emails = formData.team_emails.split(',').map((e) => e.trim()).filter(Boolean);
    return {
      default_db_gb: validateGb(formData.default_db_gb),
      default_file_gb: validateGb(formData.default_file_gb),
      grace_days:
        formData.grace_days.trim() !== '' && Number.isInteger(days) && days >= 0 && days <= 365
          ? ''
          : t('pages.storageQuota.graceDaysRange'),
      team_emails: emails.every((e) => EMAIL_RE.test(e)) ? '' : t('pages.storageQuota.emailInvalid'),
    };
  };

  const handleCancel = () => {
    setFormData(toForm(config));
    setFieldErrors({});
    onCancelEdit();
  };

  const persist = async () => {
    try {
      setSaving(true);
      await backstageConfigService.update('storage_quota', {
        default_db_bytes: Math.round(Number(formData.default_db_gb) * BYTES_PER_GB),
        default_file_bytes: Math.round(Number(formData.default_file_gb) * BYTES_PER_GB),
        team_emails: formData.team_emails.split(',').map((e) => e.trim()).filter(Boolean),
        enforce: formData.enforce,
        grace_days: Number(formData.grace_days),
      });
      toast.success(t('pages.storageQuota.configSaved'));
      await onSaved();
    } catch (err: unknown) {
      const { message, fields } = parseApiError(err);
      if (fields) setFieldErrors(fields);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const errors = validateAll();
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    // ถามซ้ำเฉพาะขาเปิด enforce ที่ยังไม่เคยเปิด — เป็นจุดที่นาฬิกาผ่อนผัน 7 วันเริ่มเดิน
    if (formData.enforce && !saved.enforce) {
      setConfirmOpen(true);
      return;
    }
    await persist();
  };

  return (
    <>
      <ConfigCardShell
        title={t('pages.storageQuota.configTitle')}
        description={t('pages.storageQuota.configDesc')}
        canManage={canManage}
        isEditing={isEditing}
        saving={saving}
        onRequestEdit={onRequestEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        footer={footer}
      >
        <ConfigField
          label={t('pages.storageQuota.defaultDbQuota')}
          htmlFor="storage-quota-default-db"
          isEditing={isEditing}
          value={formatBytes(saved.default_db_bytes)}
          error={fieldErrors.default_db_gb}
        >
          <Input
            id="storage-quota-default-db"
            type="number"
            min={1}
            step="any"
            value={formData.default_db_gb}
            onChange={(e) => setFormData({ ...formData, default_db_gb: e.target.value })}
            className={fieldErrors.default_db_gb ? 'border-destructive' : ''}
          />
        </ConfigField>
        <ConfigField
          label={t('pages.storageQuota.defaultFileQuota')}
          htmlFor="storage-quota-default-file"
          isEditing={isEditing}
          value={formatBytes(saved.default_file_bytes)}
          error={fieldErrors.default_file_gb}
        >
          <Input
            id="storage-quota-default-file"
            type="number"
            min={1}
            step="any"
            value={formData.default_file_gb}
            onChange={(e) => setFormData({ ...formData, default_file_gb: e.target.value })}
            className={fieldErrors.default_file_gb ? 'border-destructive' : ''}
          />
        </ConfigField>
        <ConfigField
          label={t('pages.storageQuota.teamEmails')}
          htmlFor="storage-quota-team-emails"
          isEditing={isEditing}
          value={saved.team_emails.length > 0 ? saved.team_emails.join(', ') : t('pages.storageQuota.noTeamEmails')}
          mono
          hint={t('pages.storageQuota.teamEmailsHint')}
          error={fieldErrors.team_emails}
        >
          <ChipInput
            id="storage-quota-team-emails"
            value={formData.team_emails}
            onChange={(v) => setFormData({ ...formData, team_emails: v })}
            placeholder="team@example.com"
          />
        </ConfigField>
        <ConfigField
          label={t('pages.storageQuota.graceDays')}
          htmlFor="storage-quota-grace-days"
          isEditing={isEditing}
          value={t('pages.storageQuota.daysValue', { count: saved.grace_days })}
          error={fieldErrors.grace_days}
        >
          <Input
            id="storage-quota-grace-days"
            type="number"
            min={0}
            max={365}
            value={formData.grace_days}
            onChange={(e) => setFormData({ ...formData, grace_days: e.target.value })}
            className={fieldErrors.grace_days ? 'border-destructive' : ''}
          />
        </ConfigField>
        <ConfigField
          label={t('pages.storageQuota.enforce')}
          htmlFor="storage-quota-enforce"
          isEditing={isEditing}
          value={
            <Badge variant={saved.enforce ? 'success' : 'secondary'}>
              {saved.enforce ? t('pages.storageQuota.enforceOn') : t('pages.storageQuota.enforceOffBadge')}
            </Badge>
          }
          hint={t('pages.storageQuota.enforceHint')}
        >
          <label className="flex items-center gap-2 rounded-md border border-input p-2 text-sm">
            <input
              id="storage-quota-enforce"
              type="checkbox"
              className="h-4 w-4"
              checked={formData.enforce}
              disabled={saving}
              onChange={(e) => setFormData({ ...formData, enforce: e.target.checked })}
            />
            {t('pages.storageQuota.enforceCheckbox')}
          </label>
        </ConfigField>
      </ConfigCardShell>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.storageQuota.confirmEnforceTitle')}
        description={t('pages.storageQuota.confirmEnforceDescription')}
        confirmText={t('pages.storageQuota.confirmEnforceAction')}
        confirmVariant="destructive"
        onConfirm={persist}
      />
    </>
  );
};
