// start/end_date เป็นวันปฏิทิน — ตัด YYYY-MM-DD ตรง ๆ ไม่ผ่าน Date กันวันเลื่อนตาม timezone
export const dayOf = (v?: string | null): string => (v ? v.slice(0, 10) : '-');

export const periodOf = (start?: string | null, end?: string | null): string =>
  start || end ? `${dayOf(start)} → ${dayOf(end)}` : '-';

// timestamp จริง (created_at ฯลฯ) แสดงเป็นเวลาท้องถิ่น
export const fmtDateTime = (v?: string | null): string => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
