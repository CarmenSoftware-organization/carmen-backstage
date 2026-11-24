import type { ColumnDef } from '@tanstack/react-table';
import { cn } from '../lib/utils';

/**
 * ให้คอลัมน์ข้อมูลสุดท้ายรับที่ว่างที่เหลือทั้งหมด คอลัมน์อื่นจึงกว้างเท่าเนื้อหา
 * (skill carmen-blue-backstage-ui-design rules 2–3 + tables.md §Few short columns)
 *
 * `tableLayout="auto"` เฉย ๆ ให้เบราว์เซอร์แบ่งที่ว่างทุกคอลัมน์ — บนจอ 1920+ ค่าในแถวห่างกัน
 * คอลัมน์ละ 200–300px · `w-full` บนหัวคอลัมน์สุดท้ายดูดที่ว่างไปที่เดียว (ถ้าคอลัมน์ที่รับที่ว่าง
 * อยู่กลางแถว ช่องว่างแค่ย้ายไปอยู่หน้าคอลัมน์ถัดไป จึงเลือกตัวสุดท้ายเสมอ · `actions` ไม่นับ)
 *
 * แต่ `w-full` ดันคอลัมน์อื่นลงเหลือ min-content — ชื่อ BU/คลัสเตอร์ตัดบรรทัดแม้บนจอ 4K จึงห้าม
 * ตัดบรรทัดเมื่อกล่องของตารางกว้างพอ (`@[1340px]:whitespace-nowrap`; ตาราง license ที่กว้างสุด
 * แบบไม่ตัดบรรทัดวัดได้ ~1333px) · ต่ำกว่านั้นตัดบรรทัดตามเดิม — การห้ามตลอดเวลา (ท่า `w-px
 * whitespace-nowrap` ของ /users, /customers) ทำให้ตาราง license ที่ 1366 ล้นเพิ่ม 56–150px
 *
 * ต้องมี ancestor ที่เป็น `@container` (กล่องที่ห่อ DataTable) ไม่งั้น nowrap ไม่ทำงานเลยโดยไม่มี error
 * คอลัมน์ที่เนื้อหาเป็นชิป flex-wrap ไม่โดน white-space — ใส่ min-w ใน meta ของคอลัมน์นั้นเอง
 */
export function hugColumns<T>(columns: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  let fill = -1;
  for (let i = columns.length - 1; i >= 0; i--) {
    if (columns[i].id !== 'actions') { fill = i; break; }
  }
  if (fill < 0) return columns;
  return columns.map((c, i) => {
    if (c.id === 'actions') return c;
    const meta = (c.meta ?? {}) as Record<string, unknown>;
    const header = meta.headerClassName as string | undefined;
    const cell = meta.cellClassName as string | undefined;
    return {
      ...c,
      meta: i === fill
        ? { ...meta, headerClassName: cn(header, 'w-full') }
        : { ...meta, cellClassName: cn(cell, '@[1340px]:whitespace-nowrap') },
    } as ColumnDef<T, unknown>;
  });
}
