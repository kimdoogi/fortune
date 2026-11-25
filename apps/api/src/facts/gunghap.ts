/**
 * 궁합 입력 만들기 (F16, 02 §5-9, D-089). 엔진이 정한 요인을 facts 문장과 결과 판으로 바꾼다.
 */
import {
  type GunghapFactor,
  type GunghapResult,
  type PillarsResult,
  stemInfo,
} from "@fortune/fortune-engine";
import type { GunghapBoard, GunghapPerson, GunghapRelation } from "@fortune/shared-types";
import { dayMasterFact } from "./saju";

const EL_WORD: Record<string, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };

/** 요인 → 화면 이름과 facts 문장 */
function describe(f: GunghapFactor, an: string, bn: string): { name: string; fact: string } {
  const ew = (e: string) => EL_WORD[e] ?? e;
  switch (f.kind) {
    case "element_saeng":
      return {
        name: `${ew(f.a)}·${ew(f.b)} 서로 살림`,
        fact: `두 사람의 타고난 기운은 ${an} 님 ${ew(f.a)}, ${bn} 님 ${ew(f.b)}로 한쪽이 다른 쪽을 키워 주는 사이(상생)다. 한 사람이 밀어 주면 다른 사람이 자란다.`,
      };
    case "element_same":
      return {
        name: `같은 ${ew(f.a)} 기운`,
        fact: `두 사람 모두 ${ew(f.a)} 기운(비화)이라 닮은 점이 많아 편하지만, 고집이 같은 방향으로 부딪히면 둘 다 물러서지 않는다.`,
      };
    case "element_geuk":
      return {
        name: `${ew(f.a)}·${ew(f.b)} 서로 다름`,
        fact: `두 사람의 타고난 기운은 ${an} 님 ${ew(f.a)}, ${bn} 님 ${ew(f.b)}로 한쪽이 다른 쪽을 누르는 사이(상극)다. 생각하고 움직이는 방식이 달라 자주 맞춰야 하지만, 서로 모자란 걸 채워 줄 수 있다.`,
      };
    case "stem_hap":
      return {
        name: "처음부터 끌림",
        fact: `두 사람의 일간 ${f.a}·${f.b}는 천간합이라 처음 만났을 때부터 묘하게 끌리는 짝이다.`,
      };
    case "zodiac_hap":
      return {
        name: `${f.a}띠·${f.b}띠 잘 맞음`,
        fact: `${f.a}띠와 ${f.b}띠는 육합이라 띠끼리 잘 맞는다. 같이 있으면 편하고 일이 부드럽게 풀린다.`,
      };
    case "zodiac_samhap":
      return {
        name: `${f.a}띠·${f.b}띠 같은 편`,
        fact: `${f.a}띠와 ${f.b}띠는 삼합으로 같은 무리라, 한편이 되어 함께 일을 키우기 좋다.`,
      };
    case "zodiac_chung":
      return {
        name: `${f.a}띠·${f.b}띠 부딪힘`,
        fact: `${f.a}띠와 ${f.b}띠는 육충이라 띠끼리 부딪힌다. 의견이 갈리면 크게 맞서기 쉬워 한 박자 쉬는 지혜가 필요하다.`,
      };
    case "zodiac_wonjin":
      return {
        name: `${f.a}띠·${f.b}띠 서운함 쌓임`,
        fact: `${f.a}띠와 ${f.b}띠는 원진이라 큰 싸움보다 괜히 서운한 마음이 쌓이기 쉽다. 작은 섭섭함을 그때그때 말로 풀어야 한다.`,
      };
    case "zodiac_same":
      return {
        name: `둘 다 ${f.a}띠`,
        fact: `두 사람 모두 ${f.a}띠라 생각하는 방식이 닮았다.`,
      };
    case "daybranch_hap":
      return {
        name: "가까울수록 편함",
        fact: "두 사람의 일지(가장 가까운 관계를 보는 자리)가 육합이라, 가까워질수록 편하고 정이 깊어진다.",
      };
    case "daybranch_chung":
      return {
        name: "가까울수록 다툼",
        fact: "두 사람의 일지(가장 가까운 관계를 보는 자리)가 육충이라, 가까워질수록 생활 습관 때문에 다투기 쉽다.",
      };
    case "yongsin_a":
      return {
        name: `${bn} 님이 힘이 됨`,
        fact: `${an} 님에게 필요한 ${ew(f.a)} 기운이 ${bn} 님에게 넉넉해, ${bn} 님이 곁에 있으면 ${an} 님이 힘을 얻는다.`,
      };
    case "yongsin_b":
      return {
        name: `${an} 님이 힘이 됨`,
        fact: `${bn} 님에게 필요한 ${ew(f.a)} 기운이 ${an} 님에게 넉넉해, ${an} 님이 곁에 있으면 ${bn} 님이 힘을 얻는다.`,
      };
  }
}

export interface GunghapSide {
  nickname: string;
  zodiac: string;
  natal: PillarsResult;
}

export function buildGunghap(
  a: GunghapSide,
  b: GunghapSide,
  r: GunghapResult,
  relation: GunghapRelation,
): { facts: string[]; board: GunghapBoard } {
  const person = (s: GunghapSide): GunghapPerson => {
    const stem = s.natal.pillars.day.charAt(0);
    return {
      nickname: s.nickname,
      zodiac: s.zodiac,
      dayStem: stem,
      element: stemInfo(stem).element,
    };
  };
  const described = r.factors.map((f) => ({ f, ...describe(f, a.nickname, b.nickname) }));
  const facts = [
    `두 사람 사이: ${relation}.`,
    `${a.nickname} 님(${a.zodiac}띠): ${dayMasterFact(a.natal.pillars.day.charAt(0))}`,
    `${b.nickname} 님(${b.zodiac}띠): ${dayMasterFact(b.natal.pillars.day.charAt(0))}`,
    `궁합 점수: ${r.score}점(${r.label}). 점수는 화면에 함께 나가니 말의 밝기를 등급에 맞춘다.`,
    ...described.map((d) => `${d.f.good ? "잘 맞는 요인" : "부딪히는 요인"}: ${d.fact}`),
  ];
  if (!described.some((d) => !d.f.good))
    facts.push("크게 부딪히는 요인은 없다. 닮아서 생기는 작은 마찰 정도만 있다.");
  const board: GunghapBoard = {
    score: r.score,
    label: r.label,
    relation,
    a: person(a),
    b: person(b),
    factors: described.map((d) => ({ name: d.name, good: d.f.good })),
  };
  return { facts, board };
}
