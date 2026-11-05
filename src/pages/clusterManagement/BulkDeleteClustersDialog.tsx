import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../hooks/useI18n';
import type { Cluster } from '../../types';

export type BulkSkipReason = 'hasBus' | 'alreadyDeleted';

export interface BulkDeletePlan {
  deletable: Cluster[];
  skipped: { cluster: Cluster; reason: BulkSkipReason }[];
}

/**
 * แบ่งรายการที่เลือกเป็น "ลบได้" กับ "ข้าม" ด้วยกฎเดียวกับการลบทีละแถว
 * (cluster ที่ยังมี BU ลบไม่ได้ เพราะ backend ไม่ cascade) — ตัดสินก่อนยิง
 * เพื่อให้ผู้ใช้เห็นในกล่องยืนยันเลย ไม่ใช่ไปเจอเป็น toast ล้มทีหลัง
 */
export const planBulkDelete = (selected: Cluster[]): BulkDeletePlan => {
  const plan: BulkDeletePlan = { deletable: [], skipped: [] };
  for (const c of selected) {
    if (c.deleted_at) plan.skipped.push({ cluster: c, reason: 'alreadyDeleted' });
    else if ((c.bu_count ?? 0) > 0) plan.skipped.push({ cluster: c, reason: 'hasBus' });
    else plan.deletable.push(c);
  }
  return plan;
};

interface Props {
  open: boolean;
  plan: BulkDeletePlan;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

const label = (c: Cluster) => c.name || c.code || c.id;

export const BulkDeleteClustersDialog: React.FC<Props> = ({ open, plan, onOpenChange, onConfirm }) => {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const { deletable, skipped } = plan;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.clusters.bulkDeleteTitle', { count: deletable.length })}</DialogTitle>
          <DialogDescription>
            {deletable.length > 0 ? t('pages.clusters.bulkDeleteDescription') : t('pages.clusters.bulkNothingDeletable')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
          {deletable.length > 0 && (
            <ul className="space-y-1 rounded-md border bg-muted/30 p-2" aria-label={t('pages.clusters.bulkWillDelete')}>
              {deletable.map((c) => (
                <li key={c.id} className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{label(c)}</span>
                  {c.name && c.code && <span className="shrink-0 font-mono text-xs text-muted-foreground">{c.code}</span>}
                </li>
              ))}
            </ul>
          )}
          {skipped.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t('pages.clusters.bulkSkipped', { count: skipped.length })}
              </p>
              <ul className="space-y-1 rounded-md border border-dashed p-2">
                {skipped.map(({ cluster, reason }) => (
                  <li key={cluster.id} className="flex items-baseline justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{label(cluster)}</span>
                    <span className="shrink-0 text-xs">
                      {reason === 'hasBus'
                        ? t('pages.clusters.bulkSkipHasBus', { count: cluster.bu_count ?? 0 })
                        : t('pages.clusters.bulkSkipDeleted')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={busy || deletable.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {busy ? t('common.busy.deleting') : t('pages.clusters.bulkDeleteConfirm', { count: deletable.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
