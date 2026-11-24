/**
 * docs/02-saju-rules.md §5 계산 예시. 외부 정답이 없는 우리 규칙이라 문서 규칙대로 손으로 계산한 값이다.
 * 원국은 02a fixture 정답에서 가져왔다 (A-01, A-03, A-16, B-02, J-01). 마지막 하나는 "신강 + 관성 없음"을
 * 확인하려고 만든 가상 원국이다.
 */
import { describe, expect, it } from "vitest";
import {
  type Pillars,
  analyzePillars,
  computeDaewoon,
  computePillars,
  luckAt,
  sewoonOfYear,
} from "../src";

const P = (year: string, month: string, day: string, hour: string | null): Pillars => ({
  year,
  month,
  day,
  hour,
});

describe("원국 분석 (02 §5-1~§5-4, §5-7)", () => {
  it("A-01 신유·신묘·정축·을사 → 중화, 용신 수", () => {
    const a = analyzePillars(P("신유", "신묘", "정축", "을사"));
    expect(a.dayMaster).toEqual({ stem: "정", element: "화", yinYang: "음" });
    expect(a.elements).toEqual({
      counts: { 목: 2, 화: 2, 토: 1, 금: 3, 수: 0 },
      missing: ["수"],
      excess: ["금"],
    });
    expect(a.tenGods).toEqual({
      yearStem: "편재",
      monthStem: "편재",
      hourStem: "편인",
      yearBranch: "편재",
      monthBranch: "편인",
      dayBranch: "식신",
      hourBranch: "겁재",
    });
    // 돕는 점수: 시간 을 1 + 월지 묘 3 + 시지 사 1 = 5 / 9.5
    expect(a.strength).toEqual({ label: "중화", ratio: 0.53 });
    // 중화: 가장 낮은 오행 수(0), 희신은 수를 생하는 금
    expect(a.yongsin).toEqual({ yongsin: "수", huisin: "금", method: "억부" });
    expect(a.relations).toEqual([
      { type: "천간충", a: "연간 신", b: "시간 을" },
      { type: "천간충", a: "월간 신", b: "시간 을" },
      { type: "지지육충", a: "연지 유", b: "월지 묘" },
    ]);
  });

  it("A-03 계유·계해·을미·기묘 → 신강(인성 > 비겁), 용신 재성 토", () => {
    const a = analyzePillars(P("계유", "계해", "을미", "기묘"));
    expect(a.tenGods).toEqual({
      yearStem: "편인",
      monthStem: "편인",
      hourStem: "편재",
      yearBranch: "편관",
      monthBranch: "정인",
      dayBranch: "편재",
      hourBranch: "비견",
    });
    expect(a.elements.counts).toEqual({ 목: 2, 화: 0, 토: 2, 금: 1, 수: 3 });
    // 돕는 점수: 연간 1 + 월간 1 + 월지 3 + 시지 1 = 6 / 9.5
    expect(a.strength).toEqual({ label: "신강", ratio: 0.63 });
    // 인성(수) 5 > 비겁(목) 1 → 재성(토), 희신 식상(화)
    expect(a.yongsin).toEqual({ yongsin: "토", huisin: "화", method: "억부" });
    expect(a.relations).toEqual([{ type: "지지육충", a: "연지 유", b: "시지 묘" }]);
  });

  it("A-16 기묘·계유·경진·임오 → 신강(비겁 강함), 용신 관성 화", () => {
    const a = analyzePillars(P("기묘", "계유", "경진", "임오"));
    expect(a.tenGods).toEqual({
      yearStem: "정인",
      monthStem: "상관",
      hourStem: "식신",
      yearBranch: "정재",
      monthBranch: "겁재",
      dayBranch: "편인",
      hourBranch: "정관",
    });
    expect(a.elements).toEqual({
      counts: { 목: 1, 화: 1, 토: 2, 금: 2, 수: 2 },
      missing: [],
      excess: [],
    });
    // 돕는 점수: 연간 1 + 월지 3 + 일지 1.5 = 5.5 / 9.5
    expect(a.strength).toEqual({ label: "신강", ratio: 0.58 });
    // 인성(토) 2.5 ≤ 비겁(금) 3, 관성(화) 1 → 용신 화, 희신 재성(목)
    expect(a.yongsin).toEqual({ yongsin: "화", huisin: "목", method: "억부" });
    expect(a.relations).toEqual([
      { type: "지지육충", a: "연지 묘", b: "월지 유" },
      { type: "지지육합", a: "월지 유", b: "일지 진" },
    ]);
  });

  it("B-02 을유·무인·기미·을축 → 신약, 용신 인성 화", () => {
    const a = analyzePillars(P("을유", "무인", "기미", "을축"));
    expect(a.tenGods).toEqual({
      yearStem: "편관",
      monthStem: "겁재",
      hourStem: "편관",
      yearBranch: "식신",
      monthBranch: "정관",
      dayBranch: "비견",
      hourBranch: "비견",
    });
    expect(a.elements).toEqual({
      counts: { 목: 3, 화: 0, 토: 4, 금: 1, 수: 0 },
      missing: ["화", "수"],
      excess: ["목", "토"],
    });
    // 돕는 점수: 월간 1 + 일지 1.5 + 시지 1 = 3.5 / 9.5
    expect(a.strength).toEqual({ label: "신약", ratio: 0.37 });
    expect(a.yongsin).toEqual({ yongsin: "화", huisin: "토", method: "억부" });
    expect(a.relations).toEqual([{ type: "지지육충", a: "일지 미", b: "시지 축" }]);
  });

  it("J-01 을축·기묘·경술 (시간 모름) → 중화, 동점이면 목→화→토→금→수", () => {
    const a = analyzePillars(P("을축", "기묘", "경술", null));
    expect(a.tenGods).toEqual({
      yearStem: "정재",
      monthStem: "정인",
      hourStem: null,
      yearBranch: "정인",
      monthBranch: "정재",
      dayBranch: "편인",
      hourBranch: null,
    });
    expect(a.elements).toEqual({
      counts: { 목: 2, 화: 0, 토: 3, 금: 1, 수: 0 },
      missing: ["화", "수"],
      excess: ["토"],
    });
    // 돕는 점수: 월간 1 + 연지 1 + 일지 1.5 = 3.5 / 7.5
    expect(a.strength).toEqual({ label: "중화", ratio: 0.47 });
    // 점수 0인 화·금·수 중 순서상 화. 희신은 화를 생하는 목
    expect(a.yongsin).toEqual({ yongsin: "화", huisin: "목", method: "억부" });
    expect(a.relations).toEqual([
      { type: "천간합", a: "연간 을", b: "일간 경" },
      { type: "지지육합", a: "월지 묘", b: "일지 술" },
    ]);
  });

  it("가상 원국 임자·계묘·갑인·을해 → 신강, 관성 0이라 용신 식상 화", () => {
    const a = analyzePillars(P("임자", "계묘", "갑인", "을해"));
    expect(a.tenGods).toEqual({
      yearStem: "편인",
      monthStem: "정인",
      hourStem: "겁재",
      yearBranch: "정인",
      monthBranch: "겁재",
      dayBranch: "비견",
      hourBranch: "편인",
    });
    expect(a.elements).toEqual({
      counts: { 목: 4, 화: 0, 토: 0, 금: 0, 수: 4 },
      missing: ["화", "토", "금"],
      excess: ["목", "수"],
    });
    expect(a.strength).toEqual({ label: "신강", ratio: 1 });
    // 인성(수) 4 ≤ 비겁(목) 5.5, 관성(금) 0 → 식상(화), 희신 재성(토)
    expect(a.yongsin).toEqual({ yongsin: "화", huisin: "토", method: "억부" });
    expect(a.relations).toEqual([{ type: "지지육합", a: "일지 인", b: "시지 해" }]);
  });
});

