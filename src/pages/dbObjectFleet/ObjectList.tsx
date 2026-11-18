import { Search } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { useI18n } from '../../hooks/useI18n';
import type { DbObjectKind } from '../../types';
import type { FleetRow } from './fleetMatrix';

interface ObjectListProps {
  rows: FleetRow[];
  /** How many BUs were scanned successfully — the denominator of "in x / n BUs". */
  scannedBus: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: 'all' | DbObjectKind;
  onTypeFilterChange: (value: 'all' | DbObjectKind) => void;
}

const TYPES = ['all', 'view', 'function', 'procedure'] as const;

/** The object column: search, kind filter and one row per object with its fleet status. */
export function ObjectList({
  rows,
  scannedBus,
  selectedKey,
  onSelect,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: ObjectListProps) {
  const { t } = useI18n();
  const typeLabel = (k: (typeof TYPES)[number]) =>
    k === 'all'
      ? t('pages.dbObjectFleet.typeAll')
      : k === 'view'
        ? t('pages.dbObjectFleet.typeView')
        : k === 'function'
          ? t('pages.dbObjectFleet.typeFunction')
          : t('pages.dbObjectFleet.typeProcedure');

  return (
    <div className="flex max-h-[24rem] min-h-0 flex-col overflow-hidden rounded-lg border lg:max-h-[calc(100dvh-16rem)]">
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('pages.dbObjectFleet.searchPlaceholder')}
            aria-label={t('pages.dbObjectFleet.searchPlaceholder')}
            className="h-9 pl-8 font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('pages.dbObjectFleet.typeFilterAria')}>
          {TYPES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onTypeFilterChange(k)}
              aria-pressed={typeFilter === k}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs transition-colors',
                typeFilter === k ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
              )}
            >
              {typeLabel(k)}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">{t('pages.dbObjectFleet.noObjects')}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-auto" aria-label={t('pages.dbObjectFleet.objectsAria')}>
          {rows.map((row) => {
            const present = scannedBus - row.missing.length;
            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onSelect(row.key)}
                  aria-current={selectedKey === row.key ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                    selectedKey === row.key ? 'bg-muted' : 'hover:bg-muted/50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs" title={row.name}>
                      {row.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {typeLabel(row.type)}
                      {row.identity_args ? ` (${row.identity_args})` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {!row.isMissing && !row.isDiffering && (
                      <Badge variant="success">{t('pages.dbObjectFleet.statusSame')}</Badge>
                    )}
                    {row.isMissing && (
                      <Badge variant="warning">
                        {t('pages.dbObjectFleet.statusMissing', { count: row.missing.length })}
                      </Badge>
                    )}
                    {row.isDiffering && (
                      <Badge variant="info">
                        {t('pages.dbObjectFleet.statusDiffers', { count: row.variants.length })}
                      </Badge>
                    )}
                    <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                      {present}/{scannedBus}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
