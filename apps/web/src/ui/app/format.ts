/** 날짜 표시 (한국 시간 기준, F13 "오늘"은 한국 자정) */

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function kstParts(d: Date) {
  // UTC에 9시간을 더해 UTC 필드로 읽으면 한국 시간이 된다
  const k = new Date(d.getTime() + 9 * 3600_000);
  return {
    y: k.getUTCFullYear(),
    m: k.getUTCMonth() + 1,
    d: k.getUTCDate(),
    w: WEEK[k.getUTCDay()] ?? "",
    hh: k.getUTCHours(),
    mm: k.getUTCMinutes(),
  };
}

/** "2026년 11월 25일 수요일" (YYYY-MM-DD 문자열) */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
  return `${y}년 ${m}월 ${d}일 ${w}요일`;
}

/** 기록 목록용: 올해면 "11월 25일 (수) 오후 3:20", 아니면 연도 포함 */
export function shortDateTime(iso: string): string {
  const p = kstParts(new Date(iso));
  const now = kstParts(new Date());
  const ampm = p.hh < 12 ? "오전" : "오후";
  const h = p.hh % 12 === 0 ? 12 : p.hh % 12;
  const time = `${ampm} ${h}:${String(p.mm).padStart(2, "0")}`;
  const day = `${p.m}월 ${p.d}일 (${p.w})`;
  return p.y === now.y ? `${day} ${time}` : `${p.y}년 ${day}`;
}

/** 기록 목록을 날짜로 묶는 열쇠 "2026-11-25" */
export function dayKey(iso: string): string {
  const p = kstParts(new Date(iso));
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** 한국 시간 오늘 */
export function todayKst(): { y: number; m: number; d: number } {
  const p = kstParts(new Date());
  return { y: p.y, m: p.m, d: p.d };
}
