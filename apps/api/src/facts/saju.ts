/**
 * 사주 정밀·오늘의 운세 입력 만들기 (docs/04 §3-2, docs/02 §7, F05, F13).
 * 엔진 계산 결과를 받아 facts 문장과 chart·luck 필드를 만든다.
 */
import {
  type ChartAnalysis,
  type Daewoon,
  type DailyLabel,
  type LuckOfDate,
  type MonthLuck,
  type PillarsResult,
  type Relation,
  type TenGod,
  dailyScore,
  generatedBy,
  luckyNumbers,
  stemInfo,
  tenGodsOfGanzhi,
  withWa,
} from "@fortune/fortune-engine";
import type { SajuBoard } from "@fortune/shared-types";
import { LUCKY_COLOR, SAJU } from "./data";

const POSITION_NAME: Record<string, string> = {
  yearStem: "연간",
  monthStem: "월간",
  hourStem: "시간",
  yearBranch: "연지",
  monthBranch: "월지",
  dayBranch: "일지",
  hourBranch: "시지",
};

export function dayMasterFact(stem: string): string {
  const info = stemInfo(stem);
  const dm = SAJU.dayMaster[stem];
  if (!dm) throw new Error(`unknown stem ${stem}`);
  return `일간은 ${stem}(${info.yinYang}의 ${info.element})으로 '${dm.nature}'의 기운이다. ${dm.summary} 성향: ${dm.keywords.join(", ")}.`;
}

function tenGodLuckFact(label: string, gods: readonly TenGod[]): string {
  const parts = [...new Set(gods)].map((g) => `${g}: ${SAJU.tenGods[g]?.luck ?? ""}`);
  return `${label} 십신은 ${gods.join("·")}이다. ${parts.join(" ")}`;
}

function relationFact(r: Relation, kind: "natal" | "luck"): string {
  const m = SAJU.relations[r.type];
  return `${r.a}와 ${r.b}가 ${r.type}: ${m ? m[kind] : ""}`;
}

/** 월운 한 달의 사실 문장 (D-079): 등급 이유 + 십신별 생활 기회·조심 + 충이 닿는 자리 */
export function monthFact(m: MonthLuck, thisYear: number): string {
  const when = m.year === thisYear ? `${m.month}월` : `${m.year}년 ${m.month}월`;
  const head = `${m.grade === "good" ? "좋은 달" : "조심할 달"} ${when}(월운 ${m.pillar}, ${m.tenGods.join("·")})`;
  const why = m.reasons.length ? `${m.reasons.join(", ")}.` : "큰 힘이 들어오지도 빠지지도 않는다.";
  const [g1, g2] = m.tenGods;
  const pickFrom = (key: "chance" | "caution") => {
    const a = SAJU.tenGods[g1]?.[key] ?? [];
    const b = g2 !== g1 ? (SAJU.tenGods[g2]?.[key] ?? []) : [];
    return [...a.slice(0, 2), ...b.slice(0, 1)];
  };
  const parts = [`${head}: ${why}`];
  if (m.grade === "good") {
    parts.push(`생길 수 있는 좋은 일: ${pickFrom("chance").join(", ")}.`);
  } else {
    parts.push(`조심할 일: ${pickFrom("caution").join(", ")}.`);
    for (const r of m.relations) {
      if (r.type !== "지지육충" && r.type !== "천간충") continue;
      const where = r.b.split(" ")[0] ?? "";
      const meaning = SAJU.clashPositions[where];
      if (meaning) parts.push(`${withWa(where)} 충: ${meaning}`);
    }
  }
  return parts.join(" ");
}

export function luckyColorOf(element: string): string {
  return LUCKY_COLOR[element] ?? "흰색";
}

export interface SajuFullParts {
  facts: string[];
  chart: Record<string, unknown>;
  luck: Record<string, unknown>;
  board: SajuBoard;
  luckyColor: string;
}

