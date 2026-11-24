/**
 * 사주 원국 네 기둥 계산 (docs/02-saju-rules.md §2~§4, 테스트: docs/02a)
 */
import { type GanZhi, dayGanzhi, hourGanzhi, monthGanzhi, stemIndexOf, yearGanzhi } from "./ganzhi";
import { lunarToSolar } from "./lunar";
import { JEOL, termUtcMs } from "./solarTerms";
import { HOUR_MS, naiveMs, resolveSeoulLocal, toReferenceNaive, toSeoulNaive } from "./time";

export type SajuErrorCode =
  | "INVALID_DATE"
  | "OUT_OF_RANGE"
  | "NO_SUCH_LEAP_MONTH"
  | "NONEXISTENT_TIME"
  | "INVALID_INPUT";

export class SajuError extends Error {
  constructor(public readonly code: SajuErrorCode) {
    super(code);
    this.name = "SajuError";
  }
}

export interface BirthInput {
  calendar: "solar" | "lunar";
  /** YYYY-MM-DD (음력이면 음력 날짜) */
  date: string;
  /** HH:MM (출생 당시 시계 시각) 또는 모르면 null */
  time: string | null;
  isLeapMonth?: boolean;
}

export interface Pillars {
  year: GanZhi;
  month: GanZhi;
  day: GanZhi;
  hour: GanZhi | null;
}

export interface PillarsResult {
  /** 기준시 (UTC+8:30). 시간 모름이면 null */
  referenceTime: string | null;
  solarDate: string;
  pillars: Pillars;
  flags: { solarTermDay: boolean; ambiguousTime: boolean };
  /** 출생 순간(UTC ms). 시간 모름이면 그날 정오. 대운수 계산에 쓴다 */
  birthUtcMs: number;
}

/** 음력 → 양력 변환기. 없는 윤달이면 null */
export type LunarConverter = (y: number, m: number, d: number, leap: boolean) => string | null;

export const MIN_BIRTH = "1920-01-01";
export const MAX_DATE = "2050-12-31";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function parseDate(s: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new SajuError("INVALID_INPUT");
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function parseTime(s: string): [number, number] {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new SajuError("INVALID_INPUT");
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new SajuError("INVALID_INPUT");
  return [h, mi];
}

function isRealSolarDate(y: number, mo: number, d: number): boolean {
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function naiveToParts(ms: number) {
  const t = new Date(ms);
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    mi: t.getUTCMinutes(),
  };
}

function isoDate(y: number, mo: number, d: number) {
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** 연주·월주 (입춘·12절의 절대 시각으로 판정) */
function yearAndMonth(utcMs: number, calendarYear: number): { year: GanZhi; month: GanZhi } {
  const sajuYear = utcMs >= termUtcMs(calendarYear, "입춘") ? calendarYear : calendarYear - 1;
  let branch = 0; // 그 해 소한 전이면 전년 대설부터의 자월
  for (const j of JEOL) {
    if (utcMs >= termUtcMs(calendarYear, j.name)) branch = j.branch;
    else break;
  }
  const year = yearGanzhi(sajuYear);
  return { year, month: monthGanzhi(stemIndexOf(year), branch) };
}

/** 그날(서울 시계 날짜) 12절이 드는지 */
function isJeolDay(y: number, mo: number, d: number): boolean {
  return JEOL.some((j) => {
    const p = naiveToParts(toSeoulNaive(termUtcMs(y, j.name)));
    return p.mo === mo && p.d === d;
  });
}

/** 기본 음력 변환기: 엔진에 들어 있는 KASI 음력표 */
export const defaultLunar: LunarConverter = (y, m, d, leap) => {
  try {
    return lunarToSolar(y, m, d, leap);
  } catch (e) {
    if (e instanceof RangeError) throw new SajuError("OUT_OF_RANGE");
    throw e;
  }
};

export function computePillars(
  input: BirthInput,
  lunar: LunarConverter = defaultLunar,
): PillarsResult {
  let [y, mo, d] = parseDate(input.date);
  if (input.calendar === "lunar") {
    if (d < 1 || d > 30 || mo < 1 || mo > 12) throw new SajuError("INVALID_DATE");
    const solar = lunar(y, mo, d, input.isLeapMonth ?? false);
    if (!solar) throw new SajuError(input.isLeapMonth ? "NO_SUCH_LEAP_MONTH" : "INVALID_DATE");
    [y, mo, d] = parseDate(solar);
  } else if (!isRealSolarDate(y, mo, d)) {
    throw new SajuError("INVALID_DATE");
  }
  const solarDate = isoDate(y, mo, d);
  if (solarDate < MIN_BIRTH || solarDate > MAX_DATE) throw new SajuError("OUT_OF_RANGE");

  const hourUnknown = input.time === null;
  const [h, mi] = hourUnknown ? [12, 0] : parseTime(input.time as string); // D-036: 모르면 정오
  const res = resolveSeoulLocal(naiveMs(y, mo, d, h, mi));
  if (res.kind === "nonexistent") throw new SajuError("NONEXISTENT_TIME");

  const { year, month } = yearAndMonth(res.utcMs, y);
  const flags = {
    solarTermDay: hourUnknown && isJeolDay(y, mo, d),
    ambiguousTime: !hourUnknown && res.ambiguous,
  };

  if (hourUnknown) {
    return {
      referenceTime: null,
      solarDate,
      birthUtcMs: res.utcMs,
      pillars: { year, month, day: dayGanzhi(y, mo, d), hour: null },
      flags,
    };
  }

  // D-033/D-034: 기준시(UTC+8:30) + 1시간의 날짜가 일주, 그 시(÷2)가 시지
  const ref = toReferenceNaive(res.utcMs);
  const shifted = naiveToParts(ref + HOUR_MS);
  const day = dayGanzhi(shifted.y, shifted.mo, shifted.d);
  const hourBranch = Math.floor(shifted.h / 2);
  const r = naiveToParts(ref);
  return {
    referenceTime: `${isoDate(r.y, r.mo, r.d)}T${pad(r.h)}:${pad(r.mi)}+08:30`,
    solarDate,
    birthUtcMs: res.utcMs,
    pillars: { year, month, day, hour: hourGanzhi(stemIndexOf(day), hourBranch) },
    flags,
  };
}

/** 오늘의 운세용 일진 (날짜만, F13) */
export function iljin(date: string): GanZhi {
  const [y, mo, d] = parseDate(date);
  if (!isRealSolarDate(y, mo, d)) throw new SajuError("INVALID_DATE");
  if (date < MIN_BIRTH || date > MAX_DATE) throw new SajuError("OUT_OF_RANGE");
  return dayGanzhi(y, mo, d);
}
