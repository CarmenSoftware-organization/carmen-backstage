---
name: Carmen Blue Backstage
description: The back-office control plane for Carmen's multi-tenant inventory fleet — a calm, warm-neutral ledger with one blue accent.
colors:
  ledger-paper: "hsl(40 9% 97.5%)"
  ink: "hsl(30 7% 12%)"
  sheet-white: "hsl(0 0% 100%)"
  signal-blue: "hsl(221 61% 48%)"
  on-signal: "hsl(0 0% 100%)"
  pencil-grey-fill: "hsl(40 8% 94%)"
  pencil-grey-ink: "hsl(30 10% 20%)"
  muted-paper: "hsl(40 8% 95.5%)"
  margin-note: "hsl(33 5% 43%)"
  rule-line: "hsl(40 8% 90%)"
  field-edge: "hsl(40 8% 87%)"
  fault-red: "hsl(0 72% 51%)"
  settled-green: "hsl(152 40% 36%)"
  caution-amber: "hsl(32 90% 44%)"
  chart-amber: "hsl(32 85% 45%)"
typography:
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.75rem
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"rlig\" 1, \"calt\" 1"
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1rem
  meta:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.25
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.on-signal}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.pencil-grey-fill}"
    textColor: "{colors.pencil-grey-ink}"
  button-secondary:
    backgroundColor: "{colors.pencil-grey-fill}"
    textColor: "{colors.pencil-grey-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.fault-red}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-sm:
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge-success:
    backgroundColor: "{colors.settled-green}"
    textColor: "{colors.on-signal}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  badge-warning:
    backgroundColor: "{colors.caution-amber}"
    textColor: "{colors.on-signal}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  badge-secondary:
    backgroundColor: "{colors.pencil-grey-fill}"
    textColor: "{colors.pencil-grey-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  table-header:
    backgroundColor: "{colors.muted-paper}"
    textColor: "{colors.margin-note}"
    typography: "{typography.label}"
  nav-item-active:
    textColor: "{colors.signal-blue}"
    rounded: "{rounded.md}"
---

# Design System: Carmen Blue Backstage

## Overview

**Creative North Star: "The Control Room Ledger"**

Backstage is the book an operator keeps while running a fleet of hotel tenants. The ground is warm paper rather than clinical white. Text is near-black ink. Ruled lines separate entries, and figures sit in aligned columns. The room is quiet by default: no gradients, no glass panels, no decorative colour. When colour does appear it is reporting something true. Blue means "you can act here" or "you are here". Green, amber and red mean a state the operator has to know about. Because the rest of the page stays neutral, those states are the loudest thing on screen whenever they exist.

Density is that of a working register, not a marketing page. Body text is 14px, meta is 11–12px, and page titles stop at 20px. A screen should hold a whole cluster's state without scrolling past decoration. The design never smooths over partial truth: a BU that failed is drawn as failed beside the ones that succeeded, and a count that couldn't load reads "unknown", never zero. Every surface must hold up equally in light and dark, in Thai and English, and from a 3840px monitor down to a 390px phone.

The look replaced an earlier glassmorphism skin (frosted `.glass` panels), and that look is now an anti-reference. One element keeps glass on purpose: the floating unsaved-changes bar (see Elevation).

**Key Characteristics:**
- Warm-neutral paper ground; one blue accent (`signal-blue`); status hues used only for status.
- Flat surfaces separated by 1px rule lines; shadows are barely there.
- Compact, information-dense type in a single family (Inter) plus a system mono.
- Gently curved corners (4–8px). Nothing is pill-shaped except avatars, counters and the floating save bar.
- Full parity across both themes: every token has a tuned dark value. Dark is a second set of ink, not an inversion.

## Colors

A warm off-white and warm near-black ledger with one trustworthy blue. Status colours are reserved for status.

Values are HSL channels in `src/index.css` (`:root` and `.dark`) and are consumed as `hsl(var(--token))` through `tailwind.config.js`. Those two files are the source of truth. The frontmatter records the light theme; dark values are listed below and in `.impeccable/design.json`.

