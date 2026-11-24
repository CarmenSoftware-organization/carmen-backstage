# Capacity meter: put the "near" tag on the type ramp and give the "over" level its own word

Written against: `bf6273d6` (main)

Status: proposed

## Evidence chain

- Surface: the `/clusters` list (`src/pages/ClusterManagement.tsx`), columns **Business units** (`id: 'bu_count'`) and **Users** (`id: 'user_count'`). Both cells render `<CapacityMeter … finite />`.
- Problem:
  1. The `warn` tag ("near" / "ใกล้เต็ม", shown at ≥90% of cap) is set at `text-[9px] font-bold` (`src/pages/clusterManagement/CapacityMeter.tsx:57`). That is below every size in the type ramp.
  2. The `over` level (≥100% of cap, which covers both exactly full and over) has no tag. `TAG` only has a `warn` entry (`CapacityMeter.tsx:19-21`), so the more severe state is carried by the red bar fill alone. The less severe state gets a word.
- Design evidence:
  - `DESIGN.md` › Typography › Hierarchy. **Label** (500, 12px) is for "badges, small buttons and table header text". The smallest documented size is Mono at 10px.
  - `DESIGN.md` › Named Rules › **The Never-Colour-Alone Rule**: "A state carried by colour must also be carried by text or an icon … licence state … readable in greyscale."
  - `DESIGN.md` › Colors › **Status Ink**: status colour as text goes through `text-*-ink`, which clears 4.75:1 on "its own status's 5–15% tint".
  - The user chose the copy on 2026-11-24: **"full" / "เต็ม"** for the `over` level. It covers both 10/10 and 12/10; the `used / cap` figures beside it already say whether the cap is exceeded.
- Owner: `src/pages/clusterManagement/CapacityMeter.tsx` (`TAG` map + tag `<span>`).
- Scope and affected surfaces: every `CapacityMeter` consumer:
  - `src/pages/ClusterManagement.tsx` (`/clusters`, 2 columns)
  - `src/pages/licenses/ClusterLicenseTable.tsx` (`/licenses` cluster tab, BU quota + Seats columns). The BU-quota column there intercepts `cap === 0` before the meter and shows "No licence", so it never reaches the new tag.
- Uncertainty: the "no tag at/over cap" behaviour has existed since the component was created (`573305bd`). Its test asserts it, but no commit or comment says why. The user has decided to change it.

## Design decision

The meter's tag is a status chip, so it takes the **Label** role (`text-xs font-medium`) instead of 9px bold. The `over` level gets a tag in the same shape as `warn`, using the destructive status pair: `text-destructive-ink bg-destructive/15`. The red bar then has a word in every theme and in greyscale, and the two levels read as one ordered scale: near → full. `ok` and `none` stay untagged. That matches the "ink in proportion to exception" decision in `51579e8f`.

## Reuse

- Tokens: `text-warning-ink` / `bg-warning/15` (existing `warn` tag). `text-destructive-ink` / `bg-destructive/15` follow the same pattern and the Status Ink rule.
- Type: `text-xs font-medium` (Tailwind 12px, weight 500 = DESIGN.md Label).
- Exemplar for adding a tag: the existing `warn` entry in `TAG` (`CapacityMeter.tsx:19-21`) and its i18n key `components.fleetCapacity.nearTag` (`src/i18n/en.ts:818`, `src/i18n/th.ts:596`).
- No new primitive. Don't swap the chip for `<Badge variant>`: that is a solid fill and would undo the tinted, low-ink look decided in `51579e8f`.

## Changes

1. `src/i18n/en.ts` (inside `components.fleetCapacity`, next to `nearTag`)
   - Change: add `fullTag: 'full',`. Keep the comment style: the value is lowercase because CSS uppercases it.
   - Preserve: every other key.
   - Verify: `bun run typecheck` passes.
2. `src/i18n/th.ts` (same block, next to `nearTag: 'ใกล้เต็ม'`)
   - Change: add `fullTag: 'เต็ม',`.
   - Verify: the TH catalog type-checks against EN (`src/i18n/types.ts`).
