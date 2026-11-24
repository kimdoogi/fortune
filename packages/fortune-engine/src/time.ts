/**
 * 한국 시간대 이력과 기준시 (docs/02-saju-rules.md §3, D-032~D-038)
 * 데이터: IANA tz database Asia/Seoul (tools/tz-history)
 */
import tz from "../data/tz-seoul.json";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** 기준시 = UTC+8:30 (D-034) */
export const REFERENCE_OFFSET_MIN = 510;

const transitions = tz.transitions as [number, number][];
const offsets = [...new Set(transitions.map(([, o]) => o))];

/** UTC 순간(ms)에 적용되는 서울 표준시·서머타임 오프셋(분) */
export function seoulOffsetAt(utcMs: number): number {
  const s = utcMs / 1000;
  let off = transitions[0]?.[1] ?? 540;
  for (const [t, o] of transitions) {
    if (t <= s) off = o;
    else break;
  }
  return off;
}

/** 시계 시각을 "UTC인 척하는" ms로 표현한 값 */
export function naiveMs(y: number, mo: number, d: number, h = 0, mi = 0): number {
  return Date.UTC(y, mo - 1, d, h, mi);
}

export type LocalResolution =
  | { kind: "ok"; utcMs: number; offsetMin: number; ambiguous: boolean }
  | { kind: "nonexistent" };

/**
 * 서울 시계 시각 → UTC.
 * - 없는 시각(서머타임 시작, 1961년 30분 앞당김) → nonexistent (D-037)
 * - 두 번 있는 시각(서머타임 종료, 1954년 30분 늦춤) → 먼저 지나간 쪽, ambiguous (D-038)
 */
export function resolveSeoulLocal(localNaiveMs: number): LocalResolution {
  const valid = offsets
    .map((o) => ({ o, utc: localNaiveMs - o * MINUTE }))
    .filter(({ o, utc }) => seoulOffsetAt(utc) === o)
    .sort((a, b) => a.utc - b.utc);
  const first = valid[0];
  if (!first) return { kind: "nonexistent" };
  return { kind: "ok", utcMs: first.utc, offsetMin: first.o, ambiguous: valid.length > 1 };
}

/** UTC → 기준시(UTC+8:30)의 naive ms */
export function toReferenceNaive(utcMs: number): number {
  return utcMs + REFERENCE_OFFSET_MIN * MINUTE;
}

/** UTC → 그 순간의 서울 시계 naive ms */
export function toSeoulNaive(utcMs: number): number {
  return utcMs + seoulOffsetAt(utcMs) * MINUTE;
}

export const HOUR_MS = HOUR;
export const MINUTE_MS = MINUTE;
