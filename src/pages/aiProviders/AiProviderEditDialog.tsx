import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import aiProviderService from '../../services/aiProviderService';
import { getErrorDetail } from '../../utils/errorParser';
import { isVersionConflict, notifyVersionConflict } from '../../utils/docVersion';
import { useI18n } from '../../hooks/useI18n';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ProviderIconMark } from '../../components/icons/ProviderIcons';
import type { AiProvider } from '../../types';

const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,49}$/;
const ICON_KEYS = ['claude', 'chatgpt', 'gemini', 'deepseek', 'grok', 'google'] as const;
const NO_ICON = '__none__';
const PROMPT_MAX = 4000;

// {query} ที่ literal ในข้อความช่วย/ตัวอย่าง — i18n ใช้ {{}} จึงเขียน {query} ในไฟล์แปลได้ตรง ๆ
const previewUrl = (template: string) => template.replace(/\{query\}/g, () => encodeURIComponent('sample prompt'));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AiProvider | null;
  nextSortOrder: number;
  onSaved: () => void;
}

/** ปุ่มสลับเปิด/ปิด — repo ไม่มี ui/switch จึงใช้ Badge + ปุ่มแบบ FeatureStateToggle */
function BoolToggle({ id, checked, onChange, disabled, label, hint }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string; hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('h-auto shrink-0 p-0.5')}
      >
        <Badge variant={checked ? 'success' : 'secondary'}>{checked ? 'ON' : 'OFF'}</Badge>
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function AiProviderEditDialog({ open, onOpenChange, provider, nextSortOrder, onSaved }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [iconKey, setIconKey] = useState<string>(NO_ICON);
  const [iconUrl, setIconUrl] = useState('');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [defaultBu, setDefaultBu] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset ทุกครั้งที่เปิด — ค่าเริ่มมาจาก provider ที่กำลังแก้ (ถ้ามี)
  useEffect(() => {
    if (!open) return;
    setCode(provider?.code ?? '');
    setLabel(provider?.label ?? '');
    setIconKey(provider?.icon_key ?? NO_ICON);
    setIconUrl(provider?.icon_url ?? '');
    setUrlTemplate(provider?.url_template ?? '');
    setPrompt(provider?.default_prompt ?? '');
    setIsActive(provider?.is_active ?? true);
    setDefaultBu(provider?.default_enabled_for_bu ?? false);
    setSortOrder(String(provider?.sort_order ?? nextSortOrder));
    setSaving(false);
    setError(null);
  }, [open, provider, nextSortOrder]);

  const codeValid = provider !== null || CODE_RE.test(code);
  const canSave = !saving && codeValid && label.trim() !== '' && urlTemplate.trim() !== ''
    && prompt.trim() !== '' && prompt.length <= PROMPT_MAX && sortOrder.trim() !== '' && Number.isInteger(Number(sortOrder)) && Number(sortOrder) >= 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const body = {
      label: label.trim(),
      icon_key: iconKey === NO_ICON ? null : iconKey,
      icon_url: iconUrl.trim() || null,
      url_template: urlTemplate.trim(),
      default_prompt: prompt,
      is_active: isActive,
      default_enabled_for_bu: defaultBu,
      sort_order: Number(sortOrder),
    };
    try {
      if (provider) {
        await aiProviderService.update(provider.id, { ...body, doc_version: provider.doc_version });
        toast.success(t('toast.saved'));
      } else {
        await aiProviderService.create({ ...body, code });
        toast.success(t('toast.created', { entity: t('entity.aiProvider.title') }));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (isVersionConflict(err)) {
        notifyVersionConflict(t);
        onSaved();
        onOpenChange(false);
        return;
      }
      setError(t('pages.aiProviders.saveFailed', { detail: getErrorDetail(err, t) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
              {iconUrl.trim().startsWith('https://') ? (
                <img src={iconUrl.trim()} alt="" referrerPolicy="no-referrer" className="h-5 w-5 object-contain" />
              ) : (
                <ProviderIconMark iconKey={iconKey === NO_ICON ? null : iconKey} className="h-5 w-5" />
              )}
            </span>
            {t(provider ? 'pages.aiProviders.dialogEditTitle' : 'pages.aiProviders.dialogCreateTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <Section title={t('pages.aiProviders.sectionIdentity')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ap-label">{t('pages.aiProviders.fieldLabel')}</Label>
                <Input id="ap-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} disabled={saving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ap-code">{t('pages.aiProviders.fieldCode')}</Label>
                <Input
                  id="ap-code" value={code} onChange={(e) => setCode(e.target.value)}
                  disabled={saving || provider !== null} maxLength={50}
                  className={cn('font-mono', !codeValid && code !== '' && 'border-destructive')}
                />
                {!codeValid && code !== '' ? (
                  <p className="text-xs text-destructive">{t('pages.aiProviders.codeInvalid')}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('pages.aiProviders.fieldCodeHint')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ap-icon-key">{t('pages.aiProviders.fieldIconKey')}</Label>
                <Select value={iconKey} onValueChange={setIconKey} disabled={saving}>
                  <SelectTrigger id="ap-icon-key"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ICON}>{t('pages.aiProviders.iconNone')}</SelectItem>
                    {ICON_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <ProviderIconMark iconKey={k} className="h-4 w-4" />
                          {k}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ap-icon-url">{t('pages.aiProviders.fieldIconUrl')}</Label>
                <Input
                  id="ap-icon-url" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="https://" disabled={saving}
                />
                <p className="text-xs text-muted-foreground">{t('pages.aiProviders.fieldIconUrlHint')}</p>
              </div>
            </div>
          </Section>

          <Section title={t('pages.aiProviders.sectionLink')}>
            <div className="space-y-2">
              <Label htmlFor="ap-url">{t('pages.aiProviders.fieldUrlTemplate')}</Label>
              <Input
                id="ap-url" value={urlTemplate} onChange={(e) => setUrlTemplate(e.target.value)}
                placeholder="https://example.com/search?q={query}" className="font-mono text-sm" disabled={saving}
              />
              <p className="text-xs text-muted-foreground">{t('pages.aiProviders.fieldUrlTemplateHint')}</p>
              {urlTemplate.trim() && (
                <p className="break-all rounded-md bg-muted/50 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t('pages.aiProviders.urlPreview')}: </span>
                  <span className="font-mono">{previewUrl(urlTemplate.trim())}</span>
                </p>
              )}
            </div>
          </Section>

          <Section title={t('pages.aiProviders.fieldPrompt')}>
            <div className="space-y-2">
              <Textarea
                id="ap-prompt" aria-label={t('pages.aiProviders.fieldPrompt')}
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                rows={8} className="font-mono text-xs leading-relaxed" disabled={saving}
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">{t('pages.aiProviders.fieldPromptHint')}</p>
                <span className={cn('shrink-0 text-xs tabular-nums', prompt.length > PROMPT_MAX ? 'text-destructive' : 'text-muted-foreground')}>
                  {prompt.length}/{PROMPT_MAX}
                </span>
              </div>
            </div>
          </Section>

          <Section title={t('pages.aiProviders.sectionAvailability')}>
            <div className="space-y-4">
              <BoolToggle
                id="ap-active" checked={isActive} onChange={setIsActive} disabled={saving}
                label={t('pages.aiProviders.fieldActive')} hint={t('pages.aiProviders.fieldActiveHint')}
              />
              <BoolToggle
                id="ap-default-bu" checked={defaultBu} onChange={setDefaultBu} disabled={saving}
                label={t('pages.aiProviders.fieldDefaultBu')} hint={t('pages.aiProviders.fieldDefaultBuHint')}
              />
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ap-sort">{t('pages.aiProviders.fieldSort')}</Label>
                <Input
                  id="ap-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                  className="w-24 text-right tabular-nums" disabled={saving}
                />
              </div>
            </div>
          </Section>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.action.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
