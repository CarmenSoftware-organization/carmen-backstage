import type { ReactNode } from 'react';

interface LicenseTileProps {
  name: string;
  /** รหัสเทคนิค (code ของ module / group) — ตัวเล็ก mono ข้างชื่อ ไม่ใช่สิ่งที่สายตาจับก่อน */
  code: string;
  /** บรรทัดใต้ชื่อ: วันที่ใช้ได้ถึง / เริ่ม / ไม่มีวันหมด */
  when: string;
  /** เลขใบ (เช่น INF-2610-0019) — ใบสิทธิ์ interface มี ส่วน module ไม่มี */
  reference?: string;
  /** ใช้งานไม่ได้ ณ ตอนนี้ (หมด / ยังไม่เริ่ม / ถูกสัญญาหลักครอบ) — วาดจางลง */
  muted?: boolean;
  /** ป้ายต่อท้ายบรรทัดวันที่ เช่น เหลือกี่วัน หรือสถานะเมื่อไม่ active */
  badges?: ReactNode;
}

/**
 * แผ่นหนึ่งรายการที่ BU ถือ — ใช้ร่วมกันระหว่างแท็บ Modules และ Interface ของ cluster admin
 *
 * ชื่อขึ้นก่อนเสมอ รหัสกับเลขใบเป็นของรอง: คนที่เปิดแท็บถามว่า "มีอะไรใช้" ไม่ใช่ "รหัสอะไร"
 * ทั้งสองแท็บจึงอ่านด้วยตาแบบเดียวกัน
 */
export function LicenseTile({ name, code, when, reference, muted = false, badges }: LicenseTileProps) {
  return (
    <li className={`flex min-w-0 flex-col gap-1 rounded-md border px-3 py-2.5 ${muted ? 'bg-muted/40' : 'bg-card'}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className={`truncate text-sm font-medium ${muted ? 'text-muted-foreground' : ''}`} title={name}>
          {name}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">{code}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{when}</span>
        {badges}
      </div>
      {reference && <div className="text-muted-foreground font-mono text-[11px]">{reference}</div>}
    </li>
  );
}

/** กริดของแผ่น — 1 / 2 / 3 คอลัมน์ตามความกว้าง */
export const LicenseTileGrid = ({ children }: { children: ReactNode }) => (
  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>
);
