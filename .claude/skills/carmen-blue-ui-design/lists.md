# Lists that are not a DataTable

## Feeds (Dashboard)

A timeline of rows, each with a name on the left and meta (verb, actor) beside it. Reference:
`pages/dashboard/ActivityStream.tsx` `Timeline` + `pages/Dashboard.tsx`.

```tsx
// page: feed takes the rest, the rail is fixed — no max-w on the page (rule 1)
<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_236px]">
  <Feed />
  <aside className="self-start lg:sticky lg:top-4"><Rail /></aside>
</div>

// feed: the meta column switches on the feed's own width (rule 3)
<div className="@container">
  <Link className="flex min-w-0 items-center gap-3 …">
    <span className="min-w-0 flex-1 @2xl:max-w-lg">{/* name — capped so meta stays beside it (rule 2) */}
      <span className="block truncate">{name}</span>
      <span className="@2xl:hidden">{` · ${verb} · ${who}`}</span>  {/* narrow: meta inline */}
    </span>
    <span className="hidden w-64 shrink-0 @2xl:flex">{verb} {who}</span>   {/* wide: own column */}
    <ChevronRight className="ml-auto …" />
  </Link>
</div>
```

- `grid-cols-1` below `lg` is load-bearing: without it the implicit column sizes to max-content and
  a long line scrolls the page.
- The switch point = name minimum (~200px) + the meta column (256px) + clock/rail/icon/gaps
  (~150px) ≈ 600 → `@2xl` (672). Measured: feed 474 at 768 → inline; 736 at 1366 → column.

## Config pages (one card per item)

(`ReportFormGroupManagement`, `EmailSettingManagement`.) A fixed small set — cards, not a table
(`src/pages/CLAUDE.md` §Configuration Page Pattern). The existing pages use
`grid gap-4 lg:grid-cols-2` — a viewport breakpoint that stays at 2 columns up to 4K. For new
code, or when one of them looks stretched, use
`grid-cols-[repeat(auto-fill,minmax(min(100%,<min>),1fr))]`:

- `auto-fill`, not `auto-fit`, when there may be a single card — `auto-fit` stretches it across
  the row.
- `auto-fit` when the number of groups comes from data and you want the existing groups to fill the
  width (no empty column on the right).
- `min(100%, …)` stops the minimum from overflowing a phone.
- Inside a card, switch on the card's width (`@container` + `@sm:` / `@xl:`) — a card can be narrow
  on a wide screen once the grid splits into several columns.
- No `items-start` when the cards sit in one row (rule 4: same height).

## Settings list "label left, value right, full row"

Breaks rule 2 on a wide screen (the value ends up 1000px from its label). Make each item a grid
cell — label on top, value or control below, description under it only if it adds something
(rule 9). Name and number of a summary stay together on the left
(`flex flex-wrap items-baseline gap-x-2`), not `justify-between`.

## Items that expand to show detail

Collapsed = one grid cell · expanded = `col-span-full`, its own full row. One expanded at a time.

## Checklists

View mode shows only what is held, as text cells — not the whole list disabled.
Edit mode: a checklist with the name left and the mark right is capped at `max-w-2xl` — the one
`max-w-*` inside a page that rule 1 allows, because a mark 1000px from its name breaks rule 2 worse
than blank space does.
