import React, { useState } from 'react';
import { Search, X, RotateCw } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useReportTemplateSearch,
  toReportTemplateOption,
  type ReportTemplateOption,
} from '../hooks/useReportTemplateSearch';
import { useTypeahead } from './typeahead/useTypeahead';
import { TypeaheadFooter, TypeaheadStatus } from './typeahead/TypeaheadStatus';
import { hydrateByKeys, useHydratedOptions } from '../hooks/useHydratedOptions';
import reportTemplateService, { type ReportTemplate } from '../services/reportTemplateService';
import { useI18n } from '../hooks/useI18n';

interface ReportTemplatePickerProps {
  /** report template id · '' = none */
  value: string;
  onChange: (id: string, option: ReportTemplateOption | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** แจ้งสถานะเปิดจริงของ dropdown — ให้ Dialog/Sheet ที่ครอบอยู่กัน Escape ไม่ให้ปิดทั้งชั้น */
  onOpenChange?: (open: boolean) => void;
  invalid?: boolean;
}

// ระดับ module = stable
const fetchReportTemplatesByIds = (ids: string[]) =>
  hydrateByKeys<ReportTemplateOption>(ids, 'id', async ({ advance, perpage }) => {
    const res = await reportTemplateService.getAll({ page: 1, perpage, advance });
    return { data: ((res.data || []) as ReportTemplate[]).map(toReportTemplateOption), paginate: res.paginate };
  });
const keyOfOption = (o: ReportTemplateOption) => o.id;
const rowKey = (o: ReportTemplateOption) => o.id;

/**
 * Single report-template typeahead เก็บค่าเป็น template id — ค้นหาฝั่ง server + lazy load
 * `value` ที่อยู่นอกหน้าแรกถูก hydrate ด้วย id · id ที่หาไม่เจอ**คงค่าไว้** แสดง "Not found · <8 ตัวแรก>" (ไม่ reset)
 * ไม่แจ้ง onChange ตอน hydrate — payload ไม่เปลี่ยนถ้าผู้ใช้ไม่แตะ picker
 */
export const ReportTemplatePicker: React.FC<ReportTemplatePickerProps> = ({
  value, onChange, id, placeholder, disabled = false, ariaLabel, className, onOpenChange, invalid = false,
}) => {
  const { t } = useI18n();
  const [picked, setPicked] = useState<ReportTemplateOption | null>(null);
  const pickedHere = picked && picked.id === value ? picked : null;

  const { byKey, pending, missing, failed, retry } = useHydratedOptions<ReportTemplateOption>(
    value ? [value] : [],
    keyOfOption,
    fetchReportTemplatesByIds,
    { known: pickedHere ? [pickedHere] : null },
  );
  const resolved = value ? (pickedHere ?? byKey.get(value) ?? null) : null;
  const isPending = !!value && !resolved && pending.has(value);
  const isMissing = !!value && !resolved && missing.has(value);
  const isFailed = isMissing && failed.has(value);

  const showChip = !!value;
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { results, loading, loadingMore, hasMore, loadMore, error: searchError, loadMoreError } =
    useReportTemplateSearch(query, searchOpen && !disabled);

  const rows = !loading && !searchError ? results : [];

  const selectTemplate = (o: ReportTemplateOption) => {
    setPicked(o);
    onChange(o.id, o);
    setQuery('');
  };

  const ta = useTypeahead<ReportTemplateOption>({
    items: rows,
    getKey: rowKey,
    onPick: selectTemplate,
    disabled,
    hidden: showChip,
    onOpenChange: (o) => { setSearchOpen(o); onOpenChange?.(o); },
    hasMore, loadingMore, loadMoreError, loadMore,
  });

  const clearSelection = () => {
    setPicked(null);
    onChange('', null);
    setQuery('');
    ta.requestFocus();
  };

  if (showChip) {
    const title = resolved?.name ??
      (isMissing
        ? `${t(isFailed ? 'components.reportTemplatePicker.loadFailed' : 'components.reportTemplatePicker.notFound')} · ${value.slice(0, 8)}`
        : value);
    const sub = resolved ? resolved.report_group : null;
    return (
      <div className={cn('min-w-0', className)}>
        <div
          title={isMissing ? value : undefined}
          className={cn(
            'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs',
            invalid ? 'border-destructive' : 'border-input',
            disabled && 'bg-muted/50',
            (isMissing || isPending) && 'text-muted-foreground',
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate', isMissing && 'italic')}>{title}</span>
            {sub && <span className="truncate font-mono text-xs text-muted-foreground">{sub}</span>}
          </span>
          {isFailed && (
            <button
              type="button"
              onClick={retry}
              className="shrink-0 rounded hover:text-foreground"
              aria-label={t('common.action.retry')}
              title={t('common.action.retry')}
            >
              <RotateCw className="h-4 w-4" />
            </button>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded hover:text-destructive"
              aria-label={t('components.reportTemplatePicker.clearSelectedAria', { name: title })}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const nothing = rows.length === 0;

  return (
    <div {...ta.getWrapperProps({ className: cn('relative min-w-0', className) })}>
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1 rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-within:outline-hidden focus-within:ring-1 focus-within:ring-ring',
          invalid ? 'border-destructive' : 'border-input',
          disabled && 'bg-muted/50 cursor-not-allowed',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          {...ta.getInputProps()}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            ta.setOpen(true);
          }}
          placeholder={placeholder ?? t('components.reportTemplatePicker.defaultPlaceholder')}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {ta.open && (
        <div
          {...ta.listProps}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
        >
          {rows.map((o, i) => (
            <button
              key={rowKey(o)}
              type="button"
              {...ta.getOptionProps(o, i)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground data-[active]:bg-accent data-[active]:text-accent-foreground"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{o.name}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{o.report_group}</span>
              </span>
            </button>
          ))}
          <TypeaheadStatus
            loading={loading}
            error={searchError ?? undefined}
            empty={nothing}
            searchingLabel={t('components.reportTemplatePicker.searchingEllipsis')}
            emptyLabel={query ? t('components.reportTemplatePicker.noMatch', { query }) : t('components.reportTemplatePicker.typeToSearch')}
          />
          {rows.length > 0 && (
            <TypeaheadFooter
              loadingMore={loadingMore}
              loadMoreError={loadMoreError ?? undefined}
              onRetry={loadMore}
              loadingMoreLabel={t('components.reportTemplatePicker.loadingMore')}
            />
          )}
        </div>
      )}
    </div>
  );
};
