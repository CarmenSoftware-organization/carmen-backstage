---
name: carmen-blue-backstage-ui-design
description: 'Use when laying out or adjusting a carmen-backstage screen (Edit page / Management list / Config cards / Dashboard / shell bars) so it fills the screen width, stays compact, and is correct at all 5 screen sizes (mobile, tablet, 1366, Full HD, 4K) — or when the user says a page is "empty", "stretched", "not compact", "has blank space left and right", "text overlaps", "overflows" (Thai: "โล่ง" "ยืด" "ไม่ compact" "มีที่ว่างซ้ายขวา" "ข้อความทับกัน" "ล้น")'
---

# CARMEN BLUE Backstage — screen layout

Rules the user set themselves. They cover **use of space** only — colour, type and primitives
belong to `src/index.css` + `tailwind.config.js` (source of truth) and
`DESIGN.md` (reference). Page structure (which sections an Edit or
Management page must have) belongs to `src/pages/CLAUDE.md` and `agent-os/standards/pages/` —
this skill only decides how that structure uses the width.

> This skill started as a copy of `carmen-frontend`'s. Everything below is written against
> **this** repo's code. If you find a reference to `CompactSection`, `FieldGrid`, `FormPageShell`,
> `DataGrid`, `routes/…` or `docs/DESIGN.md`, it is a leftover — those do not exist here.

## Start from the kind of page

Open only the recipe file for your kind of page before editing. Gotchas that apply to every page
are at the bottom of this file.

| Page | Recipe |
|---|---|
| Edit page (`<Entity>Edit.tsx`, Card sections) | `forms.md` |
| Config page (one card per item, no table) · grouped / expandable lists | `lists.md` |
| Management list (`DataTable`) · plain `<table>` | `tables.md` |
| Feed / dashboard (`Dashboard.tsx`) | `lists.md` §Feeds |
| Shell bars (Layout header + footer) · `PageHeader` actions · `.unsaved-bar` · search row | `bars.md` |

There are **no module landing pages** in backstage. `Landing.tsx` and `Login.tsx` are a
marketing hero and an auth card — out of scope for these rules (root `CLAUDE.md`).

When done, check against `verify.md` every time — rules 1–3 and 10 can be broken without any error.

## Rules

1. **Full width of the shell at every size** — no `max-w-*` around page content, no empty column at
   the side. The only acceptable blank space is the shell gutter and internal gaps. Page width comes
   **only** from `Layout`'s `<main className="w-full px-4 sm:px-6">`.
   *User decision 2026-11-23:* the shell's old `container` cap (1400px) is removed — every page is
   as wide as the space beside the sidebar. A page that looks stretched fixes its **rows** (more
   columns, a capped row — rule 2); it never gets a page-level `max-w` back.
   Surveyed all 33 nav pages at 1920 when the cap came off: three put a value ~1300px from its
   label and were fixed the same day by flowing their cards/rows as columns (`lists.md`):
   `/backstage/features`, `/backstage/migrations`, `/license-features`.
   *Known deviations (pages):* `ClusterEdit` and `UserEdit` cap the **new** form at
   `mx-auto max-w-5xl`; `clusterAdmin/BusinessUnitForm` caps its save bar the same way;
   `Changelog` is `max-w-3xl` (a reading page). Leave them unless asked.
   *Allowed:* `max-w-*` on a dialog/sheet (`DialogContent sm:max-w-*`), on a single text element
   (a paragraph, a truncated cell), and on a checklist (`lists.md` §Checklists).
2. **A wider screen means more columns, not wider fields** — a value must stay next to its label.
3. **Decide from the box's own width, not the screen's** — container queries (`@container` +
   `@md:` / `@2xl:` …, built into Tailwind 4, no plugin), not breakpoints (`md:`). The box is the
   screen minus the sidebar (`md:ml-16` collapsed · `md:ml-60` expanded, remembered in
   `localStorage["sidebar-collapsed"]`), so always check both sidebar states.
   *Known deviations:* `DataTable`'s `mobileBreakpoint` is a media query (default
   `(min-width: 1024px)`); Edit pages' `lg:grid-cols-2` is a viewport breakpoint. Do not copy
   either into new code. Most of `src/pages` still uses viewport breakpoints — *user decision
   2026-11-23:* move a piece to a container query when you touch it and it misbehaves, not as a
   sweep.
4. **Sections that form a pair sit side by side on wide screens; below that they stack.** Cards in
   the same row must be the **same height** — no `items-start` on a grid of cards (see `forms.md`).
5. **Compact** — spacing must not take more room than the content. Standard values are in
   root `CLAUDE.md` §Styling Reference and `forms.md`; do not go larger without a reason.
6. **No cross-section side navigation** on new pages. *Confirmed exception (user decision
   2026-11-23):* `ClusterEdit`'s scrollspy (`clusterEdit/useScrollSpy.ts`) stays — do not remove
   it, and do not copy it to another page.
7. **View mode does not box its values** — muted label + strong value. Borders are only for fields
   that can actually be edited. *User decision 2026-11-23:* this rule wins over the old bordered
   `ReadOnlyField` / `ReadOnlyText` box; `src/pages/CLAUDE.md` §Form Field Pattern now shows the
   unboxed form. Convert a page's view mode when you change that page anyway — no sweep.
8. **Pattern settings show the result first** — `2026-11-12` is the main value, `yyyy-MM-dd` the
   secondary line (live preview: BU Edit `sections/NumberFormatsSection.tsx` + `numberFormatPreview.ts`).
