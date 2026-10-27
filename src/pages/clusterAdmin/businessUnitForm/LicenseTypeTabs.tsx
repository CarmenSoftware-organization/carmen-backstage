import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { TabStrip, type TabStripItem } from '../../../components/TabStrip';
import { useI18n } from '../../../hooks/useI18n';

export type LicenseTypeId = 'seats' | 'modules' | 'interface';

const LICENSE_TYPE_IDS: LicenseTypeId[] = ['seats', 'modules', 'interface'];

/** id เก่าก่อนเปลี่ยนชื่อ feature group → module — ลิงก์ `?license=features` ที่ส่งออกไปแล้วต้องยังเปิดแท็บเดิม */
const LEGACY_LICENSE_TYPE_IDS: Record<string, LicenseTypeId> = { features: 'modules' };

/** อ่าน `?license=` — แปลง id เก่าก่อน ค่าที่ไม่รู้จักหรือไม่มีคืน 'seats' (แท็บแรก) */
const parseLicenseType = (raw: string | null): LicenseTypeId => {
  const v = (raw && LEGACY_LICENSE_TYPE_IDS[raw]) || raw;
  return v && (LICENSE_TYPE_IDS as string[]).includes(v) ? (v as LicenseTypeId) : 'seats';
};

interface LicenseTypeTabsProps {
  /** undefined = ยังโหลดไม่เสร็จ แท็บไม่วาดตัวเลข */
  seatsCount?: number;
  modulesCount?: number;
  interfaceCount?: number;
  seats: ReactNode;
  modules: ReactNode;
  interface: ReactNode;
  /** route ไลเซนส์ของ shell เอง (cluster admin เข้า `/licenses/*` ไม่ได้) — ปุ่มเดียวแทนปุ่มในทุกการ์ด */
  manageHref: string;
}

/**
 * แท็บย่อยในแท็บ Licenses ของ BU — หนึ่งแท็บต่อหนึ่งประเภทไลเซนส์ที่ BU ถือ: ใบที่นั่ง, สัญญา
 * (กลุ่ม feature) และใบสิทธิ์ interface · โควตาจำนวน BU (`ClusterLicense`) เป็นของ cluster ไม่อยู่ที่นี่
 *
 * จำแท็บไว้ใน `?license=` (ไม่ใช่ state) เพื่อให้ลิงก์ส่งต่อได้ และ reload แล้วกลับมาที่เดิม ·
 * แท็บแรกไม่เขียนลง URL ให้ `?tab=licenses` เปล่า ๆ ยังเป็น URL หลัก — ลิงก์เดิมที่ชี้มาไม่เปลี่ยนความหมาย ·
 * panel ใช้ `hidden` ไม่ unmount: ทุกการ์ดเป็นแค่การแสดงผลของ ledger ที่หน้าแม่โหลดไว้แล้ว
 */
export function LicenseTypeTabs({ seatsCount, modulesCount, interfaceCount, seats, modules, interface: iface, manageHref }: LicenseTypeTabsProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = parseLicenseType(searchParams.get('license'));

  const tabs: TabStripItem<LicenseTypeId>[] = [
    { id: 'seats', label: t('pages.clusterAdmin.licenseTypeSeats'), count: seatsCount },
    { id: 'modules', label: t('pages.clusterAdmin.licenseTypeFeatures'), count: modulesCount },
    { id: 'interface', label: t('pages.clusterAdmin.licenseTypeInterface'), count: interfaceCount },
  ];

  const handleChange = (next: LicenseTypeId) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'seats') params.delete('license');
    else params.set('license', next);
    // replace เหตุผลเดียวกับแท็บหลัก: สลับแท็บไม่ใช่ก้าวการนำทาง
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <TabStrip tabs={tabs} value={active} onChange={handleChange} ariaLabel={t('pages.clusterAdmin.licenseTypesLabel')} />
        </div>
        {/* ใต้ sm เหลือแค่ไอคอน — สามแท็บพร้อมตัวเลขกินที่ ~300px ของ 390px แล้ว */}
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={manageHref} aria-label={t('common.action.manageLicences')}>
            <ArrowUpRight className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('common.action.manageLicences')}</span>
          </Link>
        </Button>
      </div>
      <div hidden={active !== 'seats'}>{seats}</div>
      <div hidden={active !== 'modules'}>{modules}</div>
      <div hidden={active !== 'interface'}>{iface}</div>
    </div>
  );
}
