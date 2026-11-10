---
title: "Dev machine runs Node 26, not the Node 20 that .nvmrc/CLAUDE.md declare"
author: Thammanoon
date: 2026-11-09
id: l-b8c3190e
scope: repo
status: active
touches:
  - CLAUDE.md
---

## Decided
The dev machine runs **Node v26.0.0**, even though `.nvmrc`, `engines`, and
CLAUDE.md all say Node 20.x.

**Why it matters:** `node --test <dir>` behaves differently across versions. On
Node 26, `node --test scripts/lib/` (a bare directory) errors with
`Cannot find module .../scripts/lib`. Use a glob instead:
`node --test scripts/lib/*.test.mjs`. The `test:scripts` npm script already does this.

## Watch out
When writing `node --test`, build scripts, or anything
version-sensitive, don't assume Node 20 — verify with `node --version` first.

_From Claude Code's memory of this repo, last updated Aug 30._
