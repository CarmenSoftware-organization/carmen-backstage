import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LoadMoreErrorRow } from '../LoadMoreErrorRow';

interface TypeaheadStatusProps {
  loading: boolean;
  /** first-page search error */
  error?: string;
  /** no rows to show (pinned + results) — renders `emptyLabel` when not loading and no error */
  empty: boolean;
  searchingLabel: string;
  /** already resolved for the current query: "no match for X" or "type to search" */
  emptyLabel: string;
}

/** Searching / error / empty rows of a typeahead dropdown. Strings come from the picker's own i18n keys. */
export const TypeaheadStatus: React.FC<TypeaheadStatusProps> = ({ loading, error, empty, searchingLabel, emptyLabel }) => {
  if (loading) {
    return (
      <div role="presentation" className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span aria-live="polite">{searchingLabel}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div role="presentation" className="px-3 py-4 text-sm text-destructive">
        <span aria-live="polite">{error}</span>
      </div>
    );
  }
  if (empty) {
    return (
      <div role="presentation" className="px-3 py-4 text-sm text-muted-foreground">
        <span aria-live="polite">{emptyLabel}</span>
      </div>
    );
  }
  return null;
};

interface TypeaheadFooterProps {
  loadingMore: boolean;
  loadMoreError?: string;
  onRetry: () => void;
  loadingMoreLabel: string;
  className?: string;
}

/** Row under the results while the next page loads, or when it failed (with Retry). */
export const TypeaheadFooter: React.FC<TypeaheadFooterProps> = ({ loadingMore, loadMoreError, onRetry, loadingMoreLabel, className }) => {
  if (loadingMore) {
    return (
      <div role="presentation" className={cn('flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span aria-live="polite">{loadingMoreLabel}</span>
      </div>
    );
  }
  if (loadMoreError) return <LoadMoreErrorRow message={loadMoreError} onRetry={onRetry} className={className} />;
  return null;
};
