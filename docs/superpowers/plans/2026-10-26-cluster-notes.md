# Cluster Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A staff-only "Notes" tab on Cluster Edit: plain-text notes with file attachments, a cluster-wide files panel, edit history, soft delete with restore.

**Architecture:** New `tb_cluster_note` table in the backstage schema, owned by a new `cluster-note` module in micro-cluster (RPC), exposed by a new gateway module under `api-system/clusters/:clusterId/notes` that gates every route with backstage RBAC (`cluster_note.view` / `cluster_note.manage`) and never with cluster membership. History reuses `tb_activity` (BackstageActivityInterceptor) but is served by the notes module; the generic `activity-logs` endpoints refuse `cluster_note` rows. FE adds a fourth `ClusterTabId` with a timeline + files panel.

**Tech Stack:** NestJS microservices + Prisma (backstage schema) + MinIO via micro-file RPC; React + TS + shadcn/ui + Tailwind (Vite, Bun).

**Spec:** `docs/superpowers/specs/2026-10-26-cluster-notes-design.md` (in carmen-backstage). Read it before any task.

## Global Constraints

- **Test steps are skipped by user preference** — do not create `*.spec.ts` / `*.test.ts(x)`. Still run type-check, lint and the backend gates. Existing suites must stay green.
- Two repos, one branch each, named **`feature/cluster-notes`** in both `carmen-turborepo-backend` and `carmen-backstage`. Never commit to `main`. Subagents must be told the branch name explicitly.
- **Do not push the backend branch until Task 6** — pushing a branch that carries a migration has applied it to DEV within ~2 minutes before. The migration is additive, but the push is a deliberate step.
- Notes and files are visible to backstage staff only. `tb_cluster_user` membership / cluster admin must never grant anything here. Gate at the gateway with `BackstagePermissionGuard` + `@RequireBackstagePermission('<literal>')` and then a fine-scope check — **never** `ClusterAdminAuthzService.readableClusterScope()` (it admits membership admins).
- Permission keys are string literals in decorators (the `audit:api-system-permission` gate does not resolve constants).
- Files: PDF, jpg/png, doc/docx, xls/xlsx; ≤ 10 MB each; ≤ 5 per request.
- Message: plain text; a note needs a non-blank message or ≥ 1 attachment.
- List page size 20, newest first; deleted list ordered by `deleted_at` desc.
- Never delete from MinIO (no `Files.delete` anywhere in this feature). Removed attachments stay in JSONB with `removed_at`.
- Never store or return presigned URLs in note payloads; URLs only from the `/url` endpoint.
- `cluster_note.manage` is only honoured together with `cluster_note.view`.
- Deleted notes are read-only until restored; no hard delete.
- FE: `doc_version` via `src/utils/docVersion.ts`; errors via `utils/errorParser.ts`; feedback via `toast.*`; `ConfirmDialog` for delete; TH + EN strings.

## Review Focus

1. **A membership cluster admin (or anyone without `cluster_note.view`) reads a note through any route** — every notes route, `/url`, `/history`, `activity-logs/record/:id`, `activity-logs/:id/detail` must refuse. Verified by the curl matrix in Task 6.
2. **A cluster-scoped grant for cluster A reaching cluster B** — the guard is coarse (passes if the key is held in *any* cluster); the controller must check `:clusterId` against `resolveAllowedClusterIds`. Task 4 + Task 6 curl.
3. **A `fileToken` from another cluster passed to this cluster's `/url`** — must 403/404, never sign. Task 2 `ownsFile` + Task 6 curl.
4. **Two staff editing the same note** — second save gets 409 → `notifyVersionConflict()` + refetch, no silent overwrite. Task 2 + Task 8, browser check in Task 10.
5. **Editing or deleting an already-deleted note via direct API** — must be rejected (read-only until restored). Task 2 + Task 6 curl.

---

## Backend — `carmen-turborepo-backend`

### Task 1: Schema, migration, permission catalog

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma` (add model after `tb_cluster`, add relation field on `tb_cluster`)
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261026150000_add_cluster_note/migration.sql`
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-permission.data.ts` (beside the `activity_log` entries ~L256)
- Modify: `packages/prisma-shared-schema-backstage/src/backstage-permission-resource.ts` (beside `activity_log` ~L108)
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-role-permission.data.ts`

