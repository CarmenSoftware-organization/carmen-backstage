import type { ReactNode } from 'react';
import { CardHeader } from '../../components/ui/card';

interface LicenseSectionHeaderProps {
  title: ReactNode;
  /** บรรทัดข้อเท็จจริงใต้ชื่อ — หนึ่งบรรทัด ไม่ใช่ย่อหน้าอธิบายฟีเจอร์ */
  facts?: ReactNode;
  /** ของที่ตามใต้ facts เช่นแถบช่วงคุ้มครองหรือป้ายใกล้หมด */
  children?: ReactNode;
  /** ปุ่มด้านขวา — ปุ่มทึบไม่เกินหนึ่งปุ่ม (การสร้าง) ที่เหลือเป็น outline */
  actions?: ReactNode;
}

/**
 * หัวการ์ดแบบเดียวกันของทั้งสามส่วนบนแท็บ Licenses (ที่นั่ง · interface · storage)
 * ให้ทั้งแท็บอ่านเป็นบัญชีเดียวกัน: ชื่อ `text-sm` → ข้อเท็จจริง `text-xs` → ปุ่มด้านขวา
 * ไม่ใส่ `shrink-0` ที่แถวปุ่ม: ป้ายภาษาไทยยาวกว่าแล้วปุ่มจะถูกตัดเงียบ ๆ ให้ wrap แทน
 */
export function LicenseSectionHeader({ title, facts, children, actions }: LicenseSectionHeaderProps) {
  return (
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {facts && <div className="text-muted-foreground text-xs">{facts}</div>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </CardHeader>
  );
}