### Primary
- **Signal Blue** (`--primary`, `--ring`, `--info`; dark `217 70% 60%`): primary buttons, links on identity columns, the active nav item (10% tint plus a 4px bar on the left edge), the active tab underline, focus outlines and informational badges. It is dark enough in light theme that white text clears AA (about 5.3:1). Check that again before you adjust its lightness.

### Neutral
- **Ledger Paper** (`--background`; dark `30 6% 9%`): the app canvas, sidebar and outline-button fill.
- **Sheet White** (`--card`, `--popover`; dark `30 6% 12%`): cards, dialogs, sheets and dropdowns sit one step lighter than the canvas.
- **Ink** (`--foreground`; dark `40 8% 90%`): all primary text.
- **Pencil Grey** (`--secondary`, `--accent` fill / ink; dark `30 5% 17–18%` / `40 8% 95%`): secondary buttons, hover fills and neutral badges. `--accent` is a **neutral** surface, not a brand hue.
- **Muted Paper** (`--muted`; dark `30 5% 16%`): table header band and quiet fills.
- **Margin Note** (`--muted-foreground`; dark `35 6% 62%`): subtitles, meta, placeholders and table header text. Measures about 4.9:1 on the light ground.
- **Rule Line** (`--border`; dark `30 5% 20%`): every 1px divider and surface edge. It is applied globally via `* { border-color }`.
- **Field Edge** (`--input`; dark `30 5% 22%`): form control borders, one step darker than the rule line.

### Status
- **Settled Green** (`--success`; dark `152 45% 45%`): active, healthy, applied.
- **Caution Amber** (`--warning`; dark `38 92% 55%` with dark ink `20 14% 8%` on it): at risk, expiring, partial.
- **Fault Red** (`--destructive`; dark `0 62% 45%`): delete, failure, validation error.
- **Chart Amber** (`--chart-2`; dark `36 88% 58%`): the second series in charts. `--chart-1` is Signal Blue.

### Special-purpose
- **Zebra** (`--zebra-even`, `--zebra-hover`, `--zebra-hover-accent`): a 2% warm stripe on even rows, a 4.5% blue wash on hover, and a 3px blue bar inset on the left edge of the hovered row.
- **Code ink** (`--code-keyword|string|literal|comment`): CodeMirror syntax colours, consumed only by `src/lib/codemirrorTheme.ts`. Each is held at ≥4.5:1 as *text* on the ground. That is why they cannot reuse the status tokens: `--warning` as text measures 3.08:1.
- **BU chip** (`--bu-chip-s`, `--bu-chip-l`): each BU gets a colour whose hue comes from its code; saturation and lightness are tuned per theme.

### Named Rules
**The Status-Only Hue Rule.** Green, amber and red appear only when they report a real state, and only through `<Badge variant="success|warning|destructive">` or the status tokens. Never use raw Tailwind greens or ambers, and never use them for decoration.

**The Never-Colour-Alone Rule.** A state carried by colour must also be carried by text or an icon. Partial failure, per-BU errors and licence state all have to be readable in greyscale.

**The Token-Only Rule.** No hex, no `bg-blue-500`, no per-component dark overrides. Semantic classes flip with `.dark` automatically. Where a class won't fit, write `hsl(var(--token))`.

## Typography

**Body Font:** Inter (400/500/600/700, Google Fonts), with `system-ui, -apple-system, sans-serif` as fallback
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

**Character:** A single neutral grotesk set small and tight, so it reads like a register. Hierarchy comes from weight (600 against 400) and the Margin Note grey, not from size jumps.

### Hierarchy
- **Title** (600, 20px, tracking −0.025em): the single page `<h1>`, rendered by `PageHeader` or by an identity hero at the same scale. An edit-mode input that replaces the title keeps this scale.
- **Section** (600, 16px, leading tight): `CardTitle` and section headings inside a page.
- **Body** (400, 14px, line-height 1.5): all running text, table cells and inputs.
- **Label** (500, 12px): badges, small buttons and table header text.
- **Meta** (400, 11–12px, Margin Note): timestamps, authors and audit lines under identity cells.
- **Mono** (10–12px): codes, IDs, SQL and XML.

