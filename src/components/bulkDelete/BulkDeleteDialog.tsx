import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useI18n } from '../../hooks/useI18n';

export interface BulkDeleteRow {
  id: string;
  label: string;
  /** Secondary identifier shown muted beside the label (e.g. the code). */
  sub?: string;
}

export interface BulkSkippedRow extends BulkDeleteRow {
  /** Already-translated reason the row is not sent. */
  reason: string;
}

export interface BulkDeletePlan {
  deletable: BulkDeleteRow[];
  skipped: BulkSkippedRow[];
}

interface Props {
  open: boolean;
  plan: BulkDeletePlan;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

/**
 * กล่องยืนยันการลบหลายแถว — หน้าแบ่ง "ลบได้" กับ "ข้าม" มาให้ก่อน (ด้วยกฎเดียวกับการลบทีละแถว)
 * ผู้ใช้จึงเห็นตั้งแต่ก่อนกดว่าอะไรจะไม่ถูกลบและเพราะอะไร ไม่ใช่ไปเจอเป็น toast ล้มทีหลัง
 * ConfirmDialog รับ description เป็น string อย่างเดียว และห้ามแก้ components/ui/ จึงแยกเป็นตัวนี้
 */
export const BulkDeleteDialog: React.FC<Props> = ({ open, plan, title, description, onOpenChange, onConfirm }) => {
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {deletable.length > 0 ? description : t('common.bulk.nothingDeletable')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
          {deletable.length > 0 && (
            <ul className="space-y-1 rounded-md border bg-muted/30 p-2" aria-label={t('common.bulk.willDelete')}>
              {deletable.map((r) => (
                <li key={r.id} className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{r.label}</span>
                  {r.sub && r.sub !== r.label && <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.sub}</span>}
                </li>
              ))}
            </ul>
          )}
          {skipped.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t('common.bulk.skipped', { count: skipped.length })}
              </p>
              <ul className="space-y-1 rounded-md border border-dashed p-2">
                {skipped.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{r.label}</span>
                    <span className="shrink-0 text-xs">{r.reason}</span>
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
            {busy ? t('common.busy.deleting') : t('common.bulk.confirm', { count: deletable.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
