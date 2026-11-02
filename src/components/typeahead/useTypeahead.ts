import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import type React from 'react';
import { isNearBottom } from '../../hooks/usePagedSearch';

export interface UseTypeaheadOptions<T> {
  /** Rows the dropdown currently shows, in display order (pinned rows included). Pass only rows that are visible. */
  items: T[];
  getKey: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  /** `aria-selected` for an option (checked state); defaults to "is the active row". The cursor is always `data-active`. */
  isSelected?: (item: T) => boolean;
  onPick: (item: T) => void;
  /** Close the dropdown after a pick. Default true; multi-select passes false. */
  closeOnPick?: boolean;
  /** The picker is disabled: the dropdown never opens and reports closed. */
  disabled?: boolean;
  /** The dropdown cannot be seen for another reason (e.g. a chip replaces the input): same as disabled. */
  hidden?: boolean;
  /** Real open-state changes only, reported synchronously. Feed it a useRef in the host Sheet/Dialog Escape guard. */
  onOpenChange?: (open: boolean) => void;
  /** Focus the input after the first commit */
  autoFocus?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string;
  loadMore?: () => void;
}

/**
 * Open state, keyboard navigation, focus handling and ARIA wiring for a search dropdown.
 * The caller keeps the query, the search hook and the rendering.
 *
 * ```tsx
 * const ta = useTypeahead({ items, getKey, onPick, disabled, onOpenChange, ...pagedSearch });
 * <div {...ta.getWrapperProps({ className: 'relative' })}>
 *   <input {...ta.getInputProps({ onKeyDown: backspaceRemovesChip })} value={q} onChange={(e) => { setQ(e.target.value); ta.setOpen(true); }} />
 *   {ta.open && (
 *     <div {...ta.listProps}>
 *       {items.map((it, i) => <button type="button" key={getKey(it)} {...ta.getOptionProps(it, i)}>...</button>)}
 *     </div>
 *   )}
 * </div>
 * ```
 * - Render the dropdown only while `ta.open`. Items must be the rows actually visible, in order.
 * - Multi-select: pass `closeOnPick: false` (stays open after a pick) AND `isSelected` (checked state), because
 *   `aria-selected` otherwise defaults to the active row.
 * - Style the cursor with `data-[active]:bg-accent data-[active]:text-accent-foreground` (set on the active option in
 *   every picker); `aria-selected` is the checked state in multi-selects, so never highlight with it there.
 * - Enter: while the dropdown is open it is always consumed (preventDefault, so a host <form> never submits) and picks
 *   only when an enabled row is active; while closed it passes through untouched.
 * - `getInputProps(user)` / `getWrapperProps(user)` take your own props and chain handlers: yours runs first and the
 *   hook's is skipped if you call `e.preventDefault()`. Refs are merged. Always pass your onFocus/onBlur/onKeyDown
 *   through them, never spread after them.
 * - `ta.setOpen(false)` after your own custom close paths; `ta.requestFocus()` to focus the input
 *   once it mounts in the same commit (dropped otherwise, so a rejected clear never focuses late).
 * - Escape: while open it is consumed (preventDefault) and closes only the dropdown; while closed it passes
 *   through. Radix dismisses on a capture-phase listener first, so the host Sheet/Dialog must still guard
 *   `onEscapeKeyDown` with a ref set from `onOpenChange`.
 */
