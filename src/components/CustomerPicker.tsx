import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import type { CustomerOption } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useTypeahead } from './typeahead/useTypeahead';
import { TypeaheadStatus } from './typeahead/TypeaheadStatus';

interface CustomerPickerProps {
  value: CustomerOption | null;
  onChange: (next: CustomerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  /** Accessible name for the input — pass this whenever there is no visible `<label>`. */
  ariaLabel?: string;
  /** Reports the dropdown's real open state so a surrounding Dialog/Sheet can guard Escape. */
  onOpenChange?: (open: boolean) => void;
}

const optionLabel = (c: CustomerOption) =>
  c.company_name ? `${c.ar_number} · ${c.company_name}` : c.ar_number;

/**
 * Single-customer typeahead (clone of UserPicker). Search runs server-side through
 * `useCustomerSearch`; failures surface inside the dropdown only, never as a toast.
 * Mount it only when the caller holds `customer.read` — it fires a request on open.
 */
export const CustomerPicker: React.FC<CustomerPickerProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  id,
  ariaLabel,
  onOpenChange,
}) => {
  const { t } = useI18n();
  const effectivePlaceholder = placeholder ?? t('components.customerPicker.defaultPlaceholder');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { results, loading, error: searchError } = useCustomerSearch(query, searchOpen && !disabled);
  const rows = !loading && !searchError ? results : [];

  const ta = useTypeahead<CustomerOption>({
    items: rows,
    getKey: (c) => c.id,
    onPick: (c) => select(c),
    disabled,
    hidden: !!value,
    onOpenChange: (o) => { setSearchOpen(o); onOpenChange?.(o); },
  });

  const select = (c: CustomerOption) => {
    onChange(c);
    setQuery('');
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    ta.requestFocus();
  };

  if (value) {
    return (
      <div
        className={cn(
          'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs',
          error ? 'border-destructive' : 'border-input',
          disabled && 'bg-muted/50',
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono">{value.ar_number}</span>
          {value.company_name && (
            <span className="truncate text-xs text-muted-foreground">{value.company_name}</span>
          )}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="shrink-0 rounded hover:text-destructive"
            aria-label={t('components.customerPicker.clearSelectedAria', { name: optionLabel(value) })}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div {...ta.getWrapperProps({ className: 'relative' })}>
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1 rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-within:outline-hidden focus-within:ring-1 focus-within:ring-ring',
          error ? 'border-destructive' : 'border-input',
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
          placeholder={effectivePlaceholder}
          aria-label={ariaLabel}
          aria-invalid={error || undefined}
          className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {ta.open && (
        <div
          {...ta.listProps}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
        >
          {rows.map((c, i) => (
            <button
              type="button"
              key={c.id}
              {...ta.getOptionProps(c, i)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground data-[active]:bg-accent data-[active]:text-accent-foreground"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono">{c.ar_number}</span>
                {c.company_name && (
                  <span className="truncate text-xs text-muted-foreground">{c.company_name}</span>
                )}
              </span>
              {c.status === 'inactive' && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t('components.customerPicker.inactive')}
                </span>
              )}
            </button>
          ))}
          <TypeaheadStatus
            loading={loading}
            error={searchError || undefined}
            empty={rows.length === 0}
            searchingLabel={t('components.customerPicker.searchingEllipsis')}
            emptyLabel={query ? t('components.customerPicker.noMatch', { query }) : t('components.customerPicker.typeToSearch')}
          />
        </div>
      )}
    </div>
  );
};
