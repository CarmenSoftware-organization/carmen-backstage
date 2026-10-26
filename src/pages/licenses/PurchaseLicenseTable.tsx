import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, FileText, Filter, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { DataTable } from '../../components/ui/data-table';
import { EmptyState } from '../../components/EmptyState';
import { SearchInput } from '../../components/SearchInput';
import { TableSkeleton } from '../../components/TableSkeleton';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '../../components/ui/sheet';
import { useGlobalShortcuts } from '../../components/KeyboardShortcuts';
import { TypeToConfirmDialog } from '../../components/TypeToConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useI18n } from '../../hooks/useI18n';
import { generateCSV, downloadCSV } from '../../utils/csvExport';
import { devLog, licenseActionErrorMessage } from '../../utils/errorParser';
import { fmtDate, isPerpetual, daysLeft } from './licenseDates';
import { useExpiryThresholds } from '../../context/ExpiryThresholdContext';
import type { ExpiryThresholdsConfig } from '../../types';
import { auditColumns } from '../../components/auditColumns';
import { normalizeAudit, auditCsvFields } from '../../utils/audit';
import { licenseStatus as buLicenseStatus } from '../../utils/buLicense';
import { licenseStatus as clusterLicenseStatus } from '../../utils/clusterLicense';
import type { LicenseKind, LicenseKindConfig } from './licenseKindConfig';
import type { SeatLicenseRow, BuQuotaLicenseRow, InterfaceLicenseRow, PaginateParams, LicenseFleetSummary } from '../../types';
import type { TKey } from '../../i18n/types';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { readStoredPerpage } from '../../utils/pageRange';
import clusterLicenseService from '../../services/clusterLicenseService';
import { LicenseSummaryBand, deletedCountColor, type SummaryBandItem } from './LicenseSummaryBand';
import { DeletedLicenseTable, type DeletedViewControl } from './DeletedLicenseTable';

type StatusFilterValue = 'active' | 'superseded' | 'capped' | 'scheduled' | 'expired' | 'cancelled';

// The complete enumeration of `StatusFilterValue` — used both for the Sheet's filter
// buttons and to type-check STATUS_VARIANT/STATUS_LABEL_KEYS below. Pure data, module scope
// is fine; the label lookup itself happens inside the component (see `statusLabel`).
// ใบที่นั่งมี 3 สถานะ · ใบโควตามี `superseded`/`cancelled` เพิ่ม · ใบ interface มี `capped` เพิ่ม
// (ลำดับเดียวกับ `BU_QUOTA_STATUSES`/`INTERFACE_STATUSES` ฝั่ง backend) — ไม่ใส่ค่าของชนิดอื่นให้
// แท็บที่ไม่มีวันคืนผล เพราะปุ่มกรองที่ไม่มีวันคืนผลคือปุ่มที่หลอกคน
const STATUS_VALUES_BY_KIND: Record<LicenseKind, StatusFilterValue[]> = {
  seat: ['active', 'scheduled', 'expired'],
  'bu-quota': ['active', 'superseded', 'scheduled', 'expired', 'cancelled'],
  interface: ['active', 'capped', 'scheduled', 'expired'],
};
const statusValuesFor = (kind: LicenseKind): StatusFilterValue[] => STATUS_VALUES_BY_KIND[kind];

/** เกณฑ์ "ใกล้หมดอายุ" ของแต่ละชนิดใบ — คีย์เดียวกับที่ผู้ดูแลตั้งในหน้า Backstage Config */
const THRESHOLD_KEY_BY_KIND: Record<LicenseKind, keyof ExpiryThresholdsConfig> = {
  seat: 'seat_days',
  'bu-quota': 'bu_quota_days',
  interface: 'interface_days',
};

// คอลัมน์ Days Left เรียงด้วย end_date บนสาย — ดู handleSortChange
const DAYS_LEFT_SORT_ID = 'days_left';

type StatusBadgeVariant = 'success' | 'secondary' | 'destructive' | 'warning';

const STATUS_VARIANT: Record<StatusFilterValue, StatusBadgeVariant> = {
  active: 'success',
  superseded: 'secondary',
  // ใบที่วันยังไม่หมดแต่สัญญาแม่ไม่ active ให้สิทธิ์อะไรไม่ได้เลย — ไม่ใช่ "ปกติ"
  capped: 'warning',
  cancelled: 'secondary',
  scheduled: 'secondary',
  expired: 'destructive',
};

/** ลำดับเดียวกับ bucket ฝั่ง backend (`BU_QUOTA_STATUSES`) — ใช้แค่ให้ accessorFn มีค่า ไม่ได้ใช้เรียงจริง */
const STATUS_SORT_RANK: Record<StatusFilterValue, number> = {
  active: 0, superseded: 1, capped: 1, scheduled: 2, expired: 3, cancelled: 4,
};

// Catalog KEYS only — resolved with `t` inside the component (see `statusLabel`). Reuses
// common.status.* (Task 1) rather than a page-local key: every value this table's two
// status badges (and this filter list) can render already has one.
const STATUS_LABEL_KEYS: Record<StatusFilterValue, TKey> = {
  active: 'common.status.active',
  superseded: 'common.status.superseded',
  capped: 'pages.businessUnits.interfaceCapped',
  cancelled: 'common.status.cancelled',
  scheduled: 'common.status.scheduled',
  expired: 'common.status.expired',
};

// See the identical note in LicensePurchaseForm.tsx: licenseKindConfig.ts used to carry
// `ownerLabel`/`amountLabel` as plain English strings but nothing ever rendered them, so
// this file resolves its own per-kind translated value locally instead. The dead fields
// were deleted from `LicenseKindConfig` in the i18n fix wave (2026-08-28).
const OWNER_LABEL_KEYS: Record<LicenseKind, TKey> = {
  seat: 'entity.businessUnit.title',
  'bu-quota': 'common.label.cluster',
  // ใบ interface มีเจ้าของเป็น BU เหมือนใบที่นั่ง
  interface: 'entity.businessUnit.title',
};
const AMOUNT_LABEL_KEYS: Record<LicenseKind, TKey> = {
  seat: 'common.field.seats',
  'bu-quota': 'pages.licenses.buQuota',
  // ค่าหลักของใบ interface คือกลุ่มสิทธิ์ ไม่ใช่จำนวน — คอลัมน์ค่าหลักจึงวาดคนละแบบ (ดู `selector`)
  interface: 'pages.licenses.featureGroup',
};

