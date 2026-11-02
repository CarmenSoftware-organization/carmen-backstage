import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { BusinessUnitMultiSelect } from '../../../components/BusinessUnitMultiSelect';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { useI18n } from '../../../hooks/useI18n';
import reportTemplateService, { type ReportTemplate } from '../../../services/reportTemplateService';
import { devLog } from '../../../utils/errorParser';
import { fetchAllPages, type PagedResponse } from '../../../utils/fetchAllPages';
import type { ReportJobConfig } from '../../../types';
import UserIdsField from './UserIdsField';
import type { JobConfigFieldsProps } from './index';

const FORMATS = ['pdf', 'excel', 'csv', 'json'];

/**
 * Report jobs authored here write `cron_expression` directly and leave
 * `schedule_config` unset — that field exists so micro-report can read its own
 * frequency back out of a cron expression; a platform-authored job has no such
 * need, and a half-filled `schedule_config` would mislead whoever reads it next.
 */
export default function ReportConfigFields({
  value, onChange, readOnly,
}: JobConfigFieldsProps<ReportJobConfig>) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState('');

  // C2 fix: recipients must be user ids, not free-text email strings — report.go
  // (executeViewerURL/dispatchNotification) passes cfg.Recipients straight through as
  // audience.user_ids, so an email string here would never resolve to anyone. Uses the
  // same UserIdsField as NotificationConfigFields.tsx so the two fields behave identically.

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoadingTemplates(true);
        const items = await fetchAllPages<ReportTemplate>(
          (page, perpage) => reportTemplateService.getAll({ page, perpage }) as Promise<PagedResponse<ReportTemplate>>,
          { label: 'ReportConfigFields.templates' },
        );
        if (!ignore) setTemplates(items);
      } catch (err) {
        devLog('Failed to load report templates:', err);
        if (!ignore) setTemplatesError(t('cronjob.config.templateIdLoadFailed'));
      } finally {
        if (!ignore) setLoadingTemplates(false);
      }
    })();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterEntries = Object.entries(value.filters ?? {});
  const setFilterEntries = (entries: [string, string][]) => {
    onChange({ ...value, filters: Object.fromEntries(entries) });
  };
  const addFilterRow = () => setFilterEntries([...filterEntries, ['', '']]);
  const updateFilterKey = (index: number, key: string) => {
    const entries = [...filterEntries];
    entries[index] = [key, entries[index][1]];
    setFilterEntries(entries);
  };
  const updateFilterValue = (index: number, val: string) => {
    const entries = [...filterEntries];
    entries[index] = [entries[index][0], val];
    setFilterEntries(entries);
  };
  const removeFilterRow = (index: number) => {
    setFilterEntries(filterEntries.filter((_, i) => i !== index));
  };

  const deliveryType = value.delivery?.type ?? '';
  const notificationsEmail = value.notifications?.email ?? false;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('cronjob.config.templateId')}</Label>
        {loadingTemplates ? (
          <Skeleton className="h-9 w-full" />
        ) : templatesError ? (
          <p className="text-sm text-destructive">{templatesError}</p>
        ) : (
          <Select
            value={value.template_id ?? ''}
            onValueChange={(template_id) => onChange({ ...value, template_id })}
            disabled={readOnly}
          >
            <SelectTrigger><SelectValue placeholder={t('cronjob.config.templateIdPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name} — {tpl.report_group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('cronjob.config.buCodes')}</Label>
        <BusinessUnitMultiSelect
          value={value.bu_codes ?? []}
          onChange={(bu_codes) => onChange({ ...value, bu_codes })}
          disabled={readOnly}
          keyBy="code"
        />
        {/* I1 fix: unlike dashboard_refresh, report.go errors with "report job config
            missing bu_codes" when this is empty — the "leave empty" hint was copied
            from DashboardRefreshConfigFields, where empty genuinely means "all". */}
        <p className="text-xs text-muted-foreground">{t('cronjob.config.buCodesRequiredHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('cronjob.config.format')}</Label>
        <Select
          value={value.format ?? ''}
          onValueChange={(format) => onChange({ ...value, format })}
          disabled={readOnly}
        >
          <SelectTrigger><SelectValue placeholder={t('cronjob.config.formatPlaceholder')} /></SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('cronjob.config.filters')}</Label>
        <div className="space-y-2">
          {filterEntries.map(([key, val], index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={t('cronjob.config.filterKeyPlaceholder')}
                disabled={readOnly}
                value={key}
                onChange={(e) => updateFilterKey(index, e.target.value)}
              />
              <Input
                placeholder={t('cronjob.config.filterValuePlaceholder')}
                disabled={readOnly}
                value={val}
                onChange={(e) => updateFilterValue(index, e.target.value)}
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFilterRow(index)}
                  aria-label={t('cronjob.config.removeFilterAria')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={addFilterRow}>
            <Plus className="mr-2 h-4 w-4" />
            {t('cronjob.config.addFilter')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('cronjob.config.recipients')}</Label>
        <UserIdsField
          value={value.recipients ?? []}
          onChange={(recipients) => onChange({ ...value, recipients })}
          disabled={readOnly}
        />
        <p className="text-xs text-muted-foreground">{t('cronjob.config.recipientsHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('cronjob.config.deliveryType')}</Label>
        <Select
          value={deliveryType}
          onValueChange={(type) => onChange({ ...value, delivery: { ...value.delivery, type } })}
          disabled={readOnly}
        >
          <SelectTrigger><SelectValue placeholder={t('cronjob.config.deliveryType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="file">{t('cronjob.config.deliveryTypeFile')}</SelectItem>
            <SelectItem value="viewer_url">{t('cronjob.config.deliveryTypeViewerUrl')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* I5 fix: viewer_endpoint used to be a free-text URL here, and report.go's
          in-cluster worker POSTs to it carrying an x-user-id header — a browser-writable
          field controlling a server-side POST is an authenticated SSRF primitive gated
          only on cronjob.manage. Deliberately no input for it: resolveViewerEndpoint in
          report.go composes a safe default (its own configured service URL + bu_code)
          whenever delivery.viewer_endpoint is absent or not an http(s) URL, so leaving
          it unset is the correct choice, not a missing feature. */}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            disabled={readOnly}
            checked={value.notifications?.web ?? false}
            onChange={(e) => onChange({
              ...value,
              notifications: { ...value.notifications, web: e.target.checked },
            })}
          />
          <span className="text-sm">{t('cronjob.config.notificationsWeb')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            disabled={readOnly}
            checked={notificationsEmail}
            onChange={(e) => onChange({
              ...value,
              notifications: { ...value.notifications, email: e.target.checked },
            })}
          />
          <span className="text-sm">{t('cronjob.config.notificationsEmail')}</span>
        </label>
      </div>

      {notificationsEmail && (
        <div className="space-y-2">
          <Label>{t('cronjob.config.mailSource')}</Label>
          <Select
            value={value.notifications?.mail_source ?? ''}
            onValueChange={(mail_source) => onChange({
              ...value,
              notifications: { ...value.notifications, mail_source },
            })}
            disabled={readOnly}
          >
            <SelectTrigger><SelectValue placeholder={t('cronjob.config.mailSource')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">{t('cronjob.config.mailSourceInternal')}</SelectItem>
              <SelectItem value="external">{t('cronjob.config.mailSourceExternal')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
