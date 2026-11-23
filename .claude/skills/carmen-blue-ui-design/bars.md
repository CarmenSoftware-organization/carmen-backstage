# Bars (footer status bar, toolbar, summary bar)

A bar with two sides pushed left and right (`justify-between`) overlaps when it chooses what to show
from the screen width.

```tsx
<footer className="@container flex items-center justify-between gap-3 …">
  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
    <span className="truncate">{name}</span>
    <span className="hidden shrink-0 @md:inline">{buCode}</span>
  </div>
  <div className="flex shrink-0 items-center gap-3">
    <span className="hidden @md:flex">{time}</span>
    <span className="hidden @4xl:flex">{apiVersion}</span>
  </div>
</footer>
```

- Order things by importance; less important things appear as the bar gets wider.
- Hidden things must still be reachable another way (tooltip, `aria-label`, or present elsewhere on
  the page).
- Text `truncate`d down to a few characters ("Admi…") means too much is still showing — hide more.

Steps of `status-bar.tsx`: narrower than 448px shows name · period code · App v → time + BU code +
"Period" label (`@md`, 448px) → commit hash (`@2xl`, 672px) → full "Inventory period" label + API
version (`@4xl`, 896px)

## Summary bar above a table

(Total + breakdown + "view all" link on the Document page.) Every piece sits together on the left,
not total-left / breakdown-right, and they go horizontal once the bar itself is wide enough
(`@container` + `@xl:flex-row`).

## Search bar of a list page (rule 12)

Search box → View button → Filter button, together on the left. Always use `ListToolbar`. If you must
lay it out yourself, the wrapper around the search box must not stretch from `md` (the search box has
a fixed width at that size):

```tsx
<div className="flex w-full items-center gap-2">
  <div className="flex-1 md:flex-initial"><SearchInput … /></div>
  <ViewSelector … />
  <ListFilter … />
</div>
```

Expected: the distance from the search box's right edge to the View button's left edge is the same
at every screen size from tablet up (17px) — the `search` line of `__vp` reports it.

## Form header buttons (rule 13)

One line at every screen size. When the header is narrower than 576px, secondary buttons become
icon-only.

```tsx
// DocFormHeader — the header is a named container
<div className="@container/doc-header relative">…</div>

// secondary button: the label sits in a span hidden when the header is narrow + title for hover
<Button variant="outline" size="sm" title={tc("delete")}>
  <Trash2 />
  <span className="@max-xl/doc-header:sr-only">{tc("delete")}</span>
</Button>
```

- The primary button (Edit / Save) always keeps its label · secondary = Cancel, Delete, Print,
  Comment, Activity
- `sr-only`, not `hidden` — the label is still the button's name for screen readers and for tests
  that find buttons by text
- The order must not change: Edit/Cancel·Save → Delete → page buttons → Comment → Activity, and they
  must not collapse into a ⋯ menu (the user reversed that, 2026-10-29)
- Numbers: the button row with labels is ~440px wide · icon-only it is ~275px (Edit 62 + icons
  34×4 + gaps), which fits the 302px box of a 390 screen and the 272px box of a 360 screen · the
  576px switch point = wider than the labelled row by enough to keep the document name on the top
  line
- The container name does not exist outside the form header, so the same button used elsewhere
  (`PrintDocumentButton`) keeps its label as normal
- Older code that uses a screen breakpoint: `DocActions` (`max-xl:sr-only`) — not yet moved to the
  container. Move it when you touch it (rule 3).

Expected: the `header` line of `__vp` shows `rows 1` and `fits yes` at 360 / 390 / 486, view and
edit mode.