3. `src/pages/clusterManagement/CapacityMeter.tsx`
   - Change: add `over: { textKey: 'components.fleetCapacity.fullTag', cls: 'text-destructive-ink bg-destructive/15' },` to `TAG`.
   - Change: on the tag `<span>` (line 57), replace `text-[9px] font-bold` with `text-xs font-medium`. Keep `rounded px-1 py-0.5 uppercase tracking-wide` and `tag.cls`.
   - Change: update the header comment block (lines 6-10) so it says colour **and a word** are reserved for `warn`/`over`.
   - Preserve: `FILL` values, bar size `h-1 w-10`, the `used / cap` figure, `finite` semantics, and no tag for `ok`/`none`.
   - Verify: 9/10 shows "NEAR" in amber ink, 10/10 and 12/10 show "FULL" in red ink, 5/10 and uncapped show no tag.
4. `src/pages/clusterManagement/CapacityMeter.test.tsx` (existing test, required so the suite stays green; don't add new test files)
   - Change: in `'flags "near" at 90%, and shows no tag once at/over cap'`, replace the `queryByText('at cap')` absence check after `rerender(<CapacityMeter used={10} cap={10} />)` with `expect(screen.getByText('full')).toBeInTheDocument()`, and rename the test to `'flags "near" at 90% and "full" at/over cap'`. Keep the `near` absence assertion at 10/10.
   - Preserve: the uncapped test (no tag at all). Its `'at cap'` assertion can become `'full'`.

## Scope

- Inherit: `/clusters` Business units + Users columns; `/licenses` cluster tab BU quota + Seats columns.
- Verify: rows at 0 cap and 0 used show no tag (`seatUtilization` ratio 0). Rows at 0 cap with used > 0 show "FULL" on `/clusters` (that is correct: in use with no quota). On `/licenses` the BU-quota column never reaches the meter at cap 0.
- Exclude: `CapacityGauge` / `FleetCapacity` (summary band; not part of this tag). `GAUGE_FILL`/`GAUGE_TEXT` exports used by `AllocationTicks`, `CapacityStrip`, `SeatMeter`. `utils/capacity.ts` levels: no new `full` vs `over` split.

## Validation

- Product: on `/clusters`, a cluster at or over its BU quota or seat cap is findable by its word, not only by a red 40px bar.
- Interface:
  - `/clusters` and `/licenses` (cluster tab) in light and dark theme, EN and TH.
  - Row states: 5/10 (no tag), 9/10 (NEAR), 10/10 and 12/10 (FULL), uncapped (no tag).
  - Check 390px (mobile card layout via `meta.card`) and 1366px: the cell must not wrap the tag onto a new line or push the column wider than before by more than the tag width. "ใกล้เต็ม" at 12px is the longest label.
  - Measure contrast: FULL text vs `bg-destructive/15` over the card should be ≥4.5:1 in both themes (DESIGN.md says the ink clears 4.75:1 on its 5–15% tint).
- System: the only tag styles are the two `TAG` entries. There is no parallel badge or inline `text-[..px]` left in `CapacityMeter.tsx`.
- Repository: `bun run typecheck && bun run lint && bunx vitest run src/pages/clusterManagement/CapacityMeter.test.tsx` → all pass; then `bun run test` → full suite passes.

## Stop conditions

- Stop if `TAG`/`CapLevel` has changed shape since `bf6273d6`, or a third consumer of `CapacityMeter` appears that intercepts levels differently.
- Stop if a 12px tag makes the `/clusters` table gain horizontal overflow at 1366px. Report the measurement rather than shrinking the type back off-ramp.
- Stop if dark-theme contrast of FULL on its tint measures under 4.5:1.

## Design documentation

- After acceptance and validation: in `DESIGN.md` › Components, record next to the sidebar/table entries: "Capacity meter: a tinted Label-size tag carries the level in words — `near` (warning ink on 15% warning) at ≥90%, `full` (destructive ink on 15% destructive) at ≥100%; no tag below 90%."