### Named Rules
**The One-Title Rule.** One `<h1>` per page, always at 20px semibold. The brand name in the shell is a `<span>`. A status badge beside the title goes in `afterTitle`, outside the heading. `Login` and `Landing` are the only pages with their own scale.

**The Aligned-Figures Rule.** Any column or counter that compares numbers uses `tabular-nums`.

## Layout

- **Shell:** a fixed sidebar on Ledger Paper with a 1px right rule. It is 240px expanded and 64px collapsed, and animates width over 300ms `cubic-bezier(0.4, 0, 0.2, 1)`. Below `md` (768px) it becomes a Sheet drawer. The main area fills **the full width beside the sidebar**. There is no page-level `max-w` cap; the old 1400px `container` cap was removed. Pages that need a readable measure cap a column, not the page.
- **Breakpoints:** `sm` 640 (title row goes horizontal) · `md` 768 (sidebar appears) · `lg` 1024 (two-column form grids). Layout must also hold at 390px and at 3840px.
- **Rhythm (4px grid):** page stack 16→24px (`space-y-4 sm:space-y-6`) · card internal gap 16px · label→field 8px · button/inline gap 12px · card padding 20px.
- **Page furniture:** `PageHeader` (back arrow, title, subtitle, actions) or a hero with `BackLink`, never both. Section nav uses the underlined `TabStrip`. Save and Cancel live in the floating `.unsaved-bar`, not in the header.
- **Tables:** identity columns can freeze on the left (`.table-sticky-left[-3|-4]`) and the actions column on the right (`.table-sticky-right`). Frozen cells repaint the zebra and hover ground so rows never show through. Below `lg`, `DataTable` turns each row into a card.

## Elevation & Depth

Depth comes from tone and rule lines, not shadow. The canvas is Ledger Paper, a card is one step lighter (Sheet White) with a 1px Rule Line, and popovers share the card tone. Shadows exist only as a hairline of lift.

### Shadow Vocabulary
- **xs** (`0 1px 2px rgba(24,20,16,0.04)`; dark `rgba(0,0,0,0.3)`): resting cards and inputs.
- **sm** (`0 1px 2px rgba(24,20,16,0.05)`; dark `rgba(0,0,0,0.35)`): slightly raised controls.
- **md** (`0 4px 12px rgba(24,20,16,0.06)`; dark `rgba(0,0,0,0.45)`): floating menus.

### Named Rules
**The Flat-Ledger Rule.** Surfaces are opaque and flat. Sticky bars, headers and table chrome are solid; there is no `backdrop-blur` outside `src/components/ui`.

**The One Glass Pane Rule.** The floating unsaved-changes bar (`.unsaved-bar`) is the single deliberate exception. It is frosted glass (`blur(30px) saturate(200%)`, a 45% ground with an inner highlight) so it reads as a layer floating above the ledger. On desktop it is a centred 16px-radius slab 20px above the bottom of the viewport; on mobile it is a full-width bar. Without `backdrop-filter` support it falls back to opaque. Do not copy this treatment to any other element.

## Shapes

Gently curved, never soft. The base radius is 8px (`--radius`): **8px** for cards, panels, sheets and tables · **6px** for buttons, inputs, selects and badges · **4px** for small chips · **full** for avatars, nav counters and status dots. The only larger radius is the 16px of the glass save bar. Edges are always 1px; the table header carries a 2px bottom rule to separate it from the body.

## Components

### Buttons
Quiet and exact.
- **Shape:** 6px radius; 36px tall (32px `sm`, 40px `lg`, 36×36 `icon`); 14px medium text (12px for `sm`).
- **Primary:** Signal Blue fill, white text; hover drops to 90% opacity.
- **Outline:** Ledger Paper fill, Field Edge border, Pencil Grey on hover. Use it for secondary page actions such as Export.
- **Secondary / Ghost:** Pencil Grey fill, or none until hover. Ghost is used for toolbar and icon buttons.
- **Destructive:** Fault Red. It always goes through `ConfirmDialog`.
- **Focus:** a 2px Signal Blue outline offset by 2px (global `:focus-visible`), plus a 1px ring on the primitives. Disabled is 50% opacity.
- **Icons:** 16px with an 8px gap inside labelled buttons; 20px in icon-only buttons, which need an `aria-label`.

