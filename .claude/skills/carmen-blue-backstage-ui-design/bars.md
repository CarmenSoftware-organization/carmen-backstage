# Bars (shell header + footer, PageHeader actions, unsaved bar, search row)

## Shell bars (`components/Layout.tsx`)

- **Desktop header** (`md:flex`, `h-16`, sticky, opaque): breadcrumbs left, `LanguageToggle` ·
  `ThemeToggle` · `HeaderUserMenu` right. Height matches the sidebar logo slot so the two bottom
  borders form one line — do not change one without the other.
- **Footer** (sticky bottom, opaque): `VersionStamp` left, `FooterClock` right (`ml-auto`), inside
  the same `container` as `<main>`, `flex-wrap` so it drops to two lines on a phone.
- **Every sticky bar is opaque** (`bg-background`) — no `backdrop-blur` outside `components/ui`,
  with one deliberate exception: `.unsaved-bar` (below).

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

Markup: `<div className="unsaved-bar fixed bottom-0 left-0 right-0 md:left-16 lg:left-60 z-40">`
with the unsaved-changes dot + text on the left and Cancel · Save on the right (`RoleEdit.tsx`).
The styling lives in `src/index.css` `.unsaved-bar`, outside `@layer`, so it beats the utilities:

- Below 768 it is a full-width bar at the bottom.
- From 768 it is a **floating pill centred on the viewport** (`left: 50%`, `width: max-content`,
  `bottom: 1.25rem`, rounded) — the `md:left-16 lg:left-60` classes are overridden, so the bar does
  not need to know whether the sidebar is collapsed. Do not "fix" those classes; do not add a
  second offset.
- It is the one **frosted-glass** surface left (`backdrop-filter`, falls back to opaque without
  support) — deliberate; do not copy it to other bars.
- Wrap the page in `pb-24` (Edit pages use `pb-24`; `ReportTemplateEdit` `pb-20`) so the last card
  is not covered.

## Search row of a Management page (rule 12)

`SearchInput` → Filter button (the `SheetTrigger` of the filter Sheet), together on the left;
active-filter badges on the line below. Export / Add sit in `PageHeader actions`, not in this row.
The search box stretches on a phone and stops at `sm:max-w-sm`, so the Filter button stays beside
it on a wide screen (`ClusterManagement.tsx`):

```tsx
<CardHeader className="space-y-3">
  <div className="flex items-center gap-2">
    <SearchInput … className="flex-1 sm:max-w-sm" />
    <Sheet open={showFilters} onOpenChange={setShowFilters}>
      <SheetTrigger asChild>{/* Filters button + active count */}</SheetTrigger>
      …
    </Sheet>
  </div>
  {/* active-filter badges */}
</CardHeader>
```

Expected: the `search gap` line of `__vp` is **8** at every size (`gap-2`) — measured on
`/clusters` at 390 / 768 / 1366.
