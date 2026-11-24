/**
 * 24절기 시각 표 (D-039). 1919~2051년, UTC 분 단위.
 * 생성: tools/solar-terms (Skyfield + JPL DE440s, KASI 공식 시각으로 덮어씀)
 */
import table from "../data/solar-terms.json";

export const TERM_NAMES = table.names as readonly string[];
const terms = table.terms as Record<string, number[]>;

/** 월이 바뀌는 12절과 그 달의 지지 번호 (02 §2) */
export const JEOL: readonly { name: string; branch: number }[] = [
  { name: "소한", branch: 1 },
  { name: "입춘", branch: 2 },
  { name: "경칩", branch: 3 },
  { name: "청명", branch: 4 },
  { name: "입하", branch: 5 },
  { name: "망종", branch: 6 },
  { name: "소서", branch: 7 },
  { name: "입추", branch: 8 },
  { name: "백로", branch: 9 },
  { name: "한로", branch: 10 },
  { name: "입동", branch: 11 },
  { name: "대설", branch: 0 },
];

export const FIRST_TERM_YEAR = 1919;
export const LAST_TERM_YEAR = 2051;

/** 그 해 절기의 UTC 순간(ms) */
export function termUtcMs(year: number, name: string): number {
  const row = terms[String(year)];
  const i = TERM_NAMES.indexOf(name);
  const v = row?.[i];
  if (v === undefined) throw new RangeError(`no solar term ${name} for ${year}`);
  return v * 1000;
}
