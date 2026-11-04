import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { BrandMark } from '../../components/BrandMark';
import { aliasConflictReason } from './aliasConflicts';
import type { TFunction } from '../../i18n/types';
import type { BuAliasConflict } from '../../types';

/** คอลัมน์ของตาราง conflicts — `linkTo` ต่างกันระหว่างหน้ารวมกับหน้า cluster admin */
export function aliasConflictColumns(
  t: TFunction,
  linkTo: (c: BuAliasConflict) => string,
): ColumnDef<BuAliasConflict, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: t('common.field.name'),
      meta: { card: 'title' },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <BrandMark name={row.original.name} code={row.original.code} alias={row.original.alias_name} />
          <div className="min-w-0">
            <Link to={linkTo(row.original)} className="block text-primary hover:underline whitespace-nowrap" title={row.original.name}>
              {row.original.name}
            </Link>
            <span className="block font-mono text-xs text-muted-foreground">{row.original.code}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'cluster_name',
      header: t('common.label.cluster'),
      meta: { cellClassName: 'max-w-44' },
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.cluster_name || undefined}>{row.original.cluster_name || '-'}</span>
      ),
    },
    {
      accessorKey: 'alias_name',
      header: t('common.field.alias'),
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.alias_name}</span>,
    },
    {
      id: 'reason',
      header: t('pages.businessUnits.aliasConflicts.reasonColumn'),
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{aliasConflictReason(row.original, t)}</span>,
    },
  ];
}
