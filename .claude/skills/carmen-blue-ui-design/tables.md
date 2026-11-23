# Tables (list pages)

List pages are already full-width and compact. The one place that breaks rule 2 is **a table with
only a few short columns**: `DataGrid` divides the width in proportion to `size`, so on a 4K screen
the columns end up thousands of pixels apart.

```tsx
{ accessorKey: "period", size: 240, … },
{ accessorKey: "start_at", size: 195, … },
// the last column takes the rest → the two columns before it are fixed-width, so the
// left-aligned content stays close together
{ accessorKey: "status", size: 110, meta: { grow: true }, … },
```

**Which column grows:** the long-text column (description, note) when the table has one — even when
other columns come after it, as in a config list where status and the row buttons follow the
description; those stay fixed-width. Only a table with no long-text column grows its last data
column, as above.

## Tablet budget

The `size` total of every visible column — the index, status and row-button columns a helper adds
count too, and so does the grow column's `size` (that is its minimum width) — must not exceed:

| Table | Budget |
|---|---|
| `DataGrid` | **662px** |
| `useConfigTable`, or a table adding `selectColumn()` without `tableLayout.checkbox` | **607px** (662 − 55px select column that `getTotalSize()` counts even when not rendered) |

**Where 662 comes from:** it is the measured inner width of the `DataGrid` box on a 768 screen, with
the shell in its tablet state (box width − 2px `DataGridContainer` border). It is not a constant —
after any change to the sidebar, rail or gutter, re-measure with `__vp(768, 1024)` (the frame width `b`
of the `tables` line) and update both numbers in this table.

Write the sum in a comment above the columns. Truncate long-text cells with `block truncate` +
`title` by the column width, not a fixed `max-w-*`.

## `grow` gotchas

- **`meta.grow` turns the other columns into fixed px, so measure at tablet** — the sum of `size`
  plus the minimum width of the grow column (~165px for a status column) must not exceed the budget
  or the table overflows. Never use it on a multi-column editable table.
- **You cannot hide a column of a grow table with CSS** — the table's minimum width is computed from
  every column TanStack considers visible. Turn it off through `state.columnVisibility` based on the
  measured box width.
- **A column step's switch point must be higher than that step's `size` total** — set them exactly
  equal and, once the box is just past that point, the secondary column comes back and the grow
  column shrinks to its minimum.
- **Do not use an empty trailing column to absorb the remaining width** — it is at least 75px wide
  even with `p-0!`. Make the last data column the grow column.
- **A row-button column must be wide enough**: two 24px buttons + 4 gap + 24 cell padding = 76px.
  With `size: 72` the buttons wrap onto two lines. Use 84.

## Table on a detail page

(Few columns, inside a section.) Use `grow` only when the box is wide enough — measure with
`useElementWidth`. When the box is narrower than the column total, fall back to proportional widths
(no `grow`), otherwise the table overflows its box on mobile. In a narrow box (`< 560px` measured,
not a screen breakpoint) it becomes **one card per row, not a squeezed table**: the card carries
every field of the table, row buttons are 32px tall (`size="icon-sm"`), and the box bound to the
width-measuring ref must exist in both views. Example: `CertificateCards` in
`routes/vendor-management/vendor/vendor-certificate-section.tsx`

**Pages that configure a pattern** (running-code) add a column showing the pattern's real result
(rule 8) — the sample document number `PR26110001` in the table, without opening a dialog row by
row.

## Columns that do not fit the tablet box

Choose by the measured width of the box, not the screen:

```tsx
// page: wrap the DataGrid in a measuring box (subtract DataGridContainer's 1px border on each side)
const [setGridBox, gridBoxWidth] = useElementWidth();
const table = useXxxTable({ …, containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2 });
<div ref={setGridBox}><DataGrid table={table} …>…</DataGrid></div>

// table hook: undefined (not measured yet) = the wide-box set
const w = containerWidth ?? Number.POSITIVE_INFINITY;
```

- **Many columns (document, 6 columns):** hide secondary columns in steps through
  `state.columnVisibility` — uploader ≥1060 · type ≥890 · sequence number ≥800. Whatever is hidden
  must still be reachable another way (the type icon moves in front of the file name; the uploader
  is in the preview view).
- **Few columns but wide values (user: name, email, department):** do not hide; swap between two
  `size` sets — box ≥900: name 240 / email 280; below that 180 / 190. The last column (department)
  is the grow column.
- Write each step's `size` total in a comment above the step function. Recalculate whenever a column
  size changes.
- On a page without `"use no memo"`, resize the box live and confirm the columns swap (React
  Compiler may freeze the JSX).

## Plain HTML table (`<table className="w-full">`)

The browser shares the remaining width among all columns. Make data columns as wide as their
content with `w-px whitespace-nowrap` (+ `pr-10` as spacing) and let the last column (row buttons,
right-aligned) take the rest. Content in a `w-px` column must not `flex-wrap`, otherwise the column
shrinks to its widest piece and labels drop to a new line.

If the table has a long-text column (subject, description), make that column the single elastic one:
`<td className="w-full max-w-0">` + `<span className="block truncate" title={…}>` (`max-w-0` stops
the cell from pushing the table wider to fit the text). Give its header `min-w-40`, and the button
column goes back to `w-px`. Do not use a fixed `max-w-*` on long text — the subject gets cut at
256px even though the screen has room, and combined with other nowrap columns the table overflows at
1366px.

A table whose minimum width exceeds the box: switch to a stacked list by the box width
(`@container` + `@xl:hidden` / `hidden @xl:block`), building the row's parts (name, status, buttons)
once and using them in both forms. **The switch point = the table's measured minimum width**, not
one value for every page: email-profile (4 columns, ~610px) switches at `@xl`; email-template
(5 columns, ~890px) switches at `@4xl`. Measure every table against its frame at every size,
including 1024 and 1180 (the `tables` line of `__vp`). Examples: `routes/system-admin/email-profile/`,
`routes/system-admin/email-template/`
