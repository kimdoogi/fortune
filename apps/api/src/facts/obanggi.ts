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
