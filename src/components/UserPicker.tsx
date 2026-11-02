import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUserSearch } from '../hooks/useUserSearch';
import type { UserOption } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useTypeahead } from './typeahead/useTypeahead';
import { TypeaheadFooter, TypeaheadStatus } from './typeahead/TypeaheadStatus';

interface UserPickerProps {
  value: UserOption | null;
  onChange: (next: UserOption | null) => void;
  /** Users that must not be selectable (e.g. already granted the thing being granted). */
  disabledIds?: Set<string>;
  /** Label shown beside a disabled result explaining why it cannot be picked. */
  disabledLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  /** Accessible name for the input — pass this whenever there is no visible `<label>`. */
  ariaLabel?: string;
  /** Notifies the parent when the results dropdown opens or closes, so a surrounding Dialog can keep Escape from closing it while the dropdown is open. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Single-user typeahead. Search runs server-side through `useUserSearch`, so it
 * reaches every user rather than a preloaded page of them.
 *
 * Search failures surface inside the dropdown only — never as a toast, which
 * would fire repeatedly while someone is still typing.
 */
export const UserPicker: React.FC<UserPickerProps> = ({
  value,
  onChange,
  disabledIds,
  disabledLabel,
  placeholder,
  disabled = false,
  error = false,
  id,
  ariaLabel,
  onOpenChange,
}) => {
  const { t } = useI18n();
  const effectiveDisabledLabel = disabledLabel ?? t('components.userPicker.disabledLabel');
  const effectivePlaceholder = placeholder ?? t('components.userPicker.defaultPlaceholder');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { results, loading, loadingMore, hasMore, loadMore, error: searchError, loadMoreError } = useUserSearch(
    query,
    searchOpen && !disabled,
  );
  const rows = !loading && !searchError ? results : [];

  const ta = useTypeahead<UserOption>({
    items: rows,
    getKey: (u) => u.id,
    isDisabled: (u) => disabledIds?.has(u.id) ?? false,
    onPick: (u) => selectUser(u),
    disabled,
    hidden: !!value,
    onOpenChange: (o) => { setSearchOpen(o); onOpenChange?.(o); },
    hasMore, loadingMore, loadMoreError: loadMoreError || undefined, loadMore,
  });

  const selectUser = (u: UserOption) => {
    onChange(u);
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
          <span className="truncate">{value.name}</span>
          {value.email && (
            <span className="truncate text-xs text-muted-foreground">{value.email}</span>
          )}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="shrink-0 rounded hover:text-destructive"
            aria-label={t('components.userPicker.clearSelectedAria', { name: value.name })}
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
          {rows.map((u, i) => {
            const isDisabled = disabledIds?.has(u.id) ?? false;
            return (
              <button
                type="button"
                key={u.id}
                {...ta.getOptionProps(u, i)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground',
                  isDisabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{u.name}</span>
                  {u.email && <span className="truncate text-xs text-muted-foreground">{u.email}</span>}
                </span>
                {isDisabled && (
                  <span className="shrink-0 text-xs text-muted-foreground">{effectiveDisabledLabel}</span>
                )}
              </button>
            );
          })}
          <TypeaheadStatus
            loading={loading}
            error={searchError || undefined}
            empty={rows.length === 0}
            searchingLabel={t('components.userSearch.searchingEllipsis')}
            emptyLabel={query ? t('components.userSearch.noMatch', { query }) : t('components.userSearch.typeToSearch')}
          />
          {rows.length > 0 && (
            <TypeaheadFooter
              loadingMore={loadingMore}
              loadMoreError={loadMoreError || undefined}
              onRetry={loadMore}
              loadingMoreLabel={t('components.userPicker.loadingMore')}
            />
          )}
        </div>
      )}
    </div>
  );
};
