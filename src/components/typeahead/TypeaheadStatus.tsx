import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LoadMoreErrorRow } from '../LoadMoreErrorRow';

export interface TypeaheadStatusProps {
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
        <span>{searchingLabel}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div role="presentation" className="px-3 py-4 text-sm text-destructive">
        <span>{error}</span>
      </div>
    );
  }
  if (empty) {
    return (
      <div role="presentation" className="px-3 py-4 text-sm text-muted-foreground">
        <span>{emptyLabel}</span>
      </div>
    );
  }
  return null;
};

export interface TypeaheadFooterProps {
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
        <span>{loadingMoreLabel}</span>
      </div>
    );
  }
  if (loadMoreError) return <LoadMoreErrorRow message={loadMoreError} onRetry={onRetry} className={className} />;
  return null;
};

interface TypeaheadAnnouncerProps {
  /** `ta.open` — nothing is announced while the dropdown is closed */
  open: boolean;
  /** The same props given to `<TypeaheadStatus>` (omit when the picker has no status row right now) */
  status?: TypeaheadStatusProps;
  /** The same props given to `<TypeaheadFooter>` (omit when the footer is not rendered) */
  footer?: Pick<TypeaheadFooterProps, 'loadingMore' | 'loadMoreError' | 'loadingMoreLabel'>;
}

/**
 * The picker's single live region. Render it once, always mounted, outside the listbox and outside the
 * conditionally rendered dropdown: a live region that mounts already filled is not announced by many screen readers,
 * so the status rows themselves carry no `aria-live`. Mirrors the precedence of TypeaheadStatus / TypeaheadFooter.
 */
export const TypeaheadAnnouncer: React.FC<TypeaheadAnnouncerProps> = ({ open, status, footer }) => {
  let message = '';
  if (open) {
    if (status?.loading) message = status.searchingLabel;
    else if (status?.error) message = status.error;
    else if (status?.empty) message = status.emptyLabel;
    else if (footer?.loadingMore) message = footer.loadingMoreLabel;
    else if (footer?.loadMoreError) message = footer.loadMoreError;
  }
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {message}
    </span>
  );
};
