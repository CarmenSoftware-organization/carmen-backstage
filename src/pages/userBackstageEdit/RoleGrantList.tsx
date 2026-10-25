import { Button } from '../../components/ui/button';
import { ScopeRail } from '../userBackstageManagement/roleChips';
import Can from '../../components/Can';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { relativeTime } from '../../utils/relativeTime';
import type { AuditActor } from '../../utils/audit';
import type { UserRoleAssignment } from '../../types';
import { useI18n } from '../../hooks/useI18n';
import type { TFunction } from '../../i18n/types';

const fmtDateTime = (v?: string) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export interface RoleGrantListProps {
  assignments: UserRoleAssignment[];
  /** Resolves a cluster id to its display name; falls back to the id when unknown. */
  clusterName: (clusterId: string) => string;
  /**
   * Per-assignment grant provenance, keyed by assignment id. Sourced from the registry
   * endpoint, which is the only one that enriches grants with an actor — the per-user
   * roles endpoint returns none. An assignment missing from this map renders an explicit
   * "no record" line rather than a blank, so an unenriched grant never reads as an
   * unattributed one.
   */
  grantedBy: Map<string, AuditActor>;
  /** The holder being reviewed — used to flag grants they issued to themselves. */
  subjectUserId?: string;
  /** Absent while provenance has not been fetched (or the fetch failed). */
  provenanceAvailable: boolean;
  onRemove: (assignment: UserRoleAssignment) => void;
}

const scopeKey = (a: UserRoleAssignment, t: TFunction) =>
  a.scope.type === 'backstage' ? t('pages.userBackstage.scopeBackstage') : a.scope.cluster_id;

/**
 * A holder's grants, grouped by scope with the widest first — the same ordering the
 * registry's RoleChips uses, so the two surfaces never disagree on what "widest" means.
 * Each row states who issued the grant and when, because that is the question an access
 * review asks second, right after "how wide is it".
 */
export function RoleGrantList({
  assignments, clusterName, grantedBy, subjectUserId, provenanceAvailable, onRemove,
}: RoleGrantListProps) {
  const { t } = useI18n();
  const backstageLabel = t('pages.userBackstage.scopeBackstage');

  const groups = new Map<string, UserRoleAssignment[]>();
  for (const a of assignments) {
    const key = scopeKey(a, t);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  // Array.from (not a spread) avoids needing --downlevelIteration under this project's
  // es5 target. Backstage-wide leads; the rest sort by their resolved display name so the
  // order matches what the reader sees, not the underlying ids.
  const ordered = Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      label: key === backstageLabel ? backstageLabel : clusterName(key),
      backstageWide: key === backstageLabel,
      items,
    }))
    .sort((a, b) => {
      if (a.backstageWide) return -1;
      if (b.backstageWide) return 1;
      return a.label.localeCompare(b.label);
    });

  // The scope heading earns its line only when it says something the page has not already
  // said. A lone platform-wide group repeats the reach band verbatim — the same reasoning
  // that gates the registry table's scope rail on `mixedScopes`. A lone cluster group
  // still gets its heading: nothing else on the page names that cluster.
  const showHeadings = ordered.length > 1 || !ordered[0]?.backstageWide;

  return (
    <div className="space-y-4">
      {ordered.map((group) => (
        <div key={group.key} className="space-y-1.5">
          {showHeadings && (
            <div className="text-muted-foreground text-[11px] font-medium tracking-[0.1em] uppercase">
              {group.label}
            </div>
          )}
          {group.items.map((assignment) => {
            const actor = grantedBy.get(assignment.id);
            const selfGranted = !!actor?.id && actor.id === subjectUserId;
            const ago = relativeTime(actor?.at, new Date(), t);
            return (
              <div
                key={assignment.id}
                className="flex items-start justify-between gap-4 rounded-md border px-3 py-2.5"
              >
                <div className="flex min-w-0 items-stretch gap-3">
                  <ScopeRail backstageWide={group.backstageWide} />
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium">{assignment.role_name || assignment.role_id}</div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      {!provenanceAvailable ? (
                        <span>{t('pages.userBackstage.grantProvenanceUnavailable')}</span>
                      ) : actor?.at || actor?.name ? (
                        <span title={fmtDateTime(actor.at)}>
                          {t('pages.userBackstage.grantedBy', { name: actor.name || t('common.status.unknown') })}
                          {ago ? ` · ${ago}` : ''}
                        </span>
                      ) : (
                        <span>{t('pages.userBackstage.grantNoRecord')}</span>
                      )}
                      {selfGranted && (
                        <span
                          className="text-warning inline-flex items-center gap-1"
                          title={t('pages.userBackstage.selfGrantedTitle')}
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          {t('pages.userBackstage.selfGranted')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Can permission="user_backstage.manage">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7 shrink-0 px-2"
                    onClick={() => onRemove(assignment)}
                    aria-label={t('pages.userBackstage.removeRoleAria', {
                      name: assignment.role_name || t('entity.role.lower'),
                    })}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t('common.action.remove')}
                  </Button>
                </Can>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
