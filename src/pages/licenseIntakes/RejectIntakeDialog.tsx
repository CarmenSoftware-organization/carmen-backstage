import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useI18n } from '../../hooks/useI18n';

export const REJECT_REASON_MAX = 500;

interface RejectIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ได้เหตุผลที่ trim แล้ว (1..500) — โยน error ได้ ผู้เรียกจัดการเอง */
  onSubmit: (reason: string) => Promise<void>;
}

/**
 * ConfirmDialog ไม่มี body slot (และห้ามแก้ ui/) จึงสร้างบน ui/dialog — เหตุผลบังคับ 1..500 ตัวอักษร
 */
const RejectIntakeDialog: React.FC<RejectIntakeDialogProps> = ({ open, onOpenChange, onSubmit }) => {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const tooLong = trimmed.length > REJECT_REASON_MAX;
  const invalid = trimmed.length === 0 || tooLong;
  const errorText = !touched
    ? ''
    : trimmed.length === 0
      ? t('pages.licenseIntakes.rejectReasonRequired')
      : tooLong
        ? t('pages.licenseIntakes.rejectReasonTooLong', { max: REJECT_REASON_MAX })
        : '';

  const handleSubmit = async () => {
    setTouched(true);
    if (invalid) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.licenseIntakes.rejectTitle')}</DialogTitle>
          <DialogDescription>{t('pages.licenseIntakes.rejectDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">{t('pages.licenseIntakes.rejectReasonLabel')}</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            rows={4}
            disabled={submitting}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            className={errorText ? 'border-destructive' : undefined}
            aria-invalid={!!errorText}
          />
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-destructive">{errorText}</span>
            <span className="text-muted-foreground">
              {trimmed.length}/{REJECT_REASON_MAX}
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleSubmit} disabled={submitting || (touched && invalid)}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('pages.licenseIntakes.rejectConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectIntakeDialog;