**Interfaces:**
- Produces: Prisma model `tb_cluster_note { id uuid, cluster_id uuid → tb_cluster, message String? (text), attachments Json @default("[]") @db.JsonB, doc_version Int @default(0), created_at, created_by_id, updated_at, updated_by_id, deleted_at, deleted_by_id }` with `@@index([cluster_id, deleted_at, created_at(sort: Desc)])`. Audit columns follow `tb_cluster` exactly (types, defaults, nullability). No `tb_user` relations needed.
- Produces: attachment element shape (document it in a schema comment like `tb_location_comment` does): `{ fileName: string, fileToken: string, contentType: string, size?: number, uploaded_at: string, uploaded_by_id: string|null, removed_at?: string|null, removed_by_id?: string|null }`
- Produces: permission keys `cluster_note.view`, `cluster_note.manage`; resource `cluster_note` (description "Internal staff notes and files on a cluster" / TH "บันทึกภายในทีมและไฟล์ของคลัสเตอร์").
- Role mapping (my call, spec §สิทธิ์): `Backstage Admin` → `'cluster_note.*'`; `Support Manager` → `'cluster_note.view'`, `'cluster_note.manage'`; `Support Staff` → `'cluster_note.view'`; `Security Officer` → none.

- [ ] **Step 1:** Create branch `feature/cluster-notes` from up-to-date `main`.
- [ ] **Step 2:** Add the model + relation; write the migration SQL by hand or with `bun run db:migrate -- --create-only` from the package (do **not** apply to any shared DB). Check that the migration folder sorts after `20261026130000_rename_platform_tables_to_backstage`.
- [ ] **Step 3:** Add the two permission entries, the resource entry, and the role mappings.
- [ ] **Step 4:** Run `bun run db:generate`, then from repo root `bun run audit:backstage-permission-resource` and the role/permission drift checks under `packages/prisma-shared-schema-backstage/prisma/check.*permission*drift.ts`. Expected: no new findings.
- [ ] **Step 5:** Commit `feat(cluster-note): add tb_cluster_note schema, migration and cluster_note permissions`.

### Task 2: micro-cluster `cluster-note` module

**Files:**
- Create: `apps/micro-cluster/src/cluster/cluster-note/{cluster-note.module.ts, cluster-note.controller.ts, cluster-note.service.ts, interface/cluster-note.interface.ts}` — mirror `apps/micro-cluster/src/cluster/cluster-license/` (controller extends `BaseMicroserviceController`, `runWithAuditContext`, `@TryCatch`, `Result`, `ERROR_CATALOG`).
- Modify: `apps/micro-cluster/src/app.module.ts` (import module)
- Modify (generated): `packages/rpc-contract/src/contracts/cluster-notes.ts` + `contracts/index.ts` via `bun run gen:rpc-contract` (3-step process in the generated file header).
- Modify: `apps/micro-cluster/src/common/activity/backstage-activity-registry.ts`

**Interfaces** (RPC service `cluster-notes`; contract export `ClusterNotes`; all payloads carry `user_id` + audit fields as usual; every method's first check is that the note's `cluster_id` equals `payload.cluster_id`, else `NOT_FOUND`):

| key | cmd | payload `data` | returns |
|---|---|---|---|
| `findAllByCluster` | `cluster-notes.find-all-by-cluster` | `{ cluster_id, page?, perpage?, deleted?: boolean }` | paginated `IClusterNote[]` (`deleted=false` → `deleted_at null` order `created_at desc`; `true` → not null, order `deleted_at desc`) + `summary: { deleted_count }` |
| `files` | `cluster-notes.files` | `{ cluster_id }` | `IClusterNoteFile[]` from non-deleted notes, non-removed attachments, order `uploaded_at desc` |
| `findOne` | `cluster-notes.find-one` | `{ id, cluster_id }` | `IClusterNote` (deleted included) |
| `create` | `cluster-notes.create` | `{ cluster_id, message?: string\|null, attachments: IClusterNoteAttachmentInput[] }` | `IClusterNote` |
| `update` | `cluster-notes.update` | `{ id, cluster_id, doc_version: number, message?: string\|null, attachments?: { add: IClusterNoteAttachmentInput[], remove: string[] } }` | `IClusterNote`; 409 on `doc_version` mismatch; reject when deleted |
| `delete` | `cluster-notes.delete` | `{ id, cluster_id }` | `{ id }`; reject when already deleted |
| `restore` | `cluster-notes.restore` | `{ id, cluster_id }` | `{ id }`; reject when not deleted |
| `history` | `cluster-notes.history` | `{ id, cluster_id, page?, perpage? }` | paginated rows from `tb_activity` where `entity_type='cluster_note' AND entity_id=id`, newest first, each with `changes: buildActivityDiff(old_data, new_data)` (import from `src/log/activity-log/`) and actor info shaped like `BackstageActivityLogService.findByEntityId` rows |
| `ownsFile` | `cluster-notes.owns-file` | `{ cluster_id, file_token }` | `{ owned: boolean }` — true if any note of the cluster (deleted included) has an attachment with that `fileToken` (Prisma JSONB `array_contains: [{ fileToken }]`) |

