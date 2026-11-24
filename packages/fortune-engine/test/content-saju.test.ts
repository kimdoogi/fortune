/**
 * 해석 데이터(docs/02 §7), 오방기 의미표(docs/03 아기도령), 캐릭터 인사말(docs/04a)의
 * 형식을 검사하고, docs/04 §7 금지 표현 목록 v1이 들어 있지 않은지 확인한다.
 */
import { describe, expect, it } from "vitest";
import { findBanned, greetings } from "../../prompts/src/index";
import obanggi from "../data/meanings/obanggi.json";
import saju from "../data/meanings/saju.json";

const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const TEN_GODS = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];
const ELEMENTS = ["목", "화", "토", "금", "수"];
const STRENGTHS = ["신강", "신약", "중화"];
const DIRECTIONS = ["동", "남", "중앙", "서", "북"];
const RELATIONS = ["천간합", "천간충", "지지육합", "지지육충"];
const FLAGS = ["빨강", "노랑", "파랑", "하양", "초록"];
const GRADES = ["대길", "길", "평", "주의"];
const CATEGORIES = ["연애", "재물", "직장", "건강", "기타"];
const SHOPS = ["saju", "tarot", "dolyeong", "dream"];

/** 금지 표현 목록 v1은 packages/prompts/common/banned.json 한 곳에서 관리한다 */
const bannedHits = findBanned;

function allStrings(value: unknown, path = "$"): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => allStrings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => allStrings(v, `${path}.${k}`));
  }
  return [];
}

const len = (s: string) => [...s].length;

function isSentence(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

function expectStringArray(v: unknown, min: number, max: number) {
  expect(Array.isArray(v)).toBe(true);
  const arr = v as unknown[];
  expect(arr.length).toBeGreaterThanOrEqual(min);
  expect(arr.length).toBeLessThanOrEqual(max);
  for (const x of arr) expect(isSentence(x)).toBe(true);
  expect(new Set(arr).size).toBe(arr.length);
}

function expectExactKeys(obj: object, keys: string[]) {
  expect(Object.keys(obj).sort()).toEqual([...keys].sort());
}

type Rec = Record<string, Record<string, unknown>>;

describe("사주 해석 데이터 (data/meanings/saju.json)", () => {
  it("최상위 키 6개", () => {
    expectExactKeys(saju, ["dayMaster", "tenGods", "elements", "strength", "yongsin", "relations"]);
  });

  it("일간 10개: nature, keywords 4~6개, summary 60자 이하", () => {
    const dm = saju.dayMaster as Rec;
    expectExactKeys(dm, STEMS);
    for (const stem of STEMS) {
      const e = dm[stem];
      expect(e, stem).toBeDefined();
      if (!e) continue;
      expect(isSentence(e.nature), `${stem}.nature`).toBe(true);
      expectStringArray(e.keywords, 4, 6);
      expect(isSentence(e.summary), `${stem}.summary`).toBe(true);
      expect(len(e.summary as string), `${stem}.summary 길이`).toBeLessThanOrEqual(60);
    }
  });

  it("십신 10개: keywords 3~5개, natal, luck", () => {
    const tg = saju.tenGods as Rec;
    expectExactKeys(tg, TEN_GODS);
    for (const god of TEN_GODS) {
      const e = tg[god];
      expect(e, god).toBeDefined();
      if (!e) continue;
      expectStringArray(e.keywords, 3, 5);
      expect(isSentence(e.natal), `${god}.natal`).toBe(true);
      expect(isSentence(e.luck), `${god}.luck`).toBe(true);
    }
  });

  it("오행 5개: excess, missing", () => {
    const el = saju.elements as Rec;
    expectExactKeys(el, ELEMENTS);
    for (const e of ELEMENTS) {
      expect(isSentence(el[e]?.excess), `${e}.excess`).toBe(true);
      expect(isSentence(el[e]?.missing), `${e}.missing`).toBe(true);
    }
  });

  it("신강·신약·중화 한 문장씩", () => {
    const st = saju.strength as Record<string, unknown>;
    expectExactKeys(st, STRENGTHS);
    for (const s of STRENGTHS) expect(isSentence(st[s]), s).toBe(true);
  });

  it("용신 5개: colors 2개, direction, activities 3개, advice", () => {
    const ys = saju.yongsin as Rec;
    expectExactKeys(ys, ELEMENTS);
    for (const e of ELEMENTS) {
      const y = ys[e];
      expect(y, e).toBeDefined();
      if (!y) continue;
      expectStringArray(y.colors, 2, 2);
      expect(DIRECTIONS, `${e}.direction`).toContain(y.direction);
      expectStringArray(y.activities, 3, 3);
      expect(isSentence(y.advice), `${e}.advice`).toBe(true);
    }
    // 오행마다 방향이 하나씩 다르다
    expect(new Set(ELEMENTS.map((e) => ys[e]?.direction)).size).toBe(5);
  });

  it("합충 4종류: natal, luck", () => {
    const rel = saju.relations as Rec;
    expectExactKeys(rel, RELATIONS);
    for (const r of RELATIONS) {
      expect(isSentence(rel[r]?.natal), `${r}.natal`).toBe(true);
      expect(isSentence(rel[r]?.luck), `${r}.luck`).toBe(true);
    }
  });
});

describe("오방기 의미표 (data/meanings/obanggi.json)", () => {
  const flags = obanggi as Rec;

  it("깃발 5개, 각각 id·grade·keywords·meaning·byCategory", () => {
    expectExactKeys(flags, FLAGS);
    const ids = new Set<unknown>();
    for (const color of FLAGS) {
      const f = flags[color];
      expect(f, color).toBeDefined();
      if (!f) continue;
      expectExactKeys(f, ["id", "grade", "keywords", "meaning", "byCategory"]);
      expect(f.id, `${color}.id`).toMatch(/^[a-z][a-z-]*$/);
      ids.add(f.id);
      expect(GRADES, `${color}.grade`).toContain(f.grade);
      expectStringArray(f.keywords, 3, 5);
      expect(isSentence(f.meaning), `${color}.meaning`).toBe(true);
      const sentences = (f.meaning as string).split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, `${color}.meaning 문장 수`).toBeGreaterThanOrEqual(1);
      expect(sentences.length, `${color}.meaning 문장 수`).toBeLessThanOrEqual(2);
      const byCat = f.byCategory as Record<string, unknown>;
      expectExactKeys(byCat, CATEGORIES);
      for (const c of CATEGORIES) expect(isSentence(byCat[c]), `${color}.${c}`).toBe(true);
    }
    expect(ids.size).toBe(5);
  });

  it("다섯 중 셋 이상은 길하다 (대길·길)", () => {
    const good = FLAGS.filter((c) => ["대길", "길"].includes(flags[c]?.grade as string));
    expect(good.length).toBeGreaterThanOrEqual(3);
  });
});