describe("대운 (02 §5-5)", () => {
  // B-02: 2005-02-04 02:45 출생, 입춘 02:43 직후. 연간 을 = 음년
  const b02 = computePillars({ calendar: "solar", date: "2005-02-04", time: "02:45" });

  it("음년 남자 → 역행, 직전 절(입춘)까지 2분 → 대운수 최소 1", () => {
    const d = computeDaewoon(b02, "male", "2026-11-25", false);
    expect(d.direction).toBe("역행");
    expect(d.startAge).toBe(1);
    expect(d.list.map((x) => x.pillar)).toEqual([
      "정축",
      "병자",
      "을해",
      "갑술",
      "계유",
      "임신",
      "신미",
      "경오",
      "기사",
      "무진",
    ]);
    expect(d.list.map((x) => x.fromAge)).toEqual([1, 11, 21, 31, 41, 51, 61, 71, 81, 91]);
    // 2026-11-25 만 21세 → 세 번째 대운 을해
    expect(d.current?.pillar).toBe("을해");
    expect(d.current?.tenGods).toEqual(["편관", "정재"]);
  });

  it("음년 여자 → 순행, 다음 절(경칩 03-05 20:45)까지 29.75일 → 대운수 10", () => {
    const d = computeDaewoon(b02, "female", "2026-11-25", false);
    expect(d.direction).toBe("순행");
    expect(d.days).toBeCloseTo(29.75, 3);
    expect(d.startAge).toBe(10);
    expect(d.list.map((x) => x.pillar)).toEqual([
      "기묘",
      "경진",
      "신사",
      "임오",
      "계미",
      "갑신",
      "을유",
      "병술",
      "정해",
      "무자",
    ]);
    // 만 21세 → 두 번째 대운 경진 (20~29세)
    expect(d.current?.pillar).toBe("경진");
  });

  it("A-01 1921-03-15 10:00 여자: 신년(음) 여자 → 순행, 청명까지 약 21일 → 대운수 7", () => {
    const a01 = computePillars({ calendar: "solar", date: "1921-03-15", time: "10:00" });
    const d = computeDaewoon(a01, "female", "2026-11-25", false);
    expect(d.direction).toBe("순행");
    expect(d.startAge).toBe(7);
    expect(d.list[0]?.pillar).toBe("임진");
    expect(d.list[9]?.pillar).toBe("신축");
    // 만 105세 → 열 번째 대운 신축 (97~106세)
    expect(d.current?.pillar).toBe("신축");
  });

  it("첫 대운 전이면 current는 null", () => {
    const d = computeDaewoon(b02, "female", "2010-01-01", false);
    expect(d.current).toBeNull();
  });
});

describe("세운·월운·일진 (02 §5-6)", () => {
  const b02 = P("을유", "무인", "기미", "을축");

  it("2026-11-25: 세운 병오, 월운 기해(입동 뒤), 일진 계묘", () => {
    const l = luckAt(b02, "2026-11-25");
    expect(l.sewoon.pillar).toBe("병오");
    expect(l.wolwoon.pillar).toBe("기해");
    expect(l.iljin.pillar).toBe("계묘");
    // 일간 기(토·음) 기준: 병(화·양) 정인, 오(정화·음) 편인
    expect(l.sewoon.tenGods).toEqual(["정인", "편인"]);
    // 세운 지지 오와 일지 미가 육합
    expect(l.sewoon.relations).toEqual([{ type: "지지육합", a: "세운 지지 오", b: "일지 미" }]);
  });

  it("신년운세용 세운: 2027년 정미", () => {
    expect(sewoonOfYear(2027, b02).pillar).toBe("정미");
  });
});
