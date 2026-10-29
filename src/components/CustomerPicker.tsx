import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import type { CustomerOption } from '../types';
import { useI18n } from '../hooks/useI18n';

interface CustomerPickerProps {
  value: CustomerOption | null;
  onChange: (next: CustomerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  /** Accessible name for the input — pass this whenever there is no visible `<label>`. */
  ariaLabel?: string;
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
}) => {
  const { t } = useI18n();
  const effectivePlaceholder = placeholder ?? t('components.customerPicker.defaultPlaceholder');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const changeOpen = useCallback((next: boolean) => setOpen(next), []);

  const { results, loading, error: searchError } = useCustomerSearch(query, open && !disabled);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        changeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, changeOpen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') changeOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, changeOpen]);

  const select = (c: CustomerOption) => {
    onChange(c);
    setQuery('');
    changeOpen(false);
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
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
    <div ref={wrapperRef} className="relative">
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1 rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-within:outline-hidden focus-within:ring-1 focus-within:ring-ring',
          error ? 'border-destructive' : 'border-input',
          disabled && 'bg-muted/50 cursor-not-allowed',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            changeOpen(true);
          }}
          onFocus={() => changeOpen(true)}
          placeholder={effectivePlaceholder}
          aria-label={ariaLabel}
          className="flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('components.customerPicker.searchingEllipsis')}
            </div>
          )}
          {!loading && searchError && (
            <div className="px-3 py-4 text-sm text-destructive">{searchError}</div>
          )}
          {!loading && !searchError && results.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {query
                ? t('components.customerPicker.noMatch', { query })
                : t('components.customerPicker.typeToSearch')}
            </div>
          )}
          {!loading && !searchError && results.length > 0 && (
            <ul className="py-1">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
