/**
 * Lint ของ Export XML (แมป dataset ของรายงาน → CSV) — คืนคำเตือนที่คนอ่านได้
 * ไม่บล็อกการบันทึก; XML เสียให้ XmlEditor จัดการ (validateXml) เหมือน editor อื่น
 */

const COMPUTED_FIELDS = new Set(['GroupBy', 'BuName', 'CalculationMethod']);
const VALUE_SOURCES = ['Field', 'Value', 'Expression'] as const;

/** กฎเดียวกับ Go engine: ADMIN_Bu.Name → BuName; นอกนั้นตัดทุกอย่างถึง '.' ตัวสุดท้าย แล้ว trim */
export function normalizeExportField(name: string): string {
  const n = name.trim();
  if (n === 'ADMIN_Bu.Name') return 'BuName';
  return n.slice(n.lastIndexOf('.') + 1).trim();
}

function parse(xml: string): Document | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return doc.querySelector('parsererror') ? null : doc;
}

/** ชื่อ field ที่ Content XML ประกาศไว้ใน TableDataSource (normalise แล้ว) */
function contentFieldNames(contentXml: string): Set<string> {
  const names = new Set<string>();
  const doc = parse(contentXml);
  if (!doc) return names;
  for (const ds of Array.from(doc.getElementsByTagName('TableDataSource'))) {
    for (const col of Array.from(ds.getElementsByTagName('Column'))) {
      const name = col.getAttribute('Name');
      if (name) names.add(normalizeExportField(name));
    }
  }
  return names;
}

export function lintExportXml(exportXml: string, contentXml: string): string[] {
  if (!exportXml.trim()) return [];
  const doc = parse(exportXml);
  if (!doc) return []; // XML เสีย — XmlEditor แสดง error อยู่แล้ว
  const root = doc.documentElement;
  const warnings: string[] = [];
  if (root.nodeName !== 'Export') {
    warnings.push(`Root element must be <Export> (found <${root.nodeName}>).`);
  }

  const known = contentFieldNames(contentXml);
  const checkField = (raw: string, where: string) => {
    const field = normalizeExportField(raw);
    if (!field || known.size === 0 || known.has(field) || COMPUTED_FIELDS.has(field)) return;
    warnings.push(`${where}: "${raw}" is not a column in Content XML — the cell will be empty.`);
  };

  const columns = Array.from(root.children).filter((el) => el.nodeName === 'Column');
  if (columns.length === 0) warnings.push('At least one <Column> is required.');
  columns.forEach((col, i) => {
    const label = `Column ${i + 1}`;
    if (!col.getAttribute('Header')?.trim()) warnings.push(`${label}: missing Header.`);
    const sources = VALUE_SOURCES.filter((a) => col.hasAttribute(a));
    if (sources.length !== 1) {
      warnings.push(`${label}: needs exactly one of Field / Value / Expression (found ${sources.length}).`);
    }
    const field = col.getAttribute('Field');
    if (field != null && !field.trim()) warnings.push(`${label}: Field is empty.`);
    if (field != null) checkField(field, `${label} Field`);
    const expr = col.getAttribute('Expression');
    if (expr != null) {
      Array.from(expr.matchAll(/\[([^[\]]+)\]/g)).forEach((m) => checkField(m[1], `${label} Expression`));
    }
  });

  for (const sort of Array.from(root.children).filter((el) => el.nodeName === 'Sort')) {
    const field = sort.getAttribute('Field');
    if (field == null || !field.trim()) {
      warnings.push('Sort: missing or empty Field.');
    } else {
      checkField(field, 'Sort Field');
    }
    const desc = sort.getAttribute('Desc');
    if (desc != null && desc !== 'true' && desc !== 'false') {
      warnings.push(`Sort: Desc must be "true" or "false" (found "${desc}").`);
    }
  }
  return warnings;
}
