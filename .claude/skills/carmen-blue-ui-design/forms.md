# Forms (form / settings / detail)

```tsx
<FormPageShell width="wide" header={<FormToolbar … />}>
  <form>
    <CompactSection first title={…} description={…}>
      <FieldGrid>{/* fields */}</FieldGrid>
    </CompactSection>
    <div className={SECTION_PAIR}>
      <CompactSection title={…}>…</CompactSection>
      <CompactSection title={…} action={<Button size="sm" … />}>…</CompactSection>
    </div>
  </form>
</FormPageShell>
```

## Standard values (rule 5 measures against these)

| Item | Value |
|---|---|
| Field grid (`FieldGrid`) | `grid gap-x-5 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6` under an `@container` wrapper |
| Field that needs width (textarea, long name) | `@md:col-span-2` — not `col-span-full` and not `sm:col-span-2` |
| Paired sections (`SECTION_PAIR`) | `min-[1700px]:grid min-[1700px]:grid-cols-2 min-[1700px]:gap-x-5` — no `items-start`; paired cards are the same height. **Viewport breakpoint — known deviation from rule 3**, do not copy it elsewhere |
| Space between sections | `mt-5`, no divider line |
| Section heading | `text-sm font-semibold` + description `text-xs text-muted-foreground` on the same line, above the card; action right-aligned |
| Card | `bg-card rounded-xl border p-4 shadow-sm` |
| Label in view mode | `text-muted-foreground text-xs` followed by the value `text-sm`, `mt-0.5` apart |
| Label in edit mode | `text-foreground text-xs font-semibold` |
| Empty value in view mode | `—` in `text-muted-foreground/60` |

## Resulting column counts

`FieldGrid` breakpoints (box width): `@md` 448 · `@3xl` 768 · `@5xl` 1024 · `@min-[96rem]` 1536.

| Screen size | Sections | `FieldGrid` (sidebar expanded) | `FieldGrid` (sidebar collapsed) | `FieldGrid size="item"` |
|---|---|---|---|---|
| Mobile (390) | stacked | 1 | 1 | 1 |
| Tablet (768) | stacked | 2 | 2 | 2 |
| 1366 | stacked | 3 ⚠ | measure | 2 |
| Full HD (1920) | paired | full card 6 · paired card 3 | measure | 4 |
| 4K (3840) | paired | 6 | 6 | 6 |

⚠ At 1366 the card's inner box sits close to the `@5xl` (1024px) step, so a small change to the
sidebar or gutter flips it to 4 columns. After any shell change, re-measure with the `fieldgrid`
probe in `verify.md` and fill in the "measure" cells with what you saw.

Pair sections when the two are close in height and belong together (Hotel | Company). Do not pair a
3-item section with a 13-item section.

## Gotchas

- **A long section description goes inside the card, not on the heading line** — on paired sections
  it wraps and the two headings stop lining up (interface brand forms).

## Save

- **A page that returns to view mode after Save must wait for the new data first** — a mutation that
  only calls `invalidateQueries` and finishes leaves view mode showing the old value for 1–3
  seconds, and a second Save in that window sends the old `doc_version` and hits a 409. Have the
  hook's `onSuccess` **return the `invalidateQueries` promise** (the mutation stays pending until
  the refetch completes). Example: `useUpdateBusinessUnit` in `hooks/use-business-unit.ts`
- **A form that binds `values` to a query** needs `resetOptions: { keepDirtyValues: true }`, and the
  mutation must `setQueryData` before invalidating; otherwise editing a value a few seconds after
  Save leaves the Save button stuck disabled. Example: `useUpdateProfile` in `hooks/use-profile.ts`

How to try it → `verify.md` §Check real clicks