const DEFAULT_SORT_ID = 'license_number';
const DEFAULT_SORT_DESC = false;
// tiebreaker เดียวกับที่ SubscriptionTable.tsx ใช้แก้บั๊กนี้มาก่อน — `license_number` เดี่ยว ๆ
// unique อยู่แล้วเลยปลอดภัย แต่ `start_date`/`end_date`/จำนวน (ที่ผู้ใช้เรียงได้จริงจาก header)
// ไม่มีตัวไหน unique เลย ค่าเท่ากันหลายแถวทำให้ backend orderBy ไม่นิ่งข้ามหน้า (แถวซ้ำ/หายเงียบ ๆ
// โดยไม่มี error — ดูคอมเมนต์ `withTiebreaker` ใน SubscriptionTable.tsx) `id` เป็น primary key
// จริงของ tb_business_unit_license/tb_cluster_license จึง unique เสมอและตัดเสมอทุกกรณี
const SORT_TIEBREAKER = 'id:asc';
const DEFAULT_SORT = `${DEFAULT_SORT_ID}:${DEFAULT_SORT_DESC ? 'desc' : 'asc'},${SORT_TIEBREAKER}`;

/**
 * ต่อ tiebreaker ให้ค่า sort **ทุกค่า** ที่ `DataTable` ส่งมา ไม่ใช่เฉพาะค่าเริ่มต้น — เรียงตาม
 * `start_date`/`end_date`/จำนวนก็มีค่าซ้ำได้เหมือนกัน · ค่าว่าง (header toggle วนกลับมาที่
 * "ไม่เรียง") ตกกลับไปเป็น DEFAULT_SORT ไม่ใช่ส่งสตริงว่างให้ backend · ค่าที่อ่านจาก localStorage
 * (อาจเป็นสตริงเก่าก่อนแก้บั๊กนี้ที่ยังไม่มี tiebreaker) ก็ต้องผ่านฟังก์ชันนี้ก่อนใช้เสมอ
 */
const withTiebreaker = (sort: string): string => {
  const s = sort.trim();
  if (!s) return DEFAULT_SORT;
  const alreadyHasId = s.split(/[;,]/).some((part) => part.trim().startsWith('id:'));
  return alreadyHasId ? s : `${s},${SORT_TIEBREAKER}`;
};

/**
 * แถวกลางที่ใช้ทั้งแสดงผลและ export — จุดเดียวในไฟล์นี้ที่ต้องรู้ว่าแถวดิบมาจากชนิดไหน
 * (`SeatLicenseRow` มี `business_unit_*` ส่วน `BuQuotaLicenseRow` มี `cluster_*`) ที่เหลือ
 * (column cells, CSV) อ่านจากรูปกลางนี้อย่างเดียว ไม่ต้องแตกสาขาตามชนิดซ้ำอีก — วันที่ถูก
 * format ไว้ล่วงหน้าแล้วเพื่อให้ตารางกับ CSV เห็นค่าเดียวกันเป๊ะเสมอ ส่วน `status` เก็บเป็น
 * enum ดิบ (`StatusFilterValue`) ไม่ใช่ label ที่แปลแล้ว — badge ในตารางและคอลัมน์ CSV
 * ต้อง resolve ผ่าน `rowStatusLabel()` เองคนละจุด (ตารางใน `columns`, CSV ใน `handleExport`)
 * เพื่อไม่ผูก locale ไว้ในแถวกลาง แต่ทั้งสองจุดต้องเรียก `rowStatusLabel()` ตัวเดียวกันเสมอ
 * ไม่งั้นค่าที่เห็นในตารางกับไฟล์ที่ export จะไม่ตรงกัน
 */
interface FleetLicenseRow {
  id: string;
  license_number: string;
  owner_code: string;
  owner_name: string;
  amount: number;
  start_date: string;
  end_date: string;
  /** end_date ดิบ (ISO) — `end_date` ข้างบนถูกจัดรูปเป็นข้อความแสดงผลแล้ว นับวันจากมันไม่ได้ */
  end_iso: string;
  status: StatusFilterValue;
  reference_no: string;
  /**
   * มีค่าจริงทั้งใบโควตา BU และใบ interface (อ่านผ่าน `normalizeAudit` ไม่ใช่ `row.created_at`
   * ตรง ๆ — ดูคอมเมนต์ที่ `toFleetRow`) มีแต่ **ใบที่นั่ง** (`BusinessUnitLicense`) ที่ไม่มี
   * คอลัมน์นี้ในฝั่ง backend เลย จึงเป็น `null` เสมอ — ไม่ใช่บั๊ก
   */
  created_at?: string | null;
  /** ชื่อคนสร้างใบ — มีค่าจริงทุกชนิดยกเว้นใบที่นั่ง เช่นเดียวกับ `created_at` */
  created_by_name?: string;
  /**
   * เวลา/คนแก้ล่าสุด — ใบ interface ส่งมาจริง (`InterfaceLicense` มี `updated_at`/`updated_by_id`)
   * ใบอีกสองชนิดไม่มี ค่าคู่นี้ไม่มีคอลัมน์ในตาราง (ดูคอมเมนต์ที่ `columns`) แต่ CSV ประกาศ
   * คอลัมน์ Updated ไว้อยู่แล้ว — ไม่แม็พไว้ที่นี่คือปล่อยให้ไฟล์ export ว่างทั้งที่มีข้อมูล
   */
  updated_at?: string | null;
  updated_by_name?: string;
  /**
   * คลัสเตอร์ที่เจ้าของใบสังกัด — มีค่าเฉพาะใบที่นั่ง (`SeatLicenseRow` พ่วง `cluster_*` มาให้)
   * ใบโควตา BU ไม่เซ็ตค่านี้เพราะคลัสเตอร์ **คือ** เจ้าของใบอยู่แล้ว (ดู `showCluster`)
   */
  cluster_code?: string;
  cluster_name?: string;
  /**
   * กลุ่มสิทธิ์ที่ใบนี้ขาย — มีค่าเฉพาะใบ interface (`selector: 'feature-group'`) ใบอีกสองชนิด
   * ขายเป็น "จำนวน" ซึ่งอยู่ใน `amount` แล้ว
   */
  group_code?: string;
  group_name?: string;
}

