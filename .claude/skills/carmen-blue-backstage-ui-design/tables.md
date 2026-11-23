# Tables

## Management list (`DataTable`)

Page shape (summary band, search, filter Sheet, CSV, debug Sheet) is fixed by
`agent-os/standards/pages/management-page.md` — **do not change the structure**. Width decisions
that are yours:

| Prop / hint | What it does | When |
|---|---|---|
| `tableLayout="fixed"` (default) | equal-width columns | many columns of similar length |
| `tableLayout="auto"` | columns size to content | a Name column that must not truncate; few short columns |
| `stickyLeftColumns` 2 / 3 / 4 | the first two columns are always frozen; 3 / 4 also freeze the columns after them (cluster Code + Name, user select + avatar) | wide tables |
| `stickyRightColumn` | the last column is frozen only when its `id` is `'actions'` (automatic); pass it to force on/off | action column with another id |
| `mobileCards` + column `meta: { card: … }` | one card per row below `mobileBreakpoint` | default on — give every column a card role |
| `mobileBreakpoint` | **viewport** media query, default `(min-width: 1024px)` | known deviation from rule 3 — see below |

- **Never add a `#` column** — `DataTable` adds one (root `CLAUDE.md` rule 4).
- **Column defs in `useMemo`** with correct deps (rule 8 there).
- **`enableSorting` needs an `accessorFn`** (or `accessorKey`) — a display-only column with
  `enableSorting` renders a dead header.

### Few short columns on a wide screen (rule 2)

With `tableLayout="fixed"` four short columns on a 1400px box end up ~330px apart. Use
`tableLayout="auto"` and let one column take the rest: the long-text column (description, note)
when there is one, otherwise the last data column. Truncate long text with `block truncate` +
`title`, not a fixed `max-w-[…]` (several existing cells use `max-w-[220px]` — fine to leave, do
not copy).

### `mobileBreakpoint` is a viewport query

At 1024 with the sidebar expanded the page content box is 730px (1073 at 1366; less a Card's padding for the table). A table that needs
900px still renders as a table at 1024 and scrolls sideways. Either raise `mobileBreakpoint` for
that page (e.g. `(min-width: 1280px)`) or hide secondary columns through `columnVisibility`.
Measure the `tables` line of `__vp` at 1024 **and** 1180 with the sidebar expanded, not just at the
5 standard sizes.

## Table on an Edit page

(Few columns inside a card — BU users, cluster seats.) Below the card's own width a table is
squeezed; switch to one card per row with `@container` on the card +
`@xl:hidden` (stacked list) / `hidden @xl:block` (table). Build the row's parts (name, status,
buttons) once and use them in both forms. **The switch point = the table's measured minimum
width**, not one value for every page.

## Plain `<table className="w-full">`

The browser shares the remaining width among all columns. Make data columns as wide as their
content with `w-px whitespace-nowrap` (+ `pr-10` as spacing) and let one column take the rest.
Content in a `w-px` column must not `flex-wrap`, or the column shrinks to its widest piece.

For a long-text column: `<td className="w-full max-w-0">` + `<span className="block truncate"
title={…}>` (`max-w-0` stops the cell pushing the table wider), header `min-w-40`.

## Gotchas

- **A frozen column needs the surface it sits on** — `DataTable` defaults `--sticky-right-bg` to
  `--background`; a hand-written table inside a Card must pass `[--sticky-right-bg:var(--card)]`, or
  a grey stripe runs down the frozen column in both themes
  (`agent-os/standards/styling/table-sticky-columns.md`).
- **Never freeze a data column on the right** (Status, Period) — only a real action column; a
  hand-written `table-sticky-right` must be gated on the same condition that renders that column.
- **`shrink-0` hides overflow until labels grow** — a row of `shrink-0` buttons fits in English and
  is clipped in Thai; `scrollWidth` does not catch it. Measure with `lang` = `th`.
- **Do not use an empty trailing column to absorb width** — make a real column take the rest.
