/** 오방기 입력 만들기 (docs/04 §3-4, F07). 깃발 의미는 obanggi.json에서만 가져온다 */
import type { DolyeongCategory, FlagColor, FlagGrade } from "@fortune/shared-types";
import { OBANGGI } from "./data";

export interface ObanggiParts {
  facts: string[];
  flag: { color: FlagColor; grade: FlagGrade };
}

export function buildObanggi(color: FlagColor, category: DolyeongCategory): ObanggiParts {
  const m = OBANGGI[color];
  const facts = [
    `뽑힌 깃발: ${color} 깃발 (${m.grade}).`,
    `${color} 깃발의 뜻: ${m.meaning} 키워드: ${m.keywords.join(", ")}.`,
  ];
  const line = m.byCategory[category];
  if (line) facts.push(`${category} 쪽으로 보면: ${line}`);
  return { facts, flag: { color, grade: m.grade } };
}

const RICE_WORD: Record<FlagGrade, string> = {
  대길: "일곱은 가장 좋은 수라 대길",
  길: "홀수라 좋은 수, 길",
  평: "홀수지만 작은 수라 평범, 평",
  주의: "짝수라 조심하라는 뜻, 주의",
};

/**
 * 신점 (F07, D-073·D-087): 쌀점 결과 + 같은 등급의 숨은 오방기 뜻 + 손님의 띠. 카테고리는 없다
 */
export function buildSinjeom(
  color: FlagColor,
  rice: { count: number; grade: FlagGrade },
  zodiac: string,
): ObanggiParts & { rice: { count: number; grade: FlagGrade } } {
  const m = OBANGGI[color];
  const facts = [
    `손님은 ${zodiac}띠다. 아기도령이 띠를 물어 확인했다.`,
    `쌀점: 아기도령이 제상의 쌀을 던져 손바닥에 쌀알 ${rice.count}개가 잡혔다. ${RICE_WORD[rice.grade]}. (쌀점은 홀수가 좋고 짝수는 조심, 홀수 중 7이 가장 좋고 9·3·5·1 순)`,
    `할아버지(신령)가 보여 준 기운: ${color} 기운 (${m.grade}). 뜻: ${m.meaning} 키워드: ${m.keywords.join(", ")}.`,
  ];
  return { facts, flag: { color, grade: m.grade }, rice };
}