/** สีป้ายสถานะของแถว — คู่กับ `rowStatusLabel` ในคอมโพเนนต์ */
const rowStatusVariant = (r: FleetLicenseRow): StatusBadgeVariant => STATUS_VARIANT[r.status];

function toFleetRow(
  kind: LicenseKind,
  row: SeatLicenseRow | BuQuotaLicenseRow | InterfaceLicenseRow,
  now: Date,
  showNoExpiry: boolean,
  noExpiryLabel: string,
): FleetLicenseRow {
  // เจ้าของเป็น BU สำหรับทุกชนิดยกเว้นโควตา BU (ที่เจ้าของ **คือ** คลัสเตอร์) — เขียนเป็นข้อยกเว้น
  // ตัวเดียวแทน `kind === 'seat'` เพื่อไม่ต้องไล่แก้ทุกจุดทุกครั้งที่มีชนิดใบใหม่ที่เจ้าของเป็น BU
  const isBuOwned = kind !== 'bu-quota';
  const seat = row as SeatLicenseRow;
  const quota = row as BuQuotaLicenseRow;
  const inf = row as InterfaceLicenseRow;
  // สูตรสถานะสองชนิดไม่เท่ากัน (ดูคอมเมนต์ใน utils/buLicense.ts กับ utils/clusterLicense.ts) —
  // ห้ามคิดสูตรใหม่ที่นี่ เรียกของเดิมเท่านั้น เหมือนที่ LicensePurchaseForm.tsx ทำ
  // ตารางนี้แบ่งหน้าและรวมหลายคลัสเตอร์ จึงไม่มีลิสต์ใบครบของคลัสเตอร์ใดเลย — คำนวณ `superseded`
  // เองไม่ได้ตามนิยาม ต้องอ่าน `is_in_force` ที่ backend คำนวณจาก v_cluster_bu_cap มาให้
  // `undefined` (backend รุ่นเก่า) = ไม่รู้ ให้คงสถานะเดิมไว้ ห้ามอ่านเป็น false ไม่งั้นทุกใบ
  // จะขึ้น "ถูกแทนที่" พร้อมกันทั้งตาราง
  const quotaStatus = (): StatusFilterValue => {
    const base = clusterLicenseStatus(quota, now);
    return base === 'active' && quota.is_in_force === false ? 'superseded' : base;
  };
  // ใบ interface ใช้สูตร **วัน** เดียวกับใบที่นั่ง (`t <= end`) แล้วเช็ก `in_force` ที่ backend
  // คำนวณ (รวมสถานะสัญญาแม่) — วันยังไม่หมดแต่ไม่ in force = `capped` ตรงกับ `interfaceStatusWhere`
  // ฝั่ง backend ที่ใช้ทั้งตัวกรองและตัวเลขสรุป · `undefined` (backend รุ่นเก่า) = ไม่รู้ คงสถานะตามวัน
  const interfaceStatus = (): StatusFilterValue => {
    const base = buLicenseStatus(row as unknown as Parameters<typeof buLicenseStatus>[0], now);
    return base === 'active' && inf.in_force === false ? 'capped' : base;
  };
  const status: StatusFilterValue = kind === 'interface'
    ? interfaceStatus()
    : isBuOwned
      ? buLicenseStatus(row as unknown as Parameters<typeof buLicenseStatus>[0], now)
      : quotaStatus();
  // ใบที่นั่ง (BusinessUnitLicense) ไม่มี audit ในฝั่ง backend เลย — อีกสองชนิดมีจริง (ใบโควตา BU
  // จาก cluster-license.service.ts, ใบ interface จาก DTO ที่มี created_*/updated_* ครบ) เงื่อนไข
  // จึงเป็น `kind === 'seat'` ไม่ใช่ `isBuOwned` ที่กลืนใบ interface ไปด้วยเพราะเจ้าของเป็น BU
  // เหมือนกัน · อ่านผ่าน normalizeAudit ไม่ใช่ row.created_at ตรง ๆ (เดิมทำแบบนั้นและไม่ได้ชื่อ
  // คนสร้างมาด้วย) เพื่อรองรับทั้งรูปแบนและรูป nested เหมือนทุกจุดอื่น
  const rowAudit = kind === 'seat' ? {} : normalizeAudit(row);
  return {
    id: row.id,
    license_number: row.license_number,
    owner_code: isBuOwned ? seat.business_unit_code : quota.cluster_code,
    owner_name: isBuOwned ? seat.business_unit_name : quota.cluster_name,
    // ใบ interface ไม่มีจำนวนเลย — 0 ที่นี่ไม่มีใครอ่าน เพราะคอลัมน์ค่าหลักของมันวาดจาก
    // `group_code`/`group_name` แทน (ดู `selector` ใน columns) และ CSV ก็ไม่ส่งคอลัมน์ amount
    amount: kind === 'seat' ? seat.licensed_users : kind === 'bu-quota' ? quota.licensed_bus : 0,
    start_date: fmtDate(row.start_date),
    end_date: showNoExpiry && isPerpetual(row.end_date) ? noExpiryLabel : fmtDate(row.end_date),
    end_iso: row.end_date,
    status,
    reference_no: row.reference_no || '-',
    created_at: rowAudit.created?.at ?? null,
    created_by_name: rowAudit.created?.name,
    updated_at: rowAudit.updated?.at ?? null,
    updated_by_name: rowAudit.updated?.name,
    cluster_code: isBuOwned ? seat.cluster_code : undefined,
    cluster_name: isBuOwned ? seat.cluster_name : undefined,
    group_code: kind === 'interface' ? inf.group?.code : undefined,
    group_name: kind === 'interface' ? inf.group?.name : undefined,
  };
}