/** 사주 정밀 (F05): 원국 + 현재 대운 + 올해 세운 */
export function buildSajuFull(
  natal: PillarsResult,
  a: ChartAnalysis,
  daewoon: Daewoon,
  sewoon: LuckOfDate & { year: number },
  months: MonthLuck[] = [],
  nextSewoon: (LuckOfDate & { year: number }) | null = null,
): SajuFullParts {
  const p = natal.pillars;
  const hourUnknown = p.hour === null;
  const facts: string[] = [];
  facts.push(dayMasterFact(a.dayMaster.stem));
  if (hourUnknown) facts.push("태어난 시간을 몰라 시주 없이 세 기둥으로 본다.");

  // 원국 십신 (자리별, 같은 십신은 한 번만 설명)
  const seen = new Set<string>();
  for (const god of Object.values(a.tenGods)) {
    if (!god || seen.has(god)) continue;
    seen.add(god);
    const where = Object.entries(a.tenGods)
      .filter(([, g]) => g === god)
      .map(([k]) => POSITION_NAME[k] ?? k)
      .join("·");
    facts.push(`원국 ${where}의 ${god}: ${SAJU.tenGods[god]?.natal ?? ""}`);
  }

  // 오행 과다·부족
  const counts = Object.entries(a.elements.counts)
    .map(([e, n]) => `${e} ${n}`)
    .join(", ");
  facts.push(`오행 분포는 ${counts}이다.`);
  for (const e of a.elements.excess) facts.push(SAJU.elements[e]?.excess ?? "");
  for (const e of a.elements.missing) facts.push(SAJU.elements[e]?.missing ?? "");

  // 신강·신약, 용신
  facts.push(`${a.strength.label}: ${SAJU.strength[a.strength.label] ?? ""}`);
  const y = SAJU.yongsin[a.yongsin.yongsin];
  if (y) {
    facts.push(
      `용신은 ${a.yongsin.yongsin}, 희신은 ${a.yongsin.huisin}이다. ${y.advice} 좋은 방향: ${y.direction}. 도움이 되는 활동: ${y.activities.join(", ")}.`,
    );
  }

  // 합충
  for (const r of a.relations) facts.push(relationFact(r, "natal"));

  // 대운·세운
  if (daewoon.current) {
    const c = daewoon.current;
    facts.push(
      `지금은 ${c.fromAge}세부터 시작한 ${c.pillar} 대운(${daewoon.direction})이다. ${tenGodLuckFact("이 대운의", c.tenGods)}`,
    );
  } else {
    facts.push(`첫 대운은 ${daewoon.startAge}세에 시작해서 아직 대운이 들기 전이다.`);
  }
  facts.push(
    `올해 ${sewoon.year}년 세운은 ${sewoon.pillar}이다. ${tenGodLuckFact("올해의", sewoon.tenGods)}`,
  );
  for (const r of sewoon.relations) facts.push(relationFact(r, "luck"));
  if (nextSewoon) {
    facts.push(
      `내년 ${nextSewoon.year}년 세운은 ${nextSewoon.pillar}이다 (입춘부터). ${tenGodLuckFact("내년의", nextSewoon.tenGods)}`,
    );
    for (const r of nextSewoon.relations) facts.push(relationFact(r, "luck"));
  }

  // 앞으로 12달 (D-079): 코드가 고른 좋은 달·조심할 달만 자세히
  if (months.length > 0) {
    const first = months[0] as MonthLuck;
    const last = months[months.length - 1] as MonthLuck;
    facts.push(
      `월별 운세는 ${first.year}년 ${first.month}월부터 ${last.year}년 ${last.month}월까지 12달을 본다. 아래 좋은 달·조심할 달만 말하고 나머지 달은 보통이다.`,
    );
    for (const m of months) if (m.grade !== "normal") facts.push(monthFact(m, sewoon.year));
  }

  const luckyColor = luckyColorOf(a.yongsin.yongsin);
  facts.push(`행운의 색: ${luckyColor}`);

  const chart = {
    pillars: { year: p.year, month: p.month, day: p.day, hour: p.hour },
    hourUnknown,
    solarTermDay: natal.flags.solarTermDay,
    dayMaster: a.dayMaster,
    elements: a.elements,
    tenGods: a.tenGods,
    strength: a.strength,
    yongsin: a.yongsin,
    relations: a.relations,
  };
  const luck = {
    daewoon: {
      direction: daewoon.direction,
      startAge: daewoon.startAge,
      current: daewoon.current
        ? {
            pillar: daewoon.current.pillar,
            fromAge: daewoon.current.fromAge,
            tenGods: daewoon.current.tenGods,
          }
        : null,
    },
    sewoon: {
      year: sewoon.year,
      pillar: sewoon.pillar,
      tenGods: sewoon.tenGods,
      relations: sewoon.relations,
    },
    nextSewoon: nextSewoon
      ? { year: nextSewoon.year, pillar: nextSewoon.pillar, tenGods: nextSewoon.tenGods }
      : null,
    months: months.map((m) => ({
      year: m.year,
      month: m.month,
      pillar: m.pillar,
      tenGods: m.tenGods,
      score: m.score,
      grade: m.grade,
    })),
    iljin: null,
  };
  const board: SajuBoard = {
    pillars: { year: p.year, month: p.month, day: p.day, hour: p.hour },
    hourUnknown,
    dayMaster: a.dayMaster,
    elements: a.elements.counts,
    strength: a.strength.label,
    yongsin: a.yongsin.yongsin,
    months: months.map((m) => ({ year: m.year, month: m.month, grade: m.grade })),
  };
  return {
    facts: facts.filter((f) => f.length > 0),
    chart,
    luck,
    board,
    luckyColor,
  };
}

export interface DailyParts {
  facts: string[];
  luckyColor: string;
  tenGods: [TenGod, TenGod];
  score: number;
  scoreLabel: DailyLabel;
  luckyNumbers: number[];
}

/**
 * 오늘의 운세 (F13): 일간 × 오늘 일진만으로 정한다 (개인 원국은 쓰지 않음, docs/04 §8).
 * 행운의 색은 용신을 알 수 없어 일간을 생하는 오행(인성)의 색으로 정한다.
 */
export function buildDaily(stem: string, iljin: string, date: string): DailyParts {
  const tenGods = tenGodsOfGanzhi(stem, iljin);
  const luckyColor = luckyColorOf(generatedBy(stemInfo(stem).element));
  const { score, label } = dailyScore(stem, iljin, date);
  const numbers = luckyNumbers(stem);
  const facts = [
    dayMasterFact(stem),
    `오늘 일진은 ${iljin}이다. ${tenGodLuckFact("오늘 일진의", tenGods)}`,
    `오늘 운세 점수: ${score}점(${label}). 화면에 점수가 함께 나가니 말의 밝기를 점수 등급에 맞춘다.`,
    `행운의 숫자: ${numbers.join(", ")}`,
    `행운의 색: ${luckyColor}`,
  ];
  return { facts, luckyColor, tenGods, score, scoreLabel: label, luckyNumbers: numbers };
}