describe("인사말 (packages/prompts/greetings.json)", () => {
  const g = greetings as Rec;

  it("점집 4곳, enter 5줄, dailyLimit 2줄", () => {
    expectExactKeys(g, SHOPS);
    for (const shop of SHOPS) {
      const s = g[shop];
      expect(s, shop).toBeDefined();
      if (!s) continue;
      expectExactKeys(s, ["enter", "dailyLimit"]);
      expectStringArray(s.enter, 5, 5);
      expectStringArray(s.dailyLimit, 2, 2);
    }
  });

  it("닉네임 자리표시자는 {닉네임}만 쓴다", () => {
    for (const { path, text } of allStrings(greetings)) {
      const placeholders = text.match(/\{[^}]*\}/g) ?? [];
      for (const p of placeholders) expect(p, path).toBe("{닉네임}");
    }
  });
});

describe("금지 표현 (docs/04 §7 v1)", () => {
  it("검사 정규식이 금지 표현을 실제로 잡는다", () => {
    expect(bannedHits("올해 액운이 꼈다")).toContain("액운");
    expect(bannedHits("부적을 사야 한다")).toContain("부적");
    expect(bannedHits("굿을 해야 풀린다")).toContain("굿을");
    expect(bannedHits("곧 사고가 날 수 있다")).toContain("사고가 나/날");
    expect(bannedHits("반드시 망한다")).toContain("반드시 망·실패·헤어");
    expect(bannedHits("이 코인은 지금 사야 한다")).toContain("투자 단정");
    expect(bannedHits("오늘은 천천히 쉬어 가면 좋다")).toEqual([]);
  });

  const files = { saju, obanggi, greetings };
  for (const [name, data] of Object.entries(files)) {
    it(`${name}의 모든 문장에 금지 표현이 없다`, () => {
      const strings = allStrings(data);
      expect(strings.length).toBeGreaterThan(0);
      const bad = strings
        .map(({ path, text }) => ({ path, text, hits: bannedHits(text) }))
        .filter((x) => x.hits.length > 0);
      expect(bad).toEqual([]);
    });
  }
});
