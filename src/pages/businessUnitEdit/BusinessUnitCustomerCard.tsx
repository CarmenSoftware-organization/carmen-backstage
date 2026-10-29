import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { CustomerPicker } from '../../components/CustomerPicker';
import customerService from '../../services/customerService';
import { customerErrorKind, linkedElsewhereCustomer } from '../customerEdit/customerErrors';
import { devLog, parseApiError } from '../../utils/errorParser';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import type { BusinessUnit, CustomerOption } from '../../types';

type LinkedCustomer = NonNullable<BusinessUnit['customer']>;

interface Props {
  buId: string;
  /** `null` = ไม่มีลูกค้า · ผู้เรียกต้องไม่เรนเดอร์การ์ดนี้เมื่อ `undefined` (ผู้เรียกมองไม่เห็นฟิลด์) */
  customer: LinkedCustomer | null;
  /** ผูก/ยกเลิกสำเร็จ — หน้าแม่ refetch BU แบบ keepForm (doc_version ของ BU ขยับ) */
  onChanged: () => void | Promise<void>;
}

const label = (c: { ar_number: string; company_name?: string | null }) =>
  c.company_name ? `${c.ar_number} · ${c.company_name}` : c.ar_number;

/**
 * ลูกค้า (AR) ของ BU — ใช้งานทันทีด้วยปุ่มของตัวเอง ไม่เข้า Save ของฟอร์ม BU
 * (PUT/DELETE /api-system/backstage/customers/:id/business-units/:buId)
 *
 * - `customer.read` → ตัวเลือก (picker) ถึงจะถูก mount; ไม่มี = ข้อความอ่านอย่างเดียว ไม่ยิงคำขอลูกค้าเลย
 *   (401 จาก AppIdGuard จะเตะผู้ใช้ออก)
 * - `customer.manage` → ปุ่ม Change / Remove
 * - ย้ายไปลูกค้ารายอื่น = unlink ตัวเก่าก่อนแล้วค่อย link ตัวใหม่ ใน handler เดียว
 */
export default function BusinessUnitCustomerCard({ buId, customer, onChanged }: Props) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canRead = hasPermission('customer.read');
  const canManage = hasPermission('customer.manage');

  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<CustomerOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const closePicker = () => {
    setPicking(false);
    setPicked(null);
  };

  const reportLinkError = (err: unknown) => {
    if (customerErrorKind(err) === 'linked_elsewhere') {
      const other = linkedElsewhereCustomer(err);
      toast.error(
        other
          ? t('pages.customers.linkedElsewhere', { customer: other })
          : t('pages.customers.linkedElsewhereGeneric'),
      );
    } else {
      toast.error(parseApiError(err, t).message);
    }
  };

  const applyLink = async (target: CustomerOption) => {
    setBusy(true);
    let unlinked = false;
    try {
      if (customer) {
        await customerService.unlinkBusinessUnit(customer.id, buId);
        unlinked = true;
      }
      await customerService.linkBusinessUnit(target.id, buId);
      toast.success(t('pages.businessUnits.customerLinkedToast', { customer: target.ar_number }));
      closePicker();
      await onChanged();
    } catch (err) {
      devLog('BusinessUnitCustomerCard link', err);
      if (unlinked) {
        // ตัวเก่าหลุดไปแล้วแต่ตัวใหม่ไม่ติด — ต้องบอกตรง ๆ และ refetch ให้การ์ดตรงกับความจริง
        toast.error(t('pages.businessUnits.customerMovePartial', { from: customer ? customer.ar_number : '' }));
        closePicker();
        await onChanged();
      } else {
        reportLinkError(err);
        // 404 (ลูกค้า/BU หายไป) → refetch เพื่อให้สถานะบนจอไม่ค้าง
        if ((err as { response?: { status?: number } })?.response?.status === 404) await onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (!picked) return;
    if (customer) {
      setMoveOpen(true);
      return;
    }
    void applyLink(picked);
  };

  const handleMoveConfirm = async () => {
    setMoveOpen(false);
    if (picked) await applyLink(picked);
  };

  const handleRemove = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      await customerService.unlinkBusinessUnit(customer.id, buId);
      toast.success(t('pages.businessUnits.customerUnlinkedToast'));
      setRemoveOpen(false);
      await onChanged();
    } catch (err) {
      devLog('BusinessUnitCustomerCard unlink', err);
      toast.error(parseApiError(err, t).message);
    } finally {
      setBusy(false);
    }
  };

  const canPick = canManage && canRead;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <h3 className="text-sm font-semibold">{t('pages.businessUnits.customerTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('pages.businessUnits.customerDescription')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {customer ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {canRead ? (
                <Link
                  to={`/customers/${encodeURIComponent(customer.id)}/edit`}
                  className="min-w-0 truncate text-sm font-medium hover:underline"
                >
                  <span className="font-mono">{customer.ar_number}</span>
                  {customer.company_name && <span> · {customer.company_name}</span>}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-sm font-medium">
                  <span className="font-mono">{customer.ar_number}</span>
                  {customer.company_name && <span> · {customer.company_name}</span>}
                </span>
              )}
              <Badge variant={customer.status === 'active' ? 'success' : 'secondary'}>
                {customer.status === 'active' ? t('common.status.active') : t('common.status.inactive')}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('pages.businessUnits.customerNone')}</p>
          )}

          {canManage && !picking && (
            <div className="flex items-center gap-2">
              {canRead && (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setPicking(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {customer ? t('pages.businessUnits.customerChange') : t('pages.businessUnits.customerAssign')}
                </Button>
              )}
              {customer && (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setRemoveOpen(true)}>
                  <Unlink className="mr-2 h-4 w-4" />
                  {t('pages.businessUnits.customerRemove')}
                </Button>
              )}
            </div>
          )}
        </div>

        {canPick && picking && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="bu-customer-picker">{t('pages.businessUnits.customerPickerLabel')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="sm:max-w-md sm:flex-1">
                <CustomerPicker id="bu-customer-picker" value={picked} onChange={setPicked} disabled={busy} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApply}
                  disabled={!picked || busy || picked.id === customer?.id}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('pages.businessUnits.customerApply')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={closePicker} disabled={busy}>
                  {t('pages.businessUnits.customerCancel')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={t('pages.businessUnits.customerMoveTitle')}
        description={t('pages.businessUnits.customerMoveDescription', {
          from: customer ? label(customer) : '',
          to: picked ? label(picked) : '',
        })}
        confirmText={t('pages.businessUnits.customerApply')}
        onConfirm={handleMoveConfirm}
      />
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t('pages.businessUnits.customerRemoveTitle')}
        description={t('pages.businessUnits.customerRemoveDescription', {
          customer: customer ? label(customer) : '',
        })}
        confirmText={t('pages.businessUnits.customerRemove')}
        confirmVariant="destructive"
        onConfirm={handleRemove}
      />
    </Card>
  );
}
