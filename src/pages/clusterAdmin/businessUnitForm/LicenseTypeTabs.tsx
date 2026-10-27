import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabStrip, type TabStripItem } from '../../../components/TabStrip';
import { useI18n } from '../../../hooks/useI18n';

export type LicenseTypeId = 'user' | 'interface';

const LICENSE_TYPE_IDS: LicenseTypeId[] = ['user', 'interface'];

/** อ่าน `?license=` — ค่าที่ไม่รู้จักหรือไม่มีคืน 'user' (แท็บแรก) */
const parseLicenseType = (v: string | null): LicenseTypeId =>
  v && (LICENSE_TYPE_IDS as string[]).includes(v) ? (v as LicenseTypeId) : 'user';

interface LicenseTypeTabsProps {
  userCount: number;
  interfaceCount: number;
  user: ReactNode;
  interface: ReactNode;
}

/**
 * แท็บย่อยในแท็บ Licenses ของ BU — หนึ่งแท็บต่อหนึ่งประเภทไลเซนส์ แทนการวางสองการ์ดซ้อนกัน
 *
 * จำแท็บไว้ใน `?license=` (ไม่ใช่ state) เพื่อให้ลิงก์ส่งต่อได้ และ reload แล้วกลับมาที่เดิม ·
 * แท็บแรกไม่เขียนลง URL ให้ `?tab=licenses` เปล่า ๆ ยังเป็น URL หลัก — ลิงก์เดิมที่ชี้มาไม่เปลี่ยนความหมาย ·
 * panel ใช้ `hidden` ไม่ unmount: ทั้งสองการ์ดเป็นแค่การแสดงผลของ ledger ที่หน้าแม่โหลดไว้แล้ว
 */
export function LicenseTypeTabs({ userCount, interfaceCount, user, interface: iface }: LicenseTypeTabsProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = parseLicenseType(searchParams.get('license'));

  const tabs: TabStripItem<LicenseTypeId>[] = [
    { id: 'user', label: t('pages.businessUnits.userLicensesTitle'), count: userCount },
    { id: 'interface', label: t('pages.businessUnits.interfaceLicensesTitle'), count: interfaceCount },
  ];

  const handleChange = (next: LicenseTypeId) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'user') params.delete('license');
    else params.set('license', next);
    // replace เหตุผลเดียวกับแท็บหลัก: สลับแท็บไม่ใช่ก้าวการนำทาง
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <TabStrip tabs={tabs} value={active} onChange={handleChange} ariaLabel={t('pages.clusterAdmin.licenseTypesLabel')} />
      <div hidden={active !== 'user'}>{user}</div>
      <div hidden={active !== 'interface'}>{iface}</div>
    </div>
  );
}