- `IClusterNote = { id, cluster_id, message: string|null, attachments: IClusterNoteAttachment[] /* removed ones stripped */, doc_version, created_at, created_by_id, updated_at, updated_by_id, deleted_at, deleted_by_id, is_edited: boolean /* doc_version > 0 */ }`
- `IClusterNoteFile = { note_id, fileName, fileToken, contentType, size?, uploaded_at, uploaded_by_id }`
- `IClusterNoteAttachmentInput = { fileName, fileToken, contentType, size? }` — service stamps `uploaded_at`/`uploaded_by_id`; `remove` stamps `removed_at`/`removed_by_id` on matching tokens instead of dropping them.
- Validation in service: message trimmed; reject create/update that would leave blank message and zero live attachments; ≤ 5 attachments in one `add`.
- `doc_version`: increment on update/delete/restore, using the conditional-update pattern other backstage services use for 409.
- Registry entries (all `entityName: 'tb_cluster_note'`): `cluster-notes.create` → `create` / `'response.data.id'`; `cluster-notes.update` → `update` / `'payload.id'`; `cluster-notes.delete` → `delete` / `'payload.id'`; `cluster-notes.restore` → `update` / `'payload.id'`. Check the interceptor reads the id from where these payloads put it (adjust to the `EDITED_ID` / `DELETED_ID` constants if they match). Do **not** add `fileToken` to `sensitiveFields` in `app.module.ts`, and do **not** add anything to `RELATED_ACTIVITY`.

