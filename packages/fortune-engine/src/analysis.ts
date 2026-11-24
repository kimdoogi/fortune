/**
 * 원국 분석: 오행, 십신, 신강·신약, 용신, 합충 (docs/02-saju-rules.md §5-1~§5-4, §5-7)
 */
import { BRANCHES, type GanZhi, STEMS } from "./ganzhi";
import type { Pillars } from "./pillars";

export const ELEMENTS = ["목", "화", "토", "금", "수"] as const;
export type Element = (typeof ELEMENTS)[number];
export type YinYang = "양" | "음";
export type TenGod =
  | "비견"
  | "겁재"
  | "식신"
  | "상관"
  | "편재"
  | "정재"
  | "편관"
  | "정관"
  | "편인"
  | "정인";
type Group = "비겁" | "식상" | "재성" | "관성" | "인성";

const STEM_ELEMENT: Element[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
/** 지지 본기 천간 (02 §5 기본 표) */
const BRANCH_MAIN_STEM = ["계", "기", "갑", "을", "무", "병", "정", "기", "경", "신", "무", "임"];

interface CharInfo {
  element: Element;
  yinYang: YinYang;
}

export function stemInfo(stem: string): CharInfo {
  const i = (STEMS as readonly string[]).indexOf(stem);
  if (i < 0) throw new Error(`unknown stem ${stem}`);
  return { element: STEM_ELEMENT[i] as Element, yinYang: i % 2 === 0 ? "양" : "음" };
}

export function branchInfo(branch: string): CharInfo {
  const i = (BRANCHES as readonly string[]).indexOf(branch);
  if (i < 0) throw new Error(`unknown branch ${branch}`);
  return stemInfo(BRANCH_MAIN_STEM[i] as string);
}

const elIndex = (e: Element) => ELEMENTS.indexOf(e);
/** a가 생하는 오행 */
export const generates = (e: Element): Element => ELEMENTS[(elIndex(e) + 1) % 5] as Element;
/** a를 생하는 오행 */
export const generatedBy = (e: Element): Element => ELEMENTS[(elIndex(e) + 4) % 5] as Element;

function groupOf(dm: Element, x: Element): Group {
  const d = (elIndex(x) - elIndex(dm) + 5) % 5;
  return (["비겁", "식상", "재성", "관성", "인성"] as const)[d] as Group;
}

/** 일간 기준 그룹의 오행 */
function elementOfGroup(dm: Element, g: Group): Element {
  const k = ["비겁", "식상", "재성", "관성", "인성"].indexOf(g);
  return ELEMENTS[(elIndex(dm) + k) % 5] as Element;
}

const TEN_GOD: Record<Group, [TenGod, TenGod]> = {
  비겁: ["비견", "겁재"],
  식상: ["식신", "상관"],
  재성: ["편재", "정재"],
  관성: ["편관", "정관"],
  인성: ["편인", "정인"],
};

/** 일간 기준 십신 (02 §5-2). 음양이 같으면 앞의 것 */
export function tenGodOf(dayStem: string, x: CharInfo): TenGod {
  const dm = stemInfo(dayStem);
  const pair = TEN_GOD[groupOf(dm.element, x.element)];
  return pair[dm.yinYang === x.yinYang ? 0 : 1];
}

export function tenGodsOfGanzhi(dayStem: string, gz: GanZhi): [TenGod, TenGod] {
  return [tenGodOf(dayStem, stemInfo(gz.charAt(0))), tenGodOf(dayStem, branchInfo(gz.charAt(1)))];
}

type PositionKey =
  | "yearStem"
  | "monthStem"
  | "dayStem"
  | "hourStem"
  | "yearBranch"
  | "monthBranch"
  | "dayBranch"
  | "hourBranch";

const POSITION_LABEL: Record<PositionKey, string> = {
  yearStem: "연간",
  monthStem: "월간",
  dayStem: "일간",
  hourStem: "시간",
  yearBranch: "연지",
  monthBranch: "월지",
  dayBranch: "일지",
  hourBranch: "시지",
};

/** 신강 점수 가중치 (02 §5-3) */
const WEIGHT: Record<Exclude<PositionKey, "dayStem">, number> = {
  yearStem: 1,
  monthStem: 1,
  hourStem: 1,
  yearBranch: 1,
  monthBranch: 3,
  dayBranch: 1.5,
  hourBranch: 1,
};

interface Position {
  key: PositionKey;
  char: string;
  kind: "stem" | "branch";
  info: CharInfo;
}

function positionsOf(p: Pillars): Position[] {
  const out: Position[] = [];
  const add = (key: PositionKey, char: string, kind: "stem" | "branch") =>
    out.push({ key, char, kind, info: kind === "stem" ? stemInfo(char) : branchInfo(char) });
  add("yearStem", p.year.charAt(0), "stem");
  add("monthStem", p.month.charAt(0), "stem");
  add("dayStem", p.day.charAt(0), "stem");
  if (p.hour) add("hourStem", p.hour.charAt(0), "stem");
  add("yearBranch", p.year.charAt(1), "branch");
  add("monthBranch", p.month.charAt(1), "branch");
  add("dayBranch", p.day.charAt(1), "branch");
  if (p.hour) add("hourBranch", p.hour.charAt(1), "branch");
  return out;
}

// ---------- 합충 (02 §5-7) ----------
const STEM_COMBINE = ["갑기", "을경", "병신", "정임", "무계"];
const STEM_CLASH = ["갑경", "을신", "병임", "정계"];
const BRANCH_COMBINE = ["자축", "인해", "묘술", "진유", "사신", "오미"];
const BRANCH_CLASH = ["자오", "축미", "인신", "묘유", "진술", "사해"];

export type RelationType = "천간합" | "천간충" | "지지육합" | "지지육충";
export interface Relation {
  type: RelationType;
  /** 예: "세운 지지 오", "연간 갑" */
  a: string;
  b: string;
}

const matches = (list: string[], x: string, y: string) =>
  list.includes(x + y) || list.includes(y + x);

export function relationBetween(
  kind: "stem" | "branch",
  x: string,
  y: string,
): RelationType | null {
  if (kind === "stem") {
    if (matches(STEM_COMBINE, x, y)) return "천간합";
    if (matches(STEM_CLASH, x, y)) return "천간충";
  } else {
    if (matches(BRANCH_COMBINE, x, y)) return "지지육합";
    if (matches(BRANCH_CLASH, x, y)) return "지지육충";
  }
  return null;
}

const label = (pos: Position) => `${POSITION_LABEL[pos.key]} ${pos.char}`;

/** 원국끼리의 합충. 앞 자리(연→월→일→시)가 a */
function natalRelations(ps: Position[]): Relation[] {
  const out: Relation[] = [];
  for (const kind of ["stem", "branch"] as const) {
    const same = ps.filter((p) => p.kind === kind);
    for (let i = 0; i < same.length; i++) {
      for (let j = i + 1; j < same.length; j++) {
        const a = same[i] as Position;
        const b = same[j] as Position;
        const t = relationBetween(kind, a.char, b.char);
        if (t) out.push({ type: t, a: label(a), b: label(b) });
      }
    }
  }
  return out;
}

/** 운 간지(예: 세운)와 원국 사이의 합충 */
export function luckRelations(luckName: string, gz: GanZhi, p: Pillars): Relation[] {
  const out: Relation[] = [];
  for (const pos of positionsOf(p)) {
    const ch = pos.kind === "stem" ? gz.charAt(0) : gz.charAt(1);
    const t = relationBetween(pos.kind, ch, pos.char);
    if (t) {
      const where = pos.kind === "stem" ? "천간" : "지지";
      out.push({ type: t, a: `${luckName} ${where} ${ch}`, b: label(pos) });
    }
  }
  return out;
}

// ---------- 원국 분석 ----------
export interface ChartAnalysis {
  dayMaster: { stem: string; element: Element; yinYang: YinYang };
  elements: { counts: Record<Element, number>; missing: Element[]; excess: Element[] };
  tenGods: Record<Exclude<PositionKey, "dayStem">, TenGod | null>;
  strength: { label: "신강" | "신약" | "중화"; ratio: number };
  yongsin: { yongsin: Element; huisin: Element; method: "억부" };
  relations: Relation[];
}

export function analyzePillars(p: Pillars): ChartAnalysis {
  const ps = positionsOf(p);
  const dayStem = p.day.charAt(0);
  const dm = stemInfo(dayStem);

  // 5-1 오행 분포
  const counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const pos of ps) counts[pos.info.element] += 1;
  const missing = ELEMENTS.filter((e) => counts[e] === 0);
  const excess = ELEMENTS.filter((e) => counts[e] >= 3);

  // 5-2 십신
  const tenGods: ChartAnalysis["tenGods"] = {
    yearStem: null,
    monthStem: null,
    hourStem: null,
    yearBranch: null,
    monthBranch: null,
    dayBranch: null,
    hourBranch: null,
  };
  for (const pos of ps) {
    if (pos.key !== "dayStem") tenGods[pos.key] = tenGodOf(dayStem, pos.info);
  }

  // 5-3 신강·신약 (일간 제외, 자리 가중치)
  const score = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  let help = 0;
  let total = 0;
  for (const pos of ps) {
    if (pos.key === "dayStem") continue;
    const w = WEIGHT[pos.key];
    score[pos.info.element] += w;
    total += w;
    const g = groupOf(dm.element, pos.info.element);
    if (g === "비겁" || g === "인성") help += w;
  }
  const ratio = total === 0 ? 0 : help / total;
  const strengthLabel = ratio >= 0.55 ? "신강" : ratio <= 0.45 ? "신약" : "중화";

  // 5-4 용신·희신 (억부)
  const el = (g: Group) => elementOfGroup(dm.element, g);
  let yongsin: Element;
  let huisin: Element;
  if (strengthLabel === "신약") {
    yongsin = el("인성");
    huisin = el("비겁");
  } else if (strengthLabel === "신강") {
    if (score[el("인성")] > score[el("비겁")]) {
      yongsin = el("재성");
      huisin = el("식상");
    } else {
      yongsin = score[el("관성")] === 0 ? el("식상") : el("관성");
      huisin = el("재성");
    }
  } else {
    // 중화: 점수가 가장 낮은 오행, 동점이면 목→화→토→금→수
    yongsin = ELEMENTS.reduce((best, e) => (score[e] < score[best] ? e : best), ELEMENTS[0]);
    huisin = generatedBy(yongsin);
  }

  return {
    dayMaster: { stem: dayStem, element: dm.element, yinYang: dm.yinYang },
    elements: { counts, missing, excess },
    tenGods,
    strength: { label: strengthLabel, ratio: Math.round(ratio * 100) / 100 },
    yongsin: { yongsin, huisin, method: "억부" },
    relations: natalRelations(ps),
  };
}
