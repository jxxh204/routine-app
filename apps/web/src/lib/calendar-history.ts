export type DoneItem = {
  id: string;
  title?: string;
  doneByMe?: boolean;
  doneAt?: string;
  proofImage?: string;
  proofImagePath?: string;
};

export type DayHistory = {
  date: string;
  items: DoneItem[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHistoryEntries(entries: Array<{ key: string; value: string | null }>, prefix: string): DayHistory[] {
  const rows: DayHistory[] = [];

  for (const { key, value } of entries) {
    if (!key.startsWith(prefix)) continue;

    const date = key.slice(prefix.length);
    if (!DATE_RE.test(date) || !value) continue;

    try {
      const parsed = JSON.parse(value) as DoneItem[];
      const done = parsed.filter((item) => item?.doneByMe);
      if (done.length > 0) rows.push({ date, items: done });
    } catch {
      // ignore malformed rows
    }
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getMonthMatrix(base: Date): Date[] {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
