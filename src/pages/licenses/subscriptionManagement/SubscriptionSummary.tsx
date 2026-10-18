import React from 'react';
import { LicenseSummaryBand, deletedCountColor, type SummaryBandItem } from '../LicenseSummaryBand';
import { useI18n } from '../../../hooks/useI18n';
import type { SubscriptionSummary as SummaryType } from '../../../types';

/** คีย์ของการ์ดที่กดแล้วกรองได้ — `deleted` ไม่อยู่ในนี้โดยตั้งใจ (ดู doc ของคอมโพเนนต์) */
export type SummaryFilterKey = 'total' | 'active' | 'expired' | 'expiring_soon';

interface SubscriptionSummaryProps {
  summary: SummaryType | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  /** ไม่ส่ง = การ์ดเป็นตัวเลขอ่านอย่างเดียวเหมือนเดิมทั้งแถบ */
  onFilter?: (key: SummaryFilterKey) => void;
  /** การ์ดที่ตรงกับตัวกรองที่เปิดอยู่ตอนนี้ */
  activeKeys?: SummaryFilterKey[];
  /** การ์ดที่กดไม่ได้ชั่วคราวเพราะตัวกรองอื่นบังอยู่ (ดู `handleStateFilter` ใน SubscriptionTable) */
  disabledKeys?: SummaryFilterKey[];
  /** ส่งมา = การ์ด "ลบแล้ว" กดเพื่อสลับมุมมองใบที่ลบได้ (LicenseCenter ส่งเฉพาะ superadmin) */
  onDeletedClick?: () => void;
  /** กำลังแสดงมุมมองใบที่ลบอยู่ — การ์ด "ลบแล้ว" ติดไฟ การ์ดกรองไม่ติด */
  deletedActive?: boolean;
}

/**
 * Summary band ของหน้ารายการสัญญา — 5 การ์ด (ทั้งหมด/ใช้งาน/หมดอายุ/ใกล้หมดอายุ/ลบแล้ว)
 * ลอกโครงจาก `broadcastManagement/BroadcastSummary.tsx` เพราะมันเป็นแถบ 5 การ์ดแบ่งด้วย
 * divider อยู่แล้วตรงกับที่ต้องการเป๊ะ (ไม่ใช้ `ApplicationRegistrySummary`/`UserDirectorySummary`
 * ซึ่งเป็นการ์ดเดี่ยวผสม bar chart/avatar faces ที่ไม่ตรงรูปที่บรีฟต้องการ)
 *
 * การ์ดสี่ใบแรกกดเพื่อกรองได้เมื่อผู้เรียกส่ง `onFilter` มา — **ได้ก็ต่อเมื่อ `summary` ที่ส่งเข้ามา
 * เป็นตัวเลขที่ไม่ผ่านตัวกรองเท่านั้น** (`subscriptionService.getSummary`) ห้ามป้อนด้วย `summary`
 * ที่ติดมากับ `getAll` เด็ดขาด เพราะตัวนั้นถูกจำกัดด้วยตัวกรองของคำขอ วัดจริงบน DEV: กรอง
 * expiring_soon แล้ว All 14→1 · Active 11→1 · Expired 3→0 · Deleted 5→0 คลิกแรกจะทำให้ทุกการ์ด
 * ที่เหลือเป็น 0 แล้วกดกลับไม่ได้เพราะกลายเป็นทางตัน (เดิมทั้งแถบจึงกดไม่ได้เลยด้วยเหตุผลนี้ ก่อนมี
 * endpoint แยก)
 *
 * "ลบแล้ว" ไม่ใช่ตัวกรอง — กดได้เฉพาะเมื่อผู้เรียกส่ง `onDeletedClick` มา (superadmin ใน License
 * Center) แล้วจะสลับไปมุมมองใบที่ลบแล้วของแท็บนี้ ไม่ได้กรองตารางเดิม (backend list ใบที่ลบให้
 * superadmin ได้แล้วผ่าน `listDeleted`) ผู้ใช้อื่นยังเห็นเป็นตัวเลขอ่านอย่างเดียว
 */
export const SubscriptionSummary: React.FC<SubscriptionSummaryProps> = ({
  summary, loading, error, onRetry, onFilter, activeKeys = [], disabledKeys = [],
  onDeletedClick, deletedActive = false,
}) => {
  const { t } = useI18n();

  const filterItem = (key: SummaryFilterKey, label: string, value: number | undefined, color: string): SummaryBandItem => ({
    key,
    label,
    value,
    color,
    onClick: onFilter ? () => onFilter(key) : undefined,
    // ระหว่างดูใบที่ลบ การ์ดกรองไม่ติดไฟ — ตารางที่มันกรองไม่ได้แสดงอยู่
    active: !deletedActive && activeKeys.includes(key),
    disabled: disabledKeys.includes(key),
    disabledHint: t('pages.subscriptions.clearExpiringSoonFirst'),
  });

  const items: SummaryBandItem[] = [
    filterItem('total', t('common.option.all'), summary?.total, 'text-foreground'),
    filterItem('active', t('common.status.active'), summary?.active, 'text-success'),
    filterItem('expired', t('common.status.expired'), summary?.expired, 'text-muted-foreground'),
    filterItem('expiring_soon', t('common.state.expiringSoon'), summary?.expiring_soon, 'text-warning'),
    {
      key: 'deleted',
      label: t('common.status.deleted'),
      value: summary?.deleted,
      color: deletedCountColor(summary?.deleted),
      onClick: onDeletedClick,
      active: deletedActive,
      variant: 'view',
    },
  ];

  return <LicenseSummaryBand items={items} loading={loading} error={error} onRetry={onRetry} />;
};
