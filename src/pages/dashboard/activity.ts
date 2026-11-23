import { Network, Building2, Users, AppWindow, Newspaper, FileText, type LucideIcon } from 'lucide-react';
import clusterService from '../../services/clusterService';
import businessUnitService from '../../services/businessUnitService';
import userService from '../../services/userService';
import applicationService from '../../services/applicationService';
import newsService from '../../services/newsService';
import reportTemplateService from '../../services/reportTemplateService';
import type { ApiListResponse, Audit, PaginateParams } from '../../types';
import { normalizeAudit } from '../../utils/audit';
import { formatClock } from '../../utils/relativeTime';
import type { TKey } from '../../i18n/types';

export type ActivityVerb = 'created' | 'updated' | 'published';

export interface ActivityItem {
  id: string;
  domainKey: string;
  /** คีย์แปลของชื่อหมวด — เก็บคีย์ ไม่ใช่ข้อความ เพราะโมดูลนี้บริสุทธิ์ เรียก hook ไม่ได้ */
  domainLabelKey: TKey;
  icon: LucideIcon;
  verb: ActivityVerb;
  name: string;
  /** ใช้เมื่อ `name` ว่าง — ข้อความสำรองต่างกันตามหมวด ('ไม่มีชื่อ' / 'ไม่มีหัวข้อ' / 'ไม่ทราบผู้ใช้') */
  nameFallbackKey?: TKey;
  code?: string;
  who?: string;
  at: string; // ISO timestamp used for ordering + grouping
  href: string;
}

// The subset of fields the activity stream reads off a list record, tolerating
// both the flat (`updated_at` / `updated_by_name`) and nested (`audit.updated`)
// shapes the backends return.
interface RawRecord {
  id?: string;
  name?: string;
  title?: string;
  email?: string;
  code?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  updated_by_name?: string;
  audit?: Audit;
}

interface ActivitySource {
  key: string;
  labelKey: TKey;
  icon: LucideIcon;
  path: string; // e.g. '/clusters' → row links to '/clusters/:id/edit'
  service: { getAll: (p: PaginateParams) => Promise<ApiListResponse<RawRecord>> };
  /** คืน '' เมื่อไม่มีชื่อ แล้วให้ชั้น render เติม `nameFallbackKey` แทน — โมดูลนี้แปลเองไม่ได้ */
  nameOf: (r: RawRecord) => string;
  nameFallbackKey: TKey;
  codeOf?: (r: RawRecord) => string | undefined;
}

// Order matches the sidebar / Landing index.
export const ACTIVITY_SOURCES: ActivitySource[] = [
  { key: 'clusters', labelKey: 'nav.clusters', icon: Network, path: '/clusters', service: clusterService,
    nameOf: (r) => r.name || '', nameFallbackKey: 'pages.dashboard.unnamed', codeOf: (r) => r.code },
  { key: 'business-units', labelKey: 'nav.businessUnits', icon: Building2, path: '/business-units', service: businessUnitService,
    nameOf: (r) => r.name || '', nameFallbackKey: 'pages.dashboard.unnamed', codeOf: (r) => r.code },
  { key: 'users', labelKey: 'nav.users', icon: Users, path: '/users', service: userService,
    nameOf: (r) => r.name || r.email || '', nameFallbackKey: 'pages.dashboard.unknownUser' },
  { key: 'applications', labelKey: 'nav.applications', icon: AppWindow, path: '/applications', service: applicationService,
    nameOf: (r) => r.name || '', nameFallbackKey: 'pages.dashboard.unnamed' },
  { key: 'news', labelKey: 'nav.news', icon: Newspaper, path: '/news', service: newsService,
    nameOf: (r) => r.title || '', nameFallbackKey: 'pages.dashboard.untitled' },
  { key: 'report-templates', labelKey: 'nav.reportTemplates', icon: FileText, path: '/report-templates', service: reportTemplateService,
    nameOf: (r) => r.name || '', nameFallbackKey: 'pages.dashboard.unnamed' },
];

const ts = (v?: string) => (v ? Date.parse(v) : NaN);

// The list endpoints wrap their payload at varying envelope depth — a bare array,
// `{ data: [] }`, or `{ data: { data: [], paginate } }`. Every Management page
// unwraps defensively (see CLAUDE.md · Service Layer); do the same here so a
// nested-envelope domain doesn't break the merge.

/** Walk down `.data` until the record array is reached; [] if none is found. */
export function unwrapList(res: unknown): RawRecord[] {
  let node: unknown = res;
  for (let i = 0; i < 5 && node && typeof node === 'object' && !Array.isArray(node); i++) {
    node = (node as { data?: unknown }).data;
  }
  return Array.isArray(node) ? (node as RawRecord[]) : [];
}

/** Find `paginate.total` (or `total`) at any envelope depth; 0 if absent. */
export function unwrapTotal(res: unknown): number {
  let node: unknown = res;
  for (let i = 0; i < 5 && node && typeof node === 'object' && !Array.isArray(node); i++) {
    const n = node as { paginate?: { total?: number }; total?: number };
    if (typeof n.paginate?.total === 'number') return n.paginate.total;
    if (typeof n.total === 'number') return n.total;
    node = (node as { data?: unknown }).data;
  }
  return 0;
}

