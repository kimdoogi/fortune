/**
 * 운: 대운, 세운·월운·일진 (docs/02-saju-rules.md §5-5, §5-6)
 */
import { type Relation, type TenGod, luckRelations, tenGodsOfGanzhi } from "./analysis";
import { type GanZhi, ganzhiAt, stemIndexOf, yearGanzhi } from "./ganzhi";
import { type Pillars, type PillarsResult, computePillars } from "./pillars";
import { JEOL, termUtcMs } from "./solarTerms";

const DAY_MS = 86_400_000;

export type Gender = "male" | "female";

export interface LuckPillar {
  pillar: GanZhi;
  fromAge: number;
  tenGods: [TenGod, TenGod];
}

export interface Daewoon {
  direction: "순행" | "역행";
  /** 대운수 = 첫 대운이 시작되는 만 나이 */
  startAge: number;
  /** 대운수 계산에 쓴 일수 (소수) */
  days: number;
  list: LuckPillar[];
  /** 오늘 기준 대운. 첫 대운 전이면 null */
  current: LuckPillar | null;
  /** 시간을 몰라 정오로 계산했으면 true (대운 시작 나이가 ±1년 달라질 수 있음) */
  approximate: boolean;
}

function indexOfGanzhi(gz: GanZhi): number {
  for (let i = 0; i < 60; i++) if (ganzhiAt(i) === gz) return i;
  throw new Error(`invalid ganzhi ${gz}`);
}

/** 만 나이 (YYYY-MM-DD 문자열 비교) */
export function manAge(birth: string, today: string): number {
  const by = Number(birth.slice(0, 4));
  const ty = Number(today.slice(0, 4));
  return ty - by - (today.slice(5) < birth.slice(5) ? 1 : 0);
}

/** 대운 (02 §5-5) */
export function computeDaewoon(
  natal: PillarsResult,
  gender: Gender,
  today: string,
  hourUnknown: boolean,
): Daewoon {
  const yang = stemIndexOf(natal.pillars.year) % 2 === 0;
  const forward = (yang && gender === "male") || (!yang && gender === "female");
  const year = Number(natal.solarDate.slice(0, 4));
  const jeol = [year - 1, year, year + 1]
    .flatMap((y) => JEOL.map((j) => termUtcMs(y, j.name)))
    .sort((a, b) => a - b);
  const birth = natal.birthUtcMs;
  const next = jeol.find((t) => t > birth);
  const prev = [...jeol].reverse().find((t) => t <= birth);
  if (next === undefined || prev === undefined) throw new RangeError("solar terms out of range");
  const days = (forward ? next - birth : birth - prev) / DAY_MS;
  const startAge = Math.min(10, Math.max(1, Math.round(days / 3)));

  const dayStem = natal.pillars.day.charAt(0);
  const base = indexOfGanzhi(natal.pillars.month);
  const list: LuckPillar[] = [];
  for (let k = 1; k <= 10; k++) {
    const pillar = ganzhiAt(base + (forward ? k : -k));
    list.push({
      pillar,
      fromAge: startAge + 10 * (k - 1),
      tenGods: tenGodsOfGanzhi(dayStem, pillar),
    });
  }
  const age = manAge(natal.solarDate, today);
  const k = age < startAge ? -1 : Math.floor((age - startAge) / 10);
  return {
    direction: forward ? "순행" : "역행",
    startAge,
    days,
    list,
    current: k >= 0 && k < 10 ? (list[k] as LuckPillar) : null,
    approximate: hourUnknown,
  };
}

export interface LuckOfDate {
  pillar: GanZhi;
  tenGods: [TenGod, TenGod];
  relations: Relation[];
}

function luckOf(name: string, gz: GanZhi, natal: Pillars): LuckOfDate {
  return {
    pillar: gz,
    tenGods: tenGodsOfGanzhi(natal.day.charAt(0), gz),
    relations: luckRelations(name, gz, natal),
  };
}

/** 그 날짜(서울 정오 기준)의 세운·월운·일진과 원국의 관계 (02 §5-6) */
export function luckAt(
  natal: Pillars,
  date: string,
): {
  date: string;
  sewoon: LuckOfDate;
  wolwoon: LuckOfDate;
  iljin: LuckOfDate;
} {
  const p = computePillars({ calendar: "solar", date, time: "12:00" }).pillars;
  return {
    date,
    sewoon: luckOf("세운", p.year, natal),
    wolwoon: luckOf("월운", p.month, natal),
    iljin: luckOf("일진", p.day, natal),
  };
}

/** 신년운세용: 그 해(입춘부터)의 세운 */
export function sewoonOfYear(year: number, natal: Pillars): LuckOfDate & { year: number } {
  return { year, ...luckOf("세운", yearGanzhi(year), natal) };
}

/** 대운 하나를 원국과 비교 */
export function daewoonRelations(d: LuckPillar, natal: Pillars): Relation[] {
  return luckRelations("대운", d.pillar, natal);
}
