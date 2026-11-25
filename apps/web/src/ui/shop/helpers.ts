/**
 * 점집 화면의 작은 순수 함수들 (테스트: helpers.test.ts).
 */
import type { ProfileView } from "@fortune/shared-types";

/** 결과가 너무 빨리 와도 연출이 끝까지 보이도록 최소 시간을 지킨다 (06, D-044) */
export function atLeast<T>(p: Promise<T>, ms: number): Promise<T> {
  const wait = new Promise((r) => setTimeout(r, ms));
  return Promise.all([p, wait]).then(([v]) => v);
}

/** 부채꼴 카드 각도 (도). 가운데가 0 */
export function fanAngles(n: number, spread: number): number[] {
  if (n <= 1) return [0];
  return Array.from({ length: n }, (_, i) =>
    Number((-spread / 2 + (spread * i) / (n - 1)).toFixed(2)),
  );
}

/** 받침 있으면 "아", 없으면 "야" (아기도령 호칭, 04a) */
export function josaA(name: string): string {
  const last = [...name].at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "아" : "야";
}

const hasBatchim = (name: string) => {
  const code = ([...name].at(-1) ?? "").charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};

/** 받침 있으면 "이랑", 없으면 "랑" */
export const josaRang = (name: string) => (hasBatchim(name) ? "이랑" : "랑");

/** 받침 있으면 "이", 없으면 "가" */
export const josaGa = (name: string) => (hasBatchim(name) ? "이" : "가");

/** "1995년 3월 12일 양력 · 오후 2시 30분" */
export function birthLine(
  p: Pick<ProfileView, "birthDate" | "calendar" | "isLeapMonth" | "birthTime">,
): string {
  const [y, m, d] = p.birthDate.split("-").map(Number);
  const cal = p.calendar === "lunar" ? (p.isLeapMonth ? "음력 윤달" : "음력") : "양력";
  const bt = p.birthTime;
  let time = "태어난 시간 모름";
  if (bt.kind === "clock") {
    const ampm = bt.hour < 12 ? "오전" : "오후";
    const h = bt.hour % 12 === 0 ? 12 : bt.hour % 12;
    time = `${ampm} ${h}시${bt.minute ? ` ${bt.minute}분` : ""}`;
  } else if (bt.kind === "branch") {
    time = `${bt.branch}시`;
  }
  return `${y}년 ${m}월 ${d}일 ${cal} · ${time}`;
}

const WEEK = "일월화수목금토";

/** "2026-11-25" → "11월 25일 수요일" */
export function dailyDateLabel(date: string): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
  return `${m}월 ${d}일 ${w}요일`;
}