export function useTypeahead<T>(opts: UseTypeaheadOptions<T>) {
  const {
    items, getKey, isDisabled, isSelected, onPick, closeOnPick = true, disabled = false, hidden = false,
    onOpenChange, autoFocus = false, hasMore, loadingMore, loadMoreError, loadMore,
  } = opts;
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpenState] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const openRef = useRef(false);
  const blockedRef = useRef(false);
  blockedRef.current = disabled || hidden;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const focusRef = useRef(autoFocus);

  // The one place open changes. Reports only real changes; refuses to open while the dropdown cannot be seen.
  const setOpen = useCallback((next: boolean) => {
    if (next && blockedRef.current) return;
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);
    if (!next) setActiveKey(null);
    onOpenChangeRef.current?.(next);
  }, []);

  // Unmounted while open: release the host's Escape guard
  useEffect(() => () => {
    if (openRef.current) {
      openRef.current = false;
      onOpenChangeRef.current?.(false);
    }
  }, []);

  // Became invisible while open (disabled, chip shown): report closed without waiting for a click or key
  useEffect(() => {
    if (disabled || hidden) setOpen(false);
  }, [disabled, hidden, setOpen]);

  // Focus request: honoured only if the input exists in this commit and the picker is enabled
  useEffect(() => {
    if (!focusRef.current) return;
    focusRef.current = false;
    if (!blockedRef.current) inputRef.current?.focus();
  });
  const requestFocus = useCallback(() => {
    focusRef.current = true;
    bump();
  }, []);

  const visibleOpen = open && !disabled && !hidden;

  useEffect(() => {
    if (!visibleOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Handled: page-level shortcuts that skip defaultPrevented must not also cancel
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [visibleOpen, setOpen]);

  const activeIndex = visibleOpen && activeKey !== null ? items.findIndex((it) => getKey(it) === activeKey) : -1;
  const optionId = (index: number) => `${listId}-opt-${index}`;

  // Scroll the active row into view on keyboard moves only: hover-driven scrolling could reach the bottom and fire loadMore
  const keyboardMoveRef = useRef(false);
  useEffect(() => {
    if (activeIndex < 0 || !keyboardMoveRef.current) return;
    keyboardMoveRef.current = false;
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, listId]);

  const move = (dir: 1 | -1) => {
    const n = items.length;
    if (n === 0) return;
    let i = activeIndex;
    for (let step = 0; step < n; step += 1) {
      i = i < 0 ? (dir === 1 ? 0 : n - 1) : (i + dir + n) % n;
      if (!isDisabled?.(items[i])) {
        keyboardMoveRef.current = true;
        setActiveKey(getKey(items[i]));
        return;
      }
    }
  };

  const pick = (item: T) => {
    if (isDisabled?.(item)) return;
    onPickRef.current(item);
    if (closeOnPick) setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (blockedRef.current) return;
        e.preventDefault();
        if (!openRef.current) setOpen(true);
        else move(e.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Enter':
        // While the dropdown is open Enter never reaches the host <form>; it picks only when an enabled row is active.
        // While closed it passes through untouched.
        if (visibleOpen) {
          e.preventDefault();
          if (activeIndex >= 0 && !isDisabled?.(items[activeIndex])) pick(items[activeIndex]);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
    }
  };

  const hookBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && wrapperRef.current && !wrapperRef.current.contains(next)) setOpen(false);
  };

  const mergeRefs = <E,>(own: React.RefObject<E | null>, user?: React.Ref<E>) => (node: E | null) => {
    own.current = node;
    if (typeof user === 'function') user(node);
    else if (user) (user as React.RefObject<E | null>).current = node;
  };

  /** Props for the wrapper element. Your handlers run first; preventDefault() skips the hook's. */
  const getWrapperProps = (user: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLDivElement> } = {}) => ({
    ...user,
    ref: mergeRefs(wrapperRef, user.ref),
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      user.onBlur?.(e);
      if (!e.defaultPrevented) hookBlur(e);
    },
  });

  /** Props for the search input. Your handlers run first; preventDefault() skips the hook's. */
  const getInputProps = (user: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> } = {}) => ({
    ...user,
    ref: mergeRefs(inputRef, user.ref),
    role: 'combobox' as const,
    'aria-expanded': visibleOpen,
    'aria-controls': visibleOpen ? listId : undefined,
    'aria-activedescendant': activeIndex >= 0 ? optionId(activeIndex) : undefined,
    'aria-autocomplete': 'list' as const,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      user.onFocus?.(e);
      if (!e.defaultPrevented) setOpen(true);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      user.onKeyDown?.(e);
      if (!e.defaultPrevented) onKeyDown(e);
    },
  });

  const listProps = {
    id: listId,
    role: 'listbox' as const,
    // Keep focus in the input when pressing anywhere in the list (status text, padding): otherwise focus moves to
    // the surrounding Dialog/Sheet content and the focusout handler would close the dropdown. Buttons still click.
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onScroll: (e: React.UIEvent<HTMLElement>) => {
      // A failed next page waits for its Retry button instead of re-firing on every scroll
      if (isNearBottom(e.currentTarget) && hasMore && !loadingMore && !loadMoreError) loadMore?.();
    },
  };

  const getOptionProps = (item: T, index: number) => {
    const disabledItem = !!isDisabled?.(item);
    return {
      id: optionId(index),
      role: 'option' as const,
      tabIndex: -1,
      'aria-selected': isSelected ? isSelected(item) : index === activeIndex,
      // The keyboard/hover cursor. Style with `data-[active]:`; aria-selected means "checked" when isSelected is passed.
      'data-active': index === activeIndex ? '' : undefined,
      'aria-disabled': disabledItem || undefined,
      onClick: () => pick(item),
      onMouseMove: () => {
        if (!disabledItem && index !== activeIndex) setActiveKey(getKey(item));
      },
    };
  };

  return { open: visibleOpen, setOpen, activeIndex, wrapperRef, inputRef, listId, getWrapperProps, getInputProps, listProps, getOptionProps, requestFocus };
}
