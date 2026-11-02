import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import Can from '../../components/Can';
import { BusinessUnitPicker } from '../../components/BusinessUnitPicker';
import type { BusinessUnitOption } from '../../hooks/useBusinessUnitSearch';
import customerService from '../../services/customerService';
import { devLog, parseApiError, isNotFoundError } from '../../utils/errorParser';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import { customerErrorKind, linkedElsewhereCustomer } from './customerErrors';
import type { CustomerBusinessUnit } from '../../types';

interface Props {
  customerId: string;
  businessUnits: CustomerBusinessUnit[];
  /** ลิงก์/ยกเลิกสำเร็จแล้ว — ผู้เรียก refetch ลูกค้า (รายชื่อ BU มาจาก GET :id) */
  onChanged: () => void;
}

/**
 * BU ที่ผูกกับลูกค้า + ตัวผูก/ยกเลิกผูก — ไม่อยู่ใน form: แต่ละปุ่มเป็นคำขอของตัวเอง
 * (PUT/DELETE `:id/business-units/:buId`) ไม่ผ่าน Save ของฟอร์มและไม่แตะ doc_version ของลูกค้า
 *
 * ตัวผูกเป็น `BusinessUnitPicker` (ค้นหาฝั่ง server + lazy load ทีละ 20) — ไม่ดึง BU ทั้งระบบตอนเปิดหน้า
 * BU ที่ผูกที่นี่แล้วหรือผูกกับลูกค้าอื่นยังแสดงในผลค้นหา แต่กดไม่ได้
 */
export default function CustomerBusinessUnitsCard({ customerId, businessUnits, onChanged }: Props) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  // ตัวผูกอยู่ใน <Can customer.manage> — ผู้ที่ไม่มีสิทธิ์ไม่ยิงค้นหา BU เลย
  const canLink = hasPermission('customer.manage');
  const [selected, setSelected] = useState<BusinessUnitOption | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<CustomerBusinessUnit | null>(null);
  // เพิ่มทุกครั้งที่ผูก/ยกเลิกผูก → picker ดึงผลค้นหาใหม่ ให้สถานะ "ผูกแล้ว" ในรายการไม่เก่า
  const [refreshKey, setRefreshKey] = useState(0);

  const linkedIds = useMemo(() => new Set(businessUnits.map((b) => b.id)), [businessUnits]);

  const getDisabledReason = useCallback(
    (bu: BusinessUnitOption): string | null => {
      if (linkedIds.has(bu.id)) return t('pages.customers.linkedHere');
      if (bu.customer && bu.customer.id !== customerId) {
        return t('pages.customers.linkedToOther', { customer: bu.customer.ar_number });
      }
      return null;
    },
    [linkedIds, customerId, t],
  );

  const handleLink = async () => {
    const bu = selected;
    if (!bu) return;
    setLinking(true);
    try {
      await customerService.linkBusinessUnit(customerId, bu.id);
      toast.success(t('pages.customers.linkedToast', { name: bu.name }));
      setSelected(null);
      setRefreshKey((n) => n + 1);
      onChanged();
    } catch (err) {
      if (customerErrorKind(err) === 'linked_elsewhere') {
        const other = linkedElsewhereCustomer(err);
        toast.error(other
          ? t('pages.customers.linkedElsewhere', { customer: other })
          : t('pages.customers.linkedElsewhereGeneric'));
        setSelected(null);
        setRefreshKey((n) => n + 1);
      } else if (isNotFoundError(err)) {
        toast.error(parseApiError(err, t).message);
        onChanged();
      } else {
        toast.error(parseApiError(err, t).message);
      }
      devLog('linkBusinessUnit', err);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    try {
      await customerService.unlinkBusinessUnit(customerId, unlinkTarget.id);
      toast.success(t('pages.customers.unlinkedToast', { name: unlinkTarget.name }));
      setUnlinkTarget(null);
      setRefreshKey((n) => n + 1);
      onChanged();
    } catch (err) {
      toast.error(parseApiError(err, t).message);
      devLog('unlinkBusinessUnit', err);
    }
  };

  return (
    // overflow-visible: Card มี overflow-hidden ซึ่งตัด dropdown ของ picker ที่ล้นก้นการ์ด
    <Card className="overflow-visible">
      <CardHeader className="space-y-1">
        <h3 className="text-sm font-semibold">{t('pages.customers.buTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('pages.customers.buDescription')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {businessUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('pages.customers.buEmpty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {businessUnits.map((bu) => (
              <li key={bu.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 space-y-0.5">
                  <Link to={`/business-units/${bu.id}/edit`} className="text-sm font-medium hover:underline">
                    {bu.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{bu.code}</span>
                    {bu.cluster_name && <> · {bu.cluster_name}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={bu.is_active ? 'success' : 'secondary'}>
                    {bu.is_active ? t('common.status.active') : t('common.status.inactive')}
                  </Badge>
                  <Can permission="customer.manage">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUnlinkTarget(bu)}
                      aria-label={t('pages.customers.buUnlinkAria', { name: bu.name })}
                    >
                      <Unlink className="mr-2 h-4 w-4" />
                      {t('pages.customers.buUnlink')}
                    </Button>
                  </Can>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Can permission="customer.manage">
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="customer-link-bu">{t('pages.customers.linkLabel')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="w-full sm:max-w-md">
                <BusinessUnitPicker
                  id="customer-link-bu"
                  value={selected}
                  onChange={setSelected}
                  canSearch={canLink}
                  disabled={linking}
                  placeholder={t('pages.customers.linkPlaceholder')}
                  getDisabledReason={getDisabledReason}
                  refreshKey={refreshKey}
                />
              </div>
              <Button type="button" size="sm" onClick={handleLink} disabled={!selected || linking} className="sm:mt-0.5">
                {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                {t('pages.customers.linkAction')}
              </Button>
            </div>
          </div>
        </Can>
      </CardContent>

      <ConfirmDialog
        open={unlinkTarget !== null}
        onOpenChange={(open) => { if (!open) setUnlinkTarget(null); }}
        title={t('pages.customers.unlinkTitle')}
        description={t('pages.customers.unlinkDescription', { name: unlinkTarget?.name ?? '' })}
        confirmText={t('pages.customers.buUnlink')}
        confirmVariant="destructive"
        onConfirm={handleUnlink}
      />
    </Card>
  );
}
