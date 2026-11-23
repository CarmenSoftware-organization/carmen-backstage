# How to check the 5 screen sizes

Embed a same-origin iframe of the same page at the width you want — media queries and container
queries inside it respond to the iframe's width (`resize_window` cannot be trusted). An iframe
larger than the screen is scaled down with `transform` to fit. Values measured from
`contentDocument` are still the iframe's real pixels; do not divide by the scale.

## Script

Run it once in the tab that has the page open, then call `await __vp(W, H, options)` per size. It
returns the measurements as text. Options: `edit` (press Edit first), `dark`, `collapsed` (collapse
the sidebar first), `timeout` (ms to wait for the page, default 8000).

The selectors in `SEL` are the ones the probes rely on. If a probe prints `n/a` on a page that
clearly has that thing, fix the selector here rather than skipping the check.

```js
window.__vp = async (W, H, { edit = false, dark = false, collapsed = false, timeout = 8000 } = {}) => {
  const SEL = {
    skeleton: "[data-slot=skeleton], .animate-pulse",
    sidebar: "[data-slot=sidebar][data-state], [data-sidebar=sidebar], .group.peer[data-state]",
    sidebarTrigger: "[data-slot=sidebar-trigger], [data-sidebar=trigger]",
    header: '[class*="@container/doc-header"]',
    search: 'input[type=search], [role=searchbox], input[placeholder*="Search" i], input[placeholder*="ค้นหา"]',
    statusBar: "[data-slot=status-bar]",
    landingGroup: 'section[class*="break-inside-avoid"]',
  };
  const EDIT = /^(edit|แก้ไข)$/i;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const px = (n) => Math.round(n);
  const name = (e) => [e.tagName.toLowerCase(), ...[...e.classList].slice(0, 2)].join(".").replace(/=/g, ":");

  document.getElementById("__vp")?.remove();
  const f = document.createElement("iframe");
  f.id = "__vp";
  f.src = location.href;
  const s = Math.min(1, innerWidth / W, innerHeight / H);
  f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;transform:scale(${s});transform-origin:top left;z-index:99999;background:#fff;border:0`;
  document.body.appendChild(f);

  // wait until the page has content and no skeleton for 3 checks in a row (750ms stable)
  const t0 = performance.now();
  let stable = 0;
  while (performance.now() - t0 < timeout && stable < 3) {
    await sleep(250);
    const d = f.contentDocument;
    const ok = d?.readyState === "complete" && d.body?.innerText.trim().length > 0 && !d.querySelector(SEL.skeleton);
    stable = ok ? stable + 1 : 0;
  }
  const d = f.contentDocument;
  const out = [`${W}${collapsed ? " collapsed" : ""}${edit ? " edit" : ""}${dark ? " dark" : ""}: ready ${stable >= 3 ? "yes" : "TIMEOUT"} ${px(performance.now() - t0)}ms`];

  if (collapsed) {
    const sb = d.querySelector(SEL.sidebar);
    if (sb?.getAttribute("data-state") === "expanded") {
      d.querySelector(SEL.sidebarTrigger)?.click();
      await sleep(500);
    }
    out.push(`sidebar ${d.querySelector(SEL.sidebar)?.getAttribute("data-state") ?? "n/a"}`);
  }
  if (edit) {
    const scope = d.querySelector(SEL.header) ?? d;
    const btn = [...scope.querySelectorAll("button")].find((b) =>
      [b.textContent, b.title, b.getAttribute("aria-label")].some((t) => EDIT.test((t ?? "").trim())));
    btn?.click();
    await sleep(700);
    out.push(`edit ${btn ? "clicked" : "NOT FOUND"}`);
  }
  if (dark) d.documentElement.classList.replace("light", "dark") || d.documentElement.classList.add("dark");

  const all = [...d.body.querySelectorAll("*")].filter((e) => e.getClientRects().length > 0);
  const scrollsX = (e) => /auto|scroll/.test(getComputedStyle(e).overflowX);

  // page-level horizontal scroll
  out.push(`page ${d.documentElement.scrollWidth}`);
  // any box that scrolls sideways (shell <main>, DataGrid frame…) — must be 0
  const hs = all.filter((e) => scrollsX(e) && e.scrollWidth > e.clientWidth + 1);
  out.push(`hscroll ${hs.length}${hs.length ? " " + hs.slice(0, 3).map(name).join(",") : ""}`);
  // things past the right edge of the viewport that no scroller holds — hidden by overflow-hidden
  const off = all.filter((e) => {
    if (e.getBoundingClientRect().right <= W + 1) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (scrollsX(p)) return false;
    return true;
  });
  out.push(`offscreen ${off.length}${off.length ? " " + off.slice(0, 3).map(name).join(",") : ""}`);
  // rule 10: truncated text squeezed to a few characters ("Admi…")
  const short = all.filter((e) => getComputedStyle(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1 && e.clientWidth < 48);
  out.push(`trunc-short ${short.length}`);
  // raw translation keys (text that is only "ns.key.sub")
  const tw = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  let raw = 0;
  while (tw.nextNode()) if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(tw.currentNode.nodeValue.trim())) raw++;
  out.push(`rawkeys ${raw}`);

  // every table against its frame
  const tables = [...d.querySelectorAll("table")].filter((t) => t.offsetWidth > 0);
  if (tables.length) out.push("tables " + tables.map((t, i) => `${i}:${t.offsetWidth}/${t.parentElement.clientWidth}`).join(" "));
  // column count @ box width of each CSS grid in <main> (FieldGrid included)
  const root = d.querySelector("main") ?? d.body;
  const grids = all.filter((e) => root.contains(e) && getComputedStyle(e).display === "grid" && e.children.length > 1).slice(0, 8);
  if (grids.length) out.push("grids " + grids.map((g) => `${getComputedStyle(g).gridTemplateColumns.split(" ").length}@${g.clientWidth}`).join(" "));

  // rule 13: form header buttons on one line and inside the header
  const hd = d.querySelector(SEL.header);
  if (hd) {
    const bs = [...hd.querySelectorAll("button")].filter((b) => b.offsetWidth > 0);
    const rows = new Set(bs.map((b) => px(b.getBoundingClientRect().top))).size;
    const fits = bs.length === 0 || bs.at(-1).getBoundingClientRect().right <= hd.getBoundingClientRect().right + 1;
    out.push(`header rows ${rows} fits ${fits ? "yes" : "NO"}`);
  }
  // rule 12: gap from the search box to the next button on the same row
  const si = d.querySelector(SEL.search);
  if (si && si.offsetWidth > 0) {
    const r = si.getBoundingClientRect();
    const next = [...d.querySelectorAll("button")]
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.left >= r.right && Math.abs(b.top + b.height / 2 - (r.top + r.height / 2)) < r.height)
      .sort((a, b) => a.left - b.left)[0];
    out.push(`search gap ${next ? px(next.left - r.right) : "n/a"}`);
  }
  // landing: column count and card width
  const groups = [...d.querySelectorAll(SEL.landingGroup)];
  if (groups.length) {
    const cols = new Set(groups.map((g) => px(g.getBoundingClientRect().left))).size;
    const cw = groups.flatMap((g) => [...g.querySelectorAll(".grid > *")]).map((c) => c.offsetWidth).filter(Boolean);
    out.push(`landing cols ${cols} card ${Math.min(...cw)}-${Math.max(...cw)}`);
  }
  // shell status bar
  const bar = d.querySelector(SEL.statusBar);
  if (bar && bar.children.length >= 2) {
    const [l, r] = bar.children;
    const last = [...l.children].filter((e) => e.getBoundingClientRect().width > 0).pop();
    if (last) out.push(`footer gap ${px(r.getBoundingClientRect().left - last.getBoundingClientRect().right)} scroll ${bar.scrollWidth}/${bar.clientWidth}`);
  }
  return out.join(" | ");
};
```

Run sizes in batches of **3 per `javascript_tool` call** — each call times out at 45 seconds, and a
slow page can take up to `timeout` per size:

```js
const res = [];
for (const [W, H] of [[390, 844], [768, 1024], [1366, 768]]) res.push(await __vp(W, H));
res;
```
```js
const res = [];
for (const [W, H] of [[1920, 1080], [3840, 2160]]) res.push(await __vp(W, H));
res;
```

Then the same two batches with `{ collapsed: true }` from 1366 up (below that the sidebar is not
expanded anyway), and again with `{ edit: true }` for forms.

## Reading the result

| Output | Pass |
|---|---|
| `ready` | `yes` — `TIMEOUT` means the numbers were taken mid-load; rerun with a bigger `timeout` |
| `page` | equals `W` |
| `hscroll` | `0` — otherwise the listed box scrolls sideways (a table overflowing its frame shows here) |
| `offscreen` | `0` — otherwise something sits past the right edge and the shell is hiding it |
| `trunc-short` | `0` — otherwise hide something instead (rule 10) |
| `rawkeys` | `0` — otherwise a translation key is shown raw (or the tab holds old strings: reload) |
| `tables i:a/b` | `a ≤ b` for every table · `b` at 768 is the tablet budget (`tables.md`) |
| `grids n@w` | matches the column-count table in `forms.md` · `w` is the box width |
| `header` | `rows 1 fits yes` |
| `search gap` | same value at every size from 768 up (17) |
| `landing` | `cols` as in `landing.md` · card width about 280–400 |
| `footer` | gap positive and the two `scroll` values equal |
| `edit` / `sidebar` | `clicked` / `collapsed` — otherwise that run did not test what you asked |

Take a screenshot after each size. `zoom` coordinates are screenshot coordinates, not viewport
coordinates: the iframe is `W × s` viewport pixels wide, and that must be multiplied again by
(screenshot width ÷ `innerWidth`).

**`collapsed` changes the real tab too** if the sidebar remembers its state (cookie or
localStorage): when done, expand the sidebar again in the real tab.

## Check real clicks (not just screen sizes)

After laying out a form you must also click through it for real — the `/profile/setting` bug
(2026-11-13) was not found by measuring all 5 screen sizes; it was found by pressing Save.

- **Save → change the same field back to the old value within 3 seconds → Save again.** The button
  must be enabled and the value must be saved (reload and check). Causes and fixes → `forms.md`
  §Save. Examples: `hooks/use-profile.ts` `useUpdateProfile`,
  `routes/profile/user-profile-setting.tsx`
- Set an input's value with the native setter + an `input` event (plain `el.value = …` is invisible
  to React) — but the setter **bypasses `disabled`**. What you get while the field is disabled
  (during a pending mutation) is not real user behaviour; do not read it as a bug.
- Testing on the shared dev DB: note the original value before changing it, change it back, then
  reload to confirm · delete things created for the test (tokens, signatures) · **do not upload over
  an existing image/file** (it cannot be recovered) and do not press "delete all".
- Switching language: `localStorage["carmen.locale"] = "th"`, then reload the iframe. Set it back
  when done.

## Landing pages

- **Columns, card width** → the `landing` line. **Page length** = the bottom edge of the lowest
  group − the top edge of the `h1`, compared with the viewport height.
- **Is an illustration clipped?** The top edge of the illustration content
  (`box.firstElementChild.firstElementChild`) must not sit above the top edge of the illustration
  frame — reduce the frame height and a 4-row illustration gets clipped silently.
- **Raw translation keys** → the `rawkeys` line. A tab left open from before the translation file
  was edited still holds the old strings. Reload before trusting it.
- **Open every destination**: collect every card's `href`, then load each path in an iframe (~3
  seconds each, in batches of 5–6 cards) and check that `location.pathname` matches and there is no
  `[role=alert]` · actually click at least 1 card.
- **Locked / no permission / hidden states** cannot be seen with an admin account — force the state
  temporarily in the page's code (change the value in the permission map, tagged
  `__TEMP_VERIFY__`), open it and click for real, then **remove it and grep to confirm before
  committing**. Cover all 4 cases: locked (padlock + licence dialog), no permission (permission
  dialog), card gone, whole group gone (group numbers must not skip; the column count drops
  accordingly). Tell the user it was a simulation, not a real non-admin account.

## Claude in Chrome specifics

These come from the browser extension, not from the app:

- Functions parked on `window` (`__vp`) vanish every time the page reloads or navigates — declare
  them again.
- A result containing `=` is blocked as "Cookie/query string data" even though the script ran to
  completion — do not rerun without checking state. `__vp` already avoids `=` in its output; keep it
  that way when you add probes.
- A dialog with a password field (Change Password) detaches the extension ("Detached") — check it by
  eye. A script that detaches midway **still runs to the end**; take a screenshot to see the state
  before doing anything else.
- **Tab unusable** ("Cannot access a chrome-extension:// URL of different extension"): a tab where
  the user has another tool open on top (such as device-emulation mode) cannot take commands, neither
  JS nor screenshots — do not retry. Open a new tab with `tabs_create_mcp`, work there, and close it
  when done. If the user's window is already narrow (`innerWidth` < 600) you can look at the real
  thing in the tab without an iframe.

## Check everything before saying it is done

**Every page**

- [ ] View mode at all 5 sizes, sidebar expanded — every line of `__vp` passes
- [ ] 1366 / 1920 / 3840 again with `{ collapsed: true }` (rule 3)
- [ ] Dark mode at one size at least (`{ dark: true }`) + screenshot
- [ ] Thai at mobile and 1366 at least
- [ ] Loading skeleton matches the page structure · empty state (no data)
- [ ] Things whose count depends on data, tried at the maximum (e.g. 10 scopes)
- [ ] Changed a shared piece (`CompactSection` etc.) → every page that uses it, not just this one
- [ ] `bun run typecheck` · `bun run lint` · tests of the folders you touched
- [ ] Anything not checked, any size not opened: tell the user plainly — do not report it as
      complete

**Forms** (add)

- [ ] Edit mode at all 5 sizes (`{ edit: true }`, check `edit clicked`)
- [ ] Header `rows 1 fits yes` at 360 / 390 / 486, view and edit mode
- [ ] Error text under a field · Save then change back within 3 seconds (§Check real clicks)

**Lists and tables** (add)

- [ ] Search gap the same from 768 up
- [ ] Tables that pick columns/sizes by box width: also 1024, 1180, 1280, and resize the iframe live
      (`f.style.width` to `900px`) to confirm the columns swap
- [ ] Expandable items: open and closed, with and without comparison content

**Shell bars** (add)

- [ ] `footer` passes at 390 and 768

**Landing pages** (add)

- [ ] No hard-coded numbers · a card for every menu page · every destination opened · the 4
      permission states
