import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import Can from '../../components/Can';
import customerService from '../../services/customerService';
import { fetchAllBusinessUnits } from '../../utils/fetchAllBusinessUnits';
import { devLog, parseApiError, isNotFoundError } from '../../utils/errorParser';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import { customerErrorKind, linkedElsewhereCustomer } from './customerErrors';
import type { BusinessUnit, CustomerBusinessUnit } from '../../types';

interface Props {
  customerId: string;
  businessUnits: CustomerBusinessUnit[];
  /** ลิงก์/ยกเลิกสำเร็จแล้ว — ผู้เรียก refetch ลูกค้า (รายชื่อ BU มาจาก GET :id) */
  onChanged: () => void;
}

/**
 * BU ที่ผูกกับลูกค้า + ตัวผูก/ยกเลิกผูก — ไม่อยู่ใน form: แต่ละปุ่มเป็นคำขอของตัวเอง
 * (PUT/DELETE `:id/business-units/:buId`) ไม่ผ่าน Save ของฟอร์มและไม่แตะ doc_version ของลูกค้า
 */
export default function CustomerBusinessUnitsCard({ customerId, businessUnits, onChanged }: Props) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  // รายการ BU ใช้แค่ตัวผูก ซึ่งอยู่ใน <Can customer.manage> — ผู้ที่ไม่มีสิทธิ์ไม่ต้องโหลด
  const canLink = hasPermission('customer.manage');
  const [allBus, setAllBus] = useState<BusinessUnit[]>([]);
  const [busLoading, setBusLoading] = useState(true);
  const [busFailed, setBusFailed] = useState(false);
  const [selected, setSelected] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<CustomerBusinessUnit | null>(null);

  useEffect(() => {
    if (!canLink) {
      setBusLoading(false);
      return;
    }
    let active = true;
    fetchAllBusinessUnits({ label: 'CustomerBusinessUnitsCard' })
      .then((list) => { if (active) setAllBus(list); })
      .catch((err) => { devLog('Failed to load business units for customer link:', err); if (active) setBusFailed(true); })
      .finally(() => { if (active) setBusLoading(false); });
    return () => { active = false; };
  }, [canLink]);

  const linkedIds = useMemo(() => new Set(businessUnits.map((b) => b.id)), [businessUnits]);
  const options = useMemo(
    () => [...allBus].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [allBus],
  );
  const availableCount = options.filter((bu) => !linkedIds.has(bu.id) && !(bu.customer && bu.customer.id !== customerId)).length;

  const handleLink = async () => {
    const bu = allBus.find((b) => b.id === selected);
    if (!bu) return;
    setLinking(true);
    try {
      await customerService.linkBusinessUnit(customerId, bu.id);
      toast.success(t('pages.customers.linkedToast', { name: bu.name }));
      setSelected('');
      // BU ที่เพิ่งผูกมี `customer` ใหม่ — ดึงรายการ BU สดเพื่อให้ตัวเลือกไม่เก่า
      fetchAllBusinessUnits({ label: 'CustomerBusinessUnitsCard' }).then(setAllBus).catch((e) => devLog('refresh bus', e));
      onChanged();
    } catch (err) {
      if (customerErrorKind(err) === 'linked_elsewhere') {
        const other = linkedElsewhereCustomer(err);
        toast.error(other
          ? t('pages.customers.linkedElsewhere', { customer: other })
          : t('pages.customers.linkedElsewhereGeneric'));
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
      fetchAllBusinessUnits({ label: 'CustomerBusinessUnitsCard' }).then(setAllBus).catch((e) => devLog('refresh bus', e));
      onChanged();
    } catch (err) {
      toast.error(parseApiError(err, t).message);
      devLog('unlinkBusinessUnit', err);
    }
  };

  return (
    <Card>
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
            {busFailed ? (
              <p className="text-xs text-destructive">{t('pages.customers.buLoadFailed')}</p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selected} onValueChange={setSelected} disabled={busLoading || linking}>
                  <SelectTrigger id="customer-link-bu" className="sm:max-w-md">
                    <SelectValue placeholder={t('pages.customers.linkPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((bu) => {
                      const here = linkedIds.has(bu.id);
                      const other = bu.customer && bu.customer.id !== customerId ? bu.customer : null;
                      return (
                        <SelectItem key={bu.id} value={bu.id} disabled={here || !!other}>
                          {bu.code} · {bu.name}
                          {here && ` (${t('pages.customers.linkedHere')})`}
                          {other && ` (${t('pages.customers.linkedToOther', { customer: other.ar_number })})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={handleLink} disabled={!selected || linking} className="sm:self-center">
                  {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                  {t('pages.customers.linkAction')}
                </Button>
              </div>
            )}
            {!busLoading && !busFailed && availableCount === 0 && (
              <p className="text-xs text-muted-foreground">{t('pages.customers.linkNoneAvailable')}</p>
            )}
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
