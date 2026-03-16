export function isInTimeWindow(nowMinute: number, startMinute: number, endMinute: number) {
  if (startMinute < endMinute) {
    return nowMinute >= startMinute && nowMinute < endMinute;
  }

  return nowMinute >= startMinute || nowMinute < endMinute;
}

export function minuteToHHMM(minute: number) {
  const h = String(Math.floor(minute / 60)).padStart(2, '0');
  const m = String(minute % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatTimeRangeLabel(startMinute: number, endMinute: number) {
  const start = minuteToHHMM(startMinute);
  const end = minuteToHHMM(endMinute);
  if (startMinute < endMinute) {
    return `${start} - ${end}`;
  }
  return `${start} - 다음날 ${end}`;
}

export function addOneHourHHMM(value: string) {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;

  const endMinute = (h * 60 + m + 60) % (24 * 60);
  const endH = String(Math.floor(endMinute / 60)).padStart(2, '0');
  const endM = String(endMinute % 60).padStart(2, '0');
  return `${endH}:${endM}`;
}


export function getNowMinute() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function formatKoreanTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function hhmmToMinute(value: string) {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
