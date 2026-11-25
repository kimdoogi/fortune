/** 한국 시간 기준 날짜 ("오늘"은 KST 자정 기준, F13) */
const KST_MS = 9 * 3_600_000;

/** 한국 시간 오늘 날짜 YYYY-MM-DD */
export function todayKst(now = Date.now()): string {
  return new Date(now + KST_MS).toISOString().slice(0, 10);
}

/** 한국 시간 그 날짜 자정의 ISO(UTC) 시각. created_at 비교용 */
export function kstDayStartIso(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00+09:00`)).toISOString();
}

export const nowIso = (now = Date.now()) => new Date(now).toISOString();
