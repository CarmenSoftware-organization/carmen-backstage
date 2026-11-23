# Bars (shell header + footer, PageHeader actions, unsaved bar, search row)

## Shell bars (`components/Layout.tsx`)

- **Desktop header** (`md:flex`, `h-16`, sticky, opaque): breadcrumbs left, `LanguageToggle` ·
  `ThemeToggle` · `HeaderUserMenu` right. Height matches the sidebar logo slot so the two bottom
  borders form one line — do not change one without the other.
- **Footer** (sticky bottom, opaque): `VersionStamp` left, `FooterClock` right (`ml-auto`), inside
  the same `container` as `<main>`, `flex-wrap` so it drops to two lines on a phone.
- **Every sticky bar is opaque** (`bg-background`) — no `backdrop-blur` outside `components/ui`.

A bar with two sides pushed apart overlaps when it picks what to show from the screen width.
When you add something to a shell bar, decide from the bar's own width:

```tsx
<div className="@container flex items-center gap-3">
  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
    <span className="truncate">{primary}</span>
    <span className="hidden shrink-0 @md:inline">{secondary}</span>
  </div>
  <div className="flex shrink-0 items-center gap-3">
    <span className="hidden @4xl:flex">{tertiary}</span>
  </div>
</div>
```

Order by importance; less important things appear as the bar widens. Whatever is hidden must be
reachable another way (`title`, `aria-label`, or elsewhere on the page). Text truncated to a few
characters ("Admi…") means too much is still showing — hide more.

## `PageHeader` actions (rule 13)

`PageHeader` stacks title above actions below `sm` and puts them in one row from `sm`; the actions
box is `flex flex-wrap`. What may go there: the Edit toggle (Toggle mode), page-level buttons
(Export CSV, Add, Refresh), a freshness stamp. What may **not**: Save/Cancel (they go in
`.unsaved-bar`), a `<Button>Back</Button>` (use `backTo` or `BackLink`).

- Keep the actions on one line: at the widths where they would wrap, make secondary buttons
  icon-only with the label in `<span className="sr-only">` (not `hidden` — tests and screen readers
  find buttons by name) and a `title`. The primary keeps its label.
- Never collapse them into a ⋯ menu; do not reorder them.
- Status beside the title goes in `afterTitle`, never inside the `<h1>`.

## `.unsaved-bar` (Edit pages)

Sticky at the bottom, offset to the sidebar; wrap the page in enough bottom padding (`pb-20` /
`pb-24`) that the bar never covers the last card. Cancel · Save on the right, `gap-3`.

## Search row of a Management page (rule 12)

`SearchInput` → Filter button (opens the filter Sheet) → active-filter badges, together on the
left. Export / column buttons may sit on the right. The wrapper around the search box must not
stretch from `md`, or the Filter button drifts to the far right on a wide screen:

```tsx
<div className="flex w-full flex-wrap items-center gap-2">
  <div className="flex-1 md:flex-initial md:w-80"><SearchInput … /></div>
  <Button variant="outline" size="sm" onClick={openFilters}>…</Button>
  {activeFilterBadges}
</div>
```

Expected: the `search gap` line of `__vp` is the same at every size from 768 up.