/**
 * เงื่อนไข `advance.where` จากสถานะที่เลือก สำหรับใบที่นั่ง — backend **ไม่มีคอลัมน์
 * status** ให้กรอง ต้องแปลเป็นช่วงวันที่บน `start_date`/`end_date` เอง และห้ามส่ง
 * `filter=status:active` เด็ดขาด (`status` ไม่ใช่คอลัมน์จริง ค่านั้นไหลเข้า Prisma ตรง ๆ แล้วได้ 500)
 * ขอบเขตตาม `buLicense.ts`: `end_date` คือวันสุดท้ายที่ยังคุ้มครอง (`t <= end` ยัง active)
 *
 * ใบโควตา BU / interface ไม่ผ่านที่นี่ — ส่ง `?status=` ให้ backend แทน (ดูคอมเมนต์ในฟังก์ชัน)
 */
/** ชนิดใบที่ backend รับ `?status=` (สถานะที่คำนวณจากข้อมูลนอกแถว) แทน `advance` ช่วงวันที่ */
const usesStatusParam = (kind: LicenseKind): boolean => kind !== 'seat';

function buildAdvance(kind: LicenseKind, status: StatusFilterValue | null): string {
  // ใบโควตา/interface กรองผ่านพารามิเตอร์ `status` แทน — `superseded` ต้องรู้ใบที่ชนะใน view และ
  // `capped` ต้องรู้สถานะสัญญาแม่ ซึ่ง where บนตารางเดียวแสดงไม่ได้ (ดู `usesStatusParam`)
  if (!status || usesStatusParam(kind)) return '';
  const now = new Date().toISOString();
  if (status === 'scheduled') return JSON.stringify({ where: { start_date: { gt: now } } });
  if (status === 'expired') return JSON.stringify({ where: { end_date: { lt: now } } });
  return JSON.stringify({ where: { start_date: { lte: now }, end_date: { gte: now } } });
}

export interface PurchaseLicenseTableProps {
  config: LicenseKindConfig;
  /** มุมมองใบที่ลบแล้ว (superadmin) — การ์ด "ลบแล้ว" ในแถบสรุปเป็นทางเข้า ดู `DeletedViewControl` */
  deletedView?: DeletedViewControl;
}

/** สีตัวเลขของการ์ดสถานะ — ชุดเดียวกับแถบสรุปของแท็บสัญญา (active เขียว · expired จาง) */
const SUMMARY_COLOR: Record<StatusFilterValue, string> = {
  active: 'text-success',
  superseded: 'text-foreground',
  capped: 'text-warning',
  scheduled: 'text-foreground',
  expired: 'text-muted-foreground',
  cancelled: 'text-muted-foreground',
};

/**
 * ตารางรายใบทั้ง fleet ของใบชนิดใดชนิดหนึ่ง (ที่นั่ง หรือ โควตา BU) — server-side ทั้งหมด
 * โครงตาม `ClusterLicenseTable.tsx`: search debounce + filter Sheet + ป้ายกดปิดทีละอัน + sort
 *
 * `loadFailed` แยกจาก "ไม่มีใบ" โดยตั้งใจ: ในระบบนี้ 0 ใบแปลว่าไม่มีความจุจริง การกลืน error
 * เป็นตารางว่างคือการโกหกผู้ใช้ว่าเขาไม่ได้ซื้ออะไรไว้เลย
 */
