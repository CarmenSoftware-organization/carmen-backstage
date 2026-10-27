import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabStrip, type TabStripItem } from '../../../components/TabStrip';
import { useI18n } from '../../../hooks/useI18n';

export type LicenseTypeId = 'seats' | 'features' | 'interface';

const LICENSE_TYPE_IDS: LicenseTypeId[] = ['seats', 'features', 'interface'];

/** อ่าน `?license=` — ค่าที่ไม่รู้จักหรือไม่มีคืน 'seats' (แท็บแรก) */
const parseLicenseType = (v: string | null): LicenseTypeId =>
  v && (LICENSE_TYPE_IDS as string[]).includes(v) ? (v as LicenseTypeId) : 'seats';

interface LicenseTypeTabsProps {
  seatsCount: number;
  featuresCount: number;
  interfaceCount: number;
  seats: ReactNode;
  features: ReactNode;
  interface: ReactNode;
}

/**
 * แท็บย่อยในแท็บ Licenses ของ BU — หนึ่งแท็บต่อหนึ่งประเภทไลเซนส์ที่ BU ถือ: ใบที่นั่ง, สัญญา
 * (กลุ่ม feature) และใบสิทธิ์ interface · โควตาจำนวน BU (`ClusterLicense`) เป็นของ cluster ไม่อยู่ที่นี่
 *
 * จำแท็บไว้ใน `?license=` (ไม่ใช่ state) เพื่อให้ลิงก์ส่งต่อได้ และ reload แล้วกลับมาที่เดิม ·
 * แท็บแรกไม่เขียนลง URL ให้ `?tab=licenses` เปล่า ๆ ยังเป็น URL หลัก — ลิงก์เดิมที่ชี้มาไม่เปลี่ยนความหมาย ·
 * panel ใช้ `hidden` ไม่ unmount: ทุกการ์ดเป็นแค่การแสดงผลของ ledger ที่หน้าแม่โหลดไว้แล้ว
 */
export function LicenseTypeTabs({ seatsCount, featuresCount, interfaceCount, seats, features, interface: iface }: LicenseTypeTabsProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = parseLicenseType(searchParams.get('license'));

  const tabs: TabStripItem<LicenseTypeId>[] = [
    { id: 'seats', label: t('pages.clusterAdmin.licenseTypeSeats'), count: seatsCount },
    { id: 'features', label: t('pages.clusterAdmin.licenseTypeFeatures'), count: featuresCount },
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
      <TabStrip tabs={tabs} value={active} onChange={handleChange} ariaLabel={t('pages.clusterAdmin.licenseTypesLabel')} />
      <div hidden={active !== 'seats'}>{seats}</div>
      <div hidden={active !== 'features'}>{features}</div>
      <div hidden={active !== 'interface'}>{iface}</div>
    </div>
  );
}