/** Best-available "when" for a record: updated, else created, flat or nested. */
export function extractAt(r: RawRecord): string | undefined {
  const a = normalizeAudit(r);
  return a.updated?.at ?? a.created?.at ?? undefined;
}
function extractCreated(r: RawRecord): string | undefined {
  return normalizeAudit(r).created?.at ?? undefined;
}
function extractWho(r: RawRecord): string | undefined {
  return normalizeAudit(r).updated?.name;
}

/** created vs updated from timestamp equality; News in published status reads as published. */
export function deriveVerb(sourceKey: string, r: RawRecord): ActivityVerb {
  if (sourceKey === 'news' && r.status === 'published') return 'published';
  const created = extractCreated(r);
  const at = extractAt(r);
  if (created && at && ts(created) === ts(at)) return 'created';
  return 'updated';
}

/** Map a raw list record to an ActivityItem, or null when it can't be placed/linked. */
export function toActivityItem(source: ActivitySource, r: RawRecord): ActivityItem | null {
  const at = extractAt(r);
  if (!r.id || !at) return null;
  return {
    id: r.id,
    domainKey: source.key,
    domainLabelKey: source.labelKey,
    icon: source.icon,
    verb: deriveVerb(source.key, r),
    name: source.nameOf(r),
    nameFallbackKey: source.nameFallbackKey,
    code: source.codeOf?.(r),
    who: extractWho(r),
    at,
    href: `${source.path}/${r.id}/edit`,
  };
}

/** Newest-first, capped. */
export function mergeAndSort(items: ActivityItem[], cap = 15): ActivityItem[] {
  return [...items].sort((a, b) => ts(b.at) - ts(a.at)).slice(0, cap);
}

export interface ActivityResult {
  items: ActivityItem[];
  /** Source keys whose fetch failed. The stream is missing their rows, so the UI must say so. */
  failedDomains: string[];
}

/**
 * Fetch recent activity across every domain and merge into one stream. Each
 * domain is fetched independently; a failing domain is reported in
 * `failedDomains` rather than silently dropped, so a partial stream never
 * passes for a complete one. When every domain fails there is no stream at
 * all, so the first error is rethrown and the caller shows its error state.
 *
 * Ordering is guaranteed client-side by `mergeAndSort`, so the stream is always
 * correctly ordered even if a backend ignores `sort=updated_at:desc` — at worst
 * it means the per-domain page we pulled isn't the very newest slice.
 */
export async function fetchActivity(perDomain = 8, cap = 15): Promise<ActivityResult> {
  const results = await Promise.allSettled(
    ACTIVITY_SOURCES.map((source) =>
      source.service
        .getAll({
          page: 1,
          perpage: perDomain,
          sort: 'updated_at:desc',
          advance: JSON.stringify({ where: { deleted_at: null } }),
        })
        .then((res) => ({ source, data: unwrapList(res) })),
    ),
  );

  const items: ActivityItem[] = [];
  const failedDomains: string[] = [];
  let firstError: unknown;
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      failedDomains.push(ACTIVITY_SOURCES[i].key);
      firstError ??= result.reason;
      return;
    }
    for (const raw of result.value.data) {
      const item = toActivityItem(result.value.source, raw);
      if (item) items.push(item);
    }
  });
  if (failedDomains.length === ACTIVITY_SOURCES.length) throw firstError;
  return { items: mergeAndSort(items, cap), failedDomains };
}

/** Rows this long or longer, from one actor doing one thing in one domain in one minute, fold. */
const RUN_MIN = 3;

export type ActivityEntry = { kind: 'one'; item: ActivityItem } | { kind: 'run'; key: string; items: ActivityItem[] };

/**
 * Folds bulk runs: consecutive rows with the same domain, verb, actor and clock minute. A
 * batch job (a seed, a template re-save) is one event to an operator, but as separate rows it
 * filled the first screen and pushed the one different change out of view. Pairs stay apart
 * because two rows are not a flood, and folding them would only hide them.
 */
export function foldRuns(items: ActivityItem[]): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  let i = 0;
  while (i < items.length) {
    const head = items[i];
    const sig = `${head.domainKey}|${head.verb}|${head.who ?? ''}|${formatClock(head.at)}|${head.at.slice(0, 10)}`;
    let j = i + 1;
    while (
      j < items.length &&
      `${items[j].domainKey}|${items[j].verb}|${items[j].who ?? ''}|${formatClock(items[j].at)}|${items[j].at.slice(0, 10)}` === sig
    )
      j++;
    if (j - i >= RUN_MIN) out.push({ kind: 'run', key: `${head.domainKey}:${head.id}`, items: items.slice(i, j) });
    else for (let k = i; k < j; k++) out.push({ kind: 'one', item: items[k] });
    i = j;
  }
  return out;
}