### Status Badges
- **Style:** 6px radius, padding 2px 10px, 12px medium text, a solid status fill with white text. In dark theme, warning uses dark ink.
- **Variants:** `success` · `warning` · `destructive` · `info` · `secondary` (neutral or deleted) · `outline` (counts, such as the `TabStrip` count). These are the only sanctioned status markers.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Sheet White on the Ledger Paper canvas.
- **Shadow Strategy:** xs only (see Elevation).
- **Border:** 1px Rule Line.
- **Internal Padding:** 20px, with 16px between children; the title is 16px semibold and the description 14px Margin Note.

### Inputs / Fields
- **Style:** 36px tall, transparent ground, 1px Field Edge, 6px radius, xs shadow, 14px text, Margin Note placeholder.
- **Focus:** the Signal Blue outline and ring.
- **Error:** `border-destructive` plus a 12px Fault Red message under the field, validated on blur.
- **View mode:** a muted label above a strong Ink value, **unboxed**, with no border or fill. The old bordered `ReadOnlyField` box (Muted Paper at 50%, Field Edge border) is legacy. Replace it on a page only when that page is being changed anyway.
- **Native date inputs:** the date inputs replace the browser's own calendar glyph with a masked lucide `calendar` in a token colour.

### Tables
- **Header:** a Muted Paper band with a 2px bottom rule and 12px Margin Note labels.
- **Rows:** 14px body text, a 2% zebra stripe, a blue-wash hover with a 3px inset left bar. Identity cells are Signal Blue links that underline on hover, with meta in 11px Margin Note underneath.
- `DataTable` adds the `#` index column itself, so never add one. Below `lg` it renders one card per row.

### Navigation
- **Sidebar item:** 14px in Margin Note; hover gets a Pencil Grey fill and Ink text. The active item gets a 10% Signal Blue fill, Signal Blue text and a 4px Signal Blue bar on the left edge. Collapsed items show the icon only, with a tooltip on the right. Counters are Signal Blue circles with 10px semibold white numerals.
- **TabStrip:** underlined tabs. The active tab has a 2px Signal Blue bottom border and Ink text; inactive tabs are Margin Note. A count is an outline badge, and an error is a 6px Fault Red dot. It scrolls horizontally on narrow screens.

### Unsaved-changes bar (signature)
This is the one floating glass slab described under Elevation. It holds Save and Cancel for every Edit page and appears only when the form is dirty.

## Do's and Don'ts

### Do:
- **Do** reach for a semantic token (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`) and let `.dark` flip it.
- **Do** show status as `<Badge variant>` with a text label. Pair colour with text or an icon every time.
- **Do** render partial failure and unknown counts as their own visible state ("couldn't check", per-BU error rows). Never show a green summary over them.
- **Do** keep page titles at `text-xl font-semibold tracking-tight` through `PageHeader` or a hero at the same scale.
- **Do** separate surfaces with a 1px Rule Line and one tone step: Ledger Paper → Sheet White.
- **Do** check every new surface in light and dark, in Thai (longer labels) and English, and at 390px and 3840px.
- **Do** keep text contrast at least 4.5:1 and targets at least 24×24px (WCAG 2.2 AA, per PRODUCT.md).

### Don't:
- **Don't** bring back glassmorphism (`.glass`, `backdrop-blur`) on cards, headers or sticky bars. The unsaved-changes bar is the only glass.
- **Don't** use raw Tailwind palettes (`bg-blue-500`, `text-green-600`) or hex in components.
- **Don't** use Signal Blue as decoration, and don't introduce a second brand hue, purple, or a gradient hero.
- **Don't** hand-roll an `<h1>`, nest a badge inside the heading, or put Save/Cancel in the header actions.
- **Don't** cap the page at a max width. Cap the column that needs a measure. If a page looks stretched, fix its rows: add columns or cap the name column.
- **Don't** box read-only values in a bordered field in view mode.
- **Don't** use `--warning` or `--success` as text colours on the ground; they are chip fills (3.08:1 as text).
- **Don't** modify `src/components/ui/` primitives to restyle a single page.
