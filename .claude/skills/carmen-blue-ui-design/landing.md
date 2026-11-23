# Landing pages

A landing page must **show only real things**:

1. **No hard-coded numbers or data** — card statistics ("14 roles · 87 permissions"), version
   numbers and tool counts all read as real data. A number is allowed only when it comes from the
   API (done right: the workflow count in `routes/system-admin/workflow/wf-landing.tsx`).
2. **Every page in the module's left menu has a card** — compare against `constant/module-list.ts`
   every time.
3. **A card's description is that page's own header description** (`systemAdmin.<page>.desc`) and
   its title is the left-menu name — no separate marketing copy.
4. **Card permissions come from `useVisibleModules`, the same source as the left menu** — hidden =
   no card · locked / no permission = a faded card that is a button calling
   `dispatchPermissionDenied` (locked wins over denied). A group whose cards are all gone disappears
   entirely, and group numbers count only what is shown.
5. **The whole card is clickable** — no card footer holding only an Open button.
6. **No button that does nothing when pressed, and no text promising things that do not exist**
   (handbook, sandbox).
7. **Illustrations use lines instead of text** — no made-up names, document numbers, times or
   percentages. Labels inside an illustration must match the real page, and the illustration must
   depict the same subject as the page (Running Code = a document-number pattern, not a terminal).
   Helpers: `Line`, `ListViz` in `routes/system-admin/landing-visuals.tsx`.
8. **Compact page header** — page name + tagline. No half-screen hero, no table of contents
   repeating the headings below.

## Layout when groups differ in height

(System Admin: 6 chapters with 2–5 cards each.) An `auto-fit` grid leaves blank space under the
short groups, and the last row leaves empty cells when the group count does not divide evenly by the
columns. Use CSS multi-column instead — groups flow down one column at a time, in order.

```tsx
// 20rem = minimum column width · the number after it = the column-count ceiling (= group count)
// without the ceiling a 4K screen gets 10 columns, half the screen empty
<div className="gap-x-5" style={{ columns: `20rem ${CHAPTERS.length}` }}>
  <section className="@container mb-5 break-inside-avoid">
    {/* group heading */}
    <div className="grid gap-3 @xl:grid-cols-2">{/* cards */}</div>
  </section>
</div>
```

- `break-inside-avoid` goes on the group, not the card — a group must not be split across columns
  (the third card showing up in the next column with no heading).
- Columns can therefore differ in height (groups cannot be split) — acceptable, because groups have
  no frame; they are not the paired cards of rule 4.
- Expected: card width around 280–400px at every screen size (System Admin: 1 / 2 / 3 / 4 / 6
  columns at 390 / 768 / 1366 / 1920 / 3840).

How to check → `verify.md` §Landing pages (the `landing` probe measures columns and card width)
