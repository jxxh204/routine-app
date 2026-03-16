export function getMonthMatrix(baseDate: Date) {
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startDay = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - startDay);

  return Array.from({ length: 42 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
}

export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
