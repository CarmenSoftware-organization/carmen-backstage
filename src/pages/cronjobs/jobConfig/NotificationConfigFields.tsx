import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useI18n } from '../../../hooks/useI18n';
import type { NotificationJobConfig } from '../../../types';
import UserIdsField from './UserIdsField';
import type { JobConfigFieldsProps } from './index';

export default function NotificationConfigFields({
  value, onChange, readOnly,
}: JobConfigFieldsProps<NotificationJobConfig>) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notification_title">{t('cronjob.config.title')}</Label>
        <Input
          id="notification_title"
          disabled={readOnly}
          value={value.title ?? ''}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notification_message">{t('cronjob.config.message')}</Label>
        <Textarea
          id="notification_message"
          disabled={readOnly}
          value={value.message ?? ''}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="notification_type">{t('cronjob.config.type')}</Label>
          <Input
            id="notification_type"
            disabled={readOnly}
            value={value.type ?? ''}
            onChange={(e) => onChange({ ...value, type: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notification_category">{t('cronjob.config.category')}</Label>
          <Input
            id="notification_category"
            disabled={readOnly}
            value={value.category ?? ''}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('cronjob.config.userIds')}</Label>
        <UserIdsField
          value={value.user_ids ?? []}
          onChange={(user_ids) => onChange({ ...value, user_ids })}
          disabled={readOnly}
        />
        {/* I2 fix: notification.go errors with "notification job config missing user_ids"
            when this is empty — the "leave empty" hint was copied from
            DashboardRefreshConfigFields' bu_codes hint, where empty genuinely means "all". */}
        <p className="text-xs text-muted-foreground">{t('cronjob.config.userIdsRequiredHint')}</p>
      </div>
    </div>
  );
}
