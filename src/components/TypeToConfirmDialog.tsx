import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useI18n } from '../hooks/useI18n';

interface TypeToConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** ค่าที่ผู้ใช้ต้องพิมพ์ให้ตรงทุกตัวอักษร (ไม่ trim, ไม่สนใจ/ไม่แปลงตัวพิมพ์) */
  confirmValue: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  /** ข้อความนำเหนือช่องพิมพ์ (เช่น "พิมพ์เลขใบเพื่อยืนยัน") — ไม่ใส่ก็แสดงแค่ค่าที่ต้องพิมพ์ */
  inputLabel?: string;
}

/**
 * Dialog ลบถาวรแบบพิมพ์ยืนยัน — ปุ่มยืนยัน disabled จนกว่าช่องพิมพ์จะ `=== confirmValue`
 * ปิดไม่ได้ระหว่าง busy และล้างค่าที่พิมพ์ทุกครั้งที่ปิด (markup ล้อ hard-delete dialog ของ UserManagement)
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmValue,
  confirmLabel,
  busy,
  onConfirm,
  inputLabel,
}: TypeToConfirmDialogProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && busy) return; onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="font-mono text-sm font-medium">{confirmValue}</div>
          </div>
          <div className="space-y-2">
            {inputLabel && <Label htmlFor="typeToConfirmInput">{inputLabel}</Label>}
            <Input
              id="typeToConfirmInput"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmValue}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={busy || typed !== confirmValue}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