export function PurchaseLicenseTable({ config, deletedView }: PurchaseLicenseTableProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const { isSuperAdmin } = useAuth();
  // ใบโควตา BU ที่ยกเลิกแล้วคงอยู่ในตารางนี้ (ไม่ถูกลบแบบซ่อน) — ทางลบถาวรของมันจึงอยู่ที่นี่
  // ไม่ใช่ในมุมมองใบที่ลบแล้ว · เห็นเฉพาะ superadmin เหมือนปุ่มลบถาวรทุกจุด
  const canHardDeleteCancelled = config.kind === 'bu-quota' && isSuperAdmin;
  const expiringSoonDays = thresholds[THRESHOLD_KEY_BY_KIND[config.kind]];
  const [hardDeleteRow, setHardDeleteRow] = useState<FleetLicenseRow | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  // One lookup for every rendering of a status value in this file — both badges (the
  // license-status column and the active-filter chip) and the Sheet's filter buttons all
  // call this, so a given status can never read two ways on one page.
  const statusLabel = useCallback((s: StatusFilterValue) => t(STATUS_LABEL_KEYS[s]), [t]);
  /** ป้ายสถานะของแถว — ตารางและ CSV ต้องเรียกตัวนี้ตัวเดียวกัน ไม่งั้นไฟล์ที่ export ไม่ตรงกับจอ */
  const rowStatusLabel = useCallback((r: FleetLicenseRow) => statusLabel(r.status), [statusLabel]);
  const ownerLabel = t(OWNER_LABEL_KEYS[config.kind]);
  const amountLabel = t(AMOUNT_LABEL_KEYS[config.kind]);

  // คีย์ localStorage ผูกกับ config.kind เพื่อไม่ให้สองมุมมอง (seat / bu-quota) เหยียบ
  // page/perpage/sort/search/filter กันเอง — คอมโพเนนต์เดียวกันแต่ mount คนละอินสแตนซ์
  const pageKey = `page_${config.kind}_license`;
  const perpageKey = `perpage_${config.kind}_license`;
  const sortKey = `sort_${config.kind}_license`;
  const searchKey = `search_${config.kind}_license`;
  const statusKey = `filters_${config.kind}_license_status`;

  const [rows, setRows] = useState<FleetLicenseRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(() => localStorage.getItem(searchKey) || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue | null>(() => {
    const raw = localStorage.getItem(statusKey);
    return (statusValuesFor(config.kind) as string[]).includes(raw ?? '') ? (raw as StatusFilterValue) : null;
  });

  const [paginate, setPaginate] = useState(() => ({
    page: Number(localStorage.getItem(pageKey)) || 1,
    perpage: readStoredPerpage(perpageKey, 20),
    // ผ่าน withTiebreaker เสมอแม้ค่าที่อ่านมาจาก localStorage เพราะอาจเป็นค่าที่บันทึกไว้ก่อน
    // แก้บั๊กนี้ (ยังไม่มี `,id:asc` ต่อท้าย)
    sort: withTiebreaker(localStorage.getItem(sortKey) || ''),
  }));

  const resetPage = useCallback(() => {
    localStorage.setItem(pageKey, '1');
    setPaginate((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [pageKey]);

  // ค้นหา debounce 400ms — พิมพ์แต่ละตัวอักษรอัปเดตแค่ state ดิบที่ผูกกับ <SearchInput>
  // `onSettle` (=resetPage) รีเซ็ตหน้ากลับ 1 "ในจังหวะเดียวกัน" กับตอนค่า debounce นิ่งจริง
  // (ดูคอมเมนต์ยาวใน hooks/useDebouncedValue.ts) ปุ่ม clear ใช้ flushSearch แทนเพื่อไม่ต้องรอ
  const [debouncedSearch, flushSearch] = useDebouncedValue(search, 400, resetPage);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useGlobalShortcuts({ onSearch: () => searchInputRef.current?.focus() });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: PaginateParams & { status?: StatusFilterValue } = {
        page: paginate.page,
        perpage: paginate.perpage,
        sort: paginate.sort,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        advance: buildAdvance(config.kind, statusFilter),
        ...(usesStatusParam(config.kind) && statusFilter ? { status: statusFilter } : {}),
      };
      const data = await config.service.listBackstage(params);
      const now = new Date();
      const noExpiryLabel = t('common.state.noExpiry');
      setRows(data.data.map((r) => toFleetRow(config.kind, r, now, config.showNoExpiry, noExpiryLabel)));
      setTotalRows(data.paginate?.total ?? data.data.length);
      setLoadFailed(false);
    } catch (err: unknown) {
      // รีเซ็ตกลับค่าปลอดภัย — ไม่ปล่อยแถวเก่าค้างไว้เบื้องหลัง error state (ดูคอมเมนต์ที่
      // `loadFailed` ด้านล่าง: 0 ใบกับโหลดไม่ได้ต้องแยกกันเด็ดขาด ไม่ใช่แค่ตอนแสดงผล)
      setRows([]);
      setTotalRows(0);
      setLoadFailed(true);
      devLog(`Failed to load ${config.kind} licenses:`, err);
    } finally {
      setLoading(false);
    }
  }, [config, paginate, debouncedSearch, statusFilter, t]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  /**
   * แถบสรุปของแท็บนี้ อ่านจาก `GET .../summary` ซึ่งนับในขอบเขตอ่านเดียวกับรายการ และใช้เกณฑ์วันที่
   * เดียวกับ `buildAdvance` ตัวเลขบนการ์ดจึงเท่ากับจำนวนแถวที่ได้เมื่อกดการ์ดนั้นเสมอ
   *
   * ไม่ผูกกับช่องค้นหา/ตัวกรอง/หน้า โดยตั้งใจ — ตัวเลขต้องนิ่งกับตัวกรอง (เหตุผลเดียวกับ
   * `SubscriptionTable.fetchSummary`) โหลดตอน mount และหลังลบ/กู้คืนเท่านั้น
   */
  const [summary, setSummary] = useState<LicenseFleetSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await config.service.getBackstageSummary());
      setSummaryError('');
    } catch (err: unknown) {
      setSummaryError(t('pages.licenses.loadFailedTitle'));
      devLog(`Failed to load ${config.kind} license summary:`, err);
    } finally {
      setSummaryLoading(false);
    }
  }, [config, t]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleHardDelete = async () => {
    if (!hardDeleteRow) return;
    setHardDeleting(true);
    try {
      await clusterLicenseService.hardDelete(hardDeleteRow.id);
      toast.success(t('pages.licenses.deleted.hardDeleted'));
      setHardDeleteRow(null);
      fetchSummary();
      // แถวสุดท้ายของหน้า ≥2 หายไป — ถอยหนึ่งหน้า (setPaginate ทำให้ fetch เอง) ไม่งั้นได้ empty
      // state "ยังไม่มีใบ" หลอก ๆ ทั้งที่หน้าก่อนหน้ายังมีใบอยู่
      if (rows.length === 1 && paginate.page > 1) {
        const prev = paginate.page - 1;
        localStorage.setItem(pageKey, String(prev));
        setPaginate((p) => ({ ...p, page: prev }));
      } else {
        await fetchRows();
      }
    } catch (err: unknown) {
      toast.error(licenseActionErrorMessage(err, t));
    } finally {
      setHardDeleting(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    localStorage.setItem(searchKey, value);
  };

  const handleSearchClear = () => {
    setSearch('');
    localStorage.setItem(searchKey, '');
    flushSearch('');
    resetPage();
  };

  const handlePaginateChange = ({ page, perpage }: { page: number; perpage: number }) => {
    localStorage.setItem(perpageKey, String(perpage));
    localStorage.setItem(pageKey, String(page));
    setPaginate((p) => ({ ...p, page, perpage }));
  };

  const handleSortChange = (sort: string) => {
    // `days_left` ไม่ใช่คีย์ที่ backend รู้จัก — ลำดับเดียวกับ end_date เป๊ะ จึงแปลงก่อนส่ง
    const next = withTiebreaker(
      sort.startsWith(`${DAYS_LEFT_SORT_ID}:`) ? sort.replace(DAYS_LEFT_SORT_ID, 'end_date') : sort,
    );
    localStorage.setItem(sortKey, next);
    localStorage.setItem(pageKey, '1');
    setPaginate((p) => ({ ...p, sort: next, page: 1 }));
  };

  // สถานะเป็น partition ตามเวลา — active/scheduled/expired ไม่มีวันทับกัน ต่างจากตัวกรองบูลีน
  // อิสระต่อกันของ ClusterLicenseTable (ที่นั่น AND กันได้เพราะแกนต่างกันจริง) ตัวกรองนี้จึงเลือก
  // ได้ทีละสถานะ (คลิกซ้ำ = ล้างกลับเป็น "ทั้งหมด") ไม่ใช่ multi-select ที่ต้องประกอบ OR
  const handleStatusFilter = (value: StatusFilterValue) => {
    const next = statusFilter === value ? null : value;
    setStatusFilter(next);
    localStorage.setItem(statusKey, next ?? '');
    resetPage();
  };

  const handleClearFilters = () => {
    setStatusFilter(null);
    localStorage.setItem(statusKey, '');
    resetPage();
  };

  const activeFilterCount = statusFilter ? 1 : 0;

  // การ์ดกรองกดระหว่างดูใบที่ลบ = กลับไปตารางปกติที่กรองตามการ์ดนั้น (ถ้าตัวกรองนั้นเปิดอยู่แล้ว
  // แค่กลับ ไม่ toggle ปิดทิ้ง) — ท่าเดียวกับ SubscriptionTable
  const showingDeleted = !!deletedView?.open;
  const summaryItems: SummaryBandItem[] = [
    {
      key: 'total',
      label: t('common.option.all'),
      value: summary?.total,
      color: 'text-foreground',
      active: !showingDeleted && statusFilter === null,
      onClick: () => {
        if (showingDeleted) deletedView.onToggle();
        handleClearFilters();
      },
    },
    ...statusValuesFor(config.kind).map((value): SummaryBandItem => ({
      key: value,
      label: statusLabel(value),
      value: summary?.[value],
      color: SUMMARY_COLOR[value],
      active: !showingDeleted && statusFilter === value,
      onClick: () => {
        if (showingDeleted) {
          deletedView.onToggle();
          if (statusFilter === value) return;
        }
        handleStatusFilter(value);
      },
    })),
    ...(deletedView
      ? [{
          key: 'deleted',
          label: t('common.status.deleted'),
          value: summary?.deleted,
          color: deletedCountColor(summary?.deleted),
          active: showingDeleted,
          onClick: deletedView.onToggle,
          variant: 'view' as const,
        }]
      : []),
  ];

  const handleExport = () => {
    // คอลัมน์ค่าหลักของ CSV สลับตามชนิดใบ ต้องประกาศชนิดให้ชัดก่อน spread — array literal ที่
    // spread เข้ามาจะถูกอนุมานเป็น `key: string` แล้ว generic ของ generateCSV รับไม่ได้
    type CsvColumn = { key: keyof (typeof csvRows)[number]; label: string };
    // export เฉพาะหน้าปัจจุบันที่โหลดมาแล้ว (`rows`) ไม่ยิงคำขอ perpage:-1 แยกต่างหาก —
    // แพทเทิร์นเดิมเคยทำแบบนั้นแล้วเลิกใช้ (ดู memory: List summary block เลิก perpage:-1)
    // และตรงกับ SubscriptionTable.tsx ที่ export `items` ของหน้าปัจจุบันเช่นกัน
    const csvRows = rows.map((r) => ({
      ...r,
      ...auditCsvFields(normalizeAudit(r)),
      status: rowStatusLabel(r),
    }));
    const csv = generateCSV(csvRows, [
      { key: 'license_number', label: t('pages.licenses.licenseNumber') },
      { key: 'owner_code', label: t('pages.licenses.ownerCodeColumn', { owner: ownerLabel }) },
      // ค่าหลักของใบต่างชนิดกันคนละรูป — ใบกลุ่มสิทธิ์ส่งรหัส+ชื่อกลุ่มแทนคอลัมน์จำนวนที่เป็น 0
      // เสมอ (ดู `toFleetRow`) การส่ง 0 ออกไปคือการ export ตัวเลขที่ไม่มีความหมาย
      { key: 'owner_name', label: t('pages.licenses.ownerNameColumn', { owner: ownerLabel }) },
      ...(config.selector === 'feature-group'
        ? ([
            { key: 'group_code', label: `${amountLabel} (${t('common.field.code')})` },
            { key: 'group_name', label: amountLabel },
          ] as CsvColumn[])
        : ([{ key: 'amount', label: amountLabel }] as CsvColumn[])),
      { key: 'start_date', label: t('common.field.startDate') },
      { key: 'end_date', label: t('common.field.endDate') },
      { key: 'status', label: t('common.status.label') },
      { key: 'reference_no', label: t('pages.licenses.referenceNoColumn') },
      { key: 'created_at', label: t('common.audit.createdAt') },
      { key: 'created_by', label: t('common.audit.createdBy') },
      { key: 'updated_at', label: t('common.audit.updatedAt') },
      { key: 'updated_by', label: t('common.audit.updatedBy') },
    ]);
    downloadCSV(csv, `${config.kind}-licenses-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const columns = useMemo<ColumnDef<FleetLicenseRow, unknown>[]>(() => {
    // หยิบมาแค่คอลัมน์ Created ตัวเดียว: DTO ของใบที่นั่งกับใบโควตา BU
    // (BusinessUnitLicenseListRowDto, ClusterLicenseListRowDto) ไม่ส่ง updated_at มาเลย มีแต่ใบ
    // interface ที่ส่งครบ — เปิดคอลัมน์ Updated ที่นี่จะได้คอลัมน์ว่างถาวรในสองในสามแท็บ
    // (เจอกรณีเดียวกันมาแล้วที่ SuperAdminManagement และ broadcastColumns.tsx) ส่วน CSV ที่
    // ประกาศคอลัมน์ Updated ไว้อยู่แล้วยังได้ค่าของใบ interface ครบ เพราะ toFleetRow แม็พไว้
    const [createdColumn] = auditColumns<FleetLicenseRow>({ t });
    return [
      {
        accessorKey: 'license_number',
        header: t('pages.licenses.licenseNumber'),
        meta: { card: 'title' },
        cell: ({ row }) => (
          <Link
            to={`/licenses/${config.editPathSegment}/${row.original.id}/edit?ownerLabel=${
              encodeURIComponent(`${row.original.owner_code} - ${row.original.owner_name}`)
            }`}
            className="text-primary hover:underline whitespace-nowrap"
          >
            {row.original.license_number}
          </Link>
        ),
      },
      ...(config.showCluster
        ? [{
            // คีย์แบบจุดสองชั้น: ใบ → BU → cluster ล้วนเป็น relation to-one · QueryParams.orderBy ฝั่ง
            // backend ซ้อนได้ไม่จำกัดชั้น (`{ tb_business_unit: { tb_cluster: { name } } }`) — คอลัมน์นี้
            // แสดงเฉพาะใบที่เจ้าของเป็น BU (`showCluster`) คีย์จึงคงที่ ไม่ต้องอยู่ใน config
            id: 'tb_business_unit.tb_cluster.name',
            accessorKey: 'cluster_name',
            header: t('common.label.cluster'),
            cell: ({ row }: { row: Row<FleetLicenseRow> }) => (
              <div className="flex flex-col">
                <span>{row.original.cluster_name || '-'}</span>
                <span className="text-xs text-muted-foreground font-mono">{row.original.cluster_code}</span>
              </div>
            ),
          } as ColumnDef<FleetLicenseRow, unknown>]
        : []),
      {
        // เจ้าของเป็น relation to-one ของตารางใบ — คีย์แบบจุดต่างกันตามชนิด (ดู `ownerSortKey`)
        id: config.ownerSortKey,
        accessorKey: 'owner_name',
        header: ownerLabel,
        meta: { card: 'title' },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.owner_name}</span>
            <span className="text-xs text-muted-foreground font-mono">{row.original.owner_code}</span>
          </div>
        ),
      },
      config.selector === 'feature-group'
        ? ({
            // เรียงตามรหัสกลุ่มผ่าน relation (`{ tb_license_feature_group: { code } }`) ไม่ใช่
            // `license_feature_group_id` ที่เป็น uuid ดิบซึ่งเรียงแล้วได้ลำดับที่ผู้ใช้มองไม่เห็นความหมาย
            id: 'tb_license_feature_group.code',
            accessorKey: 'group_code',
            header: amountLabel,
            // ไม่มี `meta.card` เหมือนคอลัมน์จำนวนที่มันมาแทน — ค่าหลักของใบเป็น "ค่า" ไม่ใช่ตัวตน
            // ของแถว การยัดเข้าหัวการ์ดคู่กับเลขที่ใบและเจ้าของทำให้หัวการ์ดมีสามก้อนสองบรรทัด
            cell: ({ row }: { row: Row<FleetLicenseRow> }) => (
              <div className="flex flex-col">
                <span className="font-mono text-xs">{row.original.group_code}</span>
                <span className="text-xs text-muted-foreground">{row.original.group_name}</span>
              </div>
            ),
          } as ColumnDef<FleetLicenseRow, unknown>)
        : {
            accessorKey: 'amount',
            // id คือชื่อฟิลด์จริงบนสาย (`licensed_users`/`licensed_bus`) ไม่ใช่ `amount` ที่เป็นชื่อ
            // ฟิลด์กลางในไฟล์นี้ — DataTable ส่ง id นี้ตรงไปเป็นค่า `sort` ให้ backend
            id: config.amountField,
            header: amountLabel,
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.amount}</span>,
          },
      {
        // เซลล์แสดงสองวันที่ แต่เรียงด้วย `end_date` ตัวเดียว — วันหมดอายุคือสิ่งที่คนไล่ดูในตารางใบ
        // (แบบเดียวกับคอลัมน์ Period ของตารางสัญญาที่เรียง/ค่าเริ่มต้นด้วย end_date)
        id: 'end_date',
        accessorKey: 'end_date',
        header: t('pages.licenses.coverageColumn'),
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">
            {row.original.start_date} – {row.original.end_date}
          </span>
        ),
      },
      {
        // นับจาก end_date ล้วน · ใบที่ยกเลิกแล้วไม่มีวันเหลือให้นับ (ป้าย Cancelled บอกอยู่แล้ว) ·
        // เริ่ม asc = ใบที่ใกล้หมดก่อน
        id: DAYS_LEFT_SORT_ID,
        accessorFn: (row) => row.end_iso,
        header: t('common.field.daysLeft'),
        sortDescFirst: false,
        cell: ({ row }) => {
          const { end_iso, status } = row.original;
          if (status === 'cancelled' || isPerpetual(end_iso)) {
            return <span className="text-xs text-muted-foreground">&mdash;</span>;
          }
          const left = daysLeft(end_iso, new Date());
          if (left < 0) {
            return (
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {t('pages.licenses.expiredDaysAgo', { count: -left })}
              </span>
            );
          }
          const soon = left <= expiringSoonDays;
          return (
            <span className={`text-xs whitespace-nowrap tabular-nums ${soon ? 'text-warning font-medium' : ''}`}>
              {t('common.state.daysLeft', { count: left })}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: t('common.status.label'),
        // เรียงได้แล้ว (2026-09-09): backend คำนวณสถานะจากวันที่ด้วยกติกาเดียวกับ utils/buLicense.ts และ
        // แบ่งหน้าเป็น bucket active → scheduled → expired → cancelled (business-unit-license.service.ts
        // และพี่น้อง) — ค่าที่ accessor คืนไม่ถูกใช้เรียง แต่ต้องมีเพื่อเปิดปุ่มที่หัวคอลัมน์
        accessorFn: (row) => STATUS_SORT_RANK[row.status],
        // การ์ดมือถือ: เหมือน SubscriptionTable.tsx's `state` column — badge ไปโผล่ที่หัวการ์ดคู่กับ
        // title แทนที่จะตกลงไปเป็นแถว "Status: [badge]" ใน <dl> เฉย ๆ — สองแท็บของหน้าเดียวกันต้อง
        // เรนเดอร์การ์ดแบบเดียวกัน
        meta: { card: 'badge' },
        // ไม่มี `className="capitalize"` แล้ว — ค่าจากตัวคำนวณเป็น Title Case อยู่แล้วตอนภาษาอังกฤษ
        // (ดู statusLabel/common.status.*) ภาษาไทยไม่มี case ให้ capitalize เลยแปล
        cell: ({ row }) => (
          <Badge variant={rowStatusVariant(row.original)}>{rowStatusLabel(row.original)}</Badge>
        ),
      },
      {
        accessorKey: 'reference_no',
        header: t('pages.licenses.referenceNoColumn'),
        // คอลัมน์จริงบนตารางใบทุกชนิด — เรียงผ่าน Prisma orderBy ตรง ๆ
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.reference_no}</span>,
      },
      createdColumn,
      ...(canHardDeleteCancelled
        ? [{
            id: 'actions',
            header: '',
            enableSorting: false,
            meta: { headerClassName: 'w-10', cellClassName: 'text-center p-0', card: 'actions' },
            // เฉพาะแถวที่ยกเลิกแล้ว — แถว active ลบถาวรไม่ได้ (backend ตอบ 409 LICENSE_HARD_DELETE_ACTIVE)
            cell: ({ row }: { row: Row<FleetLicenseRow> }) =>
              row.original.status === 'cancelled' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={t('pages.licenses.deleted.hardDeleteRowAria', { number: row.original.license_number })}
                  title={t('pages.licenses.deleted.hardDelete')}
                  onClick={() => setHardDeleteRow(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null,
          } as ColumnDef<FleetLicenseRow, unknown>]
        : []),
    ];
  }, [config, t, ownerLabel, amountLabel, rowStatusLabel, canHardDeleteCancelled, expiringSoonDays]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <LicenseSummaryBand items={summaryItems} loading={summaryLoading} error={summaryError} onRetry={fetchSummary} />

      {showingDeleted ? (
        <DeletedLicenseTable kind={config.kind} onExit={deletedView.onToggle} onChanged={fetchSummary} />
      ) : (
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              ref={searchInputRef}
              value={search}
              onValueChange={handleSearchChange}
              onClear={handleSearchClear}
              placeholder={t('pages.licenses.searchLicensesPlaceholder')}
              className="min-w-0 flex-1 sm:max-w-sm"
            />
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Filter className="mr-2 h-4 w-4" />
                  {t('common.label.filters')}
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-sm p-4 sm:p-6">
                <SheetHeader>
                  <SheetTitle>{t('common.label.filters')}</SheetTitle>
                  <SheetDescription>{t('pages.licenses.filterByStatusDescription')}</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6 px-1">
                  <div className="space-y-3">
                    <span className="text-sm font-medium">{t('common.status.label')}</span>
                    <div className="flex flex-wrap gap-1">
                      {statusValuesFor(config.kind).map((value) => (
                        <Button
                          key={value}
                          variant={statusFilter === value ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleStatusFilter(value)}
                        >
                          {statusLabel(value)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearFilters}>
                      <X className="mr-1 h-3 w-3" />
                      {t('pages.licenses.clearAllFilters')}
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={handleExport}
              disabled={loading || loadFailed || rows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('common.action.export')}
            </Button>
          </div>

          {activeFilterCount > 0 && statusFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                {statusLabel(statusFilter)}
                <button type="button" onClick={handleClearFilters} aria-label={t('pages.licenses.removeStatusFilterAria')}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loadFailed ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('pages.licenses.loadFailedTitle')}
              description={t('pages.licenses.loadFailedDescription')}
              action={
                <Button variant="outline" size="sm" onClick={() => fetchRows()} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                  {loading ? t('pages.licenses.retryingEllipsis') : t('common.action.retry')}
                </Button>
              }
            />
          ) : loading && rows.length === 0 ? (
            // +1 เผื่อคอลัมน์ลำดับแถวที่ DataTable ใส่ให้เองเสมอ
            <TableSkeleton columns={columns.length + 1} rows={paginate.perpage || 5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('pages.licenses.noLicensesTitle')}
              description={
                search || activeFilterCount > 0
                  ? t('pages.licenses.noLicensesMatchFilters')
                  : t('pages.licenses.noLicensesIssuedYet')
              }
              action={
                search || activeFilterCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => { handleSearchClear(); handleClearFilters(); }}>
                    {t('pages.licenses.clearFiltersAction')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"
                     role="status" aria-label={t('pages.licenses.loadingLicensesAria')}>
                  <div className="text-muted-foreground">{t('common.busy.loading')}</div>
                </div>
              )}
              <DataTable
                columns={columns}
                data={rows}
                serverSide
                tableLayout="auto"
                // 2 = # + License Number เท่านั้น — คอลัมน์ที่ 3 (Cluster สำหรับใบที่นั่ง /
                // Business Unit ก่อนหน้านี้) เลื่อนหายไปกับตารางได้: ทุกคอลัมน์ที่ตรึงคือความกว้าง
                // ที่ผู้อ่านเลื่อนหนีไม่ได้ (agent-os/standards/styling/table-sticky-columns.md)
                stickyLeftColumns={2}
                totalRows={totalRows}
                page={paginate.page}
                perpage={paginate.perpage}
                onPaginateChange={handlePaginateChange}
                onSortChange={handleSortChange}
                defaultSort={{ id: DEFAULT_SORT_ID, desc: DEFAULT_SORT_DESC }}
              />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {canHardDeleteCancelled && (
        <TypeToConfirmDialog
          open={hardDeleteRow !== null}
          onOpenChange={(open) => { if (!open) setHardDeleteRow(null); }}
          title={t('pages.licenses.deleted.hardDeleteTitle')}
          description={t('pages.licenses.deleted.hardDeleteWarning')}
          confirmValue={hardDeleteRow?.license_number ?? ''}
          confirmLabel={t('pages.licenses.deleted.hardDelete')}
          inputLabel={t('pages.licenses.deleted.hardDeleteType', { number: hardDeleteRow?.license_number ?? '' })}
          busy={hardDeleting}
          onConfirm={handleHardDelete}
        />
      )}
    </div>
  );
}
