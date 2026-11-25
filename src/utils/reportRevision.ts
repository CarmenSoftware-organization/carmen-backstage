/**
 * Report template revision — the number printed on the report footer ("Rev. 1.2").
 *
 * Every template starts at 1.0. Each save through the API moves it forward: the saver picks
 * major (1.2 → 2.0) or minor (1.2 → 1.3); `none` keeps it, for saves that leave the print as it
 * was (default form, on/off). Not the same thing as `doc_version` — that is the lock counter.
 *
 * revision ของ report template (ท้ายกระดาษ "Rev. 1.2") เริ่ม 1.0 · บันทึกแต่ละครั้งเลือกบวก
 * major หรือ minor · none = คงเลข ใช้กับการบันทึกที่ไม่เปลี่ยนใบพิมพ์ · คนละตัวกับ doc_version
 */
export type RevisionBump = 'major' | 'minor' | 'none';

export interface RevisionParts {
  major: number;
  minor: number;
}

/** The record's revision, or null on a backend that predates revisions. */
export function revisionOf(src: { revision_major?: unknown; revision_minor?: unknown } | null | undefined): RevisionParts | null {
  const major = src?.revision_major;
  const minor = src?.revision_minor;
  if (typeof major !== 'number' || typeof minor !== 'number') return null;
  return { major, minor };
}

/** "1.2" — minor is a counter, so 1.10 follows 1.9 (not a decimal). */
export function formatRevision(rev: RevisionParts): string {
  return `${rev.major}.${rev.minor}`;
}

/** The revision a save with this bump will produce. */
export function nextRevision(rev: RevisionParts, bump: RevisionBump): RevisionParts {
  if (bump === 'major') return { major: rev.major + 1, minor: 0 };
  if (bump === 'minor') return { major: rev.major, minor: rev.minor + 1 };
  return rev;
}
