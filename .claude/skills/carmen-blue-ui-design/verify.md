# How to check the 5 screen sizes

Embed a same-origin iframe of the same page at the width you want — media and container queries
inside it respond to the iframe's width (`resize_window` cannot be trusted). An iframe larger than
the screen is scaled down with `transform`; values read from `contentDocument` are still the
iframe's real pixels — do not divide by the scale.

The dev server is `http://localhost:3304` (`bun run dev:localhost` or `dev:dev`). Log in first in
the real tab — the iframe shares its `localStorage` (token, `lang`, `sidebar-collapsed`, theme).

## Script

Run it once in the tab that has the page open, then `await __vp(W, H, options)` per size. Options:
`edit` (press Edit in the page header first), `dark`, `collapsed` (sidebar collapsed — set through
`localStorage`, restored afterwards), `lang` (`'th'` / `'en'`, restored afterwards), `timeout` (ms,
default 9000).

```js
window.__vp = async (W, H, { edit = false, dark = false, collapsed = false, lang, timeout = 9000 } = {}) => {
  const SEL = {
    skeleton: ".animate-pulse",
    header: "main .sm\\:flex-row:has(h1)",          // PageHeader root
    search: 'main input[placeholder*="Search" i], main input[placeholder*="ค้นหา"]',
    footer: "footer > div",
  };
  const EDIT = /^(edit|แก้ไข)$/i;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const px = Math.round;
  const name = (e) => [e.tagName.toLowerCase(), ...[...e.classList].slice(0, 2)].join(".").replace(/=/g, ":");

  const saved = { c: localStorage.getItem("sidebar-collapsed"), l: localStorage.getItem("lang") };
  const restore = (k, v) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
  localStorage.setItem("sidebar-collapsed", String(collapsed));
  if (lang) localStorage.setItem("lang", lang);

  document.getElementById("__vp")?.remove();
  const f = document.createElement("iframe");
  f.id = "__vp";
  f.src = location.href;
  const s = Math.min(1, innerWidth / W, innerHeight / H);
  f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;transform:scale(${s});transform-origin:top left;z-index:99999;background:#fff;border:0`;
  document.body.appendChild(f);

  const t0 = performance.now();
  let stable = 0;
  while (performance.now() - t0 < timeout && stable < 3) {
    await sleep(250);
    const d = f.contentDocument;
    const ok = d?.readyState === "complete" && d.body?.innerText.trim().length > 0 && !d.querySelector(SEL.skeleton);
    stable = ok ? stable + 1 : 0;
  }
  // the app has read localStorage by now — give the real tab its values back
  restore("sidebar-collapsed", saved.c);
  restore("lang", saved.l);

  const d = f.contentDocument;
  const out = [`${W}${collapsed ? " collapsed" : ""}${edit ? " edit" : ""}${dark ? " dark" : ""}${lang ? " " + lang : ""}: ready ${stable >= 3 ? "yes" : "TIMEOUT"} ${px(performance.now() - t0)}ms`];

  if (edit) {
    const scope = d.querySelector(SEL.header) ?? d;
    const btn = [...scope.querySelectorAll("button")].find((b) =>
      [b.textContent, b.title, b.getAttribute("aria-label")].some((t) => EDIT.test((t ?? "").trim())));
    btn?.click();
    await sleep(700);
    out.push(`edit ${btn ? "clicked" : "NOT FOUND"}`);
  }
  if (dark) d.documentElement.classList.add("dark");

  const all = [...d.body.querySelectorAll("*")].filter((e) => e.getClientRects().length > 0);
  const scrollsX = (e) => /auto|scroll/.test(getComputedStyle(e).overflowX);

  out.push(`page ${d.documentElement.scrollWidth}`);
  const hs = all.filter((e) => scrollsX(e) && e.scrollWidth > e.clientWidth + 1);
  out.push(`hscroll ${hs.length}${hs.length ? " " + hs.slice(0, 3).map(name).join(",") : ""}`);
  const off = all.filter((e) => {
    if (e.getBoundingClientRect().right <= W + 1) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (scrollsX(p)) return false;
    return true;
  });
  out.push(`offscreen ${off.length}${off.length ? " " + off.slice(0, 3).map(name).join(",") : ""}`);
  const short = all.filter((e) => getComputedStyle(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1 && e.clientWidth < 48);
  out.push(`trunc-short ${short.length}${short.length ? " " + short.slice(0, 2).map((e) => e.textContent.slice(0, 12)).join(",") : ""}`);
  const tw = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  let raw = 0;
  while (tw.nextNode()) if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(tw.currentNode.nodeValue.trim())) raw++;
  out.push(`rawkeys ${raw}`);

  // rule 1: the page wrapper against <main>'s content box
  const main = d.querySelector("main");
  if (main) {
    const cs = getComputedStyle(main);
    const inner = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const wrap = main.firstElementChild;
    out.push(`main ${main.clientWidth} content ${px(wrap?.getBoundingClientRect().width ?? 0)}/${px(inner)}`);
  }
  const tables = [...d.querySelectorAll("main table")].filter((t) => t.offsetWidth > 0);
  if (tables.length) out.push("tables " + tables.map((t, i) => `${i}:${t.offsetWidth}/${t.parentElement.clientWidth}`).join(" "));
  const grids = all.filter((e) => main?.contains(e) && getComputedStyle(e).display === "grid" && e.children.length > 1).slice(0, 6);
  if (grids.length) out.push("grids " + grids.map((g) => `${getComputedStyle(g).gridTemplateColumns.split(" ").length}@${g.clientWidth}`).join(" "));

  // rule 13: header buttons on one line and inside the header
  const hd = d.querySelector(SEL.header);
  if (hd) {
    const bs = [...hd.querySelectorAll("button, a[href]")].filter((b) => b.offsetWidth > 0 && !b.closest("h1"));
    // by vertical centre, not top — Export (h-8) and the primary (h-9) share a row but not a top edge
    const rows = new Set(bs.map((b) => { const r = b.getBoundingClientRect(); return px((r.top + r.bottom) / 8); })).size;
    const fits = bs.every((b) => b.getBoundingClientRect().right <= hd.getBoundingClientRect().right + 1);
    out.push(`header rows ${rows} fits ${fits ? "yes" : "NO"}`);
  }
  // rule 12: gap from the search box to the next button on the same row
  const si = d.querySelector(SEL.search);
  if (si && si.offsetWidth > 0) {
    const r = si.getBoundingClientRect();
    const next = [...d.querySelectorAll("main button")]
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.left >= r.right && Math.abs(b.top + b.height / 2 - (r.top + r.height / 2)) < r.height)
      .sort((a, b) => a.left - b.left)[0];
    out.push(`search gap ${next ? px(next.left - r.right) : "n/a"}`);
  }
  const bar = d.querySelector(SEL.footer);
  if (bar) out.push(`footer lines ${new Set([...bar.children].map((c) => px(c.getBoundingClientRect().top))).size} scroll ${bar.scrollWidth}/${bar.clientWidth}`);
  return out.join(" | ");
};
```

Run sizes in batches of **3 per `javascript_tool` call** — each call times out at 45 seconds:

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

Then 1366 / 1920 / 3840 with `{ collapsed: true }` (below `md` the sidebar is a drawer anyway),
`{ lang: "th" }` at 390 and 1366 at least, `{ dark: true }` at one size, and `{ edit: true }` for
Toggle-mode Edit pages. Remove the iframe when done: `document.getElementById("__vp")?.remove()`.

## Reading the result

| Output | Pass |
|---|---|
| `ready` | `yes` — `TIMEOUT` means numbers were taken mid-load; rerun with a bigger `timeout` |
| `page` | `W` minus the iframe's scrollbar (≈5px) |
| `hscroll` | `0` — otherwise the listed box scrolls sideways |
| `offscreen` | `0` — otherwise something sits past the right edge and the shell hides it |
| `trunc-short` | `0` — otherwise hide something instead (rule 10) |
| `rawkeys` | `0` — otherwise a translation key shows raw (or the tab holds old strings: reload) |
| `main a content b/c` | `b = c` (rule 1). `a` is capped at **1400** from 1920 up — the shell deviation, not your page |
| `tables i:a/b` | `a ≤ b` for every table |
| `grids n@w` | the column count you expect at that box width |
| `header` | `rows 1 fits yes` |
| `search gap` | same value at every size from 768 up |
| `footer` | `scroll` values equal; `lines` 1 from 768 up |
| `edit` | `clicked` — otherwise that run did not test edit mode |

Measured shell numbers (2026-11-23, sidebar expanded): `main` 385 @390 · 523 @768 · 1121 @1366 ·
1400 @1920 · 1400 @3840; `main` has 16px side padding below `sm`, 24px from `sm`. Re-measure after
any change to `Layout`, `Sidebar` or `tailwind.config.js` `container`.

Take a screenshot after each size. `zoom` coordinates are screenshot coordinates: the iframe is
`W × s` viewport pixels wide, multiplied again by (screenshot width ÷ `innerWidth`).

## Check real clicks (not just screen sizes)

- **Save → change the same field back within 3 seconds → Save again.** The button must be enabled
  and the value saved (reload and check). A 409 here means the page sent a stale `doc_version`.
- Set an input's value with the native setter + an `input` event (plain `el.value = …` is invisible
  to React) — the setter **bypasses `disabled`**, so what happens while a field is disabled is not
  real user behaviour.
- On the shared DEV backend: note the original value, change it back, reload to confirm; delete what
  you created; never upload over an existing image.
- **States you cannot see as super-admin** (no permission, feature flag `hide`, licence off): force
  them in code tagged `__TEMP_VERIFY__`, check, then remove and `grep -rn __TEMP_VERIFY__ src`
  before committing. Tell the user it was a simulation.

## Claude in Chrome specifics

- Functions on `window` (`__vp`) vanish on every reload or navigation — declare them again.
- A result containing `=` is blocked as "Cookie/query string data" even though the script ran — do
  not rerun blindly. `__vp` avoids `=` in its output; keep it that way when you add probes.
- A tab where the user has device emulation open cannot take commands ("Cannot access a
  chrome-extension:// URL") — open a new tab with `tabs_create_mcp`, close it when done.
- A blocked analytics/tracker path fails in the browser even when `curl` passes — an ad blocker,
  not the app.

## Check everything before saying it is done

- [ ] All 5 sizes, sidebar expanded — every line of `__vp` passes
- [ ] 1366 / 1920 / 3840 with `{ collapsed: true }` (rule 3)
- [ ] Dark at one size at least + screenshot
- [ ] Thai at 390 and 1366 at least (Thai labels are longer — `shrink-0` rows clip here)
- [ ] Loading skeleton matches the page structure · empty state · error state
- [ ] Things whose count depends on data, tried at the maximum
- [ ] Changed a shared piece → every page that uses it
- [ ] `bun run typecheck` · `bun run lint` · tests of the folders you touched
- [ ] Edit pages: `{ edit: true }` at all 5 sizes, header `rows 1` at 360 / 390, Save-then-edit
- [ ] Anything not checked, any size not opened: tell the user plainly
