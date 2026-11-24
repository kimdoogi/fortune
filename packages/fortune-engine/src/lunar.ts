/**
 * 음력 → 양력 변환 (docs/02-saju-rules.md §1)
 * 데이터: KASI 음양력 변환 결과로 만든 표 (tools/lunar-table)
 *   years["1985"] = [음력 1월 1일의 양력 날짜, 윤달(없으면 0), 달 길이 비트("1"=30일, "0"=29일)]
 *   비트는 달이 오는 순서대로이고, 윤달은 그 평달 바로 뒤에 온다.
 */
import table from "../data/lunar.json";

type Row = [string, number, string];
const years = table.years as unknown as Record<string, Row>;

export const FIRST_LUNAR_YEAR = Number(Object.keys(years)[0]);
export const LAST_LUNAR_YEAR = Number(Object.keys(years).at(-1));

const DAY = 86_400_000;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return t.toISOString().slice(0, 10);
}

/** 그 음력 해의 달 목록: [달, 윤달 여부, 일수] 순서대로 */
export function lunarMonths(year: number): { month: number; leap: boolean; days: number }[] {
  const row = years[String(year)];
  if (!row) throw new RangeError(`no lunar data for ${year}`);
  const [, leapMonth, bits] = row;
  const out: { month: number; leap: boolean; days: number }[] = [];
  let i = 0;
  for (let m = 1; m <= 12; m++) {
    out.push({ month: m, leap: false, days: bits[i++] === "1" ? 30 : 29 });
    if (m === leapMonth) out.push({ month: m, leap: true, days: bits[i++] === "1" ? 30 : 29 });
  }
  return out;
}

/**
 * 음력 날짜 → 양력 "YYYY-MM-DD". 없는 날짜·없는 윤달이면 null.
 * 표 범위 밖이면 RangeError.
 */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  leap: boolean,
): string | null {
  const row = years[String(year)];
  if (!row) throw new RangeError(`no lunar data for ${year}`);
  let offset = 0;
  for (const m of lunarMonths(year)) {
    if (m.month === month && m.leap === leap) {
      if (day < 1 || day > m.days) return null;
      return addDays(row[0], offset + day - 1);
    }
    offset += m.days;
  }
  return null; // 그 해에 그런 윤달이 없음
}
