# Lists

## Settings list "label left, value right, full row width"

Breaks rule 2 on a wide screen. Make each item a `FieldGrid` cell: code/label on top, value or
control below, description (if it adds something) under the control — like `ConfigField` on the
default-setting page.

**Items with several parts** (icon, name, label, status, sample text) use `FieldGrid size="item"`.
Clamp sample text with `line-clamp-2`.

## Items that expand to show detail (Ask AI providers)

Collapsed = one grid cell · expanded = `col-span-full`, taking its own full row. One expanded at a
time. Two blocks that need to be compared sit side by side with `@3xl:grid-cols-2` under their own
`@container`.

```tsx
<Collapsible open={open} onOpenChange={onOpenChange}
  className={cn("min-w-0", open && "col-span-full")}>
```

## Summary table "name left · number right" inside a card

(Attachments by type on the Storage page.) It is the same label-left-value-right list. Turn it into
`FieldGrid` cells — label on top, main value below (`text-sm font-medium`), secondary value appended
as `text-xs text-muted-foreground`. Keep the original sort order.

## A few things with progress bars

(Database / attachment on the Storage page.) Place them side by side with
`grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]`. Name and number stay together on the
left (`flex flex-wrap items-baseline gap-x-2`), not `justify-between`.

## List page split into groups, each with a few rows (Interfaces page)

Do not stretch rows across the screen. Let the groups flow as columns with `auto-fit`, not a fixed
column count — the number of groups depends on data (the BU's licences). A 4-column grid with 3
groups leaves an empty column on the right; `auto-fit` collapses the empty column and lets the
existing groups fill the width.

```tsx
// minimum = the width at which a row inside still shows everything · min(100%, …) prevents
// overflow on screens narrower than the minimum
<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,46rem),1fr))] items-start gap-5">
  <section>…<ul className="@container …">{/* rows use @xl: by card width */}</ul></section>
</div>
```

Rows inside a group's card must change `sm:` to `@xl:` (and put `@container` on the card), because a
narrow card can occur on a wide screen once it splits into several columns. Measure the right edge
of the last item against the right edge of the box, at every screen size (the `overflow` probe in
`verify.md` catches it).

## Lists you can add to / remove from (addresses, contacts)

A grid of cards, not full-width rows — `grid-cols-[repeat(auto-fill,minmax(min(100%,<min>),1fr))]`
(`auto-fill`, not `auto-fit`: a single card must not stretch across the row). The edit-mode minimum
is wider than view mode's, and inside the card use container queries (`@container` + `@sm:`). Write
view mode as a separate component that shows text, not the same form with every field disabled.
Wrap the grid in `CompactSection frameless`. Example: `routes/vendor-management/vendor/`

## Checklists

**View mode of a checklist is not the same list disabled** — show only what is held, as `FieldGrid`
cells (name + description), from the data that comes with the document itself; do not fetch the
whole registry.

Edit mode shows the checklist. When its rows have the name on the left and the mark on the right,
cap its width at `max-w-2xl` — **this is the one allowed exception to rule 1**, because a mark
3000px away from its name breaks rule 2 worse than the blank space does. Example:
`routes/system-admin/user/user-assigned-roles.tsx`