9. **Help text under a field only when it adds something** — text that merely repeats the label is
   removed.
10. **Text must never overflow or overlap at any screen size** — when there is no room, hide the
    less important thing; do not let things overlap or truncate down to a few characters.
11. **Readable in both light and dark** — colour tokens only (`bg-card`, `text-muted-foreground`,
    `--success` / `--warning` / `--info` …), no raw colours (root `CLAUDE.md` rules 5 and §Styling).
12. **Filter / view buttons sit next to the search box** — not pushed to the far right of the row.
    The right side of the bar may hold only table buttons (column picker, export).
13. **Header buttons stay on one line at every screen size** — in a narrow header, secondary
    buttons become icon-only and the primary keeps its label; never collapse them into a ⋯ menu.
    In backstage the header is `PageHeader actions`, and Save/Cancel live in the `.unsaved-bar`,
    **not** the header (root `CLAUDE.md` §Page furniture). See `bars.md`.

## What already exists — use it, do not write a second set

| Need | Use | Notes |
|---|---|---|
| Page title row | `components/PageHeader.tsx` | `title`, `subtitle`, `actions`, `backTo`, `afterTitle`. Stacks below `sm`, row from `sm`; actions `flex-wrap` |
| Way back when the page draws its own hero | `components/BackLink.tsx` | never both with `PageHeader backTo` |
| Section tabs | `components/TabStrip.tsx` | `count`, `hasError` per tab |
| Card | `components/ui/card.tsx` | flat `bg-card` + 1px border |
| Table | `components/ui/data-table.tsx` | `tableLayout`, `mobileCards` + `meta.card` (`title` / `badge` / `hidden` / `actions`), `stickyLeftColumns`, `stickyRightColumn`, `serverSide` |
| Search box | `components/SearchInput.tsx` | do not hand-roll a search input |
| Empty / error | `EmptyState`, `ListEmptyState`, `FetchErrorState` | |
| Loading | `TableSkeleton`, `ui/skeleton` | skeleton = same structure as the real page |
| Live media query (last resort) | `hooks/useMediaQuery.ts` | prefer `@container`; there is no `useElementWidth` hook — `DataTable` uses its own `ResizeObserver` |

Pages to open as examples:

| Kind | Example |
|---|---|
| container query deciding a row's layout | `pages/dashboard/ActivityStream.tsx` (`Timeline`: `@container` + `@2xl:`) |
| full-width two-column page with a fixed rail | `pages/Dashboard.tsx` (`lg:grid-cols-[minmax(0,1fr)_236px]`) |
| Edit page, Toggle mode | `pages/RoleEdit.tsx` |
| Edit page, Edit-in-place + scrollspy | `pages/ClusterEdit.tsx` |
| Edit page split into tabs + section components | `pages/BusinessUnitEdit.tsx` + `pages/businessUnitEdit/` |
| Edit page with sticky right column | `pages/ReportTemplateEdit.tsx` |
| Management list | `pages/ClusterManagement.tsx` |
| Config page (cards) | `pages/ReportFormGroupManagement.tsx`, `pages/EmailSettingManagement.tsx` |

## Gotchas that apply to every page

- **`@md:` does nothing without an ancestor that is a `@container`** — no error; the columns simply
  never split. Put `@container` on the box whose width should decide (Dashboard puts it on the
  timeline, not the page).
- **Tailwind 4 container sizes:** `@sm` 384 · `@md` 448 · `@lg` 512 · `@xl` 576 · `@2xl` 672 ·
  `@3xl` 768 · `@4xl` 896 · `@5xl` 1024 · `@6xl` 1152 · `@7xl` 1280 (px of the container box).
- **A viewport breakpoint lies at 768** — the sidebar takes 240px, so `md:` turns on when the content
  box is only ~520px. The Dashboard feed lost its entity names to "TES…" (47px) this way
  (2026-11-23) until the meta column moved from `md:flex` to `@2xl:flex`.
- **A section heading or toolbar with its action at the right edge is not a rule-2 break** — the
  `justify-between` probe flags `EmailSettingManagement` `SectionHeading` (+ Add) and the
  Dashboard Templates filter bar (+ Add Widget); leave them.
- **Measure the container, not the card** — `@container` on `CardContent` is the card minus its
  padding (a 534px shelf card gave a 492px container), so `@lg` (512) silently never fired.
- **Removing a page cap opens a gap inside rows** — a row with name left and meta right stretched to
  1100px puts them 700px apart (rule 2). Cap the *row* (name + meta + trailing control), not the
  page. Capping only the name column is not enough: the row stays full width, so an `ml-auto`
  chevron and the hover band end up ~600px from the content (Dashboard run rows, 2026-11-24).
- **A skeleton must have the same structure as the real page**, otherwise the content jumps when
  data arrives.
- **Passing every screen size does not mean the form works** — press Save for real, then edit again
  within 3 seconds (`doc_version` → 409). See `forms.md` §Save and `verify.md` §Check real clicks.
- **Changed a shared piece** (`PageHeader`, `DataTable`, `Layout`, `TabStrip`…) → `trail callers
  <name>` and open every page that uses it, not just the page you are working on.
- **Pages with an older learning that fixes their layout** — `trail check` goes red when the layout
  changes. Save a new learning with `--replaces` and write the reason in the PR.
