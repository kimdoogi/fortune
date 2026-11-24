/** 천간·지지와 60갑자 (docs/02-saju-rules.md §2, §5 기본 표) */

export const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const BRANCHES = [
  "자",
  "축",
  "인",
  "묘",
  "진",
  "사",
  "오",
  "미",
  "신",
  "유",
  "술",
  "해",
] as const;

export type Stem = (typeof STEMS)[number];
export type Branch = (typeof BRANCHES)[number];
/** "갑자" 같은 간지 두 글자 */
export type GanZhi = string;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** 60갑자 순서(갑자 = 0)의 간지 */
export function ganzhiAt(index: number): GanZhi {
  const i = mod(index, 60);
  return `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
}

/** 천간 번호와 지지 번호로 간지를 만든다. 음양이 맞지 않으면 오류 */
export function ganzhiOf(stemIndex: number, branchIndex: number): GanZhi {
  const s = mod(stemIndex, 10);
  const b = mod(branchIndex, 12);
  if (s % 2 !== b % 2) throw new Error(`invalid ganzhi pair ${s}/${b}`);
  return `${STEMS[s]}${BRANCHES[b]}`;
}

export function stemIndexOf(gz: GanZhi): number {
  const i = (STEMS as readonly string[]).indexOf(gz.charAt(0));
  if (i < 0) throw new Error(`unknown stem in ${gz}`);
  return i;
}

/** 연주: (연도 − 4) mod 60 (1984 = 갑자) */
export function yearGanzhi(sajuYear: number): GanZhi {
  return ganzhiAt(sajuYear - 4);
}

/** 월주: 월두법. 인월 천간 = (연간 mod 5) × 2 + 2 */
export function monthGanzhi(yearStem: number, monthBranch: number): GanZhi {
  const inStem = (mod(yearStem, 5) * 2 + 2) % 10;
  return ganzhiOf(inStem + mod(monthBranch - 2, 12), monthBranch);
}

/** 시주: 시두법. 자시 천간 = (일간 mod 5) × 2 */
export function hourGanzhi(dayStem: number, hourBranch: number): GanZhi {
  return ganzhiOf(mod(dayStem, 5) * 2 + hourBranch, hourBranch);
}

/** 율리우스일(정오 기준 정수) */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** 일주: (JDN + 49) mod 60. KASI 일진 218일치와 일치 확인 (docs/02a §7) */
export function dayGanzhi(year: number, month: number, day: number): GanZhi {
  return ganzhiAt(julianDayNumber(year, month, day) + 49);
}
