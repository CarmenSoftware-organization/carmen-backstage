# Edit pages (form / settings / detail)

Structure (which cards, which state, which mode) comes from `src/pages/CLAUDE.md` and
`agent-os/standards/pages/edit-page-modes.md`. This file only covers how that structure uses width.

```tsx
<Layout>
  <div className="space-y-4 sm:space-y-6 pb-24">      {/* no max-w — rule 1 · pb-24 clears the unsaved bar */}
    <PageHeader backTo="/items" title={…} afterTitle={<Badge …/>} actions={/* Edit toggle */} />
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">   {/* paired cards, same height */}
      <Card>…</Card>
      <Card>…</Card>
    </div>
    <Card>{/* wide section */}</Card>
  </div>
  {editing && (   /* Toggle mode: shown while editing, not only when dirty — see RoleEdit.tsx */
    <div className="unsaved-bar fixed bottom-0 left-0 right-0 md:left-16 lg:left-60 z-40">
      {/* left: unsaved-changes dot + text · right: Cancel · Save */}
    </div>
  )}
</Layout>
```

## Standard values

| Item | Value |
|---|---|
| Page wrapper | `space-y-4 sm:space-y-6` |
| Card content | `space-y-4` |
| Field | `space-y-2` (label, control, error) |
| Button gaps | `gap-3` |
| Fields inside a card | `grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3` under an `@container` card body — **new code**; existing pages use `sm:grid-cols-2` / `lg:grid-cols-2` |
| Field that needs width (textarea, long name) | `@md:col-span-2` — not `col-span-full` |
| Paired cards | `grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2` (viewport — known deviation, rule 3). No `items-start` |
| Form + side rail in edit mode | `lg:grid-cols-[1fr_minmax(300px,340px)]` (`RoleEdit`) |
| Error under a field | `text-xs text-destructive`, input gets `border-destructive` |

## Pairing

Pair cards when the two are close in height and belong together. Do not pair a 3-field card with a
13-field card — the short one gets a tall empty bottom (they are the same height by rule 4).

## Gotchas

- **Two adjacent fields that each span 2 columns land on separate rows in a 3-column grid** — keep to
  one wide field per card.
- **A long card description goes inside the card**, not beside the title — on paired cards it wraps
  and the two titles stop lining up.
- **Splitting a page into tabs makes tests vacuous** — a test that still passes after a tab split is
  the one to suspect (it may query a panel that is no longer mounted).
- **View mode boxes** — `ReadOnlyField` still draws the old bordered box. Rule 7 wins (user
  decision 2026-11-23): replace it on the page you are changing, using the unboxed snippet in
  `src/pages/CLAUDE.md` §Form Field Pattern; leave other pages alone.

## Save

- **Versioned entities (`doc_version`)** — after Save, set the new `doc_version` from the response
  (or refetch) **before** the user can save again; a second Save with the old version gets 409
  (`src/utils/docVersion.ts`, reference `ClusterEdit.tsx`).
- **A PATCH response may not carry every field** — merging it whole over `formData` silently blanks
  fields. Merge only what the response actually contains.

How to try it → `verify.md` §Check real clicks