- [ ] **Step 1:** Write interface file and service methods with the signatures above.
- [ ] **Step 2:** Write controller with temporary `@MessagePattern({ cmd, service: 'cluster-notes' })` literals → `bun run gen:rpc-contract` → replace literals with `ClusterNotes.<key>.pattern`.
- [ ] **Step 3:** Register module and the four registry entries.
- [ ] **Step 4:** `bun run check-types --filter=micro-cluster` (or the app's own `check-types`) and `bunx eslint apps/micro-cluster/src/cluster/cluster-note` (do **not** use `bun run lint` — it runs `--fix` over the whole repo). Run `bun run audit:message-pattern-literal` and `bun run audit:tcp-drift`. Expected: clean.
- [ ] **Step 5:** Commit `feat(micro-cluster): cluster-note module with history, soft delete and restore`.

### Task 3: Hide `cluster_note` from the generic activity-logs

**Files:**
- Modify: `apps/micro-cluster/src/log/activity-log/activity-log.service.ts` (`findByEntityId` ~L210, `findOneDetail` ~L294)

**Interfaces:**
- Produces: `const HIDDEN_ENTITY_TYPES: readonly string[] = ['cluster_note']` (exported, with a comment pointing at the spec: note history is served by `cluster-notes.history` under `cluster_note.view`).
- `findByEntityId`: if `params.entity_type` is hidden → `ACTIVITY_LOG_NOT_FOUND`; add `NOT: { entity_type: { in: HIDDEN_ENTITY_TYPES } }` to `where` (covers calls without `entity_type`).
- `findOneDetail`: if `activity.entity_type` is hidden → `ACTIVITY_LOG_NOT_FOUND`.

- [ ] **Step 1:** Implement the three changes.
- [ ] **Step 2:** Type-check + eslint as in Task 2; run the existing micro-cluster jest suite for `activity-log` (`--runInBand --forceExit`). Expected: existing tests pass.
- [ ] **Step 3:** Commit `fix(activity-log): never serve cluster_note rows through the generic audit endpoints`.

### Task 4: Gateway `backstage_cluster-notes` module

**Files:**
- Create: `apps/backend-gateway/src/backstage/backstage_cluster-notes/{backstage_cluster-notes.module.ts, backstage_cluster-notes.controller.ts, backstage_cluster-notes.service.ts, swagger/*.dto.ts}` — copy wiring from `backstage_cluster-licenses/` (first controller, `@Controller('api-system/clusters/:clusterId/licenses')`) and the upload flow from `backstage_clusters.service.ts` `uploadLogo` (base64 → `Files.upload` with `bu_code: 'cluster'`).
- Modify: the backstage aggregate module that imports `BackstageClusterLicensesModule` (register the new module next to it).
- Modify: `apps/backend-gateway/src/backstage/backstage-activity-logs/activity-log-scope.ts` — widen `resolveAllowedClusterIds(eff, required: string)`; keep `ActivityLogPermissionKey` exported for existing callers.
- Modify (generated): `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts`.

**Interfaces** — `@Controller('api-system/clusters/:clusterId/notes')`, class-level `@UseGuards(KeycloakGuard)`; every route `@UseGuards(new AppIdGuard('clusterNote.<name>'), BackstagePermissionGuard)` + `@RequireBackstagePermission('<literal>')`:

| route | AppId name | permission literal | notes |
|---|---|---|---|
| `GET /` `?page&perpage&deleted` | `clusterNote.findAll` | `cluster_note.view` | `@EnrichAuditUsers()` |
| `GET /files` | `clusterNote.files` | `cluster_note.view` | `@EnrichAuditUsers()` for `uploaded_by_id` if the decorator supports nested paths, else leave ids |
| `GET /files/:fileToken/url` | `clusterNote.fileUrl` | `cluster_note.view` | `ownsFile` → false ⇒ 404; true ⇒ `Files.presignedUrl { fileToken, expirySeconds: 300 }` → `{ url, expires_at }` |
| `POST /` multipart `message`, `files` | `clusterNote.create` | `cluster_note.manage` | `FilesInterceptor('files', 5, { limits: { fileSize: 10 * 1024 * 1024 } })` |
| `PATCH /:noteId` multipart `message?`, `files?`, `remove?` (token[]), `doc_version` | `clusterNote.update` | `cluster_note.manage` | same interceptor |
| `DELETE /:noteId` | `clusterNote.delete` | `cluster_note.manage` | |
| `POST /:noteId/restore` | `clusterNote.restore` | `cluster_note.manage` | |
| `GET /:noteId/history` `?page&perpage` | `clusterNote.history` | `cluster_note.view` | `@EnrichAuditUsers()` |

- Fine scope, in a private controller helper `assertClusterInScope(req, clusterId, key)`: `allowed = resolveAllowedClusterIds(req.backstagePermissions, key)`; `null` passes; otherwise `clusterId.toLowerCase()` must be in `allowed`, else `ForbiddenException()`. Write routes call it for **both** `cluster_note.manage` and `cluster_note.view`. `:clusterId` via `ParseUUIDPipe`.
- Upload validation before any `Files.upload`: mime in `application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` else 400. Upload sequentially, pass `tags: { reference_type: 'cluster_note' }`, map to `IClusterNoteAttachmentInput`. On a failed create/update after upload, return the micro error and leave the uploaded files (spec: orphans accepted; never `Files.delete`).
- Swagger DTOs + `@ApiStdResponse` like the licenses controller; `operationId` `backstageClusterNote_<name>`.

- [ ] **Step 1:** Widen `resolveAllowedClusterIds`.
- [ ] **Step 2:** Implement service (RPC calls) and controller per the table.
- [ ] **Step 3:** Register module; regenerate the app-api catalog.
- [ ] **Step 4:** Gateway type-check + `bunx eslint` on the new folder; run `bun run audit:api-system-permission`, `bun run audit:app-api-catalog-drift`, `bun run audit:guard-providers`, `bun run audit:enrich-audit-paths`, `bun run audit:rest-contract`. Expected: no new findings.
- [ ] **Step 5:** Commit `feat(gateway): staff-only cluster notes endpoints with file upload and history`.

### Task 5: Backend gates + PR (no push before this step)

- [ ] **Step 1:** Run `bun run gates` (scripts/run-gates.sh). Expected: green, or only the known pre-existing reds recorded on `main` — compare against a `main` run before blaming this branch.
- [ ] **Step 2:** Run the existing gateway jest suites touched by the scope change (`backstage-activity-logs`) with `--runInBand --forceExit`. Expected: pass.
- [ ] **Step 3:** Push `feature/cluster-notes`, open PR to `main` with a body listing the deploy order (migration by hand → seed permissions → role-permission seed). Ask the user before merging.

### Task 6: DEV rollout + API verification (after the backend PR merges)

- [ ] **Step 1:** Confirm the backend auto-deploy to DEV finished for the merge SHA (`gh run list --branch main`, match `headSha`).
- [ ] **Step 2:** Apply the migration on DEV by hand per the backend runbook (`bun run db:deploy` in the backstage schema package with the DEV URL) — ask the user first.
- [ ] **Step 3:** Run `db:seed.backstage-permission` then `db:seed.backstage-role-permission` against DEV — ask the user first. Confirm the carmen-backstage app id is allowed the new `clusterNote.*` api names (or `allow_all` is on) — an AppIdGuard rejection is a 401 and logs the user out.
- [ ] **Step 4:** curl matrix (user logs in each persona; Claude cannot type passwords). Expected results:
  - Backstage Admin: create note with a PDF → 201; list → 1; files → 1; `/url` → signed URL; PATCH with stale `doc_version` → 409; delete → ok; PATCH deleted → rejected; list `deleted=true` → 1; restore → ok; history → create/update/delete/update rows with message diffs.
  - Membership cluster admin of that cluster (no backstage role): every route above → 403.
  - Platform-wide `activity_log.read`+`.detail` without `cluster_note.view`: `activity-logs/record/<noteId>` and `activity-logs/<activityId>/detail` → 404/403; cluster timeline contains no `cluster_note` rows.
  - Cluster-scoped `cluster_note.view` on cluster A: notes of cluster B → 403.
  - `/url` on cluster A with a token uploaded to cluster B → 404.
  - `GET /api-system/clusters/:id` payload contains no notes/attachment fields.

---

## Frontend — `carmen-backstage`

### Task 7: Types + service

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/services/clusterNoteService.ts` (shape of `src/services/clusterLicenseService.ts`; base `` `/api-system/clusters/${clusterId}/notes` ``)

**Interfaces:**
- Produces types: `ClusterNoteAttachment { fileName; fileToken; contentType; size?; uploaded_at; uploaded_by_id?; uploaded_by_name? }`, `ClusterNote { id; cluster_id; message: string|null; attachments: ClusterNoteAttachment[]; doc_version: number; is_edited: boolean; created_at; created_by_id?; created_by_name?; updated_at?; updated_by_name?; deleted_at?: string|null; deleted_by_name? }`, `ClusterNoteFile extends ClusterNoteAttachment { note_id }`, `ClusterNoteHistoryEntry` = the existing `ActivityLogEntry` type plus `changes?: ActivityDiff` (reuse, don't redefine). Match the `*_by_name` keys to what `@EnrichAuditUsers()` actually emits — check one swagger response.
- Produces service:
  - `list(clusterId, { page, perpage = 20, deleted = false })` → `{ data: ClusterNote[]; paginate; summary?: { deleted_count } }`
  - `files(clusterId)` → `ClusterNoteFile[]`
  - `fileUrl(clusterId, fileToken)` → `{ url; expires_at }`
  - `create(clusterId, { message, files: File[] })` → `ClusterNote` (FormData)
  - `update(clusterId, noteId, { message?, files?: File[], remove?: string[], doc_version })` → `ClusterNote` (FormData)
  - `remove(clusterId, noteId)`, `restore(clusterId, noteId)` → `{ id }`
  - `history(clusterId, noteId, { page, perpage })` → paginated `ClusterNoteHistoryEntry[]`
  Unwrap responses the way `src/services/CLAUDE.md` says.

- [ ] **Step 1:** Create branch `feature/cluster-notes` in carmen-backstage.
- [ ] **Step 2:** Add types and service. Confirm every path against `http://<backend>/swagger` (DEV once Task 6 is done; local backend before).
- [ ] **Step 3:** `bun run typecheck && bun run lint`. Commit `feat(cluster-notes): types and service`.

### Task 8: Notes tab — timeline, composer, edit, delete

**Files:**
- Modify: `src/pages/clusterEdit/clusterTabs.ts` — add `'notes'` to `ClusterTabId` and `CLUSTER_TAB_IDS`.
- Modify: `src/pages/ClusterEdit.tsx` — tab entry (only when `hasPermission('cluster_note.view', { clusterId: id })`; `count` from the list's `paginate.total`), render `{activeTab === 'notes' && <Card className="p-0"><NotesSection clusterId={id!} /></Card>}`; if the URL asks for `?tab=notes` without the permission, fall back to `licensing`.
- Create: `src/pages/clusterEdit/sections/NotesSection.tsx` (layout: `lg:grid-cols-[minmax(0,1fr)_18rem]`, files panel slot on the right, stacks above below `lg`)
- Create: `src/pages/clusterEdit/notes/{NoteComposer.tsx, NoteItem.tsx, useClusterNotes.ts}`
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts` — `pages.clusters.tabNotes` ("Notes" / "บันทึก") and a `pages.clusterNotes.*` block for all strings in Tasks 8–9.

**Interfaces:**
- `useClusterNotes(clusterId, { deleted }) → { notes, total, deletedCount, loading, loadMore(), hasMore, refetch(), replaceNote(note), dropNote(id) }` — follows the race-guard rule in `agent-os/standards/hooks/`.
- `NoteComposer` props `{ clusterId; onCreated(note) }` — textarea, file picker (multiple, `accept` = the spec's types), client-side check of 10 MB / 5 files with `toast.error`; save disabled while blank with no files; spinner on the button while saving; registers `useUnsavedChanges(text !== '' || files.length > 0)`.
- `NoteItem` props `{ note; clusterId; canManage; onChanged(note); onDeleted(id); onOpenHistory(note) }` — author + time (copy the inline `fmt` helper per CLAUDE.md DateTime), message with `whitespace-pre-wrap`, attachment chips that call `fileUrl` on click and `window.open` the result, "Edited · View history" when `is_edited`, ⋯ menu (Edit inline / Delete via `ConfirmDialog`) only when `canManage`. Edit sends `doc_version`; on 409 → `notifyVersionConflict()` then refetch that note.
- `canManage = hasPermission('cluster_note.view', …) && hasPermission('cluster_note.manage', { clusterId })`.
- Empty state: `<EmptyState>`; first load: skeleton per the Loading States table in `src/pages/CLAUDE.md`.

- [ ] **Step 1:** Tab plumbing (`clusterTabs.ts`, `ClusterEdit.tsx`).
- [ ] **Step 2:** Hook, composer, item, section.
- [ ] **Step 3:** i18n strings TH + EN.
- [ ] **Step 4:** `bun run typecheck && bun run lint && bun run test` (existing suites, e.g. `ClusterEdit.test.tsx`, must stay green — fix any that break from the new tab, without adding new test files). Commit `feat(cluster-notes): notes tab with composer, edit and delete`.

### Task 9: Files panel, deleted notes + restore, history sheet

**Files:**
- Create: `src/pages/clusterEdit/notes/{NoteFilesPanel.tsx, DeletedNotesList.tsx, NoteHistorySheet.tsx}`
- Modify: `src/pages/clusterEdit/sections/NotesSection.tsx`

**Interfaces:**
- `NoteFilesPanel` props `{ clusterId; refreshKey }` — "All files (n)" list, newest first, name + date + uploader; click → `fileUrl` → open; refetch when `refreshKey` changes (bump after create/update/delete/restore). Below `lg`: collapsible, collapsed by default, above the timeline.
- `DeletedNotesList` props `{ clusterId; canManage; deletedCount; onRestored(note) }` — toggle button "Show deleted notes (n)" under the timeline; rows show message, attachments (openable), deleted by/at, "View history", and "Restore" only when `canManage`; restored note moves back into the timeline.
- `NoteHistorySheet` props `{ clusterId; noteId; open; onOpenChange }` — calls `clusterNoteService.history`; reuse the row rendering of `src/components/activityTrail/ActivityTrailSheet.tsx` if it can take the entries as data, else a sibling component with the same look. Attachment tokens in old versions open via `fileUrl`.

- [ ] **Step 1:** Implement the three components and wire them into `NotesSection`.
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun run test`. Commit `feat(cluster-notes): files panel, deleted notes with restore, note history`.

### Task 10: Browser verification + PR

- [ ] **Step 1:** Dev server against DEV (`bun run dev:dev`, port 3304). As Backstage Admin on `/clusters/:id/edit?tab=notes`: create with 2 files; files panel shows both; edit + remove one file → panel drops it, history shows old text and the removed file still opens; delete → gone from timeline and panel, appears under "Show deleted notes"; restore → back with files; two tabs editing the same note → second gets the conflict toast.
- [ ] **Step 2:** Same page at 390px (iframe probe per memory `reference_iframe_viewport_probe`) and TH/EN.
- [ ] **Step 3:** As a membership cluster admin: no Notes tab on `/cluster-admin/...`, and `/clusters/:id/edit?tab=notes` falls back to Licensing.
- [ ] **Step 4:** Push `feature/cluster-notes`, open PR to `main` (FE merges **after** the backend is live on DEV). Production (`git push origin main:vercel`) only when the user asks.
